/**
 * 极致优化的错误处理和降级策略服务
 * 专注于快速错误检测、智能降级和系统韧性
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

import logger from '@/utils/logger';
import {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ExternalServiceError,
  ResourceError,
  BusinessLogicError,
  SystemError,
  createErrorFromUnknown
} from '@/types/errors';

// 错误级别定义
export enum ErrorLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 降级策略类型
export enum FallbackStrategy {
  RETRY = 'retry',
  CACHED_RESPONSE = 'cached_response',
  SIMPLIFIED_RESPONSE = 'simplified_response',
  ALTERNATIVE_SERVICE = 'alternative_service',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  FAST_FAIL = 'fast_fail'
}

// 错误分类
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  EXTERNAL_SERVICE = 'external_service',
  RESOURCE = 'resource',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic',
  UNKNOWN = 'unknown'
}

// 错误模式定义
interface ErrorPattern {
  id: string;
  category: ErrorCategory;
  level: ErrorLevel;
  keywords: string[];
  fallbackStrategy: FallbackStrategy;
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  timeoutMs: number;
}

// 错误统计
interface ErrorStats {
  totalCount: number;
  errorCounts: Map<string, number>;
  errorRates: Map<string, number>;
  averageResolutionTime: number;
  circuitBreakerStates: Map<string, boolean>;
  lastErrors: Array<{
    timestamp: number;
    category: ErrorCategory;
    message: string;
    context?: any;
  }>;
}

// 降级响应缓存
interface FallbackResponse {
  id: string;
  data: any;
  timestamp: number;
  ttl: number;
  strategy: FallbackStrategy;
  metadata?: any;
}

/**
 * 极致优化的错误处理服务
 */
export class OptimizedErrorHandlingService extends EventEmitter {
  // 单例模式
  private static instance: OptimizedErrorHandlingService;

  // 错误模式注册表
  private errorPatterns: Map<string, ErrorPattern> = new Map();

  // 错误统计
  private stats: ErrorStats;

  // 降级响应缓存
  private fallbackCache: Map<string, FallbackResponse> = new Map();

  // 熔断器状态
  private circuitBreakers: Map<string, {
    failureCount: number;
    lastFailureTime: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    nextAttemptTime: number;
  }> = new Map();

  // 性能监控
  private performanceMetrics = {
    totalErrors: 0,
    handledErrors: 0,
    fallbackUsed: 0,
    averageHandlingTime: 0,
    maxHandlingTime: 0,
    minHandlingTime: Infinity
  };

  // 配置
  private config = {
    maxCacheSize: 1000,
    defaultFallbackTTL: 300000, // 5分钟
    maxRetryAttempts: 3,
    circuitBreakerTimeout: 60000, // 1分钟
    cleanupInterval: 60000, // 1分钟
    statsHistoryLimit: 1000
  };

  private constructor() {
    super();
    this.initializeErrorPatterns();
    this.initializeStats();

    // 启动定期清理
    setInterval(() => this.cleanup(), this.config.cleanupInterval);

    logger.info('OptimizedErrorHandlingService 初始化完成');
  }

  /**
   * 获取单例实例
   */
  static getInstance(): OptimizedErrorHandlingService {
    if (!OptimizedErrorHandlingService.instance) {
      OptimizedErrorHandlingService.instance = new OptimizedErrorHandlingService();
    }
    return OptimizedErrorHandlingService.instance;
  }

