/**
 * 数据库健康检查服务
 * 
 * 提供数据库连接池的深度健康检查和监控：
 * - 连接池状态监控
 * - 性能指标收集
 * - 故障检测和自愈
 * - 告警触发
 */

import { getPool } from '@/utils/db';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  pool: {
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
    maxConnections: number;
    utilizationPercent: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    failedQueries: number;
    totalQueries: number;
  };
  lastCheck: string;
  error?: string;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  checkInterval: number;        // 检查间隔(毫秒)
  slowQueryThreshold: number;    // 慢查询阈值(毫秒)
  utilizationThreshold: number;  // 利用率告警阈值(%)
  maxFailures: number;          // 最大失败次数
  autoReconnect: boolean;       // 自动重连
}

/**
 * 数据库健康检查服务
 */
export class DatabaseHealthService extends EventEmitter {
  private static instance: DatabaseHealthService | null = null;
  private config: HealthCheckConfig;
  private healthStatus: DatabaseHealth;
  private consecutiveFailures = 0;
  private checkInterval?: NodeJS.Timeout;
  private queryStats: {
    totalQueries: number;
    failedQueries: number;
    slowQueries: number;
    queryTimes: number[];
  } = {
    totalQueries: 0,
    failedQueries: 0,
    slowQueries: 0,
    queryTimes: [],
  };

  private constructor(config?: Partial<HealthCheckConfig>) {
    super();
    this.config = {
      checkInterval: 30000,          // 30秒检查一次
      slowQueryThreshold: 1000,      // 1秒为慢查询
      utilizationThreshold: 80,      // 80%利用率告警
      maxFailures: 3,                // 连续3次失败告警
      autoReconnect: true,           // 自动重连
      ...config,
    };

    this.healthStatus = this.createInitialStatus();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<HealthCheckConfig>): DatabaseHealthService {
    if (!DatabaseHealthService.instance) {
      DatabaseHealthService.instance = new DatabaseHealthService(config);
    }
    return DatabaseHealthService.instance;
  }

