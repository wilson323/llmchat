/**
 * API响应类型定义
 */

import type { JsonValue } from '../index';

// ============================================================================
// 基础响应类型
// ============================================================================

/**
 * 基础API响应接口
 */
export interface BaseApiResponse {
  /** 响应码 */
  code: string;
  /** 响应消息 */
  message: string;
  /** 响应时间戳 */
  timestamp: string;
  /** 请求ID */
  requestId?: string;
  /** 响应元数据 */
  metadata?: {
    version: string;
    duration?: number;
    server?: string;
  };
}

// ============================================================================
// 成功响应类型
// ============================================================================

/**
 * 通用成功响应
 */
export interface SuccessResponse<T = JsonValue> extends BaseApiResponse {
  /** 响应数据 */
  data: T;
  /** 是否成功 */
  success: true;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Agent相关响应类型
// ============================================================================

/**
 * 获取智能体列表响应
 */
export interface GetAgentsResponse extends SuccessResponse {
  data: Array<{
    id: string;
    name: string;
    description: string;
    avatar?: string;
    model: string;
    status: string;
    capabilities: string[];
    provider: string;
    isActive: boolean;
    workspaceType?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * 创建智能体响应
 */
export interface CreateAgentResponse extends SuccessResponse {
  data: {
    id: string;
    name: string;
    description: string;
    provider: string;
    model: string;
    status: string;
    createdAt: string;
  };
}

/**
 * 智能体健康检查响应
 */
export interface AgentHealthResponse extends SuccessResponse {
  data: {
    agentId: string;
    status: string;
    responseTime?: number;
    lastChecked: string;
    error?: string;
    consecutiveFailures?: number;
    successRate?: number;
  };
}

// ============================================================================
// Chat相关响应类型
// ============================================================================

/**
 * 聊天响应
 */
export interface ChatResponse extends SuccessResponse {
  data: {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      index: number;
      message: {
        role: string;
        content: string;
      };
      finishReason: string;
    }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

/**
 * 流式聊天响应
 */
export interface StreamChatResponse {
  /** 事件类型 */
  event: string;
  /** 数据 */
  data: string;
  /** 事件ID */
  id?: string;
  /** 重试时间 */
  retry?: number;
}

// ============================================================================
// Session相关响应类型
// ============================================================================

/**
 * 获取会话列表响应
 */
export interface GetSessionsResponse extends SuccessResponse {
  data: Array<{
    id: string;
    title: string;
    agentId: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    lastAccessedAt?: number;
    isPinned: boolean;
    tags?: string[];
    isArchived: boolean;
  }>;
}

/**
 * 创建会话响应
 */
export interface CreateSessionResponse extends SuccessResponse {
  data: {
    id: string;
    title: string;
    agentId: string;
    createdAt: string;
    sessionId: string;
  };
}

// ============================================================================
// User相关响应类型
// ============================================================================

/**
 * 登录响应
 */
export interface LoginResponse extends SuccessResponse {
  data: {
    user: {
      id: string;
      username: string;
      email: string;
      displayName?: string;
      avatar?: string;
      role: string;
      permissions: string[];
    };
    token: {
      accessToken: string;
      refreshToken?: string;
      tokenType: string;
      expiresIn: number;
    };
    session: {
      sessionId: string;
      expiresAt: string;
    };
  };
}

/**
 * 注册响应
 */
export interface RegisterResponse extends SuccessResponse {
  data: {
    user: {
      id: string;
      username: string;
      email: string;
      displayName?: string;
      role: string;
      status: string;
    };
    requiresEmailVerification: boolean;
    requiresAdminApproval: boolean;
  };
}

// ============================================================================
// 错误响应类型
// ============================================================================

/**
 * 错误响应
 */
export interface ErrorResponse extends BaseApiResponse {
  /** 是否成功 */
  success: false;
  /** 错误码 */
  errorCode?: string;
  /** 错误详情 */
  details?: JsonValue;
  /** 错误堆栈 */
  stack?: string;
}

/**
 * 验证错误响应
 */
export interface ValidationErrorResponse extends ErrorResponse {
  /** 验证错误详情 */
  validationErrors: Array<{
    field: string;
    message: string;
    code: string;
    value?: JsonValue;
  }>;
}

/**
 * 认证错误响应
 */
export interface AuthErrorResponse extends ErrorResponse {
  /** 认证错误类型 */
  authErrorType: 'invalid_credentials' | 'token_expired' | 'access_denied' | 'account_locked';
  /** 重试延迟（秒） */
  retryAfter?: number;
  /** 剩余尝试次数 */
  remainingAttempts?: number;
}