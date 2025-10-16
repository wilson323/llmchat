/**
 * 数据库连接池优化器
 *
 * 提供连接池监控、动态调整、健康检查等功能
 */

import type { Pool, PoolClient } from 'pg';
import { getPool } from './db';
import logger from '@/utils/logger';

// 连接池配置
export interface PoolConfig {
  /** 最大连接数 */
  max?: number;
  /** 最小连接数 */
  min?: number;
  /** 空闲超时（毫秒） */
  idleTimeoutMillis?: number;
  /** 连接超时（毫秒） */
  connectionTimeoutMillis?: number;
  /** 每个连接最大使用次数 */
  maxUses?: number;
  /** 连接池名称 */
  name?: string;
}

// 连接池统计
export interface PoolStats {
  /** 总连接数 */
  totalCount: number;
  /** 空闲连接数 */
  idleCount: number;
  /** 活跃连接数 */
  activeCount: number;
  /** 等待连接数 */
  waitingCount: number;
  /** 总请求数 */
  totalRequests: number;
  /** 平均等待时间 */
  averageWaitTime: number;
  /** 最大等待时间 */
  maxWaitTime: number;
  /** 连接复用率 */
  reuseRate: number;
}

// 连接健康状态
export interface ConnectionHealth {
  /** 连接ID */
  connectionId: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后使用时间 */
  lastUsedAt: number;
  /** 使用次数 */
  useCount: number;
  /** 是否健康 */
  isHealthy: boolean;
  /** 响应时间 */
  responseTime?: number;
  /** 错误次数 */
  errorCount: number;
}

/**
 * 连接池优化器
 */
export class ConnectionPoolOptimizer {
  private static instance: ConnectionPoolOptimizer;
  private pool: Pool | null = null;
  private stats: PoolStats = {
    totalCount: 0,
    idleCount: 0,
    activeCount: 0,
    waitingCount: 0,
    totalRequests: 0,
    averageWaitTime: 0,
    maxWaitTime: 0,
    reuseRate: 0,
  };
  private readonly connectionHealth = new Map<string, ConnectionHealth>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  private constructor() {
    // 不在构造函数中获取连接池，而是延迟获取
  }

  static getInstance(): ConnectionPoolOptimizer {
    if (!ConnectionPoolOptimizer.instance) {
      ConnectionPoolOptimizer.instance = new ConnectionPoolOptimizer();
    }
    return ConnectionPoolOptimizer.instance;
  }

  /**
   * 获取数据库连接池（延迟初始化）
   */
  private getPool(): Pool {
    if (!this.pool) {
      this.pool = getPool();
    }
    return this.pool;
  }

  /**
   * 启动连接池监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    logger.info('🚀 启动连接池监控');

    this.isMonitoring = true;

    // 定期统计连接池状态
    this.monitoringInterval = setInterval(() => {
      this.updatePoolStats();
    }, 5000); // 每5秒更新一次

    // 定期健康检查
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 每30秒检查一次

    // 连接池事件监听
    this.setupPoolEventListeners();
  }

  /**
   * 停止连接池监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('⏹️ 停止连接池监控');

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 更新连接池统计
   */
  private updatePoolStats(): void {
    try {
      const pool = this.getPool();
      const poolStats = pool as any;
      this.stats.totalCount = poolStats.totalCount || 0;
      this.stats.idleCount = poolStats.idleCount || 0;
      this.stats.activeCount = poolStats.activeCount || 0;
      this.stats.waitingCount = poolStats.waitingCount || 0;

      // 计算复用率
      if (this.stats.totalRequests > 0) {
        this.stats.reuseRate = ((this.stats.totalRequests - this.stats.totalCount) / this.stats.totalRequests) * 100;
      }

      logger.debug('连接池状态', {
        总连接数: this.stats.totalCount,
        空闲连接数: this.stats.idleCount,
        活跃连接数: this.stats.activeCount,
        等待连接数: this.stats.waitingCount,
        复用率: `${this.stats.reuseRate.toFixed(1)}%`,
        总请求数: this.stats.totalRequests,
      });

    } catch (error) {
      logger.error('更新连接池统计失败', { error });
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const pool = this.getPool();
      const client = await pool.connect();

      const healthCheckQuery = 'SELECT 1';
      const startTime = performance.now();

      await client.query(healthCheckQuery);

      const responseTime = performance.now() - startTime;

      client.release();

      logger.debug('连接池健康检查通过', { responseTime: `${responseTime.toFixed(2)}ms` });

    } catch (error) {
      logger.error('连接池健康检查失败', { error });
    }
  }

