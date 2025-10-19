/**
 * Dify提供商类型定义
 */

import type { JsonValue } from '../index';

// ============================================================================
// Dify特定类型
// ============================================================================

/**
 * Dify配置
 */
export interface DifyConfig {
  /** API端点 */
  endpoint: string;
  /** API密钥 */
  apiKey: string;
  /** 应用ID */
  appId?: string;
  /** 基础URL */
  baseUrl?: string;
}

/**
 * Dify聊天请求
 */
export interface DifyChatRequest {
  /** 查询 */
  query: string;
  /** 用户ID */
  userId: string;
  /** 对话ID */
  conversationId?: string;
  /** 流式响应 */
  stream?: boolean;
  /** 文件列表 */
  files?: Array<{
    type: string;
    transferMethod: string;
    url: string;
  }>;
  /** 自动生成名称 */
  autoGenerateName?: boolean;
  /** 变量 */
  variables?: Record<string, JsonValue>;
}

/**
 * Dify响应
 */
export interface DifyResponse {
  /** 对话ID */
  conversationId: string;
  /** 消息ID */
  messageId: string;
  /** 任务ID */
  taskId: string;
  /** 答案 */
  answer: string;
  /** 创建时间 */
  createdAt: number;
  /** 元数据 */
  metadata?: {
    usage?: {
      promptTokens: number;
      promptUnitPrice: string;
      completionTokens: number;
      completionUnitPrice: string;
      currency: string;
      totalPrice: string;
    };
    retrieverResources?: any[];
  };
}