import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@/types';
import logger from '@/utils/logger';
import type { BaseError } from '@/types/errors';
import { createErrorFromUnknown } from '@/types/errors';
import type { JsonValue} from '@/types/dynamic';
import { SafeAccess } from '@/types/dynamic';

/**
 * 统一的类型安全错误处理中间件
 *
 * 特性：
 * - 使用类型安全的错误处理基础设施
 * - 统一的错误响应格式
 * - 开发环境详细信息
 * - 结构化日志记录
 * - 错误分类和状态码映射
 */
export const errorHandler = (
  unknownError: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 使用类型安全基础设施创建结构化错误
  const typedError = createErrorFromUnknown(unknownError, {
    component: 'ErrorHandler',
    operation: 'globalErrorHandling',
    url: req.originalUrl,
    method: req.method,
    context: {
      headers: req.headers,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    },
  });

  // 结构化日志记录（包含requestId）
  logger.error('统一错误处理', {
    errorId: typedError.id,
    code: typedError.code,
    message: typedError.message,
    component: SafeAccess.getString(typedError.context, 'component'),
    operation: SafeAccess.getString(typedError.context, 'operation'),
    url: req.originalUrl,
    method: req.method,
    timestamp: typedError.timestamp,
    stack: typedError.stack,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: (req as any).requestId, // 添加requestId用于追踪
    userId: (req as any).user?.id, // 添加userId（如果已认证）
  });

  // 如果响应已经发送，传递给默认错误处理器
  if (res.headersSent) {
    return next(typedError);
  }

  // 生成统一的API错误响应
  const errorResponse = typedError.toApiError();

  // 根据错误类型确定HTTP状态码
  const statusCode = getErrorStatusCode(typedError);

  // 开发环境下添加额外调试信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      originalError: typedError.message,
      ...(typedError.stack && { stack: typedError.stack }),
      ...(typedError.context && { context: typedError.context }),
      errorId: typedError.id,
      component: SafeAccess.getString(typedError.context, 'component'),
      operation: SafeAccess.getString(typedError.context, 'operation'),
    } as JsonValue;
  }

  // 生产环境下添加错误ID用于追踪
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('X-Error-ID', typedError.id);
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 根据错误类型确定HTTP状态码
 * 
 * 完整的HTTP状态码映射：
 * - 4xx: 客户端错误
 * - 5xx: 服务器错误
 */
function getErrorStatusCode(error: BaseError): number {
  const {code} = error;
  const message = error.message.toLowerCase();

  // ==================== 客户端错误 (4xx) ====================
  
  // 400 Bad Request - 请求参数错误
  if (code === 'VALIDATION_ERROR' || code === 'INVALID_PARAMS' || code === 'BAD_REQUEST') {
    return 400;
  }
  
  // 401 Unauthorized - 未认证
  if (code === 'UNAUTHORIZED' || code === 'AUTHENTICATION_FAILED' || 
      code === 'AUTHENTICATION_ERROR' || code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED') {
    return 401;
  }
  
  // 403 Forbidden - 权限不足
  if (code === 'FORBIDDEN' || code === 'PERMISSION_DENIED' || 
      code === 'ACCESS_DENIED' || code === 'INSUFFICIENT_PERMISSIONS') {
    return 403;
  }
  
  // 404 Not Found - 资源不存在
  if (code === 'NOT_FOUND' || code === 'RESOURCE_NOT_FOUND' || 
      code === 'AGENT_NOT_FOUND' || code === 'SESSION_NOT_FOUND') {
    return 404;
  }
  
  // 405 Method Not Allowed - HTTP方法不允许
  if (code === 'METHOD_NOT_ALLOWED') {
    return 405;
  }
  
  // 406 Not Acceptable - 无法提供可接受的内容
  if (code === 'NOT_ACCEPTABLE') {
    return 406;
  }
  
  // 408 Request Timeout - 请求超时
  if (code === 'TIMEOUT_ERROR' || code === 'REQUEST_TIMEOUT') {
    return 408;
  }
  
  // 409 Conflict - 资源冲突
  if (code === 'CONFLICT' || code === 'RESOURCE_CONFLICT' || code === 'DUPLICATE_RESOURCE') {
    return 409;
  }
  
  // 410 Gone - 资源已永久删除
  if (code === 'RESOURCE_GONE') {
    return 410;
  }
  
  // 413 Payload Too Large - 请求体过大
  if (code === 'PAYLOAD_TOO_LARGE' || code === 'FILE_TOO_LARGE') {
    return 413;
  }
  
  // 415 Unsupported Media Type - 不支持的媒体类型
  if (code === 'UNSUPPORTED_MEDIA_TYPE') {
    return 415;
  }
  
  // 422 Unprocessable Entity - 语义错误
  if (code === 'VALIDATION_FAILED' || code === 'SEMANTIC_ERROR') {
    return 422;
  }
  
  // 429 Too Many Requests - 速率限制
  if (code === 'RATE_LIMIT_EXCEEDED' || code === 'TOO_MANY_REQUESTS') {
    return 429;
  }

  // ==================== 服务器错误 (5xx) ====================
  
  // 500 Internal Server Error - 内部错误
  if (code === 'INTERNAL_SERVER_ERROR' || code === 'INTERNAL_ERROR') {
    return 500;
  }
  
  // 501 Not Implemented - 功能未实现
  if (code === 'NOT_IMPLEMENTED') {
    return 501;
  }
  
  // 502 Bad Gateway - 上游服务错误
  if (code === 'BAD_GATEWAY' || code === 'UPSTREAM_ERROR') {
    return 502;
  }
  
  // 503 Service Unavailable - 服务不可用
  if (code === 'SERVICE_UNAVAILABLE' || code === 'CIRCUIT_BREAKER_OPEN' || 
      code === 'SERVICE_DEGRADED') {
    return 503;
  }
  
  // 504 Gateway Timeout - 网关超时
  if (code === 'GATEWAY_TIMEOUT' || code === 'UPSTREAM_TIMEOUT') {
    return 504;
  }

  // ==================== 基于消息内容的智能判断 ====================
  
  if (message.includes('timeout')) {
    return 408;
  }
  if (message.includes('not found')) {
    return 404;
  }
  if (message.includes('unauthorized') || message.includes('unauthenticated')) {
    return 401;
  }
  if (message.includes('forbidden') || message.includes('permission denied')) {
    return 403;
  }
  if (message.includes('validation')) {
    return 400;
  }
  if (message.includes('conflict') || message.includes('duplicate')) {
    return 409;
  }
  if (message.includes('rate limit')) {
    return 429;
  }
  if (message.includes('unavailable') || message.includes('circuit')) {
    return 503;
  }

  // 默认服务器错误
  return 500;
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获和处理错误
 */
export const asyncErrorHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404错误处理中间件
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createErrorFromUnknown(
    new Error(`Route ${req.method} ${req.originalUrl} not found`),
    {
      component: 'ErrorHandler',
      operation: 'notFoundHandling',
      url: req.originalUrl,
      method: req.method,
    },
  );

  const errorResponse = error.toApiError();
  res.status(404).json(errorResponse);
};

