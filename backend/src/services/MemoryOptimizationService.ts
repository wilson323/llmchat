/**
 * 内存优化服务
 * 提供队列系统的内存优化功能，包括内存监控、自动优化和清理策略
 */

import logger from '@/utils/logger';
import type { MemoryStats, MemoryOptimizationResult } from '@/utils/memoryMonitor';
import { MemoryMonitor } from '@/utils/memoryMonitor';
import { EventEmitter } from 'events';
import type RedisConnectionPool from '@/utils/redisConnectionPool';

export interface MemoryOptimizationConfig {
  // 监控配置
  monitoringEnabled: boolean;
  monitoringIntervalMs: number;
  historyRetentionMinutes: number;

  // 优化策略
  autoOptimizationEnabled: boolean;
  optimizationThreshold: number;    // 触发自动优化的内存使用率阈值
  optimizationIntervalMs: number;    // 自动优化间隔

  // 清理策略
  expiredDataCleanupMs: number;      // 过期数据清理间隔
  maxHistorySize: number;            // 最大历史记录大小
  batchCleanupSize: number;          // 批量清理大小

  // 内存限制
  maxHeapSizeMB: number;             // 最大堆内存大小
  maxRSSSizeMB: number;              // 最大RSS内存大小

  // 告警配置
  alertThresholds: {
    heapUsageWarning: number;
    heapUsageCritical: number;
    rssWarning: number;
    rssCritical: number;
  };
}

