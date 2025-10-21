/**
 * 安全文件上传工具
 * 提供文件上传的安全验证和处理
 */

import type { Request } from 'express';
import type { AuthenticatedRequest } from '@/middleware/jwtAuth';
import { LogSanitizer } from './logSanitizer';
import { promises as fs } from 'fs';
import { logger } from '@/utils/logger';
import { createErrorFromUnknown } from '@/types/errors';

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

  // 文件签名常量 (File signature constants)
  private static readonly PE_MAGIC_NUMBER_1 = 0x4D; // 'M' in PE header
  private static readonly PE_MAGIC_NUMBER_2 = 0x5A; // 'Z' in PE header
  private static readonly ELF_HEADER_SIZE = 4;
  private static readonly ELF_MAGIC_0 = 0x7F; // ELF magic byte 0
  private static readonly ELF_MAGIC_1 = 0x45; // 'E' in ELF header
  private static readonly ELF_MAGIC_2 = 0x4C; // 'L' in ELF header
  private static readonly ELF_MAGIC_3 = 0x46; // 'F' in ELF header

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

    // 用户认证检查标记
    const _authRequired = requireAuth;

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
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '_');

    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, '_');

    // 移除开头和结尾的下划线和点
    sanitized = sanitized.replace(/^[_\\.,]+|[_\\.,]+$/g, '');

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
    return !!(req as AuthenticatedRequest).user?.id;
  }

  static logUpload(filename: string, userId: string, success: boolean): void {
    const sanitizedFilename = LogSanitizer.sanitize(filename);
    const status = success ? 'SUCCESS' : 'FAILED';
    logger.debug(`File upload ${status}: ${sanitizedFilename} by user ${userId}`);
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
      if (buffer.length > 2 && buffer[0] === this.PE_MAGIC_NUMBER_1 && buffer[1] === this.PE_MAGIC_NUMBER_2) {
        return { safe: false, threat: 'PE executable detected' };
      }

      // 检查ELF文件头 (Linux可执行文件)
      if (buffer.length > this.ELF_HEADER_SIZE &&
          buffer[0] === this.ELF_MAGIC_0 &&
          buffer[1] === this.ELF_MAGIC_1 &&
          buffer[2] === this.ELF_MAGIC_2 &&
          buffer[3] === this.ELF_MAGIC_3) {
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
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'SecureUpload',
        operation: 'scanForMalware',
      });
      logger.error('Malware scan failed:', error.toLogObject());
      return { safe: false, threat: 'Scan failed' };
    }
  }
}
