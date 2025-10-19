/**
 * API通用类型定义
 *
 * 提供统一的请求/响应接口、分页类型和配置选项
 */

import type {
  JsonValue,
  JsonObject,
  ApiSuccessResponse,
  PaginationParams,
  QueryParams
} from '@llmchat/shared-types';
import type { ApiErrorType, ApiResult } from './api-errors';

// ============================================================================
// HTTP方法类型
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// ============================================================================
// 请求配置类型
// ============================================================================

/**
 * API请求基础配置
 */
export interface ApiRequestConfig {
  method?: HttpMethod;
  url: string;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: JsonValue;
  timeout?: number;
  signal?: AbortSignal;
  retries?: number;
  retryDelay?: number;
  validateStatus?: (status: number) => boolean;
  onUploadProgress?: (progressEvent: ProgressEvent) => void;
  onDownloadProgress?: (progressEvent: ProgressEvent) => void;
}

/**
 * API请求选项
 */
export interface ApiRequestOptions {
  skipAuth?: boolean;
  skipErrorHandler?: boolean;
  skipLoading?: boolean;
  cache?: boolean;
  cacheTTL?: number; // 缓存时间（秒）
  transformRequest?: (data: JsonValue) => JsonValue;
  transformResponse?: (data: JsonValue) => JsonValue;
  metadata?: JsonObject;
}

// ============================================================================
// 响应类型
// ============================================================================

/**
 * API响应接口
 */
export interface ApiResponse<T = JsonValue> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: ApiRequestConfig;
  request?: any;
}

/**
 * 分页响应数据
 */
