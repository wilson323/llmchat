/**
 * 安全中间件和输入验证工具
 *
 * 提供全面的输入验证、输出编码和安全防护功能
 * 遵循OWASP安全标准和最佳实践
 */

import { sanitizeHTML, detectXSS, secureContentSanitizer } from './secureContentSanitizer';

// 输入验证规则
export const VALIDATION_RULES = {
  // 用户名验证
  USERNAME: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_\-.]+$/,
    allowedChars: '字母、数字、下划线、连字符、点'
  },

  // 邮箱验证
  EMAIL: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254
  },

  // 消息内容验证
  MESSAGE: {
    minLength: 1,
    maxLength: 50000, // 50KB
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre'],
    maxLinks: 50
  },

  // 文件名验证
  FILENAME: {
    pattern: /^[a-zA-Z0-9._\-\u4e00-\u9fa5]+$/,
    maxLength: 255,
    forbiddenPatterns: ['..', '/', '\\', ':', '*', '?', '"', '<', '>', '|']
  }
};

// 安全错误类型
export enum SecurityErrorType {
  XSS_DETECTED = 'XSS_DETECTED',
  INVALID_INPUT = 'INVALID_INPUT',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  FORBIDDEN_CONTENT = 'FORBIDDEN_CONTENT',
  MALFORMED_DATA = 'MALFORMED_DATA',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

// 验证结果接口
export interface ValidationResult {
  isValid: boolean;
  errors: SecurityError[];
  warnings: string[];
  sanitized?: any;
}

// 安全错误接口
export interface SecurityError {
  type: SecurityErrorType;
  message: string;
  field?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: any;
}

/**
 * 安全验证器类
 */
export class SecurityValidator {
  private static instance: SecurityValidator;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  private constructor() {}

  static getInstance(): SecurityValidator {
    if (!SecurityValidator.instance) {
      SecurityValidator.instance = new SecurityValidator();
    }
    return SecurityValidator.instance;
  }

