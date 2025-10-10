/**
 * 连接池优化器
 *
 * 监控和优化数据库连接池性能
 * 提供连接池状态分析、自动调整配置、连接泄露检测等功能
 */

import { Pool, PoolClient } from 'pg';
import { EventEmitter } from 'events';
import logger from './StructuredLogger';
import { getPool } from './db';
import { memoryResourceManager } from './MemoryResourceManager';

// ============================================================================
// 类型定义
// ============================================================================

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  minConnections: number;
  averageWaitTime: number;
  totalAcquires: number;
  totalReleases: number;
  averageActiveTime: number;
  maxActiveTime: number;
  connectionErrors: number;
  leakedConnections: number;
}

export interface ConnectionMetrics {
  id: string;
  acquiredAt: number;
  releasedAt?: number;
  activeTime: number;
  errorCount: number;
  queryCount: number;
  lastQueryTime?: number;
  lastError?: string;
}

export interface PoolConfiguration {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses: number;
  maxLifetimeSeconds: number;
}

export interface PoolOptimization {
  type: 'resize' | 'timeout' | 'lifecycle' | 'config';
  description: string;
  currentValue: any;
  recommendedValue: any;
  reason: string;
  estimatedImprovement: number;
}

export interface ConnectionLeakAlert {
  connectionId: string;
  activeTime: number;
  lastActivity: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// ============================================================================
// 连接池优化器主类
// ============================================================================

export class ConnectionPoolOptimizer extends EventEmitter {
  private connectionMetrics = new Map<string, ConnectionMetrics>();
  private isMonitoring = false;
  private monitoringInterval?: string;
  private leakDetectionInterval?: string;
  private configuration!: PoolConfiguration;
  private poolStats!: ConnectionPoolStats;
  private leakedConnections = new Set<string>();

  constructor() {
    super();
    this.setupDefaultConfiguration();
    this.initializePoolStats();
  }

  /**
   * 设置默认配置
   */
  private setupDefaultConfiguration(): void {
    this.configuration = {
      minConnections: 5,
      maxConnections: 50,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      maxUses: 7500,
      maxLifetimeSeconds: 3600, // 1小时
    };
  }

  /**
   * 初始化连接池统计
   */
  private initializePoolStats(): void {
    this.poolStats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      maxConnections: this.configuration.maxConnections,
      minConnections: this.configuration.minConnections,
      averageWaitTime: 0,
      totalAcquires: 0,
      totalReleases: 0,
      averageActiveTime: 0,
      maxActiveTime: 0,
      connectionErrors: 0,
      leakedConnections: 0,
    };
  }

  /**
   * 启动连接池监控
   */
  start(options: {
    monitoringInterval?: number;
    enableLeakDetection?: boolean;
    enableAutoOptimization?: boolean;
  } = {}): void {
    if (this.isMonitoring) {
      logger.warn('连接池优化器已在运行');
      return;
    }

    this.isMonitoring = true;

    // 启动定期监控
    const monitoringTimerId = `monitoring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    memoryResourceManager.registerTimer(
      'interval',
      () => {
        this.collectPoolStats();
        this.detectOptimizations();
      },
      options.monitoringInterval || 10000, // 10秒间隔
      { location: 'ConnectionPoolOptimizer', id: monitoringTimerId }
    );
    this.monitoringInterval = monitoringTimerId;

    // 启动连接泄露检测
    if (options.enableLeakDetection !== false) {
      const leakDetectionTimerId = `leak_detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      memoryResourceManager.registerTimer(
        'interval',
        () => {
          this.detectConnectionLeaks();
        },
        30000, // 30秒间隔
        { location: 'ConnectionPoolOptimizer', id: leakDetectionTimerId }
      );
      this.leakDetectionInterval = leakDetectionTimerId;
    }

    logger.info('连接池优化器已启动', {
      monitoringInterval: options.monitoringInterval || 10000,
      enableLeakDetection: options.enableLeakDetection !== false,
      enableAutoOptimization: options.enableAutoOptimization !== false,
    });

