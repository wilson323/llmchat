/**
 * 安全文件上传工具
 * 提供文件上传的安全验证和处理
 */

import { Request } from 'express';
import { LogSanitizer } from './logSanitizer';
import { promises as fs } from 'fs';

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  requireAuth?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  isValid?: boolean;
  error?: string;
  errors?: string[];
  sanitizedFilename?: string;
  warnings?: string[];
}

export class SecureUpload {
  private static readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly DEFAULT_ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/json',
  ];

  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.sh', '.ps1',
  ];

  static validateFile(
    file: Express.Multer.File,
    options: FileValidationOptions = {},
  ): ValidationResult {
    const {
      maxSize = this.DEFAULT_MAX_SIZE,
      allowedTypes = this.DEFAULT_ALLOWED_TYPES,
      allowedExtensions = [],
      requireAuth = true,
    } = options;

    // 检查文件大小
    if (file.size > maxSize) {
      return {
        valid: false,
        isValid: false,
        error: `File size exceeds maximum allowed size of ${maxSize} bytes`,
        errors: [`File size exceeds maximum allowed size of ${maxSize} bytes`],
      };
    }

    // 检查文件类型
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return {
        valid: false,
        isValid: false,
        error: `File type ${file.mimetype} is not allowed`,
        errors: [`File type ${file.mimetype} is not allowed`],
      };
    }

    // 检查文件扩展名
    const fileExtension = this.getFileExtension(file.originalname);
    if (this.DANGEROUS_EXTENSIONS.includes(fileExtension.toLowerCase())) {
      return {
        valid: false,
        error: `File extension ${fileExtension} is not allowed for security reasons`,
      };
    }

    if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension.toLowerCase())) {
      return {
        valid: false,
        error: `File extension ${fileExtension} is not allowed`,
      };
    }

    // 生成安全的文件名
    const sanitizedFilename = this.sanitizeFilename(file.originalname);

    return {
      valid: true,
      isValid: true,
      sanitizedFilename,
      errors: [],
      warnings: [],
    };
  }

  static validateCADFile(file: Express.Multer.File): ValidationResult {
    const cadOptions: FileValidationOptions = {
      maxSize: 10 * 1024 * 1024, // 10MB for CAD files
      allowedTypes: ['application/dxf', 'image/vnd.dxf', 'text/plain'],
      allowedExtensions: ['.dxf'],
      requireAuth: true,
    };

    return this.validateFile(file, cadOptions);
  }

  static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  static sanitizeFilename(filename: string): string {
    // 移除路径分隔符
    let sanitized = filename.replace(/[/\\]/g, '_');

    // 移除特殊字符
    sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

    // 移除控制字符 (除了换行符和制表符)
    sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '_');

    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, '_');

    // 移除开头和结尾的下划线和点
    sanitized = sanitized.replace(/^[_\.]+|[_\.]+$/g, '');

    // 确保文件名不为空
    if (!sanitized) {
      sanitized = `file_${Date.now()}`;
    }

    // 添加时间戳以避免冲突
    const extension = this.getFileExtension(filename);
    const nameWithoutExt = sanitized.substring(0, sanitized.length - extension.length);

    return `${nameWithoutExt}_${Date.now()}${extension}`;
  }

  static validateUserAuth(req: Request): boolean {
    // 检查用户是否已认证
    return !!(req as any).user?.id;
  }

  static logUpload(filename: string, userId: string, success: boolean): void {
    const sanitizedFilename = LogSanitizer.sanitize(filename);
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(`File upload ${status}: ${sanitizedFilename} by user ${userId}`);
  }

  static generateSecurePath(userId: string, filename: string): string {
    const sanitizedUserId = LogSanitizer.sanitize(userId);
    const sanitizedFilename = LogSanitizer.sanitize(filename);
    const timestamp = Date.now();

    return `/uploads/${sanitizedUserId}/${timestamp}_${sanitizedFilename}`;
  }

  static async scanForMalware(filePath: string): Promise<{ safe: boolean; threat?: string }> {
    // 这里可以集成病毒扫描软件
    // 目前只做基本的文件签名检查
    try {
      const buffer = await fs.readFile(filePath);

      // 检查PE文件头 (Windows可执行文件)
      if (buffer.length > 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return { safe: false, threat: 'PE executable detected' };
      }

      // 检查ELF文件头 (Linux可执行文件)
      if (buffer.length > 4 &&
          buffer[0] === 0x7F &&
          buffer[1] === 0x45 &&
          buffer[2] === 0x4C &&
          buffer[3] === 0x46) {
        return { safe: false, threat: 'ELF executable detected' };
      }

      // 检查可疑的脚本内容
      const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          return { safe: false, threat: 'Suspicious script content detected' };
        }
      }

      return { safe: true };
    } catch (error) {
      console.error('Malware scan failed:', error);
      return { safe: false, threat: 'Scan failed' };
    }
  }
}