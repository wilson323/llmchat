/**
 * 监控和告警系统
 * 实时性能指标收集、异常检测和SLA指标计算
 */

import * as os from 'os';
import { CircuitBreakerMetrics } from './CircuitBreakerService';
import { RateLimitMetrics } from './RateLimitService';
import { RequestMetrics } from './RetryService';
import logger from '@/utils/logger';

export interface PerformanceMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usagePercentage: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    requestsPerSecond: number;
  };
  errors: {
    total: number;
    rate: number;
    topErrors: Array<{ error: string; count: number; lastOccurred: Date }>;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  metric: string;
  duration: number; // 持续时间（秒）
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: AlertChannel[];
  cooldown: number; // 冷却时间（秒）
}

export interface AlertChannel {
  type: 'console' | 'webhook' | 'email' | 'slack';
  config: any;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: AlertRule['severity'];
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metrics: any;
}

export interface SLAMetrics {
  availability: number;        // 可用性 (0-100)
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  errorRate: number;          // 错误率 (0-100)
  throughput: number;         // 吞吐量 (请求/秒)
  uptime: number;             // 运行时间百分比
  lastUpdated: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'down';
  score: number;              // 健康分数 (0-100)
  components: {
    api: boolean;
    database: boolean;
    circuitBreakers: boolean;
    rateLimiters: boolean;
    externalServices: boolean;
  };
  alerts: number;
  lastCheck: Date;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private responseTimes: number[] = [];
  private errorCounts: Map<string, number> = new Map();
  private requestCounts = { total: 0, successful: 0, failed: 0 };
  private lastMetricsTime = Date.now();
  private maxMetricsHistory = 1000;

  constructor() {
    // 每分钟收集一次指标
    setInterval(() => {
      this.collectMetrics();
    }, 60000);

    logger.info('性能监控器启动');
  }

  /**
   * 收集系统指标
   */
  private collectMetrics(): void {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // 转换为秒
        loadAverage: os.loadavg()
      },
      memory: {
        used: memUsage.heapUsed,
        free: memUsage.heapTotal - memUsage.heapUsed,
        total: memUsage.heapTotal,
        usagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      requests: {
        total: this.requestCounts.total,
        successful: this.requestCounts.successful,
        failed: this.requestCounts.failed,
        averageResponseTime: this.calculateAverageResponseTime(),
        requestsPerSecond: this.calculateRequestsPerSecond(now)
      },
      errors: {
        total: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
        rate: this.calculateErrorRate(),
        topErrors: this.getTopErrors()
      }
    };

    this.metrics.push(metrics);
    this.responseTimes = []; // 重置响应时间
    this.requestCounts = { total: 0, successful: 0, failed: 0 };
    this.lastMetricsTime = now;

