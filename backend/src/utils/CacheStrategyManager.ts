/**
 * 智能缓存策略管理器
 * 统一管理所有缓存策略和配置
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';
import { performance } from 'perf_hooks';

// 缓存策略类型
export type CacheStrategy =
  | 'aggressive'     // 激进缓存策略 - 更长TTL，更大缓存
  | 'balanced'       // 平衡策略 - 适中的TTL和缓存大小
  | 'conservative'   // 保守策略 - 较短TTL，较小缓存
  | 'adaptive';      // 自适应策略 - 根据性能动态调整

// 缓存策略配置
interface CacheStrategyConfig {
  ttl: number;        // 缓存生存时间（毫秒）
  maxSize: number;     // 最大缓存条目数
  hitRateThreshold: number; // 命中率阈值
  memoryThreshold: number; // 内存使用阈值
  cleanupInterval: number; // 清理间隔
  priorityBoost: number;   // 优先级提升因子
}

// 性能指标
interface PerformanceMetrics {
  hitRate: number;        // 缓存命中率
  missRate: number;       // 缓存未命中率
  averageResponseTime: number; // 平均响应时间
  memoryUsage: number;     // 内存使用量
  cacheSize: number;       // 缓存大小
  evictionRate: number;     // 驱逐率
  cpuUsage: number;        // CPU使用率
}

// 系统负载
interface SystemLoad {
  memoryPressure: number;  // 内存压力 (0-1)
  cpuUsage: number;        // CPU使用率 (0-1)
  requestRate: number;     // 请求率 (每秒)
  errorRate: number;       // 错误率 (0-1)
}

// 缓存策略详细配置
interface DetailedCacheStrategyConfig {
  name: string;
  description: string;
  strategy: CacheStrategy;
  ttl: number;
  maxSize: number;
  hitRateThreshold: number;
  memoryThreshold: number;
  cleanupInterval: number;
  priorityBoost: number;
  compressionEnabled: boolean;
  preFetchEnabled: boolean;
  metricsEnabled: boolean;
}

// 缓存使用指标
interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  cacheSize: number;
  evictionRate: number;
  timestamp: number;
}

// 缓存性能报告
interface CachePerformanceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  overall: {
    totalRequests: number;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    averageResponseTime: number;
    peakMemoryUsage: number;
  };
  strategies: Array<{
    name: string;
    metrics: CacheMetrics;
    efficiency: number;
    recommendations: string[];
  }>;
  trends: {
    hitRateTrend: number[];
    memoryUsageTrend: number[];
    responseTimeTrend: number[];
  };
}

/**
 * 智能缓存策略管理器
 */
export class CacheStrategyManager extends EventEmitter {
  private static instance: CacheStrategyManager;

  // 当前策略
  private currentStrategy: CacheStrategy = 'balanced';

  // 策略配置映射
  private strategyConfigs: Record<CacheStrategy, CacheStrategyConfig> = {
    aggressive: {
      ttl: 60 * 60 * 1000,      // 60分钟
      maxSize: 20000,
      hitRateThreshold: 0.85,
      memoryThreshold: 0.8,
      cleanupInterval: 10 * 60 * 1000, // 10分钟
      priorityBoost: 1.5,
    },
    balanced: {
      ttl: 30 * 60 * 1000,      // 30分钟
      maxSize: 10000,
      hitRateThreshold: 0.75,
      memoryThreshold: 0.6,
      cleanupInterval: 5 * 60 * 1000,  // 5分钟
      priorityBoost: 1.0,
    },
    conservative: {
      ttl: 10 * 60 * 1000,      // 10分钟
      maxSize: 5000,
      hitRateThreshold: 0.65,
      memoryThreshold: 0.4,
      cleanupInterval: 2 * 60 * 1000,  // 2分钟
      priorityBoost: 0.5,
    },
    adaptive: {
      ttl: 30 * 60 * 1000,      // 动态调整
      maxSize: 10000,
      hitRateThreshold: 0.75,
      memoryThreshold: 0.6,
      cleanupInterval: 5 * 60 * 1000,  // 5分钟
      priorityBoost: 1.0,
    },
  };

  // 性能历史记录
  private performanceHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 100;

  // 策略调整阈值
  private strategyThresholds = {
    hitRateLow: 0.6,        // 命中率低阈值
    hitRateHigh: 0.9,       // 命中率高阈值
    responseTimeHigh: 1000,    // 响应时间高阈值（毫秒）
    memoryPressureHigh: 0.8,   // 内存压力高阈值
    errorRateHigh: 0.1,       // 错误率高阈值
    requestRateHigh: 100,     // 请求率高阈值（每秒）
  };

