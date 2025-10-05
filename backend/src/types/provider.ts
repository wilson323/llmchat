/**
 * AI 提供商响应类型定义
 * 
 * 定义各个 AI 提供商的原始响应格式，用于替换 any 类型
 */

import type { JsonValue } from './index';

// ============================================================================
// FastGPT 响应类型
// ============================================================================

export interface FastGPTChoice {
  index: number;
  message?: {
    role: string;
    content: string;
  };
  delta?: {
    content?: string;
  };
  finish_reason?: string;
}

export interface FastGPTResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: FastGPTChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface FastGPTStreamChunk {
  choices?: Array<{
    index?: number;
    delta?: {
      content?: string;
      role?: string;
    };
    finish_reason?: string | null;
  }>;
}

// ============================================================================
// OpenAI 响应类型
// ============================================================================

export interface OpenAIChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      content?: string;
      role?: string;
    };
    finish_reason?: string | null;
  }>;
}

// ============================================================================
// Anthropic 响应类型
// ============================================================================

export interface AnthropicContent {
  type: 'text';
  text: string;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicStreamChunk {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_start' | 'message_delta' | 'message_stop';
  index?: number;
  delta?: {
    type?: 'text_delta';
    text?: string;
  };
  content_block?: AnthropicContent;
  message?: Partial<AnthropicResponse>;
}

// ============================================================================
// Dify 响应类型
// ============================================================================

export interface DifyFile {
  type: string;
  transfer_method: 'remote_url' | 'local_file';
  url: string;
}

export interface DifyResponse {
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  created_at: number;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      prompt_unit_price?: string;
      prompt_price_unit?: string;
      prompt_price?: string;
      completion_unit_price?: string;
      completion_price_unit?: string;
      completion_price?: string;
      total_price?: string;
      currency?: string;
      latency?: number;
    };
    retriever_resources?: Array<{
      position: number;
      dataset_id: string;
      dataset_name: string;
      document_id: string;
      document_name: string;
      segment_id: string;
      score: number;
      content: string;
    }>;
  };
}

export interface DifyStreamChunk {
  event: 'message' | 'message_end' | 'message_file' | 'error' | 'ping' | 'agent_thought' | 'agent_message';
  id?: string;
  conversation_id?: string;
  message_id?: string;
  answer?: string;
  created_at?: number;
  // message_file 事件字段
  type?: string;
  url?: string;
  belongs_to?: string;
  // error 事件字段
  status?: number;
  code?: string;
  message?: string;
  // message_end 事件字段
  metadata?: DifyResponse['metadata'];
}

// ============================================================================
// 通用提供商响应类型
// ============================================================================

/**
 * 通用提供商响应联合类型
 */
export type ProviderResponse = FastGPTResponse | OpenAIResponse | AnthropicResponse | DifyResponse;

/**
 * 通用提供商流式响应联合类型
 */
export type ProviderStreamChunk = FastGPTStreamChunk | OpenAIStreamChunk | AnthropicStreamChunk | DifyStreamChunk;

/**
 * SSE 事件数据类型
 */
export type SSEEventData = Record<string, JsonValue> | string | null;

/**
 * 推理数据提取结果
 */
export type ReasoningPayload = Record<string, JsonValue> | string | null;
