/**
 * Redis健康检查服务
 * 
 * 提供Redis连接的健康监控：
 * - 连接状态检查
 * - 性能指标收集
 * - 告警触发
 */

import logger from '@/utils/logger';
import { EventEmitter } from 'events';

/**
 * Redis健康状态
 */
export interface RedisHealth {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  connected: boolean;
  lastCheck: string;
  error?: string;
}

/**
 * 健康检查配置
 */
export interface RedisHealthCheckConfig {
  checkInterval: number;        // 检查间隔(毫秒)
  latencyThreshold: number;      // 延迟告警阈值(毫秒)
  maxFailures: number;          // 最大失败次数
}

/**
 * Redis健康检查服务
 */
export class RedisHealthService extends EventEmitter {
  private static instance: RedisHealthService | null = null;
  private config: RedisHealthCheckConfig;
  private healthStatus: RedisHealth;
  private consecutiveFailures = 0;
  private checkInterval?: NodeJS.Timeout;

  private constructor(config?: Partial<RedisHealthCheckConfig>) {
    super();
    this.config = {
      checkInterval: 30000,       // 30秒检查一次
      latencyThreshold: 100,      // 100ms延迟告警
      maxFailures: 3,             // 连续3次失败告警
      ...config,
    };

    this.healthStatus = this.createInitialStatus();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<RedisHealthCheckConfig>): RedisHealthService {
    if (!RedisHealthService.instance) {
      RedisHealthService.instance = new RedisHealthService(config);
    }
    return RedisHealthService.instance;
  }

  /**
   * 创建初始健康状态
   */
  private createInitialStatus(): RedisHealth {
    return {
      healthy: false,
      status: 'unhealthy',
      latency: 0,
      connected: false,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * 启动健康检查监控
   */
  public start(): void {
    if (this.checkInterval) {
      logger.warn('RedisHealthService: 健康检查已经在运行');
      return;
    }

    logger.info('RedisHealthService: 启动健康检查监控', {
      interval: this.config.checkInterval,
    });

    // 立即执行一次检查
    this.performHealthCheck().catch((err) => {
      logger.error('RedisHealthService: 初始健康检查失败', { error: err });
    });

    // 定期执行健康检查
    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch((err) => {
        logger.error('RedisHealthService: 定期健康检查失败', { error: err });
      });
    }, this.config.checkInterval);
  }

  /**
   * 停止健康检查监控
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined as any;
      logger.info('RedisHealthService: 已停止健康检查监控');
    }
  }

  /**
   * 执行健康检查
   */
  public async performHealthCheck(): Promise<RedisHealth> {
    const startTime = Date.now();

    try {
      // 使用CacheService检查Redis
      const { getCacheService } = await import('@/services/CacheService');
      const cacheService = getCacheService();

      // 检查是否连接
      const connected = cacheService.isConnected();
      
      if (!connected) {
        this.healthStatus = {
          healthy: false,
          status: 'unhealthy',
          latency: 0,
          connected: false,
          lastCheck: new Date().toISOString(),
          error: 'Redis not connected',
        };

        this.consecutiveFailures++;
        this.emit('healthCheckFailed', this.healthStatus);

        return this.healthStatus;
      }

      // 执行ping测试
      const pingResult = await cacheService.ping();
      const latency = Date.now() - startTime;

      this.healthStatus = {
        healthy: pingResult,
        status: this.determineStatus(latency),
        latency,
        connected: true,
        lastCheck: new Date().toISOString(),
      };

      // 重置失败计数
      this.consecutiveFailures = 0;

      // 检查告警条件
      this.checkAlerts();

      // 发出健康事件
      this.emit('healthCheck', this.healthStatus);

      return this.healthStatus;

    } catch (error) {
      this.consecutiveFailures++;

      this.healthStatus = {
        healthy: false,
        status: 'unhealthy',
        latency: Date.now() - startTime,
        connected: false,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      // 发出错误事件
      this.emit('healthCheckFailed', this.healthStatus);

      // 连续失败告警
      if (this.consecutiveFailures >= this.config.maxFailures) {
        this.emit('criticalFailure', {
          failures: this.consecutiveFailures,
          error: this.healthStatus.error,
        });

        logger.error('RedisHealthService: 连续健康检查失败', {
          consecutiveFailures: this.consecutiveFailures,
          error: this.healthStatus.error,
        });
      }

      return this.healthStatus;
    }
  }

  /**
   * 确定健康状态
   */
  private determineStatus(latency: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (latency > this.config.latencyThreshold) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(): void {
    const { latency } = this.healthStatus;

    // 延迟过高告警
    if (latency > this.config.latencyThreshold) {
      this.emit('highLatency', {
        latency,
        threshold: this.config.latencyThreshold,
      });

      logger.warn('RedisHealthService: Redis延迟过高', {
        latency: `${latency}ms`,
        threshold: `${this.config.latencyThreshold}ms`,
      });
    }
  }

  /**
   * 获取当前健康状态
   */
  public getHealthStatus(): RedisHealth {
    return { ...this.healthStatus };
  }

  /**
   * 获取连续失败次数
   */
  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * 检查Redis是否健康
   */
  public isHealthy(): boolean {
    return this.healthStatus.healthy && this.healthStatus.status !== 'unhealthy';
  }

  /**
   * 获取健康检查配置
   */
  public getConfig(): RedisHealthCheckConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<RedisHealthCheckConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    logger.info('RedisHealthService: 配置已更新', this.config);

    // 如果修改了检查间隔，重启监控
    if (newConfig.checkInterval && this.checkInterval) {
      this.stop();
      this.start();
    }
  }
}

// 导出单例实例
export default RedisHealthService;

