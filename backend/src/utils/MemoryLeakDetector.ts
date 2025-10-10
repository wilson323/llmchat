/**
 * 内存泄漏检测器
 *
 * 检测和预防 Node.js 应用中的内存泄漏问题
 * 监控未清理的定时器、事件监听器、数据库连接等
 */

import { EventEmitter } from 'events';
import logger from '../utils/StructuredLogger';

// ============================================================================
// 内存泄漏检测结果接口
// ============================================================================

export interface MemoryLeak {
  type: 'timer' | 'event_listener' | 'stream' | 'connection' | 'cache' | 'memory_growth';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  details: Record<string, any>;
  timestamp: number;
  recommendation: string;
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  count: {
    timers: number;
    eventListeners: number;
    activeHandles: number;
    activeRequests: number;
  };
  leaks: MemoryLeak[];
}

export interface MemoryLeakDetectorConfig {
  // 检测间隔（毫秒）
  checkInterval: number;
  // 内存增长阈值（MB）
  memoryGrowthThreshold: number;
  // 快照历史数量
  maxSnapshots: number;
  // 自动修复
  autoFix: boolean;
  // 警告阈值
  warnThresholds: {
    maxTimers: number;
    maxEventListeners: number;
    maxMemoryGrowthRate: number; // MB/分钟
  };
}

// ============================================================================
// 内存泄漏检测器主类
// ============================================================================

export class MemoryLeakDetector extends EventEmitter {
  private config: MemoryLeakDetectorConfig;
  private snapshots: MemorySnapshot[] = [];
  private checkInterval?: NodeJS.Timeout;
  private timers: Set<NodeJS.Timeout> = new Set();
  private eventListeners: Map<string, Set<string>> = new Map();
  private startMemory: number = 0;
  private isRunning = false;

  constructor(config: Partial<MemoryLeakDetectorConfig> = {}) {
    super();
    this.config = {
      checkInterval: 30000, // 30秒
      memoryGrowthThreshold: 100, // 100MB
      maxSnapshots: 100,
      autoFix: true,
      warnThresholds: {
        maxTimers: 50,
        maxEventListeners: 100,
        maxMemoryGrowthRate: 10, // 10MB/分钟
      },
      ...config,
    };
  }

  /**
   * 启动内存泄漏检测
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('内存泄漏检测器已在运行');
      return;
    }

    this.isRunning = true;
    this.startMemory = process.memoryUsage().heapUsed;

    // 记录初始状态
    this.takeSnapshot('initial');

    // 启动定期检测
    this.checkInterval = setInterval(() => {
      this.checkForLeaks();
    }, this.config.checkInterval) as any;

    // 注册进程清理处理程序
    this.registerCleanupHandlers();

    logger.info('内存泄漏检测器已启动', {
      checkInterval: this.config.checkInterval,
      memoryThreshold: this.config.memoryGrowthThreshold,
      autoFix: this.config.autoFix,
    });

    this.emit('started');
  }

  /**
   * 停止内存泄漏检测
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined as any;
    }

    // 记录最终状态
    this.takeSnapshot('final');

    logger.info('内存泄漏检测器已停止', {
      totalSnapshots: this.snapshots.length,
      totalLeaksDetected: this.snapshots.reduce((sum, s) => sum + s.leaks.length, 0),
    });

    this.emit('stopped');
  }

  /**
   * 手动执行内存泄漏检测
   */
  async checkForLeaks(): Promise<MemoryLeak[]> {
    const snapshot = this.takeSnapshot('periodic');
    const leaks = await this.analyzeMemory(snapshot);

    if (leaks.length > 0) {
      logger.warn('检测到内存泄漏', {
        leakCount: leaks.length,
        criticalLeaks: leaks.filter(l => l.severity === 'critical').length,
        memoryUsage: {
          heapUsed: Math.round(snapshot.heapUsed / 1024 / 1024),
          heapTotal: Math.round(snapshot.heapTotal / 1024 / 1024),
        },
      });

      this.emit('leaks_detected', leaks);

      if (this.config.autoFix) {
        await this.autoFixLeaks(leaks);
      }
    }

    return leaks;
  }

