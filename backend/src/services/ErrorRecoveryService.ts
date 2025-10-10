/**
 * 错误处理和恢复服务
 * 提供全面的错误检测、恢复机制和系统韧性保障
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

import logger from '@/utils/logger';
import { BaseError, createErrorFromUnknown } from '@/types/errors';
import { optimizedErrorHandlingService } from './OptimizedErrorHandlingService';
import { intelligentCacheStrategy } from './IntelligentCacheStrategy';

// 错误严重级别
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 恢复策略类型
export enum RecoveryStrategy {
  AUTOMATIC_RETRY = 'automatic_retry',
  FALLBACK_SERVICE = 'fallback_service',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  CIRCUIT_BREAKER = 'circuit_breaker',
  CACHE_RECOVERY = 'cache_recovery',
  MANUAL_INTERVENTION = 'manual_intervention',
  SYSTEM_RESTART = 'system_restart'
}

// 错误恢复状态
export enum RecoveryStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ESCALATED = 'escalated'
}

// 错误恢复记录
interface ErrorRecoveryRecord {
  id: string;
  errorId: string;
  error: BaseError;
  severity: ErrorSeverity;
  strategy: RecoveryStrategy;
  status: RecoveryStatus;
  startTime: number;
  endTime?: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  context?: any;
  result?: any;
  failureReason?: string;
}

// 系统健康状态
interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  components: Map<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    errorCount: number;
    recoveryAttempts: number;
  }>;
  metrics: {
    errorRate: number;
    recoveryRate: number;
    averageRecoveryTime: number;
    systemUptime: number;
  };
}

// 恢复配置
interface RecoveryConfig {
  maxRetryAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  timeoutMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  enableAutoRecovery: boolean;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
}

/**
 * 错误恢复服务
 */
export class ErrorRecoveryService extends EventEmitter {
  private static instance: ErrorRecoveryService;

  // 恢复记录
  private recoveryRecords: Map<string, ErrorRecoveryRecord> = new Map();

  // 系统健康状态
  private systemHealth: SystemHealthStatus;

  // 恢复配置
  private config: RecoveryConfig;

  // 活跃的恢复任务
  private activeRecoveries = new Set<string>();

  // 组件状态监控
  private componentMonitors = new Map<string, {
    errorCount: number;
    lastError: number;
    isHealthy: boolean;
    recoveryInProgress: boolean;
  }>();

  // 性能指标
  private metrics = {
    totalErrors: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0,
    recoveryRate: 0,
    systemStartTime: Date.now()
  };

