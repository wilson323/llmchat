/**
 * 内容安全策略 (CSP) 配置和管理工具
 *
 * 提供CSP头生成、管理和监控功能
 * 遵循CSP Level 3标准和OWASP安全指南
 */

// CSP指令类型
export interface CSPDirective {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'child-src'?: string[];
  'frame-src'?: string[];
  'worker-src'?: string[];
  'manifest-src'?: string[];
  'prefetch-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'base-uri'?: string[];
  'plugin-types'?: string[];
  'require-trusted-types-for'?: string[];
  'trusted-types'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

// CSP违规报告接口
export interface CSPViolationReport {
  blockedURI?: string;
  documentURI?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  referrer?: string;
  sample?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  disposition?: 'report' | 'enforce';
}

// 预定义CSP配置
export const CSP_PRESETS = {
  // 严格模式 - 最高安全级别
  STRICT: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], // 允许内联样式，但内联脚本被禁止
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'none'"],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'upgrade-insecure-requests': true,
    'block-all-mixed-content': true
  } as CSPDirective,

  // 平衡模式 - 开发环境使用
  BALANCED: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'"], // 开发环境允许eval
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:', 'http:'],
    'font-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", 'https:', 'ws:', 'wss:'],
    'media-src': ["'self'", 'https:'],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'frame-src': ["'self'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'upgrade-insecure-requests': true
  } as CSPDirective,

  // 开发模式 - 最宽松配置
  DEVELOPMENT: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:', 'http:', '*'],
    'font-src': ["'self'", 'data:', 'https:', 'http:'],
    'connect-src': ["'self'", 'https:', 'http:', 'ws:', 'wss:', '*'],
    'media-src': ["'self'", 'https:', 'http:'],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'frame-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"]
  } as CSPDirective
};

/**
 * CSP管理器类
 */
export class ContentSecurityPolicyManager {
  private static instance: ContentSecurityPolicyManager;
  private currentPolicy: CSPDirective;
  private violationReports: CSPViolationReport[] = [];
  private reportEndpoint?: string;
  private isMonitoring = false;

  private constructor() {
    this.currentPolicy = this.detectEnvironment() === 'development'
      ? CSP_PRESETS.DEVELOPMENT
      : CSP_PRESETS.STRICT;
  }

  static getInstance(): ContentSecurityPolicyManager {
    if (!ContentSecurityPolicyManager.instance) {
      ContentSecurityPolicyManager.instance = new ContentSecurityPolicyManager();
    }
    return ContentSecurityPolicyManager.instance;
  }

  /**
   * 检测当前环境
   */
  private detectEnvironment(): 'development' | 'production' {
    if (typeof window !== 'undefined') {
      return window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname.endsWith('.local')
        ? 'development'
        : 'production';
    }
    return 'production';
  }

  /**
   * 生成CSP头部字符串
   */
  generatePolicyHeader(policy?: CSPDirective): string {
    const policyToUse = policy || this.currentPolicy;
    const directives: string[] = [];

    Object.entries(policyToUse).forEach(([directive, values]) => {
      if (Array.isArray(values)) {
        directives.push(`${directive} ${values.join(' ')}`);
      } else if (typeof values === 'boolean' && values) {
        directives.push(directive);
      }
    });

    return directives.join('; ');
  }

  /**
   * 生成CSP报告URI
   */
  generateReportOnlyHeader(policy?: CSPDirective): string {
    const basePolicy = this.generatePolicyHeader(policy);
    const reportUri = this.getReportUri();
    return `${basePolicy}; report-uri ${reportUri}`;
  }

  /**
   * 设置当前策略
   */
  setPolicy(policy: CSPDirective): void {
    this.currentPolicy = { ...policy };
  }

  /**
   * 获取当前策略
   */
  getPolicy(): CSPDirective {
    return { ...this.currentPolicy };
  }

  /**
   * 更新策略指令
   */
  updateDirective(directive: keyof CSPDirective, values: string[] | boolean): void {
    this.currentPolicy[directive] = values as any;
  }

  /**
   * 添加源到指令
   */
  addSourceToDirective(directive: keyof CSPDirective, source: string): void {
    const current = this.currentPolicy[directive] as string[] || [];
    if (!current.includes(source)) {
      current.push(source);
      this.currentPolicy[directive] = current as any;
    }
  }

  /**
   * 从指令移除源
   */
  removeSourceFromDirective(directive: keyof CSPDirective, source: string): void {
    const current = this.currentPolicy[directive] as string[] || [];
    const index = current.indexOf(source);
    if (index > -1) {
      current.splice(index, 1);
      this.currentPolicy[directive] = current as any;
    }
  }

  /**
   * 启用CSP违规监控
   */
  enableMonitoring(reportEndpoint?: string): void {
    if (this.isMonitoring) return;

    this.reportEndpoint = reportEndpoint || this.getReportUri();
    this.isMonitoring = true;

    // 设置CSP违规报告监听器
    if (typeof window !== 'undefined') {
      document.addEventListener('securitypolicyviolation', (event) => {
        this.handleViolationReport({
          blockedURI: event.blockedURI,
          documentURI: event.documentURI,
          effectiveDirective: event.effectiveDirective,
          originalPolicy: event.originalPolicy,
          referrer: event.referrer,
          sample: event.sample,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
          statusCode: event.statusCode,
          disposition: event.disposition as 'report' | 'enforce'
        });
      });
    }
  }

