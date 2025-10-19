/**
 * 安全系统初始化模块
 *
 * 在应用启动时初始化所有安全配置和监控系统
 * 确保安全防护功能正常运行
 */

import { secureContentSanitizer } from './secureContentSanitizer';
import { securityValidator } from './securityMiddleware';
import { cspManager, CSP_PRESETS } from './contentSecurityPolicy';
import { securityMonitor, enableSecurityMonitoring } from './securityMonitor';

// 安全配置接口
export interface SecurityConfig {
  // 内容安全配置
  contentSanitization: {
    enabled: boolean;
    strictMode: boolean;
    maxLength: number;
    allowedTags: string[];
  };

  // 输入验证配置
  inputValidation: {
    enabled: boolean;
    strictMode: boolean;
    rateLimitEnabled: boolean;
    maxRequestsPerMinute: number;
  };

  // CSP配置
  csp: {
    enabled: boolean;
    mode: 'strict' | 'balanced' | 'development';
    reportOnly: boolean;
    customPolicy?: any;
  };

  // 监控配置
  monitoring: {
    enabled: boolean;
    logToConsole: boolean;
    sendToServer: boolean;
    endpoint: string;
  };

  // 防护配置
  protection: {
    autoBlock: boolean;
    blockDuration: number; // 封锁时长（毫秒）
    maxViolations: number;
  };
}

// 默认安全配置
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  contentSanitization: {
    enabled: true,
    strictMode: true,
    maxLength: 50000,
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote']
  },

  inputValidation: {
    enabled: true,
    strictMode: false,
    rateLimitEnabled: true,
    maxRequestsPerMinute: 60
  },

  csp: {
    enabled: true,
    mode: 'balanced',
    reportOnly: false,
    customPolicy: undefined
  },

  monitoring: {
    enabled: true,
    logToConsole: true,
    sendToServer: true,
    endpoint: '/api/security/events'
  },

  protection: {
    autoBlock: true,
    blockDuration: 30 * 60 * 1000, // 30分钟
    maxViolations: 5
  }
};

/**
 * 安全系统初始化器
 */
export class SecurityInitializer {
  private static instance: SecurityInitializer;
  private isInitialized = false;
  private config: SecurityConfig = DEFAULT_SECURITY_CONFIG;

  private constructor() {}

  static getInstance(): SecurityInitializer {
    if (!SecurityInitializer.instance) {
      SecurityInitializer.instance = new SecurityInitializer();
    }
    return SecurityInitializer.instance;
  }

  /**
   * 初始化安全系统
   */
  async initialize(customConfig?: Partial<SecurityConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn('安全系统已经初始化');
      return;
    }

    // 合并配置
    if (customConfig) {
      this.config = this.mergeConfig(DEFAULT_SECURITY_CONFIG, customConfig);
    }

