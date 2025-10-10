/**
 * 监控管理器
 *
 * 统一管理所有监控服务，确保正确的启动和清理
 * 防止监控服务本身的内存泄漏
 */

import logger from './StructuredLogger';
import { PerformanceMonitor } from '../services/MonitoringService';
import { SLAMonitor } from '../services/MonitoringService';
import { SystemHealthChecker } from '../services/MonitoringService';

// ============================================================================
// 监控管理器接口
// ============================================================================

export interface MonitoringConfig {
  performanceMonitor: {
    enabled: boolean;
    interval: number;
  };
  slaMonitor: {
    enabled: boolean;
    interval: number;
  };
  healthChecker: {
    enabled: boolean;
    interval: number;
  };
}

// ============================================================================
// 监控管理器主类
// ============================================================================

export class MonitoringManager {
  private static instance: MonitoringManager;
  private isRunning = false;
  private config: MonitoringConfig;

  private performanceMonitor?: PerformanceMonitor;
  private slaMonitor?: SLAMonitor;
  private healthChecker?: SystemHealthChecker;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): MonitoringManager {
    if (!MonitoringManager.instance) {
      MonitoringManager.instance = new MonitoringManager();
    }
    return MonitoringManager.instance;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): MonitoringConfig {
    return {
      performanceMonitor: {
        enabled: true,
        interval: 60000, // 1分钟
      },
      slaMonitor: {
        enabled: true,
        interval: 60000, // 1分钟
      },
      healthChecker: {
        enabled: true,
        interval: 60000, // 1分钟
      },
    };
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<MonitoringConfig>): void {
    this.config = {
      performanceMonitor: { ...this.config.performanceMonitor, ...config.performanceMonitor },
      slaMonitor: { ...this.config.slaMonitor, ...config.slaMonitor },
      healthChecker: { ...this.config.healthChecker, ...config.healthChecker },
    };
  }

  /**
   * 启动所有监控服务
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('监控管理器已在运行');
      return;
    }

    try {
      // 启动性能监控器
      if (this.config.performanceMonitor.enabled) {
        this.performanceMonitor = new PerformanceMonitor();
        logger.info('✅ 性能监控器已启动');
      }

      // 启动SLA监控器
      if (this.config.slaMonitor.enabled) {
        this.slaMonitor = new SLAMonitor();
        logger.info('✅ SLA监控器已启动');
      }

      // 启动健康检查器
      if (this.config.healthChecker.enabled && this.performanceMonitor) {
        // 注意：这里需要注入依赖，暂时使用模拟对象
        this.healthChecker = new SystemHealthChecker(
          this.performanceMonitor,
          // 模拟 AlertManager
          {
            getActiveAlerts: () => [],
            getAllAlerts: () => [],
          } as any,
          // 模拟 CircuitBreakerManager
          {
            getHealthStatus: () => ({ status: 'healthy', score: 100 }),
          } as any,
          // 模拟 RateLimitService
          {
            getHealthStatus: () => ({ status: 'healthy', score: 100 }),
          } as any
        );
        logger.info('✅ 系统健康检查器已启动');
      }

      this.isRunning = true;
      logger.info('🎯 监控管理器启动完成', {
        performanceMonitor: this.config.performanceMonitor.enabled,
        slaMonitor: this.config.slaMonitor.enabled,
        healthChecker: this.config.healthChecker.enabled,
      });

      // 注册进程退出时的清理处理
      this.registerCleanupHandlers();

    } catch (error) {
      logger.error('监控管理器启动失败', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: error.stack })
        } : { name: 'UnknownError', message: String(error) }
      });
      throw error;
    }
  }

  /**
   * 停止所有监控服务
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    try {
      // 停止性能监控器
      if (this.performanceMonitor) {
        this.performanceMonitor.stop();
        this.performanceMonitor = undefined as any;
        logger.info('✅ 性能监控器已停止');
      }

      // 停止SLA监控器
      if (this.slaMonitor) {
        this.slaMonitor.stop();
        this.slaMonitor = undefined as any;
        logger.info('✅ SLA监控器已停止');
      }

      // 停止健康检查器
      if (this.healthChecker) {
        this.healthChecker.stop();
        this.healthChecker = undefined as any;
        logger.info('✅ 系统健康检查器已停止');
      }

      this.isRunning = false;
      logger.info('🎯 监控管理器已停止');

    } catch (error) {
      logger.error('监控管理器停止失败', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: error.stack })
        } : { name: 'UnknownError', message: String(error) }
      });
    }
  }

  /**
   * 重启监控服务
   */
  restart(): void {
    logger.info('重启监控管理器...');
    this.stop();
    setTimeout(() => {
      this.start();
    }, 1000);
  }

  /**
   * 获取监控状态
   */
  getStatus(): {
    isRunning: boolean;
    config: MonitoringConfig;
    services: {
      performanceMonitor: boolean;
      slaMonitor: boolean;
      healthChecker: boolean;
    };
    health: {
      memoryUsage: NodeJS.MemoryUsage;
      uptime: number;
    };
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      services: {
        performanceMonitor: !!this.performanceMonitor,
        slaMonitor: !!this.slaMonitor,
        healthChecker: !!this.healthChecker,
      },
      health: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };
  }

  /**
   * 获取性能指标
   */
  getMetrics(): any {
    if (!this.isRunning) {
      return null;
    }

    const metrics: any = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    if (this.performanceMonitor) {
      metrics.performance = this.performanceMonitor.getLatestMetrics();
    }

    if (this.slaMonitor) {
      metrics.sla = this.slaMonitor.getSLAMetrics();
    }

    if (this.healthChecker) {
      metrics.health = this.healthChecker.getHealthStatus();
    }

    return metrics;
  }

  /**
   * 注册进程退出时的清理处理程序
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      logger.info('收到进程退出信号，正在清理监控服务...');
      this.stop();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
    process.on('unhandledRejection', cleanup);
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    details: Record<string, any>;
    timestamp: string;
  }> {
    const status = this.getStatus();
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;

    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    const details: Record<string, any> = {
      manager: status.isRunning,
      services: status.services,
      memoryUsage: Math.round(memoryUsageMB * 100) / 100,
    };

    // 检查内存使用
    if (memoryUsageMB > 1000) { // 1GB
      overallStatus = 'error';
      details.memoryWarning = 'Memory usage critically high';
    } else if (memoryUsageMB > 500) { // 500MB
      overallStatus = 'warning';
      details.memoryWarning = 'Memory usage high';
    }

    // 检查服务状态
    const runningServices = Object.values(status.services).filter(Boolean).length;
    if (runningServices === 0) {
      overallStatus = 'error';
      details.serviceWarning = 'No monitoring services running';
    } else if (runningServices < 3) {
      overallStatus = 'warning';
      details.serviceWarning = 'Some monitoring services not running';
    }

    return {
      status: overallStatus,
      details,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const monitoringManager = MonitoringManager.getInstance();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 启动监控管理器
 */
export function startMonitoring(config?: Partial<MonitoringConfig>): void {
  if (config) {
    monitoringManager.setConfig(config);
  }
  monitoringManager.start();
}

/**
 * 停止监控管理器
 */
export function stopMonitoring(): void {
  monitoringManager.stop();
}

/**
 * 重启监控管理器
 */
export function restartMonitoring(): void {
  monitoringManager.restart();
}

/**
 * 获取监控状态
 */
export function getMonitoringStatus() {
  return monitoringManager.getStatus();
}

/**
 * 获取监控指标
 */
export function getMonitoringMetrics() {
  return monitoringManager.getMetrics();
}

export default monitoringManager;