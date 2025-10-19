/**
 * Anthropic提供商类型定义
 */

import type { JsonValue } from '../index';

// ============================================================================
// Anthropic特定类型
// ============================================================================

/**
 * Anthropic配置
 */
export interface AnthropicConfig {
  /** API密钥 */
  apiKey: string;
  /** 基础URL */
  baseURL?: string;
  /** 默认模型 */
  model?: string;
  /** API版本 */
  version?: string;
}

/**
 * Anthropic聊天请求
 */
export interface AnthropicChatRequest {
  /** 模型 */
  model: string;
  /** 最大令牌数 */
  maxTokens: number;
  /** 消息列表 */
  messages: AnthropicMessage[];
  /** 系统 */
  system?: string;
  /** 温度 */
  temperature?: number;
  /** 停止序列 */
  stopSequences?: string[];
  /** 流式响应 */
  stream?: boolean;
  /** 元数据 */
  metadata?: {
    userId?: string | undefined;
    sessionId?: string | undefined;
    [key: string]: JsonValue | undefined;
  };
}

/**
 * Anthropic消息
 */
export interface AnthropicMessage {
  /** 角色 */
  role: 'user' | 'assistant';
  /** 内容 */
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

/**
 * Anthropic响应
 */
export interface AnthropicResponse {
  /** 响应ID */
  id: string;
  /** 对象类型 */
  type: string;
  /** 角色 */
  role: string;
  /** 内容 */
  content: Array<{
    type: string;
    text?: string;
  }>;
  /** 停止原因 */
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  /** 停止序列 */
  stopSequence?: string;
  /** 模型 */
  model: string;
  /** 使用情况 */
  usage: AnthropicUsage;
}

/**
 * Anthropic使用情况
 */
export interface AnthropicUsage {
  /** 输入令牌数 */
  inputTokens: number;
  /** 输出令牌数 */
  outputTokens: number;
}