  /**
   * 创建初始健康状态
   */
  private createInitialStatus(): DatabaseHealth {
    return {
      healthy: false,
      status: 'unhealthy',
      latency: 0,
      pool: {
        totalConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        maxConnections: 0,
        utilizationPercent: 0,
      },
      performance: {
        avgQueryTime: 0,
        slowQueries: 0,
        failedQueries: 0,
        totalQueries: 0,
      },
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * 启动健康检查监控
   */
  public start(): void {
    if (this.checkInterval) {
      logger.warn('DatabaseHealthService: 健康检查已经在运行');
      return;
    }

    logger.info('DatabaseHealthService: 启动健康检查监控', {
      interval: this.config.checkInterval,
    });

    // 立即执行一次检查
    this.performHealthCheck().catch((err) => {
      logger.error('DatabaseHealthService: 初始健康检查失败', { error: err });
    });

    // 定期执行健康检查
    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch((err) => {
        logger.error('DatabaseHealthService: 定期健康检查失败', { error: err });
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
      logger.info('DatabaseHealthService: 已停止健康检查监控');
    }
  }

  /**
   * 执行健康检查
   */
  public async performHealthCheck(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      const pool = getPool();

      // 执行简单查询测试连接
      await pool.query('SELECT 1 as health_check');
      const latency = Date.now() - startTime;

      // 获取连接池状态
      const poolStatus = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingRequests: pool.waitingCount,
        maxConnections: pool.options.max ?? 50,
        utilizationPercent: 0,
      };

      // 计算利用率
      poolStatus.utilizationPercent = 
        (poolStatus.totalConnections / poolStatus.maxConnections) * 100;

      // 更新健康状态
      this.healthStatus = {
        healthy: true,
        status: this.determineStatus(poolStatus.utilizationPercent, latency),
        latency,
        pool: poolStatus,
        performance: {
          avgQueryTime: this.calculateAvgQueryTime(),
          slowQueries: this.queryStats.slowQueries,
          failedQueries: this.queryStats.failedQueries,
          totalQueries: this.queryStats.totalQueries,
        },
        lastCheck: new Date().toISOString(),
      };

      // 重置失败计数
      this.consecutiveFailures = 0;

      // 检查告警条件
      this.checkAlerts();

      // 发出健康事件
      this.emit('healthCheck', this.healthStatus);

      return this.healthStatus;

    } catch (error: any) {
      this.consecutiveFailures++;

      this.healthStatus = {
        healthy: false,
        status: 'unhealthy',
        latency: Date.now() - startTime,
        pool: {
          totalConnections: 0,
          idleConnections: 0,
          waitingRequests: 0,
          maxConnections: 0,
          utilizationPercent: 0,
        },
        performance: {
          avgQueryTime: 0,
          slowQueries: this.queryStats.slowQueries,
          failedQueries: this.queryStats.failedQueries,
          totalQueries: this.queryStats.totalQueries,
        },
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

        logger.error('DatabaseHealthService: 连续健康检查失败', {
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
  private determineStatus(utilization: number, latency: number): 'healthy' | 'degraded' | 'unhealthy' {
    // 利用率超过阈值或延迟过高
    if (utilization > this.config.utilizationThreshold || latency > 500) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * 计算平均查询时间
   */
  private calculateAvgQueryTime(): number {
    if (this.queryStats.queryTimes.length === 0) {
      return 0;
    }

    const sum = this.queryStats.queryTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.queryStats.queryTimes.length);
  }

  /**
   * 记录查询
   */
  public recordQuery(duration: number, success: boolean): void {
    this.queryStats.totalQueries++;

    if (!success) {
      this.queryStats.failedQueries++;
      return;
    }

    // 记录查询时间
    this.queryStats.queryTimes.push(duration);

    // 只保留最近100条记录
    if (this.queryStats.queryTimes.length > 100) {
      this.queryStats.queryTimes.shift();
    }

    // 检测慢查询
    if (duration > this.config.slowQueryThreshold) {
      this.queryStats.slowQueries++;
      this.emit('slowQuery', { duration });

      logger.warn('DatabaseHealthService: 慢查询检测', {
        duration: `${duration}ms`,
        threshold: `${this.config.slowQueryThreshold}ms`,
      });
    }
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(): void {
    const { pool, latency } = this.healthStatus;

    // 连接池利用率告警
    if (pool.utilizationPercent > this.config.utilizationThreshold) {
      this.emit('highUtilization', {
        utilization: pool.utilizationPercent,
        threshold: this.config.utilizationThreshold,
      });

      logger.warn('DatabaseHealthService: 连接池利用率过高', {
        utilization: `${pool.utilizationPercent.toFixed(2)}%`,
        threshold: `${this.config.utilizationThreshold}%`,
        total: pool.totalConnections,
        max: pool.maxConnections,
      });
    }

    // 等待请求过多告警
    if (pool.waitingRequests > 5) {
      this.emit('highWaitingRequests', {
        waiting: pool.waitingRequests,
      });

      logger.warn('DatabaseHealthService: 等待请求过多', {
        waiting: pool.waitingRequests,
      });
    }

    // 延迟过高告警
    if (latency > 500) {
      this.emit('highLatency', {
        latency,
      });

      logger.warn('DatabaseHealthService: 数据库延迟过高', {
        latency: `${latency}ms`,
      });
    }
  }

  /**
   * 获取当前健康状态
   */
  public getHealthStatus(): DatabaseHealth {
    return { ...this.healthStatus };
  }

  /**
   * 获取连接池统计
   */
  public getPoolStats(): DatabaseHealth['pool'] {
    return { ...this.healthStatus.pool };
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): DatabaseHealth['performance'] {
    return { ...this.healthStatus.performance };
  }

  /**
   * 重置统计数据
   */
  public resetStats(): void {
    this.queryStats = {
      totalQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      queryTimes: [],
    };

    logger.info('DatabaseHealthService: 统计数据已重置');
  }

  /**
   * 获取连续失败次数
   */
  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * 检查连接池是否健康
   */
  public isHealthy(): boolean {
    return this.healthStatus.healthy && this.healthStatus.status !== 'unhealthy';
  }

  /**
   * 获取健康检查配置
   */
  public getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    logger.info('DatabaseHealthService: 配置已更新', this.config);

    // 如果修改了检查间隔，重启监控
    if (newConfig.checkInterval && this.checkInterval) {
      this.stop();
      this.start();
    }
  }
}

// 导出单例实例
export default DatabaseHealthService;


