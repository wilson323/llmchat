/**
 * 类型安全的错误处理工具
 * 替代catch (error: any)的模式
 */

import { BaseError, createErrorFromUnknown } from '@/types/errors';
import type { ApiError } from '@/types';

/**
 * 类型守卫：检查是否为Error对象
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * 类型守卫：检查是否为BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
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
 * 将unknown错误转换为BaseError
 */
export function toEnhancedError(
  error: unknown,
  context: {
    operation?: string;
    requestId?: string;
    userId?: string;
  } = {}
): BaseError {
  return createErrorFromUnknown(error, context);
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
): { error: BaseError; fallback: T } {
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
  static getStatusCode(error: BaseError): number {
    switch (error.category) {
      case 'authentication':
        return 401;
      case 'authorization':
        return 403;
      case 'validation':
        return 400;
      case 'network':
        return 503;
      case 'external_service':
        return 502;
      case 'resource':
        return 404;
      case 'business_logic':
        return 422;
      case 'system':
        return 500;
      default:
        return 500;
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserMessage(error: BaseError): string {
    return error.getUserMessage();
  }

  /**
   * 标准化错误响应
   */
  static createErrorResponse(
    error: BaseError,
    requestId?: string
  ): ApiError {
    const response = error.toApiError();

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }
}