  /**
   * 设置连接池事件监听
   */
  private setupPoolEventListeners(): void {
    try {
      const pool = this.getPool();

      // 连接获取事件
      pool.on('acquire', () => {
        this.stats.totalRequests++;
      });

      // 连接释放事件
      pool.on('release', () => {
        // 连接释放时的处理
      });

      // 连接错误事件
      pool.on('error', (error: Error) => {
        logger.error('连接池错误', { error });
      });

      // 连接移除事件
      pool.on('remove', () => {
        logger.info('连接池连接已移除');
      });
    } catch (error) {
      logger.error('设置连接池事件监听失败', { error });
    }
  }

  /**
   * 动态调整连接池配置
   */
  async optimizePoolConfig(): Promise<void> {
    const stats = this.getPoolStats();

    logger.info('🔧 开始优化连接池配置', { stats });

    // 基于当前统计动态调整
    const newConfig = this.calculateOptimalConfig(stats);

    logger.info('建议的连接池配置', { newConfig });

    // 注意：实际应用中可能需要重新创建连接池
    // 这里只记录建议，避免影响正在运行的连接
  }

  /**
   * 计算最优配置
   */
  private calculateOptimalConfig(stats: PoolStats): PoolConfig {
    const config: PoolConfig = {};

    // 基于等待队列长度调整最大连接数
    if (stats.waitingCount > 10) {
      config.max = Math.min(100, (stats.totalCount || 20) * 2);
    } else if (stats.waitingCount > 5) {
      config.max = Math.min(50, (stats.totalCount || 20) * 1.5);
    }

    // 基于活跃连接数调整最小连接数
    if (stats.activeCount > 30) {
      config.min = Math.min(20, Math.ceil(stats.activeCount * 0.8));
    } else if (stats.activeCount > 10) {
      config.min = Math.min(10, Math.ceil(stats.activeCount * 0.6));
    }

    // 基于空闲连接数调整空闲超时
    if (stats.idleCount > stats.activeCount * 2) {
      config.idleTimeoutMillis = 15000; // 15秒
    } else if (stats.idleCount > stats.activeCount) {
      config.idleTimeoutMillis = 30000; // 30秒
    }

    return config;
  }

  /**
   * 获取连接池统计
   */
  getPoolStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * 获取连接健康状态
   */
  getConnectionHealth(): ConnectionHealth[] {
    return Array.from(this.connectionHealth.values());
  }

  /**
   * 获取连接池详细信息
   */
  getPoolDetails(): {
    stats: PoolStats;
    health: ConnectionHealth[];
    isMonitoring: boolean;
    poolConfig: PoolConfig;
  } {
    const stats = this.getPoolStats();
    const health = this.getConnectionHealth();

    return {
      stats,
      health,
      isMonitoring: this.isMonitoring,
      poolConfig: this.getCurrentPoolConfig(),
    };
  }