  /**
   * 获取内存快照
   */
  takeSnapshot(label: string = 'manual'): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      count: this.getResourceCounts(),
      leaks: [],
    };

    // 保持快照历史在合理范围内
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    logger.debug('内存快照已记录', {
      label,
      heapUsed: Math.round(snapshot.heapUsed / 1024 / 1024) + 'MB',
      timers: snapshot.count.timers,
      eventListeners: snapshot.count.eventListeners,
    });

    this.emit('snapshot_taken', snapshot);
    return snapshot;
  }

  /**
   * 分析内存使用情况
   */
  private async analyzeMemory(snapshot: MemorySnapshot): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];

    // 检测内存增长
    await this.checkMemoryGrowth(snapshot, leaks);

    // 检测定时器泄漏
    this.checkTimerLeaks(snapshot, leaks);

    // 检测事件监听器泄漏
    this.checkEventListenerLeaks(snapshot, leaks);

    // 检测活动句柄泄漏
    this.checkActiveHandleLeaks(snapshot, leaks);

    // 检测缓存泄漏
    this.checkCacheLeaks(snapshot, leaks);

    return leaks;
  }

  /**
   * 检测内存增长泄漏
   */
  private async checkMemoryGrowth(snapshot: MemorySnapshot, leaks: MemoryLeak[]): Promise<void> {
    if (this.snapshots.length < 2) return;

    const previousSnapshot = this.snapshots[this.snapshots.length - 2];
    if (!previousSnapshot) return;

    const memoryGrowth = snapshot.heapUsed - previousSnapshot.heapUsed;
    const timeDiff = snapshot.timestamp - previousSnapshot.timestamp;
    const growthRateMBPerMin = (memoryGrowth / 1024 / 1024) / (timeDiff / 60000);

    // 检查是否超过增长率阈值
    if (growthRateMBPerMin > this.config.warnThresholds.maxMemoryGrowthRate) {
      leaks.push({
        type: 'memory_growth',
        severity: growthRateMBPerMin > this.config.warnThresholds.maxMemoryGrowthRate * 2 ? 'high' : 'medium',
        description: `内存增长率异常: ${growthRateMBPerMin.toFixed(2)} MB/分钟`,
        details: {
          growthRate: growthRateMBPerMin,
          threshold: this.config.warnThresholds.maxMemoryGrowthRate,
          currentUsage: Math.round(snapshot.heapUsed / 1024 / 1024),
          previousUsage: Math.round(previousSnapshot.heapUsed / 1024 / 1024),
        },
        timestamp: Date.now(),
        recommendation: '检查是否存在循环引用或未释放的大对象',
      });
    }

    // 检查总内存使用是否超过阈值
    const totalGrowthMB = (snapshot.heapUsed - this.startMemory) / 1024 / 1024;
    if (totalGrowthMB > this.config.memoryGrowthThreshold && this.startMemory > 0) {
      leaks.push({
        type: 'memory_growth',
        severity: totalGrowthMB > this.config.memoryGrowthThreshold * 2 ? 'critical' : 'high',
        description: `内存总增长超过阈值: ${totalGrowthMB.toFixed(2)} MB`,
        details: {
          totalGrowth: totalGrowthMB,
          threshold: this.config.memoryGrowthThreshold,
          currentUsage: Math.round(snapshot.heapUsed / 1024 / 1024),
        },
        timestamp: Date.now(),
        recommendation: '建议重启服务或执行垃圾回收',
      });
    }
  }

  /**
   * 检测定时器泄漏
   */
  private checkTimerLeaks(snapshot: MemorySnapshot, leaks: MemoryLeak[]): void {
    const timerCount = snapshot.count.timers;
    const threshold = this.config.warnThresholds.maxTimers;

    if (timerCount > threshold) {
      leaks.push({
        type: 'timer',
        severity: timerCount > threshold * 2 ? 'high' : 'medium',
        description: `定时器数量过多: ${timerCount} (阈值: ${threshold})`,
        details: {
          timerCount,
          threshold,
        },
        timestamp: Date.now(),
        recommendation: '检查是否存在未清理的 setInterval 或 setTimeout',
      });
    }
  }

  /**
   * 检测事件监听器泄漏
   */
  private checkEventListenerLeaks(snapshot: MemorySnapshot, leaks: MemoryLeak[]): void {
    const listenerCount = snapshot.count.eventListeners;
    const threshold = this.config.warnThresholds.maxEventListeners;

    if (listenerCount > threshold) {
      leaks.push({
        type: 'event_listener',
        severity: listenerCount > threshold * 2 ? 'high' : 'medium',
        description: `事件监听器数量过多: ${listenerCount} (阈值: ${threshold})`,
        details: {
          listenerCount,
          threshold,
        },
        timestamp: Date.now(),
        recommendation: '检查是否存在未移除的事件监听器',
      });
    }
  }

  /**
   * 检测活动句柄泄漏
   */
  private checkActiveHandleLeaks(snapshot: MemorySnapshot, leaks: MemoryLeak[]): void {
    const handleCount = snapshot.count.activeHandles;
    const requestCount = snapshot.count.activeRequests;

    // 检查活动句柄数量
    if (handleCount > 100) {
      leaks.push({
        type: 'connection',
        severity: 'medium',
        description: `活动句柄数量过多: ${handleCount}`,
        details: {
          handleCount,
          requestCount,
        },
        timestamp: Date.now(),
        recommendation: '检查是否存在未关闭的网络连接或文件句柄',
      });
    }
  }

  /**
   * 检测缓存泄漏
   */
  private checkCacheLeaks(snapshot: MemorySnapshot, leaks: MemoryLeak[]): void {
    // 检查 ArrayBuffer 使用情况
    const arrayBufferUsage = snapshot.arrayBuffers;
    if (arrayBufferUsage > 100 * 1024 * 1024) { // 100MB
      leaks.push({
        type: 'cache',
        severity: 'medium',
        description: `ArrayBuffer 使用量过大: ${Math.round(arrayBufferUsage / 1024 / 1024)} MB`,
        details: {
          arrayBufferUsage: Math.round(arrayBufferUsage / 1024 / 1024),
        },
        timestamp: Date.now(),
        recommendation: '检查是否存在未释放的 Buffer 或缓存数据',
      });
    }
  }

  /**
   * 自动修复内存泄漏
   */
  private async autoFixLeaks(leaks: MemoryLeak[]): Promise<void> {
    for (const leak of leaks) {
      try {
        switch (leak.type) {
          case 'memory_growth':
            await this.fixMemoryGrowth(leak);
            break;
          case 'timer':
            await this.fixTimerLeaks(leak);
            break;
          case 'event_listener':
            await this.fixEventListenerLeaks(leak);
            break;
          case 'cache':
            await this.fixCacheLeaks(leak);
            break;
        }
      } catch (error) {
        logger.error('自动修复内存泄漏失败', {
          leak,
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            ...(error.stack && { stack: error.stack })
          } : { name: 'UnknownError', message: String(error) }
        });
      }
    }
  }

  /**
   * 修复内存增长问题
   */
  private async fixMemoryGrowth(leak: MemoryLeak): Promise<void> {
    if (leak.severity === 'critical') {
      logger.warn('执行强制垃圾回收', { reason: leak.description });

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      // 记录修复后的内存状态
      setTimeout(() => {
        const afterGC = process.memoryUsage();
        logger.info('垃圾回收后内存状态', {
          heapUsed: Math.round(afterGC.heapUsed / 1024 / 1024) + 'MB',
          improvement: Math.round((leak.details.currentUsage * 1024 * 1024 - afterGC.heapUsed) / 1024 / 1024) + 'MB',
        });
      }, 1000);
    }
  }

  /**
   * 修复定时器泄漏
   */
  private async fixTimerLeaks(leak: MemoryLeak): Promise<void> {
    logger.warn('定时器泄漏检测到，但需要手动修复', { leak });
    // 这里不能自动清理定时器，因为可能会误杀正常工作的定时器
    // 只记录警告，需要开发者手动处理
  }

  /**
   * 修复事件监听器泄漏
   */
  private async fixEventListenerLeaks(leak: MemoryLeak): Promise<void> {
    logger.warn('事件监听器泄漏检测到，但需要手动修复', { leak });
    // 同样，事件监听器不能自动清理，需要开发者手动处理
  }

  /**
   * 修复缓存泄漏
   */
  private async fixCacheLeaks(leak: MemoryLeak): Promise<void> {
    logger.warn('检测到缓存泄漏，建议清理缓存', { leak });
    // 发出缓存清理事件，让其他服务处理
    this.emit('cache_cleanup_required', leak);
  }

  /**
   * 获取资源计数
   */
  private getResourceCounts() {
    // 使用 process._getActiveHandles 和 process._getActiveRequests 获取计数
    // 注意：这些是内部 API，可能在未来版本中变化
    const activeHandles = (process as any)._getActiveHandles?.() || [];
    const activeRequests = (process as any)._getActiveRequests?.() || [];

    return {
      timers: this.timers.size,
      eventListeners: Array.from(this.eventListeners.values()).reduce((sum, set) => sum + set.size, 0),
      activeHandles: activeHandles.length,
      activeRequests: activeRequests.length,
    };
  }

  /**
   * 注册清理处理程序
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      this.stop();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
    process.on('unhandledRejection', cleanup);
  }

  /**
   * 获取内存泄漏报告
   */
  getMemoryLeakReport(): {
    summary: {
      totalLeaks: number;
      criticalLeaks: number;
      highLeaks: number;
      mediumLeaks: number;
      lowLeaks: number;
    };
    recentLeaks: MemoryLeak[];
    memoryTrend: {
      currentUsage: number;
      growthRate: number;
      snapshots: number;
    };
  } {
    const allLeaks = this.snapshots.flatMap(s => s.leaks);
    const recentLeaks = allLeaks.slice(-20);

    const summary = {
      totalLeaks: allLeaks.length,
      criticalLeaks: allLeaks.filter(l => l.severity === 'critical').length,
      highLeaks: allLeaks.filter(l => l.severity === 'high').length,
      mediumLeaks: allLeaks.filter(l => l.severity === 'medium').length,
      lowLeaks: allLeaks.filter(l => l.severity === 'low').length,
    };

    const memoryTrend = {
      currentUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      growthRate: this.snapshots.length >= 2 && this.snapshots[0] !== undefined && this.snapshots[this.snapshots.length - 1] !== undefined ?
        ((this.snapshots[this.snapshots.length - 1]!.heapUsed - this.snapshots[0]!.heapUsed) / 1024 / 1024) : 0,
      snapshots: this.snapshots.length,
    };

    return {
      summary,
      recentLeaks,
      memoryTrend,
    };
  }

  /**
   * 清除历史快照
   */
  clearSnapshots(): void {
    this.snapshots = [];
    logger.info('内存快照历史已清除');
  }
}

// ============================================================================
// 单例实例
// ============================================================================

export const memoryLeakDetector = new MemoryLeakDetector();

// ============================================================================
// 导出辅助函数
// ============================================================================

/**
 * 创建内存泄漏检测中间件
 */
export function createMemoryLeakMiddleware() {
  return (req: any, res: any, next: any) => {
    // 记录请求开始时的内存状态
    const startMemory = process.memoryUsage().heapUsed;

    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const endMemory = process.memoryUsage().heapUsed;
      const memoryDelta = endMemory - startMemory;

      // 如果内存增量超过 1MB，记录警告
      if (memoryDelta > 1024 * 1024) {
        logger.warn('请求内存使用量异常', {
          url: req.url,
          method: req.method,
          memoryDelta: Math.round(memoryDelta / 1024 / 1024) + 'MB',
          userAgent: req.get('User-Agent'),
        });
      }

      return originalEnd.apply(this, args);
    };

    next();
  };
}

export default memoryLeakDetector;