  // 策略变更历史
  private strategyHistory: Array<{
    timestamp: number;
    oldStrategy: CacheStrategy;
    newStrategy: CacheStrategy;
    reason: string;
    metrics: PerformanceMetrics;
  }> = [];

  private constructor() {
    // 定期评估和调整策略
    setInterval(() => this.evaluateAndAdjustStrategy(), 30 * 1000); // 30秒

    // 定期清理历史记录
    setInterval(() => this.cleanupHistory(), 10 * 60 * 1000); // 10分钟

    logger.info('CacheStrategyManager 初始化完成', {
      initialStrategy: this.currentStrategy,
      config: this.strategyConfigs[this.currentStrategy],
    });
  }

  static getInstance(): CacheStrategyManager {
    if (!CacheStrategyManager.instance) {
      CacheStrategyManager.instance = new CacheStrategyManager();
    }
    return CacheStrategyManager.instance;
  }

  /**
   * 获取当前缓存策略
   */
  getCurrentStrategy(): CacheStrategy {
    return this.currentStrategy;
  }

  /**
   * 获取当前策略配置
   */
  getCurrentConfig(): CacheStrategyConfig {
    return this.strategyConfigs[this.currentStrategy];
  }

  /**
   * 手动设置缓存策略
   */
  setStrategy(strategy: CacheStrategy, reason?: string): void {
    const oldStrategy = this.currentStrategy;
    const newStrategy = strategy;

    if (oldStrategy !== newStrategy) {
      const oldConfig = this.strategyConfigs[oldStrategy];
      const newConfig = this.strategyConfigs[newStrategy];

      this.currentStrategy = newStrategy;

      // 记录策略变更
      this.strategyHistory.push({
        timestamp: Date.now(),
        oldStrategy,
        newStrategy,
        reason: reason || '手动设置',
        metrics: this.getCurrentMetrics(),
      });

      logger.info('缓存策略已变更', {
        oldStrategy,
        newStrategy,
        reason,
        oldConfig: {
          ttl: oldConfig.ttl / 1000 / 60,
          maxSize: oldConfig.maxSize,
        },
        newConfig: {
          ttl: newConfig.ttl / 1000 / 60,
          maxSize: newConfig.maxSize,
        },
      });

      // 通知策略变更监听器
      this.notifyStrategyChange(oldStrategy, newStrategy, reason);
    }
  }

  /**
   * 启用自适应模式
   */
  enableAdaptiveMode(): void {
    this.setStrategy('adaptive', '启用自适应缓存策略');
  }

  /**
   * 记录性能指标
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    const currentMetrics: PerformanceMetrics = {
      hitRate: metrics.hitRate || 0,
      missRate: metrics.missRate || (1 - (metrics.hitRate || 0)),
      averageResponseTime: metrics.averageResponseTime || 0,
      memoryUsage: metrics.memoryUsage || 0,
      cacheSize: metrics.cacheSize || 0,
      evictionRate: metrics.evictionRate || 0,
      cpuUsage: metrics.cpuUsage || 0,
    };

    this.performanceHistory.push(currentMetrics);

    // 限制历史记录大小
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    if (this.performanceHistory.length === 0) {
      return {
        hitRate: 0,
        missRate: 1,
        averageResponseTime: 0,
        memoryUsage: 0,
        cacheSize: 0,
        evictionRate: 0,
        cpuUsage: 0,
      };
    }

    return this.performanceHistory[this.performanceHistory.length - 1];
  }

  /**
   * 获取平均性能指标（最近N次）
   */
  getAverageMetrics(count: number = 10): PerformanceMetrics {
    if (this.performanceHistory.length === 0) {
      return this.getCurrentMetrics();
    }

    const recent = this.performanceHistory.slice(-count);
    const sum = recent.reduce(
      (acc, metrics) => ({
        hitRate: acc.hitRate + metrics.hitRate,
        missRate: acc.missRate + metrics.missRate,
        averageResponseTime: acc.averageResponseTime + metrics.averageResponseTime,
        memoryUsage: acc.memoryUsage + metrics.memoryUsage,
        cacheSize: acc.cacheSize + metrics.cacheSize,
        evictionRate: acc.evictionRate + metrics.evictionRate,
        cpuUsage: acc.cpuUsage + metrics.cpuUsage,
      }),
      {
        hitRate: 0,
        missRate: 0,
        averageResponseTime: 0,
        memoryUsage: 0,
        cacheSize: 0,
        evictionRate: 0,
        cpuUsage: 0,
      }
    );

    const countDivisor = recent.length;
    return {
      hitRate: sum.hitRate / countDivisor,
      missRate: sum.missRate / countDivisor,
      averageResponseTime: sum.averageResponseTime / countDivisor,
      memoryUsage: sum.memoryUsage / countDivisor,
      cacheSize: sum.cacheSize / countDivisor,
      evictionRate: sum.evictionRate / countDivisor,
      cpuUsage: sum.cpuUsage / countDivisor,
    };
  }

