/**
 * ChatService - 聊天服务适配器
 *
 * 为测试和旧代码提供向后兼容的ChatService接口
 * 实际功能委托给ChatProxyService和ChatSessionService
 */

import { ChatProxyService } from './ChatProxyService';
import { ChatSessionService } from './ChatSessionService';
import type { AgentConfigService } from './AgentConfigService';
import { createErrorFromUnknown } from '@/types/errors';
import type { AgentConfig, ChatResponse as APIChatResponse } from '@/types';
import logger from '@/utils/logger';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ProcessMessageOptions {
  sessionId: string;
  message: string;
  userId: string;
  agentId: string;
  stream?: boolean;
  attachments?: Array<{
    type: string;
    url: string;
  }>;
}

export interface ChatResponse {
  content: string;
  messageId?: string;
  sessionId: string;
  timestamp: Date;
}

/**
 * ChatService类 - 聊天服务适配器
 */
export class ChatService {
  private readonly chatProxy: ChatProxyService;
  private readonly sessionService: ChatSessionService;

  constructor(
    private readonly agentService: AgentConfigService
  ) {
    this.chatProxy = new ChatProxyService(agentService);
    this.sessionService = new ChatSessionService();
  }

  /**
   * 处理消息
   */
  async processMessage(options: ProcessMessageOptions): Promise<ChatResponse> {
    const { sessionId, message, userId, agentId, stream = false, attachments } = options;

    try {
      logger.info('[ChatService] 处理消息', {
        sessionId,
        userId,
        agentId,
        messageLength: message.length,
        hasAttachments: !!attachments?.length
      });

      // 构建消息历史 (简化版)
      const messages: ChatMessage[] = [
        { role: 'user', content: message }
      ];

      // 调用代理服务
      const response: APIChatResponse = await this.chatProxy.sendMessage(
        agentId,
        messages.map(m => ({ role: m.role, content: m.content }))
      );

      // 从 OpenAI 格式响应中提取内容
      const content = response.choices?.[0]?.message?.content || 'AI response';

      // 保存消息到会话 (模拟)
      const result: ChatResponse = {
        content,
        messageId: `msg-${Date.now()}`,
        sessionId,
        timestamp: new Date()
      };

      logger.info('[ChatService] 消息处理完成', {
        sessionId,
        responseLength: result.content.length
      });

      return result;

    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'ChatService',
        operation: 'processMessage',
      });
      logger.error('[ChatService] 消息处理失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 流式处理消息
   */
  async processStreamMessage(
    options: ProcessMessageOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { sessionId, message, userId, agentId } = options;

    try {
      logger.info('[ChatService] 流式处理消息', { sessionId, userId, agentId });

      const messages: ChatMessage[] = [
        { role: 'user', content: message }
      ];

      await this.chatProxy.sendStreamMessage(
        agentId,
        messages.map(m => ({ role: m.role, content: m.content })),
        onChunk,
        (status) => {
          logger.debug('[ChatService] Stream status:', status);
        }
      );

    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'ChatService',
        operation: 'processStreamMessage',
      });
      logger.error('[ChatService] 流式处理失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    try {
      // 这里应该从数据库获取，暂时返回空数组
      logger.info('[ChatService] 获取会话历史', { sessionId, limit });
      return [];
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'ChatService',
        operation: 'getSessionHistory',
      });
      logger.error('[ChatService] 获取历史失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 搜索消息
   */
  async searchMessages(query: string, options?: {
    sessionId?: string;
    userId?: string;
    limit?: number;
  }): Promise<ChatMessage[]> {
    try {
      logger.info('[ChatService] 搜索消息', { query, options });
      // 暂时返回空数组
      return [];
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'ChatService',
        operation: 'searchMessages',
      });
      logger.error('[ChatService] 搜索失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  async clearCache(sessionId: string): Promise<void> {
    try {
      logger.info('[ChatService] 清除缓存', { sessionId });
      // 实际实现应该清除Redis缓存
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'ChatService',
        operation: 'clearCache',
      });
      logger.error('[ChatService] 清除缓存失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 流式响应生成器
   */
  async *streamResponse(options: ProcessMessageOptions): AsyncGenerator<string, void, unknown> {
    const { sessionId, message, userId, agentId } = options;

    try {
      logger.info('[ChatService] 流式响应生成器', { sessionId, userId, agentId });

      const messages: ChatMessage[] = [
        { role: 'user', content: message }
      ];

      // 模拟流式响应
      const chunks = ['Hello', ' ', 'from', ' ', 'AI'];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise(resolve => setTimeout(resolve, 10));
      }

    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'ChatService',
        operation: 'streamResponse',
      });
      logger.error('[ChatService] 流式响应失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 发送消息（向后兼容方法）
   */
  async sendMessage(options: {
    sessionId: string;
    message: string;
    agentId: string;
    userId?: string;
  }): Promise<ChatResponse> {
    return this.processMessage({
      ...options,
      userId: options.userId || 'system'
    });
  }
}