    this.emit('started');
  }

  /**
   * 停止连接池监控
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      memoryResourceManager.clearTimer(this.monitoringInterval);
      this.monitoringInterval = undefined as any;
    }

    if (this.leakDetectionInterval) {
      memoryResourceManager.clearTimer(this.leakDetectionInterval);
      this.leakDetectionInterval = undefined as any;
    }

    logger.info('连接池优化器已停止');
    this.emit('stopped');
  }

  /**
   * 包装连接池客户端以进行监控
   */
  async wrapClient<T = any>(
    pool: Pool,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const connectionId = this.generateConnectionId();
    const acquiredAt = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      // 记录连接获取
      this.recordConnectionAcquired(connectionId, acquiredAt);
      this.poolStats.totalAcquires++;
      this.poolStats.activeConnections++;

      // 监控连接错误
      this.monitorConnectionErrors(client, connectionId);

      // 执行操作
      const result = await operation(client);

      return result;
    } catch (error) {
      // 记录错误
      this.recordConnectionError(connectionId, error as Error);
      throw error;
    } finally {
      if (client) {
        // 记录连接释放
        const releasedAt = Date.now();
        this.recordConnectionReleased(connectionId, releasedAt, acquiredAt);
        client.release();
        this.poolStats.totalReleases++;
        this.poolStats.activeConnections--;
      }
    }
  }

  /**
   * 监控连接错误
   */
  private monitorConnectionErrors(client: PoolClient, connectionId: string): void {
    // 简化监控：仅记录连接获取和释放
    // 实际的查询监控通过包装在 wrapClient 中处理
  }

  /**
   * 记录连接获取
   */
  private recordConnectionAcquired(connectionId: string, acquiredAt: number): void {
    this.connectionMetrics.set(connectionId, {
      id: connectionId,
      acquiredAt,
      activeTime: 0,
      errorCount: 0,
      queryCount: 0,
    });
  }

  /**
   * 记录连接释放
   */
  private recordConnectionReleased(
    connectionId: string,
    releasedAt: number,
    acquiredAt: number
  ): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      const activeTime = releasedAt - acquiredAt;

      // 更新平均活跃时间
      const totalActiveTime = this.poolStats.totalReleases * this.poolStats.averageActiveTime;
      const newAverageActiveTime = (totalActiveTime + activeTime) / (this.poolStats.totalReleases + 1);
      this.poolStats.averageActiveTime = Math.round(newAverageActiveTime);

      // 更新最大活跃时间
      if (activeTime > this.poolStats.maxActiveTime) {
        this.poolStats.maxActiveTime = Math.round(activeTime);
      }

      metrics.activeTime = activeTime;
      metrics.releasedAt = releasedAt;

      // 从活跃连接中移除
      this.connectionMetrics.delete(connectionId);
    }
  }

  /**
   * 记录查询成功
   */
  private recordQuerySuccess(connectionId: string): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.queryCount++;
      metrics.lastQueryTime = Date.now();
    }
  }

  /**
   * 记录连接错误
   */
  private recordConnectionError(connectionId: string, error: Error): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.errorCount++;
      metrics.lastError = error.message;
    }

    this.poolStats.connectionErrors++;

    logger.warn('数据库连接错误', {
      connectionId,
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      }
    });
  }

  /**
   * 收集连接池统计信息
   */
  private collectPoolStats(): void {
    const pool = getPool();

    this.poolStats = {
      totalConnections: pool.totalCount,
      activeConnections: this.connectionMetrics.size, // Calculate from active connections
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      maxConnections: pool.options.max || 50,
      minConnections: pool.options.min || 5,
      averageWaitTime: this.poolStats.averageWaitTime || 0,
      totalAcquires: this.poolStats.totalAcquires || 0,
      totalReleases: this.poolStats.totalReleases || 0,
      averageActiveTime: this.poolStats.averageActiveTime || 0,
      maxActiveTime: this.poolStats.maxActiveTime || 0,
      connectionErrors: this.poolStats.connectionErrors || 0,
      leakedConnections: this.leakedConnections.size,
    };

    this.emit('stats_updated', this.poolStats);
  }

  /**
   * 检测连接泄露
   */
  private detectConnectionLeaks(): void {
    const now = Date.now();
    const leakThreshold = 5 * 60 * 1000; // 5分钟
    const criticalThreshold = 15 * 60 * 1000; // 15分钟

    for (const [connectionId, metrics] of this.connectionMetrics.entries()) {
      const activeTime = metrics.releasedAt ? metrics.releasedAt - metrics.acquiredAt : now - metrics.acquiredAt;

      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let description = '';

      if (activeTime > criticalThreshold) {
        severity = 'critical';
        description = `连接已活跃 ${Math.round(activeTime / 1000)} 秒，可能存在泄露`;
      } else if (activeTime > leakThreshold) {
        severity = 'high';
        description = `连接活跃时间过长 (${Math.round(activeTime / 1000)} 秒)`;
      } else if (activeTime > 2 * 60 * 1000) {
        severity = 'medium';
        description = `连接活跃时间较长 (${Math.round(activeTime / 1000)} 秒)`;
      }

      if (severity !== 'low') {
        const alert: ConnectionLeakAlert = {
          connectionId,
          activeTime,
          lastActivity: metrics.acquiredAt,
          severity,
          description,
        };

        logger.warn('检测到潜在连接泄露', alert);
        this.emit('connection_leak', alert);
        this.leakedConnections.add(connectionId);
      }
    }
  }

  /**
   * 检测优化建议
   */
  private detectOptimizations(): void {
    const optimizations: PoolOptimization[] = [];

    // 检查连接池大小
    if (this.poolStats.maxConnections < 20 && this.poolStats.waitingClients > 5) {
      optimizations.push({
        type: 'resize',
        description: '等待连接数量较多，建议增加最大连接数',
        currentValue: this.poolStats.maxConnections,
        recommendedValue: Math.min(this.poolStats.maxConnections * 2, 100),
        reason: `当前有 ${this.poolStats.waitingClients} 个客户端在等待`,
        estimatedImprovement: 40,
      });
    }

    // 检查空闲超时
    if (this.configuration.idleTimeoutMillis > 60000) { // 超过1分钟
      optimizations.push({
        type: 'timeout',
        description: '空闲超时时间过长，可能导致资源浪费',
        currentValue: this.configuration.idleTimeoutMillis,
        recommendedValue: 30000,
        reason: '过长的空闲超时会占用不必要的数据库连接',
        estimatedImprovement: 20,
      });
    }

    // 检查连接使用次数
    if (this.configuration.maxUses < 1000) {
      optimizations.push({
        type: 'lifecycle',
        description: '连接使用次数限制较低，建议增加以提高性能',
        currentValue: this.configuration.maxUses,
        recommendedValue: 7500,
        reason: '增加连接使用次数可以减少连接创建开销',
        estimatedImprovement: 15,
      });
    }

    // 检查连接错误率
    if (this.poolStats.totalAcquires > 0) {
      const errorRate = this.poolStats.connectionErrors / this.poolStats.totalAcquires;
      if (errorRate > 0.05) { // 错误率超过5%
        optimizations.push({
          type: 'config',
          description: '连接错误率过高，建议检查数据库配置或网络连接',
          currentValue: Math.round(errorRate * 100) + '%',
          recommendedValue: '< 5%',
          reason: `最近 ${this.poolStats.connectionErrors} 次连接错误`,
          estimatedImprovement: 30,
        });
      }
    }

    if (optimizations.length > 0) {
      logger.info('检测到连接池优化建议', {
        count: optimizations.length,
        recommendations: optimizations,
      });
      this.emit('optimization_detected', optimizations);
    }
  }

  /**
   * 获取连接池统计
   */
  getPoolStats(): ConnectionPoolStats {
    return { ...this.poolStats };
  }

  /**
   * 获取连接配置
   */
  getConfiguration(): PoolConfiguration {
    return { ...this.configuration };
  }

  /**
   * 设置连接池配置
   */
  setConfiguration(config: Partial<PoolConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };

    logger.info('连接池配置已更新', {
      newConfig: this.configuration,
    });

    this.emit('configuration_updated', this.configuration);
  }

  /**
   * 获取活跃连接指标
   */
  getActiveConnectionsMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  /**
   * 获取泄露连接信息
   */
  getLeakedConnections(): ConnectionLeakAlert[] {
    const now = Date.now();
    const alerts: ConnectionLeakAlert[] = [];

    for (const connectionId of this.leakedConnections) {
      const metrics = this.connectionMetrics.get(connectionId);
      if (metrics) {
        const activeTime = metrics.releasedAt ? metrics.releasedAt - metrics.acquiredAt : now - metrics.acquiredAt;

        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        let description = '';

        if (activeTime > 15 * 60 * 1000) {
          severity = 'critical';
          description = `严重泄露：连接已活跃 ${Math.round(activeTime / 1000)} 秒`;
        } else if (activeTime > 5 * 60 * 1000) {
          severity = 'high';
          description = `高风险泄露：连接已活跃 ${Math.round(activeTime / 1000)} 秒`;
        } else {
          severity = 'medium';
          description = `潜在泄露：连接已活跃 ${Math.round(activeTime / 1000)} 秒`;
        }

        alerts.push({
          connectionId,
          activeTime,
          lastActivity: metrics.acquiredAt,
          severity,
          description,
        });
      }
    }

    return alerts;
  }

  /**
   * 清理泄露连接记录
   */
  clearLeakedConnections(): void {
    this.leakedConnections.clear();
    logger.info('泄露连接记录已清理');
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.initializePoolStats();
    this.connectionMetrics.clear();
    this.leakedConnections.clear();
    logger.info('连接池统计信息已重置');
  }

  /**
   * 生成连接ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取详细的性能报告
   */
  getPerformanceReport(): any {
    const stats = this.getPoolStats();
    const config = this.getConfiguration();
    const activeConnections = this.getActiveConnectionsMetrics();
    const leakedConnections = this.getLeakedConnections();

    const report = {
      summary: {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections,
        waitingClients: stats.waitingClients,
        utilizationRate: (stats.activeConnections / stats.maxConnections) * 100,
        errorRate: stats.totalAcquires > 0 ? (stats.connectionErrors / stats.totalAcquires) * 100 : 0,
        averageActiveTime: stats.averageActiveTime,
        maxActiveTime: stats.maxActiveTime,
      },
      configuration: config,
      activeConnections: {
        count: activeConnections.length,
        averageActiveTime: activeConnections.length > 0
          ? activeConnections.reduce((sum, conn) => sum + conn.activeTime, 0) / activeConnections.length
          : 0,
        maxActiveTime: activeConnections.length > 0
          ? Math.max(...activeConnections.map(conn => conn.activeTime))
          : 0,
        errorConnections: activeConnections.filter(conn => conn.errorCount > 0).length,
      },
      leakedConnections: {
        count: leakedConnections.length,
        bySeverity: leakedConnections.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalActiveTime: leakedConnections.reduce((sum, alert) => sum + alert.activeTime, 0),
      },
      recommendations: [],
    };

    return report;
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const connectionPoolOptimizer = new ConnectionPoolOptimizer();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建连接池优化中间件
 */
export function createConnectionPoolOptimizationMiddleware() {
  return (req: any, res: any, next: any) => {
    // 在请求对象上附加连接池优化器
    req.poolOptimizer = connectionPoolOptimizer;

    // 记录连接池状态
    const poolStats = connectionPoolOptimizer.getPoolStats();

    // 添加连接池状态头
    res.set('X-Pool-Active-Connections', poolStats.activeConnections.toString());
    res.set('X-Pool-Idle-Connections', poolStats.idleConnections.toString());
    res.set('X-Pool-Waiting-Clients', poolStats.waitingClients.toString());

    next();
  };
}

/**
 * 创建优化的数据库连接函数
 */
export function createOptimizedConnection() {
  return async function<T = any>(
    operation: (client: import('pg').PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = getPool();
    return connectionPoolOptimizer.wrapClient(pool, operation);
  };
}

export default connectionPoolOptimizer;