  /**
   * 获取系统负载
   */
  getSystemLoad(): SystemLoad {
    const metrics = this.getCurrentMetrics();

    return {
      memoryPressure: Math.min(1, metrics.memoryUsage / 1024), // 假设1GB为高压力
      cpuUsage: metrics.cpuUsage,
      requestRate: 0, // 这里需要从外部获取
      errorRate: 0, // 这里需要从外部获取
    };
  }

  /**
   * 评估并调整策略
   */
  private evaluateAndAdjustStrategy(): void {
    try {
      const metrics = this.getAverageMetrics(5); // 使用最近5次的平均值
      const systemLoad = this.getSystemLoad();
      const currentConfig = this.getCurrentConfig();

      const recommendedStrategy = this.calculateOptimalStrategy(metrics, systemLoad);

      if (recommendedStrategy !== this.currentStrategy) {
        const reason = this.getStrategyChangeReason(
          this.currentStrategy,
          recommendedStrategy,
          metrics,
          systemLoad,
          currentConfig
        );

        this.setStrategy(recommendedStrategy, reason);
      }

      // 自适应模式下动态调整配置
      if (this.currentStrategy === 'adaptive') {
        this.adjustAdaptiveConfig(metrics, systemLoad);
      }

    } catch (error) {
      logger.error('评估和调整缓存策略失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 计算最优策略
   */
  private calculateOptimalStrategy(
    metrics: PerformanceMetrics,
    systemLoad: SystemLoad
  ): CacheStrategy {
    let score = {
      aggressive: 0,
      balanced: 0,
      conservative: 0,
      adaptive: 0,
    };

    // 基于命中率的评分
    if (metrics.hitRate >= this.strategyThresholds.hitRateHigh) {
      score.aggressive += 30;
      score.balanced += 20;
      score.conservative += 10;
    } else if (metrics.hitRate <= this.strategyThresholds.hitRateLow) {
      score.conservative += 30;
      score.balanced += 20;
      score.aggressive += 10;
    } else {
      score.balanced += 25;
      score.aggressive += 15;
      score.conservative += 15;
    }

    // 基于响应时间的评分
    if (metrics.averageResponseTime <= 200) {
      score.aggressive += 20;
      score.balanced += 15;
    } else if (metrics.averageResponseTime >= this.strategyThresholds.responseTimeHigh) {
      score.conservative += 25;
      score.balanced += 15;
    } else {
      score.balanced += 20;
      score.aggressive += 10;
    }

    // 基于内存压力的评分
    if (systemLoad.memoryPressure <= 0.3) {
      score.aggressive += 20;
      score.balanced += 15;
    } else if (systemLoad.memoryPressure >= this.strategyThresholds.memoryPressureHigh) {
      score.conservative += 30;
      score.balanced += 20;
    } else {
      score.balanced += 25;
      score.aggressive += 10;
    }

    // 基于错误率的评分
    if (systemLoad.errorRate <= 0.02) {
      score.aggressive += 15;
      score.balanced += 10;
    } else if (systemLoad.errorRate >= this.strategyThresholds.errorRateHigh) {
      score.conservative += 20;
      score.balanced += 15;
    } else {
      score.balanced += 15;
      score.aggressive += 5;
    }

    // 选择得分最高的策略
    const strategies = Object.entries(score) as [CacheStrategy, number][];
    const optimalStrategy = strategies.reduce((a, b) => a[1] > b[1] ? a : b)[0];

    return optimalStrategy;
  }

  /**
   * 获取策略变更原因
   */
  private getStrategyChangeReason(
    oldStrategy: CacheStrategy,
    newStrategy: CacheStrategy,
    metrics: PerformanceMetrics,
    systemLoad: SystemLoad,
    currentConfig: CacheStrategyConfig
  ): string {
    const reasons: string[] = [];

    if (metrics.hitRate < this.strategyThresholds.hitRateLow) {
      reasons.push(`命中率过低 (${(metrics.hitRate * 100).toFixed(1)}%)`);
    } else if (metrics.hitRate > this.strategyThresholds.hitRateHigh) {
      reasons.push(`命中率很高 (${(metrics.hitRate * 100).toFixed(1)}%)`);
    }

    if (metrics.averageResponseTime > this.strategyThresholds.responseTimeHigh) {
      reasons.push(`响应时间过长 (${metrics.averageResponseTime.toFixed(0)}ms)`);
    }

    if (systemLoad.memoryPressure > this.strategyThresholds.memoryPressureHigh) {
      reasons.push(`内存压力过高 (${(systemLoad.memoryPressure * 100).toFixed(1)}%)`);
    }

    if (systemLoad.errorRate > this.strategyThresholds.errorRateHigh) {
      reasons.push(`错误率过高 (${(systemLoad.errorRate * 100).toFixed(1)}%)`);
    }

    return reasons.length > 0 ? reasons.join(', ') : '周期性评估';
  }

  /**
   * 调整自适应配置
   */
  private adjustAdaptiveConfig(metrics: PerformanceMetrics, systemLoad: SystemLoad): void {
    const config = this.strategyConfigs.adaptive;

    // 基于命中率动态调整TTL
    if (metrics.hitRate > 0.8) {
      config.ttl = Math.min(60 * 60 * 1000, config.ttl * 1.2);
    } else if (metrics.hitRate < 0.5) {
      config.ttl = Math.max(5 * 60 * 1000, config.ttl * 0.8);
    }

    // 基于内存压力调整缓存大小
    if (systemLoad.memoryPressure > 0.7) {
      config.maxSize = Math.max(1000, config.maxSize * 0.8);
    } else if (systemLoad.memoryPressure < 0.3) {
      config.maxSize = Math.min(20000, config.maxSize * 1.2);
    }

    // 基于CPU使用率调整清理间隔
    if (systemLoad.cpuUsage > 0.8) {
      config.cleanupInterval = Math.max(60 * 1000, config.cleanupInterval * 0.5);
    } else if (systemLoad.cpuUsage < 0.3) {
      config.cleanupInterval = Math.min(10 * 60 * 1000, config.cleanupInterval * 2);
    }

    // 更新配置
    this.strategyConfigs.adaptive = config;
  }

  /**
   * 通知策略变更
   */
  private notifyStrategyChange(
    oldStrategy: CacheStrategy,
    newStrategy: CacheStrategy,
    reason: string
  ): void {
    // 这里可以发送通知给其他服务或监控系统
    logger.info('缓存策略变更通知', {
      oldStrategy,
      newStrategy,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * 清理历史记录
   */
  private cleanupHistory(): void {
    // 保留最近24小时的策略变更历史
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.strategyHistory = this.strategyHistory.filter(
      entry => entry.timestamp > oneDayAgo
    );

    // 保留最近100条性能历史
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 获取策略统计
   */
  getStrategyStats() {
    const strategyUsage = this.strategyHistory.reduce((acc, entry) => {
      acc[entry.newStrategy] = (acc[entry.newStrategy] || 0) + 1;
      return acc;
    }, {} as Record<CacheStrategy, number>);

    const recentChanges = this.strategyHistory.slice(-10);
    const averageChangeInterval = recentChanges.length > 1
      ? (recentChanges[recentChanges.length - 1].timestamp - recentChanges[0].timestamp) / (recentChanges.length - 1)
      : 0;

    return {
      currentStrategy: this.currentStrategy,
      currentConfig: this.getCurrentConfig(),
      strategyUsage,
      totalChanges: this.strategyHistory.length,
      averageChangeInterval: averageChangeInterval / 1000 / 60, // 转换为分钟
      recentChanges: recentChanges.map(entry => ({
        timestamp: entry.timestamp,
        from: entry.oldStrategy,
        to: entry.newStrategy,
        reason: entry.reason,
      })),
      performanceHistory: this.performanceHistory.slice(-10),
    };
  }

  /**
   * 重置策略
   */
  resetStrategy(): void {
    this.setStrategy('balanced', '重置为默认策略');
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    try {
      this.currentStrategy = 'balanced';
      this.performanceHistory = [];
      this.strategyHistory = [];

      logger.info('CacheStrategyManager 已销毁');
    } catch (error) {
      logger.error('销毁缓存策略管理器失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// 导出单例实例
export const cacheStrategyManager = CacheStrategyManager.getInstance();