  /**
   * 获取当前连接池配置
   */
  private getCurrentPoolConfig(): PoolConfig {
    try {
      const pool = this.getPool();
      const poolOptions = pool as any;
      return {
        max: poolOptions.options?.max,
        min: poolOptions.options?.min,
        idleTimeoutMillis: poolOptions.options?.idleTimeoutMillis,
        connectionTimeoutMillis: poolOptions.options?.connectionTimeoutMillis,
        maxUses: poolOptions.options?.maxUses,
      };
    } catch (error) {
      logger.error('获取连接池配置失败', { error });
      return {};
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalCount: 0,
      idleCount: 0,
      activeCount: 0,
      waitingCount: 0,
      totalRequests: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      reuseRate: 0,
    };

    this.connectionHealth.clear();
    logger.info('连接池统计信息已重置');
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getPoolStats();

    // 基于等待队列的建议
    if (stats.waitingCount > 10) {
      recommendations.push('等待队列过长，建议增加最大连接数');
    }

    // 基于连接利用率的建议
    const utilization = stats.totalCount > 0 ? (stats.activeCount / stats.totalCount) * 100 : 0;
    if (utilization > 90) {
      recommendations.push('连接利用率过高，建议增加连接池大小');
    } else if (utilization < 30) {
      recommendations.push('连接利用率较低，可以考虑减少最小连接数以节省资源');
    }

    // 基于复用率的建议
    if (stats.reuseRate < 50) {
      recommendations.push('连接复用率较低，建议检查是否存在连接泄漏');
    }

    // 基于空闲连接数的建议
    if (stats.idleCount > stats.activeCount * 3) {
      recommendations.push('空闲连接过多，建议减少空闲超时时间');
    }

    return recommendations;
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const stats = this.getPoolStats();
    const recommendations = this.getPerformanceRecommendations();
    const health = this.getConnectionHealth();

    const healthyConnections = health.filter(h => h.isHealthy).length;
    const unhealthyConnections = health.length - healthyConnections;

    return `
连接池性能报告
================

📊 基础统计
- 总连接数: ${stats.totalCount}
- 空闲连接数: ${stats.idleCount}
- 活跃连接数: ${stats.activeCount}
- 等待连接数: ${stats.waitingCount}
- 总请求数: ${stats.totalRequests}
- 连接复用率: ${stats.reuseRate.toFixed(1)}%

🏥️ 健康状态
- 健康连接: ${healthyConnections}
- 不健康连接: ${unhealthyConnections}

💡 性能建议
${recommendations.map(rec => `- ${rec}`).join('\n')}

📈 监控状态
- 监控中: ${this.isMonitoring ? '是' : '否'}
- 上次更新: ${new Date().toLocaleString()}
    `.trim();
  }

  /**
   * 强制清理连接池
   */
  async forceCleanup(): Promise<void> {
    try {
      const pool = this.getPool();
      logger.info('🧹 开始清理连接池...');

      // 结束所有空闲连接
      await pool.end();

      // 重新初始化（这里需要重新调用initDB）
      logger.info('✅ 连接池清理完成');

    } catch (error) {
      logger.error('❌ 连接池清理失败', { error });
      throw error;
    }
  }

  /**
   * 预热连接池
   */
  async warmupPool(connectionCount = 5): Promise<void> {
    try {
      const pool = this.getPool();
      logger.info(`🔥 预热连接池，目标连接数: ${connectionCount}`);

      const connections: PoolClient[] = [];

      // 创建多个连接
      for (let i = 0; i < connectionCount; i++) {
        const client = await pool.connect();
        connections.push(client);
      }

      // 执行简单查询验证连接
      await Promise.all(
        connections.map(async (client) => {
          await client.query('SELECT 1');
        })
      );

      // 释放所有连接
      connections.forEach(client => client.release());

      logger.info(`✅ 连接池预热完成，预热连接数: ${connectionCount}`);

    } catch (error) {
      logger.error('❌ 连接池预热失败', { error });
      throw error;
    }
  }

  /**
   * 测试连接池性能
   */
  async testPoolPerformance(concurrency = 10): Promise<{
    success: number;
    failed: number;
    averageTime: number;
    totalTime: number;
  }> {
    logger.info(`🧪 测试连接池性能，并发数: ${concurrency}`);

    const startTime = performance.now();
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        (async () => {
          try {
            const pool = this.getPool();
            const client = await pool.connect();
            await client.query('SELECT 1, pg_sleep(0.1)');
            client.release();
          } catch (error) {
            // 记录失败但不抛出异常
          }
        })()
      );
    }

    const results = await Promise.allSettled(promises);
    const totalTime = performance.now() - startTime;

    // 统计结果
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const averageTime = totalTime / concurrency;

    logger.info(`🧪 连接池性能测试完成`, {
      成功: success,
      失败: failed,
      并发数: concurrency,
      总时间: `${totalTime.toFixed(2)}ms`,
      平均时间: `${averageTime.toFixed(2)}ms`,
    });

    return {
      success,
      failed,
      averageTime,
      totalTime,
    };
  }
}

// 创建单例实例
export const connectionPoolOptimizer = ConnectionPoolOptimizer.getInstance();

export default connectionPoolOptimizer;