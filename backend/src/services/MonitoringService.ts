/**
 * 实时监控和告警系统
 * 提供全面的系统监控、告警规则配置和通知功能
 */

import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import type MemoryOptimizationService from '@/services/MemoryOptimizationService';
import type QueueManager from '@/services/QueueManager';

export interface MonitoringConfig {
  // 监控开关
  enabled: boolean;
  enablePerformanceMonitoring: boolean;
  enableQueueMonitoring: boolean;
  enableMemoryMonitoring: boolean;
  enableSystemMonitoring: boolean;

  // 监控间隔
  performanceIntervalMs: number;
  queueIntervalMs: number;
  memoryIntervalMs: number;
  systemIntervalMs: number;

  // 数据保留
  historyRetentionHours: number;
  maxDataPoints: number;

  // 告警配置
  enableAlerts: boolean;
  alertCooldownMs: number;
  maxAlertsPerHour: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  duration: number; // 持续时间(ms)
  severity: 'info' | 'warning' | 'error' | 'critical';
  cooldown: number; // 冷却时间(ms)
  actions: AlertAction[];
  tags: Record<string, string>;
}

export interface AlertAction {
  type: 'webhook' | 'email' | 'log' | 'callback';
  config: Record<string, any>;
  enabled: boolean;
}

export interface MonitoringMetrics {
  timestamp: number;
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    eventLoopDelay: number;
    activeHandles: number;
    activeRequests: number;
  };
  queue: {
    totalQueues: number;
    totalJobs: number;
    waitingJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    throughput: number;
    avgProcessingTime: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    heapUsedPercentage: number;
    rssMB: number;
    external: number;
  };
  system: {
    uptime: number;
    loadAverage: number[];
    freeMemoryMB: number;
    totalMemoryMB: number;
    diskUsage: number;
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolved: boolean;
  resolvedAt?: number;
  tags: Record<string, string>;
}

export interface MonitoringReport {
  timestamp: number;
  duration: number;
  metrics: MonitoringMetrics;
  alerts: Alert[];
  systemHealth: {
    overall: 'healthy' | 'warning' | 'critical';
    components: Record<string, 'healthy' | 'warning' | 'critical'>;
  };
  recommendations: string[];
}

export interface MonitoringStats {
  startTime: number;
  uptime: number;
  isRunning: boolean;
  metricsCollected: number;
  alertsTriggered: number;
  activeAlerts: number;
  lastAlertTime: number;
  lastMetricsTime: number;
  totalMetrics: number;
  totalAlerts: number;
  configuredRules: number;
  metricsHistorySize: number;
  alertHistorySize: number;
}

/**
 * 实时监控服务
 */