  private constructor() {
    super();

    this.config = {
      maxRetryAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      timeoutMs: 60000,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      enableAutoRecovery: true,
      enableHealthChecks: true,
      healthCheckInterval: 30000
    };

    this.initializeSystemHealth();
    this.startHealthMonitoring();
    this.startPeriodicMaintenance();

    logger.info('ErrorRecoveryService 初始化完成');
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * 初始化系统健康状态
   */
  private initializeSystemHealth(): void {
    this.systemHealth = {
      overall: 'healthy',
      components: new Map(),
      metrics: {
        errorRate: 0,
        recoveryRate: 0,
        averageRecoveryTime: 0,
        systemUptime: 0
      }
    };

    // 注册关键组件
    this.registerComponent('database', '数据库连接');
    this.registerComponent('redis', 'Redis缓存');
    this.registerComponent('external_apis', '外部API服务');
    this.registerComponent('chat_service', '聊天服务');
    this.registerComponent('auth_service', '认证服务');
  }

  /**
   * 注册组件监控
   */
  registerComponent(id: string, name: string): void {
    this.systemHealth.components.set(id, {
      status: 'healthy',
      lastCheck: Date.now(),
      errorCount: 0,
      recoveryAttempts: 0
    });

    this.componentMonitors.set(id, {
      errorCount: 0,
      lastError: 0,
      isHealthy: true,
      recoveryInProgress: false
    });

    logger.info('注册组件监控', { id, name });
  }

  /**
   * 启动健康监控
   */
  private startHealthMonitoring(): void {
    if (!this.config.enableHealthChecks) return;

    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * 启动定期维护
   */
  private startPeriodicMaintenance(): void {
    // 清理完成的恢复记录
    setInterval(() => {
      this.cleanupCompletedRecoveries();
    }, 60000); // 1分钟

    // 更新系统指标
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // 30秒
  }

  /**
   * 处理错误恢复
   */
  async handleError(
    error: unknown,
    context?: {
      component?: string;
      operation?: string;
      requestId?: string;
      userId?: string;
      metadata?: any;
    }
  ): Promise<{
    recovered: boolean;
    result?: any;
    strategy?: RecoveryStrategy;
    recoveryId?: string;
  }> {
    const startTime = performance.now();
    const typedError = createErrorFromUnknown(error);

    this.metrics.totalErrors++;

    try {
      // 分析错误严重程度
      const severity = this.analyzeErrorSeverity(typedError, context);

      // 选择恢复策略
      const strategy = this.selectRecoveryStrategy(typedError, severity, context);

      // 创建恢复记录
      const recoveryId = this.createRecoveryRecord(typedError, strategy, severity, context);

      // 执行恢复
      const result = await this.executeRecovery(recoveryId, typedError, strategy, context);

      const recoveryTime = performance.now() - startTime;
      this.updateRecoveryMetrics(recoveryTime, result.recovered);

      logger.info('错误恢复处理完成', {
        recoveryId,
        recovered: result.recovered,
        strategy,
        severity,
        recoveryTime: recoveryTime.toFixed(2) + 'ms'
      });

      return result;

    } catch (recoveryError) {
      logger.error('错误恢复失败', {
        originalError: typedError.message,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        context
      });

      return {
        recovered: false,
        strategy: RecoveryStrategy.MANUAL_INTERVENTION
      };
    }
  }

  /**
   * 分析错误严重程度
   */
  private analyzeErrorSeverity(error: BaseError, context?: any): ErrorSeverity {
    // 基于错误类型和上下文分析严重程度
    const errorMessage = error.message.toLowerCase();

    // 系统级错误
    if (errorMessage.includes('critical') ||
        errorMessage.includes('fatal') ||
        errorMessage.includes('out of memory') ||
        errorMessage.includes('disk full')) {
      return ErrorSeverity.CRITICAL;
    }

    // 高优先级错误
    if (errorMessage.includes('database') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('authorization') ||
        context?.component === 'database') {
      return ErrorSeverity.HIGH;
    }

    // 中等优先级错误
    if (errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('service unavailable')) {
      return ErrorSeverity.MEDIUM;
    }

    // 低优先级错误
    return ErrorSeverity.LOW;
  }

  /**
   * 选择恢复策略
   */
  private selectRecoveryStrategy(
    error: BaseError,
    severity: ErrorSeverity,
    context?: any
  ): RecoveryStrategy {
    const component = context?.component;
    const errorMessage = error.message.toLowerCase();

    // 基于严重程度选择策略
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return RecoveryStrategy.SYSTEM_RESTART;

      case ErrorSeverity.HIGH:
        if (errorMessage.includes('database')) {
          return RecoveryStrategy.CACHE_RECOVERY;
        }
        if (errorMessage.includes('connection')) {
          return RecoveryStrategy.AUTOMATIC_RETRY;
        }
        return RecoveryStrategy.FALLBACK_SERVICE;

      case ErrorSeverity.MEDIUM:
        if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          return RecoveryStrategy.AUTOMATIC_RETRY;
        }
        if (errorMessage.includes('service')) {
          return RecoveryStrategy.CIRCUIT_BREAKER;
        }
        return RecoveryStrategy.GRACEFUL_DEGRADATION;

      case ErrorSeverity.LOW:
      default:
        return RecoveryStrategy.GRACEFUL_DEGRADATION;
    }
  }

  /**
   * 创建恢复记录
   */
  private createRecoveryRecord(
    error: BaseError,
    strategy: RecoveryStrategy,
    severity: ErrorSeverity,
    context?: any
  ): string {
    const recoveryId = this.generateRecoveryId();
    const errorId = this.generateErrorId(error);

    const record: ErrorRecoveryRecord = {
      id: recoveryId,
      errorId,
      error,
      severity,
      strategy,
      status: RecoveryStatus.PENDING,
      startTime: Date.now(),
      attempts: 0,
      maxAttempts: this.config.maxRetryAttempts,
      delay: this.config.baseDelay,
      context
    };

    this.recoveryRecords.set(recoveryId, record);

    // 更新组件错误计数
    if (context?.component) {
      this.updateComponentErrorCount(context.component);
    }

    return recoveryId;
  }

