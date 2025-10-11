/**
 * 队列管理可视化控制器
 * 提供可视化界面的API端点
 */

import { Request, Response } from 'express';
import VisualizationConfigService from '@/services/VisualizationConfigService';
import VisualizationDataService from '@/services/VisualizationDataService';
import QueueManager from '@/services/QueueManager';
import MonitoringService from '@/services/MonitoringService';
import RedisConnectionPool from '@/utils/redisConnectionPool';

export class VisualizationController {
  private configService: VisualizationConfigService;
  private dataService: VisualizationDataService;
  private queueManager: QueueManager;
  private monitoringService: MonitoringService;
  private connectionPool: RedisConnectionPool;

  constructor(
    queueManager: QueueManager,
    monitoringService: MonitoringService,
    connectionPool: RedisConnectionPool
  ) {
    this.queueManager = queueManager;
    this.monitoringService = monitoringService;
    this.connectionPool = connectionPool;

    this.configService = new VisualizationConfigService();
    this.dataService = new VisualizationDataService(queueManager, monitoringService, connectionPool);

    // 加载配置
    this.configService.loadConfig();

    // 如果启用了可视化服务，启动数据收集
    if (this.configService.getConfig().enabled) {
      this.startDataCollection();
    }
  }

  /**
   * 启动数据收集
   */
  private startDataCollection(): void {
    const config = this.configService.getConfig();
    this.dataService.startRealtimeCollection(config.refreshInterval);
  }

  /**
   * 停止数据收集
   */
  private stopDataCollection(): void {
    this.dataService.stopRealtimeCollection();
  }