export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService | null = null;
  private config: MonitoringConfig;
  private readonly queueManager: QueueManager;
  private readonly memoryOptimizationService: MemoryOptimizationService | null;

  // 监控定时器
  private performanceTimer: NodeJS.Timeout | null;
  private queueTimer: NodeJS.Timeout | null;
  private memoryTimer: NodeJS.Timeout | null;
  private systemTimer: NodeJS.Timeout | null;

  // 数据存储
  private metricsHistory: MonitoringMetrics[] = [];
  private readonly alertRules: Map<string, AlertRule> = new Map();
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];

  // 统计信息
  private readonly stats: MonitoringStats = {
    startTime: Date.now(),
    uptime: 0,
    isRunning: false,
    metricsCollected: 0,
    alertsTriggered: 0,
    activeAlerts: 0,
    lastAlertTime: 0,
    lastMetricsTime: 0,
    totalMetrics: 0,
    totalAlerts: 0,
    configuredRules: 0,
    metricsHistorySize: 0,
    alertHistorySize: 0
  };

  // 状态
  private isRunning = false;
  private isShuttingDown = false;

  constructor(
    queueManager: QueueManager,
    memoryOptimizationService?: MemoryOptimizationService,
    config: Partial<MonitoringConfig> = {}
  ) {
    super();

    this.queueManager = queueManager;
    this.memoryOptimizationService = memoryOptimizationService || null;

    // 初始化定时器
    this.performanceTimer = null;
    this.queueTimer = null;
    this.memoryTimer = null;
    this.systemTimer = null;

    this.config = {
      enabled: true,
      enablePerformanceMonitoring: true,
      enableQueueMonitoring: true,
      enableMemoryMonitoring: true,
      enableSystemMonitoring: true,
      performanceIntervalMs: 30000,    // 30秒
      queueIntervalMs: 10000,          // 10秒
      memoryIntervalMs: 30000,         // 30秒
      systemIntervalMs: 60000,         // 1分钟
      historyRetentionHours: 24,
      maxDataPoints: 1000,
      enableAlerts: true,
      alertCooldownMs: 300000,         // 5分钟
      maxAlertsPerHour: 50,
      ...config
    };

    this.initializeDefaultAlertRules();
    this.setupEventListeners();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(
    queueManager?: QueueManager,
    memoryOptimizationService?: MemoryOptimizationService,
    config?: Partial<MonitoringConfig>
  ): MonitoringService {
    if (!MonitoringService.instance) {
      if (!queueManager) {
        throw new Error('QueueManager is required for MonitoringService initialization');
      }
      MonitoringService.instance = new MonitoringService(
        queueManager,
        memoryOptimizationService,
        config
      );
    }
    return MonitoringService.instance;
  }

  /**
   * 获取当前性能指标
   */
  public async getCurrentMetrics(): Promise<any> {
    try {
      const timestamp = Date.now();

      // 并行收集各种指标
      const [performanceMetrics, queueMetrics, memoryMetrics, systemMetrics] = await Promise.all([
        this.collectPerformanceMetrics(),
        this.collectQueueMetrics(),
        this.collectMemoryMetrics(),
        this.collectSystemMetrics()
      ]);

      return {
        timestamp,
        performance: performanceMetrics,
        queue: queueMetrics,
        memory: memoryMetrics,
        system: systemMetrics
      };

    } catch (error: any) {
      logger.error('MonitoringService: Failed to get current metrics', error);
      throw error;
    }
  }

  /**
   * 重置单例实例
   */
  public static resetInstance(): void {
    if (MonitoringService.instance) {
      MonitoringService.instance.shutdown();
      MonitoringService.instance = null;
    }
  }

  /**
   * 启动监控服务
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('MonitoringService: Service already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('MonitoringService: Monitoring is disabled in configuration');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = Date.now();

    logger.info('MonitoringService: Starting monitoring service', {
      enabled: this.config.enabled,
      alerts: this.config.enableAlerts,
      monitoring: {
        performance: this.config.enablePerformanceMonitoring,
        queue: this.config.enableQueueMonitoring,
        memory: this.config.enableMemoryMonitoring,
        system: this.config.enableSystemMonitoring
      }
    });

    this.startMonitoring();
    this.emit('service:started');
  }

  /**
   * 停止监控服务
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isShuttingDown = true;

    this.stopMonitoring();
    this.isRunning = false;
    this.isShuttingDown = false;

    logger.info('MonitoringService: Monitoring service stopped');
    this.emit('service:stopped');
  }

  /**
   * 启动各项监控
   */
  private startMonitoring(): void {
    if (this.config.enablePerformanceMonitoring) {
      this.performanceTimer = setInterval(
        () => this.collectPerformanceMetrics(),
        this.config.performanceIntervalMs
      );
    }

    if (this.config.enableQueueMonitoring) {
      this.queueTimer = setInterval(
        () => this.collectQueueMetrics(),
        this.config.queueIntervalMs
      );
    }

    if (this.config.enableMemoryMonitoring) {
      this.memoryTimer = setInterval(
        () => this.collectMemoryMetrics(),
        this.config.memoryIntervalMs
      );
    }

    if (this.config.enableSystemMonitoring) {
      this.systemTimer = setInterval(
        () => this.collectSystemMetrics(),
        this.config.systemIntervalMs
      );
    }

    // 立即收集一次数据
    this.collectAllMetrics();
  }

  /**
   * 停止各项监控
   */
  private stopMonitoring(): void {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }

    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }

    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }

    if (this.systemTimer) {
      clearInterval(this.systemTimer);
      this.systemTimer = null;
    }
  }

  /**
   * 收集所有指标
   */
  private async collectAllMetrics(): Promise<void> {
    try {
      const metrics: Partial<MonitoringMetrics> = {
        timestamp: Date.now()
      };

      if (this.config.enablePerformanceMonitoring) {
        metrics.performance = await this.collectPerformanceMetrics();
      }

      if (this.config.enableQueueMonitoring) {
        metrics.queue = await this.collectQueueMetrics();
      }

      if (this.config.enableMemoryMonitoring) {
        metrics.memory = await this.collectMemoryMetrics();
      }

      if (this.config.enableSystemMonitoring) {
        metrics.system = await this.collectSystemMetrics();
      }

      const completeMetrics = metrics as MonitoringMetrics;
      this.storeMetrics(completeMetrics);
      this.evaluateAlertRules(completeMetrics);

      this.emit('metrics:collected', completeMetrics);

    } catch (error: any) {
      logger.error('MonitoringService: Failed to collect metrics', error);
      this.emit('metrics:error', error);
    }
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<MonitoringMetrics['performance']> {
    const usage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    // 计算CPU使用率
    const cpuUsage = (usage.user + usage.system) / 1000000; // 转换为秒

    // 事件循环延迟检测
    const eventLoopDelay = await this.measureEventLoopDelay();

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
      eventLoopDelay: Math.round(eventLoopDelay * 100) / 100,
      activeHandles: (process as any)._getActiveHandles ? (process as any)._getActiveHandles().length : 0,
      activeRequests: (process as any)._getActiveRequests ? (process as any)._getActiveRequests().length : 0
    };
  }

  /**
   * 收集队列指标
   */
  private async collectQueueMetrics(): Promise<MonitoringMetrics['queue']> {
    try {
      const queueHealth = await this.queueManager.healthCheck();
      const {queues} = queueHealth;

      let totalJobs = 0;
      let waitingJobs = 0;
      let activeJobs = 0;
      let completedJobs = 0;
      let failedJobs = 0;
      let totalThroughput = 0;
      let totalProcessingTime = 0;
      let queueCount = 0;

      for (const [queueName, stats] of Object.entries(queues)) {
        totalJobs += stats.waiting + stats.active + stats.completed + stats.failed;
        waitingJobs += stats.waiting;
        activeJobs += stats.active;
        completedJobs += stats.completed;
        failedJobs += stats.failed;

        // 从stats中提取throughput和processingTime（如果可用）
        if ('throughput' in stats) {
          totalThroughput += (stats).throughput || 0;
        }
        if ('avgProcessingTime' in stats) {
          totalProcessingTime += (stats).avgProcessingTime || 0;
        }

        queueCount++;
      }

      return {
        totalQueues: queueCount,
        totalJobs,
        waitingJobs,
        activeJobs,
        completedJobs,
        failedJobs,
        throughput: totalThroughput,
        avgProcessingTime: queueCount > 0 ? totalProcessingTime / queueCount : 0
      };

    } catch (error: any) {
      logger.error('MonitoringService: Failed to collect queue metrics', error);
      return {
        totalQueues: 0,
        totalJobs: 0,
        waitingJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        throughput: 0,
        avgProcessingTime: 0
      };
    }
  }

  /**
   * 收集内存指标
   */
  private async collectMemoryMetrics(): Promise<MonitoringMetrics['memory']> {
    try {
      const memoryStatus = await this.queueManager.getMemoryStatus();

      if (memoryStatus.enabled && memoryStatus.current) {
        return {
          heapUsed: memoryStatus.current.heapUsed,
          heapTotal: memoryStatus.current.heapTotal,
          heapUsedPercentage: memoryStatus.current.heapUsedPercentage,
          rssMB: memoryStatus.current.rssMB,
          external: 0 // 需要从其他地方获取
        };
      }

      // 备用方案：直接从process获取
      const memUsage = process.memoryUsage();
      return {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        heapUsedPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
        rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        external: memUsage.external
      };

    } catch (error: any) {
      logger.error('MonitoringService: Failed to collect memory metrics', error);
      const memUsage = process.memoryUsage();
      return {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        heapUsedPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
        rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        external: memUsage.external
      };
    }
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<MonitoringMetrics['system']> {
    try {
      const uptime = process.uptime();

      // 获取负载平均值（Linux/Unix系统）
      let loadAverage: number[] = [0, 0, 0];
      try {
        loadAverage = require('os').loadavg();
      } catch (error: any) {
        // Windows系统可能不支持loadavg
      }

      // 获取内存信息
      let freeMemoryMB = 0;
      let totalMemoryMB = 0;
      try {
        const os = require('os');
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        freeMemoryMB = Math.round(freeMem / 1024 / 1024);
        totalMemoryMB = Math.round(totalMem / 1024 / 1024);
      } catch (error: any) {
        // 忽略错误，使用默认值
      }

      return {
        uptime: Math.round(uptime),
        loadAverage,
        freeMemoryMB,
        totalMemoryMB,
        diskUsage: 0 // 可以后续添加磁盘使用监控
      };

    } catch (error: any) {
      logger.error('MonitoringService: Failed to collect system metrics', error);
      return {
        uptime: process.uptime(),
        loadAverage: [0, 0, 0],
        freeMemoryMB: 0,
        totalMemoryMB: 0,
        diskUsage: 0
      };
    }
  }

  /**
   * 测量事件循环延迟
   */
  private measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // 转换为毫秒
        resolve(delay);
      });
    });
  }

  /**
   * 存储指标数据
   */
  private storeMetrics(metrics: MonitoringMetrics): void {
    this.metricsHistory.push(metrics);
    this.stats.totalMetrics++;

    // 限制历史数据大小
    if (this.metricsHistory.length > this.config.maxDataPoints) {
      this.metricsHistory.shift();
    }

    // 清理过期数据
    const cutoffTime = Date.now() - (this.config.historyRetentionHours * 60 * 60 * 1000);
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'cpu-high',
        name: 'CPU使用率过高',
        description: '当CPU使用率超过80%时触发告警',
        enabled: true,
        metric: 'performance.cpuUsage',
        operator: 'gt',
        threshold: 80,
        duration: 60000, // 1分钟
        severity: 'warning',
        cooldown: 300000, // 5分钟
        actions: [
          { type: 'log', config: { level: 'warn' }, enabled: true }
        ],
        tags: { component: 'performance', type: 'cpu' }
      },
      {
        id: 'memory-high',
        name: '内存使用率过高',
        description: '当内存使用率超过85%时触发告警',
        enabled: true,
        metric: 'memory.heapUsedPercentage',
        operator: 'gt',
        threshold: 85,
        duration: 60000,
        severity: 'warning',
        cooldown: 300000,
        actions: [
          { type: 'log', config: { level: 'warn' }, enabled: true }
        ],
        tags: { component: 'memory', type: 'usage' }
      },
      {
        id: 'queue-backlog',
        name: '队列积压严重',
        description: '当等待处理的任务超过1000个时触发告警',
        enabled: true,
        metric: 'queue.waitingJobs',
        operator: 'gt',
        threshold: 1000,
        duration: 120000, // 2分钟
        severity: 'error',
        cooldown: 600000, // 10分钟
        actions: [
          { type: 'log', config: { level: 'error' }, enabled: true }
        ],
        tags: { component: 'queue', type: 'backlog' }
      },
      {
        id: 'queue-failure-rate',
        name: '队列失败率过高',
        description: '当任务失败率超过20%时触发告警',
        enabled: true,
        metric: 'queue.errorRate',
        operator: 'gt',
        threshold: 20,
        duration: 300000, // 5分钟
        severity: 'warning',
        cooldown: 900000, // 15分钟
        actions: [
          { type: 'log', config: { level: 'warn' }, enabled: true }
        ],
        tags: { component: 'queue', type: 'failure' }
      },
      {
        id: 'event-loop-delay',
        name: '事件循环延迟过高',
        description: '当事件循环延迟超过100ms时触发告警',
        enabled: true,
        metric: 'performance.eventLoopDelay',
        operator: 'gt',
        threshold: 100,
        duration: 30000, // 30秒
        severity: 'warning',
        cooldown: 300000,
        actions: [
          { type: 'log', config: { level: 'warn' }, enabled: true }
        ],
        tags: { component: 'performance', type: 'eventloop' }
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    logger.info(`MonitoringService: Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    try {
      // 延迟设置事件监听器，确保QueueManager已完全初始化
      setTimeout(() => {
        this.setupEventListenersInternal();
      }, 100);
    } catch (error: any) {
      logger.error('MonitoringService: 设置事件监听器失败', error);
    }
  }

  /**
   * 内部事件监听器设置
   */
  private setupEventListenersInternal(): void {
    try {
      // 监听内存告警
      if (this.memoryOptimizationService && typeof this.memoryOptimizationService.on === 'function') {
        this.memoryOptimizationService.on('alert:memory-threshold', (data) => {
          this.createCustomAlert({
            ruleId: 'memory-optimization',
            ruleName: '内存优化告警',
            severity: data.level === 'critical' ? 'critical' : 'warning',
            metric: 'memory.heapUsedPercentage',
            value: data.stats.heapUsedPercentage,
            threshold: data.stats.heapUsedPercentage,
            message: `内存使用率告警: ${data.alerts.join(', ')}`,
            tags: { source: 'memory-optimization', ...data.stats }
          });
        });
        logger.info('MonitoringService: MemoryOptimizationService事件监听器设置成功');
      } else {
        logger.warn('MonitoringService: MemoryOptimizationService不可用，跳过内存优化事件监听');
      }
    } catch (error: any) {
      logger.error('MonitoringService: 设置事件监听器失败', error);
    }
  }

  /**
   * 评估告警规则
   */
  private evaluateAlertRules(metrics: MonitoringMetrics): void {
    if (!this.config.enableAlerts) {
      return;
    }

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const value = this.getMetricValue(metrics, rule.metric);
        if (value === null) {
          continue;
        }

        const isThresholdExceeded = this.evaluateThreshold(value, rule.operator, rule.threshold);
        const alertId = rule.id;

        if (isThresholdExceeded) {
          // 检查是否已有活跃告警
          const existingAlert = this.activeAlerts.get(alertId);

          if (!existingAlert) {
            // 创建新告警
            this.createAlert(rule, value, metrics);
          } else {
            // 更新现有告警
            this.updateAlert(existingAlert, value, metrics);
          }
        } else {
          // 检查是否需要解决告警
          const existingAlert = this.activeAlerts.get(alertId);
          if (existingAlert) {
            this.resolveAlert(existingAlert);
          }
        }
      } catch (error: any) {
        logger.error(`MonitoringService: Error evaluating alert rule ${rule.id}`, error);
      }
    }
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metrics: MonitoringMetrics, metricPath: string): number | null {
    const parts = metricPath.split('.');
    let value: unknown = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    // 计算队列失败率
    if (metricPath === 'queue.errorRate') {
      const total = metrics.queue.completedJobs + metrics.queue.failedJobs;
      if (total > 0) {
        return Math.round((metrics.queue.failedJobs / total) * 10000) / 100;
      }
      return 0;
    }

    return typeof value === 'number' ? value : null;
  }

  /**
   * 评估阈值
   */
  private evaluateThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  /**
   * 创建告警
   */
  private createAlert(rule: AlertRule, value: number, metrics: MonitoringMetrics): void {
    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      message: this.generateAlertMessage(rule, value, metrics),
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      tags: { ...rule.tags }
    };

    this.activeAlerts.set(rule.id, alert);
    this.alertHistory.push(alert);
    this.stats.totalAlerts++;
    this.stats.activeAlerts++;
    this.stats.lastAlertTime = Date.now();

    logger.warn(`MonitoringService: Alert triggered - ${rule.name}`, {
      id: alert.id,
      value,
      threshold: rule.threshold,
      severity: rule.severity
    });

    // 执行告警动作
    this.executeAlertActions(alert, rule.actions);

    this.emit('alert:triggered', alert);
  }

  /**
   * 更新告警
   */
  private updateAlert(alert: Alert, value: number, metrics: MonitoringMetrics): void {
    alert.value = value;
    alert.message = this.generateAlertMessage(this.alertRules.get(alert.ruleId)!, value, metrics);
    alert.timestamp = Date.now();

    this.emit('alert:updated', alert);
  }

  /**
   * 解决告警
   */
  private resolveAlert(alert: Alert): void {
    alert.resolved = true;
    alert.resolvedAt = Date.now();

    this.activeAlerts.delete(alert.ruleId);
    this.stats.activeAlerts--;

    logger.info(`MonitoringService: Alert resolved - ${alert.ruleName}`, {
      id: alert.id,
      duration: alert.resolvedAt - alert.timestamp
    });

    this.emit('alert:resolved', alert);
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, value: number, metrics: MonitoringMetrics): string {
    const operatorText = {
      'gt': '>',
      'gte': '>=',
      'lt': '<',
      'lte': '<=',
      'eq': '==',
      'ne': '!='
    }[rule.operator] || '>';

    return `${rule.description}: 当前值 ${value}${operatorText}${rule.threshold}`;
  }

  /**
   * 执行告警动作
   */
  private async executeAlertActions(alert: Alert, actions: AlertAction[]): Promise<void> {
    for (const action of actions) {
      if (!action.enabled) {
        continue;
      }

      try {
        switch (action.type) {
          case 'log':
            const level = action.config.level || 'info';
            (logger as any)[level](`MonitoringService: Alert [${alert.severity.toUpperCase()}] ${alert.message}`, {
              alertId: alert.id,
              metric: alert.metric,
              value: alert.value,
              threshold: alert.threshold
            });
            break;

          case 'webhook':
            await this.executeWebhookAction(alert, action.config);
            break;

          case 'email':
            await this.executeEmailAction(alert, action.config);
            break;

          case 'callback':
            await this.executeCallbackAction(alert, action.config);
            break;

          default:
            logger.warn(`MonitoringService: Unknown alert action type: ${action.type}`);
        }
      } catch (error: any) {
        logger.error(`MonitoringService: Failed to execute alert action ${action.type}`, error);
      }
    }
  }

  /**
   * 执行Webhook动作
   */
  private async executeWebhookAction(alert: Alert, config: Record<string, any>): Promise<void> {
    if (!config.url) {
      logger.warn('MonitoringService: Webhook URL not configured');
      return;
    }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify({
          alert,
          timestamp: Date.now(),
          service: 'monitoring'
        })
      });

      if (!response.ok) {
        logger.error(`MonitoringService: Webhook request failed: ${response.status}`);
      }
    } catch (error: any) {
      logger.error('MonitoringService: Webhook request error', error);
    }
  }

  /**
   * 执行邮件动作
   */
  private async executeEmailAction(alert: Alert, config: Record<string, any>): Promise<void> {
    // 这里可以集成邮件发送服务
    logger.info('MonitoringService: Email alert action', {
      to: config.to,
      subject: `Alert: ${alert.ruleName}`,
      message: alert.message
    });
  }

  /**
   * 执行回调动作
   */
  private async executeCallbackAction(alert: Alert, config: Record<string, any>): Promise<void> {
    if (config.callback && typeof config.callback === 'function') {
      try {
        await config.callback(alert);
      } catch (error: any) {
        logger.error('MonitoringService: Callback execution error', error);
      }
    }
  }

  /**
   * 创建自定义告警
   */
  public createCustomAlert(alertData: {
    ruleId: string;
    ruleName: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    metric: string;
    value: number;
    threshold: number;
    message: string;
    tags?: Record<string, string>;
  }): void {
    const alert: Alert = {
      id: `${alertData.ruleId}-${Date.now()}`,
      ruleId: alertData.ruleId,
      ruleName: alertData.ruleName,
      severity: alertData.severity,
      metric: alertData.metric,
      value: alertData.value,
      threshold: alertData.threshold,
      message: alertData.message,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      tags: alertData.tags || {}
    };

    this.activeAlerts.set(alertData.ruleId, alert);
    this.alertHistory.push(alert);
    this.stats.totalAlerts++;
    this.stats.activeAlerts++;
    this.stats.lastAlertTime = Date.now();

    this.emit('alert:custom', alert);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning) {
      this.start();
    }

    logger.info('MonitoringService: Configuration updated', newConfig);
    this.emit('config:updated', this.config);
  }

  /**
   * 添加告警规则
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`MonitoringService: Added alert rule: ${rule.name}`);
    this.emit('alert-rule:added', rule);
  }

  /**
   * 更新告警规则
   */
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const existingRule = this.alertRules.get(ruleId);
    if (!existingRule) {
      return false;
    }

    const updatedRule = { ...existingRule, ...updates };
    this.alertRules.set(ruleId, updatedRule);

    logger.info(`MonitoringService: Updated alert rule: ${ruleId}`);
    this.emit('alert-rule:updated', updatedRule);

    return true;
  }

  /**
   * 删除告警规则
   */
  public removeAlertRule(ruleId: string): boolean {
    const deleted = this.alertRules.delete(ruleId);

    if (deleted) {
      // 同时解决相关的活跃告警
      const alert = this.activeAlerts.get(ruleId);
      if (alert) {
        this.resolveAlert(alert);
      }

      logger.info(`MonitoringService: Removed alert rule: ${ruleId}`);
      this.emit('alert-rule:removed', ruleId);
    }

    return deleted;
  }

  /**
   * 获取所有告警规则
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  public getAlertHistory(limit?: number): Alert[] {
    if (!limit) {
      return [...this.alertHistory];
    }
    return this.alertHistory.slice(-limit);
  }

  /**
   * 确认告警
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId) ||
                   this.alertHistory.find(a => a.id === alertId);

    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();

    logger.info(`MonitoringService: Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    this.emit('alert:acknowledged', alert);

    return true;
  }

  /**
   * 获取指标历史
   */
  public getMetricsHistory(minutes?: number): MonitoringMetrics[] {
    if (!minutes) {
      return [...this.metricsHistory];
    }

    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  /**
   * 生成监控报告
   */
  public generateReport(): MonitoringReport {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const activeAlerts = this.getActiveAlerts();

    const systemHealth = {
      overall: 'healthy' as 'healthy' | 'warning' | 'critical',
      components: {
        performance: 'healthy' as 'healthy' | 'warning' | 'critical',
        queue: 'healthy' as 'healthy' | 'warning' | 'critical',
        memory: 'healthy' as 'healthy' | 'warning' | 'critical'
      }
    };

    // 评估系统健康状态
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const errorAlerts = activeAlerts.filter(a => a.severity === 'error');
    const warningAlerts = activeAlerts.filter(a => a.severity === 'warning');

    if (criticalAlerts.length > 0) {
      systemHealth.overall = 'critical';
    } else if (errorAlerts.length > 0) {
      systemHealth.overall = 'warning';
    } else if (warningAlerts.length > 0) {
      systemHealth.overall = 'warning';
    }

    // 评估组件健康状态
    if (currentMetrics) {
      if (currentMetrics.performance.cpuUsage > 80) {
        systemHealth.components.performance = 'warning';
      }
      if (currentMetrics.performance.cpuUsage > 90) {
        systemHealth.components.performance = 'critical';
      }

      if (currentMetrics.memory.heapUsedPercentage > 80) {
        systemHealth.components.memory = 'warning';
      }
      if (currentMetrics.memory.heapUsedPercentage > 90) {
        systemHealth.components.memory = 'critical';
      }

      if (currentMetrics.queue.waitingJobs > 500) {
        systemHealth.components.queue = 'warning';
      }
      if (currentMetrics.queue.waitingJobs > 1000) {
        systemHealth.components.queue = 'critical';
      }
    }

    const recommendations = this.generateRecommendations(currentMetrics, activeAlerts);

    return {
      timestamp: Date.now(),
      duration: Date.now() - this.stats.startTime,
      metrics: currentMetrics || {} as MonitoringMetrics,
      alerts: activeAlerts,
      systemHealth,
      recommendations
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(metrics?: MonitoringMetrics, alerts?: Alert[]): string[] {
    const recommendations: string[] = [];

    if (!metrics) {
      return recommendations;
    }

    // 性能建议
    if (metrics.performance.cpuUsage > 80) {
      recommendations.push('CPU使用率较高，建议检查是否有性能瓶颈或考虑扩容');
    }

    if (metrics.performance.eventLoopDelay > 100) {
      recommendations.push('事件循环延迟较高，建议检查是否有阻塞操作');
    }

    // 内存建议
    if (metrics.memory.heapUsedPercentage > 80) {
      recommendations.push('内存使用率较高，建议执行内存优化或增加内存');
    }

    // 队列建议
    if (metrics.queue.waitingJobs > 1000) {
      recommendations.push('队列积压严重，建议增加处理器数量或优化任务处理逻辑');
    }

    const totalJobs = metrics.queue.completedJobs + metrics.queue.failedJobs;
    if (totalJobs > 0 && (metrics.queue.failedJobs / totalJobs) > 0.1) {
      recommendations.push('任务失败率较高，建议检查任务逻辑和错误处理');
    }

    // 告警建议
    if (alerts && alerts.length > 0) {
      recommendations.push(`当前有${alerts.length}个活跃告警，建议及时处理`);
    }

    if (recommendations.length === 0) {
      recommendations.push('系统运行状况良好');
    }

    return recommendations;
  }

  /**
   * 获取服务统计
   */
  public getStats(): MonitoringStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      isRunning: this.isRunning,
      metricsCollected: this.stats.totalMetrics,
      alertsTriggered: this.stats.totalAlerts,
      activeAlerts: this.stats.activeAlerts,
      configuredRules: this.alertRules.size,
      metricsHistorySize: this.metricsHistory.length,
      alertHistorySize: this.alertHistory.length,
      lastMetricsTime: this.stats.lastMetricsTime || 0
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
    if (!this.isRunning) {
      issues.push('Monitoring service is not running');
    }

    // 检查配置
    if (!this.config.enabled) {
      issues.push('Monitoring is disabled in configuration');
    }

    // 检查告警规则
    if (this.alertRules.size === 0) {
      issues.push('No alert rules configured');
    }

    // 检查活跃告警
    const activeAlerts = this.getActiveAlerts();
    if (activeAlerts && activeAlerts.length > 0) {
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
      if (criticalAlerts && criticalAlerts.length > 0) {
        issues.push(`${criticalAlerts.length} critical alerts are active`);
      }
    }

    // 检查数据收集
    if (this.metricsHistory.length === 0) {
      issues.push('No metrics data collected');
    }

    details.enabled = this.config.enabled;
    details.isRunning = this.isRunning;
    details.alertRules = this.alertRules.size;
    details.activeAlerts = activeAlerts ? activeAlerts.length : 0;
    details.metricsHistory = this.metricsHistory.length;
    details.lastCollection = this.metricsHistory.length > 0 ?
      this.metricsHistory[this.metricsHistory.length - 1]?.timestamp || Date.now() : Date.now();

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
    this.removeAllListeners();

    // 清理数据
    this.metricsHistory = [];
    this.alertHistory = [];
    this.activeAlerts.clear();
    this.alertRules.clear();

    logger.info('MonitoringService: Service shutdown complete');
    this.emit('service:shutdown');
  }
}

export default MonitoringService;
