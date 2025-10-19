/**
 * API请求类型定义
 */

import type { JsonValue, UnknownValue } from '../index';

// ============================================================================
// 基础请求类型
// ============================================================================

/**
 * 基础API请求接口
 */
export interface BaseApiRequest {
  /** 请求ID */
  requestId?: string;
  /** 时间戳 */
  timestamp?: string;
  /** 版本号 */
  version?: string;
  /** 客户端信息 */
  client?: {
    userAgent?: string;
    platform?: string;
    version?: string;
  };
  /** 用户上下文 */
  userContext?: {
    userId?: string;
    sessionId?: string;
    permissions?: string[];
  };
}

// ============================================================================
// Agent相关请求类型
// ============================================================================

/**
 * 获取智能体列表请求
 */
export interface GetAgentsRequest extends BaseApiRequest {
  /** 分页参数 */
  page?: number;
  pageSize?: number;
  /** 提供商过滤 */
  provider?: string[];
  /** 状态过滤 */
  status?: string[];
  /** 搜索关键词 */
  search?: string;
}

/**
 * 创建智能体请求
 */
export interface CreateAgentRequest extends BaseApiRequest {
  /** 智能体名称 */
  name: string;
  /** 智能体描述 */
  description: string;
  /** 提供商类型 */
  provider: string;
  /** API端点 */
  endpoint: string;
  /** API密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 能力标签 */
  capabilities: string[];
  /** 功能特性 */
  features?: Record<string, UnknownValue>;
}

/**
 * 更新智能体请求
 */
export interface UpdateAgentRequest extends BaseApiRequest {
  /** 智能体ID */
  id: string;
  /** 更新数据 */
  data: Partial<CreateAgentRequest>;
}

/**
 * 删除智能体请求
 */
export interface DeleteAgentRequest extends BaseApiRequest {
  /** 智能体ID */
  id: string;
  /** 是否强制删除 */
  force?: boolean;
}

// ============================================================================
// Chat相关请求类型
// ============================================================================

/**
 * 聊天请求
 */
export interface ChatRequest extends BaseApiRequest {
  /** 智能体ID */
  agentId: string;
  /** 消息列表 */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
  /** 是否流式响应 */
  stream?: boolean;
  /** 聊天选项 */
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  };
  /** 会话ID */
  sessionId?: string;
  /** 变量替换 */
  variables?: Record<string, JsonValue>;
  /** 附件列表 */
  attachments?: Array<{
    id: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
  }>;
}

/**
 * 流式聊天请求
 */
export interface StreamChatRequest extends ChatRequest {
  /** 流式响应配置 */
  streamConfig?: {
    /** 是否启用状态事件 */
    enableStatusEvents?: boolean;
    /** 是否启用流程节点状态 */
    enableFlowNodeStatus?: boolean;
    /** 心跳间隔（毫秒） */
    heartbeatInterval?: number;
  };
}

// ============================================================================
// Session相关请求类型
// ============================================================================

/**
 * 获取会话列表请求
 */
export interface GetSessionsRequest extends BaseApiRequest {
  /** 分页参数 */
  page?: number;
  pageSize?: number;
  /** 智能体ID过滤 */
  agentId?: string;
  /** 状态过滤 */
  status?: string[];
  /** 时间范围过滤 */
  dateRange?: {
    start: string;
    end: string;
  };
  /** 搜索关键词 */
  search?: string;
}

/**
 * 创建会话请求
 */
export interface CreateSessionRequest extends BaseApiRequest {
  /** 智能体ID */
  agentId: string;
  /** 会话标题 */
  title?: string;
  /** 初始消息 */
  initialMessage?: string;
  /** 会话设置 */
  settings?: Record<string, UnknownValue>;
}

/**
 * 更新会话请求
 */
export interface UpdateSessionRequest extends BaseApiRequest {
  /** 会话ID */
  sessionId: string;
  /** 更新数据 */
  data: {
    title?: string;
    settings?: Record<string, UnknownValue>;
    metadata?: Record<string, UnknownValue>;
  };
}

// ============================================================================
// User相关请求类型
// ============================================================================

/**
 * 用户登录请求
 */
export interface LoginRequest extends BaseApiRequest {
  /** 用户名或邮箱 */
  username: string;
  /** 密码 */
  password: string;
  /** 记住我 */
  rememberMe?: boolean;
  /** 双因素认证码 */
  twoFactorCode?: string;
}

/**
 * 用户注册请求
 */
export interface RegisterRequest extends BaseApiRequest {
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
  /** 确认密码 */
  confirmPassword: string;
  /** 显示名称 */
  displayName?: string;
  /** 邀请码 */
  inviteCode?: string;
}

/**
 * 更新用户信息请求
 */
export interface UpdateUserRequest extends BaseApiRequest {
  /** 用户ID */
  userId: string;
  /** 更新数据 */
  data: {
    displayName?: string;
    avatar?: string;
    preferences?: Record<string, UnknownValue>;
    metadata?: Record<string, UnknownValue>;
  };
}