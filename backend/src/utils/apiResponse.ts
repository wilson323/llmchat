import { Response } from 'express';
import { ApiSuccessResponse, JsonObject, JsonValue, DynamicTypeGuard, DynamicDataConverter } from '@/types/dynamic';
import { createErrorFromUnknown } from '@/types/errors';
import { ApiError } from '@/types';

type PaginationMetadata = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

interface SuccessMetadata {
  pagination?: PaginationMetadata;
  extra?: unknown;
}

type SendSuccessOptions = Exclude<Parameters<typeof ApiResponseHandler.sendSuccess>[2], undefined>;

/**
 * 类型安全的API响应处理工具
 *
 * 特性：
 * - 类型安全的数据验证
 * - 统一的响应格式
 * - 自动序列化处理
 * - 请求ID追踪
 * - 性能监控
 * - 错误边界保护
 */
export class ApiResponseHandler {
  private static readonly API_VERSION = '1.0.0';

  /**
   * 发送成功响应
   */
  static sendSuccess<T = unknown>(
    res: Response,
    data: T,
    options: {
      message?: string;
      code?: string;
      statusCode?: number;
      requestId?: string;
      metadata?: SuccessMetadata;
      startTime?: number;
    } = {}
  ): void {
    const {
      message = 'success',
      code = 'OK',
      statusCode = 200,
      requestId,
      metadata,
      startTime
    } = options;

    // 验证响应数据类型
    const safeData = DynamicDataConverter.toSafeJsonValue(data);

    if (!DynamicTypeGuard.isJsonValue(safeData)) {
      const error = createErrorFromUnknown(
        new Error('Response data is not a valid JSON value'),
        {
          component: 'ApiResponseHandler',
          operation: 'sendSuccess',
          context: { dataType: typeof data },
        }
      );

      return this.sendError(res, error, requestId ? { requestId } : {});
    }

    const metadataPayload: ApiSuccessResponse<JsonValue>['metadata'] = {
      version: this.API_VERSION,
      ...(startTime ? { duration: Date.now() - startTime } : {}),
      ...(metadata?.pagination ? { pagination: metadata.pagination } : {}),
      ...(metadata?.extra
        ? this.getMetadataExtra(metadata.extra)
        : {}),
    };

    const responseData: ApiSuccessResponse<JsonValue> = {
      code,
      message,
      data: safeData as JsonValue,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      metadata: metadataPayload,
    };

    // 设置响应头
    if (requestId) {
      res.setHeader('X-Request-ID', requestId);
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).json(responseData);
  }

