/**
 * 队列监控服务
 * 专门处理队列的实时监控、性能分析和告警
 */

import { EventEmitter } from 'events';
import type Redis from 'ioredis';
import logger from '@/utils/logger';
import type { QueueStatsService } from './QueueStatsService';
import type { QueueHealthService, QueueHealthConfig } from './QueueHealthService';
import type {
  QueueConfig,
  QueueStats,
  QueueMetrics,
  QueueAlert
} from '@/types/queue';
import {
  QueueHealthStatus,
  QueueEvent
} from '@/types/queue';

export interface QueueMonitoringConfig extends QueueHealthConfig {
  alertThresholds?: {
    queueSize?: number;
    errorRate?: number;
    processingTime?: number;
    memoryUsage?: number;
  };
  monitoringInterval?: number;
  metricsRetentionDays?: number;
}

export class QueueMonitoringService extends EventEmitter {
  private readonly redis: Redis;
  private readonly queueStatsService: QueueStatsService;
  private readonly queueHealthService: QueueHealthService;
  private readonly monitoringConfig: QueueMonitoringConfig;
  private readonly monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly metricsHistory: Map<string, QueueMetrics[]> = new Map();
  private readonly alerts: Map<string, QueueAlert[]> = new Map();
  private isMonitoring = false;

  constructor(
    redis: Redis,
    queueStatsService: QueueStatsService,
    queueHealthService: QueueHealthService,
    monitoringConfig: QueueMonitoringConfig = {}
  ) {
    super();
    this.redis = redis;
    this.queueStatsService = queueStatsService;
    this.queueHealthService = queueHealthService;
      this.monitoringConfig = {
        maxQueueSize: 1000,
        maxProcessingTime: 60000,
        maxErrorRate: 0.1,
        maxMemoryUsage: 0.8,
        checkInterval: 30000,
        alertThresholds: {
          queueSize: 800,
          errorRate: 0.15,
          processingTime: 45000,
          memoryUsage: 0.85
        },
        monitoringInterval: 10000, // 10秒
        metricsRetentionDays: 7,
        ...monitoringConfig
      };
    }

