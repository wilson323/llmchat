/**
 * 基础提供商类型定义
 */

import type { JsonValue, AgentFeatures, MessageStatus } from '../index';

// ============================================================================
// 基础提供商接口
// ============================================================================

/**
 * 基础提供商接口
 */
export interface BaseProvider {
  /** 提供商类型 */
  type: string;
  /** 提供商名称 */
  name: string;
  /** 提供商版本 */
  version: string;
  /** 支持的功能 */
  features: ProviderFeatures;
  /** 配置验证 */
  validateConfig(config: unknown): ProviderValidationResult;
  /** 请求转换 */
  transformRequest(request: ChatRequest): ProviderRequest;
  /** 响应转换 */
  transformResponse(response: unknown, request: ChatRequest): ChatResponse;
}

/**
 * 提供商功能特性
 */
export interface ProviderFeatures {
  /** 是否支持聊天 */
  supportsChat: boolean;
  /** 是否支持流式响应 */
  supportsStream: boolean;
  /** 是否支持文件上传 */
  supportsFiles: boolean;
  /** 是否支持图片处理 */
  supportsImages: boolean;
  /** 是否支持语音输入 */
  supportsVoice: boolean;
  /** 是否支持函数调用 */
  supportsFunctions: boolean;
  /** 是否支持工具调用 */
  supportsTools: boolean;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 支持的模型列表 */
  supportedModels?: string[];
  /** 自定义功能 */
  customFeatures?: Record<string, boolean | string | number>;
}

// ============================================================================
// 聊天相关类型
// ============================================================================

/**
 * 标准聊天请求
 */
export interface ChatRequest {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 模型配置 */
  model: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 停止词 */
  stop?: string[];
  /** Top P */
  topP?: number;
  /** 频率惩罚 */
  frequencyPenalty?: number;
  /** 存在惩罚 */
  presencePenalty?: number;
  /** 是否流式响应 */
  stream?: boolean;
  /** 用户标识 */
  user?: string;
  /** 会话ID */
  sessionId?: string;
  /** 自定义参数 */
  custom?: Record<string, JsonValue>;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  /** 消息内容 */
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    image?: {
      url: string;
      detail?: 'low' | 'high';
    };
  }>;
  /** 消息名称 */
  name?: string;
  /** 函数调用 */
  function_call?: {
    name: string;
    arguments: string;
  };
  /** 工具调用 */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  /** 工具调用响应 */
  tool_call_id?: string;
  /** 自定义数据 */
  custom?: Record<string, JsonValue>;
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  /** 响应ID */
  id: string;
  /** 对象类型 */
  object: string;
  /** 创建时间 */
  created: number;
  /** 使用的模型 */
  model: string;
  /** 选择列表 */
  choices: ChatChoice[];
  /** 使用情况 */
  usage?: ChatUsage;
  /** 响应时间 */
  responseTime?: number;
  /** 自定义数据 */
  custom?: Record<string, JsonValue>;
}

/**
 * 聊天选择
 */
export interface ChatChoice {
  /** 选择索引 */
  index: number;
  /** 消息 */
  message: ChatMessage;
  /** 完成原因 */
  finishReason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  /** 日机率 */
  logprobs?: any;
}

/**
 * 使用情况
 */
export interface ChatUsage {
  /** 提示令牌数 */
  promptTokens: number;
  /** 完成令牌数 */
  completionTokens: number;
  /** 总令牌数 */
  totalTokens: number;
}

// ============================================================================
// 提供商请求/响应类型
// ============================================================================

/**
 * 提供商请求
 */
export interface ProviderRequest {
  /** 请求URL */
  url: string;
  /** 请求方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** 请求头 */
  headers: Record<string, string>;
  /** 请求体 */
  body?: string | Record<string, JsonValue>;
  /** 查询参数 */
  params?: Record<string, string>;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试配置 */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * 提供商响应
 */
export interface ProviderResponse {
  /** 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 响应体 */
  data: JsonValue;
  /** 响应时间 */
  responseTime: number;
}

// ============================================================================
// 流式响应类型
// ============================================================================

/**
 * 流式事件
 */
export interface StreamEvent {
  /** 事件类型 */
  event: string;
  /** 事件数据 */
  data: string;
  /** 事件ID */
  id?: string;
  /** 重试时间 */
  retry?: number;
}

/**
 * 流式块
 */
export interface StreamChunk {
  /** 块ID */
  id: string;
  /** 块类型 */
  type: 'content' | 'metadata' | 'error' | 'status';
  /** 块内容 */
  content?: string;
  /** 块索引 */
  index?: number;
  /** 是否完成 */
  finished?: boolean;
  /** 错误信息 */
  error?: string;
  /** 元数据 */
  metadata?: Record<string, JsonValue>;
}

// ============================================================================
// 验证和配置类型
// ============================================================================

/**
 * 提供商验证结果
 */
export interface ProviderValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: ProviderValidationError[];
  /** 警告列表 */
  warnings: ProviderValidationWarning[];
}

/**
 * 验证错误
 */
export interface ProviderValidationError {
  /** 字段路径 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code: string;
  /** 错误值 */
  value?: unknown;
}

/**
 * 验证警告
 */
export interface ProviderValidationWarning {
  /** 字段路径 */
  field: string;
  /** 警告消息 */
  message: string;
  /** 警告代码 */
  code: string;
  /** 警告值 */
  value?: unknown;
}

/**
 * 提供商配置
 */
export interface ProviderConfig {
  /** API端点 */
  endpoint: string;
  /** API密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 超时时间 */
  timeout?: number;
  /** 重试配置 */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
  /** 自定义配置 */
  custom?: Record<string, JsonValue>;
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * 提供商工厂接口
 */
export interface ProviderFactory {
  /** 创建提供商实例 */
  create(config: ProviderConfig): BaseProvider;
  /** 获取支持的提供商类型 */
  getSupportedTypes(): string[];
  /** 验证配置 */
  validateConfig(config: unknown): ProviderValidationResult;
}

/**
 * 提供商管理器接口
 */
export interface ProviderManager {
  /** 注册提供商 */
  register(type: string, factory: ProviderFactory): void;
  /** 获取提供商 */
  get(type: string): ProviderFactory | undefined;
  /** 获取所有提供商类型 */
  getTypes(): string[];
  /** 创建提供商实例 */
  create(type: string, config: ProviderConfig): BaseProvider;
}

/**
 * 提供商工具类
 */
export class ProviderUtils {
  /**
   * 转换消息格式
   */
  static transformMessages(messages: ChatMessage[], targetFormat: 'openai' | 'anthropic' | 'custom'): any[] {
    switch (targetFormat) {
      case 'openai':
        return messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          name: msg.name,
          ...(msg.function_call && { function_call: msg.function_call }),
          ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id })
        }));
      default:
        return messages;
    }
  }

  /**
   * 计算令牌数量（估算）
   */
  static estimateTokens(text: string, model: string = 'gpt-3.5-turbo'): number {
    // 简单的令牌估算：大约每4个字符一个令牌
    // 实际实现应该使用具体的tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * 格式化错误消息
   */
  static formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  /**
   * 生成请求ID
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}