/**
 * API服务统一错误处理类型系统
 *
 * 提供完整的错误类型定义、错误处理机制和类型安全保障
 */

import type { JsonValue, EnhancedError } from '@llmchat/shared-types';

// ============================================================================
// API错误类型定义
// ============================================================================

/**
 * 标准化API错误接口
 */
export interface ApiError {
  code: string;
  message: string;
  details?: JsonValue;
  timestamp: string;
  requestId?: string;
  stack?: string; // 开发环境使用
}

/**
 * 网络错误类型
 */
export interface NetworkError extends ApiError {
  code: 'NETWORK_ERROR';
  status?: number;
  statusText?: string;
  url?: string;
  timeout?: boolean;
}

/**
 * 认证错误类型
 */
export interface AuthenticationError extends ApiError {
  code: 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'UNAUTHORIZED';
  requiresReauth?: boolean;
}

/**
 * 权限错误类型
 */
export interface AuthorizationError extends ApiError {
  code: 'FORBIDDEN' | 'INSUFFICIENT_PERMISSIONS';
  requiredRole?: string;
  currentRole?: string;
}

/**
 * 验证错误类型
 */
export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  field?: string;
  value?: unknown;
  constraints?: Record<string, string>;
}

/**
 * 服务器错误类型
 */
export interface ServerError extends ApiError {
  code: 'SERVER_ERROR' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE';
  statusCode: 500 | 502 | 503 | 504;
  retryable?: boolean;
}

/**
 * 限流错误类型
 */
export interface RateLimitError extends ApiError {
  code: 'RATE_LIMIT_EXCEEDED';
  retryAfter?: number; // 秒数
  limit?: number;
  remaining?: number;
  resetTime?: string;
}

/**
 * 业务逻辑错误类型
 */
export interface BusinessError extends ApiError {
  code: 'BUSINESS_ERROR';
  domain: string; // 错误域，如 'agent', 'chat', 'user'
  action?: string;
  context?: JsonValue;
}

/**
 * 超时错误类型
 */
export interface TimeoutError extends ApiError {
  code: 'TIMEOUT_ERROR';
  timeout: number; // 超时时间（毫秒）
  operation?: string;
}

/**
 * 文件上传错误类型
 */
export interface UploadError extends ApiError {
  code: 'UPLOAD_ERROR';
  fileType?: string;
  fileSize?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
}

// ============================================================================
// 联合类型
// ============================================================================

/**
 * 所有API错误类型的联合
 */
export type ApiErrorType =
  | NetworkError
  | AuthenticationError
  | AuthorizationError
  | ValidationError
  | ServerError
  | RateLimitError
  | BusinessError
  | TimeoutError
  | UploadError;

/**
 * API操作结果类型
 */
export interface ApiResult<T = JsonValue> {
  success: boolean;
  data?: T;
  error?: ApiErrorType;
  metadata?: {
    requestId?: string;
    duration?: number;
    timestamp?: string;
    cached?: boolean;
  };
}

// ============================================================================
// 错误工厂函数
// ============================================================================

/**
 * 创建标准API错误
 */
