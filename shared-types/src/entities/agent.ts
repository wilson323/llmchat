/**
 * 智能体相关核心实体类型定义
 *
 * 提供统一的智能体类型定义，支持前后端共享使用
 */

import type { JsonValue, RateLimit } from '../index';

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 智能体提供商类型
 */
export type ProviderType =
  | 'fastgpt'
  | 'openai'
  | 'anthropic'
  | 'dify'
  | 'dashscope'
  | 'custom';

/**
 * 智能体状态
 */
export type AgentStatus =
  | 'active'      // 活跃状态
  | 'inactive'    // 非活跃状态
  | 'error'       // 错误状态
  | 'loading'     // 加载中状态
  | 'maintenance'; // 维护状态

/**
 * 工作区类型
 */
export type WorkspaceType =
  | 'chat'              // 标准聊天界面
  | 'product-preview'   // 产品现场预览
  | 'voice-call'        // 语音对话
  | 'cad-analysis'      // CAD分析
  | 'custom';           // 自定义扩展

/**
 * 智能体能力标签
 */
export type AgentCapability =
  | 'text-generation'   // 文本生成
  | 'code-generation'   // 代码生成
  | 'image-analysis'    // 图像分析
  | 'file-processing'   // 文件处理
  | 'voice-support'     // 语音支持
  | 'streaming'         // 流式响应
  | 'interactive'       // 交互式对话
  | 'reasoning'         // 推理能力
  | 'cad-parsing'       // CAD文件解析
  | '3d-analysis';      // 3D分析

// ============================================================================
// 核心实体接口
// ============================================================================

/**
 * 智能体功能特性配置
 */
export interface AgentFeatures {
  /** 是否支持聊天ID */
  supportsChatId: boolean;
  /** 是否支持流式响应 */
  supportsStream: boolean;
  /** 是否支持详细信息 */
  supportsDetail: boolean;
  /** 是否支持文件上传 */
  supportsFiles: boolean;
  /** 是否支持图片处理 */
  supportsImages: boolean;
  /** 流式配置 */
  streamingConfig: {
    /** 是否启用流式 */
    enabled: boolean;
    /** 流式端点类型 */
    endpoint: 'same' | 'different';
    /** 是否支持状态事件 */
    statusEvents: boolean;
    /** 是否支持流程节点状态 */
    flowNodeStatus: boolean;
  };
  /** 交互功能 */
  interactiveFeatures?: {
    /** 支持用户选择 */
    supportsUserSelect: boolean;
    /** 支持用户输入 */
    supportsUserInput: boolean;
    /** 支持表单交互 */
    supportsFormInteraction: boolean;
  };
  /** 推理功能 */
  reasoningFeatures?: {
    /** 是否支持推理步骤显示 */
    supportsReasoningSteps: boolean;
    /** 是否支持推理状态更新 */
    supportsReasoningUpdates: boolean;
  };
}

/**
 * 简化的智能体信息（用于前端显示和列表）
 */
