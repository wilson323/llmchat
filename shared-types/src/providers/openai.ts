/**
 * OpenAI提供商类型定义
 */

import type { JsonValue } from '../index';

// ============================================================================
// OpenAI特定类型
// ============================================================================

/**
 * OpenAI配置
 */
export interface OpenAIConfig {
  /** API密钥 */
  apiKey: string;
  /** 组织ID */
  organization?: string;
  /** 基础URL */
  baseURL?: string;
  /** API版本 */
  apiVersion?: string;
  /** 默认模型 */
  model?: string;
}

/**
 * OpenAI聊天请求
 */
export interface OpenAIChatRequest {
  /** 消息列表 */
  messages: OpenAIMessage[];
  /** 模型 */
  model: string;
  /** 温度 */
  temperature?: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 流式响应 */
  stream?: boolean;
  /** 停止词 */
  stop?: string[] | string;
  /** 随机种子 */
  seed?: number;
  /** 用户标识 */
  user?: string;
}

/**
 * OpenAI消息
 */
export interface OpenAIMessage {
  /** 角色 */
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  /** 内容 */
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high';
    };
  }>;
  /** 名称 */
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
}

/**
 * OpenAI响应
 */
export interface OpenAIResponse {
  /** 响应ID */
  id: string;
  /** 对象类型 */
  object: string;
  /** 创建时间 */
  created: number;
  /** 模型 */
  model: string  ;
  /** 选择列表 */
  choices: OpenAIChoice[];
  /** 使用情况 */
  usage?: OpenAIUsage;
}

/**
 * OpenAI选择
 */
export interface OpenAIChoice {
  /** 索引 */
  index: number;
  /** 消息 */
  message: OpenAIMessage;
  /** 完成原因 */
  finishReason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
}

/**
 * OpenAI使用情况
 */
export interface OpenAIUsage {
  /** 提示令牌数 */
  promptTokens: number;
  /** 完成令牌数 */
  completionTokens: number;
  /** 总令牌数 */
  totalTokens: number;
}