    // 限制历史记录数量
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // 检查阈值告警
    this.checkThresholdAlerts(metrics);
  }

  /**
   * 记录请求
   */
  recordRequest(responseTime: number, success: boolean, error?: string): void {
    this.responseTimes.push(responseTime);
    this.requestCounts.total++;

    if (success) {
      this.requestCounts.successful++;
    } else {
      this.requestCounts.failed++;
      if (error) {
        const count = this.errorCounts.get(error) || 0;
        this.errorCounts.set(error, count + 1);
      }
    }
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    return this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * 计算每秒请求数
   */
  private calculateRequestsPerSecond(now: number): number {
    const timeDiff = (now - this.lastMetricsTime) / 1000;
    return timeDiff > 0 ? this.requestCounts.total / timeDiff : 0;
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    if (this.requestCounts.total === 0) return 0;
    return (this.requestCounts.failed / this.requestCounts.total) * 100;
  }

  /**
   * 获取Top错误
   */
  private getTopErrors(): Array<{ error: string; count: number; lastOccurred: Date }> {
    const sortedErrors = Array.from(this.errorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    return sortedErrors.map(([error, count]) => ({
      error,
      count,
      lastOccurred: new Date()
    }));
  }

  /**
   * 检查阈值告警
   */
  private checkThresholdAlerts(metrics: PerformanceMetrics): void {
    // CPU使用率告警
    if (metrics.cpu.usage > 80) {
      logger.warn('CPU使用率过高', { usage: `${metrics.cpu.usage.toFixed(2)}%` });
    }

    // 内存使用率告警
    if (metrics.memory.usagePercentage > 85) {
      logger.warn('内存使用率过高', { usage: `${metrics.memory.usagePercentage.toFixed(2)}%` });
    }

    // 错误率告警
    if (metrics.errors.rate > 10) {
      logger.warn('错误率过高', { rate: `${metrics.errors.rate.toFixed(2)}%` });
    }

    // 响应时间告警
    if (metrics.requests.averageResponseTime > 5000) {
      logger.warn('平均响应时间过长', { responseTime: `${metrics.requests.averageResponseTime}ms` });
    }
  }

  /**
   * 获取最新指标
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(minutes?: number): PerformanceMetrics[] {
    if (!minutes) return this.metrics;

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp >= cutoffTime);
  }
}

/**
 * 告警管理器
 */
export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTimes: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultRules();
    logger.info('告警管理器启动');
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_cpu_usage',
        name: 'CPU使用率过高',
        description: 'CPU使用率超过80%',
        enabled: true,
        threshold: 80,
        operator: '>',
        metric: 'cpu.usage',
        duration: 300, // 5分钟
        severity: 'high',
        channels: [{ type: 'console', config: {}, enabled: true }],
        cooldown: 900 // 15分钟冷却
      },
      {
        id: 'high_memory_usage',
        name: '内存使用率过高',
        description: '内存使用率超过85%',
        enabled: true,
        threshold: 85,
        operator: '>',
        metric: 'memory.usagePercentage',
        duration: 300,
        severity: 'high',
        channels: [{ type: 'console', config: {}, enabled: true }],
        cooldown: 900
      },
      {
        id: 'high_error_rate',
        name: '错误率过高',
        description: '错误率超过10%',
        enabled: true,
        threshold: 10,
        operator: '>',
        metric: 'errors.rate',
        duration: 180, // 3分钟
        severity: 'medium',
        channels: [{ type: 'console', config: {}, enabled: true }],
        cooldown: 600
      },
      {
        id: 'slow_response_time',
        name: '响应时间过长',
        description: '平均响应时间超过5秒',
        enabled: true,
        threshold: 5000,
        operator: '>',
        metric: 'requests.averageResponseTime',
        duration: 300,
        severity: 'medium',
        channels: [{ type: 'console', config: {}, enabled: true }],
        cooldown: 600
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info('添加告警规则', { ruleName: rule.name });
  }

  /**
   * 检查告警条件
   */
  checkAlerts(metrics: PerformanceMetrics): void {
    this.rules.forEach(rule => {
      if (!rule.enabled) return;

      const metricValue = this.getMetricValue(metrics, rule.metric);
      if (metricValue === undefined) return;

      const triggered = this.evaluateCondition(metricValue, rule.threshold, rule.operator);

      if (triggered) {
        this.handleAlertTriggered(rule, metricValue);
      } else {
        this.handleAlertResolved(rule);
      }
    });
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metrics: PerformanceMetrics, metricPath: string): number | undefined {
    const paths = metricPath.split('.');
    let value: any = metrics;

    for (const path of paths) {
      value = value?.[path];
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * 评估条件
   */
  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '=': return value === threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      default: return false;
    }
  }

  /**
   * 处理告警触发
   */
  private handleAlertTriggered(rule: AlertRule, metricValue: number): void {
    const now = new Date();
    const lastAlertTime = this.lastAlertTimes.get(rule.id);

    // 检查冷却时间
    if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < rule.cooldown * 1000) {
      return;
    }

    const alertId = `${rule.id}_${now.getTime()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      message: `${rule.description}: 当前值 ${metricValue}, 阈值 ${rule.threshold}`,
      severity: rule.severity,
      timestamp: now,
      resolved: false,
      metrics: { metricValue, threshold: rule.threshold }
    };

    this.alerts.set(alertId, alert);
    this.lastAlertTimes.set(rule.id, now);

    // 发送告警通知
    this.sendAlert(alert, rule);

    logger.warn('告警触发', { ruleName: rule.name,
      message: alert.message,
      severity: rule.severity,
      metricValue,
      threshold: rule.threshold
    });
  }

  /**
   * 处理告警解决
   */
  private handleAlertResolved(rule: AlertRule): void {
    // 查找未解决的告警
    const unresolvedAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.ruleId === rule.id && !alert.resolved);

    unresolvedAlerts.forEach(alert => {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      logger.info('告警已解决', { ruleName: rule.name,
        alertId: alert.id,
        duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
      });
    });
  }

  /**
   * 发送告警通知
   */
  private sendAlert(alert: Alert, rule: AlertRule): void {
    rule.channels.forEach(channel => {
      if (!channel.enabled) return;

      switch (channel.type) {
        case 'console':
          logger.error(`🚨 ${alert.ruleName} [${alert.severity.toUpperCase()}]`, { message: alert.message });
          break;
        case 'webhook':
          this.sendWebhookAlert(channel.config, alert);
          break;
        case 'email':
          this.sendEmailAlert(channel.config, alert);
          break;
        case 'slack':
          this.sendSlackAlert(channel.config, alert);
          break;
      }
    });
  }

  /**
   * 发送Webhook告警
   */
  private async sendWebhookAlert(config: any, alert: Alert): Promise<void> {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        logger.error('Webhook告警发送失败', { status: response.statusText });
      }
    } catch (error) {
      logger.error('Webhook告警发送异常', { error });
    }
  }

  /**
   * 发送邮件告警
   */
  private sendEmailAlert(config: any, alert: Alert): void {
    // 这里应该实现邮件发送逻辑
    logger.info('邮件告警功能待实现', { alert, config });
  }

  /**
   * 发送Slack告警
   */
  private sendSlackAlert(config: any, alert: Alert): void {
    // 这里应该实现Slack通知逻辑
    logger.info('Slack告警功能待实现', { alert, config });
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * 获取所有告警
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }
}

/**
 * SLA监控器
 */
export class SLAMonitor {
  private slaMetrics: SLAMetrics;
  private uptimeStartTime = Date.now();
  private totalRequests = 0;
  private successfulRequests = 0;
  private responseTimes: number[] = [];

  constructor() {
    this.slaMetrics = {
      availability: 100,
      responseTime: { p50: 0, p95: 0, p99: 0, average: 0 },
      errorRate: 0,
      throughput: 0,
      uptime: 100,
      lastUpdated: new Date()
    };

    // 每分钟更新SLA指标
    setInterval(() => {
      this.updateSLAMetrics();
    }, 60000);

    logger.info('SLA监控器启动');
  }

  /**
   * 记录请求
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.totalRequests++;
    this.responseTimes.push(responseTime);

    if (success) {
      this.successfulRequests++;
    }

    // 限制响应时间历史
    if (this.responseTimes.length > 10000) {
      this.responseTimes = this.responseTimes.slice(-5000);
    }
  }

  /**
   * 更新SLA指标
   */
  private updateSLAMetrics(): void {
    const now = Date.now();
    const uptimePercentage = ((now - this.uptimeStartTime) / now) * 100;

    // 计算可用性
    const availability = this.totalRequests > 0 ? (this.successfulRequests / this.totalRequests) * 100 : 100;

    // 计算错误率
    const errorRate = this.totalRequests > 0 ? ((this.totalRequests - this.successfulRequests) / this.totalRequests) * 100 : 0;

    // 计算响应时间指标
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const responseTime = {
      p50: this.getPercentile(sortedTimes, 50),
      p95: this.getPercentile(sortedTimes, 95),
      p99: this.getPercentile(sortedTimes, 99),
      average: this.responseTimes.length > 0
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
        : 0
    };

    // 计算吞吐量（每分钟请求数）
    const throughput = this.totalRequests / ((now - this.uptimeStartTime) / 60000);

    this.slaMetrics = {
      availability,
      responseTime,
      errorRate,
      throughput,
      uptime: uptimePercentage,
      lastUpdated: new Date()
    };
  }

  /**
   * 计算百分位数
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    const value = sortedArray[Math.max(0, index)];
    return value ?? 0;
  }

  /**
   * 获取SLA指标
   */
  getSLAMetrics(): SLAMetrics {
    return { ...this.slaMetrics };
  }
}

/**
 * 系统健康检查器
 */
export class SystemHealthChecker {
  private healthStatus: SystemHealth;

  constructor(
    private performanceMonitor: PerformanceMonitor,
    private alertManager: AlertManager,
    private circuitBreakerManager: any,
    private rateLimitService: any
  ) {
    this.healthStatus = {
      status: 'healthy',
      score: 100,
      components: {
        api: true,
        database: true,
        circuitBreakers: true,
        rateLimiters: true,
        externalServices: true
      },
      alerts: 0,
      lastCheck: new Date()
    };

    // 每分钟检查一次健康状态
    setInterval(() => {
      this.checkSystemHealth();
    }, 60000);

    logger.info('系统健康检查器启动');
  }

  /**
   * 检查系统健康状态
   */
  private checkSystemHealth(): void {
    const metrics = this.performanceMonitor.getLatestMetrics();
    const activeAlerts = this.alertManager.getActiveAlerts();
    const circuitBreakerHealth = this.circuitBreakerManager.getHealthStatus();
    const rateLimitHealth = this.rateLimitService.getAllMetrics();

    let score = 100;
    let status: SystemHealth['status'] = 'healthy';
    const components = { ...this.healthStatus.components };

    // 检查CPU使用率
    if (metrics?.cpu.usage && metrics.cpu.usage > 90) {
      score -= 20;
      status = 'critical';
    } else if (metrics?.cpu.usage && metrics.cpu.usage > 80) {
      score -= 10;
      status = 'warning';
    }

    // 检查内存使用率
    if (metrics?.memory.usagePercentage && metrics.memory.usagePercentage > 95) {
      score -= 20;
      status = 'critical';
    } else if (metrics?.memory.usagePercentage && metrics.memory.usagePercentage > 85) {
      score -= 10;
      status = 'warning';
    }

    // 检查错误率
    if (metrics?.errors.rate && metrics.errors.rate > 20) {
      score -= 25;
      status = 'critical';
    } else if (metrics?.errors.rate && metrics.errors.rate > 10) {
      score -= 15;
      status = 'warning';
    }

    // 检查熔断器状态
    const unhealthyCircuitBreakers = circuitBreakerHealth.filter((cb: any) => !cb.healthy);
    if (unhealthyCircuitBreakers.length > 0) {
      score -= 15 * unhealthyCircuitBreakers.length;
      components.circuitBreakers = false;
      status = 'critical';
    }

    // 检查告警数量
    if (activeAlerts.length > 10) {
      score -= 20;
      status = 'critical';
    } else if (activeAlerts.length > 5) {
      score -= 10;
      status = 'warning';
    }

    // 确保分数在合理范围内
    score = Math.max(0, Math.min(100, score));

    // 确定最终状态
    if (score < 50) {
      status = 'critical';
    } else if (score < 80) {
      status = 'warning';
    }

    this.healthStatus = {
      status,
      score,
      components,
      alerts: activeAlerts.length,
      lastCheck: new Date()
    };

    if (status !== 'healthy') {
      logger.warn('系统健康状态', { status,
        score,
        components,
        activeAlerts: activeAlerts.length
      });
    }
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): SystemHealth {
    return { ...this.healthStatus };
  }
}

/**
 * 监控服务主类
 */
export class MonitoringService {
  private performanceMonitor: PerformanceMonitor;
  private alertManager: AlertManager;
  private slaMonitor: SLAMonitor;
  private systemHealthChecker: SystemHealthChecker;

  constructor(
    circuitBreakerManager: any,
    rateLimitService: any
  ) {
    this.performanceMonitor = new PerformanceMonitor();
    this.alertManager = new AlertManager();
    this.slaMonitor = new SLAMonitor();
    this.systemHealthChecker = new SystemHealthChecker(
      this.performanceMonitor,
      this.alertManager,
      circuitBreakerManager,
      rateLimitService
    );

    logger.info('监控服务启动完成');
  }

  /**
   * 记录请求指标
   */
  recordRequest(responseTime: number, success: boolean, error?: string): void {
    this.performanceMonitor.recordRequest(responseTime, success, error);
    this.slaMonitor.recordRequest(responseTime, success);
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    return this.performanceMonitor.getLatestMetrics();
  }

  /**
   * 获取SLA指标
   */
  getSLAMetrics(): SLAMetrics {
    return this.slaMonitor.getSLAMetrics();
  }

  /**
   * 获取系统健康状态
   */
  getSystemHealth(): SystemHealth {
    return this.systemHealthChecker.getHealthStatus();
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * 添加自定义告警规则
   */
  addAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule);
  }
}