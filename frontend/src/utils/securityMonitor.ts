/**
 * 安全监控和防护系统
 *
 * 提供实时安全监控、威胁检测和自动防护功能
 * 集成多种安全检测算法和响应机制
 */

import { secureContentSanitizer, SecurityEvent } from './secureContentSanitizer';
import { securityValidator, ValidationResult, SecurityErrorType } from './securityMiddleware';
import { cspManager, CSPViolationReport } from './contentSecurityPolicy';

// 安全威胁等级
export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 安全事件类型
export enum SecurityEventType {
  XSS_ATTEMPT = 'xss_attempt',
  INJECTION_ATTACK = 'injection_attack',
  SUSPICIOUS_INPUT = 'suspicious_input',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSP_VIOLATION = 'csp_violation',
  ABNORMAL_BEHAVIOR = 'abnormal_behavior',
  MALICIOUS_REQUEST = 'malicious_request',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt'
}

// 扩展安全事件接口
export interface ExtendedSecurityEvent extends SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  threatLevel: ThreatLevel;
  userAgent: string;
  ip?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  blocked: boolean;
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

// 安全指标接口
export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsByLevel: Record<ThreatLevel, number>;
  blockedRequests: number;
  topAttackers: Array<{ ip: string; count: number; lastSeen: string }>;
  recentActivity: ExtendedSecurityEvent[];
  averageResponseTime: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

// 自动防护规则接口
export interface ProtectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  eventType: SecurityEventType;
  condition: (event: ExtendedSecurityEvent) => boolean;
  action: 'block' | 'warn' | 'log' | 'redirect';
  cooldownPeriod: number; // 冷却期（毫秒）
  lastTriggered?: number;
  triggerCount: number;
  maxTriggers?: number; // 最大触发次数
}