  /**
   * 初始化错误模式
   */
  private initializeErrorPatterns(): void {
    const patterns: ErrorPattern[] = [
      {
        id: 'validation_error',
        category: ErrorCategory.VALIDATION,
        level: ErrorLevel.LOW,
        keywords: ['validation', 'invalid', 'required', 'format'],
        fallbackStrategy: FallbackStrategy.FAST_FAIL,
        maxRetries: 0,
        retryDelay: 0,
        circuitBreakerThreshold: 100,
        timeoutMs: 100
      },
      {
        id: 'authentication_error',
        category: ErrorCategory.AUTHENTICATION,
        level: ErrorLevel.MEDIUM,
        keywords: ['unauthorized', 'authentication', 'token', 'login'],
        fallbackStrategy: FallbackStrategy.FAST_FAIL,
        maxRetries: 1,
        retryDelay: 1000,
        circuitBreakerThreshold: 50,
        timeoutMs: 500
      },
      {
        id: 'authorization_error',
        category: ErrorCategory.AUTHORIZATION,
        level: ErrorLevel.MEDIUM,
        keywords: ['forbidden', 'permission', 'access denied'],
        fallbackStrategy: FallbackStrategy.FAST_FAIL,
        maxRetries: 0,
        retryDelay: 0,
        circuitBreakerThreshold: 50,
        timeoutMs: 200
      },
      {
        id: 'network_error',
        category: ErrorCategory.NETWORK,
        level: ErrorLevel.HIGH,
        keywords: ['network', 'connection', 'timeout', 'econnrefused'],
        fallbackStrategy: FallbackStrategy.RETRY,
        maxRetries: 3,
        retryDelay: 2000,
        circuitBreakerThreshold: 10,
        timeoutMs: 5000
      },
      {
        id: 'external_service_error',
        category: ErrorCategory.EXTERNAL_SERVICE,
        level: ErrorLevel.HIGH,
        keywords: ['external', 'api', 'service unavailable', 'rate limit'],
        fallbackStrategy: FallbackStrategy.ALTERNATIVE_SERVICE,
        maxRetries: 2,
        retryDelay: 3000,
        circuitBreakerThreshold: 5,
        timeoutMs: 10000
      },
      {
        id: 'resource_error',
        category: ErrorCategory.RESOURCE,
        level: ErrorLevel.CRITICAL,
        keywords: ['resource', 'memory', 'disk', 'quota'],
        fallbackStrategy: FallbackStrategy.GRACEFUL_DEGRADATION,
        maxRetries: 1,
        retryDelay: 5000,
        circuitBreakerThreshold: 3,
        timeoutMs: 15000
      },
      {
        id: 'system_error',
        category: ErrorCategory.SYSTEM,
        level: ErrorLevel.CRITICAL,
        keywords: ['system', 'internal', 'critical', 'fatal'],
        fallbackStrategy: FallbackStrategy.CACHED_RESPONSE,
        maxRetries: 1,
        retryDelay: 10000,
        circuitBreakerThreshold: 2,
        timeoutMs: 20000
      },
      {
        id: 'business_logic_error',
        category: ErrorCategory.BUSINESS_LOGIC,
        level: ErrorLevel.MEDIUM,
        keywords: ['business', 'logic', 'rule', 'constraint'],
        fallbackStrategy: FallbackStrategy.SIMPLIFIED_RESPONSE,
        maxRetries: 1,
        retryDelay: 1000,
        circuitBreakerThreshold: 20,
        timeoutMs: 1000
      }
    ];

    patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });
  }

  /**
   * 初始化统计
   */
  private initializeStats(): void {
    this.stats = {
      totalCount: 0,
      errorCounts: new Map(),
      errorRates: new Map(),
      averageResolutionTime: 0,
      circuitBreakerStates: new Map(),
      lastErrors: []
    };
  }

  /**
   * 处理错误的主要入口
   */
  async handleError(
    error: unknown,
    context?: {
      operation?: string;
      requestId?: string;
      userId?: string;
      metadata?: any;
    }
  ): Promise<{
    handled: boolean;
    response?: any;
    strategy?: FallbackStrategy;
    shouldRetry?: boolean;
    retryDelay?: number;
  }> {
    const startTime = performance.now();
    this.performanceMetrics.totalErrors++;

    try {
      // 快速错误分类
      const typedError = this.classifyError(error);
      const pattern = this.matchErrorPattern(typedError);

      if (!pattern) {
        logger.warn('未匹配的错误模式', { error: typedError.message });
        return { handled: false };
      }

      // 检查熔断器
      const circuitBreakerKey = this.getCircuitBreakerKey(pattern, context);
      if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
        logger.warn('熔断器开启，执行降级策略', {
          patternId: pattern.id,
          circuitBreakerKey
        });

        const fallbackResponse = await this.executeFallbackStrategy(
          pattern,
          typedError,
          context
        );

        return {
          handled: true,
          response: fallbackResponse,
          strategy: pattern.fallbackStrategy
        };
      }

      // 执行错误处理
      const result = await this.processErrorWithPattern(pattern, typedError, context);

      // 更新统计
      this.updateStats(pattern, typedError, context);

      // 更新性能指标
      const handlingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(handlingTime);

      this.performanceMetrics.handledErrors++;

      return result;

    } catch (handlingError) {
      logger.error('错误处理失败', {
        originalError: error instanceof Error ? error.message : String(error),
        handlingError: handlingError instanceof Error ? handlingError.message : String(handlingError),
        context
      });

      return { handled: false };
    }
  }

  /**
   * 错误分类
   */
  private classifyError(error: unknown): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    // 快速分类未知错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorMessageLower = errorMessage.toLowerCase();

    // 使用关键词匹配快速分类
    if (errorMessageLower.includes('validation') ||
        errorMessageLower.includes('invalid') ||
        errorMessageLower.includes('required')) {
      return createErrorFromUnknown(error, { code: 'VALIDATION_ERROR' });
    }

    if (errorMessageLower.includes('unauthorized') ||
        errorMessageLower.includes('authentication')) {
      return createErrorFromUnknown(error, { code: 'AUTHENTICATION_ERROR' });
    }

    if (errorMessageLower.includes('forbidden') ||
        errorMessageLower.includes('permission')) {
      return createErrorFromUnknown(error, { code: 'AUTHORIZATION_ERROR' });
    }

    if (errorMessageLower.includes('network') ||
        errorMessageLower.includes('connection') ||
        errorMessageLower.includes('timeout')) {
      return createErrorFromUnknown(error, { code: 'NETWORK_ERROR' });
    }

    if (errorMessageLower.includes('rate limit') ||
        errorMessageLower.includes('service unavailable')) {
      return createErrorFromUnknown(error, { code: 'EXTERNAL_SERVICE_ERROR' });
    }

    if (errorMessageLower.includes('resource') ||
        errorMessageLower.includes('memory') ||
        errorMessageLower.includes('disk')) {
      return createErrorFromUnknown(error, { code: 'RESOURCE_ERROR' });
    }

    if (errorMessageLower.includes('system') ||
        errorMessageLower.includes('internal') ||
        errorMessageLower.includes('critical')) {
      return createErrorFromUnknown(error, { code: 'SYSTEM_ERROR' });
    }

    return createErrorFromUnknown(error, { code: 'UNKNOWN_ERROR' });
  }

  /**
   * 匹配错误模式
   */
  private matchErrorPattern(error: BaseError): ErrorPattern | null {
    // 根据错误代码直接匹配
    for (const pattern of this.errorPatterns.values()) {
      if (error.code === pattern.id ||
          error.code.toLowerCase().includes(pattern.id.replace('_', ''))) {
        return pattern;
      }
    }

    // 根据关键词匹配
    const errorMessage = error.message.toLowerCase();
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.keywords.some(keyword => errorMessage.includes(keyword))) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * 处理特定模式的错误
   */
  private async processErrorWithPattern(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<{
    handled: boolean;
    response?: any;
    strategy?: FallbackStrategy;
    shouldRetry?: boolean;
    retryDelay?: number;
  }> {
    const circuitBreakerKey = this.getCircuitBreakerKey(pattern, context);

    // 更新熔断器状态
    this.updateCircuitBreaker(circuitBreakerKey, false);

    // 根据策略处理错误
    switch (pattern.fallbackStrategy) {
      case FallbackStrategy.RETRY:
        return this.handleRetryStrategy(pattern, error, context);

      case FallbackStrategy.CACHED_RESPONSE:
        return this.handleCachedResponseStrategy(pattern, error, context);

      case FallbackStrategy.SIMPLIFIED_RESPONSE:
        return this.handleSimplifiedResponseStrategy(pattern, error, context);

      case FallbackStrategy.ALTERNATIVE_SERVICE:
        return this.handleAlternativeServiceStrategy(pattern, error, context);

      case FallbackStrategy.GRACEFUL_DEGRADATION:
        return this.handleGracefulDegradationStrategy(pattern, error, context);

      case FallbackStrategy.FAST_FAIL:
      default:
        return { handled: false };
    }
  }

  /**
   * 重试策略处理
   */
  private async handleRetryStrategy(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<{
    handled: boolean;
    shouldRetry?: boolean;
    retryDelay?: number;
  }> {
    const retryCount = context?.retryCount || 0;

    if (retryCount >= pattern.maxRetries) {
      // 超过最大重试次数，标记熔断器
      const circuitBreakerKey = this.getCircuitBreakerKey(pattern, context);
      this.updateCircuitBreaker(circuitBreakerKey, true);

      return { handled: false };
    }

    logger.info('执行重试策略', {
      patternId: pattern.id,
      retryCount: retryCount + 1,
      maxRetries: pattern.maxRetries,
      retryDelay: pattern.retryDelay
    });

    return {
      handled: true,
      shouldRetry: true,
      retryDelay: pattern.retryDelay
    };
  }

  /**
   * 缓存响应策略处理
   */
  private async handleCachedResponseStrategy(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<{
    handled: boolean;
    response?: any;
    strategy?: FallbackStrategy;
  }> {
    const cacheKey = this.generateCacheKey(pattern, context);
    const cachedResponse = this.fallbackCache.get(cacheKey);

    if (cachedResponse && Date.now() < cachedResponse.timestamp + cachedResponse.ttl) {
      logger.info('使用缓存响应', {
        patternId: pattern.id,
        cacheKey,
        cacheAge: Date.now() - cachedResponse.timestamp
      });

      this.performanceMetrics.fallbackUsed++;

      return {
        handled: true,
        response: cachedResponse.data,
        strategy: FallbackStrategy.CACHED_RESPONSE
      };
    }

    // 没有有效缓存，返回默认响应
    const defaultResponse = this.generateDefaultResponse(pattern, error);

    // 缓存默认响应
    this.fallbackCache.set(cacheKey, {
      id: generateId(),
      data: defaultResponse,
      timestamp: Date.now(),
      ttl: this.config.defaultFallbackTTL,
      strategy: FallbackStrategy.CACHED_RESPONSE
    });

    this.performanceMetrics.fallbackUsed++;

    return {
      handled: true,
      response: defaultResponse,
      strategy: FallbackStrategy.CACHED_RESPONSE
    };
  }

  /**
   * 简化响应策略处理
   */
  private async handleSimplifiedResponseStrategy(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<{
    handled: boolean;
    response?: any;
    strategy?: FallbackStrategy;
  }> {
    const simplifiedResponse = this.generateSimplifiedResponse(pattern, error, context);

    this.performanceMetrics.fallbackUsed++;

    return {
      handled: true,
      response: simplifiedResponse,
      strategy: FallbackStrategy.SIMPLIFIED_RESPONSE
    };
  }

  /**
   * 备用服务策略处理
   */
  private async handleAlternativeServiceStrategy(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<{
    handled: boolean;
    response?: any;
    strategy?: FallbackStrategy;
  }> {
    // 这里可以实现备用服务的逻辑
    // 例如：使用备用API端点、不同的提供商等

    logger.info('使用备用服务策略', {
      patternId: pattern.id,
      context
    });

    const alternativeResponse = this.generateAlternativeResponse(pattern, error, context);

    this.performanceMetrics.fallbackUsed++;

    return {
      handled: true,
      response: alternativeResponse,
      strategy: FallbackStrategy.ALTERNATIVE_SERVICE
    };
  }

  /**
   * 优雅降级策略处理
   */
  private async handleGracefulDegradationStrategy(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<{
    handled: boolean;
    response?: any;
    strategy?: FallbackStrategy;
  }> {
    const degradedResponse = this.generateDegradedResponse(pattern, error, context);

    this.performanceMetrics.fallbackUsed++;

    return {
      handled: true,
      response: degradedResponse,
      strategy: FallbackStrategy.GRACEFUL_DEGRADATION
    };
  }

  /**
   * 生成默认响应
   */
  private generateDefaultResponse(pattern: ErrorPattern, error: BaseError): any {
    return {
      success: false,
      error: {
        code: error.code,
        message: '服务暂时不可用，请稍后重试',
        category: pattern.category,
        level: pattern.level,
        timestamp: new Date().toISOString()
      },
      fallback: true
    };
  }

  /**
   * 生成简化响应
   */
  private generateSimplifiedResponse(pattern: ErrorPattern, error: BaseError, context?: any): any {
    return {
      success: false,
      error: {
        code: error.code,
        message: '请求处理失败，已简化处理',
        simplified: true
      },
      data: this.getSimplifiedData(pattern, context),
      fallback: true
    };
  }

  /**
   * 生成备用响应
   */
  private generateAlternativeResponse(pattern: ErrorPattern, error: BaseError, context?: any): any {
    return {
      success: false,
      error: {
        code: error.code,
        message: '主服务不可用，正在使用备用服务',
        alternative: true
      },
      data: this.getAlternativeData(pattern, context),
      fallback: true
    };
  }

  /**
   * 生成降级响应
   */
  private generateDegradedResponse(pattern: ErrorPattern, error: BaseError, context?: any): any {
    return {
      success: false,
      error: {
        code: error.code,
        message: '服务性能下降，功能已部分降级',
        degraded: true
      },
      data: this.getDegradedData(pattern, context),
      fallback: true
    };
  }

  /**
   * 获取简化数据
   */
  private getSimplifiedData(pattern: ErrorPattern, context?: any): any {
    // 根据不同的错误类型返回简化的数据
    switch (pattern.category) {
      case ErrorCategory.EXTERNAL_SERVICE:
        return { message: '外部服务暂时不可用' };
      case ErrorCategory.NETWORK:
        return { message: '网络连接异常' };
      default:
        return { message: '服务暂时不可用' };
    }
  }

  /**
   * 获取备用数据
   */
  private getAlternativeData(pattern: ErrorPattern, context?: any): any {
    // 根据上下文返回备用数据
    if (context?.operation === 'chat') {
      return {
        message: '智能体服务切换中，请稍后重试',
        suggestions: ['尝试重新发送消息', '检查网络连接', '联系技术支持']
      };
    }

    return { message: '正在使用备用服务' };
  }

  /**
   * 获取降级数据
   */
  private getDegradedData(pattern: ErrorPattern, context?: any): any {
    // 返回降级但可用的数据
    if (context?.operation === 'chat') {
      return {
        message: '服务性能下降，响应可能较慢',
        limited: true,
        suggestions: ['减少并发请求', '简化消息内容']
      };
    }

    return { message: '服务性能下降' };
  }

  /**
   * 获取熔断器键
   */
  private getCircuitBreakerKey(pattern: ErrorPattern, context?: any): string {
    const parts = [pattern.id];

    if (context?.operation) {
      parts.push(context.operation);
    }

    if (context?.userId) {
      parts.push(context.userId);
    }

    return parts.join(':');
  }

  /**
   * 检查熔断器是否开启
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(key);

    if (!circuitBreaker) {
      return false;
    }

    const now = Date.now();

    switch (circuitBreaker.state) {
      case 'OPEN':
        // 检查是否可以进入半开状态
        if (now >= circuitBreaker.nextAttemptTime) {
          circuitBreaker.state = 'HALF_OPEN';
          logger.info('熔断器进入半开状态', { key });
          return false;
        }
        return true;

      case 'HALF_OPEN':
        return false;

      default:
        return false;
    }
  }

  /**
   * 更新熔断器状态
   */
  private updateCircuitBreaker(key: string, failed: boolean): void {
    let circuitBreaker = this.circuitBreakers.get(key);

    if (!circuitBreaker) {
      circuitBreaker = {
        failureCount: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
        nextAttemptTime: 0
      };
      this.circuitBreakers.set(key, circuitBreaker);
    }

    const now = Date.now();

    if (failed) {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = now;

      // 检查是否需要开启熔断器
      if (circuitBreaker.failureCount >= 5) { // 简化逻辑：5次失败后开启
        circuitBreaker.state = 'OPEN';
        circuitBreaker.nextAttemptTime = now + this.config.circuitBreakerTimeout;

        logger.warn('熔断器开启', {
          key,
          failureCount: circuitBreaker.failureCount,
          nextAttemptTime: new Date(circuitBreaker.nextAttemptTime).toISOString()
        });
      }
    } else {
      // 成功，重置计数器
      if (circuitBreaker.state === 'HALF_OPEN') {
        circuitBreaker.state = 'CLOSED';
        circuitBreaker.failureCount = 0;

        logger.info('熔断器关闭', { key });
      } else if (circuitBreaker.state === 'CLOSED') {
        circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
      }
    }

    // 更新统计
    this.stats.circuitBreakerStates.set(key, circuitBreaker.state !== 'CLOSED');
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(pattern: ErrorPattern, context?: any): string {
    const keyData = {
      patternId: pattern.id,
      operation: context?.operation,
      userId: context?.userId
    };

    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * 执行降级策略
   */
  private async executeFallbackStrategy(
    pattern: ErrorPattern,
    error: BaseError,
    context?: any
  ): Promise<any> {
    switch (pattern.fallbackStrategy) {
      case FallbackStrategy.CACHED_RESPONSE:
        return this.handleCachedResponseStrategy(pattern, error, context);

      case FallbackStrategy.SIMPLIFIED_RESPONSE:
        return this.handleSimplifiedResponseStrategy(pattern, error, context);

      case FallbackStrategy.ALTERNATIVE_SERVICE:
        return this.handleAlternativeServiceStrategy(pattern, error, context);

      case FallbackStrategy.GRACEFUL_DEGRADATION:
        return this.handleGracefulDegradationStrategy(pattern, error, context);

      default:
        return this.generateDefaultResponse(pattern, error);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(pattern: ErrorPattern, error: BaseError, context?: any): void {
    this.stats.totalCount++;

    // 更新错误计数
    const errorKey = `${pattern.category}:${error.code}`;
    const currentCount = this.stats.errorCounts.get(errorKey) || 0;
    this.stats.errorCounts.set(errorKey, currentCount + 1);

    // 更新错误率
    const totalInCategory = Array.from(this.stats.errorCounts.entries())
      .filter(([key]) => key.startsWith(pattern.category))
      .reduce((sum, [, count]) => sum + count, 0);

    this.stats.errorRates.set(pattern.category, totalInCategory / this.stats.totalCount);

    // 记录最近的错误
    this.stats.lastErrors.push({
      timestamp: Date.now(),
      category: pattern.category,
      message: error.message,
      context
    });

    // 限制历史记录长度
    if (this.stats.lastErrors.length > this.config.statsHistoryLimit) {
      this.stats.lastErrors = this.stats.lastErrors.slice(-this.config.statsHistoryLimit);
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(handlingTime: number): void {
    this.performanceMetrics.maxHandlingTime = Math.max(
      this.performanceMetrics.maxHandlingTime,
      handlingTime
    );

    this.performanceMetrics.minHandlingTime = Math.min(
      this.performanceMetrics.minHandlingTime,
      handlingTime
    );

    // 计算平均处理时间
    const totalHandled = this.performanceMetrics.handledErrors;
    if (totalHandled > 0) {
      this.performanceMetrics.averageHandlingTime =
        (this.performanceMetrics.averageHandlingTime * (totalHandled - 1) + handlingTime) / totalHandled;
    }
  }

  /**
   * 定期清理
   */
  private cleanup(): void {
    // 清理过期的缓存
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, response] of this.fallbackCache.entries()) {
      if (now > response.timestamp + response.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.fallbackCache.delete(key));

    // 限制缓存大小
    if (this.fallbackCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.fallbackCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = entries.slice(0, this.fallbackCache.size - this.config.maxCacheSize);
      toDelete.forEach(([key]) => this.fallbackCache.delete(key));
    }

    // 清理过期的熔断器状态
    for (const [key, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.state === 'OPEN' && now > circuitBreaker.nextAttemptTime) {
        circuitBreaker.state = 'HALF_OPEN';
      }
    }

    if (expiredKeys.length > 0) {
      logger.debug('错误处理服务清理完成', {
        expiredCacheEntries: expiredKeys.length,
        totalCacheEntries: this.fallbackCache.size,
        totalCircuitBreakers: this.circuitBreakers.size
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    performance: typeof this.performanceMetrics;
    errors: ErrorStats;
    cache: {
      size: number;
      hitRate: number;
    };
    circuitBreakers: Array<{
      key: string;
      state: string;
      failureCount: number;
    }>;
  } {
    return {
      performance: { ...this.performanceMetrics },
      errors: { ...this.stats },
      cache: {
        size: this.fallbackCache.size,
        hitRate: this.performanceMetrics.fallbackUsed / Math.max(1, this.performanceMetrics.totalErrors)
      },
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([key, cb]) => ({
        key,
        state: cb.state,
        failureCount: cb.failureCount
      }))
    };
  }

  /**
   * 手动添加缓存响应
   */
  addFallbackResponse(
    key: string,
    data: any,
    ttl: number = this.config.defaultFallbackTTL
  ): void {
    this.fallbackCache.set(key, {
      id: generateId(),
      data,
      timestamp: Date.now(),
      ttl,
      strategy: FallbackStrategy.CACHED_RESPONSE
    });
  }

  /**
   * 重置熔断器
   */
  resetCircuitBreaker(key: string): void {
    const circuitBreaker = this.circuitBreakers.get(key);
    if (circuitBreaker) {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.failureCount = 0;
      circuitBreaker.lastFailureTime = 0;
      circuitBreaker.nextAttemptTime = 0;

      logger.info('熔断器已重置', { key });
    }
  }

  /**
   * 健康检查
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  } {
    const stats = this.getStats();
    const now = Date.now();

    // 计算最近一分钟的错误率
    const recentErrors = stats.errors.lastErrors.filter(
      error => now - error.timestamp < 60000
    );

    const recentErrorRate = recentErrors.length / 60; // 每秒错误数
    const openCircuitBreakers = stats.circuitBreakers.filter(cb => cb.state !== 'CLOSED');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (recentErrorRate > 10 || openCircuitBreakers.length > stats.circuitBreakers.length * 0.5) {
      status = 'unhealthy';
    } else if (recentErrorRate > 5 || openCircuitBreakers.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        recentErrorRate,
        openCircuitBreakers: openCircuitBreakers.length,
        totalCircuitBreakers: stats.circuitBreakers.length,
        cacheHitRate: stats.cache.hitRate,
        averageHandlingTime: stats.performance.averageHandlingTime
      }
    };
  }
}

// 导出单例实例
export const optimizedErrorHandlingService = OptimizedErrorHandlingService.getInstance();