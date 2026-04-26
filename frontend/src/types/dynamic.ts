/**
 * 前端动态数据类型系统
 *
 * 📢 重构说明：从共享包导入核心类型，添加前端特有扩展
 * 🎯 目标：与后端保持类型一致性，同时支持前端特定需求
 */

import type React from 'react';
import type {
  ApiSuccessResponse,
  JsonArray,
  JsonObject,
  JsonValue,
  UnknownValue,
} from '@llmchat/shared-types';

// 重新导出共享类型
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
  QueryParams,
  FastGPTEventPayload,
  FastGPTReasoningData,
  ReasoningStepUpdate,
  ParsedReasoningUpdate,
  FastGPTStreamEventType,
  FastGPTEventMetadata,
  FastGPTEvent,
} from '@llmchat/shared-types';

export {
  DynamicTypeGuard,
  DynamicDataConverter,
} from '@llmchat/shared-types';

export type ApiSuccessPayload<TData> = Omit<ApiSuccessResponse<JsonValue>, 'data'> & {
  data: TData;
};

// ============================================================================
// 前端特有的扩展类型
// ============================================================================

/**
 * 组件状态数据
 */
export interface ComponentStateData {
  id?: string;
  type?: string;
  status?: string;
  data?: JsonValue;
  metadata?: JsonObject;
  error?: string;
  loading?: boolean;
  timestamp?: number;
}

/**
 * 表单数据
 */
export interface FormData {
  [key: string]: unknown;
  validation?: {
    [key: string]: {
      required?: boolean;
      pattern?: string;
      minLength?: number;
      maxLength?: number;
      custom?: (value: unknown) => boolean | string;
    };
  };
  submit?: {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
  };
}

/**
 * 用户交互数据
 */
export interface UserInteractionData {
  type: 'click' | 'change' | 'submit' | 'focus' | 'blur' | 'scroll' | 'resize';
  target?: string;
  value?: unknown;
  coordinates?: {
    x?: number;
    y?: number;
    timestamp?: number;
  };
  metadata?: JsonObject;
}

/**
 * 主题配置数据
 */
export interface ThemeConfigData {
  mode: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  accentColor?: string;
  customColors?: Record<string, string>;
  settings?: {
    fontSize?: 'small' | 'medium' | 'large';
    lineHeight?: number;
    borderRadius?: number;
  };
}

/**
 * 本地存储操作结果
 */
export interface StorageOperationResult {
  success: boolean;
  operation: 'create' | 'read' | 'update' | 'delete';
  key?: string;
  value?: JsonValue;
  timestamp: string;
  error?: {
    code: string;
    message: string;
    details?: JsonObject;
  };
}

/**
 * 数据同步状态
 */
export interface SyncStatus {
  id: string;
  source: string;
  target: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  totalItems?: number;
  processedItems?: number;
  failedItems?: number;
  startTime: string;
  endTime?: string;
  error?: {
    code: string;
    message: string;
    details?: JsonObject;
  };
  metadata?: JsonObject;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T extends JsonValue = JsonValue> {
  key: string;
  value: T;
  timestamp: string;
  expiry?: string;
  ttl?: number;
  tags?: string[];
  metadata?: JsonObject;
}

/**
 * 通知数据
 */
export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: JsonObject;
}

/**
 * 模态框状态
 */
export interface ModalStateData {
  open: boolean;
  type?: 'alert' | 'confirm' | 'prompt' | 'custom';
  title?: string;
  content?: string | React.ReactNode;
  data?: JsonObject;
  onClose?: () => void;
  onConfirm?: (data?: JsonObject) => void;
}

// ============================================================================
// 性能监控类型
// ============================================================================

/**
 * 性能指标数据
 */
export interface PerformanceMetricsData {
  timestamp: number;
  metricName: string;
  value: number | string;
  unit?: string;
  tags?: Record<string, string>;
  dimensions?: Record<string, UnknownValue>;
}

/**
 * 用户行为指标
 */
export interface UserMetricsData {
  timestamp: number;
  userId?: string;
  sessionId?: string;
  action: string;
  target?: string;
  duration?: number;
  success?: boolean;
  metadata?: JsonObject;
}

/**
 * 前端性能指标
 */
export interface FrontendPerformanceData {
  timestamp: number;
  loadTime?: number;
  renderTime?: number;
  domInteractiveTime?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  navigationStart?: number;
  memoryUsage?: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
}

// ============================================================================
// UI状态管理类型
// ============================================================================

/**
 * 分页数据
 */
export interface PaginatedData<T = JsonValue> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 加载状态
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * 异步操作结果
 */
export interface AsyncResult<T = JsonValue> {
  data?: T;
  loading: LoadingState;
  error?: string;
  lastUpdated?: number;
}

/**
 * 响应式断点
 */
export interface ResponsiveBreakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

// ============================================================================
// 向前兼容的类型别名
// ============================================================================

/**
 * 配置参数（前端版本）
 */
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
