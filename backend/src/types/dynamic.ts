/**
 * 动态数据类型系统 - 根源性类型安全解决方案
 *
 * 📢 重构说明：所有核心类型现在从 @llmchat/shared-types 包导入
 * 🎯 目标：统一前后端类型定义，避免重复和不一致
 */

// 重新导出共享类型，保持向后兼容
export type {
  JsonObject,
  JsonArray,
  JsonValue,
  UnknownValue,
  DataPayload,
  ApiRequestPayload,
  ApiSuccessResponse,
  ApiResponsePayload,
  ExternalServiceResponse,
  PaginationParams,
  DateRangeParams,
  SearchFilterParams,
  QueryParams,
  FastGPTEventPayload,
  FastGPTReasoningData,
  ReasoningStepUpdate,
  ParsedReasoningUpdate,
  FastGPTStreamEventType,
  FastGPTEventMetadata,
  FastGPTEvent,
  DynamicTypeGuard,
  DynamicDataConverter,
  SafeAccess,
} from '@llmchat/shared-types';

// ============================================================================
// 后端特有的扩展类型
// ============================================================================

/**
 * 后端API错误详情
 */
export interface ApiErrorDetails {
  originalError?: string;
  stack?: string;
  context?: JsonObject;
  errorId?: string;
  component?: string;
  operation?: string;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * 后端API响应
 */
export interface ApiError {
  code: string;
  message: string;
  category?: string;
  severity?: string;
  details?: JsonObject;
  timestamp: string;
  userId?: string;
  requestId?: string;
}

/**
 * 错误严重性级别
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误分类
 */
export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'permission'
  | 'not_found'
  | 'rate_limit'
  | 'internal_server_error'
  | 'service_unavailable'
  | 'timeout'
  | 'external_service';

/**
 * 扩展的请求上下文
 */
export interface RequestContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  timestamp?: number;
  traceId?: string;
}

/**
 * 性能监控数据
 */
export interface PerformanceContext {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpuUsage?: number;
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 结构化日志数据
 */
export interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  component?: string;
  operation?: string;
  context?: JsonObject;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: PerformanceContext;
}

// ============================================================================
// 向后兼容的类型别名
// ============================================================================

// 保持向后兼容性的别名
export type ConfigParameters = Record<string,
  | string
  | number
  | boolean
  | string[]
  | number[]
  | JsonObject
  | JsonArray
  | null
>;