/**
 * 错误响应生成工具
 */
export const createErrorResponse = (
  error: BaseError,
  includeDetails = false,
): ApiError => {
  const response = error.toApiError();

  if (includeDetails) {
    response.details = {
      errorId: error.id,
      ...(error.context && { context: error.context }),
      component: SafeAccess.getString(error.context, 'component'),
      operation: SafeAccess.getString(error.context, 'operation'),
    } as JsonValue;
  }

  return response;
};

/**
 * 安全的JSON响应工具
 */
export const safeJsonResponse = (
  res: Response,
  data: JsonValue,
  statusCode = 200,
): void => {
  try {
    res.status(statusCode).json(data);
  } catch (error: any) {
    const typedError = createErrorFromUnknown(error, {
      component: 'ErrorHandler',
      operation: 'safeJsonResponse',
      context: { statusCode, dataType: typeof data },
    });

    const errorResponse = typedError.toApiError();
    res.status(500).json(errorResponse);
  }
};

/**
 * 错误事件记录工具
 */
export const logErrorEvent = (
  error: BaseError,
  additionalContext?: Record<string, unknown>,
): void => {
  const logData = {
    errorId: error.id,
    code: error.code,
    message: error.message,
    component: SafeAccess.getString(error.context, 'component'),
    operation: SafeAccess.getString(error.context, 'operation'),
    timestamp: error.timestamp,
    severity: error.severity,
    ...additionalContext,
  };

  if (error.severity === 'critical' || error.severity === 'high') {
    logger.error('🚨 高优先级错误', logData);
  } else if (error.severity === 'medium') {
    logger.warn('⚠️ 中等优先级错误', logData);
  } else {
    logger.info('ℹ️ 低优先级错误', logData);
  }
};

/**
 * 错误分类工具
 * 判断错误是否为客户端错误（4xx）还是服务器错误（5xx）
 */
export const isClientError = (statusCode: number): boolean => {
  return statusCode >= 400 && statusCode < 500;
};

export const isServerError = (statusCode: number): boolean => {
  return statusCode >= 500 && statusCode < 600;
};

/**
 * 判断错误是否需要立即告警
 */
export const shouldAlert = (error: BaseError): boolean => {
  // Critical和High严重级别需要告警
  if (error.severity === 'critical' || error.severity === 'high') {
    return true;
  }

  // 5xx服务器错误需要告警
  const statusCode = getErrorStatusCode(error);
  if (isServerError(statusCode)) {
    return true;
  }

  // 特定错误码需要告警
  const alertCodes = [
    'DATABASE_ERROR',
    'REDIS_ERROR',
    'CIRCUIT_BREAKER_OPEN',
    'SERVICE_UNAVAILABLE',
    'CRITICAL_SYSTEM_ERROR',
  ];

  return alertCodes.includes(error.code);
};

/**
 * 获取错误的可读描述
 */
export const getErrorDescription = (code: string): string => {
  const descriptions: Record<string, string> = {
    // 客户端错误
    'VALIDATION_ERROR': '请求参数验证失败',
    'UNAUTHORIZED': '未经授权的访问',
    'FORBIDDEN': '权限不足',
    'NOT_FOUND': '请求的资源不存在',
    'CONFLICT': '资源冲突',
    'RATE_LIMIT_EXCEEDED': '请求频率超过限制',
    
    // 服务器错误
    'INTERNAL_SERVER_ERROR': '服务器内部错误',
    'SERVICE_UNAVAILABLE': '服务暂时不可用',
    'TIMEOUT_ERROR': '请求处理超时',
    'DATABASE_ERROR': '数据库操作失败',
    'REDIS_ERROR': 'Redis操作失败',
    'CIRCUIT_BREAKER_OPEN': '熔断器开启',
  };

  return descriptions[code] || '未知错误';
};
