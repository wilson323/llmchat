/**
 * 队列管理可视化配置服务
 * 提供可视化界面的配置管理和参数控制
 */

export interface VisualizationConfig {
  enabled: boolean;
  refreshInterval: number; // 刷新间隔(毫秒)
  maxDataPoints: number; // 最大数据点数
  features: {
    dashboard: boolean;
    realTimeMonitoring: boolean;
    queueManagement: boolean;
    performanceAnalytics: boolean;
    alertManagement: boolean;
    systemHealth: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'zh' | 'en';
    compactMode: boolean;
    showAdvancedOptions: boolean;
  };
  security: {
    requireAuth: boolean;
    allowedRoles: string[];
    sessionTimeout: number;
  };
  performance: {
    enableAnimations: boolean;
    chartUpdateThrottle: number;
    dataCompressionEnabled: boolean;
    cacheEnabled: boolean;
    cache_ttl: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'status';
  title: string;
  enabled: boolean;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, any>;
  dataSource: string;
  refreshInterval?: number;
}

export interface QueueVisualizationData {
  queueName: string;
  stats: {
    totalJobs: number;
    waitingJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgProcessingTime: number;
    throughput: number;
  };
  trends: Array<{
    timestamp: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;
  errors: Array<{
    timestamp: number;
    error: string;
    count: number;
  }>;
}

export interface SystemVisualizationData {
  performance: {
    cpu: Array<{ timestamp: number; value: number }>;
    memory: Array<{ timestamp: number; value: number }>;
    eventLoop: Array<{ timestamp: number; value: number }>;
  };
  redis: {
    connections: Array<{ timestamp: number; value: number }>;
    operations: Array<{ timestamp: number; value: number }>;
    errors: Array<{ timestamp: number; value: number }>;
  };
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: number;
    acknowledged: boolean;
  }>;
}

class VisualizationConfigService {
  private config: VisualizationConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || './config/visualization.json';
    this.config = this.getDefaultConfig();
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): VisualizationConfig {
    return {
      enabled: false, // 生产环境默认禁用
      refreshInterval: 5000, // 5秒刷新间隔
      maxDataPoints: 1000, // 最多1000个数据点
      features: {
        dashboard: true,
        realTimeMonitoring: true,
        queueManagement: true,
        performanceAnalytics: true,
        alertManagement: true,
        systemHealth: true,
      },
      ui: {
        theme: 'auto',
        language: 'zh',
        compactMode: false,
        showAdvancedOptions: false,
      },
      security: {
        requireAuth: true,
        allowedRoles: ['admin', 'operator'],
        sessionTimeout: 3600000, // 1小时
      },
      performance: {
        enableAnimations: true,
        chartUpdateThrottle: 1000, // 1秒节流
        dataCompressionEnabled: true,
        cacheEnabled: true,
        cache_ttl: 300000, // 5分钟缓存
      },
    };
  }

