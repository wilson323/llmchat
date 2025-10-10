/**
 * 极致优化的聊天控制器
 * 专注于减少响应时间和提升并发处理能力
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { once } from 'events';

import logger from '@/utils/logger';
import { optimizedStreamProcessor } from '@/utils/OptimizedStreamProcessor';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';
import { requestPreprocessor } from '@/utils/RequestPreprocessor';
import { AgentConfigService } from '@/services/AgentConfigService';
import { OptimizedChatProxyService } from '@/services/OptimizedChatProxyService';
import { ChatHistoryService } from '@/services/ChatHistoryService';
import { FastGPTSessionService } from '@/services/FastGPTSessionService';
import { getProtectionService, ProtectedRequestContext } from '@/services/ProtectionService';
import {
  ChatMessage,
  ChatOptions,
  ChatRequest,
  ApiError,
  StreamStatus,
  ChatAttachmentMetadata,
  VoiceNoteMetadata,
} from '@/types';
import { JsonValue, DynamicTypeGuard, SafeAccess } from '@/types/dynamic';
import type { SSEEventData } from '@/types/provider';
import { createErrorFromUnknown } from '@/types/errors';
import { generateId } from '@/utils/helpers';

// 性能监控配置
interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  concurrentRequests: number;
}

/**
 * 极致优化的聊天控制器
 */
export class OptimizedChatController {
  private agentService: AgentConfigService;
  private chatService: OptimizedChatProxyService;
  private historyService: ChatHistoryService;
  private fastgptSessionService: FastGPTSessionService;
  private protectionService = getProtectionService();