export class ApiErrorFactory {
  /**
   * 创建网络错误
   */
  static networkError(
    message: string,
    options?: {
      status?: number;
      statusText?: string;
      url?: string;
      timeout?: boolean;
      requestId?: string;
    }
  ): NetworkError {
    return {
      code: 'NETWORK_ERROR',
      message,
      status: options?.status,
      statusText: options?.statusText,
      url: options?.url,
      timeout: options?.timeout ?? false,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建认证错误
   */
  static authenticationError(
    message: string,
    code: AuthenticationError['code'] = 'AUTH_ERROR',
    options?: {
      requiresReauth?: boolean;
      requestId?: string;
    }
  ): AuthenticationError {
    return {
      code,
      message,
      requiresReauth: options?.requiresReauth ?? true,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建权限错误
   */
  static authorizationError(
    message: string,
    options?: {
      requiredRole?: string;
      currentRole?: string;
      requestId?: string;
    }
  ): AuthorizationError {
    return {
      code: 'FORBIDDEN',
      message,
      requiredRole: options?.requiredRole,
      currentRole: options?.currentRole,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建验证错误
   */
  static validationError(
    message: string,
    options?: {
      field?: string;
      value?: unknown;
      constraints?: Record<string, string>;
      requestId?: string;
    }
  ): ValidationError {
    return {
      code: 'VALIDATION_ERROR',
      message,
      field: options?.field,
      value: options?.value,
      constraints: options?.constraints,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建服务器错误
   */
  static serverError(
    message: string,
    statusCode: ServerError['statusCode'] = 500,
    options?: {
      retryable?: boolean;
      requestId?: string;
    }
  ): ServerError {
    return {
      code: statusCode >= 500 && statusCode < 600 ? 'SERVER_ERROR' : 'INTERNAL_ERROR',
      message,
      statusCode,
      retryable: options?.retryable ?? false,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建限流错误
   */
  static rateLimitError(
    message: string,
    options?: {
      retryAfter?: number;
      limit?: number;
      remaining?: number;
      resetTime?: string;
      requestId?: string;
    }
  ): RateLimitError {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfter: options?.retryAfter,
      limit: options?.limit,
      remaining: options?.remaining,
      resetTime: options?.resetTime,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建业务错误
   */
  static businessError(
    message: string,
    domain: string,
    options?: {
      action?: string;
      context?: JsonValue;
      requestId?: string;
    }
  ): BusinessError {
    return {
      code: 'BUSINESS_ERROR',
      message,
      domain,
      action: options?.action,
      context: options?.context,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建超时错误
   */
  static timeoutError(
    message: string,
    timeout: number,
    options?: {
      operation?: string;
      requestId?: string;
    }
  ): TimeoutError {
    return {
      code: 'TIMEOUT_ERROR',
      message,
      timeout,
      operation: options?.operation,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 创建上传错误
   */
  static uploadError(
    message: string,
    options?: {
      fileType?: string;
      fileSize?: number;
      maxFileSize?: number;
      allowedTypes?: string[];
      requestId?: string;
    }
  ): UploadError {
    return {
      code: 'UPLOAD_ERROR',
      message,
      fileType: options?.fileType,
      fileSize: options?.fileSize,
      maxFileSize: options?.maxFileSize,
      allowedTypes: options?.allowedTypes,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    };
  }

  /**
   * 从未知错误创建API错误
   */
  static fromUnknownError(
    error: unknown,
    options?: {
      requestId?: string;
      context?: string;
    }
  ): ApiErrorType {
    if (this.isApiError(error)) {
      return error;
    }

    if (error instanceof Error) {
      // 根据错误消息推断错误类型
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        return this.timeoutError(error.message, 30000, {
          operation: options?.context,
          requestId: options?.requestId,
        });
      }

      if (error.message.includes('network') || error.message.includes('fetch')) {
        return this.networkError(error.message, {
          requestId: options?.requestId,
        });
      }

      // 默认创建服务器错误
      return this.serverError(error.message, 500, {
        requestId: options?.requestId,
      });
    }

    // 未知错误类型
    return this.serverError(
      typeof error === 'string' ? error : 'Unknown error occurred',
      500,
      {
        requestId: options?.requestId,
      }
    );
  }

  /**
   * 检查是否为API错误
   */
  private static isApiError(error: unknown): error is ApiErrorType {
    const errorObj = error as Record<string, unknown>;
    return (
      typeof errorObj === 'object' &&
      errorObj !== null &&
      typeof errorObj.code === 'string' &&
      typeof errorObj.message === 'string' &&
      typeof errorObj.timestamp === 'string'
    );
  }
}

// ============================================================================
// 错误处理工具函数
// ============================================================================

/**
 * API错误处理工具类
 */
export class ApiErrorHandler {
  /**
   * 判断错误是否需要重试
   */
  static isRetryableError(error: ApiErrorType): boolean {
    switch (error.code) {
      case 'NETWORK_ERROR':
      case 'TIMEOUT_ERROR':
      case 'SERVER_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return error.retryable ?? true;
      case 'RATE_LIMIT_EXCEEDED':
        return error.retryAfter !== undefined && error.retryAfter <= 60; // 1分钟内可重试
      default:
        return false;
    }
  }

  /**
   * 判断错误是否需要重新认证
   */
  static requiresReauthentication(error: ApiErrorType): boolean {
    return (
      error.code === 'TOKEN_EXPIRED' ||
      error.code === 'INVALID_TOKEN' ||
      (error.code === 'AUTH_ERROR' && (error as AuthenticationError).requiresReauth)
    );
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserFriendlyMessage(error: ApiErrorType): string {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return '网络连接失败，请检查网络设置';
      case 'AUTH_ERROR':
      case 'INVALID_TOKEN':
        return '登录状态已过期，请重新登录';
      case 'TOKEN_EXPIRED':
        return '登录已过期，请重新登录';
      case 'FORBIDDEN':
        return '权限不足，无法执行此操作';
      case 'VALIDATION_ERROR':
        return error.field ? `字段 "${error.field}" 验证失败：${error.message}` : error.message;
      case 'RATE_LIMIT_EXCEEDED':
        return error.retryAfter
          ? `请求过于频繁，请等待 ${error.retryAfter} 秒后重试`
          : '请求过于频繁，请稍后重试';
      case 'TIMEOUT_ERROR':
        return '请求超时，请稍后重试';
      case 'UPLOAD_ERROR':
        if (error.fileSize && error.maxFileSize) {
          return `文件大小超出限制，最大允许 ${Math.round(error.maxFileSize / 1024 / 1024)}MB`;
        }
        if (error.fileType && error.allowedTypes) {
          return `不支持的文件类型，支持的格式：${error.allowedTypes.join(', ')}`;
        }
        return error.message;
      case 'SERVER_ERROR':
        return '服务器暂时不可用，请稍后重试';
      case 'BUSINESS_ERROR':
        return error.message;
      default:
        return '操作失败，请稍后重试';
    }
  }

  /**
   * 记录错误日志
   */
  static logError(error: ApiErrorType, context?: {
    url?: string;
    method?: string;
    userId?: string;
    agentId?: string;
    additional?: JsonValue;
  }): void {
    const logData = {
      type: 'API_ERROR',
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
        requestId: error.requestId,
      },
      context,
      // 只在开发环境包含堆栈信息
      stack: import.meta.env?.DEV ? error.stack : undefined,
    };

    // 根据错误级别选择日志方式
    if (error.code === 'SERVER_ERROR' || error.code === 'INTERNAL_ERROR') {
      console.error('[API Error]', logData);
    } else {
      console.warn('[API Error]', logData);
    }
  }
}

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * API错误类型守卫
 */
export const ApiErrorGuards = {
  /**
   * 检查是否为网络错误
   */
  isNetworkError(error: ApiErrorType): error is NetworkError {
    return error.code === 'NETWORK_ERROR';
  },

  /**
   * 检查是否为认证错误
   */
  isAuthenticationError(error: ApiErrorType): error is AuthenticationError {
    return ['AUTH_ERROR', 'TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED'].includes(error.code);
  },

  /**
   * 检查是否为权限错误
   */
  isAuthorizationError(error: ApiErrorType): error is AuthorizationError {
    return ['FORBIDDEN', 'INSUFFICIENT_PERMISSIONS'].includes(error.code);
  },

  /**
   * 检查是否为验证错误
   */
  isValidationError(error: ApiErrorType): error is ValidationError {
    return error.code === 'VALIDATION_ERROR';
  },

  /**
   * 检查是否为服务器错误
   */
  isServerError(error: ApiErrorType): error is ServerError {
    return ['SERVER_ERROR', 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE'].includes(error.code);
  },

  /**
   * 检查是否为限流错误
   */
  isRateLimitError(error: ApiErrorType): error is RateLimitError {
    return error.code === 'RATE_LIMIT_EXCEEDED';
  },

  /**
   * 检查是否为业务错误
   */
  isBusinessError(error: ApiErrorType): error is BusinessError {
    return error.code === 'BUSINESS_ERROR';
  },

  /**
   * 检查是否为超时错误
   */
  isTimeoutError(error: ApiErrorType): error is TimeoutError {
    return error.code === 'TIMEOUT_ERROR';
  },

  /**
   * 检查是否为上传错误
   */
  isUploadError(error: ApiErrorType): error is UploadError {
    return error.code === 'UPLOAD_ERROR';
  },
};