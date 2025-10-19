/**
 * 请求重试和降级策略服务
 * 实现智能重试机制、优雅降级和请求去重
 */

import logger from '@/utils/logger';

export interface RetryConfig {
  maxRetries: number;                    // 最大重试次数
  baseDelay: number;                     // 基础延迟时间（毫秒）
  maxDelay: number;                      // 最大延迟时间（毫秒）
  backoffFactor: number;                 // 退避因子
  retryableErrors?: string[];            // 可重试的错误类型
  retryableStatusCodes?: number[];       // 可重试的HTTP状态码
  enableJitter: boolean;                 // 是否启用抖动
  onRetry?: (attempt: number, error: Error, delay: number) => void; // 重试回调
}

export interface FallbackConfig {
  enabled: boolean;                      // 是否启用降级
  fallbackResponse?: unknown;                // 降级响应
  fallbackProvider?: string;             // 降级提供商
  cacheFallbackResponse: boolean;        // 是否缓存降级响应
  maxCacheSize: number;                  // 最大缓存大小
  cacheTTL: number;                      // 缓存TTL（毫秒）
}

export interface RequestDeduplicationConfig {
  enabled: boolean;                      // 是否启用去重
  keyGenerator?: (request: unknown) => string; // 自定义key生成器
  deduplicationWindow: number;           // 去重窗口时间（毫秒）
  maxConcurrentRequests: number;         // 最大并发请求数
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
  fallbackUsed: boolean;
}

export interface RequestMetrics {
  requestId: string;
  attempts: number;
  totalDuration: number;
  error?: Error;
  fallbackUsed: boolean;
  timestamp: Date;
}

/**
 * 重试策略枚举
 */
export enum RetryStrategy {
  FIXED = 'fixed',           // 固定延迟
  LINEAR = 'linear',         // 线性退避
  EXPONENTIAL = 'exponential', // 指数退避
  EXPONENTIAL_WITH_JITTER = 'exponential_with_jitter' // 带抖动的指数退避
}

/**
 * 请求去重器
 */
export class RequestDeduplicator {
  private readonly pendingRequests: Map<string, Promise<any>> = new Map();
  private readonly requestMetrics: Map<string, RequestMetrics> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly config: RequestDeduplicationConfig) {
    // 定期清理过期的去重记录
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.deduplicationWindow);

    logger.info('请求去重器初始化完成', {
      enabled: this.config.enabled,
      deduplicationWindow: this.config.deduplicationWindow,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
    });
  }

  /**
   * 执行去重请求
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }

    // 检查是否已有相同请求在进行
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      logger.debug('请求去重，复用现有请求', { key });
      return existingRequest;
    }

    // 检查并发请求数量
    if (this.pendingRequests.size >= this.config.maxConcurrentRequests) {
      throw new Error('并发请求数超过限制');
    }

    // 执行新请求
    const requestPromise = this.executeWithMetrics(key, operation);
    this.pendingRequests.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * 执行请求并记录指标
   */
  private async executeWithMetrics<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    const metrics: RequestMetrics = {
      requestId: key,
      attempts: 1,
      totalDuration: 0,
      fallbackUsed: false,
      timestamp: new Date(),
    };

    try {
      const result = await operation();
      metrics.totalDuration = Date.now() - startTime;
      this.requestMetrics.set(key, metrics);
      return result;
    } catch (error: any) {
      metrics.error = error as Error;
      metrics.totalDuration = Date.now() - startTime;
      this.requestMetrics.set(key, metrics);
      throw error;
    }
  }

  /**
   * 生成请求key
   */
  generateRequestKey(request: any): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // 默认key生成策略
    const keyParts = [
      request.method || 'GET',
      (request.url || request.endpoint) ?? '',
      JSON.stringify((request.data || request.body) ?? {}),
      JSON.stringify((request.params || request.query) ?? {}),
    ];

    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.deduplicationWindow;

    // 清理请求指标
    let cleanedMetrics = 0;
    for (const [key, metrics] of this.requestMetrics.entries()) {
      if (metrics.timestamp.getTime() < cutoffTime) {
        this.requestMetrics.delete(key);
        cleanedMetrics++;
      }
    }

    if (cleanedMetrics > 0) {
      logger.debug('清理过期的请求指标', { count: cleanedMetrics });
    }
  }

  /**
   * 获取请求指标
   */
  getMetrics(): RequestMetrics[] {
    return Array.from(this.requestMetrics.values());
  }

  /**
   * 清理所有数据
   */
  clear(): void {
    this.pendingRequests.clear();
    this.requestMetrics.clear();
  }

  /**
   * 销毁去重器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

/**
 * 重试服务
 */
export class RetryService {
  private readonly deduplicator: RequestDeduplicator;
  private readonly fallbackCache: Map<string, { data: unknown; timestamp: number }> = new Map();

  constructor(
    private readonly retryConfig: RetryConfig,
    private readonly fallbackConfig: FallbackConfig,
    deduplicationConfig?: RequestDeduplicationConfig,
  ) {
    this.deduplicator = new RequestDeduplicator(
      deduplicationConfig || {
        enabled: true,
        deduplicationWindow: 30000, // 30秒
        maxConcurrentRequests: 1000,  // 最大支持1000并发
      },
    );

    // 设置默认的可重试错误和状态码
    if (!this.retryConfig.retryableErrors) {
      this.retryConfig.retryableErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'EAI_AGAIN',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
      ];
    }

    if (!this.retryConfig.retryableStatusCodes) {
      this.retryConfig.retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    }

