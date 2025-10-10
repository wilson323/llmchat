import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/types';
import logger from '@/utils/logger';
import { createErrorFromUnknown, BaseError } from '@/types/errors';
import { JsonValue, SafeAccess } from '@/types/dynamic';

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
 */
function getErrorStatusCode(error: BaseError): number {
  const code = error.code;
  const message = error.message.toLowerCase();

  // 客户端错误 (4xx)
  if (code === 'VALIDATION_ERROR' || code === 'INVALID_PARAMS') {
    return 400;
  }
  if (code === 'UNAUTHORIZED' || code === 'AUTHENTICATION_FAILED') {
    return 401;
  }
  if (code === 'FORBIDDEN' || code === 'PERMISSION_DENIED') {
    return 403;
  }
  if (code === 'NOT_FOUND' || code === 'RESOURCE_NOT_FOUND') {
    return 404;
  }
  if (code === 'METHOD_NOT_ALLOWED') {
    return 405;
  }
  if (code === 'CONFLICT') {
    return 409;
  }
  if (code === 'VALIDATION_FAILED') {
    return 422;
  }
  if (code === 'RATE_LIMIT_EXCEEDED') {
    return 429;
  }

  // 服务器错误 (5xx)
  if (code === 'INTERNAL_SERVER_ERROR') {
    return 500;
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    return 503;
  }
  if (code === 'CIRCUIT_BREAKER_OPEN') {
    return 503;
  }
  if (code === 'TIMEOUT_ERROR' || code === 'REQUEST_TIMEOUT') {
    return 408;
  }

  // 基于消息内容的判断
  if (message.includes('timeout')) {
    return 408;
  }
  if (message.includes('not found')) {
    return 404;
  }
  if (message.includes('unauthorized')) {
    return 401;
  }
  if (message.includes('forbidden')) {
    return 403;
  }
  if (message.includes('validation')) {
    return 400;
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
  includeDetails: boolean = false,
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
  statusCode: number = 200,
): void => {
  try {
    res.status(statusCode).json(data);
  } catch (error) {
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