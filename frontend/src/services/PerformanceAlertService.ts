/**
 * 性能告警服务
 * 管理性能告警的配置、触发和处理
 */

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'cpu' | 'memory' | 'response_time' | 'error_rate' | 'cache_hit_rate' | 'database_connections';
  enabled: boolean;
  severity: 'info' | 'warning' | 'critical';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  duration: number; // 持续时间（毫秒）
  conditions: {
    [key: string]: any;
  };
  actions: {
    email?: string[];
    webhook?: string;
    autoResolve?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface AlertNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  type: string;
  severity: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

export interface AlertStatistics {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  alertsByType: Record<string, number>;
  alertsByHour: Array<{
    hour: string;
    count: number;
  }>;
  averageResolutionTime: number;
}

class PerformanceAlertService {
  private static instance: PerformanceAlertService;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertNotification> = new Map();
  private alertHistory: AlertNotification[] = [];
  private alertCallbacks: Array<(alert: AlertNotification) => void> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  static getInstance(): PerformanceAlertService {
    if (!PerformanceAlertService.instance) {
      PerformanceAlertService.instance = new PerformanceAlertService();
    }
    return PerformanceAlertService.instance;
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'cpu_high',
        name: 'CPU使用率过高',
        description: 'CPU使用率超过80%',
        type: 'cpu',
        enabled: true,
        severity: 'warning',
        threshold: 80,
        operator: 'gt',
        duration: 300000, // 5分钟
        conditions: {},
        actions: {
          autoResolve: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'memory_high',
        name: '内存使用率过高',
        description: '内存使用率超过85%',
        type: 'memory',
        enabled: true,
        severity: 'critical',
        threshold: 85,
        operator: 'gt',
        duration: 300000,
        conditions: {},
        actions: {
          autoResolve: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'response_time_high',
        name: '响应时间过长',
        description: '平均响应时间超过2秒',
        type: 'response_time',
        enabled: true,
        severity: 'warning',
        threshold: 2000,
        operator: 'gt',
        duration: 600000, // 10分钟
        conditions: {},
        actions: {
          autoResolve: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'error_rate_high',
        name: '错误率过高',
        description: '错误率超过5%',
        type: 'error_rate',
        enabled: true,
        severity: 'critical',
        threshold: 5,
        operator: 'gt',
        duration: 300000,
        conditions: {},
        actions: {
          autoResolve: false
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'cache_hit_rate_low',
        name: '缓存命中率过低',
        description: '缓存命中率低于60%',
        type: 'cache_hit_rate',
        enabled: true,
        severity: 'info',
        threshold: 60,
        operator: 'lt',
        duration: 600000,
        conditions: {},
        actions: {
          autoResolve: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'database_connections_high',
        name: '数据库连接数过高',
        description: '数据库连接数超过80%',
        type: 'database_connections',
        enabled: true,
        severity: 'warning',
        threshold: 80,
        operator: 'gt',
        duration: 300000,
        conditions: {},
        actions: {
          autoResolve: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * 开始监控
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // 每30秒检查一次告警规则
    this.monitoringInterval = setInterval(() => {
      this.checkAlertRules();
    }, 30000);
  }

  /**
   * 检查告警规则
   */
  private async checkAlertRules(): Promise<void> {
    try {
      // 获取当前性能指标
      const response = await fetch('/api/performance/current-metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        console.error('获取性能指标失败，无法检查告警规则');
        return;
      }

      const data = await response.json();
      if (!data.success) {
        return;
      }

      const metrics = data.data;

      // 检查每个启用的告警规则
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) {
          continue;
        }

        const isTriggered = this.evaluateRule(rule, metrics);
        const existingAlert = this.activeAlerts.get(rule.id);

        if (isTriggered && !existingAlert) {
          // 触发新的告警
          await this.triggerAlert(rule, metrics);
        } else if (!isTriggered && existingAlert) {
          // 解除告警
          await this.resolveAlert(rule.id);
        }
      }
    } catch (error) {
      console.error('检查告警规则失败:', error);
    }
  }

  /**
   * 评估告警规则
   */
  private evaluateRule(rule: AlertRule, metrics: any): boolean {
    let value = 0;

    switch (rule.type) {
      case 'cpu':
        value = metrics.cpuUsage || 0;
        break;
      case 'memory':
        value = metrics.memoryUsage || 0;
        break;
      case 'response_time':
        value = metrics.averageResponseTime || 0;
        break;
      case 'error_rate':
        value = metrics.errorRate || 0;
        break;
      case 'cache_hit_rate':
        value = metrics.cacheHitRate || 0;
        break;
      case 'database_connections':
        value = metrics.databaseConnections || 0;
        break;
      default:
        return false;
    }

    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule, metrics: any): Promise<void> {
    const alert: AlertNotification = {
      id: `${rule.id}_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, metrics),
      value: this.getMetricValue(rule.type, metrics),
      threshold: rule.threshold,
      timestamp: Date.now(),
      resolved: false
    };

    // 添加到活跃告警
    this.activeAlerts.set(rule.id, alert);
    this.alertHistory.push(alert);

    // 调用回调函数
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('告警回调函数执行失败:', error);
      }
    });

    // 发送到后端记录
    try {
      await fetch('/api/performance/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('发送告警到后端失败:', error);
    }

    console.warn(`触发告警: ${alert.message}`);
  }

  /**
   * 解除告警
   */
  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) {
      return;
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    // 从活跃告警中移除
    this.activeAlerts.delete(ruleId);

    // 发送到后端更新状态
    try {
      await fetch(`/api/performance/alerts/${alert.id}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('更新告警状态失败:', error);
    }

    console.log(`告警已解除: ${alert.message}`);
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, metrics: any): string {
    const value = this.getMetricValue(rule.type, metrics);
    const unit = this.getMetricUnit(rule.type);

    switch (rule.type) {
      case 'cpu':
        return `CPU使用率达到${value.toFixed(1)}%，超过阈值${rule.threshold}${unit}`;
      case 'memory':
        return `内存使用率达到${value.toFixed(1)}%，超过阈值${rule.threshold}${unit}`;
      case 'response_time':
        return `平均响应时间为${value.toFixed(0)}${unit}，超过阈值${rule.threshold}${unit}`;
      case 'error_rate':
        return `错误率达到${value.toFixed(1)}%，超过阈值${rule.threshold}${unit}`;
      case 'cache_hit_rate':
        return `缓存命中率仅为${value.toFixed(1)}%，低于阈值${rule.threshold}${unit}`;
      case 'database_connections':
        return `数据库连接数使用率达到${value.toFixed(1)}%，超过阈值${rule.threshold}${unit}`;
      default:
        return `${rule.name}: 当前值${value}${unit}`;
    }
  }

  /**
   * 获取指标值
   */
  private getMetricValue(type: string, metrics: any): number {
    switch (type) {
      case 'cpu':
        return metrics.cpuUsage || 0;
      case 'memory':
        return metrics.memoryUsage || 0;
      case 'response_time':
        return metrics.averageResponseTime || 0;
      case 'error_rate':
        return metrics.errorRate || 0;
      case 'cache_hit_rate':
        return metrics.cacheHitRate || 0;
      case 'database_connections':
        return metrics.databaseConnections || 0;
      default:
        return 0;
    }
  }

  /**
   * 获取指标单位
   */
  private getMetricUnit(type: string): string {
    switch (type) {
      case 'cpu':
      case 'memory':
      case 'error_rate':
      case 'cache_hit_rate':
      case 'database_connections':
        return '%';
      case 'response_time':
        return 'ms';
      default:
        return '';
    }
  }

  /**
   * 添加告警规则
   */
  addAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.alertRules.set(newRule.id, newRule);
    return newRule;
  }

  /**
   * 更新告警规则
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return null;
    }

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: Date.now()
    };

    this.alertRules.set(ruleId, updatedRule);
    return updatedRule;
  }

  /**
   * 删除告警规则
   */
  deleteAlertRule(ruleId: string): boolean {
    const deleted = this.alertRules.delete(ruleId);

    // 如果有活跃的告警，也解除它
    if (deleted && this.activeAlerts.has(ruleId)) {
      this.resolveAlert(ruleId);
    }

    return deleted;
  }

  /**
   * 获取所有告警规则
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * 获取告警规则
   */
  getAlertRule(ruleId: string): AlertRule | null {
    return this.alertRules.get(ruleId) || null;
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): AlertNotification[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit: number = 100): AlertNotification[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 获取告警统计
   */
  getAlertStatistics(): AlertStatistics {
    const totalAlerts = this.alertHistory.length;
    const activeAlerts = this.activeAlerts.size;
    const resolvedAlerts = this.alertHistory.filter(alert => alert.resolved).length;

    const criticalAlerts = this.alertHistory.filter(alert => alert.severity === 'critical').length;
    const warningAlerts = this.alertHistory.filter(alert => alert.severity === 'warning').length;
    const infoAlerts = this.alertHistory.filter(alert => alert.severity === 'info').length;

    // 按类型统计
    const alertsByType: Record<string, number> = {};
    this.alertHistory.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    // 按小时统计
    const alertsByHour: Array<{ hour: string; count: number }> = [];
    const now = Date.now();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now - i * 60 * 60 * 1000).getHours();
      const count = this.alertHistory.filter(alert => {
        const alertHour = new Date(alert.timestamp).getHours();
        return alertHour === hour;
      }).length;
      alertsByHour.push({ hour: `${hour}:00`, count });
    }

    // 平均解决时间
    const resolvedAlertsWithTime = this.alertHistory.filter(alert => alert.resolved && alert.resolvedAt);
    const averageResolutionTime = resolvedAlertsWithTime.length > 0
      ? resolvedAlertsWithTime.reduce((sum, alert) => sum + (alert.resolvedAt! - alert.timestamp), 0) / resolvedAlertsWithTime.length
      : 0;

    return {
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      criticalAlerts,
      warningAlerts,
      infoAlerts,
      alertsByType,
      alertsByHour,
      averageResolutionTime
    };
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId) || this.alertHistory.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();

    return true;
  }

  /**
   * 手动解决告警
   */
  async manuallyResolveAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    await this.resolveAlert(alert.id.split('_')[0]); // 获取规则ID
    return true;
  }

  /**
   * 添加告警回调
   */
  onAlert(callback: (alert: AlertNotification) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * 移除告警回调
   */
  offAlert(callback: (alert: AlertNotification) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index >= 0) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.alertRules.clear();
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.alertCallbacks = [];
  }
}

// 导出单例实例
export const performanceAlertService = PerformanceAlertService.getInstance();

// 导出类型和服务类
export default PerformanceAlertService;