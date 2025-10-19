/**
 * API错误类型定义
 */

import type { JsonValue } from '../index';

// ============================================================================
// 错误基础类型
// ============================================================================

/**
 * 错误严重级别
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误类别
 */
export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server_error'
  | 'external_service'
  | 'network'
  | 'timeout'
  | 'unknown';

/**
 * 基础错误接口
 */
export interface BaseError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误类别 */
  category: ErrorCategory;
  /** 错误严重级别 */
  severity: ErrorSeverity;
  /** 错误时间戳 */
  timestamp: string;
  /** 请求ID */
  requestId?: string;
  /** 用户ID */
  userId?: string;
  /** 错误详情 */
  details?: JsonValue;
  /** 错误堆栈 */
  stack?: string;
}

// ============================================================================
// 具体错误类型
// ============================================================================

/**
 * 验证错误
 */
export interface ValidationError extends BaseError {
  category: 'validation';
  /** 验证字段错误 */
  fieldErrors: Array<{
    field: string;
    message: string;
    code: string;
    value?: JsonValue;
  }>;
}

/**
 * 认证错误
 */
export interface AuthenticationError extends BaseError {
  category: 'authentication';
  /** 认证错误类型 */
  authType: 'invalid_credentials' | 'token_expired' | 'token_invalid' | 'account_locked' | 'account_disabled';
  /** 重试延迟（秒） */
  retryAfter?: number;
  /** 剩余尝试次数 */
  remainingAttempts?: number;
}

/**
 * 授权错误
 */
export interface AuthorizationError extends BaseError {
  category: 'authorization';
  /** 所需权限 */
  requiredPermissions: string[];
  /** 用户当前权限 */
  userPermissions: string[];
}

/**
 * 资源未找到错误
 */
export interface NotFoundError extends BaseError {
  category: 'not_found';
  /** 资源类型 */
  resourceType: string;
  /** 资源ID */
  resourceId: string;
}

/**
 * 冲突错误
 */
export interface ConflictError extends BaseError {
  category: 'conflict';
  /** 冲突类型 */
  conflictType: 'duplicate' | 'version_conflict' | 'state_conflict';
  /** 冲突资源 */
  conflictingResource?: JsonValue;
}

/**
 * 速率限制错误
 */
export interface RateLimitError extends BaseError {
  category: 'rate_limit';
  /** 限制类型 */
  limitType: 'requests' | 'tokens' | 'connections';
  /** 限制数量 */
  limit: number;
  /** 当前数量 */
  current: number;
  /** 重置时间 */
  resetAt: string;
  /** 重置时间戳 */
  resetTimestamp: number;
}

/**
 * 外部服务错误
 */
export interface ExternalServiceError extends BaseError {
  category: 'external_service';
  /** 服务名称 */
  serviceName: string;
  /** 服务状态码 */
  serviceStatusCode?: number;
  /** 服务响应 */
  serviceResponse?: JsonValue;
  /** 是否可重试 */
  retryable: boolean;
}

/**
 * 网络错误
 */
export interface NetworkError extends BaseError {
  category: 'network';
  /** 网络错误类型 */
  networkType: 'connection_failed' | 'timeout' | 'dns_error' | 'ssl_error';
  /** 目标URL */
  url?: string;
  /** HTTP状态码 */
  httpStatus?: number;
  /** 是否可重试 */
  retryable: boolean;
}

/**
 * 服务器错误
 */
export interface ServerError extends BaseError {
  category: 'server_error';
  /** 服务器错误类型 */
  serverType: 'internal_error' | 'database_error' | 'memory_error' | 'disk_error';
  /** 服务器信息 */
  serverInfo?: {
    hostname: string;
    version: string;
    uptime: number;
  };
}

// ============================================================================
// 统一错误类型
// ============================================================================

/**
 * API错误类型联合
 */
export type ApiError =
  | ValidationError
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | ConflictError
  | RateLimitError
  | ExternalServiceError
  | NetworkError
  | ServerError;

/**
 * 增强错误接口（向后兼容）
 */
export interface EnhancedError extends BaseError {
  /** 错误ID */
  id?: string;
  /** 错误上下文 */
  context?: {
    userAgent?: string;
    ip?: string;
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: JsonValue;
  };
  /** 错误关联 */
  correlations?: {
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
  };
  /** 错误修复建议 */
  suggestions?: Array<{
    type: 'fix' | 'workaround' | 'documentation';
    title: string;
    description: string;
    url?: string;
  }>;
}

// ============================================================================
// 错误创建工具
// ============================================================================

/**
 * 错误工厂类
 */
export class ErrorFactory {
  /**
   * 创建验证错误
   */
  static createValidationError(
    message: string,
    fieldErrors: ValidationError['fieldErrors'],
    options?: Partial<BaseError>
  ): ValidationError {
    return {
      code: 'VALIDATION_ERROR',
      message,
      category: 'validation',
      severity: 'medium',
      timestamp: new Date().toISOString(),
      fieldErrors,
      ...options
    } as ValidationError;
  }