  /**
   * 发送分页响应
   */
  static sendPaginated<T = unknown>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    },
    options: {
      message?: string;
      requestId?: string;
      startTime?: number;
      metadata?: SuccessMetadata;
    } = {}
  ): void {
    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
    const hasNext = pagination.page < totalPages;
    const hasPrev = pagination.page > 1;

    const paginationData = {
      ...pagination,
      totalPages,
      hasNext,
      hasPrev,
    };

    this.sendSuccess(res, data, {
      ...(options.message ? { message: options.message } : {}),
      ...(options.requestId ? { requestId: options.requestId } : {}),
      ...(options.startTime ? { startTime: options.startTime } : {}),
      metadata: {
        pagination: paginationData,
        ...(options.metadata?.extra
          ? this.getMetadataExtra(options.metadata.extra)
          : {}),
      },
    });
  }

  /**
   * 发送错误响应
   */
  static sendError(
    res: Response,
    error: unknown,
    options: {
      statusCode?: number;
      requestId?: string;
      includeDetails?: boolean;
    } = {}
  ): void {
    const typedError = createErrorFromUnknown(error, {
      component: 'ApiResponseHandler',
      operation: 'sendError',
      context: { statusCode: options.statusCode },
    });

    const errorResponse = typedError.toApiError();

    // 开发环境下添加详细信息
    if (process.env.NODE_ENV === 'development' && options.includeDetails) {
      errorResponse.details = {
        originalError: typedError.message,
        ...(typedError.stack && { stack: typedError.stack }),
        ...(typedError.context && { context: typedError.context }),
        errorId: typedError.id,
      } as JsonValue;
    }

    // 设置响应头
    if (options.requestId) {
      res.setHeader('X-Request-ID', options.requestId);
    }

    if (process.env.NODE_ENV === 'production') {
      res.setHeader('X-Error-ID', typedError.id);
    }

    const statusCode = options.statusCode || this.getDefaultErrorStatusCode(typedError);
    res.status(statusCode).json(errorResponse);
  }

  /**
   * 发送创建成功响应 (201)
   */
  static sendCreated<T = unknown>(
    res: Response,
    data: T,
    options: Omit<SendSuccessOptions, 'statusCode'> = {}
  ): void {
    const nextOptions: SendSuccessOptions = {
      ...(options ?? {}),
      statusCode: 201,
    };

    if (!options?.code) {
      nextOptions.code = 'CREATED';
    }

    this.sendSuccess(res, data, nextOptions);
  }

  private static getMetadataExtra(extra: unknown): Partial<{ extra: JsonObject }> {
    const safeExtra = DynamicDataConverter.toSafeJsonValue(extra);

    if (safeExtra && typeof safeExtra === 'object' && !Array.isArray(safeExtra)) {
      return { extra: safeExtra as JsonObject };
    }

    if (safeExtra === null || safeExtra === undefined) {
      return {};
    }

    return { extra: { value: safeExtra } as JsonObject };
  }

  /**
   * 发送无内容响应 (204)
   */
  static sendNoContent(res: Response, options: { requestId?: string } = {}): void {
    if (options.requestId) {
      res.setHeader('X-Request-ID', options.requestId);
    }
    res.status(204).end();
  }

  /**
   * 发送验证错误响应 (400)
   */
  static sendValidationError(
    res: Response,
    message: string,
    options: {
      details?: JsonValue;
      requestId?: string;
    } = {}
  ): void {
    const error = createErrorFromUnknown(
      new Error(message),
      {
        component: 'ApiResponseHandler',
        operation: 'sendValidationError',
        context: { details: options.details },
      }
    );

    this.sendError(res, error, { ...options, statusCode: 400 });
  }

  /**
   * 发送未授权响应 (401)
   */
  static sendUnauthorized(
    res: Response,
    message: string = '未授权访问',
    options: { requestId?: string } = {}
  ): void {
    const error = createErrorFromUnknown(
      new Error(message),
      {
        component: 'ApiResponseHandler',
        operation: 'sendUnauthorized',
      }
    );

    this.sendError(res, error, { ...options, statusCode: 401 });
  }

  /**
   * 发送禁止访问响应 (403)
   */
  static sendForbidden(
    res: Response,
    message: string = '禁止访问',
    options: { requestId?: string } = {}
  ): void {
    const error = createErrorFromUnknown(
      new Error(message),
      {
        component: 'ApiResponseHandler',
        operation: 'sendForbidden',
      }
    );

    this.sendError(res, error, { ...options, statusCode: 403 });
  }

  /**
   * 发送未找到响应 (404)
   */
  static sendNotFound(
    res: Response,
    message: string = '资源不存在',
    options: { requestId?: string } = {}
  ): void {
    const error = createErrorFromUnknown(
      new Error(message),
      {
        component: 'ApiResponseHandler',
        operation: 'sendNotFound',
      }
    );

    this.sendError(res, error, { ...options, statusCode: 404 });
  }

  /**
   * 发送方法不允许响应 (405)
   */
  static sendMethodNotAllowed(
    res: Response,
    message: string = '方法不允许',
    options: { requestId?: string } = {}
  ): void {
    const error = createErrorFromUnknown(
      new Error(message),
      {
        component: 'ApiResponseHandler',
        operation: 'sendMethodNotAllowed',
      }
    );

    this.sendError(res, error, { ...options, statusCode: 405 });
  }

  /**
   * 发送冲突响应 (409)
   */
  static sendConflict(
    res: Response,
    message: string = '资源冲突',
    options: { requestId?: string } = {}
  ): void {
    const error = createErrorFromUnknown(
      new Error(message),
      {
        component: 'ApiResponseHandler',
        operation: 'sendConflict',
      }
    );

    this.sendError(res, error, { ...options, statusCode: 409 });
  }

  /**
   * 安全的JSON序列化
   */
  static safeJsonStringify(data: JsonValue): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      const typedError = createErrorFromUnknown(error, {
        component: 'ApiResponseHandler',
        operation: 'safeJsonStringify',
        context: { dataType: typeof data },
      });

      return JSON.stringify({
        code: 'SERIALIZATION_ERROR',
        message: '数据序列化失败',
        data: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 批量操作响应
   */
  static sendBatchResult(
    res: Response,
    results: {
      success: boolean;
      data?: JsonValue;
      error?: string;
      index: number;
    }[],
    options: { requestId?: string; startTime?: number } = {}
  ): void {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    const data = {
      total: results.length,
      successful,
      failed,
      results,
    };

    const message = failed === 0
      ? '批量操作全部成功'
      : successful === 0
        ? '批量操作全部失败'
        : `批量操作部分成功 (${successful}/${results.length})`;

    this.sendSuccess(res, data, { ...options, message });
  }

  /**
   * 健康检查响应
   */
  static sendHealthCheck(
    res: Response,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details?: JsonValue,
    options: { requestId?: string } = {}
  ): void {
    const statusCode = status === 'healthy' ? 200 :
                      status === 'degraded' ? 200 : 503;

    const data = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ...(details && { details }),
    };

    this.sendSuccess(res, data, {
      ...options,
      statusCode,
      message: `服务状态: ${status}`,
    });
  }

  /**
   * 获取默认错误状态码
   */
  private static getDefaultErrorStatusCode(error: ReturnType<typeof createErrorFromUnknown>): number {
    const code = error.code;
    const message = error.message.toLowerCase();

    // 客户端错误
    if (code === 'VALIDATION_ERROR') return 400;
    if (code === 'UNAUTHORIZED') return 401;
    if (code === 'FORBIDDEN') return 403;
    if (code === 'NOT_FOUND') return 404;
    if (code === 'CONFLICT') return 409;

    // 服务器错误
    if (code === 'INTERNAL_SERVER_ERROR') return 500;
    if (code === 'SERVICE_UNAVAILABLE') return 503;

    // 基于消息判断
    if (message.includes('not found')) return 404;
    if (message.includes('unauthorized')) return 401;
    if (message.includes('forbidden')) return 403;
    if (message.includes('validation')) return 400;

    return 500;
  }
}

