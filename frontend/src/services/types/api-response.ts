/**
 * 统一API响应类型定义
 *
 * 提供项目内部所有API服务的标准响应类型定义
 * 确保前后端API接口类型的一致性和类型安全
 */

import type { JsonValue } from '@llmchat/shared-types';

// ============================================================================
// 标准API响应类型
// ============================================================================

/**
 * 标准化API响应接口
 */
export interface StandardApiResponse<T = JsonValue> {
  data: T;
  requestId: string;
  timestamp: string;
  metadata?: {
    duration?: number;
    [key: string]: unknown;
  };
}

/**
 * 分页数据包装器
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
 * 错误响应接口
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: JsonValue;
  timestamp: string;
  requestId?: string;
}

// ============================================================================
// API操作结果类型
// ============================================================================

/**
 * API操作结果类型
 */
export interface ApiOperationResult<T = JsonValue> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  metadata?: {
    requestId?: string;
    duration?: number;
    timestamp?: string;
    cached?: boolean;
  };
}

/**
 * 成功的API操作结果
 */
export type ApiSuccessResult<T = JsonValue> = Omit<ApiOperationResult<T>, 'error'> & {
  success: true;
  data: T;
};

/**
 * 失败的API操作结果
 */
export type ApiErrorResult = Omit<ApiOperationResult, 'data'> & {
  success: false;
  error: ErrorResponse;
};

// ============================================================================
// HTTP相关类型
// ============================================================================

/**
 * HTTP方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API请求配置
 */
export interface ApiRequestConfig {
  method?: HttpMethod;
  url: string;
  params?: Record<string, unknown>;
  data?: JsonValue;
  headers?: Record<string, string>;
  timeout?: number;
}

// ============================================================================
// 特定业务类型
// ============================================================================

/**
 * 智能体状态
 */
export type AgentStatus = 'active' | 'inactive' | 'error' | 'loading';

/**
 * 用户角色
 */
export type UserRole = 'admin' | 'user' | 'guest';

/**
 * 日志级别
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

// ============================================================================
// 导出类型别名（向后兼容）
// ============================================================================

/**
 * 向后兼容的API响应类型别名
 */
export type ApiResponse<T = JsonValue> = StandardApiResponse<T>;

/**
 * 向后兼容的API结果类型别名
 */
export type ApiResult<T = JsonValue> = ApiOperationResult<T>;