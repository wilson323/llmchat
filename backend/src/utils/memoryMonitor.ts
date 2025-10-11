/**
 * 内存监控工具
 * 提供内存使用情况监控、分析和优化建议
 */

import logger from '@/utils/logger';
import { EventEmitter } from 'events';

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  timestamp: number;
  heapUsedPercentage: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
}

export interface MemoryThresholds {
  heapUsedWarning: number;    // 堆内存使用警告阈值 (百分比)
  heapUsedCritical: number;   // 堆内存使用严重阈值 (百分比)
  rssWarning: number;         // RSS内存警告阈值 (MB)
  rssCritical: number;        // RSS内存严重阈值 (MB)
  leakWarningCount: number;   // 内存泄漏警告计数
  leakCriticalCount: number;  // 内存泄漏严重计数
}

export interface MemoryTrend {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  rate: number;  // 变化率 (MB/minute)
}

export interface MemoryOptimizationResult {
  optimized: boolean;
  freedMemory: number;  // 释放的内存量 (MB)
  duration: number;     // 优化耗时 (ms)
  method: string;       // 优化方法
  beforeStats: MemoryStats;
  afterStats: MemoryStats;
}

/**
 * 内存监控器类
 */
export class MemoryMonitor extends EventEmitter {
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private statsHistory: MemoryStats[] = [];
  private maxHistorySize = 1000;  // 保留最近1000个数据点
  private thresholds: MemoryThresholds;
  private lastStats?: MemoryStats;
  private memoryTrends: MemoryTrend[] = [];
  private leakDetector: Map<string, number> = new Map();  // 对象计数器
  private gcStats = {
    total: 0,
    duration: 0,
    lastGC: 0
  };

  constructor(thresholds?: Partial<MemoryThresholds>) {
    super();

    this.thresholds = {
      heapUsedWarning: 70,      // 70%
      heapUsedCritical: 85,     // 85%
      rssWarning: 512,          // 512MB
      rssCritical: 1024,        // 1GB
      leakWarningCount: 100,    // 对象计数增长100个
      leakCriticalCount: 500,   // 对象计数增长500个
      ...thresholds
    };

    // 监听垃圾回收事件
    if (global.gc) {
      this.setupGCMonitoring();
    }
  }