  /**
   * 开始监控指定队列
   */
  startMonitoring(queueName: string, queueConfig: QueueConfig): void {
    if (this.monitoringIntervals.has(queueName)) {
      logger.warn('⚠️ [QueueMonitoringService] 队列已在监控中', { queueName });
      return;
    }

    try {
      logger.info('🔍 [QueueMonitoringService] 开始监控队列', { queueName });

      // 设置监控间隔
      const interval = setInterval(() => {
        this.collectQueueMetrics(queueName, queueConfig);
      }, this.monitoringConfig.monitoringInterval);

      this.monitoringIntervals.set(queueName, interval);
      this.isMonitoring = true;

      // 发出监控开始事件
      this.emit('monitoring:started', {
        queueName,
        timestamp: new Date()
      });

      // 立即收集一次指标
      this.collectQueueMetrics(queueName, queueConfig);
    } catch (error) {
      logger.error('❌ [QueueMonitoringService] 开始监控失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 停止监控指定队列
   */
  stopMonitoring(queueName: string): void {
    const interval = this.monitoringIntervals.get(queueName);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(queueName);

      logger.info('⏹️ [QueueMonitoringService] 停止监控队列', { queueName });

      // 发出监控停止事件
      this.emit('monitoring:stopped', {
        queueName,
        timestamp: new Date()
      });
    }

    // 检查是否还有其他队列在监控
    if (this.monitoringIntervals.size === 0) {
      this.isMonitoring = false;
    }
  }

  /**
   * 开始监控所有队列
   */
  startMonitoringAll(queueConfigs: Record<string, QueueConfig>): void {
    const queueNames = Object.keys(queueConfigs);

    logger.info('🔍 [QueueMonitoringService] 开始监控所有队列', {
      queueCount: queueNames.length
    });

    queueNames.forEach(queueName => {
      const config = queueConfigs[queueName];
      if (config) {
        this.startMonitoring(queueName, config);
      }
    });
  }

  /**
   * 停止所有监控
   */
  stopMonitoringAll(): void {
    const queueNames = Array.from(this.monitoringIntervals.keys());

    logger.info('⏹️ [QueueMonitoringService] 停止所有队列监控', {
      queueCount: queueNames.length
    });

    queueNames.forEach(queueName => {
      this.stopMonitoring(queueName);
    });
  }

  /**
   * 手动收集队列指标
   */
  async collectQueueMetrics(queueName: string, queueConfig: QueueConfig): Promise<QueueMetrics> {
    try {
      const timestamp = Date.now();

      // 获取队列统计
      const stats = await this.queueStatsService.getQueueStats(queueName);
      if (!stats) {
        throw new Error(`队列 ${queueName} 不存在`);
      }

      // 获取健康状态
      const healthStatus = await this.queueHealthService.performHealthCheck(queueName, queueConfig);

      // 计算性能指标
      const metrics: QueueMetrics = {
        timestamp: Date.now(),
        queueName,
        stats,
        healthStatus,
        performance: {
          throughput: stats.throughput,
          avgProcessingTime: stats.avgProcessingTime,
          p95ProcessingTime: await this.calculateP95ProcessingTime(queueName),
          p99ProcessingTime: await this.calculateP99ProcessingTime(queueName),
          memoryUsage: await this.getMemoryUsage()
        },
        trends: {
          throughputTrend: this.calculateTrend(queueName, 'throughput'),
          errorRateTrend: this.calculateTrend(queueName, 'errorRate'),
          processingTimeTrend: this.calculateTrend(queueName, 'avgProcessingTime')
        },
        alerts: this.getCurrentAlerts(queueName)
      };

      // 存储指标历史
      this.storeMetricsHistory(queueName, metrics);

      // 检查告警条件
      await this.checkAlertConditions(queueName, metrics, queueConfig);

      // 发出指标更新事件
      this.emit('metrics:updated', metrics);

      return metrics;
    } catch (error) {
      logger.error('❌ [QueueMonitoringService] 收集队列指标失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取实时监控数据
   */
  getRealTimeMetrics(queueName: string): QueueMetrics | null {
    const history = this.metricsHistory.get(queueName);
    if (!history || history.length === 0) {
      return null;
    }

    return history[history.length - 1] || null;
  }

  /**
   * 获取历史指标数据
   */
  getMetricsHistory(
    queueName: string,
    timeRange?: { start: Date; end: Date }
  ): QueueMetrics[] {
    const history = this.metricsHistory.get(queueName);
    if (!history) {
      return [];
    }

    if (!timeRange) {
      return [...history];
    }

    const { start, end } = timeRange;
    return history.filter(metrics =>
      metrics.timestamp >= start.getTime() &&
      metrics.timestamp <= end.getTime()
    );
  }

  /**
   * 获取当前告警
   */
  getCurrentAlerts(queueName: string): QueueAlert[] {
    return this.alerts.get(queueName) || [];
  }

  /**
   * 获取所有队列的监控状态
   */
  getMonitoringStatus(): Record<string, {
    isMonitoring: boolean;
    lastUpdate: Date | null;
    alertCount: number;
  }> {
    const status: Record<string, any> = {};

    for (const [queueName, interval] of this.monitoringIntervals) {
      const history = this.metricsHistory.get(queueName);
      const alerts = this.alerts.get(queueName) || [];

      status[queueName] = {
        isMonitoring: !!interval,
        lastUpdate: history && history.length > 0 ? new Date(history[history.length - 1]!.timestamp) : null,
        alertCount: alerts.length
      };
    }

    return status;
  }

  /**
   * 清理过期的指标数据
   */
  cleanupOldMetrics(): void {
    const retentionMs = (this.monitoringConfig.metricsRetentionDays || 7) * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    let totalCleaned = 0;

    for (const [queueName, history] of this.metricsHistory.entries()) {
      const originalLength = history.length;

      // 过滤掉过期的数据
      const filteredHistory = history.filter(metrics =>
        metrics && metrics.timestamp > cutoffTime
      );

      this.metricsHistory.set(queueName, filteredHistory);
      totalCleaned += originalLength - filteredHistory.length;
    }

    if (totalCleaned > 0) {
      logger.info('🧹 [QueueMonitoringService] 清理过期指标数据', {
        totalCleaned,
        retentionDays: this.monitoringConfig.metricsRetentionDays
      });
    }
  }

  /**
   * 存储指标历史
   */
  private storeMetricsHistory(queueName: string, metrics: QueueMetrics): void {
    const history = this.metricsHistory.get(queueName) || [];
    history.push(metrics);

    // 限制历史记录数量
    const maxHistory = 1000; // 保留最近1000条记录
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }

    this.metricsHistory.set(queueName, history);
  }

  /**
   * 检查告警条件
   */
  private async checkAlertConditions(
    queueName: string,
    metrics: QueueMetrics,
    queueConfig: QueueConfig
  ): Promise<void> {
    try {
      const thresholds = this.monitoringConfig.alertThresholds || {};
      const alerts: QueueAlert[] = [];

      // 检查队列大小告警
      if ((metrics.stats.total || 0) > (thresholds.queueSize || 800)) {
        alerts.push({
          type: 'queue_size',
          severity: (metrics.stats.total || 0) > (thresholds.queueSize || 800) * 1.2 ? 'critical' : 'medium',
          message: `队列大小过大: ${metrics.stats.total || 0}`,
          value: metrics.stats.total || 0,
          threshold: thresholds.queueSize || 800,
          timestamp: new Date()
        });
      }

      // 检查错误率告警
      if (metrics.stats.errorRate > (thresholds.errorRate || 0.15)) {
        alerts.push({
          type: 'error_rate',
          severity: metrics.stats.errorRate > (thresholds.errorRate || 0.15) * 1.2 ? 'critical' : 'medium',
          message: `错误率过高: ${Math.round(metrics.stats.errorRate * 100)}%`,
          value: metrics.stats.errorRate,
          threshold: thresholds.errorRate || 0.15,
          timestamp: new Date()
        });
      }

      // 检查处理时间告警
      if (metrics.stats.avgProcessingTime > (thresholds.processingTime || 45000)) {
        alerts.push({
          type: 'processing_time',
          severity: metrics.stats.avgProcessingTime > (thresholds.processingTime || 45000) * 1.2 ? 'critical' : 'medium',
          message: `处理时间过长: ${Math.round(metrics.stats.avgProcessingTime / 1000)}s`,
          value: metrics.stats.avgProcessingTime,
          threshold: thresholds.processingTime || 45000,
          timestamp: new Date()
        });
      }

      // 检查内存使用告警
      if (metrics.performance.memoryUsage > (thresholds.memoryUsage || 0.85)) {
        alerts.push({
          type: 'memory_usage',
          severity: metrics.performance.memoryUsage > (thresholds.memoryUsage || 0.85) * 1.1 ? 'critical' : 'medium',
          message: `内存使用过高: ${Math.round(metrics.performance.memoryUsage * 100)}%`,
          value: metrics.performance.memoryUsage,
          threshold: thresholds.memoryUsage || 0.85,
          timestamp: new Date()
        });
      }

      // 检查健康状态告警
      if (!metrics.healthStatus.healthy) {
        alerts.push({
          type: 'health_status',
          severity: 'critical',
          message: `队列状态异常: ${metrics.healthStatus.status}`,
          details: metrics.healthStatus.issues.length > 0 ? metrics.healthStatus.issues : [],
          timestamp: new Date(),
          value: 0,
          threshold: 0
        });
      }

      // 更新告警记录
      if (alerts.length > 0) {
        this.alerts.set(queueName, alerts);

        // 发出告警事件
        alerts.forEach(alert => {
          this.emit('alert:triggered', {
            queueName,
            alert
          });
        });

        logger.warn('🚨 [QueueMonitoringService] 触发告警', {
          queueName,
          alertCount: alerts.length,
          alerts: alerts.map(a => ({ type: a.type, severity: a.severity, message: a.message }))
        });
      }
    } catch (error) {
      logger.error('❌ [QueueMonitoringService] 告警条件检查失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 计算P95处理时间
   */
  private async calculateP95ProcessingTime(queueName: string): Promise<number> {
    try {
      // 获取最近100个完成的作业
      const completedJobs = await this.redis.zrevrange(`${queueName}:completed`, 0, 99);
      if (completedJobs.length === 0) {
        return 0;
      }

      const processingTimes: number[] = [];
      const pipeline = this.redis.pipeline();

      completedJobs.forEach(jobId => {
        pipeline.hget(`${queueName}:jobs`, jobId);
      });

      const results = await pipeline.exec();
      if (!results) {
        return 0;
      }

      results.forEach(([error, jobData]) => {
        if (!error && jobData) {
          try {
            const job = JSON.parse(jobData as string);
            if (job.processedOn && job.createdAt) {
              const processingTime = job.processedOn.getTime() - job.createdAt.getTime();
              processingTimes.push(processingTime);
            }
          } catch (parseError) {
            // 忽略解析错误
          }
        }
      });

      if (processingTimes.length === 0) {
        return 0;
      }

      // 计算P95
      processingTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(processingTimes.length * 0.95);
      return processingTimes[p95Index] || 0;
    } catch (error) {
      logger.warn('⚠️ [QueueMonitoringService] P95处理时间计算失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * 计算P99处理时间
   */
  private async calculateP99ProcessingTime(queueName: string): Promise<number> {
    try {
      // 获取最近100个完成的作业
      const completedJobs = await this.redis.zrevrange(`${queueName}:completed`, 0, 99);
      if (completedJobs.length === 0) {
        return 0;
      }

      const processingTimes: number[] = [];
      const pipeline = this.redis.pipeline();

      completedJobs.forEach(jobId => {
        pipeline.hget(`${queueName}:jobs`, jobId);
      });

      const results = await pipeline.exec();
      if (!results) {
        return 0;
      }

      results.forEach(([error, jobData]) => {
        if (!error && jobData) {
          try {
            const job = JSON.parse(jobData as string);
            if (job.processedOn && job.createdAt) {
              const processingTime = job.processedOn.getTime() - job.createdAt.getTime();
              processingTimes.push(processingTime);
            }
          } catch (parseError) {
            // 忽略解析错误
          }
        }
      });

      if (processingTimes.length === 0) {
        return 0;
      }

      // 计算P99
      processingTimes.sort((a, b) => a - b);
      const p99Index = Math.floor(processingTimes.length * 0.99);
      return processingTimes[p99Index] || 0;
    } catch (error) {
      logger.warn('⚠️ [QueueMonitoringService] P99处理时间计算失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * 获取内存使用率
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      const memoryInfo = await this.redis.info('memory');
      const memoryLines = memoryInfo.split('\r\n');
      const memoryData: Record<string, string> = {};

      memoryLines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            memoryData[key] = value;
          }
        }
      });

      const memoryStats = Object.entries(memoryData).reduce((acc, [key, value]) => {
        if (key.includes('used_memory_human')) {
          const usedMB = parseFloat(value.split(' ')[0] || '0');
          const totalMB = parseFloat(memoryData['maxmemory_human']?.split(' ')[0] || '0');
          acc.used = usedMB;
          acc.total = totalMB;
        }
        return acc;
      }, {} as { used: number; total: number });

      return memoryStats.used / memoryStats.total;
    } catch (error) {
      logger.warn('⚠️ [QueueMonitoringService] 内存使用率获取失败', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrend(queueName: string, metric: string): 'up' | 'down' | 'stable' {
    const history = this.metricsHistory.get(queueName);
    if (!history || history.length < 2) {
      return 'stable';
    }

    const recent = history.slice(-10); // 最近10个数据点
    if (recent.length < 2) {
      return 'stable';
    }

    let increaseCount = 0;
    let decreaseCount = 0;

    for (let i = 1; i < recent.length; i++) {
      const current = recent[i]!.stats[metric as keyof QueueStats];
      const previous = recent[i - 1]!.stats[metric as keyof QueueStats];

      if (current && previous) {
        if (current > previous) {
          increaseCount++;
        } else if (current < previous) {
          decreaseCount++;
        }
      }
    }

    if (increaseCount > decreaseCount * 1.5) {
      return 'up';
    } else if (decreaseCount > increaseCount * 1.5) {
      return 'down';
    } else {
      return 'stable';
    }
  }
}