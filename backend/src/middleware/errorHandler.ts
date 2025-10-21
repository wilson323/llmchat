import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@/types';
import logger from '@/utils/logger';
import { type BaseError, createErrorFromUnknown } from '@/types/errors';
import { type JsonValue, SafeAccess } from '@/types/dynamic';

// HTTP 状态码常量
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// 错误码常量
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMS: 'INVALID_PARAMS',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  NOT_ACCEPTABLE: 'NOT_ACCEPTABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  CONFLICT: 'CONFLICT',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RESOURCE_GONE: 'RESOURCE_GONE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SEMANTIC_ERROR: 'SEMANTIC_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  BAD_GATEWAY: 'BAD_GATEWAY',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  SERVICE_DEGRADED: 'SERVICE_DEGRADED',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
} as const;

// 扩展 Request 类型以包含 requestId 和 user
interface ExtendedRequest extends Request {
  requestId?: string;
  user?: {
    id: string;
    username?: string;
    role?: string;
  };
}

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
    requestId: (req as ExtendedRequest).requestId, // 添加requestId用于追踪
    userId: (req as ExtendedRequest).user?.id, // 添加userId（如果已认证）
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
 * 客户端错误码到状态码的映射
 */
const clientErrorMappings: Array<{
  codes: readonly string[];
  statusCode: number;
}> = [
  {
    codes: [
      ERROR_CODES.VALIDATION_ERROR,
      ERROR_CODES.INVALID_PARAMS,
      ERROR_CODES.BAD_REQUEST,
    ],
    statusCode: HTTP_STATUS.BAD_REQUEST,
  },
  {
    codes: [
      ERROR_CODES.UNAUTHORIZED,
      ERROR_CODES.AUTHENTICATION_FAILED,
      ERROR_CODES.AUTHENTICATION_ERROR,
      ERROR_CODES.TOKEN_INVALID,
      ERROR_CODES.TOKEN_EXPIRED,
    ],
    statusCode: HTTP_STATUS.UNAUTHORIZED,
  },
  {
    codes: [
      ERROR_CODES.FORBIDDEN,
      ERROR_CODES.PERMISSION_DENIED,
      ERROR_CODES.ACCESS_DENIED,
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    ],
    statusCode: HTTP_STATUS.FORBIDDEN,
  },
  {
    codes: [
      ERROR_CODES.NOT_FOUND,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      ERROR_CODES.AGENT_NOT_FOUND,
      ERROR_CODES.SESSION_NOT_FOUND,
    ],
    statusCode: HTTP_STATUS.NOT_FOUND,
  },
  {
    codes: [ERROR_CODES.METHOD_NOT_ALLOWED],
    statusCode: HTTP_STATUS.METHOD_NOT_ALLOWED,
  },
  {
    codes: [ERROR_CODES.NOT_ACCEPTABLE],
    statusCode: HTTP_STATUS.NOT_ACCEPTABLE,
  },
  {
    codes: [ERROR_CODES.TIMEOUT_ERROR, ERROR_CODES.REQUEST_TIMEOUT],
    statusCode: HTTP_STATUS.REQUEST_TIMEOUT,
  },
  {
    codes: [
      ERROR_CODES.CONFLICT,
      ERROR_CODES.RESOURCE_CONFLICT,
      ERROR_CODES.DUPLICATE_RESOURCE,
    ],
    statusCode: HTTP_STATUS.CONFLICT,
  },
  {
    codes: [ERROR_CODES.RESOURCE_GONE],
    statusCode: HTTP_STATUS.GONE,
  },
  {
    codes: [ERROR_CODES.PAYLOAD_TOO_LARGE, ERROR_CODES.FILE_TOO_LARGE],
    statusCode: HTTP_STATUS.PAYLOAD_TOO_LARGE,
  },
  {
    codes: [ERROR_CODES.UNSUPPORTED_MEDIA_TYPE],
    statusCode: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
  },
  {
    codes: [ERROR_CODES.VALIDATION_FAILED, ERROR_CODES.SEMANTIC_ERROR],
    statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  },
  {
    codes: [ERROR_CODES.RATE_LIMIT_EXCEEDED, ERROR_CODES.TOO_MANY_REQUESTS],
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  },
];

/**
 * 服务器错误码到状态码的映射
 */
const serverErrorMappings: Array<{
  codes: readonly string[];
  statusCode: number;
}> = [
  {
    codes: [ERROR_CODES.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR],
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  },
  {
    codes: [ERROR_CODES.NOT_IMPLEMENTED],
    statusCode: HTTP_STATUS.NOT_IMPLEMENTED,
  },
  {
    codes: [ERROR_CODES.BAD_GATEWAY, ERROR_CODES.UPSTREAM_ERROR],
    statusCode: HTTP_STATUS.BAD_GATEWAY,
  },
  {
    codes: [
      ERROR_CODES.SERVICE_UNAVAILABLE,
      ERROR_CODES.CIRCUIT_BREAKER_OPEN,
      ERROR_CODES.SERVICE_DEGRADED,
    ],
    statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
  },
  {
    codes: [ERROR_CODES.GATEWAY_TIMEOUT, ERROR_CODES.UPSTREAM_TIMEOUT],
    statusCode: HTTP_STATUS.GATEWAY_TIMEOUT,
  },
];