  /**
   * 创建认证错误
   */
  static createAuthenticationError(
    message: string,
    authType: AuthenticationError['authType'],
    options?: Partial<Omit<AuthenticationError, 'category' | 'authType'>>
  ): AuthenticationError {
    return {
      code: 'AUTHENTICATION_ERROR',
      message,
      category: 'authentication',
      severity: 'high',
      timestamp: new Date().toISOString(),
      authType,
      ...options
    } as AuthenticationError;
  }

  /**
   * 创建授权错误
   */
  static createAuthorizationError(
    message: string,
    requiredPermissions: string[],
    userPermissions: string[],
    options?: Partial<BaseError>
  ): AuthorizationError {
    return {
      code: 'AUTHORIZATION_ERROR',
      message,
      category: 'authorization',
      severity: 'high',
      timestamp: new Date().toISOString(),
      requiredPermissions,
      userPermissions,
      ...options
    } as AuthorizationError;
  }

  /**
   * 创建未找到错误
   */
  static createNotFoundError(
    message: string,
    resourceType: string,
    resourceId: string,
    options?: Partial<BaseError>
  ): NotFoundError {
    return {
      code: 'NOT_FOUND_ERROR',
      message,
      category: 'not_found',
      severity: 'medium',
      timestamp: new Date().toISOString(),
      resourceType,
      resourceId,
      ...options
    } as NotFoundError;
  }

  /**
   * 创建速率限制错误
   */
  static createRateLimitError(
    message: string,
    limitType: RateLimitError['limitType'],
    limit: number,
    current: number,
    resetAt: string,
    options?: Partial<BaseError>
  ): RateLimitError {
    return {
      code: 'RATE_LIMIT_ERROR',
      message,
      category: 'rate_limit',
      severity: 'medium',
      timestamp: new Date().toISOString(),
      limitType,
      limit,
      current,
      resetAt,
      resetTimestamp: new Date(resetAt).getTime(),
      ...options
    } as RateLimitError;
  }

  /**
   * 创建外部服务错误
   */
  static createExternalServiceError(
    message: string,
    serviceName: string,
    options?: Partial<Omit<ExternalServiceError, 'category' | 'serviceName'>>
  ): ExternalServiceError {
    return {
      code: 'EXTERNAL_SERVICE_ERROR',
      message,
      category: 'external_service',
      severity: 'high',
      timestamp: new Date().toISOString(),
      serviceName,
      retryable: false,
      ...options
    } as ExternalServiceError;
  }

  /**
   * 创建服务器错误
   */
  static createServerError(
    message: string,
    serverType: ServerError['serverType'],
    options?: Partial<Omit<ServerError, 'category' | 'serverType'>>
  ): ServerError {
    return {
      code: 'SERVER_ERROR',
      message,
      category: 'server_error',
      severity: 'critical',
      timestamp: new Date().toISOString(),
      serverType,
      ...options
    } as ServerError;
  }
}

// ============================================================================
// 错误处理工具
// ============================================================================

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 判断错误是否可重试
   */
  static isRetryable(error: ApiError): boolean {
    switch (error.category) {
      case 'network':
        return (error as NetworkError).retryable;
      case 'external_service':
        return (error as ExternalServiceError).retryable;
      case 'rate_limit':
        return true;
      case 'server_error':
        return (error as ServerError).serverType === 'internal_error';
      default:
        return false;
    }
  }

  /**
   * 获取重试延迟时间（毫秒）
   */
  static getRetryDelay(error: ApiError, attempt: number = 1): number {
    switch (error.category) {
      case 'rate_limit':
        const rateLimitError = error as RateLimitError;
        return Math.max(1000, rateLimitError.resetTimestamp - Date.now());
      case 'network':
      case 'external_service':
        // 指数退避：基础延迟 * 2^attempt
        return Math.min(30000, 1000 * Math.pow(2, attempt - 1));
      case 'server_error':
        return Math.min(10000, 2000 * Math.pow(2, attempt - 1));
      default:
        return 0;
    }
  }

  /**
   * 格式化错误消息
   */
  static formatErrorMessage(error: ApiError): string {
    let message = error.message;

    // 添加上下文信息
    if (error.category === 'validation' && 'fieldErrors' in error) {
      const validationError = error as ValidationError;
      const fieldMessages = validationError.fieldErrors.map(
        field => `${field.field}: ${field.message}`
      ).join(', ');
      message += ` (${fieldMessages})`;
    }

    if (error.category === 'rate_limit' && 'resetAt' in error) {
      const rateLimitError = error as RateLimitError;
      const resetTime = new Date(rateLimitError.resetAt).toLocaleString();
      message += ` (限制将于 ${resetTime} 重置)`;
    }

    return message;
  }

  /**
   * 创建用户友好的错误消息
   */
  static createUserFriendlyMessage(error: ApiError): string {
    switch (error.category) {
      case 'validation':
        return '输入信息有误，请检查后重试';
      case 'authentication':
        return '登录信息已过期，请重新登录';
      case 'authorization':
        return '您没有权限执行此操作';
      case 'not_found':
        return '请求的资源不存在';
      case 'rate_limit':
        return '请求过于频繁，请稍后再试';
      case 'external_service':
        return '外部服务暂时不可用，请稍后重试';
      case 'network':
        return '网络连接异常，请检查网络后重试';
      case 'server_error':
        return '服务器内部错误，请稍后重试';
      default:
        return '操作失败，请重试';
    }
  }
}
