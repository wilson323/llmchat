/**
 * 日志脱敏工具
 * 用于在日志中屏蔽敏感信息
 */

import { StructuredLogger } from './StructuredLogger';

export const safeLogger = {
  info: (message: string, meta?: any) => {
    console.log(LogSanitizer.sanitize(message), meta ? LogSanitizer.sanitizeObject(meta) : '');
  },
  error: (message: string, error?: any) => {
    console.error(LogSanitizer.sanitize(message), error ? LogSanitizer.sanitizeObject(error) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(LogSanitizer.sanitize(message), meta ? LogSanitizer.sanitizeObject(meta) : '');
  },
  debug: (message: string, meta?: any) => {
    console.log(`[DEBUG] ${LogSanitizer.sanitize(message)}`, meta ? LogSanitizer.sanitizeObject(meta) : '');
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
    { pattern: /sk-[A-Za-z0-9]+/g, replacement: 'sk-***' },
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

  static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitize(String(obj));
    }

    const sanitized: any = {};

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