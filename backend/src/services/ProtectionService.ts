/**
 * 保护服务集成管理器
 * 统一管理熔断器、限流器、重试机制和监控
 */

import { Request, Response, NextFunction } from 'express';
import { CircuitBreakerManager, CircuitBreakerConfig, CircuitState } from './CircuitBreakerService';
import { MultiDimensionRateLimiter, RateLimitConfig } from './RateLimitService';
import { RetryService, RetryConfig, FallbackConfig, RequestDeduplicationConfig } from './RetryService';
import { MonitoringService } from './MonitoringService';

export interface ProtectionConfig {
  circuitBreaker: CircuitBreakerConfig;
  rateLimit: RateLimitConfig;
  retry: RetryConfig;
  fallback: FallbackConfig;
  deduplication: RequestDeduplicationConfig;
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    slaUpdateInterval: number;
  };
  alerts: {
    consoleEnabled: boolean;
    webhookEnabled: boolean;
    webhookUrl?: string;
    emailEnabled: boolean;
    emailConfig?: any;
  };
}

export interface ProtectedRequestContext {
  requestId: string;
  agentId: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ProtectionMetrics {
  circuitBreaker: any;
  rateLimit: any;
  retry: any;
  monitoring: any;
  overall: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    systemHealth: string;
  };
}

/**
 * 保护服务主类
 */
export class ProtectionService {
  public circuitBreakerManager: CircuitBreakerManager;
  public multiDimensionRateLimiter: MultiDimensionRateLimiter;
  private retryService: RetryService;
  public monitoringService: MonitoringService;
  private config: ProtectionConfig;

  constructor(config?: Partial<ProtectionConfig>) {
    this.config = this.mergeWithDefaultConfig(config);

    // 初始化各组件
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
    this.multiDimensionRateLimiter = new MultiDimensionRateLimiter({
      ip: {
        windowMs: 60000, // 1分钟
        maxRequests: parseInt(process.env.RATE_LIMIT_POINTS || '100'),
        keyGenerator: (req: Request) => req.ip || 'unknown'
      },
      user: {
        windowMs: 60000, // 1分钟
        maxRequests: 50,
        keyGenerator: (req: Request) => (req as any).user?.id || 'anonymous'
      },
      endpoint: {
        windowMs: 60000, // 1分钟
        maxRequests: 200,
        keyGenerator: (req: Request) => `${req.method}:${req.path}`
      }
    });

    this.retryService = new RetryService(
      this.config.retry,
      this.config.fallback,
      this.config.deduplication
    );

    this.monitoringService = new MonitoringService(
      this.circuitBreakerManager,
      this.multiDimensionRateLimiter
    );

    console.info('保护服务初始化完成', {
      circuitBreaker: this.config.circuitBreaker,
      rateLimit: this.config.rateLimit,
      retry: this.config.retry,
      monitoring: this.config.monitoring.enabled
    });
  }

