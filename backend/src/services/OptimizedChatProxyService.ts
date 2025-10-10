/**
 * 优化的聊天代理服务
 * 专注于资源管理、内存优化和性能提升
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import {
  AgentConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamStatus,
} from '@/types';
import { AgentConfigService } from './AgentConfigService';
import { ChatLogService } from './ChatLogService';
import { CacheService } from './CacheService';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';
import logger from '@/utils/logger';
import { ValidationError, ResourceError, ExternalServiceError } from '@/types/errors';

// 请求缓存配置
interface RequestCacheConfig {
  enabled: boolean;
  ttl: number; // 缓存时间（秒）
  maxSize: number; // 最大缓存条目数
  keyPrefix: string;
}

// 连接池配置
interface ConnectionPoolConfig {
  maxConnections: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  keepAlive: boolean;
}

// 优化的HTTP客户端
class OptimizedHttpClient {
  private clients: Map<string, AxiosInstance> = new Map();
  private requestQueue: Map<string, Promise<any>> = new Map();
  private connectionPool: Map<string, Array<{
    client: AxiosInstance;
    inUse: boolean;
    lastUsed: number;
  }>> = new Map();

  constructor(
    private poolConfig: ConnectionPoolConfig,
    private cacheConfig: RequestCacheConfig,
    private cacheService: CacheService
  ) {}

  getClient(endpoint: string): AxiosInstance {
    const clientKey = this.getClientKey(endpoint);

    // 尝试从连接池获取空闲客户端
    const pool = this.connectionPool.get(clientKey);
    if (pool) {
      const availableClient = pool.find(c => !c.inUse);
      if (availableClient) {
        availableClient.inUse = true;
        availableClient.lastUsed = Date.now();
        return availableClient.client;
      }
    }

    // 创建新客户端
    const client = this.createClient(endpoint);

    // 加入连接池
    if (!this.connectionPool.has(clientKey)) {
      this.connectionPool.set(clientKey, []);
    }
    const clientPool = this.connectionPool.get(clientKey)!;

    if (clientPool.length < this.poolConfig.maxConnections) {
      clientPool.push({
        client,
        inUse: true,
        lastUsed: Date.now(),
      });
    }

    return client;
  }

  private createClient(endpoint: string): AxiosInstance {
    return axios.create({
      baseURL: endpoint,
      timeout: this.poolConfig.timeout,
      maxRedirects: 3,
      // 启用请求/响应压缩
      decompress: true,
      // 连接复用
      httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: this.poolConfig.timeout,
      }),
      httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: this.poolConfig.timeout,
      }),
    });
  }

  private getClientKey(endpoint: string): string {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.host}`;
  }

  releaseClient(endpoint: string, client: AxiosInstance): void {
    const clientKey = this.getClientKey(endpoint);
    const pool = this.connectionPool.get(clientKey);

    if (pool) {
      const clientInfo = pool.find(c => c.client === client);
      if (clientInfo) {
        clientInfo.inUse = false;
        clientInfo.lastUsed = Date.now();
      }
    }
  }

  async request<T>(
    config: AxiosRequestConfig,
    endpoint: string,
    useCache: boolean = true
  ): Promise<AxiosResponse<T>> {
    const cacheKey = this.getCacheKey(config, endpoint);

    // 检查缓存
    if (useCache && this.cacheConfig.enabled) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        performanceOptimizer.getRequestMonitor().startRequest(cacheKey, config.method || 'GET', endpoint);
        performanceOptimizer.getRequestMonitor().endRequest(cacheKey, 200);
        return cached as AxiosResponse<T>;
      }
    }

    // 检查是否已有相同请求在队列中
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    // 创建请求
    const requestPromise = this.makeRequest<T>(config, endpoint);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;

      // 缓存成功响应
      if (useCache && this.cacheConfig.enabled && response.status === 200) {
        await this.cacheService.set(cacheKey, response, {
          ttl: this.cacheConfig.ttl,
        });
      }

      return response;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  private async makeRequest<T>(
    config: AxiosRequestConfig,
    endpoint: string
  ): Promise<AxiosResponse<T>> {
    const client = this.getClient(endpoint);
    let lastError: Error;

    for (let attempt = 0; attempt <= this.poolConfig.retryAttempts; attempt++) {
      try {
        const response = await client.request<T>(config);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.poolConfig.retryAttempts) {
          throw lastError;
        }

        // 计算重试延迟
        const delay = this.poolConfig.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);

        logger.warn(`请求失败，${delay}ms后重试 (${attempt + 1}/${this.poolConfig.retryAttempts})`, {
          endpoint,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError!;
  }

  private getCacheKey(config: AxiosRequestConfig, endpoint: string): string {
    const method = config.method || 'GET';
    const url = endpoint + (config.url || '');
    const data = config.data ? JSON.stringify(config.data) : '';
    return `${method}:${url}:${data}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 资源管理器
export class ResourceManager {
  private static instance: ResourceManager;
  private resources: Map<string, any> = new Map();
  private cleanupTasks: Array<() => void> = [];

  private constructor() {}

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  storeResource(key: string, resource: any): void {
    this.resources.set(key, resource);
  }

  getResource<T>(key: string): T | null {
    return this.resources.get(key) || null;
  }

  removeResource(key: string): void {
    const resource = this.resources.get(key);
    if (resource && typeof resource === 'object' && resource.close) {
      try {
        resource.close();
      } catch (error) {
        logger.warn('关闭资源时出错', { key, error });
      }
    }
    this.resources.delete(key);
  }

  addCleanupTask(task: () => void): void {
    this.cleanupTasks.push(task);
  }

  cleanup(): void {
    // 清理所有资源
    for (const [key, resource] of this.resources.entries()) {
      this.removeResource(key);
    }

    // 执行清理任务
    for (const task of this.cleanupTasks) {
      try {
        task();
      } catch (error) {
        logger.error('执行清理任务时出错', { error });
      }
    }
    this.cleanupTasks = [];

    logger.info('资源清理完成');
  }
}

// 优化的聊天代理服务
export class OptimizedChatProxyService {
  private httpClient: OptimizedHttpClient;
  private resourceManager = ResourceManager.getInstance();
  private agentConfigService: AgentConfigService;
  private chatLogService: ChatLogService;
  private cacheService: CacheService;

  constructor() {
    this.agentConfigService = new AgentConfigService();
    this.chatLogService = new ChatLogService();
    this.cacheService = new CacheService('chat_service');

    this.httpClient = new OptimizedHttpClient(
      {
        maxConnections: 50,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
      },
      {
        enabled: true,
        ttl: 300,
        maxSize: 1000,
        keyPrefix: 'chat_proxy',
      },
      this.cacheService
    );

    // 确保服务结束时清理资源
    process.on('SIGTERM', () => this.resourceManager.cleanup());
    process.on('SIGINT', () => this.resourceManager.cleanup());
  }

  /**
   * 发送聊天请求（优化版本）
   */
  async sendMessage(
    agentId: string,
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const requestId = `chat_${agentId}_${Date.now()}`;

    try {
      // 性能监控：开始请求
      performanceOptimizer.getRequestMonitor().startRequest(requestId, 'POST', `/chat/${agentId}`);

      // 获取智能体配置
      const config = await this.agentConfigService.getAgent(agentId);
      if (!config) {
        throw new ResourceError({
          message: `智能体 ${agentId} 未找到配置`,
          code: 'AGENT_NOT_FOUND',
          severity: 'high',
          context: { agentId },
          requestId,
        });
      }

      // 检查请求频率限制
      await this.checkRateLimit(agentId, config);

      // 获取HTTP客户端
      const httpClient = this.httpClient.getClient(config.endpoint);

      // 构建请求（使用缓存）
      const requestConfig = {
        method: 'POST',
        url: config.endpoint,
        data: this.buildOptimizedRequest(messages, config, false, options),
        headers: this.buildOptimizedHeaders(config),
      };

      // 检查缓存
      const cacheKey = `chat:${agentId}:${JSON.stringify(messages.slice(-5))}:${JSON.stringify(options)}`;
      let response: ChatResponse;

      if (this.shouldUseCache(agentId, options)) {
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
          response = cached as ChatResponse;
          logger.debug('使用缓存的聊天响应', { agentId, cacheKey });
        } else {
          // 发送请求
          const axiosResponse = await this.httpClient.request<ChatResponse>(
            requestConfig,
            config.endpoint,
            false
          );
          response = axiosResponse.data;

          // 缓存响应
          if (this.shouldCacheResponse(response)) {
            await this.cacheService.set(cacheKey, response, {
              ttl: this.getCacheTTL(config),
            });
          }
        }
      } else {
        // 不使用缓存，直接请求
        const axiosResponse = await this.httpClient.request<ChatResponse>(
          requestConfig,
          config.endpoint,
          false
        );
        response = axiosResponse.data;
      }

      // 性能监控：结束请求
      performanceOptimizer.getRequestMonitor().endRequest(requestId, 200);

      // 记录聊天日志
      logger.info('Chat request completed', {
        agentId,
        messagesCount: messages.length,
        duration: Date.now() - startTime,
        responseId: response.id,
        model: response.model,
        usage: response.usage,
      });

      return response;

    } catch (error) {
      // 性能监控：记录错误
      performanceOptimizer.getRequestMonitor().endRequest(requestId, 500);
      performanceOptimizer.getErrorMonitor().recordError(error as Error, {
        agentId,
        messages: messages.length,
        options,
      });

      throw this.handleError(error, agentId);
    }
  }

  /**
   * 发送流式聊天请求
   */
  async sendStreamMessage(
    agentId: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onStatus: (status: StreamStatus) => void,
    options?: ChatOptions,
    onEvent?: (eventName: string, data: any) => void,
    protectionContext?: any
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = `chat_stream_${agentId}_${Date.now()}`;

    try {
      // 性能监控：开始请求
      performanceOptimizer.getRequestMonitor().startRequest(requestId, 'POST', `/chat/${agentId}`);

      const config = await this.agentConfigService.getAgent(agentId);
      if (!config || !config.features.streamingConfig.enabled) {
        throw new ValidationError({
          message: '智能体不支持流式响应',
          code: 'STREAMING_NOT_SUPPORTED',
          severity: 'medium',
          context: { agentId },
        });
      }

      // 检查请求频率限制
      await this.checkRateLimit(agentId, config);

      // 构建流式请求
      const requestConfig = {
        method: 'POST',
        url: config.endpoint,
        data: this.buildOptimizedRequest(messages, config, true, options || {}),
        headers: this.buildOptimizedHeaders(config),
        responseType: 'stream' as any,
      };

      const httpClient = this.httpClient.getClient(config.endpoint);

      const response = await httpClient.request(requestConfig);

      // 处理流式响应
      await this.handleStreamResponse(
        response.data,
        agentId,
        onChunk,
        onStatus,
        onEvent
      );

      // 性能监控：结束请求
      performanceOptimizer.getRequestMonitor().endRequest(requestId, 200);

      const duration = Date.now() - startTime;
      logger.info('流式聊天请求完成', {
        agentId,
        duration,
      });

    } catch (error) {
      // 性能监控：记录错误
      performanceOptimizer.getRequestMonitor().endRequest(requestId, 500);
      performanceOptimizer.getErrorMonitor().recordError(error as Error, {
        agentId,
        messages: messages.length,
        options,
      });

      throw this.handleError(error, agentId);
    }
  }

  private async handleStreamResponse(
    stream: any,
    agentId: string,
    onChunk: (chunk: string) => void,
    onStatus: (status: StreamStatus) => void,
    onEvent?: (eventName: string, data: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        let buffer = '';

        stream.on('data', (chunk: any) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const event = this.parseSSEReasoning(line);
                if (event.data) {
                  onChunk(event.data);
                }
              } catch (parseError) {
                logger.warn('解析SSE事件失败', { line, error: parseError });
              }
            }
          }
        });

        stream.on('end', () => {
          if (buffer.trim()) {
            const event = this.parseSSEReasoning(buffer);
            if (event.data) {
              onChunk(event.data);
            }
          }
          onStatus({ type: 'complete', status: 'completed' });
          resolve();
        });

        stream.on('error', (error: Error) => {
          logger.error('流式响应错误', {
            agentId,
            error: error.message,
          });
          onStatus({ type: 'error', status: 'error', error: error.message });
          reject(error);
        });

      } catch (error) {
        logger.error('创建流式处理器失败', error);
        onStatus({ type: 'error', status: 'error', error: (error as Error).message });
        reject(error);
      }
    });
  }

  private parseSSEReasoning(line: string): { event: string; data: string } {
    const parts = line.split(':', 2);
    return {
      event: parts[0] || '',
      data: parts[1] || '',
    };
  }

  private buildOptimizedRequest(
    messages: ChatMessage[],
    config: any,
    stream: boolean,
    options: ChatOptions
  ): any {
    // 优化消息数组长度
    const optimizedMessages = messages.slice(-20); // 最多保留20条消息

    const request: any = {
      messages: optimizedMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      stream,
      model: config.model,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || config.temperature,
    };

    // 添加系统提示（如果存在）
    if (config.systemPrompt && request.messages) {
      request.messages.unshift({
        role: 'system',
        content: config.systemPrompt,
      });
    }

    return request;
  }

  private buildOptimizedHeaders(config: any): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'User-Agent': 'LLMChat-Optimized/1.0',
      'Connection': 'keep-alive',
    };
  }

  private shouldUseCache(agentId: string, options: ChatOptions): boolean {
    // 简单的缓存策略：非流式、非特殊请求使用缓存
    return !options.stream && !options.noCache;
  }

  private shouldCacheResponse(response: ChatResponse): boolean {
    // 成功响应且包含有效内容
    return Boolean(response.choices &&
           response.choices.length > 0 &&
           response.choices[0]?.message?.content);
  }

  private getCacheTTL(config: AgentConfig): number {
    // 根据智能体类型决定缓存时间
    const baseTTL = 300; // 5分钟
    const agentType = config.type || 'default';

    const ttlMap: Record<string, number> = {
      'fastgpt': baseTTL * 2, // 10分钟
      'openai': baseTTL * 1.5, // 7.5分钟
      'anthropic': baseTTL * 1.5, // 7.5分钟
      'dify': baseTTL, // 5分钟
    };

    return ttlMap[agentType] || baseTTL;
  }

  private async checkRateLimit(agentId: string, config: AgentConfig): Promise<void> {
    // 实现简单的频率限制
    const rateLimitKey = `rate_limit:${agentId}`;
    const currentCount = (await this.cacheService.get<number>(rateLimitKey)) || 0;

    const maxRequestsPerMinute = config.rateLimit?.requestsPerMinute || 30;
    const windowMs = 60000; // 1分钟

    if (currentCount >= maxRequestsPerMinute) {
      throw new ValidationError({
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        severity: 'medium',
        context: { agentId, currentCount, maxRequestsPerMinute },
      });
    }

    // 增加计数
    await this.cacheService.set(rateLimitKey, currentCount + 1, {
      ttl: windowMs / 1000,
    });
  }

  private handleError(error: any, agentId?: string): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || `HTTP ${status}`;

      switch (status) {
        case 401:
          return new ValidationError({
            message: '认证失败',
            code: 'AUTHENTICATION_FAILED',
            severity: 'high',
            context: { status, message },
          });
        case 429:
          return new ValidationError({
            message: '请求过于频繁',
            code: 'RATE_LIMIT',
            severity: 'medium',
            context: { status, message },
          });
        case 500:
          return new ExternalServiceError({
            message: '服务器内部错误',
            code: 'INTERNAL_SERVER_ERROR',
            severity: 'high',
            context: { status, message },
          });
        default:
          return new ExternalServiceError({
            message: `请求失败 (${status})`,
            code: `HTTP_${status}`,
            severity: 'medium',
            context: { status, message },
          });
      }
    }

    if (error.code === 'ECONNABORTED') {
      return new ExternalServiceError({
        message: '请求超时',
        code: 'REQUEST_TIMEOUT',
        severity: 'high',
        context: { originalError: error.message },
      });
    }

    return new ExternalServiceError({
      message: '未知错误',
      code: 'UNKNOWN_ERROR',
      severity: 'medium',
      context: { originalError: error.message },
    });
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      httpClient: this.getResourceStats(),
      performance: performanceOptimizer.getPerformanceStats(),
      cache: this.getCacheStats(),
    };
  }

  private getResourceStats(): any {
    return {
      connectionPools: [], // 简化实现，返回空数组
    };
  }

  private getCacheStats(): any {
    return {
      memory: this.resourceManager.getResource('cache_stats'),
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.resourceManager.cleanup();
    this.httpClient = null as any;
  }
}

export default OptimizedChatProxyService;