  /**
   * 获取可视化配置
   */
  public getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = this.configService.getConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error('Error getting visualization config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visualization config',
      });
    }
  };

  /**
   * 更新可视化配置
   */
  public updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const updates = req.body;

      // 验证配置
      const validation = this.configService.validateConfig(updates);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: validation.errors,
        });
        return;
      }

      // 应用配置更新
      const success = this.configService.updateConfig(updates);
      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to update configuration',
        });
        return;
      }

      // 如果enabled状态改变，调整数据收集
      if ('enabled' in updates) {
        if (updates.enabled) {
          this.startDataCollection();
        } else {
          this.stopDataCollection();
        }
      }

      // 如果刷新间隔改变，重启数据收集
      if ('refreshInterval' in updates && this.configService.getConfig().enabled) {
        this.stopDataCollection();
        this.startDataCollection();
      }

      const updatedConfig = this.configService.getConfig();

      res.json({
        success: true,
        data: updatedConfig,
      });
    } catch (error) {
      console.error('Error updating visualization config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update visualization config',
      });
    }
  };

  /**
   * 获取仪表板数据
   */
  public getDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.configService.isFeatureEnabled('dashboard')) {
        res.status(403).json({
          success: false,
          error: 'Dashboard feature is disabled',
        });
        return;
      }

      const summary = await this.dataService.getRealtimeSummary();
      const config = this.configService.getConfig();

      res.json({
        success: true,
        data: {
          summary,
          config,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data',
      });
    }
  };

  /**
   * 获取队列统计
   */
  public getQueueStats = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.configService.isFeatureEnabled('queueManagement')) {
        res.status(403).json({
          success: false,
          error: 'Queue management feature is disabled',
        });
        return;
      }

      const { queueName, timeRange } = req.query;
      const limit = timeRange ? parseInt(timeRange as string) : undefined;

      let stats;
      if (queueName) {
        stats = this.dataService.getQueueHistory(queueName as string, limit);
      } else {
        stats = this.dataService.getQueueHistory(undefined, limit);
      }

      res.json({
        success: true,
        data: {
          stats,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error getting queue stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue stats',
      });
    }
  };

  /**
   * 获取系统统计
   */
  public getSystemStats = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.configService.isFeatureEnabled('systemHealth')) {
        res.status(403).json({
          success: false,
          error: 'System health feature is disabled',
        });
        return;
      }

      const { timeRange } = req.query;
      const limit = timeRange ? parseInt(timeRange as string) : undefined;

      const stats = this.dataService.getSystemHistory(limit);
      const config = this.configService.getConfig();

      res.json({
        success: true,
        data: {
          stats,
          config,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error getting system stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system stats',
      });
    }
  };

  /**
   * 获取Redis统计
   */
  public getRedisStats = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.configService.isFeatureEnabled('performanceAnalytics')) {
        res.status(403).json({
          success: false,
          error: 'Performance analytics feature is disabled',
        });
        return;
      }

      const { timeRange } = req.query;
      const limit = timeRange ? parseInt(timeRange as string) : undefined;

      const stats = this.dataService.getRedisHistory(limit);
      const poolStats = this.connectionPool.getStats();

      res.json({
        success: true,
        data: {
          stats,
          poolStats,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error getting Redis stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Redis stats',
      });
    }
  };

  /**
   * 获取图表数据
   */
  public getChartData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, metric, timeRange } = req.query;

      if (!type || !metric) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: type, metric',
        });
        return;
      }

      const validTypes = ['queue', 'system', 'redis'];
      if (!validTypes.includes(type as string)) {
        res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const limit = timeRange ? parseInt(timeRange as string) : undefined;
      const chartData = this.dataService.getChartData(
        type as 'queue' | 'system' | 'redis',
        metric as string,
        limit
      );

      res.json({
        success: true,
        data: {
          chartData,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error getting chart data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chart data',
      });
    }
  };

  /**
   * 获取实时更新 (SSE)
   */
  public getRealtimeUpdates = (req: Request, res: Response): void => {
    try {
      if (!this.configService.isFeatureEnabled('realTimeMonitoring')) {
        res.status(403).json({
          success: false,
          error: 'Real-time monitoring feature is disabled',
        });
        return;
      }

      // 设置SSE头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // 订阅数据更新
      const unsubscribe = this.dataService.subscribe('dataUpdate', (update) => {
        res.write(`data: ${JSON.stringify(update)}\n\n`);
      });

      // 发送初始数据
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      })}\n\n`);

      // 处理连接断开
      req.on('close', () => {
        unsubscribe();
      });

      req.on('aborted', () => {
        unsubscribe();
      });
    } catch (error) {
      console.error('Error setting up realtime updates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup realtime updates',
      });
    }
  };

  /**
   * 应用预设配置
   */
  public applyPreset = async (req: Request, res: Response): Promise<void> => {
    try {
      const { preset } = req.body;

      if (!['production', 'development', 'minimal'].includes(preset)) {
        res.status(400).json({
          success: false,
          error: 'Invalid preset. Must be one of: production, development, minimal',
        });
        return;
      }

      const success = this.configService.applyPreset(preset);
      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to apply preset',
        });
        return;
      }

      // 重启数据收集以应用新配置
      if (this.configService.getConfig().enabled) {
        this.stopDataCollection();
        this.startDataCollection();
      }

      const config = this.configService.getConfig();

      res.json({
        success: true,
        data: {
          preset,
          config,
        },
      });
    } catch (error) {
      console.error('Error applying preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply preset',
      });
    }
  };

  /**
   * 获取可用的预设配置
   */
  public getPresets = async (req: Request, res: Response): Promise<void> => {
    try {
      const presets = {
        production: this.configService.getProductionConfig(),
        development: this.configService.getDevelopmentConfig(),
        minimal: this.configService.applyPreset('minimal') ? this.configService.getConfig() : null,
      };

      res.json({
        success: true,
        data: {
          presets,
          current: this.configService.getConfig(),
        },
      });
    } catch (error) {
      console.error('Error getting presets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get presets',
      });
    }
  };

  /**
   * 手动触发队列操作
   */
  public performQueueAction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueName, action, options } = req.body;

      if (!queueName || !action) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: queueName, action',
        });
        return;
      }

      const validActions = ['pause', 'resume', 'clear', 'retry', 'stats'];
      if (!validActions.includes(action)) {
        res.status(400).json({
          success: false,
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
        });
        return;
      }

      let result;
      switch (action) {
        case 'pause':
          result = await this.queueManager.pauseQueue(queueName);
          break;
        case 'resume':
          result = await this.queueManager.resumeQueue(queueName);
          break;
        case 'clear':
          result = await this.queueManager.clearQueue(queueName);
          break;
        case 'retry':
          result = await this.queueManager.retryFailedJobs(queueName, options?.limit || 10);
          break;
        case 'stats':
          result = await this.queueManager.getQueueStats(queueName);
          break;
      }

      res.json({
        success: true,
        data: {
          action,
          queueName,
          result,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error performing queue action:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform queue action',
      });
    }
  };

  /**
   * 健康检查
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = this.configService.getConfig();
      const isHealthy = this.dataService.listenerCount('dataUpdate') > 0 || !config.enabled;

      res.json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          enabled: config.enabled,
          features: config.features,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error in health check:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
      });
    }
  };

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopDataCollection();
    this.dataService.cleanup();
  }
}

export default VisualizationController;