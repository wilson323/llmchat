/**
 * 队列管理可视化数据服务
 * 为可视化界面提供数据支持和实时更新
 */

import type QueueManager from '@/services/QueueManager';
import type MonitoringService from '@/services/MonitoringService';
import type RedisConnectionPool from '@/utils/redisConnectionPool';
import { EventEmitter } from 'events';

export interface RealtimeDataUpdate {
  timestamp: number;
  type: 'queue' | 'system' | 'performance' | 'alert';
  data: unknown;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

export interface QueueStatsSnapshot {
  queueName: string;
  timestamp: number;
  totalJobs: number;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  throughput: number;
  avgProcessingTime: number;
  errorRate: number;
}

export interface SystemStatsSnapshot {
  timestamp: number;
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
  uptime: number;
}

export interface RedisStatsSnapshot {
  timestamp: number;
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  operations: {
    commands: number;
    errors: number;
    successRate: number;
  };
  memory: {
    used: number;
    peak: number;
  };
}

class VisualizationDataService extends EventEmitter {
  private readonly queueManager: QueueManager;
  private readonly monitoringService: MonitoringService;
  private readonly connectionPool: RedisConnectionPool;
  private readonly dataHistory: Map<string, Array<any>>;
  private readonly maxHistorySize: number;
  private updateInterval: NodeJS.Timeout | null;
  private readonly subscribers: Map<string, Set<(data: RealtimeDataUpdate) => void>>;

  constructor(
    queueManager: QueueManager,
    monitoringService: MonitoringService,
    connectionPool: RedisConnectionPool
  ) {
    super();
    this.queueManager = queueManager;
    this.monitoringService = monitoringService;
    this.connectionPool = connectionPool;
    this.dataHistory = new Map();
    this.maxHistorySize = 1000;
    this.updateInterval = null;
    this.subscribers = new Map();

    this.initializeDataHistory();
  }

  /**
   * 初始化数据历史记录
   */
  private initializeDataHistory(): void {
    this.dataHistory.set('queueStats', []);
    this.dataHistory.set('systemStats', []);
    this.dataHistory.set('redisStats', []);
    this.dataHistory.set('alerts', []);
    this.dataHistory.set('performance', []);
  }