  /**
   * 禁用CSP违规监控
   */
  disableMonitoring(): void {
    this.isMonitoring = false;
  }

  /**
   * 处理CSP违规报告
   */
  private handleViolationReport(report: CSPViolationReport): void {
    // 添加到违规记录
    this.violationReports.push(report);

    // 限制记录数量
    if (this.violationReports.length > 1000) {
      this.violationReports = this.violationReports.slice(-1000);
    }

    // 输出警告
    console.warn('CSP违规报告:', report);

    // 发送到报告端点
    this.sendViolationReport(report);
  }

  /**
   * 发送违规报告
   */
  private sendViolationReport(report: CSPViolationReport): void {
    if (!this.reportEndpoint) return;

    try {
      if (typeof window !== 'undefined' && window.navigator?.sendBeacon) {
        // 使用sendBeacon发送报告
        window.navigator.sendBeacon(
          this.reportEndpoint,
          JSON.stringify({ cspReport: report })
        );
      } else if (typeof window !== 'undefined' && window.fetch) {
        // 回退到fetch
        fetch(this.reportEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/csp-report' },
          body: JSON.stringify({ cspReport: report }),
          keepalive: true
        }).catch(() => {
          // 忽略发送错误
        });
      }
    } catch {
      // 忽略错误
    }
  }

  /**
   * 获取报告URI
   */
  private getReportUri(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/csp-report`;
    }
    return '/api/csp-report';
  }

  /**
   * 获取违规报告
   */
  getViolationReports(): CSPViolationReport[] {
    return [...this.violationReports];
  }

  /**
   * 清空违规报告
   */
  clearViolationReports(): void {
    this.violationReports = [];
  }

  /**
   * 获取违规统计
   */
  getViolationStats(): {
    total: number;
    byDirective: Record<string, number>;
    byBlockedURI: Record<string, number>;
    recent: CSPViolationReport[];
  } {
    const byDirective: Record<string, number> = {};
    const byBlockedURI: Record<string, number> = {};

    this.violationReports.forEach(report => {
      if (report.effectiveDirective) {
        byDirective[report.effectiveDirective] = (byDirective[report.effectiveDirective] || 0) + 1;
      }
      if (report.blockedURI) {
        byBlockedURI[report.blockedURI] = (byBlockedURI[report.blockedURI] || 0) + 1;
      }
    });

    return {
      total: this.violationReports.length,
      byDirective,
      byBlockedURI,
      recent: this.violationReports.slice(-10)
    };
  }

  /**
   * 应用CSP到当前页面
   */
  applyToPage(enforce: boolean = true): void {
    if (typeof document === 'undefined') return;

    const header = enforce
      ? this.generatePolicyHeader()
      : this.generateReportOnlyHeader();

    // 移除现有的CSP meta标签
    const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    // 创建新的CSP meta标签
    const meta = document.createElement('meta');
    meta.httpEquiv = enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
    meta.content = header;
    document.head.appendChild(meta);
  }

  /**
   * 验证策略配置
   */
  validatePolicy(policy: CSPDirective): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需的指令
    const requiredDirectives = ['default-src', 'script-src', 'object-src'];
    requiredDirectives.forEach(directive => {
      if (!policy[directive as keyof CSPDirective]) {
        warnings.push(`缺少推荐的安全指令: ${directive}`);
      }
    });

    // 检查危险配置
    if (policy['script-src']?.includes("'unsafe-inline'")) {
      warnings.push('script-src包含unsafe-inline，存在XSS风险');
    }

    if (policy['script-src']?.includes("'unsafe-eval'")) {
      warnings.push('script-src包含unsafe-eval，存在代码注入风险');
    }

    if (policy['object-src']?.includes("'none'") === false) {
      warnings.push('object-src未设置为none，存在插件攻击风险');
    }

    // 检查通配符使用
    Object.entries(policy).forEach(([directive, values]) => {
      if (Array.isArray(values) && values.includes('*')) {
        warnings.push(`${directive}包含通配符*，过于宽松`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 根据环境自动调整策略
   */
  autoAdjustForEnvironment(): void {
    const env = this.detectEnvironment();

    switch (env) {
      case 'development':
        this.setPolicy(CSP_PRESETS.DEVELOPMENT);
        break;
      case 'production':
        this.setPolicy(CSP_PRESETS.STRICT);
        break;
    }

    // 启用监控
    this.enableMonitoring();
  }
}

// 导出单例实例
export const cspManager = ContentSecurityPolicyManager.getInstance();

// 便捷函数
export const generateCSPHeader = (policy?: CSPDirective): string =>
  cspManager.generatePolicyHeader(policy);

export const generateCSPReportOnlyHeader = (policy?: CSPDirective): string =>
  cspManager.generateReportOnlyHeader(policy);

export const applyCSPToPage = (policy?: CSPDirective, enforce: boolean = true): void => {
  if (policy) {
    cspManager.setPolicy(policy);
  }
  cspManager.applyToPage(enforce);
};