  /**
   * 执行受保护的API请求
   */
  async executeProtectedRequest<T>(
    context: ProtectedRequestContext,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;

    try {
      // 1. 检查限流
      const rateLimitResult = this.checkRateLimit(context);
      if (!rateLimitResult.allowed) {
        throw new Error(`请求被限流: ${rateLimitResult.reason}`);
      }

      // 2. 获取熔断器并执行操作
      const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
        `agent_${context.agentId}`,
        this.config.circuitBreaker,
        {
          onFailure: (err, metrics) => {
            console.warn(`熔断器触发`, {
              agentId: context.agentId,
              error: err.message,
              state: metrics.state,
              failureCount: metrics.failureCount
            });
          },
          onSuccess: (responseTime, metrics) => {
            console.debug(`熔断器请求成功`, {
              agentId: context.agentId,
              responseTime,
              state: metrics.state
            });
          }
        }
      );

      // 3. 执行带重试的操作
      const result = await this.retryService.executeWithRetryAndDeduplication(
        `${context.agentId}_${context.requestId}`,
        () => circuitBreaker.execute(operation),
        `agent_${context.agentId}`
      );

      success = true;
      if (result.data === undefined) {
        throw new Error('重试服务返回了undefined数据');
      }
      return result.data;

    } catch (err) {
      error = err as Error;
      throw error;
    } finally {
      // 4. 记录监控指标
      const responseTime = Date.now() - startTime;
      this.monitoringService.recordRequest(responseTime, success, error?.message);
    }
  }

  /**
   * 检查限流
   */
  private checkRateLimit(context: ProtectedRequestContext): { allowed: boolean; reason?: string } {
    // 模拟请求对象用于限流检查
    const mockReq = {
      ip: context.ip,
      method: 'POST',
      path: `/api/chat/completions`,
      user: context.userId ? { id: context.userId } : undefined,
      get: (header: string) => '',
      header: (header: string) => '',
      accepts: (types: string[]) => false,
      acceptsCharsets: (charsets: string[]) => false,
      acceptsEncodings: (encodings: string[]) => false,
      acceptsLanguages: (languages: string[]) => false,
      is: (type: string) => false,
      param: (name: string) => undefined,
      query: (name: string) => undefined,
      cookies: {},
      signedCookies: {},
      body: {},
      files: {},
      protocol: 'http',
      secure: false,
      xhr: false,
      subdomains: [],
      originalUrl: '/api/chat/completions',
      baseUrl: '',
      url: '/api/chat/completions',
      app: undefined as any,
      headers: {},
      connection: undefined as any,
      socket: undefined as any,
      complete: true,
      httpVersion: '1.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      trailers: {},
      rawTrailers: [],
      upgrade: false,
      res: undefined as any,
      next: undefined as any
    } as unknown as Request;

    const checkResult = this.multiDimensionRateLimiter.isAllowed(mockReq);

    if (!checkResult.allowed) {
      const failedResult = checkResult.results.find(r => !r.allowed);
      return {
        allowed: false,
        reason: failedResult ? `维度限制触发: ${failedResult.remaining}/${failedResult.resetTime}` : '未知限流原因'
      };
    }

    return { allowed: true };
  }

  /**
   * 创建受保护的中间件
   */
  createProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // 添加保护服务到请求对象
      (req as any).protectionService = this;

      // 生成请求上下文
      const userAgent = req.get('User-Agent');
      const userId = (req as any).user?.id;
      const context: ProtectedRequestContext = {
        requestId: this.generateRequestId(),
        agentId: req.body?.agentId || req.params?.agentId || 'unknown',
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        timestamp: new Date(),
        ...(userId && { userId }),
        ...(userAgent && { userAgent }),
      };

      // 添加上下文到请求对象
      (req as any).protectionContext = context;

      next();
    };
  }

  /**
   * 创建受保护的聊天端点处理器
   */
  createProtectedChatHandler(chatHandler: (req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response): Promise<void> => {
      const context = (req as any).protectionContext as ProtectedRequestContext;

      if (!context) {
        res.status(500).json({
          code: 'PROTECTION_CONTEXT_MISSING',
          message: '保护上下文缺失',
          timestamp: new Date().toISOString()
        });
        return;
      }

      try {
        await this.executeProtectedRequest(context, async () => {
          return chatHandler(req, res);
        });
      } catch (error) {
        console.error('受保护请求失败:', {
          requestId: context.requestId,
          agentId: context.agentId,
          error: (error as Error).message
        });

        // 如果是降级响应，返回成功状态
        if ((error as any).fallbackUsed) {
          res.json((error as any).data);
          return;
        }

        // 返回错误响应
        const statusCode = this.getErrorStatusCode(error as Error);
        res.status(statusCode).json({
          code: this.getErrorCode(error as Error),
          message: (error as Error).message,
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * 获取错误状态码
   */
  private getErrorStatusCode(error: Error): number {
    const message = error.message.toLowerCase();

    if (message.includes('熔断器')) return 503;
    if (message.includes('限流')) return 429;
    if (message.includes('超时')) return 408;
    if (message.includes('网络')) return 502;
    if (message.includes('不可用')) return 503;

    return 500;
  }

  /**
   * 获取错误代码
   */
  private getErrorCode(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('熔断器')) return 'CIRCUIT_BREAKER_OPEN';
    if (message.includes('限流')) return 'RATE_LIMIT_EXCEEDED';
    if (message.includes('超时')) return 'REQUEST_TIMEOUT';
    if (message.includes('网络')) return 'NETWORK_ERROR';
    if (message.includes('不可用')) return 'SERVICE_UNAVAILABLE';

    return 'INTERNAL_ERROR';
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取保护指标
   */
  getProtectionMetrics(): ProtectionMetrics {
    return {
      circuitBreaker: this.circuitBreakerManager.getAllCircuitBreakers(),
      rateLimit: this.multiDimensionRateLimiter.getAllMetrics(),
      retry: this.retryService.getDeduplicationMetrics(),
      monitoring: {
        performance: this.monitoringService.getPerformanceMetrics(),
        sla: this.monitoringService.getSLAMetrics(),
        health: this.monitoringService.getSystemHealth(),
        alerts: this.monitoringService.getActiveAlerts()
      },
      overall: {
        totalRequests: 0, // 从监控服务获取
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        systemHealth: this.monitoringService.getSystemHealth().status
      }
    };
  }

  
  /**
   * 手动重置熔断器
   */
  resetCircuitBreaker(agentId: string): void {
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(`agent_${agentId}`);
    circuitBreaker?.reset();
  }

  /**
   * 强制打开熔断器
   */
  forceOpenCircuitBreaker(agentId: string): void {
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(`agent_${agentId}`);
    circuitBreaker?.forceOpen();
  }

  /**
   * 重置所有保护机制
   */
  resetAllProtections(): void {
    this.circuitBreakerManager.resetAll();
    const allMetrics = this.multiDimensionRateLimiter.getAllMetrics();
    if (Array.isArray(allMetrics)) {
      allMetrics.forEach((metrics: any) => {
        if (Array.isArray(metrics)) {
          metrics.forEach((metric: any) => {
            // 重置限流器指标（如果提供方法）
          });
        }
      });
    }
  }

  /**
   * 销毁保护服务
   */
  destroy(): void {
    this.multiDimensionRateLimiter.destroy();
    this.retryService.destroy();
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaultConfig(config?: Partial<ProtectionConfig>): ProtectionConfig {
    const defaultConfig: ProtectionConfig = {
      circuitBreaker: {
        failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
        successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '3'),
        timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000'),
        resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
        monitoringEnabled: true
      },
      rateLimit: {
        windowMs: 60000,
        maxRequests: parseInt(process.env.RATE_LIMIT_POINTS || '100'),
        enableCacheProtection: true,
        enableBurstProtection: true,
        burstLimit: 20
      },
      retry: {
        maxRetries: parseInt(process.env.RETRY_MAX_RETRIES || '3'),
        baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000'),
        maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '10000'),
        backoffFactor: parseFloat(process.env.RETRY_BACKOFF_FACTOR || '2'),
        enableJitter: process.env.RETRY_ENABLE_JITTER === 'true',
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NETWORK_ERROR'],
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      fallback: {
        enabled: process.env.FALLBACK_ENABLED === 'true',
        fallbackResponse: {
          error: '服务暂时不可用，请稍后重试',
          fallback: true,
          timestamp: new Date().toISOString()
        },
        cacheFallbackResponse: true,
        maxCacheSize: parseInt(process.env.FALLBACK_MAX_CACHE_SIZE || '100'),
        cacheTTL: parseInt(process.env.FALLBACK_CACHE_TTL || '300000')
      },
      deduplication: {
        enabled: true,
        deduplicationWindow: 30000,
        maxConcurrentRequests: 100
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        metricsInterval: parseInt(process.env.MONITORING_METRICS_INTERVAL || '60000'),
        healthCheckInterval: parseInt(process.env.MONITORING_HEALTH_CHECK_INTERVAL || '60000'),
        slaUpdateInterval: parseInt(process.env.MONITORING_SLA_UPDATE_INTERVAL || '60000')
      },
      alerts: {
        consoleEnabled: process.env.ALERT_CONSOLE_ENABLED === 'true',
        webhookEnabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        ...(process.env.ALERT_WEBHOOK_URL && { webhookUrl: process.env.ALERT_WEBHOOK_URL }),
        emailEnabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        emailConfig: {
          smtpHost: process.env.ALERT_EMAIL_SMTP_HOST,
          smtpPort: parseInt(process.env.ALERT_EMAIL_SMTP_PORT || '587'),
          username: process.env.ALERT_EMAIL_USERNAME,
          password: process.env.ALERT_EMAIL_PASSWORD
        }
      }
    };

    return {
      ...defaultConfig,
      ...config,
      // 深度合并嵌套对象
      circuitBreaker: { ...defaultConfig.circuitBreaker, ...config?.circuitBreaker },
      rateLimit: { ...defaultConfig.rateLimit, ...config?.rateLimit },
      retry: { ...defaultConfig.retry, ...config?.retry },
      fallback: { ...defaultConfig.fallback, ...config?.fallback },
      deduplication: { ...defaultConfig.deduplication, ...config?.deduplication },
      monitoring: { ...defaultConfig.monitoring, ...config?.monitoring },
      alerts: { ...defaultConfig.alerts, ...config?.alerts }
    };
  }

  // 公共访问方法
  public getMonitoringService() {
    return this.monitoringService;
  }

  public getPerformanceMetrics() {
    return this.monitoringService.getPerformanceMetrics();
  }

  public getActiveAlerts() {
    return this.monitoringService.getActiveAlerts();
  }

  public getSystemHealth() {
    return this.monitoringService.getSystemHealth();
  }

  public getAllCircuitBreakers() {
    return this.circuitBreakerManager.getAllCircuitBreakers();
  }

  public getAllRateLimitMetrics() {
    return this.multiDimensionRateLimiter.getAllMetrics();
  }
}

/**
 * 全局保护服务实例
 */
let globalProtectionService: ProtectionService;

/**
 * 获取全局保护服务实例
 */
export function getProtectionService(): ProtectionService {
  if (!globalProtectionService) {
    globalProtectionService = new ProtectionService();
  }
  return globalProtectionService;
}

/**
 * 初始化保护服务
 */
export function initializeProtectionService(config?: Partial<ProtectionConfig>): ProtectionService {
  globalProtectionService = new ProtectionService(config);
  return globalProtectionService;
}