    logger.info('重试服务初始化完成', {
      maxRetries: this.retryConfig.maxRetries,
      baseDelay: this.retryConfig.baseDelay,
      fallbackEnabled: this.fallbackConfig.enabled,
    });
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: string,
  ): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let totalDelay = 0;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();

        // 成功时记录指标
        const duration = Date.now() - startTime;
        logger.debug('请求成功', {
          context,
          attempt: attempt + 1,
          duration,
          totalDelay,
        });

        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalDelay,
          fallbackUsed: false,
        };
      } catch (error: any) {
        lastError = error as Error;

        // 检查是否应该重试
        if (attempt === this.retryConfig.maxRetries || !this.shouldRetry(lastError)) {
          break;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt);
        totalDelay += delay;

        // 调用重试回调
        this.retryConfig.onRetry?.(attempt + 1, lastError, delay);

        logger.warn('请求失败，准备重试', {
          context,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries + 1,
          error: lastError.message,
          delay,
          nextRetryIn: new Date(Date.now() + delay).toISOString(),
        });

        // 等待后重试
        await this.sleep(delay);
      }
    }

    // 所有重试都失败，尝试降级处理
    if (this.fallbackConfig.enabled) {
      const fallbackResult = await this.executeFallback<T>(lastError!);
      return {
        success: true,
        data: fallbackResult,
        attempts: this.retryConfig.maxRetries + 1,
        totalDelay,
        fallbackUsed: true,
      };
    }

    // 重试失败且无降级处理
    const duration = Date.now() - startTime;
    logger.error('请求最终失败', {
      context,
      totalAttempts: this.retryConfig.maxRetries + 1,
      duration,
      totalDelay,
      finalError: lastError?.message,
    });

    const result: RetryResult<T> = {
      success: false,
      attempts: this.retryConfig.maxRetries + 1,
      totalDelay,
      fallbackUsed: false,
    };

    if (lastError) {
      result.error = lastError;
    }

    return result;
  }

  /**
   * 执行带去重的重试操作
   */
  async executeWithRetryAndDeduplication<T>(
    requestKey: string,
    operation: () => Promise<T>,
    context?: string,
  ): Promise<RetryResult<T>> {
    return this.deduplicator.execute(requestKey, async () => {
      return this.executeWithRetry(operation, context);
    });
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error): boolean {
    // 检查错误类型
    const errorCode = (error as any).code;
    if (errorCode && this.retryConfig.retryableErrors?.includes(errorCode)) {
      return true;
    }

    // 检查HTTP状态码
    const statusCode = (error as any).response?.status || (error as any).status;
    if (statusCode && this.retryConfig.retryableStatusCodes?.includes(statusCode)) {
      return true;
    }

    // 检查错误消息
    const errorMessage = error.message.toLowerCase();
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'socket',
      'econnreset',
      'etimedout',
    ];

    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    // 基础延迟计算
    switch (this.retryConfig.backoffFactor) {
      case 1: // 固定延迟
        delay = this.retryConfig.baseDelay;
        break;
      case 2: // 线性退避
        delay = this.retryConfig.baseDelay * (attempt + 1);
        break;
      default: // 指数退避
        delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt);
        break;
    }

    // 限制最大延迟
    delay = Math.min(delay, this.retryConfig.maxDelay);

    // 添加抖动
    if (this.retryConfig.enableJitter) {
      const jitter = delay * 0.1 * Math.random(); // 10% 的抖动
      delay += jitter;
    }

    return Math.floor(delay);
  }

  /**
   * 执行降级处理
   */
  private async executeFallback<T>(error: Error): Promise<T> {
    logger.warn('执行降级处理', {
      error: error.message,
      fallbackProvider: this.fallbackConfig.fallbackProvider,
    });

    // 检查缓存
    if (this.fallbackConfig.cacheFallbackResponse) {
      const cacheKey = 'fallback_response';
      const cached = this.fallbackCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.fallbackConfig.cacheTTL) {
        logger.debug('使用缓存的降级响应');
        return cached.data as T;
      }
    }

    // 返回降级响应
    let fallbackResponse: T;

    if (this.fallbackConfig.fallbackResponse) {
      fallbackResponse = this.fallbackConfig.fallbackResponse as T;
    } else {
      // 默认降级响应
      fallbackResponse = {
        error: '服务暂时不可用，请稍后重试',
        fallback: true,
        timestamp: new Date().toISOString(),
      } as T;
    }

    // 缓存降级响应
    if (this.fallbackConfig.cacheFallbackResponse) {
      const cacheKey = 'fallback_response';

      // 检查缓存大小
      if (this.fallbackCache.size >= this.fallbackConfig.maxCacheSize) {
        // 删除最旧的缓存项
        const keys = Array.from(this.fallbackCache.keys());
        if (keys.length > 0) {
          const oldestKey = keys[0];
          if (oldestKey !== undefined) {
            this.fallbackCache.delete(oldestKey);
          }
        }
      }

      this.fallbackCache.set(cacheKey, {
        data: fallbackResponse,
        timestamp: Date.now(),
      });
    }

    return fallbackResponse;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取去重指标
   */
  getDeduplicationMetrics(): RequestMetrics[] {
    return this.deduplicator.getMetrics();
  }

  /**
   * 清理缓存
   */
  clearFallbackCache(): void {
    this.fallbackCache.clear();
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.deduplicator.destroy();
    this.fallbackCache.clear();
  }
}

/**
 * 创建默认重试配置
 */
export function createDefaultRetryConfig(): RetryConfig {
  return {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    enableJitter: true,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
    ],
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  };
}

/**
 * 创建默认降级配置
 */
export function createDefaultFallbackConfig(): FallbackConfig {
  return {
    enabled: true,
    fallbackResponse: {
      error: '服务暂时不可用，请稍后重试',
      fallback: true,
      timestamp: new Date().toISOString(),
    },
    cacheFallbackResponse: true,
    maxCacheSize: 100,
    cacheTTL: 300000, // 5分钟
  };
}
