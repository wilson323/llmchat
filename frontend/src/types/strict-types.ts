/**
 * 严格类型定义
 *
 * 为关键模块提供严格的类型约束，消除类型安全问题
 */

// ==================== 基础严格类型 ====================

/**
 * 严格的对象键类型
 */
export type StrictObjectKey = string | number | symbol;

/**
 * 严格的数组类型 - 确保没有undefined元素
 */
export type StrictArray<T> = ReadonlyArray<T> & {
  0: T;
  length: number;
};

/**
 * 严格的字符串类型 - 排除空字符串
 */
export type NonEmptyString = string & { readonly __brand: unique symbol };

/**
 * 创建非空字符串类型守卫
 */
export const isNonEmptyString = (value: unknown): value is NonEmptyString => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * 严格的数字类型 - 排除NaN和Infinity
 */
export type StrictNumber = number & { readonly __brand: unique symbol };

/**
 * 创建严格数字类型守卫
 */
export const isStrictNumber = (value: unknown): value is StrictNumber => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

// ==================== API类型定义 ====================

/**
 * 严格的HTTP方法类型
 */
export type StrictHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * 严格的HTTP状态码类型
 */
export type StrictHttpStatus =
  | 200 | 201 | 202 | 204 // 成功状态
  | 301 | 302 | 303 | 307 | 308 // 重定向状态
  | 400 | 401 | 403 | 404 | 405 | 408 | 409 | 422 | 429 // 客户端错误
  | 500 | 501 | 502 | 503 | 504; // 服务器错误

/**
 * 严格的API响应类型
 */
export interface StrictApiResponse<TData = unknown, TError = unknown> {
  readonly success: boolean;
  readonly data: TResult<TData, TError>;
  readonly status: StrictHttpStatus;
  readonly timestamp: string;
  readonly requestId?: string;
}

/**
 * 严格的结果类型
 */
export type TResult<TSuccess, TError> =
  | { readonly success: true; readonly data: TSuccess }
  | { readonly success: false; readonly error: TError };

/**
 * 创建成功的Result
 */
export const createSuccessResult = <T>(data: T): TResult<T, never> => ({
  success: true,
  data,
});

/**
 * 创建失败的Result
 */
export const createErrorResult = <E>(error: E): TResult<never, E> => ({
  success: false,
  error,
});

// ==================== 存储类型定义 ====================

/**
 * 严格的存储键类型
 */
export type StrictStorageKey = string & { readonly __brand: unique symbol };

/**
 * 基础存储值类型
 */
type BaseStorageValue = string | number | boolean | null | undefined;

/**
 * 严格的对象类型
 */
export type StrictObject = Readonly<Record<string, BaseStorageValue>>;

/**
 * 严格的存储值类型 - 支持序列化
 */
export type StrictStorageValue =
  | BaseStorageValue
  | StrictObject
  | ReadonlyArray<BaseStorageValue>;

/**
 * 存储操作接口
 */
export interface IStrictStorage {
  getItem<K extends StrictStorageKey>(key: K): StrictStorageValue | null;
  setItem<K extends StrictStorageKey, V extends StrictStorageValue>(key: K, value: V): void;
  removeItem<K extends StrictStorageKey>(key: K): void;
  clear(): void;
  key(index: number): StrictStorageKey | null;
  readonly length: number;
}

/**
 * 类型安全的localStorage包装器
 */
export class StrictLocalStorage implements IStrictStorage {
  private storage: Storage;

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage;
  }

  getItem<K extends StrictStorageKey>(key: K): StrictStorageValue | null {
    try {
      const item = this.storage.getItem(key);
      if (item === null) {
return null;
}

      // 尝试JSON解析
      const parsed = JSON.parse(item);
      return this.validateStorageValue(parsed);
    } catch {
      // 如果解析失败，返回原始字符串
      const item = this.storage.getItem(key);
      return item;
    }
  }

  setItem<K extends StrictStorageKey, V extends StrictStorageValue>(key: K, value: V): void {
    try {
      const serialized = JSON.stringify(value);
      this.storage.setItem(key, serialized);
    } catch (error) {
      console.error('存储序列化失败:', error);
      throw new Error(`无法存储键 ${String(key)} 的值`);
    }
  }

  removeItem<K extends StrictStorageKey>(key: K): void {
    this.storage.removeItem(key);
  }

  clear(): void {
    this.storage.clear();
  }

  key(index: number): StrictStorageKey | null {
    const key = this.storage.key(index);
    return key as StrictStorageKey | null;
  }

  get length(): number {
    return this.storage.length;
  }

  private validateStorageValue(value: unknown): StrictStorageValue {
    // 基本类型检查
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // 对象类型检查
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as StrictObject;
    }

    // 数组类型检查
    if (Array.isArray(value)) {
      return value.map(item => this.validateStorageValue(item)) as ReadonlyArray<BaseStorageValue>;
    }

    // 其他类型转换为字符串
    return String(value);
  }
}

// ==================== 事件类型定义 ====================

