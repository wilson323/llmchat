/**
 * 类型安全的错误处理工具
 * 替代catch (error: any)的模式
 */

import type { EnhancedError } from '@llmchat/shared-types';

/**
 * 类型守卫：检查是否为Error对象
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * 类型守卫：检查是否为EnhancedError
 */
export function isEnhancedError(error: unknown): error is EnhancedError {
  return typeof error === 'object' &&
         error !== null &&
         'name' in error &&
         'message' in error &&
         typeof (error as any).name === 'string' &&
         typeof (error as any).message === 'string';
}

/**
 * 安全的字符串转换
 */
export function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[Unstringifiable]';
  }
}

/**
 * 将unknown错误转换为EnhancedError
 */
export function toEnhancedError(
  error: unknown,
  context: {
    operation?: string;
    requestId?: string;
    userId?: string;
  } = {}
): EnhancedError {
  if (isEnhancedError(error)) {
    return error;
  }

  if (isError(error)) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      category: 'internal',
      severity: 'medium',
      timestamp: new Date().toISOString(),
      ...context
    } as EnhancedError;
  }

  if (typeof error === 'string') {
    return {
      name: 'StringError',
      message: error,
      category: 'internal',
      severity: 'medium',
      timestamp: new Date().toISOString(),
      ...context
    } as EnhancedError;
  }

  return {
    name: 'UnknownError',
    message: 'An unknown error occurred',
    details: error as any, // 这里使用any是因为无法确定结构
    category: 'internal',
    severity: 'medium',
    timestamp: new Date().toISOString(),
    ...context
  } as EnhancedError;
}

/**
 * 类型安全的错误处理函数
 */
export function safeErrorHandler<T>(
  error: unknown,
  fallbackValue: T,
  context?: {
    operation?: string;
    requestId?: string;
    userId?: string;
  }
): { error: EnhancedError; fallback: T } {
  const enhancedError = toEnhancedError(error, context);
  return {
    error: enhancedError,
    fallback: fallbackValue
  };
}

/**
 * Express错误处理助手
 */
export class ExpressErrorHandler {
  /**
   * 获取错误状态码
   */
  static getStatusCode(error: EnhancedError): number {
    switch (error.category) {
      case 'authentication':
        return 401;
      case 'authorization':
        return 403;
      case 'validation':
        return 400;
      case 'network':
      case 'external':
        return 502;
      default:
        return 500;
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserMessage(error: EnhancedError): string {
    switch (error.category) {
      case 'authentication':
        return '身份验证失败';
      case 'authorization':
        return '权限不足';
      case 'validation':
        return '输入数据不正确';
      case 'network':
        return '网络连接异常';
      case 'external':
        return '外部服务异常';
      default:
        return error.message || '服务器内部错误';
    }
  }

  /**
   * 标准化错误响应
   */
  static createErrorResponse(
    error: EnhancedError,
    requestId?: string
  ): {
    code: string | number;
    message: string;
    data: null;
    timestamp: string;
    requestId?: string;
  } {
    return {
      code: error.code || this.getStatusCode(error),
      message: this.getUserMessage(error),
      data: null,
      timestamp: error.timestamp || new Date().toISOString(),
      ...(requestId && { requestId })
    };
  }
}