/**
 * 消息关键词到状态码的映射
 */
const messageMappings: Array<{
  keywords: readonly string[];
  statusCode: number;
}> = [
  {
    keywords: ['timeout'],
    statusCode: HTTP_STATUS.REQUEST_TIMEOUT,
  },
  {
    keywords: ['not found'],
    statusCode: HTTP_STATUS.NOT_FOUND,
  },
  {
    keywords: ['unauthorized', 'unauthenticated'],
    statusCode: HTTP_STATUS.UNAUTHORIZED,
  },
  {
    keywords: ['forbidden', 'permission denied'],
    statusCode: HTTP_STATUS.FORBIDDEN,
  },
  {
    keywords: ['validation'],
    statusCode: HTTP_STATUS.BAD_REQUEST,
  },
  {
    keywords: ['conflict', 'duplicate'],
    statusCode: HTTP_STATUS.CONFLICT,
  },
  {
    keywords: ['rate limit'],
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  },
  {
    keywords: ['unavailable', 'circuit'],
    statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
  },
];

/**
 * 根据错误类型确定HTTP状态码
 *
 * 完整的HTTP状态码映射：
 * - 4xx: 客户端错误
 * - 5xx: 服务器错误
 */
function getErrorStatusCode(error: BaseError): number {
  const { code } = error;
  const message = error.message.toLowerCase();

  // 检查客户端错误映射
  const clientMapping = clientErrorMappings.find(mapping =>
    mapping.codes.includes(code),
  );
  if (clientMapping) {
    return clientMapping.statusCode;
  }

  // 检查服务器错误映射
  const serverMapping = serverErrorMappings.find(mapping =>
    mapping.codes.includes(code),
  );
  if (serverMapping) {
    return serverMapping.statusCode;
  }

  // 基于消息内容的智能判断
  const messageMapping = messageMappings.find(mapping =>
    mapping.keywords.some(keyword => message.includes(keyword)),
  );
  if (messageMapping) {
    return messageMapping.statusCode;
  }

  // 默认服务器错误
  return HTTP_STATUS.INTERNAL_SERVER_ERROR;
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
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
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
  res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse);
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
  statusCode: number = HTTP_STATUS.OK as number,
): void => {
  try {
    res.status(statusCode).json(data);
  } catch (unknownError: unknown) {
    const typedError = createErrorFromUnknown(unknownError, {
      component: 'ErrorHandler',
      operation: 'safeJsonResponse',
      context: { statusCode, dataType: typeof data },
    });

    const errorResponse = typedError.toApiError();
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
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
  return statusCode >= HTTP_STATUS.BAD_REQUEST && statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR;
};

export const isServerError = (statusCode: number): boolean => {
  const SERVER_ERROR_MAX = 600;
  return statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR && statusCode < SERVER_ERROR_MAX;
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
    ERROR_CODES.DATABASE_ERROR,
    ERROR_CODES.REDIS_ERROR,
    ERROR_CODES.CIRCUIT_BREAKER_OPEN,
    ERROR_CODES.SERVICE_UNAVAILABLE,
    ERROR_CODES.CRITICAL_SYSTEM_ERROR,
  ] as const;

  return alertCodes.includes(error.code as typeof alertCodes[number]);
};

/**
 * 获取错误的可读描述
 */
export const getErrorDescription = (code: string): string => {
  const descriptions: Record<string, string> = {
    // 客户端错误
    [ERROR_CODES.VALIDATION_ERROR]: '请求参数验证失败',
    [ERROR_CODES.UNAUTHORIZED]: '未经授权的访问',
    [ERROR_CODES.FORBIDDEN]: '权限不足',
    [ERROR_CODES.NOT_FOUND]: '请求的资源不存在',
    [ERROR_CODES.CONFLICT]: '资源冲突',
    [ERROR_CODES.RATE_LIMIT_EXCEEDED]: '请求频率超过限制',

    // 服务器错误
    [ERROR_CODES.INTERNAL_SERVER_ERROR]: '服务器内部错误',
    [ERROR_CODES.SERVICE_UNAVAILABLE]: '服务暂时不可用',
    [ERROR_CODES.TIMEOUT_ERROR]: '请求处理超时',
    [ERROR_CODES.DATABASE_ERROR]: '数据库操作失败',
    [ERROR_CODES.REDIS_ERROR]: 'Redis操作失败',
    [ERROR_CODES.CIRCUIT_BREAKER_OPEN]: '熔断器开启',
  };

  return descriptions[code] ?? '未知错误';
};