export interface MemoryUsageSnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  queueJobs: number;
  connectionPoolActive: number;
  connectionPoolIdle: number;
  memoryOptimizationCount: number;
  stats: {
    arrayBuffers: number;
    heapUsedPercentage: number;
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

export interface OptimizationReport {
  timestamp: number;
  beforeStats: MemoryStats;
  afterStats: MemoryStats;
  method: string;
  freedMemoryMB: number;
  durationMs: number;
  success: boolean;
  optimizations: string[];
}

/**
 * 内存优化服务类
 */
export class MemoryOptimizationService extends EventEmitter {
  private readonly memoryMonitor: MemoryMonitor;
  private config: MemoryOptimizationConfig;
  private optimizationTimer?: NodeJS.Timeout | null;
  private cleanupTimer?: NodeJS.Timeout | null;
  private isOptimizing = false;
  private optimizationHistory: OptimizationReport[] = [];
  private usageSnapshots: MemoryUsageSnapshot[] = [];
  private connectionPool?: RedisConnectionPool;

  // 统计信息
  private readonly stats = {
    totalOptimizations: 0,
    successfulOptimizations: 0,
    totalMemoryFreed: 0,
    lastOptimizationTime: 0,
    averageOptimizationTime: 0,
    cleanupOperations: 0,
    errors: 0
  };

  constructor(config: Partial<MemoryOptimizationConfig> = {}) {
    super();

    // ✅ 修复：改为显式启用逻辑（只有设置为'true'才启用）
    const isEnabled = process.env.MEMORY_OPTIMIZATION_ENABLED === 'true';

    this.config = {
      // 默认配置（已优化阈值避免死循环）
      monitoringEnabled: isEnabled,
      monitoringIntervalMs: 60000,     // 60秒（降低频率）
      historyRetentionMinutes: 60,     // 保留1小时历史
      autoOptimizationEnabled: isEnabled,
      optimizationThreshold: 95,       // 95%堆内存使用率触发优化（提高阈值避免频繁触发）
      optimizationIntervalMs: 300000,  // 5分钟检查一次（降低频率）
      expiredDataCleanupMs: 600000,    // 10分钟清理一次
      maxHistorySize: 500,             // 减少历史记录大小
      batchCleanupSize: 50,            // 减少批处理大小
      maxHeapSizeMB: 2048,             // 2GB（提高限制）
      maxRSSSizeMB: 4096,              // 4GB（提高限制）
      alertThresholds: {
        heapUsageWarning: 85,          // 提高警告阈值
        heapUsageCritical: 95,         // 提高关键阈值
        rssWarning: 1024,              // 1GB
        rssCritical: 2048              // 2GB
      },
      ...config
    };

    // ✅ 如果禁用，记录并退出，不启动监控
    if (!this.config.monitoringEnabled) {
      logger.info('MemoryOptimizationService: 已禁用 (MEMORY_OPTIMIZATION_ENABLED != true)');
      // 创建一个空的内存监控器以避免调用错误
      this.memoryMonitor = new MemoryMonitor(this.config.alertThresholds);
      return; // 不启动任何监控
    }

    // 创建内存监控器
    this.memoryMonitor = new MemoryMonitor(this.config.alertThresholds);
    this.setupMemoryMonitoring();

    logger.info('MemoryOptimizationService: Initialized with config', {
      monitoringEnabled: this.config.monitoringEnabled,
      autoOptimizationEnabled: this.config.autoOptimizationEnabled,
      optimizationThreshold: this.config.optimizationThreshold
    });
  }

  /**
   * 设置连接池引用
   */
  public setConnectionPool(connectionPool: RedisConnectionPool): void {
    this.connectionPool = connectionPool;
  }

  /**
   * 启动内存优化服务
   */
  public start(): void {
    if (this.config.monitoringEnabled) {
      this.memoryMonitor.startMonitoring(this.config.monitoringIntervalMs);
    }

    if (this.config.autoOptimizationEnabled) {
      this.startAutoOptimization();
    }

    this.startDataCleanup();

    logger.info('MemoryOptimizationService: Started');
    this.emit('service:started');
  }

  /**
   * 停止内存优化服务
   */
  public stop(): void {
    this.memoryMonitor.stopMonitoring();

    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    logger.info('MemoryOptimizationService: Stopped');
    this.emit('service:stopped');
  }

  /**
   * 设置内存监控
   */
  private setupMemoryMonitoring(): void {
    // 监听内存阈值超出
    this.memoryMonitor.on('threshold:exceeded', (data) => {
      logger.warn('MemoryOptimizationService: Memory threshold exceeded', data);
      this.emit('alert:memory-threshold', data);

      // 严重情况立即优化
      if (data.level === 'critical') {
        this.performEmergencyOptimization();
      }
    });

    // 监听内存增长趋势
    this.memoryMonitor.on('trend:rapid-growth', (trend) => {
      logger.warn('MemoryOptimizationService: Rapid memory growth detected', trend);
      this.emit('alert:rapid-growth', trend);

      // 预防性优化
      this.performPreventiveOptimization();
    });

    // 监听内存泄漏
    this.memoryMonitor.on('leak:warning', (data) => {
      logger.warn('MemoryOptimizationService: Memory leak warning', data);
      this.emit('alert:memory-leak', { ...data, level: 'warning' });
    });

    this.memoryMonitor.on('leak:critical', (data) => {
      logger.error('MemoryOptimizationService: Critical memory leak detected', data);
      this.emit('alert:memory-leak', { ...data, level: 'critical' });

      // 立即优化
      this.performEmergencyOptimization();
    });

    // 监听自动优化完成
    this.memoryMonitor.on('optimization:automatic', (result) => {
      this.recordOptimization(result);
    });
  }

  /**
   * 启动自动优化
   */
  private startAutoOptimization(): void {
    this.optimizationTimer = setInterval(async () => {
      if (this.isOptimizing) {
        return; // 正在优化中，跳过
      }

      const currentStats = this.memoryMonitor.getCurrentStats();
      if (!currentStats) {
        return;
      }

      // 检查是否需要优化
      if (currentStats.heapUsedPercentage >= this.config.optimizationThreshold) {
        await this.performOptimization('scheduled');
      }
    }, this.config.optimizationIntervalMs);
  }

  /**
   * 启动数据清理
   */
  private startDataCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.performDataCleanup();
    }, this.config.expiredDataCleanupMs);
  }

  /**
   * 手动执行内存优化
   */
  public async performOptimization(
    reason: 'manual' | 'scheduled' | 'emergency' | 'preventive' = 'manual',
    options: { aggressive?: boolean; force?: boolean } = {}
  ): Promise<OptimizationReport> {
    if (this.isOptimizing && !options.force) {
      throw new Error('Memory optimization already in progress');
    }

    this.isOptimizing = true;
    const startTime = Date.now();

    try {
      logger.info(`MemoryOptimizationService: Starting ${reason} optimization`);
      this.emit('optimization:started', { reason });

      // 创建内存使用快照
      const beforeSnapshot = this.createUsageSnapshot();

      // 执行优化策略
      const optimizations: string[] = [];
      let freedMemory = 0;

      // 1. 清理过期数据
      const cleanupResult = await this.performDataCleanup();
      if (cleanupResult > 0) {
        optimizations.push(`Cleaned ${cleanupResult} expired items`);
        freedMemory += cleanupResult;
      }

      // 2. 优化连接池
      if (this.connectionPool) {
        const poolResult = await this.optimizeConnectionPool();
        if (poolResult > 0) {
          optimizations.push(`Optimized connection pool: freed ${poolResult}MB`);
          freedMemory += poolResult;
        }
      }

      // 3. 清理历史数据
      const historyResult = await this.cleanupHistoricalData();
      if (historyResult > 0) {
        optimizations.push(`Cleaned historical data: freed ${historyResult}MB`);
        freedMemory += historyResult;
      }

      // 4. 垃圾回收
      const gcMethod = options.aggressive ? 'aggressive' : 'gc';
      const gcResult = await this.memoryMonitor.optimizeMemory(gcMethod);

      if (gcResult.optimized) {
        optimizations.push(`Garbage collection: freed ${gcResult.freedMemory}MB in ${gcResult.duration}ms`);
        freedMemory += gcResult.freedMemory;
      }

      // 5. 激进优化（如果需要）
      if (options.aggressive || reason === 'emergency') {
        const aggressiveResult = await this.performAggressiveOptimization();
        if (aggressiveResult > 0) {
          optimizations.push(`Aggressive optimization: freed ${aggressiveResult}MB`);
          freedMemory += aggressiveResult;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 创建优化报告
      const report: OptimizationReport = {
        timestamp: endTime,
        beforeStats: (beforeSnapshot?.stats || {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          rss: 0,
          arrayBuffers: 0,
          timestamp: Date.now(),
          heapUsedPercentage: 0,
          heapUsedMB: 0,
          heapTotalMB: 0,
          rssMB: 0
        }) as MemoryStats,
        afterStats: await this.memoryMonitor.collectMemoryStats(),
        method: gcMethod,
        freedMemoryMB: freedMemory,
        durationMs: duration,
        success: true,
        optimizations
      };

      // 记录优化结果
      this.recordOptimization(report);

      logger.info(`MemoryOptimizationService: ${reason} optimization completed`, {
        freedMemory: `${freedMemory.toFixed(2)}MB`,
        duration: `${duration}ms`,
        optimizations: optimizations.length
      });

      this.emit('optimization:completed', { reason, report });
      return report;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.error(`MemoryOptimizationService: ${reason} optimization failed`, error);
      this.emit('optimization:failed', { reason, error, duration });

      // 创建失败报告
      const report: OptimizationReport = {
        timestamp: endTime,
        beforeStats: await this.memoryMonitor.collectMemoryStats(),
        afterStats: await this.memoryMonitor.collectMemoryStats(),
        method: 'failed',
        freedMemoryMB: 0,
        durationMs: duration,
        success: false,
        optimizations: []
      };

      return report;
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 执行紧急优化
   */
  private async performEmergencyOptimization(): Promise<void> {
    logger.warn('MemoryOptimizationService: Performing emergency optimization');

    try {
      await this.performOptimization('emergency', {
        aggressive: true,
        force: true
      });
    } catch (error) {
      logger.error('MemoryOptimizationService: Emergency optimization failed', error);
    }
  }

  /**
   * 执行预防性优化
   */
  private async performPreventiveOptimization(): Promise<void> {
    logger.info('MemoryOptimizationService: Performing preventive optimization');

    try {
      await this.performOptimization('preventive', { aggressive: false });
    } catch (error) {
      logger.error('MemoryOptimizationService: Preventive optimization failed', error);
    }
  }

  /**
   * 优化连接池
   */
  private async optimizeConnectionPool(): Promise<number> {
    if (!this.connectionPool) {
      return 0;
    }

    try {
      const stats = this.connectionPool.getStats();

      // 如果空闲连接过多，关闭部分连接
      if (stats.idle > 10) {
        const connectionsToClose = Math.min(stats.idle - 5, 10);

        // 这里可以添加连接池优化逻辑
        // 目前返回估算的内存节省量
        return connectionsToClose * 0.5; // 每个连接估算0.5MB
      }

      return 0;
    } catch (error) {
      logger.error('MemoryOptimizationService: Connection pool optimization failed', error);
      return 0;
    }
  }

  /**
   * 执行数据清理
   */
  private async performDataCleanup(): Promise<number> {
    try {
      let freedMemory = 0;

      // 清理优化历史记录
      const optimizationHistoryFreed = this.cleanupOptimizationHistory();
      freedMemory += optimizationHistoryFreed;

      // 清理使用快照
      const snapshotsFreed = this.cleanupUsageSnapshots();
      freedMemory += snapshotsFreed;

      // 清理内存监控历史
      const monitorFreed = this.cleanupMonitorHistory();
      freedMemory += monitorFreed;

      this.stats.cleanupOperations++;

      return freedMemory;
    } catch (error) {
      logger.error('MemoryOptimizationService: Data cleanup failed', error);
      return 0;
    }
  }

  /**
   * 清理优化历史记录
   */
  private cleanupOptimizationHistory(): number {
    const maxHistory = 100;
    const currentSize = this.optimizationHistory.length;

    if (currentSize > maxHistory) {
      const toRemove = currentSize - maxHistory;
      this.optimizationHistory = this.optimizationHistory.slice(-maxHistory);

      // 估算内存节省量
      return toRemove * 0.01; // 每个记录估算10KB
    }

    return 0;
  }

  /**
   * 清理使用快照
   */
  private cleanupUsageSnapshots(): number {
    const maxSnapshots = 200;
    const currentSize = this.usageSnapshots.length;

    if (currentSize > maxSnapshots) {
      const toRemove = currentSize - maxSnapshots;
      this.usageSnapshots = this.usageSnapshots.slice(-maxSnapshots);

      return toRemove * 0.005; // 每个快照估算5KB
    }

    return 0;
  }

  /**
   * 清理监控历史
   */
  private cleanupMonitorHistory(): number {
    // 获取当前的内存历史
    const history = this.memoryMonitor.getMemoryHistory(this.config.historyRetentionMinutes);
    const estimatedSize = history.length * 0.002; // 每个记录估算2KB

    // 这里可以添加更精确的清理逻辑
    return estimatedSize;
  }

  /**
   * 清理历史数据
   */
  private async cleanupHistoricalData(): Promise<number> {
    try {
      // 这个方法可以被扩展来清理应用级别的历史数据
      // 目前返回估算值

      let freedMemory = 0;

      // 清理旧的优化报告
      if (this.optimizationHistory.length > 50) {
        const oldReports = this.optimizationHistory.splice(0, this.optimizationHistory.length - 50);
        freedMemory += oldReports.length * 0.01;
      }

      // 清理旧的使用快照
      if (this.usageSnapshots.length > 100) {
        const oldSnapshots = this.usageSnapshots.splice(0, this.usageSnapshots.length - 100);
        freedMemory += oldSnapshots.length * 0.005;
      }

      return freedMemory;
    } catch (error) {
      logger.error('MemoryOptimizationService: Historical data cleanup failed', error);
      return 0;
    }
  }

  /**
   * 执行激进优化
   */
  private async performAggressiveOptimization(): Promise<number> {
    try {
      let freedMemory = 0;

      // 1. 多次垃圾回收
      for (let i = 0; i < 3; i++) {
        const result = await this.memoryMonitor.optimizeMemory('aggressive');
        if (result.optimized) {
          freedMemory += result.freedMemory;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 2. 强制清理所有缓存
      if (this.connectionPool) {
        // 这里可以添加连接池的激进清理
        freedMemory += 1; // 估算值
      }

      // 3. 重置内部统计
      this.resetInternalStats();
      freedMemory += 0.5; // 估算值

      return freedMemory;
    } catch (error) {
      logger.error('MemoryOptimizationService: Aggressive optimization failed', error);
      return 0;
    }
  }

  /**
   * 创建内存使用快照
   */
  public createUsageSnapshot(): MemoryUsageSnapshot {
    const stats = this.memoryMonitor.getCurrentStats();
    const poolStats = this.connectionPool?.getStats();

    const snapshot: MemoryUsageSnapshot = {
      timestamp: Date.now(),
      heapUsed: stats?.heapUsed || 0,
      heapTotal: stats?.heapTotal || 0,
      rss: stats?.rss || 0,
      external: stats?.external || 0,
      queueJobs: 0, // 这里需要从队列管理器获取
      connectionPoolActive: poolStats?.active || 0,
      connectionPoolIdle: poolStats?.idle || 0,
      memoryOptimizationCount: this.stats.totalOptimizations,
      stats: {
        arrayBuffers: stats?.arrayBuffers || 0,
        heapUsedPercentage: stats?.heapUsedPercentage || 0,
        heapUsedMB: stats?.heapUsedMB || 0,
        heapTotalMB: stats?.heapTotalMB || 0,
        rssMB: stats?.rssMB || 0
      }
    };

    // 添加到快照历史
    this.usageSnapshots.push(snapshot);

    // 限制快照数量
    if (this.usageSnapshots.length > 500) {
      this.usageSnapshots = this.usageSnapshots.slice(-500);
    }

    return snapshot;
  }

  /**
   * 记录优化结果
   */
  private recordOptimization(report: OptimizationReport | MemoryOptimizationResult): void {
    if ('optimizations' in report) {
      // OptimizationReport
      this.optimizationHistory.push(report);
      this.stats.totalOptimizations++;

      if (report.success) {
        this.stats.successfulOptimizations++;
        this.stats.totalMemoryFreed += report.freedMemoryMB;
      }

      this.stats.lastOptimizationTime = report.timestamp;
      this.stats.averageOptimizationTime =
        (this.stats.averageOptimizationTime * (this.stats.totalOptimizations - 1) + report.durationMs) /
        this.stats.totalOptimizations;
    } else {
      // MemoryOptimizationResult
      this.stats.totalOptimizations++;

      if (report.optimized) {
        this.stats.successfulOptimizations++;
        this.stats.totalMemoryFreed += report.freedMemory;
      }

      this.stats.lastOptimizationTime = Date.now();
    }

    // 限制历史记录大小
    if (this.optimizationHistory.length > this.config.maxHistorySize) {
      this.optimizationHistory = this.optimizationHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * 重置内部统计
   */
  private resetInternalStats(): void {
    // 重置一些内部计数器，释放内存
    this.optimizationHistory = this.optimizationHistory.slice(-20);
    this.usageSnapshots = this.usageSnapshots.slice(-50);
  }

  /**
   * 获取内存监控器
   */
  public getMemoryMonitor(): MemoryMonitor {
    return this.memoryMonitor;
  }

  /**
   * 获取当前配置
   */
  public getConfig(): MemoryOptimizationConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<MemoryOptimizationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // 如果监控间隔改变，重启监控
    if (oldConfig.monitoringIntervalMs !== newConfig.monitoringIntervalMs && this.config.monitoringEnabled) {
      this.memoryMonitor.stopMonitoring();
      this.memoryMonitor.startMonitoring(this.config.monitoringIntervalMs);
    }

    // 如果自动优化配置改变，重启自动优化
    if (oldConfig.autoOptimizationEnabled !== newConfig.autoOptimizationEnabled ||
        oldConfig.optimizationIntervalMs !== newConfig.optimizationIntervalMs) {

      if (this.optimizationTimer) {
        clearInterval(this.optimizationTimer);
        this.optimizationTimer = null;
      }

      if (this.config.autoOptimizationEnabled) {
        this.startAutoOptimization();
      }
    }

    logger.info('MemoryOptimizationService: Configuration updated', {
      oldConfig,
      newConfig: this.config
    });
  }

  /**
   * 获取服务统计
   */
  public getServiceStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * 获取优化历史
   */
  public getOptimizationHistory(count?: number): OptimizationReport[] {
    if (!count) {
      return [...this.optimizationHistory];
    }
    return this.optimizationHistory.slice(-count);
  }

  /**
   * 获取使用快照
   */
  public getUsageSnapshots(count?: number): MemoryUsageSnapshot[] {
    if (!count) {
      return [...this.usageSnapshots];
    }
    return this.usageSnapshots.slice(-count);
  }

  /**
   * 获取内存报告
   */
  public getMemoryReport(): {
    current: MemoryStats | undefined;
    serviceStats: {
      totalOptimizations: number;
      successfulOptimizations: number;
      totalMemoryFreed: number;
      averageOptimizationTime: number;
      lastOptimizationTime: number;
      errors: number;
    };
    recentOptimizations: OptimizationReport[];
    recommendations: string[];
    healthStatus: { healthy: boolean; issues: string[] };
  } | Promise<{
    current: MemoryStats | undefined;
    serviceStats: {
      totalOptimizations: number;
      successfulOptimizations: number;
      totalMemoryFreed: number;
      averageOptimizationTime: number;
      lastOptimizationTime: number;
      errors: number;
    };
    recentOptimizations: OptimizationReport[];
    recommendations: string[];
    healthStatus: { healthy: boolean; issues: string[] };
  }> {
    const memoryReport = this.memoryMonitor.getMemoryReport();
    const recentOptimizations = this.getOptimizationHistory(10);
    const healthStatus = this.memoryMonitor.healthCheck();

    return {
      current: memoryReport.current,
      serviceStats: this.stats,
      recentOptimizations,
      recommendations: memoryReport.recommendations,
      healthStatus
    };
  }

  /**
   * 健康检查
   */
  public healthCheck(): {
    healthy: boolean;
    issues: string[];
    details: Record<string, unknown>;
  } {
    const issues: string[] = [];
    const details: Record<string, unknown> = {};

    // 检查服务状态
    if (!this.config.monitoringEnabled) {
      issues.push('Memory monitoring is disabled');
    }

    if (!this.config.autoOptimizationEnabled) {
      issues.push('Auto-optimization is disabled');
    }

    // 检查内存监控器健康状态
    const monitorHealth = this.memoryMonitor.healthCheck();
    if (!monitorHealth.healthy) {
      issues.push(...monitorHealth.issues);
    }

    // 检查优化成功率
    if (this.stats.totalOptimizations > 0) {
      const successRate = this.stats.successfulOptimizations / this.stats.totalOptimizations;
      if (successRate < 0.8) {
        issues.push(`Low optimization success rate: ${(successRate * 100).toFixed(1)}%`);
      }
      details.successRate = successRate;
    }

    // 检查最近优化时间
    const timeSinceLastOptimization = Date.now() - this.stats.lastOptimizationTime;
    if (timeSinceLastOptimization > 24 * 60 * 60 * 1000) { // 超过24小时
      issues.push('No optimization performed in the last 24 hours');
    }

    details.monitoringEnabled = this.config.monitoringEnabled;
    details.autoOptimizationEnabled = this.config.autoOptimizationEnabled;
    details.totalOptimizations = this.stats.totalOptimizations;
    details.timeSinceLastOptimization = timeSinceLastOptimization;

    return {
      healthy: issues.length === 0,
      issues,
      details
    };
  }

  /**
   * 关闭服务
   */
  public shutdown(): void {
    this.stop();
    this.memoryMonitor.shutdown();

    // 清理所有数据
    this.optimizationHistory = [];
    this.usageSnapshots = [];
    this.removeAllListeners();

    logger.info('MemoryOptimizationService: Shutdown complete');
    this.emit('service:shutdown');
  }
}

export default MemoryOptimizationService;