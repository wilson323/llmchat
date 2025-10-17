/**
 * 统一的错误处理类型系统
 *
 * 这个文件定义了项目中所有错误处理相关的类型，包括：
 * - 错误基类和具体错误类型
 * - 错误处理结果类型
 * - 安全的类型转换工具
 * - 错误边界处理
 */

import type { JsonValue } from './dynamic';

// ============================================================================
// 错误基类和具体错误类型
// ============================================================================

/**
 * 基础错误类，所有自定义错误都应该继承此类
 */
export abstract class BaseError extends Error {
  public readonly id: string;
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: JsonValue;
  public readonly timestamp: string;
  public readonly userId?: string;
  public readonly requestId?: string;

  constructor({
    message,
    code,
    category,
    severity = 'medium',
    context,
    userId,
    requestId,
    _cause,
  }: {
    message: string;
    code: string;
    category: ErrorCategory;
    severity?: ErrorSeverity;
    context?: JsonValue;
    userId?: string;
    requestId?: string;
    cause?: Error;
  }) {
    super(message);

    // 生成唯一错误ID
    this.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.severity = severity;
    if (context !== undefined) {
      this.context = context;
    }
    this.timestamp = new Date().toISOString();
    if (userId !== undefined) {
      this.userId = userId;
    }
    if (requestId !== undefined) {
      this.requestId = requestId;
    }

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 转换为API错误响应格式
   */
  toApiError(): ApiError {
    const result: ApiError = {
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
    };

    if (this.context !== undefined) {
      result.details = this.context;
    }
    if (this.userId !== undefined) {
      result.userId = this.userId;
    }
    if (this.requestId !== undefined) {
      result.requestId = this.requestId;
    }

    return result;
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    // 根据错误严重性和类别返回用户友好的消息
    if (this.severity === 'critical') {
      return '系统遇到严重错误，请稍后重试';
    }

    switch (this.category) {
      case 'validation':
        return '输入数据不正确，请检查后重试';
      case 'authentication':
        return '身份验证失败，请重新登录';
      case 'authorization':
        return '权限不足，无法执行此操作';
      case 'network':
        return '网络连接失败，请检查网络后重试';
      case 'external_service':
        return '外部服务暂时不可用，请稍后重试';
      case 'resource':
        return '资源不足或不存在，请稍后重试';
      case 'business_logic':
        return '操作无法完成，请检查输入条件';
      case 'system':
        return '系统内部错误，请稍后重试';
      default:
        return '发生未知错误，请稍后重试';
    }
  }

  /**
   * 序列化错误对象（用于日志记录）
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      stack: this.stack,
      context: this.context,
      timestamp: this.timestamp,
      userId: this.userId,
      requestId: this.requestId,
    };
  }
}

/**
 * 错误类别枚举
 */
export type ErrorCategory =
  | 'validation'       // 验证错误
  | 'authentication'   // 身份验证错误
  | 'authorization'    // 权限错误
  | 'network'          // 网络错误
  | 'external_service' // 外部服务错误
  | 'resource'         // 资源错误
  | 'business_logic'   // 业务逻辑错误
  | 'system';          // 系统错误

/**
 * 错误严重性级别
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * API错误响应接口
 */
export interface ApiError {
  code: string;
  message: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  details?: JsonValue;
  timestamp: string;
  userId?: string;
  requestId?: string;
}

// ============================================================================
// 具体错误类定义
// ============================================================================

/**
 * 验证错误
 */
export class ValidationError extends BaseError {
  constructor({
    message,
    code = 'VALIDATION_ERROR',
    field,
    value,
    context,
    severity = 'low',
    userId,
    requestId,
  }: {
    message: string;
    code?: string;
    field?: string;
    value?: unknown;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'validation',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    if (field || value) {
      const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
      superParams.context = { field, value, ...baseContext } as JsonValue;
    } else if (context) {
      superParams.context = context;
    }

    super(superParams);
  }
}

/**
 * 身份验证错误
 */
export class AuthenticationError extends BaseError {
  constructor({
    message = '身份验证失败',
    code = 'AUTHENTICATION_ERROR',
    severity = 'medium',
    ...baseOptions
  }: {
    message?: string;
    code?: string;
    severity?: ErrorSeverity;
  } & Omit<ConstructorParameters<typeof BaseError>[0], 'message' | 'code' | 'category' | 'severity'>) {
    super({
      message,
      code,
      category: 'authentication',
      severity,
      ...baseOptions,
    });
  }
}

/**
 * 权限错误
 */
export class AuthorizationError extends BaseError {
  constructor({
    message = '权限不足',
    code = 'AUTHORIZATION_ERROR',
    resource,
    action,
    context,
    severity = 'medium',
    userId,
    requestId,
  }: {
    message?: string;
    code?: string;
    resource?: string;
    action?: string;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'authorization',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    if (resource || action) {
      const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
      superParams.context = { resource, action, ...baseContext } as JsonValue;
    } else if (context) {
      superParams.context = context;
    }

    super(superParams);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends BaseError {
  constructor({
    message = '网络连接失败',
    code = 'NETWORK_ERROR',
    url,
    method,
    statusCode,
    context,
    severity = 'medium',
    userId,
    requestId,
  }: {
    message?: string;
    code?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'network',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    if (url || method || statusCode) {
      const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
      superParams.context = { url, method, statusCode, ...baseContext } as JsonValue;
    } else if (context) {
      superParams.context = context;
    }

    super(superParams);
  }
}

/**
 * 外部服务错误
 */
export class ExternalServiceError extends BaseError {
  constructor({
    message = '外部服务错误',
    code = 'EXTERNAL_SERVICE_ERROR',
    service,
    endpoint,
    originalError,
    context,
    severity = 'high',
    userId,
    requestId,
  }: {
    message?: string;
    code?: string;
    service?: string;
    endpoint?: string;
    originalError?: unknown;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'external_service',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
    superParams.context = {
      service,
      endpoint,
      originalError: originalError instanceof Error ? {
        message: originalError.message,
        name: originalError.name,
        ...(originalError.stack && { stack: originalError.stack }),
      } : originalError,
      ...baseContext,
    } as JsonValue;

    super(superParams);
  }
}

/**
 * 资源错误
 */
export class ResourceError extends BaseError {
  constructor({
    message = '资源错误',
    code = 'RESOURCE_ERROR',
    resourceType,
    resourceId,
    operation,
    context,
    severity = 'medium',
    userId,
    requestId,
  }: {
    message?: string;
    code?: string;
    resourceType?: string;
    resourceId?: string;
    operation?: string;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'resource',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    if (resourceType || resourceId || operation) {
      const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
      superParams.context = { resourceType, resourceId, operation, ...baseContext } as JsonValue;
    } else if (context) {
      superParams.context = context;
    }

    super(superParams);
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessLogicError extends BaseError {
  constructor({
    message = '业务逻辑错误',
    code = 'BUSINESS_LOGIC_ERROR',
    rule,
    data,
    context,
    severity = 'medium',
    userId,
    requestId,
  }: {
    message?: string;
    code?: string;
    rule?: string;
    data?: unknown;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'business_logic',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    if (rule || data) {
      const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
      superParams.context = { rule, data, ...baseContext } as JsonValue;
    } else if (context) {
      superParams.context = context;
    }

    super(superParams);
  }
}

/**
 * 系统错误
 */
export class SystemError extends BaseError {
  constructor({
    message = '系统内部错误',
    code = 'SYSTEM_ERROR',
    component,
    operation,
    originalError,
    context,
    severity = 'high',
    userId,
    requestId,
  }: {
    message?: string;
    code?: string;
    component?: string;
    operation?: string;
    originalError?: unknown;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  }) {
    const superParams: {
      message: string;
      code: string;
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: JsonValue;
      userId?: string;
      requestId?: string;
    } = {
      message,
      code,
      category: 'system',
    };

    if (severity !== undefined) {
      superParams.severity = severity;
    }
    if (userId !== undefined) {
      superParams.userId = userId;
    }
    if (requestId !== undefined) {
      superParams.requestId = requestId;
    }

    const baseContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
    superParams.context = {
      component,
      operation,
      originalError: originalError instanceof Error ? {
        message: originalError.message,
        name: originalError.name,
        ...(originalError.stack && { stack: originalError.stack }),
      } : originalError,
      ...baseContext,
    } as JsonValue;

    super(superParams);
  }
}

// ============================================================================
// 错误处理结果类型
// ============================================================================

/**
 * 结果类型，用于安全地处理可能失败的操作
 */
export type Result<T, E extends BaseError = BaseError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * 创建成功结果
 */
export function createSuccess<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * 创建失败结果
 */
export function createFailure<E extends BaseError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * 安全地执行可能抛出错误的函数
 */
export function safeExecute<T, E extends BaseError = BaseError>(
  fn: () => T,
  errorFactory?: (error: unknown) => E,
): Result<T, E> {
  try {
    const data = fn();
    return createSuccess(data) as Result<T, E>;
  } catch (unknownError) {
    if (errorFactory) {
      return createFailure(errorFactory(unknownError));
    }

    if (unknownError instanceof BaseError) {
      return createFailure(unknownError as E);
    }

    return createFailure(
      new SystemError({
        message: '未知错误',
        originalError: unknownError,
      }) as E,
    );
  }
}

/**
 * 安全地执行异步函数
 */
export async function safeExecuteAsync<T, E extends BaseError = BaseError>(
  fn: () => Promise<T>,
  errorFactory?: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const data = await fn();
    return createSuccess(data) as Result<T, E>;
  } catch (unknownError) {
    if (errorFactory) {
      return createFailure(errorFactory(unknownError));
    }

    if (unknownError instanceof BaseError) {
      return createFailure(unknownError as E);
    }

    return createFailure(
      new SystemError({
        message: '未知错误',
        originalError: unknownError,
      }) as E,
    );
  }
}

// ============================================================================
// 安全的类型转换工具
// ============================================================================

/**
 * 安全的类型守卫工具
 */
export class TypeGuard {
  /**
   * 检查是否为字符串
   */
  static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * 检查是否为数字
   */
  static isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  /**
   * 检查是否为布尔值
   */
  static isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  /**
   * 检查是否为对象（非null）
   */
  static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 检查是否为数组
   */
  static isArray<T>(value: unknown, guard?: (item: unknown) => item is T): value is T[] {
    if (!Array.isArray(value)) {
      return false;
    }
    if (!guard) {
      return true;
    }
    return value.every(guard);
  }

  /**
   * 检查是否为函数
   */
  static isFunction<TReturn = unknown>(value: unknown): value is (...args: unknown[]) => TReturn {
    return typeof value === 'function';
  }

  /**
   * 检查是否为null或undefined
   */
  static isNullOrUndefined(value: unknown): value is null | undefined {
    return value === null || value === undefined;
  }

  /**
   * 检查是否为有效的日期
   */
  static isValidDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  }

  /**
   * 检查是否为有效的ISO日期字符串
   */
  static isISODateString(value: unknown): value is string {
    if (!this.isString(value)) {
      return false;
    }
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoRegex.test(value) && !isNaN(Date.parse(value));
  }

  /**
   * 检查是否为Email格式
   */
  static isEmail(value: unknown): value is string {
    if (!this.isString(value)) {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * 检查是否为URL格式
   */
  static isURL(value: unknown): value is string {
    if (!this.isString(value)) {
      return false;
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查对象是否具有指定的属性
   */
  static hasProperty<K extends string | number | symbol>(
    obj: unknown,
    key: K,
  ): obj is Record<K, unknown> {
    return this.isObject(obj) && key in obj;
  }

  /**
   * 检查对象是否具有所有指定的属性
   */
  static hasProperties<T extends Record<string, unknown>>(
    obj: unknown,
    keys: (keyof T)[],
  ): obj is T {
    if (!this.isObject(obj)) {
      return false;
    }
    return keys.every(key => key in obj);
  }
}

/**
 * 安全的类型转换工具
 */
export class SafeCast {
  /**
   * 安全转换为字符串
   */
  static toString(value: unknown, defaultValue = ''): string {
    if (TypeGuard.isString(value)) {
      return value;
    }
    if (TypeGuard.isNumber(value) || TypeGuard.isBoolean(value)) {
      return String(value);
    }
    return defaultValue;
  }

  /**
   * 安全转换为数字
   */
  static toNumber(value: unknown, defaultValue = 0): number {
    if (TypeGuard.isNumber(value)) {
      return value;
    }
    if (TypeGuard.isString(value)) {
      const parsed = Number(value);
      return !isNaN(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  }

  /**
   * 安全转换为布尔值
   */
  static toBoolean(value: unknown, defaultValue = false): boolean {
    if (TypeGuard.isBoolean(value)) {
      return value;
    }
    if (TypeGuard.isString(value)) {
      return value.toLowerCase() === 'true';
    }
    if (TypeGuard.isNumber(value)) {
      return value !== 0;
    }
    return defaultValue;
  }

  /**
   * 安全转换为日期
   */
  static toDate(value: unknown, defaultValue: Date = new Date()): Date {
    if (TypeGuard.isValidDate(value)) {
      return value;
    }
    if (TypeGuard.isISODateString(value)) {
      return new Date(value);
    }
    if (TypeGuard.isNumber(value)) {
      return new Date(value);
    }
    return defaultValue;
  }

  /**
   * 安全转换为对象
   */
  static toObject<T extends Record<string, unknown>>(
    value: unknown,
    defaultValue: T = {} as T,
  ): T {
    if (TypeGuard.isObject(value)) {
      return value as T;
    }
    return defaultValue;
  }

  /**
   * 安全转换为数组
   */
  static toArray<T>(
    value: unknown,
    guard?: (item: unknown) => item is T,
    defaultValue: T[] = [],
  ): T[] {
    if (TypeGuard.isArray(value, guard)) {
      return value;
    }
    return defaultValue;
  }

  /**
   * 安全地从对象中获取属性值
   */
  static getProperty<T>(
    obj: unknown,
    key: string,
    guard: (value: unknown) => value is T,
    defaultValue: T,
  ): T {
    if (TypeGuard.hasProperty(obj, key)) {
      const value = obj[key];
      if (guard(value)) {
        return value;
      }
    }
    return defaultValue;
  }
}

// ============================================================================
// 错误处理工具函数
// ============================================================================

/**
 * 错误处理工厂，根据未知错误创建适当的错误类型
 */
export function createErrorFromUnknown(error: unknown, context?: {
  userId?: string;
  requestId?: string;
  component?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  field?: string;
  value?: unknown;
  resource?: string;
  action?: string;
  operation?: string;
  severity?: ErrorSeverity;
  // 额外的上下文属性，用于控制器和中间件
  agentId?: string;
  sessionId?: string;
  originalError?: string;
  stack?: string;
  [key: string]: unknown; // 允许其他自定义属性
}): BaseError {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    // 根据错误消息判断错误类型
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      const networkParams: {
        message?: string;
        code?: string;
        url?: string;
        method?: string;
        statusCode?: number;
        context?: JsonValue;
        severity?: ErrorSeverity;
        userId?: string;
        requestId?: string;
      } = {
        message: error.message,
      };

      if (context?.url !== undefined) {
        networkParams.url = context.url;
      }
      if (context?.method !== undefined) {
        networkParams.method = context.method;
      }
      if (context?.statusCode !== undefined) {
        networkParams.statusCode = context.statusCode;
      }
      if (context?.severity !== undefined) {
        networkParams.severity = context.severity;
      }
      if (context?.userId !== undefined) {
        networkParams.userId = context.userId;
      }
      if (context?.requestId !== undefined) {
        networkParams.requestId = context.requestId;
      }

      const { url: _url, method: _method, statusCode: _statusCode, severity: _severity, userId: _userId, requestId: _requestId, ...restContext } = context || {};
      if (Object.keys(restContext || {}).length > 0) {
        networkParams.context = restContext as JsonValue;
      }

      return new NetworkError(networkParams);
    }

    if (message.includes('validation') || message.includes('invalid')) {
      const validationParams: {
        message: string;
        code?: string;
        field?: string;
        value?: unknown;
        context?: JsonValue;
        severity?: ErrorSeverity;
        userId?: string;
        requestId?: string;
      } = {
        message: error.message,
      };

      if (context?.field !== undefined) {
        validationParams.field = context.field;
      }
      if (context?.value !== undefined) {
        validationParams.value = context.value;
      }
      if (context?.severity !== undefined) {
        validationParams.severity = context.severity;
      }
      if (context?.userId !== undefined) {
        validationParams.userId = context.userId;
      }
      if (context?.requestId !== undefined) {
        validationParams.requestId = context.requestId;
      }

      const { field: _field, value: _value, severity: _severity, userId: _userId, requestId: _requestId, ...restContext } = context || {};
      if (Object.keys(restContext || {}).length > 0) {
        validationParams.context = restContext as JsonValue;
      }

      return new ValidationError(validationParams);
    }

    if (message.includes('unauthorized') || message.includes('auth')) {
      const authParams: {
        message: string;
        code?: string;
        severity?: ErrorSeverity;
        userId?: string;
        requestId?: string;
      } & Omit<ConstructorParameters<typeof AuthenticationError>[0], 'message' | 'code' | 'category' | 'severity'> = {
        message: error.message,
      };

      if (context?.severity !== undefined) {
        authParams.severity = context.severity;
      }
      if (context?.userId !== undefined) {
        authParams.userId = context.userId;
      }
      if (context?.requestId !== undefined) {
        authParams.requestId = context.requestId;
      }

      const { severity: _severity, userId: _userId, requestId: _requestId, ...restContext } = context || {};
      return new AuthenticationError({
        ...authParams,
        ...restContext,
      });
    }

    if (message.includes('forbidden') || message.includes('permission')) {
      const authzParams: {
        message?: string;
        code?: string;
        resource?: string;
        action?: string;
        context?: JsonValue;
        severity?: ErrorSeverity;
        userId?: string;
        requestId?: string;
      } = {
        message: error.message,
      };

      if (context?.resource !== undefined) {
        authzParams.resource = context.resource;
      }
      if (context?.action !== undefined) {
        authzParams.action = context.action;
      }
      if (context?.severity !== undefined) {
        authzParams.severity = context.severity;
      }
      if (context?.userId !== undefined) {
        authzParams.userId = context.userId;
      }
      if (context?.requestId !== undefined) {
        authzParams.requestId = context.requestId;
      }

      const { resource: _resource, action: _action, severity: _severity, userId: _userId, requestId: _requestId, ...restContext } = context || {};
      if (Object.keys(restContext || {}).length > 0) {
        authzParams.context = restContext as JsonValue;
      }

      return new AuthorizationError(authzParams);
    }

    // 默认为系统错误
    const systemParams: {
      message?: string;
      code?: string;
      component?: string;
      operation?: string;
      originalError?: unknown;
      context?: JsonValue;
      severity?: ErrorSeverity;
      userId?: string;
      requestId?: string;
    } = {
      message: error.message,
      originalError: error,
    };

    if (context?.component !== undefined) {
      systemParams.component = context.component;
    }
    if (context?.operation !== undefined) {
      systemParams.operation = context.operation;
    }
    if (context?.severity !== undefined) {
      systemParams.severity = context.severity;
    }
    if (context?.userId !== undefined) {
      systemParams.userId = context.userId;
    }
    if (context?.requestId !== undefined) {
      systemParams.requestId = context.requestId;
    }

    const { component: _component, operation: _operation, severity: _severity, userId: _userId, requestId: _requestId, originalError: _originalError, ...restContext } = context || {};
    if (Object.keys(restContext || {}).length > 0) {
      systemParams.context = restContext as JsonValue;
    }

    return new SystemError(systemParams);
  }

  // 非Error类型的未知错误
  const unknownSystemParams: {
    message?: string;
    code?: string;
    component?: string;
    operation?: string;
    originalError?: unknown;
    context?: JsonValue;
    severity?: ErrorSeverity;
    userId?: string;
    requestId?: string;
  } = {
    message: '未知错误',
    originalError: error,
  };

  if (context?.component !== undefined) {
    unknownSystemParams.component = context.component;
  }
  if (context?.operation !== undefined) {
    unknownSystemParams.operation = context.operation;
  }
  if (context?.severity !== undefined) {
    unknownSystemParams.severity = context.severity;
  }
  if (context?.userId !== undefined) {
    unknownSystemParams.userId = context.userId;
  }
  if (context?.requestId !== undefined) {
    unknownSystemParams.requestId = context.requestId;
  }

  const { component: _comp, operation: _oper, severity: _sev, userId: _uid, requestId: _rid, originalError: _origErr, ...restContextUnknown } = context || {};
  if (Object.keys(restContextUnknown || {}).length > 0) {
    unknownSystemParams.context = restContextUnknown as JsonValue;
  }

  return new SystemError(unknownSystemParams);
}

/**
 * 包装Express路由处理器的错误处理函数
 */
export function wrapAsyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  options?: {
    userId?: string;
    requestId?: string;
    component?: string;
  },
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      const typedError = createErrorFromUnknown(error, options);
      throw typedError;
    }
  };
}

/**
 * 创建标准的错误响应
 */
export function createErrorResponse(error: BaseError): {
  status: number;
  body: ApiError;
} {
  const statusMap: Record<ErrorCategory, number> = {
    validation: 400,
    authentication: 401,
    authorization: 403,
    network: 503,
    external_service: 502,
    resource: 404,
    business_logic: 422,
    system: 500,
  };

  return {
    status: statusMap[error.category] || 500,
    body: error.toApiError(),
  };
}