  // 性能指标
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    concurrentRequests: 0,
  };

  // 请求缓存
  private requestCache = new Map<string, {
    response: JsonValue;
    timestamp: number;
    ttl: number;
  }>();

  // 配置
  private readonly cacheTTL = 5 * 60 * 1000; // 5分钟
  private readonly maxCacheSize = 1000;
  private readonly maxConcurrentRequests = 100;

  constructor() {
    this.agentService = new AgentConfigService();
    this.chatService = new OptimizedChatProxyService();
    this.historyService = new ChatHistoryService();
    this.fastgptSessionService = new FastGPTSessionService(this.agentService);

    // 定期清理缓存
    setInterval(() => this.cleanupCache(), 60 * 1000);

    // 定期更新性能指标
    setInterval(() => this.updateMetrics(), 10 * 1000);
  }

  /**
   * 极致优化的聊天完成接口
   */
  chatCompletions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = performance.now();
    let requestId = generateId();

    try {
      // 更新并发计数
      this.metrics.concurrentRequests++;
      this.metrics.requestCount++;

      // 设置请求ID用于跟踪
      res.setHeader('X-Request-ID', requestId);
      res.setHeader('X-Server-Timestamp', Date.now().toString());

      logger.debug('🚀 [OptimizedChatController] 开始处理请求', {
        requestId,
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });

      // 快速预处理请求
      const processedRequest = await this.preprocessRequest(req, requestId);

      // 尝试从缓存获取响应
      const cachedResponse = this.getCachedResponse(processedRequest);
      if (cachedResponse) {
        logger.debug('💾 命中缓存', { requestId });
        this.sendCachedResponse(res, cachedResponse);
        this.updatePerformanceMetrics(startTime, true);
        return;
      }

      // 并发控制检查
      if (this.metrics.concurrentRequests > this.maxConcurrentRequests) {
        this.sendRateLimitError(res, requestId);
        return;
      }

      // 获取智能体信息（带缓存）
      const agent = await this.getAgentWithCache(processedRequest.agentId);
      if (!agent) {
        this.sendAgentNotFoundError(res, processedRequest.agentId, requestId);
        return;
      }

      if (!agent.isActive) {
        this.sendAgentInactiveError(res, processedRequest.agentId, requestId);
        return;
      }

      // 异步处理会话和历史记录（不阻塞响应）
      this.handleSessionAsync(processedRequest, agent.id, requestId);

      // 根据请求类型处理
      if (processedRequest.stream) {
        await this.handleOptimizedStreamRequest(processedRequest, agent, req, res, requestId);
      } else {
        await this.handleOptimizedNormalRequest(processedRequest, agent, req, res, requestId);
      }

    } catch (unknownError) {
      this.handleError(unknownError, req, res, requestId, startTime);
    } finally {
      // 更新并发计数
      this.metrics.concurrentRequests--;
      this.updatePerformanceMetrics(startTime, false);
    }
  };

  /**
   * 预处理请求
   */
  private async preprocessRequest(req: Request, requestId: string): Promise<ChatRequest & { options: ChatOptions }> {
    return requestPreprocessor.processChatRequest(req.body, {
      requestId,
      timestamp: Date.now(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  /**
   * 获取缓存的响应
   */
  private getCachedResponse(request: ChatRequest & { options: ChatOptions }): JsonValue | null {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.requestCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.requestCache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  /**
   * 缓存响应
   */
  private cacheResponse(request: ChatRequest & { options: ChatOptions }, response: JsonValue): void {
    // 只缓存成功的非流式响应
    if (request.stream || !response) {
      return;
    }

    const cacheKey = this.generateCacheKey(request);

    // 如果缓存已满，删除最旧的条目
    if (this.requestCache.size >= this.maxCacheSize) {
      const oldestKey = this.requestCache.keys().next().value;
      this.requestCache.delete(oldestKey);
    }

    this.requestCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      ttl: this.cacheTTL,
    });

    // 更新缓存命中率
    this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 0.9) + (0.1);
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: ChatRequest & { options: ChatOptions }): string {
    const keyData = {
      agentId: request.agentId,
      messages: request.messages.slice(-2), // 只缓存最后2条消息
      temperature: request.options?.temperature,
      maxTokens: request.options?.maxTokens,
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * 带缓存的智能体获取
   */
  private async getAgentWithCache(agentId: string) {
    return performanceOptimizer.memoize(
      () => this.agentService.getAgent(agentId),
      `agent:${agentId}`,
      60 * 1000 // 1分钟缓存
    )();
  }

  /**
   * 异步处理会话相关操作
   */
  private async handleSessionAsync(
    request: ChatRequest & { options: ChatOptions },
    agentId: string,
    requestId: string
  ): Promise<void> {
    try {
      const sessionId = request.options.chatId || generateId();

      // 并行执行会话操作
      await Promise.allSettled([
        this.historyService.ensureSession(
          sessionId,
          agentId,
          this.buildSessionTitle(request.messages)
        ),
        this.recordUserHistory(request, sessionId, agentId, requestId),
      ]);

      logger.debug('✅ 会话异步处理完成', { requestId, sessionId });
    } catch (error) {
      logger.warn('⚠️ 会话异步处理失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 处理优化的流式请求
   */
  private async handleOptimizedStreamRequest(
    request: ChatRequest & { options: ChatOptions },
    agent: any,
    req: Request,
    res: Response,
    requestId: string
  ): Promise<void> {
    try {
      const streamId = `${requestId}-${generateId()}`;
      const sessionId = request.options.chatId || generateId();

      logger.debug('🌊 开始优化流式处理', {
        requestId,
        streamId,
        agentId: agent.id,
      });

      // 创建优化的流式处理器
      const stream = optimizedStreamProcessor.createStream(streamId, res, {
        enableMetrics: true,
        bufferSize: 16 * 1024,
        flushInterval: 50,
      });

      // 立即发送初始事件
      stream.onEvent('chatId', { chatId: sessionId });
      stream.onEvent('start', {
        id: streamId,
        timestamp: Date.now(),
        agentId: agent.id,
      });

      // 获取保护上下文
      const protectionContext = (req as ProtectedRequest).protectionContext;

      // 装饰消息
      const decoratedMessages = this.decorateMessages(
        request.messages,
        request.attachments,
        request.voiceNote
      );

      // 发送流式消息
      await this.chatService.sendStreamMessage(
        agent.id,
        decoratedMessages,
        (chunk: string) => {
          stream.onChunk(chunk);
        },
        (status: StreamStatus) => {
          stream.onStatus(status);

          // 状态完成时记录历史
          if (status.type === 'complete' && status.data?.content) {
            this.recordAssistantMessageAsync(
              sessionId,
              agent.id,
              status.data.content,
              request.options?.responseChatItemId,
              requestId
            );
          }
        },
        request.options,
        (eventName: string, data: SSEEventData) => {
          stream.onEvent(eventName, data);
        }
      );

      stream.onComplete();

      logger.debug('✅ 优化流式处理完成', { requestId, streamId });

    } catch (error) {
      logger.error('❌ 优化流式处理失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendStreamError(res, error, requestId);
    }
  }

  /**
   * 处理优化的普通请求
   */
  private async handleOptimizedNormalRequest(
    request: ChatRequest & { options: ChatOptions },
    agent: any,
    req: Request,
    res: Response,
    requestId: string
  ): Promise<void> {
    try {
      const sessionId = request.options.chatId || generateId();

      logger.debug('📨 开始优化普通请求处理', {
        requestId,
        agentId: agent.id,
      });

      // 装饰消息
      const decoratedMessages = this.decorateMessages(
        request.messages,
        request.attachments,
        request.voiceNote
      );

      // 并行执行请求和可能的缓存操作
      const [response] = await Promise.allSettled([
        this.chatService.sendMessage(agent.id, decoratedMessages, request.options),
      ]);

      if (response.status === 'rejected') {
        throw response.reason;
      }

      const chatResponse = response.value;
      const assistantContent = chatResponse?.choices?.[0]?.message?.content || '';

      // 异步记录助手消息
      this.recordAssistantMessageAsync(
        sessionId,
        agent.id,
        assistantContent,
        request.options?.responseChatItemId,
        requestId
      );

      // 缓存响应
      this.cacheResponse(request, { ...chatResponse, chatId: sessionId });

      // 发送优化的响应
      this.sendOptimizedResponse(res, { ...chatResponse, chatId: sessionId }, requestId);

      logger.debug('✅ 优化普通请求处理完成', {
        requestId,
        responseTime: performance.now() - Date.now(),
      });

    } catch (error) {
      logger.error('❌ 优化普通请求处理失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendError(res, error, requestId);
    }
  }

  /**
   * 发送优化的响应
   */
  private sendOptimizedResponse(res: Response, data: JsonValue, requestId: string): void {
    try {
      res.setHeader('X-Response-Time', Date.now().toString());
      res.setHeader('X-Optimized', 'true');

      const responseData = {
        success: true,
        data,
        meta: {
          requestId,
          timestamp: Date.now(),
          optimized: true,
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error('发送优化响应失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '响应发送失败',
        requestId,
      });
    }
  }

  /**
   * 发送缓存响应
   */
  private sendCachedResponse(res: Response, cachedData: JsonValue): void {
    try {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Timestamp', Date.now().toString());

      const responseData = {
        success: true,
        data: cachedData,
        meta: {
          cached: true,
          timestamp: Date.now(),
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error('发送缓存响应失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 发送错误响应
   */
  private sendError(res: Response, error: unknown, requestId: string): void {
    const typedError = createErrorFromUnknown(error, {
      component: 'OptimizedChatController',
      operation: 'chatCompletions',
      requestId,
    });

    const apiError: ApiError = {
      code: typedError.code,
      message: typedError.getUserMessage(),
      timestamp: typedError.timestamp,
      requestId,
    };

    const statusCode = this.getErrorStatusCode(typedError);
    res.status(statusCode).json({
      success: false,
      error: apiError,
      meta: {
        requestId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 发送流式错误
   */
  private sendStreamError(res: Response, error: unknown, requestId: string): void {
    if (res.headersSent) {
      return;
    }

    try {
      const typedError = createErrorFromUnknown(error, {
        component: 'OptimizedChatController',
        operation: 'handleOptimizedStreamRequest',
        requestId,
      });

      // 设置SSE头
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 发送错误事件
      const errorEvent = `event: error\ndata: ${JSON.stringify({
        code: typedError.code,
        message: typedError.getUserMessage(),
        timestamp: typedError.timestamp,
        requestId,
      })}\n\n`;

      res.write(errorEvent);
      res.end();

    } catch (writeError) {
      logger.error('发送流式错误失败', {
        requestId,
        error: writeError instanceof Error ? writeError.message : String(writeError),
      });
    }
  }

  /**
   * 发送速率限制错误
   */
  private sendRateLimitError(res: Response, requestId: string): void {
    const apiError: ApiError = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试',
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(429).json({
      success: false,
      error: apiError,
      meta: {
        requestId,
        retryAfter: 5, // 5秒后重试
      },
    });
  }

  /**
   * 发送智能体不存在错误
   */
  private sendAgentNotFoundError(res: Response, agentId: string, requestId: string): void {
    const apiError: ApiError = {
      code: 'AGENT_NOT_FOUND',
      message: `智能体不存在: ${agentId}`,
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(404).json({
      success: false,
      error: apiError,
      meta: { requestId },
    });
  }

  /**
   * 发送智能体未激活错误
   */
  private sendAgentInactiveError(res: Response, agentId: string, requestId: string): void {
    const apiError: ApiError = {
      code: 'AGENT_INACTIVE',
      message: `智能体未激活: ${agentId}`,
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(400).json({
      success: false,
      error: apiError,
      meta: { requestId },
    });
  }

  /**
   * 处理错误
   */
  private handleError(
    error: unknown,
    req: Request,
    res: Response,
    requestId: string,
    startTime: number
  ): void {
    const typedError = createErrorFromUnknown(error, {
      component: 'OptimizedChatController',
      operation: 'chatCompletions',
      url: req.originalUrl,
      method: req.method,
      requestId,
    });

    logger.error('聊天请求处理失败', {
      requestId,
      error: typedError.message,
      stack: typedError.stack,
      duration: performance.now() - startTime,
    });

    // 更新错误率
    this.metrics.errorRate = (this.metrics.errorRate * 0.9) + 0.1;

    // 如果响应头已发送（流式响应中），不能再发送JSON响应
    if (res.headersSent) {
      return;
    }

    this.sendError(res, typedError, requestId);
  }

  /**
   * 装饰消息
   */
  private decorateMessages(
    messages: ChatMessage[],
    attachments?: ChatAttachmentMetadata[],
    voiceNote?: VoiceNoteMetadata
  ): ChatMessage[] {
    const decorated = messages.map(msg => ({ ...msg }));

    // 如果有附件或语音，添加到最后一条用户消息
    if (decorated.length > 0) {
      const lastMessage = decorated[decorated.length - 1];
      if (lastMessage.role === 'user') {
        if (attachments && attachments.length > 0) {
          lastMessage.attachments = attachments;
        }
        if (voiceNote) {
          lastMessage.voiceNote = voiceNote;
        }
      }
    }

    return decorated;
  }

  /**
   * 构建会话标题
   */
  private buildSessionTitle(messages: ChatMessage[]): string {
    const userMessages = messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) {
      return '新对话';
    }

    const firstUserMessage = userMessages[0].content;
    const title = firstUserMessage.length > 50
      ? firstUserMessage.substring(0, 50) + '...'
      : firstUserMessage;

    return title || '新对话';
  }

  /**
   * 异步记录用户历史
   */
  private async recordUserHistory(
    request: ChatRequest & { options: ChatOptions },
    sessionId: string,
    agentId: string,
    requestId: string
  ): Promise<void> {
    try {
      await this.historyService.appendMessage({
        sessionId,
        agentId,
        role: 'user',
        content: request.messages[request.messages.length - 1]?.content || '',
        metadata: {
          requestId,
          attachments: request.attachments,
          voiceNote: request.voiceNote,
        },
      });
    } catch (error) {
      logger.warn('记录用户历史失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 异步记录助手消息
   */
  private async recordAssistantMessageAsync(
    sessionId: string,
    agentId: string,
    content: string,
    responseChatItemId?: string,
    requestId?: string
  ): Promise<void> {
    try {
      await this.historyService.appendMessage({
        sessionId,
        agentId,
        role: 'assistant',
        content,
        metadata: {
          requestId,
          responseChatItemId,
        },
      });
    } catch (error) {
      logger.warn('记录助手消息失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取错误状态码
   */
  private getErrorStatusCode(error: any): number {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return 400;
      case 'AGENT_NOT_FOUND':
        return 404;
      case 'AGENT_INACTIVE':
        return 400;
      case 'AUTHENTICATION_ERROR':
        return 401;
      case 'AUTHORIZATION_ERROR':
        return 403;
      case 'RATE_LIMIT_ERROR':
        return 429;
      case 'EXTERNAL_SERVICE_ERROR':
        return 502;
      case 'RESOURCE_ERROR':
        return 503;
      default:
        return 500;
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(startTime: number, cached: boolean): void {
    const responseTime = performance.now() - startTime;

    // 更新平均响应时间
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);

    // 如果命中缓存，提高缓存命中率
    if (cached) {
      this.metrics.cacheHitRate = Math.min(0.95, this.metrics.cacheHitRate + 0.01);
    } else {
      this.metrics.cacheHitRate = Math.max(0, this.metrics.cacheHitRate - 0.001);
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(): void {
    try {
      // 记录性能指标
      logger.debug('OptimizedChatController 性能指标', {
        ...this.metrics,
        cacheSize: this.requestCache.size,
        timestamp: Date.now(),
      });

      // 清理过期的缓存
      this.cleanupCache();

    } catch (error) {
      logger.error('更新性能指标失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.requestCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug('清理过期缓存', {
        expiredCount: expiredKeys.length,
        remainingCount: this.requestCache.size,
      });
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      controller: this.metrics,
      cache: {
        size: this.requestCache.size,
        maxSize: this.maxCacheSize,
        hitRate: this.metrics.cacheHitRate,
      },
      stream: optimizedStreamProcessor.getPerformanceStats(),
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.requestCache.clear();
    optimizedStreamProcessor.cleanup();

    // 重置指标
    this.metrics = {
      requestCount: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      concurrentRequests: 0,
    };

    logger.info('OptimizedChatController 资源清理完成');
  }
}

// 导出单例实例
export const optimizedChatController = new OptimizedChatController();