export interface PaginatedResponse<T = JsonValue> {
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
 * 文件上传响应
 */
export interface UploadResponse {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnail?: string;
  metadata?: JsonObject;
}

// ============================================================================
// 特定业务类型
// ============================================================================

/**
 * 智能体状态
 */
export type AgentStatus = 'active' | 'inactive' | 'error' | 'loading';

/**
 * 智能体提供商类型
 */
export type AgentProvider = 'fastgpt' | 'openai' | 'anthropic' | 'dify' | 'custom';

/**
 * 聊天消息角色
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * 流式响应状态
 */
export type StreamStatus = 'running' | 'completed' | 'error';

/**
 * 用户角色
 */
export type UserRole = 'admin' | 'user' | 'guest';

/**
 * 日志级别
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

// ============================================================================
// 请求参数类型
// ============================================================================

/**
 * 智能体列表查询参数
 */
export interface AgentListParams extends QueryParams {
  includeInactive?: boolean;
  provider?: AgentProvider;
  status?: AgentStatus;
  search?: string;
}

/**
 * 聊天历史查询参数
 */
export interface ChatHistoryParams extends QueryParams {
  agentId: string;
  chatId?: string;
  limit?: number;
}

/**
 * 日志查询参数
 */
export interface LogQueryParams extends QueryParams {
  level?: LogLevel;
  startDate?: string;
  endDate?: string;
  userId?: string;
  agentId?: string;
}

/**
 * 用户管理参数
 */
export interface UserManagementParams extends QueryParams {
  role?: UserRole;
  status?: string;
  search?: string;
}

// ============================================================================
// 请求载荷类型
// ============================================================================

/**
 * 智能体创建/更新载荷
 */
export interface AgentPayload {
  id?: string;
  name: string;
  description?: string;
  provider: AgentProvider;
  endpoint: string;
  apiKey: string;
  appId?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  capabilities?: string[];
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  isActive?: boolean;
  features?: Record<string, any>;
}

/**
 * 聊天消息载荷
 */
export interface ChatMessagePayload {
  agentId: string;
  messages: Array<{
    role: ChatRole;
    content: string;
    timestamp?: number;
  }>;
  stream?: boolean;
  chatId?: string;
  detail?: boolean;
  temperature?: number;
  maxTokens?: number;
  variables?: Record<string, any>;
  responseChatItemId?: string;
  attachments?: Array<{
    id: string;
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }>;
  voiceNote?: {
    id: string;
    url: string;
    duration: number;
    mimeType: string;
  };
}

/**
 * 用户认证载荷
 */
export interface AuthPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 密码修改载荷
 */
export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

/**
 * 用户创建载荷
 */
export interface CreateUserPayload {
  username: string;
  password: string;
  role?: UserRole;
  status?: string;
}

/**
 * 批量操作载荷
 */
export interface BatchOperationPayload<T = JsonValue> {
  items: T[];
  operation: 'create' | 'update' | 'delete';
  options?: JsonObject;
}

// ============================================================================
// SSE事件类型
// ============================================================================

/**
 * SSE事件回调
 */
export interface SSECallbacks {
  onChunk?: (chunk: string) => void;
  onStatus?: (status: {
    type: string;
    status: StreamStatus;
    moduleName?: string;
    message?: string;
    progress?: number;
  }) => void;
  onInteractive?: (data: any) => void;
  onChatId?: (chatId: string) => void;
  onReasoning?: (data: {
    event: string;
    data: {
      content?: string;
      steps?: any[];
      finished?: boolean;
    };
  }) => void;
  onEvent?: (event: string, data: any) => void;
  onError?: (error: ApiErrorType) => void;
  onComplete?: () => void;
}

/**
 * SSE事件解析结果
 */
export interface SSEParsedEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

// ============================================================================
// API客户端接口
// ============================================================================

/**
 * API客户端接口
 */
export interface ApiClient {
  /**
   * 发送请求
   */
  request<T = JsonValue>(config: ApiRequestConfig, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * GET请求
   */
  get<T = JsonValue>(url: string, config?: Partial<ApiRequestConfig>, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * POST请求
   */
  post<T = JsonValue>(url: string, data?: JsonValue, config?: Partial<ApiRequestConfig>, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * PUT请求
   */
  put<T = JsonValue>(url: string, data?: JsonValue, config?: Partial<ApiRequestConfig>, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * DELETE请求
   */
  delete<T = JsonValue>(url: string, config?: Partial<ApiRequestConfig>, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * PATCH请求
   */
  patch<T = JsonValue>(url: string, data?: JsonValue, config?: Partial<ApiRequestConfig>, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * 流式请求
   */
  stream(url: string, data?: JsonValue, callbacks?: SSECallbacks, options?: ApiRequestOptions): Promise<void>;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 提取API响应的数据类型
 */
export type ApiDataResponse<T> = Omit<ApiSuccessResponse<T>, 'data'> & {
  data: T;
};

/**
 * 提取分页响应的数据类型
 */
export type ApiPaginatedResponse<T> = Omit<ApiSuccessResponse<PaginatedResponse<T>>, 'data'> & {
  data: PaginatedResponse<T>;
};

/**
 * API操作Promise类型
 */
export type ApiPromise<T = JsonValue> = Promise<ApiResult<T>>;

/**
 * 请求ID生成器
 */
export interface RequestIdGenerator {
  generate(): string;
}

/**
 * 请求拦截器
 */
export interface RequestInterceptor {
  onRequest?(config: ApiRequestConfig): ApiRequestConfig | Promise<ApiRequestConfig>;
  onRequestError?(error: unknown): unknown;
}

/**
 * 响应拦截器
 */
export interface ResponseInterceptor {
  onResponse?(response: ApiResponse): ApiResponse | Promise<ApiResponse>;
  onResponseError?(error: ApiErrorType): ApiErrorType | Promise<ApiErrorType>;
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 默认API配置
 */
export const DEFAULT_API_CONFIG: Partial<ApiRequestConfig> = {
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status: number) => status >= 200 && status < 300,
};

/**
 * 默认请求选项
 */
export const DEFAULT_REQUEST_OPTIONS: ApiRequestOptions = {
  skipAuth: false,
  skipErrorHandler: false,
  skipLoading: false,
  cache: false,
  cacheTTL: 300, // 5分钟
};

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: ApiErrorType) => boolean;
  exponentialBackoff?: boolean;
  maxRetryDelay?: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // 秒
  maxSize?: number; // 最大缓存条目数
  strategy?: 'lru' | 'fifo' | 'lfu';
}