  /**
   * 验证用户名
   */
  validateUsername(username: string): ValidationResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    if (!username || typeof username !== 'string') {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: '用户名不能为空',
        field: 'username',
        severity: 'high'
      });
      return { isValid: false, errors, warnings };
    }

    // 长度验证
    if (username.length < VALIDATION_RULES.USERNAME.minLength) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: `用户名长度不能少于${VALIDATION_RULES.USERNAME.minLength}个字符`,
        field: 'username',
        severity: 'medium'
      });
    }

    if (username.length > VALIDATION_RULES.USERNAME.maxLength) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: `用户名长度不能超过${VALIDATION_RULES.USERNAME.maxLength}个字符`,
        field: 'username',
        severity: 'medium'
      });
    }

    // 字符验证
    if (!VALIDATION_RULES.USERNAME.pattern.test(username)) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: `用户名只能包含${VALIDATION_RULES.USERNAME.allowedChars}`,
        field: 'username',
        severity: 'medium'
      });
    }

    // XSS检测
    const xssCheck = detectXSS(username);
    if (xssCheck.isXSS) {
      errors.push({
        type: SecurityErrorType.XSS_DETECTED,
        message: '用户名包含潜在的安全威胁',
        field: 'username',
        severity: 'critical',
        details: { threats: xssCheck.threats }
      });
    }

    // 常见攻击模式检测
    const suspiciousPatterns = [
      /admin/i, /root/i, /system/i, /null/i, /undefined/i,
      /<script/i, /javascript:/i, /data:/i, /vbscript:/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(username)) {
        warnings.push(`用户名包含可疑内容: ${pattern.source}`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: errors.length > 0 ? this.sanitizeUsername(username) : username
    };
  }

  /**
   * 验证邮箱地址
   */
  validateEmail(email: string): ValidationResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: '邮箱地址不能为空',
        field: 'email',
        severity: 'high'
      });
      return { isValid: false, errors, warnings };
    }

    // 长度验证
    if (email.length > VALIDATION_RULES.EMAIL.maxLength) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: `邮箱地址长度不能超过${VALIDATION_RULES.EMAIL.maxLength}个字符`,
        field: 'email',
        severity: 'medium'
      });
    }

    // 格式验证
    if (!VALIDATION_RULES.EMAIL.pattern.test(email)) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: '邮箱地址格式不正确',
        field: 'email',
        severity: 'medium'
      });
    }

    // XSS检测
    const xssCheck = detectXSS(email);
    if (xssCheck.isXSS) {
      errors.push({
        type: SecurityErrorType.XSS_DETECTED,
        message: '邮箱地址包含潜在的安全威胁',
        field: 'email',
        severity: 'critical',
        details: { threats: xssCheck.threats }
      });
    }

    // 危险邮箱域名检测
    const dangerousDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (dangerousDomains.some(d => domain?.includes(d))) {
      warnings.push('使用了临时邮箱服务，可能影响账户安全');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: email.toLowerCase().trim()
    };
  }

  /**
   * 验证消息内容
   */
  validateMessage(content: string): ValidationResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    if (!content || typeof content !== 'string') {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: '消息内容不能为空',
        field: 'content',
        severity: 'high'
      });
      return { isValid: false, errors, warnings };
    }

    // 长度验证
    if (content.length < VALIDATION_RULES.MESSAGE.minLength) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: `消息内容长度不能少于${VALIDATION_RULES.MESSAGE.minLength}个字符`,
        field: 'content',
        severity: 'low'
      });
    }

    if (content.length > VALIDATION_RULES.MESSAGE.maxLength) {
      errors.push({
        type: SecurityErrorType.CONTENT_TOO_LARGE,
        message: `消息内容长度不能超过${VALIDATION_RULES.MESSAGE.maxLength}个字符`,
        field: 'content',
        severity: 'high'
      });
    }

    // XSS检测
    const xssCheck = detectXSS(content);
    if (xssCheck.isXSS) {
      errors.push({
        type: SecurityErrorType.XSS_DETECTED,
        message: '消息内容包含潜在的安全威胁',
        field: 'content',
        severity: 'critical',
        details: { threats: xssCheck.threats }
      });

      // 记录安全事件
      secureContentSanitizer.logSecurityEvent({
        type: 'XSS_DETECTED',
        threats: xssCheck.threats,
        content: content.substring(0, 200),
        timestamp: new Date().toISOString()
      });
    }

    // 链接数量验证
    const linkMatches = content.match(/https?:\/\/[^\s]+/gi);
    if (linkMatches && linkMatches.length > VALIDATION_RULES.MESSAGE.maxLinks) {
      warnings.push(`消息包含${linkMatches.length}个链接，超过了推荐的最大数量${VALIDATION_RULES.MESSAGE.maxLinks}`);
    }

    // 恶意内容检测
    const maliciousPatterns = [
      /password\s*[=:]\s*\S+/gi,
      /token\s*[=:]\s*\S+/gi,
      /api[_-]?key\s*[=:]\s*\S+/gi,
      /secret\s*[=:]\s*\S+/gi
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        warnings.push('消息内容可能包含敏感信息');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: sanitizeHTML(content)
    };
  }

  /**
   * 验证文件名
   */
  validateFilename(filename: string): ValidationResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    if (!filename || typeof filename !== 'string') {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: '文件名不能为空',
        field: 'filename',
        severity: 'high'
      });
      return { isValid: false, errors, warnings };
    }

    // 长度验证
    if (filename.length > VALIDATION_RULES.FILENAME.maxLength) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: `文件名长度不能超过${VALIDATION_RULES.FILENAME.maxLength}个字符`,
        field: 'filename',
        severity: 'medium'
      });
    }

    // 字符验证
    if (!VALIDATION_RULES.FILENAME.pattern.test(filename)) {
      errors.push({
        type: SecurityErrorType.INVALID_INPUT,
        message: '文件名包含非法字符',
        field: 'filename',
        severity: 'medium'
      });
    }

    // 危险字符检测
    for (const forbidden of VALIDATION_RULES.FILENAME.forbiddenPatterns) {
      if (filename.includes(forbidden)) {
        errors.push({
          type: SecurityErrorType.FORBIDDEN_CONTENT,
          message: `文件名不能包含字符: ${forbidden}`,
          field: 'filename',
          severity: 'high'
        });
      }
    }

    // 危险文件扩展名检测
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs', '.jar'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (dangerousExtensions.includes(extension)) {
      errors.push({
        type: SecurityErrorType.FORBIDDEN_CONTENT,
        message: '不允许上传可执行文件',
        field: 'filename',
        severity: 'critical'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: filename.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
    };
  }

  /**
   * 简单速率限制检查
   */
  checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): ValidationResult {
    const errors: SecurityError[] = [];
    const now = Date.now();
    const key = identifier;

    const record = this.rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      // 创建新记录或重置过期记录
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return { isValid: true, errors: [], warnings: [] };
    }

    if (record.count >= maxRequests) {
      errors.push({
        type: SecurityErrorType.RATE_LIMIT_EXCEEDED,
        message: '请求过于频繁，请稍后再试',
        severity: 'medium',
        details: {
          currentCount: record.count,
          maxRequests,
          resetTime: new Date(record.resetTime).toISOString()
        }
      });
    } else {
      record.count++;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: record.count > maxRequests * 0.8 ? ['接近速率限制'] : []
    };
  }

  /**
   * 清理用户名
   */
  private sanitizeUsername(username: string): string {
    return username
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .toLowerCase()
      .substring(0, VALIDATION_RULES.USERNAME.maxLength);
  }

  /**
   * 验证JSON数据
   */
  validateJSON(data: any, maxSize: number = 1024 * 1024): ValidationResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);

      // 大小检查
      if (jsonString.length > maxSize) {
        errors.push({
          type: SecurityErrorType.CONTENT_TOO_LARGE,
          message: `JSON数据大小超过限制 (${maxSize} bytes)`,
          severity: 'high'
        });
      }

      // 解析测试
      JSON.parse(jsonString);

      // XSS检测
      const xssCheck = detectXSS(jsonString);
      if (xssCheck.isXSS) {
        errors.push({
          type: SecurityErrorType.XSS_DETECTED,
          message: 'JSON数据包含潜在的安全威胁',
          severity: 'critical',
          details: { threats: xssCheck.threats }
        });
      }

    } catch (error) {
      errors.push({
        type: SecurityErrorType.MALFORMED_DATA,
        message: `JSON数据格式错误: ${error}`,
        severity: 'high'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 清理速率限制记录
   */
  clearRateLimitRecords(): void {
    this.rateLimitMap.clear();
  }
}

// 导出单例实例
export const securityValidator = SecurityValidator.getInstance();

// 便捷函数
export const validateUsername = (username: string): ValidationResult =>
  securityValidator.validateUsername(username);

export const validateEmail = (email: string): ValidationResult =>
  securityValidator.validateEmail(email);

export const validateMessage = (content: string): ValidationResult =>
  securityValidator.validateMessage(content);

export const validateFilename = (filename: string): ValidationResult =>
  securityValidator.validateFilename(filename);

export const validateJSON = (data: any, maxSize?: number): ValidationResult =>
  securityValidator.validateJSON(data, maxSize);

export const checkRateLimit = (identifier: string, maxRequests?: number, windowMs?: number): ValidationResult =>
  securityValidator.checkRateLimit(identifier, maxRequests, windowMs);