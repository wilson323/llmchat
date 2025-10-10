/**
 * LLMChat 前后端共享类型定义
 *
 * 统一管理所有跨模块使用的类型，避免重复定义和同步问题
 */

// ============================================================================
// Enhanced Types (类型安全增强)
// ============================================================================

export * from './enhanced-types';

// ============================================================================
// CAD 相关类型
// ============================================================================

export * from './cad';

// ============================================================================
// SSE 事件类型
// ============================================================================

export * from './sse-events';

// ============================================================================
// 核心动态数据类型
// ============================================================================

/**
 * JSON数组类型
 */
export type JsonArray = JsonValue[];

/**
 * JSON值类型
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonArray
  | { readonly [key: string]: JsonValue };

/**
 * 通用的键值对对象类型
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * 安全的未知类型，用于替换any
 */
export type UnknownValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonObject
  | JsonArray
  | Function
  | Symbol
  | bigint;

/**
 * 通用数据载荷接口
 */
export interface DataPayload<T extends JsonValue = JsonValue> {
  data: T;
  type?: string;
  timestamp?: string;
  metadata?: JsonObject;
}

// ============================================================================
// API请求和响应类型
// ============================================================================

/**
 * 通用API请求载荷
 */
export interface ApiRequestPayload {
  [key: string]: UnknownValue;
}

/**
 * 通用API成功响应载荷
 */
export interface ApiSuccessResponse<T extends JsonValue = JsonValue> {
  code: string;
  message: string;
  data: T;
  timestamp: string;
  requestId?: string;
  metadata?: {
    version: string;
    duration?: number;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    extra?: JsonObject;
  };
}

/**
 * 兼容别名：保持向后兼容
 */
export type ApiResponsePayload<T extends JsonValue = JsonValue> = ApiSuccessResponse<T>;

/**
 * 外部服务通用响应
 */
export interface ExternalServiceResponse {
  status: number;
  statusText: string;
  data: JsonValue;
  headers: Record<string, string>;
  config: {
    url: string;
    method: string;
    timeout?: number;
  };
}

// ============================================================================
// FastGPT特定动态类型
// ============================================================================

/**
 * FastGPT事件载荷基础接口
 */
export interface FastGPTEventPayload {
  id?: string;
  event?: string;
  data: JsonValue;
  timestamp?: string;
  source?: string;
  appId?: string;
  chatId?: string;
  flowId?: string;
  nodeId?: string;
}

/**
 * FastGPT推理数据结构
 */
export interface FastGPTReasoningData {
  text?: string;
  content?: string;
  message?: string;
  analysis?: string;
  reasoning?: string;
  reasoning_content?: JsonValue;
  details?: string;
  title?: string;
  order?: number;
  step?: number;
  stepIndex?: number;
  stepNumber?: number;
  index?: number;
  thoughtNumber?: number;
  totalThoughts?: number;
  totalSteps?: number;
  total_steps?: number;
  nextThoughtNeeded?: boolean;
  need_next_thought?: boolean;
  hasMore?: boolean;
  has_more?: boolean;
  finished?: boolean;
  is_final?: boolean;
  isFinal?: boolean;
  done?: boolean;
  completed?: boolean;
  output?: {
    reasoning_content?: JsonValue;
  };
  delta?: {
    reasoning_content?: JsonValue;
  };
  steps?: JsonValue;
  data?: JsonValue;
  payload?: JsonValue;
  raw?: JsonValue;
  thought?: JsonValue;
}

/**
 * 推理步骤更新
 */
export interface ReasoningStepUpdate {
  content: string;
  order?: number;
  totalSteps?: number;
  title?: string;
  raw?: JsonValue;
  timestamp?: string;
}

/**
 * 解析后的推理更新
 */
export interface ParsedReasoningUpdate {
  steps: ReasoningStepUpdate[];
  finished?: boolean;
  totalSteps?: number;
}

/**
 * FastGPT流式事件类型
 */
export type FastGPTStreamEventType =
  | 'status'
  | 'interactive'
  | 'flowNodeStatus'
  | 'progress'
  | 'error'
  | 'complete'
  | 'start'
  | 'end'
  | 'workflowDuration'
  | 'reasoning'
  | 'step'
  | 'chunk';

/**
 * FastGPT事件元数据
 */
export interface FastGPTEventMetadata {
  label: string;
  level: 'info' | 'success' | 'warning' | 'error';
  summary?: (payload: JsonValue) => string | undefined;
}

/**
 * FastGPT标准化事件
 */
export interface FastGPTEvent {
  type: FastGPTStreamEventType;
  label: string;
  level: 'info' | 'success' | 'warning' | 'error';
  summary?: string;
  payload?: JsonValue;
  timestamp: string;
  raw?: JsonValue;
}

// ============================================================================
// 类型守卫和验证器
// ============================================================================

/**
 * 动态数据类型守卫
 */