/**
 * 安全监控器类
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: ExtendedSecurityEvent[] = [];
  private protectionRules: ProtectionRule[] = [];
  private blockedIPs = new Set<string>();
  private rateLimitMap = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
  private monitoringEnabled = false;
  private eventCallbacks = new Map<string, (event: ExtendedSecurityEvent) => void>();

  private constructor() {
    this.initializeDefaultRules();
  }

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * 初始化默认防护规则
   */
  private initializeDefaultRules(): void {
    this.protectionRules = [
      // XSS攻击防护
      {
        id: 'xss-protection',
        name: 'XSS攻击防护',
        description: '检测并阻止跨站脚本攻击',
        enabled: true,
        eventType: SecurityEventType.XSS_ATTEMPT,
        condition: (event) => event.threatLevel === ThreatLevel.CRITICAL,
        action: 'block',
        cooldownPeriod: 300000, // 5分钟
        triggerCount: 0,
        maxTriggers: 10
      },

      // 注入攻击防护
      {
        id: 'injection-protection',
        name: '注入攻击防护',
        description: '检测并阻止SQL注入和其他注入攻击',
        enabled: true,
        eventType: SecurityEventType.INJECTION_ATTACK,
        condition: (event) => event.threatLevel === ThreatLevel.HIGH || event.threatLevel === ThreatLevel.CRITICAL,
        action: 'block',
        cooldownPeriod: 600000, // 10分钟
        triggerCount: 0,
        maxTriggers: 5
      },

      // 速率限制保护
      {
        id: 'rate-limit-protection',
        name: '速率限制保护',
        description: '防止过于频繁的请求',
        enabled: true,
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        condition: (event) => event.threatLevel === ThreatLevel.MEDIUM,
        action: 'warn',
        cooldownPeriod: 60000, // 1分钟
        triggerCount: 0
      },

      // CSP违规监控
      {
        id: 'csp-violation-monitor',
        name: 'CSP违规监控',
        description: '监控内容安全策略违规',
        enabled: true,
        eventType: SecurityEventType.CSP_VIOLATION,
        condition: (event) => true,
        action: 'log',
        cooldownPeriod: 0,
        triggerCount: 0
      }
    ];
  }

  /**
   * 启用安全监控
   */
  enableMonitoring(): void {
    if (this.monitoringEnabled) return;

    this.monitoringEnabled = true;

    // 启用CSP监控
    cspManager.enableMonitoring();

    // 设置全局错误处理
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }

    console.log('安全监控系统已启用');
  }

  /**
   * 禁用安全监控
   */
  disableMonitoring(): void {
    this.monitoringEnabled = false;
    cspManager.disableMonitoring();
    console.log('安全监控系统已禁用');
  }

  /**
   * 记录安全事件
   */
  recordSecurityEvent(
    eventType: SecurityEventType,
    threatLevel: ThreatLevel,
    details: Omit<ExtendedSecurityEvent, keyof SecurityEvent | 'id' | 'eventType' | 'threatLevel' | 'userAgent' | 'blocked' | 'resolved'>
  ): string {
    const event: ExtendedSecurityEvent = {
      id: this.generateEventId(),
      type: eventType,
      threats: [],
      timestamp: new Date().toISOString(),
      eventType,
      threatLevel,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      blocked: false,
      resolved: false,
      ...details
    };

    // 添加到事件列表
    this.events.push(event);

    // 限制事件数量
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }

    // 处理防护规则
    this.processProtectionRules(event);

    // 触发回调
    this.triggerEventCallbacks(event);

    // 发送到监控服务
    this.sendToMonitoringService(event);

    return event.id;
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 处理防护规则
   */
  private processProtectionRules(event: ExtendedSecurityEvent): void {
    for (const rule of this.protectionRules) {
      if (!rule.enabled) continue;

      // 检查冷却期
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownPeriod) {
        continue;
      }

      // 检查条件
      if (rule.condition(event)) {
        rule.triggerCount++;
        rule.lastTriggered = Date.now();

        // 检查是否超过最大触发次数
        if (rule.maxTriggers && rule.triggerCount > rule.maxTriggers) {
          console.warn(`防护规则 ${rule.name} 已达到最大触发次数，暂时禁用`);
          rule.enabled = false;
          continue;
        }

        // 执行防护动作
        this.executeProtectionAction(rule, event);
      }
    }
  }

  /**
   * 执行防护动作
   */
  private executeProtectionAction(rule: ProtectionRule, event: ExtendedSecurityEvent): void {
    switch (rule.action) {
      case 'block':
        event.blocked = true;
        this.blockRequest(event);
        console.warn(`安全事件已被阻止: ${rule.name}`, event);
        break;

      case 'warn':
        console.warn(`安全警告: ${rule.name}`, event);
        break;

      case 'log':
        console.info(`安全事件记录: ${rule.name}`, event);
        break;

      case 'redirect':
        this.redirectToSafePage(event);
        break;
    }
  }

  /**
   * 阻止请求
   */
  private blockRequest(event: ExtendedSecurityEvent): void {
    if (event.ip) {
      this.blockedIPs.add(event.ip);

      // 30分钟后自动解除封锁
      setTimeout(() => {
        this.blockedIPs.delete(event.ip!);
      }, 30 * 60 * 1000);
    }
  }

  /**
   * 重定向到安全页面
   */
  private redirectToSafePage(event: ExtendedSecurityEvent): void {
    if (typeof window !== 'undefined') {
      window.location.href = '/security-warning?reason=' + encodeURIComponent(event.type);
    }
  }

  /**
   * 触发事件回调
   */
  private triggerEventCallbacks(event: ExtendedSecurityEvent): void {
    this.eventCallbacks.forEach((callback, id) => {
      try {
        callback(event);
      } catch (error) {
        console.error(`事件回调执行失败 [${id}]:`, error);
      }
    });
  }

  /**
   * 发送到监控服务
   */
  private sendToMonitoringService(event: ExtendedSecurityEvent): void {
    try {
      if (typeof window !== 'undefined' && window.fetch) {
        fetch('/api/security/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        }).catch(() => {
          // 忽略网络错误
        });
      }
    } catch {
      // 忽略错误
    }
  }

  /**
   * 添加事件回调
   */
  addEventCallback(id: string, callback: (event: ExtendedSecurityEvent) => void): void {
    this.eventCallbacks.set(id, callback);
  }

  /**
   * 移除事件回调
   */
  removeEventCallback(id: string): void {
    this.eventCallbacks.delete(id);
  }

  /**
   * 处理全局错误
   */
  private handleGlobalError(event: ErrorEvent): void {
    this.recordSecurityEvent(
      SecurityEventType.ABNORMAL_BEHAVIOR,
      ThreatLevel.MEDIUM,
      {
        content: `JavaScript错误: ${event.message}`,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error?.stack
        }
      }
    );
  }

  /**
   * 处理未捕获的Promise拒绝
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    this.recordSecurityEvent(
      SecurityEventType.ABNORMAL_BEHAVIOR,
      ThreatLevel.LOW,
      {
        content: `未处理的Promise拒绝: ${event.reason}`,
        metadata: {
          reason: event.reason
        }
      }
    );
  }

  /**
   * 检查IP是否被封
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * 获取安全指标
   */
  getSecurityMetrics(): SecurityMetrics {
    const eventsByType = {} as Record<SecurityEventType, number>;
    const eventsByLevel = {} as Record<ThreatLevel, number>;
    let blockedRequests = 0;

    // 统计事件
    this.events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsByLevel[event.threatLevel] = (eventsByLevel[event.threatLevel] || 0) + 1;
      if (event.blocked) blockedRequests++;
    });

    // 获取攻击者统计
    const attackerStats = new Map<string, { count: number; lastSeen: string }>();
    this.events.forEach(event => {
      if (event.ip) {
        const stat = attackerStats.get(event.ip) || { count: 0, lastSeen: event.timestamp };
        stat.count++;
        stat.lastSeen = event.timestamp;
        attackerStats.set(event.ip, stat);
      }
    });

    const topAttackers = Array.from(attackerStats.entries())
      .map(([ip, stats]) => ({ ip, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 确定系统健康状态
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    const criticalEvents = eventsByLevel[ThreatLevel.CRITICAL] || 0;
    const highEvents = eventsByLevel[ThreatLevel.HIGH] || 0;

    if (criticalEvents > 0) {
      systemHealth = 'critical';
    } else if (highEvents > 10 || blockedRequests > 5) {
      systemHealth = 'warning';
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsByLevel,
      blockedRequests,
      topAttackers,
      recentActivity: this.events.slice(-20),
      averageResponseTime: this.calculateAverageResponseTime(),
      systemHealth
    };
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(): number {
    // 这里可以实现响应时间计算逻辑
    return 0; // 占位符
  }

  /**
   * 获取安全事件
   */
  getEvents(filter?: {
    eventType?: SecurityEventType;
    threatLevel?: ThreatLevel;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): ExtendedSecurityEvent[] {
    let filtered = [...this.events];

    if (filter?.eventType) {
      filtered = filtered.filter(e => e.eventType === filter.eventType);
    }

    if (filter?.threatLevel) {
      filtered = filtered.filter(e => e.threatLevel === filter.threatLevel);
    }

    if (filter?.startDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) >= filter.startDate!);
    }

    if (filter?.endDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) <= filter.endDate!);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * 解决安全事件
   */
  resolveEvent(eventId: string, resolutionNotes?: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = new Date().toISOString();
    event.resolutionNotes = resolutionNotes;

    return true;
  }

  /**
   * 获取防护规则
   */
  getProtectionRules(): ProtectionRule[] {
    return [...this.protectionRules];
  }

  /**
   * 更新防护规则
   */
  updateProtectionRule(ruleId: string, updates: Partial<ProtectionRule>): boolean {
    const rule = this.protectionRules.find(r => r.id === ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    return true;
  }

  /**
   * 清理旧事件
   */
  cleanupEvents(olderThanDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    this.events = this.events.filter(event =>
      new Date(event.timestamp) > cutoffDate || event.resolved === false
    );
  }

  /**
   * 重置监控数据
   */
  resetMonitoringData(): void {
    this.events = [];
    this.blockedIPs.clear();
    this.rateLimitMap.clear();
    this.protectionRules.forEach(rule => {
      rule.triggerCount = 0;
      rule.lastTriggered = undefined;
    });
  }
}

// 导出单例实例
export const securityMonitor = SecurityMonitor.getInstance();

// 便捷函数
export const recordSecurityEvent = (
  eventType: SecurityEventType,
  threatLevel: ThreatLevel,
  details: Omit<ExtendedSecurityEvent, keyof SecurityEvent | 'id' | 'eventType' | 'threatLevel' | 'userAgent' | 'blocked' | 'resolved'>
): string => securityMonitor.recordSecurityEvent(eventType, threatLevel, details);

export const getSecurityMetrics = (): SecurityMetrics => securityMonitor.getSecurityMetrics();

export const enableSecurityMonitoring = (): void => securityMonitor.enableMonitoring();

export const isIPBlocked = (ip: string): boolean => securityMonitor.isIPBlocked(ip);