/**
 * 便捷的响应处理函数
 */
export const sendSuccess = <T = JsonValue>(
  res: Response,
  data: T,
  options?: Parameters<typeof ApiResponseHandler.sendSuccess>[2]
): void => {
  ApiResponseHandler.sendSuccess(res, data, options);
};

export const sendError = (
  res: Response,
  error: unknown,
  options?: Parameters<typeof ApiResponseHandler.sendError>[2]
): void => {
  ApiResponseHandler.sendError(res, error, options);
};

export const sendPaginated = <T = JsonValue>(
  res: Response,
  data: T[],
  pagination: Parameters<typeof ApiResponseHandler.sendPaginated>[2],
  options?: Parameters<typeof ApiResponseHandler.sendPaginated>[3]
): void => {
  ApiResponseHandler.sendPaginated(res, data, pagination, options);
};

export const sendCreated = <T = JsonValue>(
  res: Response,
  data: T,
  options?: Parameters<typeof ApiResponseHandler.sendCreated>[2]
): void => {
  ApiResponseHandler.sendCreated(res, data, options);
};

export const sendNotFound = (
  res: Response,
  message?: string,
  options?: { requestId?: string }
): void => {
  ApiResponseHandler.sendNotFound(res, message, options);
};

export const sendValidationError = (
  res: Response,
  message: string,
  options?: Parameters<typeof ApiResponseHandler.sendValidationError>[2]
): void => {
  ApiResponseHandler.sendValidationError(res, message, options);
};