/**
 * 阿里云 DashScope API 服务
 *
 * 封装通义千问系列模型的 API 调用
 * 支持标准 OpenAI 兼容接口和 Function Calling
 */

import axios, { type AxiosInstance } from 'axios';
import { createErrorFromUnknown } from '@/types/errors';
import type { ChatMessage, ChatOptions } from '@/types';
import type { CadFunctionTool } from '@llmchat/shared-types';
import logger from '@/utils/logger';

// ==================== 常量定义 ====================

const DEFAULT_MODEL = 'qwen-max';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 8000;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const STREAM_DATA_PREFIX = 'data: ';
const STREAM_DONE_MARKER = '[DONE]';
const SLICE_LENGTH = 6;

export interface DashScopeConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeout?: number;
}

export interface DashScopeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DashScopeRequest {
  model: string;
  messages: DashScopeMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: CadFunctionTool[];
  tool_choice?: 'auto' | 'none';
}

export interface DashScopeFunctionCall {
  name: string;
  arguments: string;
}

export interface DashScopeChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: DashScopeFunctionCall;
    }>;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls';
}

export interface DashScopeResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: DashScopeChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * DashScope 服务类
 */
export class DashScopeService {
  private readonly client: AxiosInstance;
  private readonly config: Required<DashScopeConfig>;

  constructor(config: DashScopeConfig) {
    this.config = {
      model: config.model ?? DEFAULT_MODEL,
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      apiKey: config.apiKey,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info('[DashScopeService] 初始化成功', {
      model: this.config.model,
      baseURL: this.config.baseURL,
    });
  }

  /**
   * 发送聊天请求（非流式）
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatOptions & { tools?: CadFunctionTool[] },
  ): Promise<DashScopeResponse> {
    const request: DashScopeRequest = {
      model: this.config.model,
      messages: this.transformMessages(messages),
      stream: false,
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    // 添加工具定义（Function Calling）
    if (options?.tools && options.tools.length > 0) {
      request.tools = options.tools;
      request.tool_choice = 'auto';
    }

    try {
      logger.debug('[DashScopeService] 发送请求', {
        model: request.model,
        messageCount: messages.length,
        hasTools: !!request.tools,
      });

      const response = await this.client.post<DashScopeResponse>(
        '/chat/completions',
        request,
      );

      logger.info('[DashScopeService] 请求成功', {
        model: response.data.model,
        finishReason: response.data.choices[0]?.finish_reason,
        usage: response.data.usage,
      });

      return response.data;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DashScopeService',
        operation: 'chatCompletion',
      });
      logger.error('[DashScopeService] 请求失败', error.toLogObject());
      throw this.handleError(error);
    }
  }

  /**
   * 发送流式聊天请求
   */
  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatOptions & { tools?: CadFunctionTool[] },
  ): AsyncGenerator<string, void, unknown> {
    const request: DashScopeRequest = {
      model: this.config.model,
      messages: this.transformMessages(messages),
      stream: true,
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    // 添加工具定义
    if (options?.tools && options.tools.length > 0) {
      request.tools = options.tools;
      request.tool_choice = 'auto';
    }

    try {
      logger.debug('[DashScopeService] 发送流式请求', {
        model: request.model,
        messageCount: messages.length,
        hasTools: !!request.tools,
      });

      const response = await this.client.post('/chat/completions', request, {
        responseType: 'stream',
      });

      const stream = response.data;

      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim());

        for (const line of lines) {
          if (line.startsWith(STREAM_DATA_PREFIX)) {
            const data = line.slice(SLICE_LENGTH);

            if (data === STREAM_DONE_MARKER) {
              logger.info('[DashScopeService] 流式响应结束');
              return;
            }

            try {
              const parsed: unknown = JSON.parse(data);
              const parsedResponse = parsed as { choices?: Array<{ delta?: { content?: string; tool_calls?: unknown } }> };
              const content = parsedResponse.choices?.[0]?.delta?.content;

              if (content) {
                yield content;
              }

              // 处理 Function Calling
              const toolCalls = parsedResponse.choices?.[0]?.delta?.tool_calls;
              if (toolCalls) {
                logger.debug('[DashScopeService] 收到工具调用', { toolCalls });
                // 这里可以进一步处理工具调用
              }
            } catch (parseError: unknown) {
              logger.warn('[DashScopeService] 解析流式数据失败', { data, parseError });
            }
          }
        }
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DashScopeService',
        operation: 'chatCompletionStream',
      });
      logger.error('[DashScopeService] 流式请求失败', error.toLogObject());
      throw this.handleError(error);
    }
  }

  /**
   * 转换消息格式
   */
  private transformMessages(messages: ChatMessage[]): DashScopeMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      logger.error('[DashScopeService] API 错误', {
        status,
        message,
        code: error.response?.data?.error?.code,
      });

      switch (status) {
        case HTTP_STATUS_UNAUTHORIZED:
          return new Error('DashScope API Key 无效或已过期');
        case HTTP_STATUS_TOO_MANY_REQUESTS:
          return new Error('DashScope API 请求频率超限，请稍后重试');
        case HTTP_STATUS_INTERNAL_SERVER_ERROR:
        case HTTP_STATUS_BAD_GATEWAY:
        case HTTP_STATUS_SERVICE_UNAVAILABLE:
          return new Error('DashScope 服务暂时不可用，请稍后重试');
        default:
          return new Error(`DashScope API 错误: ${message}`);
      }
    }

    return error instanceof Error ? error : new Error('未知错误');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testMessages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await this.chatCompletion(testMessages, { maxTokens: 10 });
      return true;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DashScopeService',
        operation: 'healthCheck',
      });
      logger.error('[DashScopeService] 健康检查失败', error.toLogObject());
      return false;
    }
  }
}