export interface Agent {
  /** 智能体唯一标识 */
  id: string;
  /** 智能体名称 */
  name: string;
  /** 智能体描述 */
  description: string;
  /** 智能体头像URL */
  avatar?: string;
  /** 使用的模型名称 */
  model: string;
  /** 智能体状态 */
  status: AgentStatus;
  /** 能力标签列表 */
  capabilities: AgentCapability[];
  /** 提供商类型 */
  provider: ProviderType;
  /** 是否激活 */
  isActive: boolean;
  /** 工作区类型 */
  workspaceType?: WorkspaceType;
  /** 最后检查时间 */
  lastChecked?: string;
  /** 响应时间（毫秒） */
  responseTime?: number;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 完整的智能体配置（用于管理后台和批量操作）
 */
export interface AgentConfig extends Agent {
  /** API端点URL */
  endpoint: string;
  /** API密钥 */
  apiKey: string;
  /** FastGPT应用ID（仅FastGPT需要） */
  appId?: string;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 速率限制配置 */
  rateLimit?: RateLimit;
  /** 功能特性配置 */
  features: AgentFeatures;
  /** 自定义类型标识 */
  type?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 创建者ID */
  createdBy?: string;
  /** 更新者ID */
  updatedBy?: string;
  /** 版本号 */
  version?: string;
  /** 配置标签 */
  tags?: string[];
  /** 自定义元数据 */
  metadata?: Record<string, JsonValue>;
}

/**
 * 智能体健康状态信息
 */
export interface AgentHealthStatus {
  /** 智能体ID */
  agentId: string;
  /** 当前状态 */
  status: AgentStatus;
  /** 响应时间（毫秒） */
  responseTime?: number;
  /** 最后检查时间 */
  lastChecked: string;
  /** 错误信息（如果有） */
  error?: string;
  /** 连续失败次数 */
  consecutiveFailures?: number;
  /** 总成功次数 */
  totalSuccesses?: number;
  /** 总失败次数 */
  totalFailures?: number;
  /** 成功率 */
  successRate?: number;
  /** 平均响应时间 */
  averageResponseTime?: number;
  /** 健康检查端点 */
  healthEndpoint?: string;
}

/**
 * 智能体使用统计
 */
export interface AgentUsageStats {
  /** 智能体ID */
  agentId: string;
  /** 统计时间段 */
  period: {
    start: string;
    end: string;
  };
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 总令牌消耗 */
  totalTokens: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 使用用户数 */
  uniqueUsers: number;
  /** 按日期分组的统计 */
  dailyStats?: Array<{
    date: string;
    requests: number;
    tokens: number;
    users: number;
  }>;
}

/**
 * 智能体创建请求
 */
export interface CreateAgentRequest {
  /** 智能体名称 */
  name: string;
  /** 智能体描述 */
  description: string;
  /** 提供商类型 */
  provider: ProviderType;
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
  capabilities: AgentCapability[];
  /** 工作区类型 */
  workspaceType?: WorkspaceType;
  /** 功能特性 */
  features?: Partial<AgentFeatures>;
  /** 速率限制 */
  rateLimit?: RateLimit;
  /** 自定义元数据 */
  metadata?: Record<string, JsonValue>;
  /** 标签 */
  tags?: string[];
}

/**
 * 智能体更新请求
 */
export interface UpdateAgentRequest {
  /** 智能体名称 */
  name?: string;
  /** 智能体描述 */
  description?: string;
  /** API端点 */
  endpoint?: string;
  /** API密钥 */
  apiKey?: string;
  /** 模型名称 */
  model?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 能力标签 */
  capabilities?: AgentCapability[];
  /** 是否激活 */
  isActive?: boolean;
  /** 工作区类型 */
  workspaceType?: WorkspaceType;
  /** 功能特性 */
  features?: Partial<AgentFeatures>;
  /** 速率限制 */
  rateLimit?: RateLimit;
  /** 自定义元数据 */
  metadata?: Record<string, JsonValue>;
  /** 标签 */
  tags?: string[];
  /** 版本号 */
  version?: string;
}

/**
 * 智能体查询参数
 */
export interface AgentQueryParams {
  /** 分页参数 */
  page?: number;
  pageSize?: number;
  /** 提供商过滤 */
  provider?: ProviderType[];
  /** 状态过滤 */
  status?: AgentStatus[];
  /** 能力过滤 */
  capabilities?: AgentCapability[];
  /** 工作区类型过滤 */
  workspaceType?: WorkspaceType[];
  /** 搜索关键词 */
  search?: string;
  /** 是否激活过滤 */
  isActive?: boolean;
  /** 标签过滤 */
  tags?: string[];
  /** 排序字段 */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status' | 'responseTime';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 智能体批量操作请求
 */
export interface BatchAgentOperation {
  /** 操作类型 */
  operation: 'activate' | 'deactivate' | 'delete' | 'update' | 'test';
  /** 智能体ID列表 */
  agentIds: string[];
  /** 更新数据（仅用于update操作） */
  updateData?: Partial<UpdateAgentRequest>;
  /** 操作原因 */
  reason?: string;
}

/**
 * 智能体测试请求
 */
export interface TestAgentRequest {
  /** 智能体配置 */
  config: AgentConfig;
  /** 测试消息 */
  testMessage: string;
  /** 测试选项 */
  options?: {
    /** 是否启用流式测试 */
    stream?: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 是否包含详细信息 */
    detail?: boolean;
  };
}

/**
 * 智能体测试响应
 */
export interface TestAgentResponse {
  /** 测试是否成功 */
  success: boolean;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** AI回复内容 */
  response?: string;
  /** 错误信息 */
  error?: string;
  /** 测试时间戳 */
  timestamp: string;
  /** 使用的令牌数 */
  tokensUsed?: number;
  /** 测试详情 */
  details?: {
    /** 请求详情 */
    request: Record<string, JsonValue>;
    /** 响应详情 */
    response: Record<string, JsonValue>;
  };
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 智能体配置验证结果
 */
export interface AgentConfigValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 警告列表 */
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 验证时间戳 */
  timestamp: string;
}

/**
 * 智能体导入/导出格式
 */
export interface AgentExportFormat {
  /** 导出版本 */
  version: string;
  /** 导出时间 */
  exportedAt: string;
  /** 智能体列表 */
  agents: AgentConfig[];
  /** 导出元数据 */
  metadata: {
    exportedBy?: string;
    totalCount: number;
    providers: ProviderType[];
    tags?: string[];
  };
}

/**
 * 智能体配置模板
 */
export interface AgentConfigTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 提供商类型 */
  provider: ProviderType;
  /** 默认配置 */
  defaultConfig: Partial<AgentConfig>;
  /** 必需字段 */
  requiredFields: (keyof AgentConfig)[];
  /** 可选字段 */
  optionalFields: (keyof AgentConfig)[];
  /** 验证规则 */
  validationRules: Array<{
    field: keyof AgentConfig;
    rule: string;
    message: string;
  }>;
  /** 模板版本 */
  version: string;
  /** 创建时间 */
  createdAt: string;
  /** 是否为系统模板 */
  isSystem: boolean;
}