/**
 * FastGPT提供商类型定义
 */

import type { JsonValue } from '../index';

// ============================================================================
// FastGPT特定类型
// ============================================================================

/**
 * FastGPT配置
 */
export interface FastGPTConfig {
  /** API端点 */
  endpoint: string;
  /** API密钥 */
  apiKey: string;
  /** 应用ID */
  appId: string;
  /** 模型名称 */
  model?: string;
  /** 基础URL */
  baseUrl?: string;
}

/**
 * FastGPT聊天请求
 */
export interface FastGPTChatRequest {
  /** 消息列表 */
  messages: FastGPTMessage[];
  /** 应用ID */
  appId?: string;
  /** 流式响应 */
  stream?: boolean;
  /** 详细的响应 */
  detail?: boolean;
  /** 变量替换 */
  variables?: Record<string, JsonValue>;
  /** 响应消息ID */
  responseChatItemId?: string;
}

/**
 * FastGPT消息
 */
export interface FastGPTMessage {
  /** 消息内容 */
  content: string;
  /** 消息角色 */
  role?: string;
}

/**
 * FastGPT响应
 */
export interface FastGPTResponse {
  /** 响应ID */
  id: string;
  /** 对象类型 */
  object: string;
  /** 创建时间 */
  created: number;
  /** 模型 */
  model: string;
  /** 选择列表 */
  choices: FastGPTChoice[];
}

/**
 * FastGPT选择
 */
export interface FastGPTChoice {
  /** 索引 */
  index: number;
  /** 消息 */
  message: {
    content: string;
    role: string;
  };
  /** 完成原因 */
  finishReason: string;
}