/**
 * 日志脱敏工具
 * 用于在日志中屏蔽敏感信息
 * 
 * 统一使用logger.ts进行日志输出
 */

import logger from './logger';

export const safeLogger = {
  info: (message: string, meta?: unknown) => {
    logger.info(LogSanitizer.sanitize(message), meta ? LogSanitizer.sanitizeObject(meta) : undefined);
  },
  error: (message: string, error?: unknown) => {
    logger.error(LogSanitizer.sanitize(message), error ? LogSanitizer.sanitizeObject(error) : undefined);
  },
  warn: (message: string, meta?: unknown) => {
    logger.warn(LogSanitizer.sanitize(message), meta ? LogSanitizer.sanitizeObject(meta) : undefined);
  },
  debug: (message: string, meta?: unknown) => {
    logger.debug(LogSanitizer.sanitize(message), meta ? LogSanitizer.sanitizeObject(meta) : undefined);
  },
};

export class LogSanitizer {
  private static sensitivePatterns = [
    { pattern: /password/i, replacement: '****' },
    { pattern: /token/i, replacement: '***' },
    { pattern: /secret/i, replacement: '***' },
    { pattern: /key/i, replacement: '***' },
    { pattern: /auth/i, replacement: '***' },
    { pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, replacement: 'Bearer ***' },
    { pattern: /sk-[A-Za-z0-9-]+/g, replacement: 'sk-***' },
    { pattern: /mongodb:\/\/[^:]+:[^@]+@/g, replacement: 'mongodb://***:***@' },
    { pattern: /postgresql:\/\/[^:]+:[^@]+@/g, replacement: 'postgresql://***:***@' },
    { pattern: /mysql:\/\/[^:]+:[^@]+@/g, replacement: 'mysql://***:***@' },
  ];

  static sanitize(input: string): string {
    let sanitized = input;

    for (const { pattern, replacement } of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  static sanitizeObject(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitize(String(obj));
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static maskConnectionString(connectionString: string): string {
    return this.sanitize(connectionString);
  }
}