  /**
   * 开始内存监控
   */
  public startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('MemoryMonitor: Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    logger.info(`MemoryMonitor: Starting memory monitoring (interval: ${intervalMs}ms)`);

    // 立即收集一次数据
    this.collectMemoryStats();

    // 定期收集内存数据
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryStats();
      this.analyzeMemoryTrends();
      this.checkThresholds();
      this.detectMemoryLeaks();
    }, intervalMs);

    this.emit('monitoring:started');
  }

  /**
   * 停止内存监控
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('MemoryMonitor: Memory monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * 收集内存统计信息
   */
  public collectMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const heapUsedPercentage = (heapUsed / heapTotal) * 100;

    const stats: MemoryStats = {
      heapUsed,
      heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now(),
      heapUsedPercentage: Math.round(heapUsedPercentage * 100) / 100,
      heapUsedMB: Math.round(heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(heapTotal / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
    };

    // 添加到历史记录
    this.statsHistory.push(stats);

    // 限制历史记录大小
    if (this.statsHistory.length > this.maxHistorySize) {
      this.statsHistory.shift();
    }

    this.lastStats = stats;
    this.emit('stats:collected', stats);

    return stats;
  }

  /**
   * 分析内存趋势
   */
  private analyzeMemoryTrends(): void {
    if (this.statsHistory.length < 2) {
      return;
    }

    const recent = this.statsHistory.slice(-10); // 最近10个数据点
    const oldest = recent[0];
    const latest = recent[recent.length - 1];

    const timeDiff = (latest.timestamp - oldest.timestamp) / 1000 / 60; // 分钟
    const heapDiff = (latest.heapUsed - oldest.heapUsed) / 1024 / 1024; // MB
    const rate = heapDiff / timeDiff; // MB/minute

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(rate) < 1) {
      trend = 'stable';
    } else if (rate > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    const memoryTrend: MemoryTrend = {
      timestamp: latest.timestamp,
      heapUsed: latest.heapUsed,
      heapTotal: latest.heapTotal,
      rss: latest.rss,
      trend,
      rate: Math.round(rate * 100) / 100
    };

    this.memoryTrends.push(memoryTrend);

    // 限制趋势历史大小
    if (this.memoryTrends.length > 100) {
      this.memoryTrends.shift();
    }

    // 检查异常增长
    if (trend === 'increasing' && rate > 10) { // 每分钟增长超过10MB
      logger.warn(`MemoryMonitor: Rapid memory growth detected: ${rate.toFixed(2)}MB/min`, {
        current: latest.heapUsedMB,
        trend: this.memoryTrends.slice(-5)
      });

      this.emit('trend:rapid-growth', memoryTrend);
    }
  }

  /**
   * 检查内存阈值
   */
  private checkThresholds(): void {
    if (!this.lastStats) {
      return;
    }

    const stats = this.lastStats;
    let alertLevel: 'warning' | 'critical' | null = null;
    const alerts: string[] = [];

    // 检查堆内存使用率
    if (stats.heapUsedPercentage >= this.thresholds.heapUsedCritical) {
      alertLevel = 'critical';
      alerts.push(`Heap usage critical: ${stats.heapUsedPercentage}%`);
    } else if (stats.heapUsedPercentage >= this.thresholds.heapUsedWarning) {
      alertLevel = 'warning';
      alerts.push(`Heap usage warning: ${stats.heapUsedPercentage}%`);
    }

    // 检查RSS内存
    if (stats.rssMB >= this.thresholds.rssCritical) {
      alertLevel = alertLevel === 'critical' ? 'critical' : 'critical';
      alerts.push(`RSS memory critical: ${stats.rssMB}MB`);
    } else if (stats.rssMB >= this.thresholds.rssWarning) {
      alertLevel = alertLevel || 'warning';
      alerts.push(`RSS memory warning: ${stats.rssMB}MB`);
    }

    if (alertLevel) {
      logger.warn(`MemoryMonitor: ${alertLevel.toUpperCase()} alerts`, {
        alerts,
        stats: {
          heapUsed: `${stats.heapUsedPercentage}%`,
          heapUsedMB: stats.heapUsedMB,
          rssMB: stats.rssMB
        }
      });

      this.emit('threshold:exceeded', {
        level: alertLevel,
        alerts,
        stats
      });

      // 严重情况下自动优化
      if (alertLevel === 'critical') {
        this.performAutomaticOptimization();
      }
    }
  }

  /**
   * 检测内存泄漏
   */
  private detectMemoryLeaks(): void {
    // 检查对象计数变化
    for (const [key, count] of this.leakDetector.entries()) {
      if (count > this.thresholds.leakCriticalCount) {
        logger.error(`MemoryMonitor: Critical memory leak detected for ${key}`, {
          count,
          threshold: this.thresholds.leakCriticalCount
        });

        this.emit('leak:critical', { key, count });
      } else if (count > this.thresholds.leakWarningCount) {
        logger.warn(`MemoryMonitor: Memory leak warning for ${key}`, {
          count,
          threshold: this.thresholds.leakWarningCount
        });

        this.emit('leak:warning', { key, count });
      }
    }
  }

  /**
   * 执行自动内存优化
   */
  private async performAutomaticOptimization(): Promise<void> {
    logger.info('MemoryMonitor: Performing automatic memory optimization');

    try {
      const result = await this.optimizeMemory();

      if (result.optimized) {
        logger.info(`MemoryMonitor: Automatic optimization successful`, {
          freedMemory: `${result.freedMemory.toFixed(2)}MB`,
          duration: `${result.duration}ms`,
          method: result.method
        });

        this.emit('optimization:automatic', result);
      }
    } catch (error) {
      logger.error('MemoryMonitor: Automatic optimization failed', error);
      this.emit('optimization:failed', error);
    }
  }

  /**
   * 手动内存优化
   */
  public async optimizeMemory(method: 'gc' | 'aggressive' = 'gc'): Promise<MemoryOptimizationResult> {
    const beforeStats = this.collectMemoryStats();
    const startTime = Date.now();

    try {
      if (method === 'gc') {
        // 强制垃圾回收
        if (global.gc) {
          global.gc();
          this.gcStats.total++;
        } else {
          logger.warn('MemoryMonitor: GC not available');
        }
      } else if (method === 'aggressive') {
        // 激进的内存优化
        await this.performAggressiveOptimization();
      }

      const afterStats = this.collectMemoryStats();
      const duration = Date.now() - startTime;
      const freedMemory = (beforeStats.heapUsed - afterStats.heapUsed) / 1024 / 1024;

      const result: MemoryOptimizationResult = {
        optimized: freedMemory > 0,
        freedMemory: Math.round(freedMemory * 100) / 100,
        duration,
        method,
        beforeStats,
        afterStats
      };

      this.emit('optimization:completed', result);
      return result;

    } catch (error) {
      logger.error('MemoryMonitor: Memory optimization failed', error);
      throw error;
    }
  }

  /**
   * 激进的内存优化
   */
  private async performAggressiveOptimization(): Promise<void> {
    // 多次垃圾回收
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 清理历史数据
    this.trimHistoryData();

    // 重置泄漏检测器
    this.leakDetector.clear();
  }

  /**
   * 设置垃圾回收监控
   */
  private setupGCMonitoring(): void {
    // 重写全局gc方法以监控
    const originalGC = global.gc;
    if (originalGC) {
      global.gc = () => {
        const startTime = Date.now();
        originalGC();
        const duration = Date.now() - startTime;

        this.gcStats.total++;
        this.gcStats.duration += duration;
        this.gcStats.lastGC = Date.now();

        logger.debug(`MemoryMonitor: GC completed in ${duration}ms`);
      };
    }
  }

  /**
   * 修剪历史数据
   */
  private trimHistoryData(): void {
    // 只保留最近的数据
    const keepSize = Math.min(100, this.maxHistorySize / 10);

    if (this.statsHistory.length > keepSize) {
      this.statsHistory = this.statsHistory.slice(-keepSize);
    }

    if (this.memoryTrends.length > 20) {
      this.memoryTrends = this.memoryTrends.slice(-20);
    }
  }

  /**
   * 注册对象计数器
   */
  public registerObjectCounter(key: string): void {
    if (!this.leakDetector.has(key)) {
      this.leakDetector.set(key, 0);
    }
  }

  /**
   * 增加对象计数
   */
  public incrementObjectCounter(key: string, delta: number = 1): void {
    const current = this.leakDetector.get(key) || 0;
    this.leakDetector.set(key, current + delta);
  }

  /**
   * 重置对象计数
   */
  public resetObjectCounter(key: string): void {
    this.leakDetector.set(key, 0);
  }

  /**
   * 获取当前内存统计
   */
  public getCurrentStats(): MemoryStats | undefined {
    return this.lastStats;
  }

  /**
   * 获取内存历史
   */
  public getMemoryHistory(minutes?: number): MemoryStats[] {
    if (!minutes) {
      return [...this.statsHistory];
    }

    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.statsHistory.filter(stat => stat.timestamp >= cutoff);
  }

  /**
   * 获取内存趋势
   */
  public getMemoryTrends(count?: number): MemoryTrend[] {
    if (!count) {
      return [...this.memoryTrends];
    }
    return this.memoryTrends.slice(-count);
  }

  /**
   * 获取垃圾回收统计
   */
  public getGCStats(): typeof this.gcStats {
    return { ...this.gcStats };
  }

  /**
   * 获取内存报告
   */
  public getMemoryReport(): {
    current: MemoryStats | undefined;
    trends: MemoryTrend[];
    gcStats: typeof this.gcStats;
    thresholds: MemoryThresholds;
    recommendations: string[];
  } {
    const current = this.getCurrentStats();
    const trends = this.getMemoryTrends(5);
    const gcStats = this.getGCStats();
    const recommendations = this.generateRecommendations(current);

    return {
      current,
      trends,
      gcStats,
      thresholds: this.thresholds,
      recommendations
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(stats?: MemoryStats): string[] {
    const recommendations: string[] = [];

    if (!stats) {
      return recommendations;
    }

    // 堆内存建议
    if (stats.heapUsedPercentage > 80) {
      recommendations.push('堆内存使用率过高，建议检查内存泄漏或增加内存限制');
    } else if (stats.heapUsedPercentage > 60) {
      recommendations.push('堆内存使用率较高，建议优化数据结构和算法');
    }

    // RSS内存建议
    if (stats.rssMB > 512) {
      recommendations.push('RSS内存使用量较高，建议检查缓存和数据存储策略');
    }

    // 趋势建议
    const recentTrends = this.getMemoryTrends(5);
    const increasingTrends = recentTrends.filter(t => t.trend === 'increasing');

    if (increasingTrends.length >= 3) {
      recommendations.push('内存呈持续增长趋势，可能存在内存泄漏');
    }

    // GC建议
    if (this.gcStats.total > 0) {
      const avgGCDuration = this.gcStats.duration / this.gcStats.total;
      if (avgGCDuration > 100) {
        recommendations.push('垃圾回收耗时较长，建议减少对象创建频率');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('内存使用状况良好');
    }

    return recommendations;
  }

  /**
   * 更新阈值配置
   */
  public updateThresholds(newThresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('MemoryMonitor: Thresholds updated', this.thresholds);
  }

  /**
   * 健康检查
   */
  public healthCheck(): {
    healthy: boolean;
    issues: string[];
    stats?: MemoryStats;
  } {
    const issues: string[] = [];
    const stats = this.getCurrentStats();

    if (!stats) {
      issues.push('No memory statistics available');
      return { healthy: false, issues };
    }

    // 检查各种指标
    if (stats.heapUsedPercentage >= this.thresholds.heapUsedCritical) {
      issues.push(`Critical heap usage: ${stats.heapUsedPercentage}%`);
    }

    if (stats.rssMB >= this.thresholds.rssCritical) {
      issues.push(`Critical RSS memory: ${stats.rssMB}MB`);
    }

    // 检查是否正在监控
    if (!this.isMonitoring) {
      issues.push('Memory monitoring is not active');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    };
  }

  /**
   * 重置统计
   */
  public reset(): void {
    this.statsHistory = [];
    this.memoryTrends = [];
    this.leakDetector.clear();
    this.gcStats = { total: 0, duration: 0, lastGC: 0 };
    this.lastStats = undefined;

    logger.info('MemoryMonitor: Statistics reset');
    this.emit('reset');
  }

  /**
   * 关闭内存监控器
   */
  public shutdown(): void {
    this.stopMonitoring();
    this.reset();
    this.removeAllListeners();

    logger.info('MemoryMonitor: Memory monitor shutdown complete');
  }
}

export default MemoryMonitor;