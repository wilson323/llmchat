import { Request, Response, NextFunction } from 'express';
import logger, { logAudit } from '@/utils/logger';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

/**
 * 安全日志辅助函数 - 替代StructuredLogger的securityLogger
 */
function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  logAudit(event, {
    ...details,
    type: 'security',
    severity: 'medium',
  });
}

/**
 * 安全威胁检测结果
 */
interface SecurityThreat {
  type: 'sql_injection' | 'xss' | 'path_traversal' | 'command_injection' |
        'rate_limit' | 'suspicious_user_agent' | 'blocked_ip' | 'invalid_token';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string | undefined;
}

/**
 * IP地址和用户代理信息
 */
interface ClientInfo {
  ip: string;
  userAgent?: string;
  country?: string;
  isSuspicious: boolean;
  threatLevel: number;
}

/**
 * 安全中间件配置
 */
interface SecurityConfig {
  rateLimitWindowMs: number;
  rateLimitMax: number;
  strictRateLimitWindowMs: number;
  rateLimitMaxStrict: number;
  blockedIPs: string[];
  allowedOrigins: string[];
  enableCSP: boolean;
  enableHSTS: boolean;
  maxRequestSize: string;
  enableRequestValidation: boolean;
}

/**
 * 安全工具类
 */
export class SecurityUtils {
  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /('|''|;|--|#|\/\*|\*\/)/,
    /(\bOR\b.*=.*\bOR\b)/i,
    /(\bAND\b.*=.*\bAND\b)/i,
    /(1=1|1 = 1|true)/i,
  ];

  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<[^>]*on\w+\s*=.*?>/gi,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[\/\\]/,
    /[\/\\]\.\.[\/\\]/,
    /[\/\\]\.\.$/,
    /\.%2e%2e[\/\\]/i,
    /[\/\\]\.%2e%2e/i,
    /%2e%2e%2f/i,
  ];

  private static readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$()]/,
    /\$\([^)]*\)/,
    /`[^`]*`/,
    /\b(curl|wget|nc|netcat|telnet|ssh|ftp)\b/i,
    /\b(rm|mv|cp|cat|ls|ps|kill|chmod|chown)\b/i,
  ];

  private static readonly SUSPICIOUS_USER_AGENTS = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /dirb/i,
    /gobuster/i,
    /hydra/i,
    /burp/i,
    /zap/i,
    /sqlninja/i,
    /havij/i,
    /pangolin/i,
    /python-requests/i,
    /curl/i,
    /wget/i,
  ];

  /**
   * 检测SQL注入攻击
   */
  static detectSQLInjection(input: string): SecurityThreat | null {
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          type: 'sql_injection',
          severity: 'high',
          description: 'Potential SQL injection detected',
          evidence: input.match(pattern)?.[0],
        };
      }
    }
    return null;
  }

  /**
   * 检测XSS攻击
   */
  static detectXSS(input: string): SecurityThreat | null {
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        return {
          type: 'xss',
          severity: 'medium',
          description: 'Potential XSS attack detected',
          evidence: input.match(pattern)?.[0],
        };
      }
    }
    return null;
  }

  /**
   * 检测路径遍历攻击
   */
  static detectPathTraversal(input: string): SecurityThreat | null {
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(input)) {
        return {
          type: 'path_traversal',
          severity: 'high',
          description: 'Potential path traversal attack detected',
          evidence: input.match(pattern)?.[0],
        };
      }
    }
    return null;
  }

  /**
   * 检测命令注入攻击
   */
  static detectCommandInjection(input: string): SecurityThreat | null {
    for (const pattern of this.COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          type: 'command_injection',
          severity: 'critical',
          description: 'Potential command injection attack detected',
          evidence: input.match(pattern)?.[0],
        };
      }
    }
    return null;
  }

  /**
   * 检测可疑用户代理
   */
  static detectSuspiciousUserAgent(userAgent: string): SecurityThreat | null {
    for (const pattern of this.SUSPICIOUS_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        return {
          type: 'suspicious_user_agent',
          severity: 'medium',
          description: 'Suspicious user agent detected',
          evidence: userAgent.match(pattern)?.[0],
        };
      }
    }
    return null;
  }

  /**
   * 综合安全检测
   */
  static detectThreats(input: string, userAgent?: string): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // 检测各种攻击模式
    const sqlThreat = this.detectSQLInjection(input);
    if (sqlThreat) {
      threats.push(sqlThreat);
    }

    const xssThreat = this.detectXSS(input);
    if (xssThreat) {
      threats.push(xssThreat);
    }

    const pathThreat = this.detectPathTraversal(input);
    if (pathThreat) {
      threats.push(pathThreat);
    }

    const cmdThreat = this.detectCommandInjection(input);
    if (cmdThreat) {
      threats.push(cmdThreat);
    }

    // 检测可疑用户代理
    if (userAgent) {
      const uaThreat = this.detectSuspiciousUserAgent(userAgent);
      if (uaThreat) {
        threats.push(uaThreat);
      }
    }

    return threats;
  }

  /**
   * 获取客户端信息
   */
  static getClientInfo(req: Request): ClientInfo {
    const ip = req.ip ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               (req.connection as any)?.socket?.remoteAddress ||
               'unknown';

    const userAgent = req.get('User-Agent') || 'unknown';

    // 检测可疑性
    const threats = this.detectThreats('', userAgent);
    const isSuspicious = threats.length > 0;

    // 计算威胁级别
    const threatLevel = threats.reduce((level, threat) => {
      const severityScores = { low: 1, medium: 2, high: 3, critical: 4 };
      return level + severityScores[threat.severity];
    }, 0);

    return {
      ip,
      userAgent,
      isSuspicious,
      threatLevel,
    };
  }

  /**
   * 清理和验证输入
   */
  static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // 移除潜在的危险字符
      return input
        .replace(/[<>'"]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * 验证JSON格式
   */
  static isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 请求验证中间件
 */
export const requestValidationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // 检查请求大小
    const contentLength = req.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
      logSecurityEvent('Request size limit exceeded', {
        ...(req.ip && { ip: req.ip }),
        url: req.url,
        contentLength: parseInt(contentLength),
      });
      res.status(413).json({
        error: 'Request Entity Too Large',
        message: 'Request size exceeds maximum allowed limit',
      });
      return;
    }

    // 检查Content-Type
    const contentType = req.get('Content-Type');
    if (req.method !== 'GET' && !contentType && req.body) {
      logSecurityEvent('Missing Content-Type header', {
        ...(req.ip && { ip: req.ip }),
        method: req.method,
        url: req.url,
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Content-Type header is required for requests with body',
      });
      return;
    }

    // 验证JSON请求体
    if (contentType?.includes('application/json') && req.body) {
      if (typeof req.body === 'string' && !SecurityUtils.isValidJSON(req.body)) {
        logSecurityEvent('Invalid JSON in request body', {
          ...(req.ip && { ip: req.ip }),
          method: req.method,
          url: req.url,
        });
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid JSON format in request body',
        });
        return;
      }
    }

    next();
  } catch (error) {
    logSecurityEvent('Request validation error', {
      ...(req.ip && { ip: req.ip }),
      error: {
        name: 'ValidationError',
        message: error instanceof Error ? error.message : String(error),
      },
      url: req.url,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Request validation failed',
    });
    return;
  }
};

/**
 * 安全威胁检测中间件
 */
export const securityDetectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientInfo = SecurityUtils.getClientInfo(req);

  // 检查IP是否被阻止
  const config: SecurityConfig = {
    blockedIPs: process.env.BLOCKED_IPS?.split(',') || [],
    // ... 其他配置
  } as SecurityConfig;

  if (config.blockedIPs.includes(clientInfo.ip)) {
    logSecurityEvent('Blocked IP attempted access', {
      ip: clientInfo.ip,
      ...(clientInfo.userAgent && { userAgent: clientInfo.userAgent }),
      url: req.url,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
    });
    return;
  }

  // 检测请求URL和参数中的威胁
  const url = req.originalUrl || req.url || '';
  const queryString = req.url?.split('?')[1] || '';
  const fullInput = url + ' ' + queryString;

  const threats = SecurityUtils.detectThreats(fullInput, clientInfo.userAgent);

  if (threats.length > 0) {
    // 记录安全威胁
    const logContext = {
      ip: clientInfo.ip,
      ...(clientInfo.userAgent && { userAgent: clientInfo.userAgent }),
      suspicious: true,
      threat: threats.map(t => t.type).join(', '),
      detectedThreats: threats,
    };

    logSecurityEvent('Security threats detected', logContext);

    // 根据威胁严重程度决定处理方式
    const hasCriticalThreat = threats.some(t => t.severity === 'critical');
    const hasHighThreat = threats.some(t => t.severity === 'high');

    if (hasCriticalThreat || hasHighThreat) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Request blocked due to security concerns',
      });
      return;
    }
  }

  // 检测可疑用户代理
  if (clientInfo.isSuspicious && clientInfo.threatLevel > 2) {
    logSecurityEvent('Suspicious user agent detected', {
      ip: clientInfo.ip,
      ...(clientInfo.userAgent && { userAgent: clientInfo.userAgent }),
      custom: {
        threatLevel: clientInfo.threatLevel,
      },
      url: req.url,
    });
  }

  next();
};

/**
 * 安全头部中间件
 */
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
});

/**
 * CORS配置中间件
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

    // 在开发环境中允许所有源
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (!origin) {
      return callback(null, false);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logSecurityEvent('CORS violation', {
        origin,
        allowedOrigins,
      });
      return callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
});

/**
 * 速率限制中间件
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const userAgent = req.get('User-Agent');
    logSecurityEvent('Rate limit exceeded', {
      ...(req.ip && { ip: req.ip }),
      url: req.url,
      ...(userAgent && { userAgent }),
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
  },
});

/**
 * 严格速率限制中间件（用于敏感操作）
 */
export const strictRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每个IP最多10个请求
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for sensitive operations.',
  },
  handler: (req, res) => {
    const userAgent = req.get('User-Agent');
    logSecurityEvent('Strict rate limit exceeded', {
      ...(req.ip && { ip: req.ip }),
      url: req.url,
      ...(userAgent && { userAgent }),
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for sensitive operations.',
    });
  },
});

/**
 * 综合安全中间件
 */
export const securityMiddleware = [
  securityHeadersMiddleware,
  corsMiddleware,
  requestValidationMiddleware,
  securityDetectionMiddleware,
  rateLimitMiddleware,
];

export default securityMiddleware;