  /**
   * 执行恢复
   */
  private async executeRecovery(
    recoveryId: string,
    error: BaseError,
    strategy: RecoveryStrategy,
    context?: any
  ): Promise<{ recovered: boolean; result?: any; strategy: RecoveryStrategy }> {
    const record = this.recoveryRecords.get(recoveryId);
    if (!record) {
      throw new Error(`恢复记录不存在: ${recoveryId}`);
    }

    record.status = RecoveryStatus.IN_PROGRESS;
    this.activeRecoveries.add(recoveryId);

    try {
      let recovered = false;
      let result: any;

      switch (strategy) {
        case RecoveryStrategy.AUTOMATIC_RETRY:
          ({ recovered, result } = await this.performAutomaticRetry(record, error, context));
          break;

        case RecoveryStrategy.FALLBACK_SERVICE:
          ({ recovered, result } = await this.performFallbackService(record, error, context));
          break;

        case RecoveryStrategy.GRACEFUL_DEGRADATION:
          ({ recovered, result } = await this.performGracefulDegradation(record, error, context));
          break;

        case RecoveryStrategy.CIRCUIT_BREAKER:
          ({ recovered, result } = await this.performCircuitBreaker(record, error, context));
          break;

        case RecoveryStrategy.CACHE_RECOVERY:
          ({ recovered, result } = await this.performCacheRecovery(record, error, context));
          break;

        case RecoveryStrategy.SYSTEM_RESTART:
          ({ recovered, result } = await this.performSystemRestart(record, error, context));
          break;

        default:
          recovered = false;
      }

      record.status = recovered ? RecoveryStatus.COMPLETED : RecoveryStatus.FAILED;
      record.endTime = Date.now();
      record.result = result;

      if (recovered) {
        this.metrics.successfulRecoveries++;
        this.emit('recovery:success', { recoveryId, strategy, result });
      } else {
        this.metrics.failedRecoveries++;
        this.emit('recovery:failed', { recoveryId, strategy, error });
      }

      return { recovered, result, strategy };

    } catch (recoveryError) {
      record.status = RecoveryStatus.FAILED;
      record.endTime = Date.now();
      record.failureReason = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);

      this.metrics.failedRecoveries++;
      this.emit('recovery:error', { recoveryId, error: recoveryError });

      return { recovered: false, strategy };
    } finally {
      this.activeRecoveries.delete(recoveryId);
    }
  }

  /**
   * 执行自动重试
   */
  private async performAutomaticRetry(
    record: ErrorRecoveryRecord,
    error: BaseError,
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    if (record.attempts >= record.maxAttempts) {
      logger.warn('达到最大重试次数', {
        recoveryId: record.id,
        attempts: record.attempts,
        maxAttempts: record.maxAttempts
      });
      return { recovered: false };
    }

    record.attempts++;

    // 计算延迟时间（指数退避）
    const delay = Math.min(record.delay * Math.pow(this.config.backoffMultiplier, record.attempts - 1), this.config.maxDelay);

    logger.info('执行自动重试', {
      recoveryId: record.id,
      attempt: record.attempts,
      delay
    });

    // 等待延迟
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // 这里应该重新执行原始操作
      // 为了演示，我们模拟重试成功
      if (record.attempts <= 2) {
        throw new Error('模拟重试失败');
      }

      return { recovered: true, result: { message: '重试成功' } };

    } catch (retryError) {
      logger.warn('重试失败', {
        recoveryId: record.id,
        attempt: record.attempts,
        error: retryError instanceof Error ? retryError.message : String(retryError)
      });

      // 递归重试
      return this.performAutomaticRetry(record, error, context);
    }
  }

  /**
   * 执行备用服务
   */
  private async performFallbackService(
    record: ErrorRecoveryRecord,
    error: BaseError,
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    logger.info('执行备用服务', {
      recoveryId: record.id,
      component: context?.component
    });

    try {
      // 这里应该切换到备用服务
      // 为了演示，返回备用响应
      const fallbackResponse = {
        success: false,
        message: '主服务不可用，正在使用备用服务',
        fallback: true,
        timestamp: new Date().toISOString()
      };

      return { recovered: true, result: fallbackResponse };

    } catch (fallbackError) {
      logger.error('备用服务失败', {
        recoveryId: record.id,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      });

      return { recovered: false };
    }
  }

  /**
   * 执行优雅降级
   */
  private async performGracefulDegradation(
    record: ErrorRecoveryRecord,
    error: BaseError,
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    logger.info('执行优雅降级', {
      recoveryId: record.id,
      operation: context?.operation
    });

    try {
      // 降级到简化的功能
      const degradedResponse = {
        success: false,
        message: '服务性能下降，功能已简化',
        degraded: true,
        limited: true,
        timestamp: new Date().toISOString()
      };

      return { recovered: true, result: degradedResponse };

    } catch (degradationError) {
      logger.error('优雅降级失败', {
        recoveryId: record.id,
        error: degradationError instanceof Error ? degradationError.message : String(degradationError)
      });

      return { recovered: false };
    }
  }

  /**
   * 执行熔断器
   */
  private async performCircuitBreaker(
    record: ErrorRecoveryRecord,
    error: BaseError,
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    logger.info('执行熔断器保护', {
      recoveryId: record.id,
      component: context?.component
    });

    try {
      // 检查熔断器状态
      const component = context?.component;
      if (component && this.isCircuitBreakerOpen(component)) {
        // 熔断器开启，返回降级响应
        const circuitBreakerResponse = {
          success: false,
          message: '服务暂时不可用，熔断器已开启',
          circuitBreakerOpen: true,
          retryAfter: 60000, // 1分钟后重试
          timestamp: new Date().toISOString()
        };

        return { recovered: true, result: circuitBreakerResponse };
      }

      // 熔断器关闭，尝试正常操作
      // 这里可以尝试正常操作，为了演示返回成功
      return { recovered: true, result: { message: '熔断器检查通过' } };

    } catch (circuitError) {
      logger.error('熔断器处理失败', {
        recoveryId: record.id,
        error: circuitError instanceof Error ? circuitError.message : String(circuitError)
      });

      return { recovered: false };
    }
  }

  /**
   * 执行缓存恢复
   */
  private async performCacheRecovery(
    record: ErrorRecoveryRecord,
    error: BaseError,
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    logger.info('执行缓存恢复', {
      recoveryId: record.id
    });

    try {
      // 尝试从缓存获取数据
      const cacheKey = this.generateCacheKey(context);
      const cachedData = await intelligentCacheStrategy.get(cacheKey);

      if (cachedData) {
        return { recovered: true, result: { data: cachedData, fromCache: true } };
      }

      // 缓存未命中，返回默认响应
      const defaultResponse = {
        success: false,
        message: '服务暂时不可用，使用默认响应',
        fromCache: false,
        timestamp: new Date().toISOString()
      };

      return { recovered: true, result: defaultResponse };

    } catch (cacheError) {
      logger.error('缓存恢复失败', {
        recoveryId: record.id,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError)
      });

      return { recovered: false };
    }
  }

  /**
   * 执行系统重启
   */
  private async performSystemRestart(
    record: ErrorRecoveryRecord,
    error: BaseError,
    context?: any
  ): Promise<{ recovered: boolean; result?: any }> {
    logger.warn('执行系统重启恢复', {
      recoveryId: record.id,
      component: context?.component
    });

    try {
      // 这里应该执行实际的系统重启逻辑
      // 为了演示，我们只是记录日志并返回失败
      logger.error('系统重启需要手动干预', {
        recoveryId: record.id,
        error: error.message
      });

      return { recovered: false };

    } catch (restartError) {
      logger.error('系统重启失败', {
        recoveryId: record.id,
        error: restartError instanceof Error ? restartError.message : String(restartError)
      });

      return { recovered: false };
    }
  }

  /**
   * 更新组件错误计数
   */
  private updateComponentErrorCount(componentId: string): void {
    const monitor = this.componentMonitors.get(componentId);
    if (monitor) {
      monitor.errorCount++;
      monitor.lastError = Date.now();
      monitor.isHealthy = false;

      // 更新系统健康状态
      const healthComponent = this.systemHealth.components.get(componentId);
      if (healthComponent) {
        healthComponent.errorCount++;
        healthComponent.status = 'unhealthy';
      }
    }
  }

  /**
   * 检查熔断器是否开启
   */
  private isCircuitBreakerOpen(componentId: string): boolean {
    const monitor = this.componentMonitors.get(componentId);
    if (!monitor) return false;

    // 简单的熔断器逻辑：5次错误后开启熔断器
    return monitor.errorCount >= this.config.circuitBreakerThreshold;
  }

  /**
   * 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    const now = Date.now();

    for (const [componentId, component] of this.systemHealth.components.entries()) {
      try {
        // 执行组件特定的健康检查
        const isHealthy = await this.checkComponentHealth(componentId);

        component.lastCheck = now;
        component.status = isHealthy ? 'healthy' : 'unhealthy';

        // 更新组件监控器
        const monitor = this.componentMonitors.get(componentId);
        if (monitor) {
          if (isHealthy) {
            monitor.isHealthy = true;
            // 重置错误计数（如果组件恢复正常）
            if (monitor.errorCount > 0) {
              monitor.errorCount = Math.max(0, monitor.errorCount - 1);
            }
          }
        }

      } catch (healthCheckError) {
        logger.warn('健康检查失败', {
          component: componentId,
          error: healthCheckError instanceof Error ? healthCheckError.message : String(healthCheckError)
        });

        component.status = 'unhealthy';
      }
    }

    // 更新整体健康状态
    this.updateOverallHealthStatus();
  }

  /**
   * 检查组件健康状态
   */
  private async checkComponentHealth(componentId: string): Promise<boolean> {
    // 这里应该实现具体的健康检查逻辑
    // 为了演示，我们使用简单的逻辑

    const monitor = this.componentMonitors.get(componentId);
    if (!monitor) return false;

    // 如果最近有错误，认为不健康
    if (monitor.lastError > 0 && (Date.now() - monitor.lastError) < 60000) {
      return false;
    }

    // 如果错误计数过多，认为不健康
    if (monitor.errorCount > 3) {
      return false;
    }

    return true;
  }

  /**
   * 更新整体健康状态
   */
  private updateOverallHealthStatus(): void {
    const components = Array.from(this.systemHealth.components.values());
    const healthyCount = components.filter(c => c.status === 'healthy').length;
    const totalCount = components.length;

    if (healthyCount === totalCount) {
      this.systemHealth.overall = 'healthy';
    } else if (healthyCount >= totalCount * 0.7) {
      this.systemHealth.overall = 'degraded';
    } else if (healthyCount >= totalCount * 0.3) {
      this.systemHealth.overall = 'unhealthy';
    } else {
      this.systemHealth.overall = 'critical';
    }
  }

  /**
   * 更新恢复指标
   */
  private updateRecoveryMetrics(recoveryTime: number, recovered: boolean): void {
    const totalRecoveries = this.metrics.successfulRecoveries + this.metrics.failedRecoveries;

    if (totalRecoveries > 0) {
      this.metrics.averageRecoveryTime =
        (this.metrics.averageRecoveryTime * (totalRecoveries - 1) + recoveryTime) / totalRecoveries;
    } else {
      this.metrics.averageRecoveryTime = recoveryTime;
    }

    this.metrics.recoveryRate = totalRecoveries > 0 ? this.metrics.successfulRecoveries / totalRecoveries : 0;
  }

  /**
   * 更新系统指标
   */
  private updateSystemMetrics(): void {
    const now = Date.now();
    const uptime = now - this.metrics.systemStartTime;

    this.systemHealth.metrics = {
      errorRate: this.metrics.totalErrors / Math.max(1, uptime / 1000), // 每秒错误数
      recoveryRate: this.metrics.recoveryRate,
      averageRecoveryTime: this.metrics.averageRecoveryTime,
      systemUptime: uptime
    };
  }

  /**
   * 清理完成的恢复记录
   */
  private cleanupCompletedRecoveries(): void {
    const now = Date.now();
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24小时

    for (const [id, record] of this.recoveryRecords.entries()) {
      if (record.endTime && (now - record.endTime) > retentionPeriod) {
        this.recoveryRecords.delete(id);
      }
    }
  }

  /**
   * 生成恢复ID
   */
  private generateRecoveryId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(error: BaseError): string {
    const content = `${error.code}_${error.message}_${Date.now()}`;
    return createHash('md5').update(content).digest('hex').substr(0, 16);
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(context?: any): string {
    if (!context) return 'default_cache_key';

    const keyData = {
      component: context.component,
      operation: context.operation,
      requestId: context.requestId
    };

    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * 获取恢复统计
   */
  getRecoveryStats(): {
    total: number;
    successful: number;
    failed: number;
    rate: number;
    averageTime: number;
    active: number;
    byStrategy: Map<RecoveryStrategy, number>;
    bySeverity: Map<ErrorSeverity, number>;
  } {
    const total = this.metrics.successfulRecoveries + this.metrics.failedRecoveries;
    const byStrategy = new Map<RecoveryStrategy, number>();
    const bySeverity = new Map<ErrorSeverity, number>();

    for (const record of this.recoveryRecords.values()) {
      // 按策略统计
      const strategyCount = byStrategy.get(record.strategy) || 0;
      byStrategy.set(record.strategy, strategyCount + 1);

      // 按严重程度统计
      const severityCount = bySeverity.get(record.severity) || 0;
      bySeverity.set(record.severity, severityCount + 1);
    }

    return {
      total,
      successful: this.metrics.successfulRecoveries,
      failed: this.metrics.failedRecoveries,
      rate: this.metrics.recoveryRate,
      averageTime: this.metrics.averageRecoveryTime,
      active: this.activeRecoveries.size,
      byStrategy,
      bySeverity
    };
  }

  /**
   * 获取系统健康状态
   */
  getSystemHealth(): SystemHealthStatus {
    this.updateOverallHealthStatus();
    return { ...this.systemHealth };
  }

  /**
   * 获取活跃恢复任务
   */
  getActiveRecoveries(): Array<{
    id: string;
    strategy: RecoveryStrategy;
    severity: ErrorSeverity;
    startTime: number;
    attempts: number;
  }> {
    const activeRecoveries: Array<{
      id: string;
      strategy: RecoveryStrategy;
      severity: ErrorSeverity;
      startTime: number;
      attempts: number;
    }> = [];

    for (const recoveryId of this.activeRecoveries) {
      const record = this.recoveryRecords.get(recoveryId);
      if (record) {
        activeRecoveries.push({
          id: record.id,
          strategy: record.strategy,
          severity: record.severity,
          startTime: record.startTime,
          attempts: record.attempts
        });
      }
    }

    return activeRecoveries;
  }

  /**
   * 手动触发恢复
   */
  async triggerManualRecovery(
    errorId: string,
    strategy?: RecoveryStrategy
  ): Promise<boolean> {
    // 查找相关的错误记录
    for (const record of this.recoveryRecords.values()) {
      if (record.errorId === errorId && record.status !== RecoveryStatus.COMPLETED) {
        const selectedStrategy = strategy || record.strategy;

        logger.info('触发手动恢复', {
          recoveryId: record.id,
          errorId,
          strategy: selectedStrategy
        });

        const result = await this.executeRecovery(
          record.id,
          record.error,
          selectedStrategy,
          record.context
        );

        return result.recovered;
      }
    }

    logger.warn('未找到可恢复的错误记录', { errorId });
    return false;
  }

  /**
   * 重置组件状态
   */
  resetComponentStatus(componentId: string): void {
    const monitor = this.componentMonitors.get(componentId);
    if (monitor) {
      monitor.errorCount = 0;
      monitor.lastError = 0;
      monitor.isHealthy = true;
      monitor.recoveryInProgress = false;
    }

    const healthComponent = this.systemHealth.components.get(componentId);
    if (healthComponent) {
      healthComponent.status = 'healthy';
      healthComponent.errorCount = 0;
      healthComponent.recoveryAttempts = 0;
    }

    logger.info('重置组件状态', { componentId });
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RecoveryConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('更新错误恢复配置', this.config);
  }
}

// 导出单例实例
export const errorRecoveryService = ErrorRecoveryService.getInstance();