  /**
   * 加载配置
   */
  public loadConfig(): VisualizationConfig {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        this.config = { ...this.getDefaultConfig(), ...loadedConfig };
      }
    } catch (error) {
      console.warn('Failed to load visualization config:', error);
      this.config = this.getDefaultConfig();
    }
    return this.config;
  }

  /**
   * 保存配置
   */
  public saveConfig(config: Partial<VisualizationConfig>): boolean {
    try {
      const fs = require('fs');
      const updatedConfig = { ...this.config, ...config };
      fs.writeFileSync(this.configPath, JSON.stringify(updatedConfig, null, 2));
      this.config = updatedConfig;
      return true;
    } catch (error) {
      console.error('Failed to save visualization config:', error);
      return false;
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): VisualizationConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  public updateConfig(updates: Partial<VisualizationConfig>): boolean {
    return this.saveConfig(updates);
  }

  /**
   * 启用/禁用可视化功能
   */
  public setEnabled(enabled: boolean): boolean {
    return this.updateConfig({ enabled });
  }

  /**
   * 配置功能模块
   */
  public configureFeatures(features: Partial<VisualizationConfig['features']>): boolean {
    const currentConfig = this.getConfig();
    const updatedFeatures = { ...currentConfig.features, ...features };
    return this.updateConfig({ features: updatedFeatures });
  }

  /**
   * 配置UI设置
   */
  public configureUI(ui: Partial<VisualizationConfig['ui']>): boolean {
    const currentConfig = this.getConfig();
    const updatedUI = { ...currentConfig.ui, ...ui };
    return this.updateConfig({ ui: updatedUI });
  }

  /**
   * 配置安全设置
   */
  public configureSecurity(security: Partial<VisualizationConfig['security']>): boolean {
    const currentConfig = this.getConfig();
    const updatedSecurity = { ...currentConfig.security, ...security };
    return this.updateConfig({ security: updatedSecurity });
  }

  /**
   * 配置性能设置
   */
  public configurePerformance(performance: Partial<VisualizationConfig['performance']>): boolean {
    const currentConfig = this.getConfig();
    const updatedPerformance = { ...currentConfig.performance, ...performance };
    return this.updateConfig({ performance: updatedPerformance });
  }

  /**
   * 检查功能是否启用
   */
  public isFeatureEnabled(feature: keyof VisualizationConfig['features']): boolean {
    return this.config.enabled && this.config.features[feature];
  }

  /**
   * 获取生产环境推荐配置
   */
  public getProductionConfig(): VisualizationConfig {
    return {
      ...this.getDefaultConfig(),
      enabled: true,
      refreshInterval: 30000, // 30秒刷新间隔
      maxDataPoints: 500, // 减少数据点
      features: {
        dashboard: true,
        realTimeMonitoring: false, // 生产环境禁用实时监控
        queueManagement: true,
        performanceAnalytics: true,
        alertManagement: true,
        systemHealth: true,
      },
      performance: {
        enableAnimations: false, // 禁用动画
        chartUpdateThrottle: 5000, // 5秒节流
        dataCompressionEnabled: true,
        cacheEnabled: true,
        cache_ttl: 600000, // 10分钟缓存
      },
    };
  }

  /**
   * 获取开发环境推荐配置
   */
  public getDevelopmentConfig(): VisualizationConfig {
    return {
      ...this.getDefaultConfig(),
      enabled: true,
      refreshInterval: 1000, // 1秒刷新间隔
      maxDataPoints: 2000, // 更多数据点
      features: {
        dashboard: true,
        realTimeMonitoring: true,
        queueManagement: true,
        performanceAnalytics: true,
        alertManagement: true,
        systemHealth: true,
      },
      performance: {
        enableAnimations: true,
        chartUpdateThrottle: 500, // 0.5秒节流
        dataCompressionEnabled: false,
        cacheEnabled: false,
        cache_ttl: 60000, // 1分钟缓存
      },
    };
  }

  /**
   * 应用预设配置
   */
  public applyPreset(preset: 'production' | 'development' | 'minimal'): boolean {
    let presetConfig: VisualizationConfig;

    switch (preset) {
      case 'production':
        presetConfig = this.getProductionConfig();
        break;
      case 'development':
        presetConfig = this.getDevelopmentConfig();
        break;
      case 'minimal':
        presetConfig = {
          ...this.getDefaultConfig(),
          enabled: true,
          refreshInterval: 60000, // 1分钟刷新
          maxDataPoints: 100, // 最少数据点
          features: {
            dashboard: true,
            realTimeMonitoring: false,
            queueManagement: true,
            performanceAnalytics: false,
            alertManagement: true,
            systemHealth: false,
          },
          performance: {
            enableAnimations: false,
            chartUpdateThrottle: 10000, // 10秒节流
            dataCompressionEnabled: true,
            cacheEnabled: true,
            cache_ttl: 1200000, // 20分钟缓存
          },
        };
        break;
      default:
        return false;
    }

    return this.saveConfig(presetConfig);
  }

  /**
   * 验证配置
   */
  public validateConfig(config: Partial<VisualizationConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.refreshInterval !== undefined) {
      if (config.refreshInterval < 1000 || config.refreshInterval > 300000) {
        errors.push('刷新间隔必须在1秒到5分钟之间');
      }
    }

    if (config.maxDataPoints !== undefined) {
      if (config.maxDataPoints < 10 || config.maxDataPoints > 10000) {
        errors.push('最大数据点数必须在10到10000之间');
      }
    }

    if (config.security?.sessionTimeout !== undefined) {
      if (config.security.sessionTimeout < 60000 || config.security.sessionTimeout > 86400000) {
        errors.push('会话超时必须在1分钟到24小时之间');
      }
    }

    if (config.performance?.chartUpdateThrottle !== undefined) {
      if (config.performance.chartUpdateThrottle < 100 || config.performance.chartUpdateThrottle > 60000) {
        errors.push('图表更新节流必须在0.1秒到1分钟之间');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default VisualizationConfigService;