/**
 * 严格的事件类型
 */
export interface StrictCustomEvent<TDetail = unknown> extends CustomEvent {
  readonly detail: TDetail;
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly timeStamp: number;
}

/**
 * 严格的事件监听器类型
 */
export type StrictEventListener<TEvent extends StrictCustomEvent> = (event: TEvent) => void;

/**
 * 事件发射器接口
 */
export interface IStrictEventEmitter {
  on<TEvent extends StrictCustomEvent>(
    type: TEvent['type'],
    listener: StrictEventListener<TEvent>
  ): () => void; // 返回取消函数

  emit<TEvent extends StrictCustomEvent>(event: TEvent): void;
  off<TEvent extends StrictCustomEvent>(
    type: TEvent['type'],
    listener: StrictEventListener<TEvent>
  ): void;
}

/**
 * 类型安全的事件发射器实现
 */
export class StrictEventEmitter implements IStrictEventEmitter {
  private listeners = new Map<string, Set<Function>>();

  on<TEvent extends StrictCustomEvent>(
    type: TEvent['type'],
    listener: StrictEventListener<TEvent>,
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const listeners = this.listeners.get(type)!;
    listeners.add(listener);

    // 返回取消函数
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  emit<TEvent extends StrictCustomEvent>(event: TEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`事件监听器错误 [${event.type}]:`, error);
        }
      }
    }
  }

  off<TEvent extends StrictCustomEvent>(
    type: TEvent['type'],
    listener: StrictEventListener<TEvent>,
  ): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }
}

// ==================== 异步操作类型定义 ====================

/**
 * 严格的Promise状态
 */
export type PromiseState = 'pending' | 'fulfilled' | 'rejected';

/**
 * 严格的异步操作结果
 */
export interface StrictAsyncResult<TData, TError = Error> {
  readonly state: PromiseState;
  readonly data?: TResult<TData, TError>;
  readonly isLoading: boolean;
  readonly error?: TError;
  readonly timestamp: number;
}

/**
 * 创建严格的异步操作工具
 */
export class StrictAsyncOperation<TData, TError = Error> {
  private result: StrictAsyncResult<TData, TError> = {
    state: 'pending',
    isLoading: true,
    timestamp: Date.now(),
  };

  private promise: Promise<TResult<TData, TError>>;
  private resolve?: (value: TResult<TData, TError>) => void;
  private reject?: (reason: TError) => void;

  constructor() {
    this.promise = new Promise<TResult<TData, TError>>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }

  /**
   * 成功完成
   */
  completeSuccess(value: TResult<TData, TError>): void {
    if (this.resolve) {
      this.result = {
        state: 'fulfilled',
        data: value,
        isLoading: false,
        timestamp: Date.now(),
      };
      this.resolve(value);
    }
  }

  /**
   * 失败完成
   */
  completeFailure(error: TError): void {
    if (this.reject) {
      this.result = {
        state: 'rejected',
        error,
        isLoading: false,
        timestamp: Date.now(),
      };
      this.reject(error);
    }
  }

  /**
   * 获取结果
   */
  getResult(): StrictAsyncResult<TData, TError> {
    return { ...this.result };
  }

  /**
   * 获取Promise
   */
  getPromise(): Promise<TResult<TData, TError>> {
    return this.promise;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.result = {
      state: 'pending',
      isLoading: true,
      timestamp: Date.now(),
    };
    this.promise = new Promise<TResult<TData, TError>>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

// ==================== 工具类型 ====================

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? DeepReadonlyArray<U>
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * 深度只读数组类型
 */
export type DeepReadonlyArray<T> = ReadonlyArray<DeepReadonly<T>>;

/**
 * 创建深度只读对象
 */
export const createDeepReadonly = <T>(obj: T): DeepReadonly<T> => {
  return Object.freeze(obj) as DeepReadonly<T>;
};

/**
 * 严格的联合类型检查
 */
export type StrictUnion<T extends string> = T & {
  readonly __brand: unique symbol;
};

/**
 * 创建严格联合类型守卫
 */
export const createStrictUnionGuard = <T extends string>(values: readonly T[]) => {
  return (value: unknown): value is StrictUnion<T> => {
    return typeof value === 'string' && values.includes(value as T);
  };
};

// ==================== 导出 ====================

export default {
  StrictLocalStorage,
  StrictEventEmitter,
  StrictAsyncOperation,
  isNonEmptyString,
  isStrictNumber,
  createSuccessResult,
  createErrorResult,
  createDeepReadonly,
  createStrictUnionGuard,
};

// 类型守卫
export type TypeGuard<T> = (value: unknown) => value is T;

// 工具函数类型
export type AsyncFunction<TArgs extends readonly unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>;
export type SyncFunction<TArgs extends readonly unknown[], TReturn> = (...args: TArgs) => TReturn;

// 严格的函数类型
export interface StrictFunction<TArgs extends readonly unknown[], TReturn> {
  (...args: TArgs): TReturn;
  readonly length: TArgs['length'];
  readonly name?: string;
}