export class DynamicTypeGuard {
  /**
   * 检查是否为有效的JSON值
   */
  static isJsonValue(value: unknown): value is JsonValue {
    const isPrimitive = (v: unknown): v is string | number | boolean | null => {
      return typeof v === 'string' ||
             typeof v === 'number' ||
             typeof v === 'boolean' ||
             v === null;
    };

    const isArray = (v: unknown): v is JsonArray => {
      return Array.isArray(v) && v.every((item) => DynamicTypeGuard.isJsonValue(item));
    };

    const isObject = (v: unknown): v is JsonObject => {
      return typeof v === 'object' &&
             v !== null &&
             !Array.isArray(v) &&
             Object.entries(v).every(
               ([_, val]) => DynamicTypeGuard.isJsonValue(val)
             );
    };

    return isPrimitive(value) || isArray(value) || isObject(value);
  }

  /**
   * 检查是否为有效的API请求载荷
   */
  static isApiRequestPayload(value: unknown): value is ApiRequestPayload {
    return typeof value === 'object' &&
           value !== null &&
           !Array.isArray(value);
  }

  /**
   * 检查是否为有效的FastGPT事件载荷
   */
  static isFastGPTEventPayload(value: unknown): value is FastGPTEventPayload {
    if (!this.isApiRequestPayload(value)) return false;

    const payload = value as Record<string, unknown>;
    return this.isJsonValue(payload.data);
  }

  /**
   * 检查是否为有效的推理数据
   */
  static isReasoningData(value: unknown): value is FastGPTReasoningData {
    return this.isApiRequestPayload(value);
  }
}

/**
 * 动态数据转换器
 */
export class DynamicDataConverter {
  /**
   * 安全转换为JSON值
   */
  static toJsonValue(value: unknown, defaultValue: JsonValue = null): JsonValue {
    if (DynamicTypeGuard.isJsonValue(value)) return value;

    // 尝试转换常见类型
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (value === undefined) return null;

    return defaultValue;
  }

  /**
   * 安全转换复杂对象为JSON值
   */
  static toSafeJsonValue(obj: unknown): JsonValue {
    if (obj === null || obj === undefined) return null;

    // 基本类型
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    // 数组
    if (Array.isArray(obj)) {
      return obj.map(item => this.toSafeJsonValue(item));
    }

    // 对象
    if (typeof obj === 'object') {
      const result: Record<string, JsonValue> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.toSafeJsonValue(value);
      }
      return result;
    }

    // 其他类型转换为字符串
    return String(obj);
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 安全的属性访问工具
 */
export class SafeAccess {
  /**
   * 安全地从 JsonValue 中获取属性
   */
  static getProperty<T extends JsonValue>(
    obj: JsonValue | undefined,
    key: string,
    guard: (value: JsonValue) => value is T,
    defaultValue: T
  ): T {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return defaultValue;
    }

    const value = (obj as Record<string, JsonValue>)[key];
    if (value !== undefined && guard(value)) {
      return value;
    }

    return defaultValue;
  }

  /**
   * 安全地从 JsonValue 中获取字符串属性
   */
  static getString(obj: JsonValue | undefined, key: string, defaultValue: string = ''): string {
    return this.getProperty(obj, key, (value: JsonValue): value is string =>
      typeof value === 'string', defaultValue);
  }

  /**
   * 安全地从 JsonValue 中获取数字属性
   */
  static getNumber(obj: JsonValue | undefined, key: string, defaultValue: number = 0): number {
    return this.getProperty(obj, key, (value: JsonValue): value is number =>
      typeof value === 'number' && !isNaN(value), defaultValue);
  }

  /**
   * 安全地从 JsonValue 中获取布尔属性
   */
  static getBoolean(obj: JsonValue | undefined, key: string, defaultValue: boolean = false): boolean {
    return this.getProperty(obj, key, (value: JsonValue): value is boolean =>
      typeof value === 'boolean', defaultValue);
  }

  /**
   * 安全地从 JsonValue 中获取对象属性
   */
  static getObject(obj: JsonValue | undefined, key: string): JsonValue | undefined {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return undefined;
    }

    const value = (obj as Record<string, JsonValue>)[key];
    if (value !== undefined &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)) {
      return value;
    }

    return undefined;
  }
}

// ============================================================================
// 查询参数类型
// ============================================================================

/**
 * 分页查询参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 时间范围查询参数
 */
export interface DateRangeParams {
  startDate?: string; // ISO 8601格式
  endDate?: string;   // ISO 8601格式
}

/**
 * 搜索过滤参数
 */
export interface SearchFilterParams {
  search?: string;
  filters?: JsonObject;
  tags?: string[];
}

/**
 * 组合查询参数
 */
export interface QueryParams extends PaginationParams, DateRangeParams, SearchFilterParams {
  [key: string]: UnknownValue;
}