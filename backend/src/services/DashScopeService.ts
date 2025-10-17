/**
 * 阿里云 DashScope API 服务
 *
 * 封装通义千问系列模型的 API 调用
 * 支持标准 OpenAI 兼容接口和 Function Calling
 */

import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { ChatMessage, ChatOptions} from '@/types';
import { ChatResponse } from '@/types';
import type { CadFunctionTool } from '@llmchat/shared-types';
import logger from '@/utils/logger';

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
      model: config.model || 'qwen-max',
      baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: config.timeout || 60000,
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
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8000,
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
    } catch (error: any) {
      logger.error('[DashScopeService] 请求失败', { error });
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
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8000,
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              logger.info('[DashScopeService] 流式响应结束');
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;

              if (content) {
                yield content;
              }

              // 处理 Function Calling
              const toolCalls = parsed.choices[0]?.delta?.tool_calls;
              if (toolCalls) {
                logger.debug('[DashScopeService] 收到工具调用', { toolCalls });
                // 这里可以进一步处理工具调用
              }
            } catch (parseError) {
              logger.warn('[DashScopeService] 解析流式数据失败', { data, parseError });
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('[DashScopeService] 流式请求失败', { error });
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
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      logger.error('[DashScopeService] API 错误', {
        status,
        message,
        code: error.response?.data?.error?.code,
      });

      switch (status) {
        case 401:
          return new Error('DashScope API Key 无效或已过期');
        case 429:
          return new Error('DashScope API 请求频率超限，请稍后重试');
        case 500:
        case 502:
        case 503:
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
    } catch (error: any) {
      logger.error('[DashScopeService] 健康检查失败', { error });
      return false;
    }
  }
}