  /**
   * 启动实时数据收集
   */
  public startRealtimeCollection(intervalMs = 5000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        await this.collectAllData();
      } catch (error: any) {
        console.error('Error collecting realtime data:', error);
      }
    }, intervalMs);
  }

  /**
   * 停止实时数据收集
   */
  public stopRealtimeCollection(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 收集所有数据
   */
  public async collectAllData(): Promise<void> {
    const timestamp = Date.now();

    // 并行收集各种数据
    const [queueStats, systemStats, redisStats, performanceMetrics] = await Promise.all([
      this.collectQueueStats(timestamp),
      this.collectSystemStats(timestamp),
      this.collectRedisStats(timestamp),
      this.collectPerformanceMetrics(timestamp),
    ]);

    // 更新历史数据
    this.updateHistory('queueStats', queueStats);
    this.updateHistory('systemStats', systemStats);
    this.updateHistory('redisStats', redisStats);
    this.updateHistory('performance', performanceMetrics);

    // 发送实时更新
    this.broadcastUpdate({
      timestamp,
      type: 'queue',
      data: queueStats,
    });

    this.broadcastUpdate({
      timestamp,
      type: 'system',
      data: systemStats,
    });

    this.broadcastUpdate({
      timestamp,
      type: 'performance',
      data: performanceMetrics,
    });
  }

  /**
   * 收集队列统计数据
   */
  public async collectQueueStats(timestamp: number): Promise<QueueStatsSnapshot[]> {
    const queueNames = await this.queueManager.getAllQueues();
    const stats: QueueStatsSnapshot[] = [];

    for (const queueName of queueNames) {
      const queueStats = await this.queueManager.getQueueStats(queueName);
      const completedJobs = await this.queueManager.getCompletedJobs(queueName, 1);
      const failedJobs = await this.queueManager.getFailedJobs(queueName, 1);

      stats.push({
        queueName,
        timestamp,
        totalJobs: (queueStats?.waiting || 0) + (queueStats?.active || 0) + (queueStats?.completed || 0) + (queueStats?.failed || 0),
        waitingJobs: queueStats?.waiting || 0,
        activeJobs: queueStats?.active || 0,
        completedJobs: queueStats?.completed || 0,
        failedJobs: queueStats?.failed || 0,
        throughput: this.calculateThroughput(completedJobs),
        avgProcessingTime: queueStats?.avgProcessingTime || 0,
        errorRate: this.calculateErrorRate(completedJobs, failedJobs),
      });
    }

    return stats;
  }

  /**
   * 收集系统统计数据
   */
  public async collectSystemStats(timestamp: number): Promise<SystemStatsSnapshot> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    // 获取事件循环延迟
    const eventLoopDelay = await this.measureEventLoopDelay();

    return {
      timestamp,
      cpu: this.calculateCPUUsage(cpuUsage),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      eventLoopDelay,
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
      uptime,
    };
  }

  /**
   * 收集Redis统计数据
   */
  public async collectRedisStats(timestamp: number): Promise<RedisStatsSnapshot> {
    const poolStats = this.connectionPool.getStats();

    return {
      timestamp,
      connections: {
        active: (poolStats as any).active || 0,
        idle: (poolStats as any).idle || 0,
        total: (poolStats as any).total || 0,
      },
      operations: {
        commands: (poolStats as any).commandsProcessed || 0,
        errors: (poolStats as any).errors || 0,
        successRate: this.calculateSuccessRate(poolStats),
      },
      memory: {
        used: (poolStats as any).memoryUsed || 0,
        peak: (poolStats as any).memoryPeak || 0,
      },
    };
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(timestamp: number): Promise<any> {
    const metrics = await this.monitoringService.getCurrentMetrics();

    return {
      timestamp,
      ...metrics,
    };
  }

  /**
   * 测量事件循环延迟
   */
  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // 转换为毫秒
        resolve(delay);
      });
    });
  }

  /**
   * 计算CPU使用率
   */
  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    const total = cpuUsage.user + cpuUsage.system;
    return total / 1000000; // 转换为毫秒
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(completedJobs: Array<{finishedOn?: number}>): number {
    if (completedJobs.length === 0) return 0;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentJobs = completedJobs.filter(job => job.finishedOn >= oneMinuteAgo);
    return recentJobs.length;
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(completedJobs: unknown[], failedJobs: unknown[]): number {
    const total = completedJobs.length + failedJobs.length;
    if (total === 0) return 0;
    return (failedJobs.length / total) * 100;
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(poolStats: {commandsProcessed: number; errors: number}): number {
    const total = poolStats.commandsProcessed + poolStats.errors;
    if (total === 0) return 100;
    return (poolStats.commandsProcessed / total) * 100;
  }

  /**
   * 更新历史数据
   */
  private updateHistory(key: string, data: unknown): void {
    const history = this.dataHistory.get(key) || [];
    history.push(data);

    // 限制历史数据大小
    while (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.dataHistory.set(key, history);
  }

  /**
   * 广播更新到订阅者
   */
  private broadcastUpdate(update: RealtimeDataUpdate): void {
    this.emit('dataUpdate', update);

    const subscribers = this.subscribers.get(update.type);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(update);
        } catch (error: any) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  /**
   * 订阅特定类型的数据更新
   */
  public subscribe(type: string, callback: (data: RealtimeDataUpdate) => void): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }

    this.subscribers.get(type)!.add(callback);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.subscribers.get(type);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  /**
   * 获取队列历史数据
   */
  public getQueueHistory(queueName?: string, limit?: number): QueueStatsSnapshot[] {
    const history = this.dataHistory.get('queueStats') || [];
    let filtered = history;

    if (queueName) {
      filtered = history.filter((snapshot: QueueStatsSnapshot[]) =>
        snapshot.some((stat: QueueStatsSnapshot) => stat.queueName === queueName)
      ).flat();
    }

    if (limit && limit > 0) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * 获取系统历史数据
   */
  public getSystemHistory(limit?: number): SystemStatsSnapshot[] {
    const history = this.dataHistory.get('systemStats') || [];
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * 获取Redis历史数据
   */
  public getRedisHistory(limit?: number): RedisStatsSnapshot[] {
    const history = this.dataHistory.get('redisStats') || [];
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * 获取图表数据
   */
  public getChartData(type: 'queue' | 'system' | 'redis', metric: string, timeRange?: number): ChartData {
    let history: unknown[] = [];

    switch (type) {
      case 'queue':
        history = this.getQueueHistory(undefined, timeRange);
        break;
      case 'system':
        history = this.getSystemHistory(timeRange);
        break;
      case 'redis':
        history = this.getRedisHistory(timeRange);
        break;
    }

    const labels = history.map(item => new Date(item.timestamp).toLocaleTimeString());
    const datasets = this.extractDatasets(history, metric, type);

    return {
      labels,
      datasets,
    };
  }

  /**
   * 提取数据集
   */
  private extractDatasets(history: unknown[], metric: string, type: string): Array<unknown> {
    if (type === 'queue' && Array.isArray(history[0])) {
      // 队列数据是数组的数组
      const queueNames = history[0].map((item: QueueStatsSnapshot) => item.queueName);
      return queueNames.map((queueName: string, index: number) => ({
        label: queueName,
        data: history.map((snapshot: QueueStatsSnapshot[]) => {
          const queueStat = snapshot.find(stat => stat.queueName === queueName);
          return queueStat ? (queueStat as any)[metric] || 0 : 0;
        }),
        backgroundColor: this.getColorForIndex(index),
        borderColor: this.getColorForIndex(index, 0.8),
        fill: false,
      }));
    } else {
      // 系统和Redis数据
      return [{
        label: metric,
        data: history.map(item => {
          if (typeof item === 'object' && metric in item) {
            return typeof item[metric] === 'object' ? item[metric].percentage || item[metric].value || 0 : item[metric];
          }
          return 0;
        }),
        backgroundColor: this.getColorForIndex(0),
        borderColor: this.getColorForIndex(0, 0.8),
        fill: true,
      }];
    }
  }

  /**
   * 获取颜色
   */
  private getColorForIndex(index: number, alpha = 0.2): string {
    const colors = [
      `rgba(59, 130, 246, ${alpha})`, // blue
      `rgba(16, 185, 129, ${alpha})`, // green
      `rgba(245, 158, 11, ${alpha})`, // yellow
      `rgba(239, 68, 68, ${alpha})`,  // red
      `rgba(139, 92, 246, ${alpha})`, // purple
      `rgba(236, 72, 153, ${alpha})`, // pink
    ];
    return colors[index % colors.length] || `rgba(100, 100, 100, ${alpha})`;
  }

  /**
   * 获取实时统计摘要
   */
  public async getRealtimeSummary(): Promise<any> {
    const [queueStats, systemStats, redisStats] = await Promise.all([
      this.collectQueueStats(Date.now()),
      this.collectSystemStats(Date.now()),
      this.collectRedisStats(Date.now()),
    ]);

    return {
      timestamp: Date.now(),
      queues: {
        total: queueStats.length,
        totalJobs: queueStats.reduce((sum, stat) => sum + stat.totalJobs, 0),
        waitingJobs: queueStats.reduce((sum, stat) => sum + stat.waitingJobs, 0),
        activeJobs: queueStats.reduce((sum, stat) => sum + stat.activeJobs, 0),
        avgThroughput: queueStats.reduce((sum, stat) => sum + stat.throughput, 0) / queueStats.length,
      },
      system: {
        cpu: systemStats.cpu,
        memoryUsage: systemStats.memory.percentage,
        eventLoopDelay: systemStats.eventLoopDelay,
        uptime: systemStats.uptime,
      },
      redis: {
        connections: redisStats.connections.total,
        successRate: redisStats.operations.successRate,
      },
    };
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopRealtimeCollection();
    this.subscribers.clear();
    this.dataHistory.clear();
    this.removeAllListeners();
  }
}

export default VisualizationDataService;