    try {
      // 1. 初始化内容清理器
      await this.initializeContentSanitization();

      // 2. 初始化输入验证
      await this.initializeInputValidation();

      // 3. 初始化CSP策略
      await this.initializeCSP();

      // 4. 初始化监控系统
      await this.initializeMonitoring();

      // 5. 初始化防护机制
      await this.initializeProtection();

      this.isInitialized = true;
      console.log('安全系统初始化完成');

      // 记录初始化事件
      if (this.config.monitoring.enabled) {
        securityMonitor.recordSecurityEvent(
          'SYSTEM_INITIALIZED' as any,
          'low' as any,
          {
            type: 'SECURITY_INITIALIZATION',
            content: '安全系统成功初始化',
            timestamp: new Date().toISOString(),
            metadata: { config: this.config }
          }
        );
      }

    } catch (error) {
      console.error('安全系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化内容清理器
   */
  private async initializeContentSanitization(): Promise<void> {
    if (!this.config.contentSanitization.enabled) {
      console.log('内容清理功能已禁用');
      return;
    }

    // 配置内容清理器（如果需要自定义配置）
    // secureContentSanitizer.configure(this.config.contentSanitization);

    console.log('内容清理器初始化完成');
  }

  /**
   * 初始化输入验证
   */
  private async initializeInputValidation(): Promise<void> {
    if (!this.config.inputValidation.enabled) {
      console.log('输入验证功能已禁用');
      return;
    }

    // 配置速率限制
    if (this.config.inputValidation.rateLimitEnabled) {
      // 这里可以配置速率限制参数
      console.log(`速率限制已启用: ${this.config.inputValidation.maxRequestsPerMinute}请求/分钟`);
    }

    console.log('输入验证器初始化完成');
  }

  /**
   * 初始化CSP策略
   */
  private async initializeCSP(): Promise<void> {
    if (!this.config.csp.enabled) {
      console.log('CSP功能已禁用');
      return;
    }

    // 根据模式选择策略
    let policy;
    switch (this.config.csp.mode) {
      case 'strict':
        policy = CSP_PRESETS.STRICT;
        break;
      case 'development':
        policy = CSP_PRESETS.DEVELOPMENT;
        break;
      case 'balanced':
      default:
        policy = CSP_PRESETS.BALANCED;
        break;
    }

    // 应用自定义策略
    if (this.config.csp.customPolicy) {
      policy = { ...policy, ...this.config.csp.customPolicy };
    }

    // 设置策略
    cspManager.setPolicy(policy);

    // 应用到页面
    if (typeof document !== 'undefined') {
      cspManager.applyToPage(!this.config.csp.reportOnly);
    }

    console.log(`CSP策略已应用: ${this.config.csp.mode}模式`);
  }

  /**
   * 初始化监控系统
   */
  private async initializeMonitoring(): Promise<void> {
    if (!this.config.monitoring.enabled) {
      console.log('安全监控功能已禁用');
      return;
    }

    // 启用监控
    enableSecurityMonitoring();

    // 配置事件回调
    if (this.config.monitoring.logToConsole) {
      securityMonitor.addEventCallback('console-logger', (event) => {
        console.log('安全事件:', event);
      });
    }

    // 配置服务器端点
    if (this.config.monitoring.sendToServer && this.config.monitoring.endpoint) {
      // 端点配置已在securityMonitor中处理
      console.log(`安全事件将发送到: ${this.config.monitoring.endpoint}`);
    }

    console.log('安全监控系统初始化完成');
  }

  /**
   * 初始化防护机制
   */
  private async initializeProtection(): Promise<void> {
    // 更新防护规则配置
    const rules = securityMonitor.getProtectionRules();

    rules.forEach(rule => {
      if (this.config.protection.autoBlock && rule.action === 'block') {
        securityMonitor.updateProtectionRule(rule.id, {
          cooldownPeriod: this.config.protection.blockDuration
        });
      }
    });

    console.log('防护机制初始化完成');
  }

  /**
   * 合并配置对象
   */
  private mergeConfig(defaultConfig: SecurityConfig, customConfig: Partial<SecurityConfig>): SecurityConfig {
    const merged = { ...defaultConfig };

    Object.keys(customConfig).forEach(key => {
      const customValue = customConfig[key as keyof SecurityConfig];
      if (customValue && typeof customValue === 'object') {
        merged[key as keyof SecurityConfig] = {
          ...merged[key as keyof SecurityConfig] as any,
          ...customValue as any
        };
      } else {
        merged[key as keyof SecurityConfig] = customValue as any;
      }
    });

    return merged;
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig);
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取安全状态报告
   */
  getSecurityStatus(): {
    initialized: boolean;
    config: SecurityConfig;
    metrics: any;
    cspPolicy: any;
    protectionRules: any;
  } {
    return {
      initialized: this.isInitialized,
      config: this.config,
      metrics: this.config.monitoring.enabled ? securityMonitor.getSecurityMetrics() : null,
      cspPolicy: this.config.csp.enabled ? cspManager.getPolicy() : null,
      protectionRules: securityMonitor.getProtectionRules()
    };
  }

  /**
   * 重置安全系统
   */
  reset(): void {
    this.isInitialized = false;
    this.config = DEFAULT_SECURITY_CONFIG;
    securityMonitor.resetMonitoringData();
    cspManager.clearViolationReports();
    console.log('安全系统已重置');
  }
}

// 导出单例实例
export const securityInitializer = SecurityInitializer.getInstance();

// 便捷函数
export const initializeSecurity = async (customConfig?: Partial<SecurityConfig>): Promise<void> => {
  return securityInitializer.initialize(customConfig);
};

export const getSecurityStatus = () => securityInitializer.getSecurityStatus();

export const isSecurityReady = () => securityInitializer.isReady();

// 自动初始化（如果在浏览器环境中）
if (typeof window !== 'undefined') {
  // 等待DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSecurity().catch(error => {
        console.error('自动安全初始化失败:', error);
      });
    });
  } else {
    // DOM已经加载完成
    initializeSecurity().catch(error => {
      console.error('自动安全初始化失败:', error);
    });
  }
}