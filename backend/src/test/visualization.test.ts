/**
 * 可视化系统测试
 */

import VisualizationConfigService from '@/services/VisualizationConfigService';
import VisualizationDataService from '@/services/VisualizationDataService';
import VisualizationController from '@/controllers/VisualizationController';
import QueueManager from '@/services/QueueManager';
import MonitoringService from '@/services/MonitoringService';
import RedisConnectionPool from '@/utils/redisConnectionPool';
import { EventEmitter } from 'events';

// Mock implementations
class MockQueueManager extends EventEmitter {
  public getConnectionPool(): RedisConnectionPool {
    return new RedisConnectionPool({
      host: 'localhost',
      port: 6379,
      maxConnections: 5,
      minConnections: 1,
      acquireTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
  }

  public async getAllQueues(): Promise<string[]> {
    return ['test-queue-1', 'test-queue-2'];
  }

  public async getQueueStats(queueName: string): Promise<any> {
    return {
      total: 100,
      waiting: 10,
      active: 5,
      completed: 80,
      failed: 5,
      avgProcessingTime: 150,
    };
  }

  public async getCompletedJobs(queueName: string, limit: number): Promise<any[]> {
    return Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
      id: `job-${i}`,
      type: 'test',
      data: { test: true },
      finishedOn: Date.now() - i * 1000,
      processingTime: 100 + i * 10,
      attemptsMade: 1,
    }));
  }

  public async getFailedJobs(queueName: string, limit: number): Promise<any[]> {
    return Array.from({ length: Math.min(limit, 2) }, (_, i) => ({
      id: `failed-job-${i}`,
      type: 'test',
      data: { test: true },
      failedAt: Date.now() - i * 2000,
      failedReason: 'Test error',
      attemptsMade: 3,
    }));
  }
}

class MockMonitoringService extends EventEmitter {
  public config = {
    enabled: true,
    metricsInterval: 5000,
    memoryThresholds: {
      warning: 80,
      critical: 90,
    },
    cpuThresholds: {
      warning: 70,
      critical: 85,
    },
  };
  public queueManager: any = null;
  public metricsHistory: any[] = [];
  public alertRules: any[] = [];

  public static getInstance(): MockMonitoringService {
    return new MockMonitoringService();
  }

  public async getCurrentMetrics(): Promise<any> {
    return {
      timestamp: Date.now(),
      performance: {
        cpuUsage: 45.2,
        memoryUsage: 67.8,
        eventLoopDelay: 2.5,
        activeHandles: 8,
        activeRequests: 12,
      },
      queue: {
        totalQueues: 2,
        totalJobs: 200,
        waitingJobs: 20,
        activeJobs: 10,
        completedJobs: 160,
        failedJobs: 10,
        throughput: 15.5,
        avgProcessingTime: 145.2,
      },
      memory: {
        heapUsed: 512 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
        heapUsedPercentage: 50,
        rssMB: 256,
        external: 128 * 1024 * 1024,
      },
      system: {
        uptime: 3600,
        loadAverage: [0.5, 0.6, 0.4],
        freeMemoryMB: 4096,
        totalMemoryMB: 8192,
        diskUsage: 65.2,
      },
    };
  }
}

class MockRedisConnectionPool {
  private stats = {
    active: 2,
    idle: 3,
    total: 5,
    commandsProcessed: 1000,
    errors: 5,
    memoryUsed: 50 * 1024 * 1024,
    memoryPeak: 75 * 1024 * 1024,
  };

  public getStats() {
    return this.stats;
  }
}

describe('Visualization System', () => {
  let configService: VisualizationConfigService;
  let dataService: VisualizationDataService;
  let controller: VisualizationController;
  let mockQueueManager: MockQueueManager;
  let mockMonitoringService: MockMonitoringService;
  let mockConnectionPool: MockRedisConnectionPool;

  beforeEach(() => {
    mockQueueManager = new MockQueueManager();
    mockMonitoringService = MockMonitoringService.getInstance() as any;
    mockConnectionPool = new MockRedisConnectionPool();

    configService = new VisualizationConfigService();
    dataService = new VisualizationDataService(
      mockQueueManager as any,
      mockMonitoringService as any,
      mockConnectionPool as any
    );
    controller = new VisualizationController(
      mockQueueManager as any,
      mockMonitoringService as any,
      mockConnectionPool as any
    );
  });

  afterEach(() => {
    if (dataService) {
      dataService.cleanup();
    }
    if (controller) {
      controller.cleanup();
    }
  });

  describe('VisualizationConfigService', () => {
    test('should have default configuration', () => {
      const config = configService.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.refreshInterval).toBe(5000);
      expect(config.features.dashboard).toBe(true);
      expect(config.security.requireAuth).toBe(true);
    });

    test('should update configuration', () => {
      const success = configService.updateConfig({
        enabled: true,
        refreshInterval: 10000,
      });

      expect(success).toBe(true);

      const config = configService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.refreshInterval).toBe(10000);
    });

    test('should validate configuration', () => {
      const validation = configService.validateConfig({
        refreshInterval: 500, // Invalid: too low
        maxDataPoints: 5,    // Invalid: too low
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('刷新间隔必须在1秒到5分钟之间');
      expect(validation.errors).toContain('最大数据点数必须在10到10000之间');
    });

    test('should apply production preset', () => {
      const success = configService.applyPreset('production');
      expect(success).toBe(true);

      const config = configService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.refreshInterval).toBe(30000);
      expect(config.features.realTimeMonitoring).toBe(false);
      expect(config.performance.enableAnimations).toBe(false);
    });

    test('should apply development preset', () => {
      const success = configService.applyPreset('development');
      expect(success).toBe(true);

      const config = configService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.refreshInterval).toBe(1000);
      expect(config.features.realTimeMonitoring).toBe(true);
      expect(config.performance.enableAnimations).toBe(true);
    });

    test('should apply minimal preset', () => {
      const success = configService.applyPreset('minimal');
      expect(success).toBe(true);

      const config = configService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.refreshInterval).toBe(60000);
      expect(config.maxDataPoints).toBe(100);
      expect(config.features.realTimeMonitoring).toBe(false);
      expect(config.features.performanceAnalytics).toBe(false);
    });
  });

  describe('VisualizationDataService', () => {
    test('should collect queue stats', async () => {
      const timestamp = Date.now();
      const stats = await dataService.collectQueueStats(timestamp);

      expect(stats).toHaveLength(2);
      expect(stats[0]).toHaveProperty('queueName');
      expect(stats[0]).toHaveProperty('totalJobs');
      expect(stats[0]).toHaveProperty('throughput');
      expect(stats[0]).toHaveProperty('errorRate');
    });

    test('should collect system stats', async () => {
      const timestamp = Date.now();
      const stats = await dataService.collectSystemStats(timestamp);

      expect(stats).toHaveProperty('timestamp');
      expect(stats).toHaveProperty('cpu');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('eventLoopDelay');
      expect(stats).toHaveProperty('uptime');
    });

    test('should collect Redis stats', async () => {
      const timestamp = Date.now();
      const stats = await dataService.collectRedisStats(timestamp);

      expect(stats).toHaveProperty('timestamp');
      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('operations');
      expect(stats).toHaveProperty('memory');
    });

    test('should get chart data', () => {
      const chartData = dataService.getChartData('system', 'cpu', 10);

      expect(chartData).toHaveProperty('labels');
      expect(chartData).toHaveProperty('datasets');
      expect(chartData.labels).toBeInstanceOf(Array);
      expect(chartData.datasets).toBeInstanceOf(Array);
    });

    test('should subscribe to data updates', () => {
      const updates: any[] = [];
      const unsubscribe = dataService.subscribe('queue', (update) => {
        updates.push(update);
      });

      expect(typeof unsubscribe).toBe('function');
      expect(unsubscribe).not.toThrow();
    });

    test('should get realtime summary', async () => {
      const summary = await dataService.getRealtimeSummary();

      expect(summary).toHaveProperty('timestamp');
      expect(summary).toHaveProperty('queues');
      expect(summary).toHaveProperty('system');
      expect(summary).toHaveProperty('redis');
      expect(summary.queues).toHaveProperty('total');
      expect(summary.queues).toHaveProperty('avgThroughput');
    });
  });

  describe('VisualizationController', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        writeHead: jest.fn(),
        write: jest.fn(),
      };
    });

    test('should get configuration', async () => {
      await controller.getConfig(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });

    test('should update configuration', async () => {
      mockReq.body = {
        enabled: true,
        refreshInterval: 10000,
      };

      await controller.updateConfig(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });

    test('should validate configuration on update', async () => {
      mockReq.body = {
        refreshInterval: 500, // Invalid
        maxDataPoints: 5,    // Invalid
      };

      await controller.updateConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid configuration',
        details: expect.any(Array),
      });
    });

    test('should apply preset', async () => {
      mockReq.body = { preset: 'production' };

      await controller.applyPreset(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          preset: 'production',
          config: expect.any(Object),
        },
      });
    });

    test('should get dashboard data', async () => {
      await controller.getDashboardData(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          summary: expect.any(Object),
          config: expect.any(Object),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should handle disabled features', async () => {
      // Mock config with dashboard disabled
      const controllerConfigService = controller.getConfigService();
      controllerConfigService.updateConfig({
        enabled: true,
        features: {
          dashboard: false,
          realTimeMonitoring: true,
          queueManagement: true,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
      });

      await controller.getDashboardData(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Dashboard feature is disabled',
      });
    });

    test('should get queue stats', async () => {
      mockReq.query = {};

      await controller.getQueueStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.any(Array),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should get system stats', async () => {
      mockReq.query = {};

      await controller.getSystemStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.any(Array),
          config: expect.any(Object),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should get Redis stats', async () => {
      mockReq.query = {};

      await controller.getRedisStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.any(Array),
          poolStats: expect.any(Object),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should get chart data', async () => {
      mockReq.query = {
        type: 'system',
        metric: 'cpu',
        timeRange: '10',
      };

      await controller.getChartData(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          chartData: expect.any(Object),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should validate chart data parameters', async () => {
      mockReq.query = {
        type: 'invalid-type',
        metric: 'cpu',
      };

      await controller.getChartData(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid type. Must be one of: queue, system, redis',
      });
    });

    test('should perform queue action', async () => {
      mockReq.params = { queueName: 'test-queue' };
      mockReq.body = { action: 'stats' };

      await controller.performQueueAction(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          action: 'stats',
          queueName: 'test-queue',
          result: expect.any(Object),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should validate queue action parameters', async () => {
      mockReq.params = { queueName: 'test-queue' };
      mockReq.body = { action: 'invalid-action' };

      await controller.performQueueAction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid action. Must be one of: pause, resume, clear, retry, stats',
      });
    });

    test('should perform health check', async () => {
      await controller.healthCheck(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: expect.any(String),
          enabled: expect.any(Boolean),
          features: expect.any(Object),
          timestamp: expect.any(Number),
        },
      });
    });

    test('should handle errors gracefully', async () => {
      // Enable queueManagement feature for this test
      const controllerConfigService = controller.getConfigService();
      controllerConfigService.updateConfig({
        enabled: true,
        features: {
          dashboard: true,
          realTimeMonitoring: true,
          queueManagement: true,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
      });

      // Mock an error in controller's internal dataService.getQueueHistory
      jest.spyOn(controller['dataService'], 'getQueueHistory').mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await controller.getQueueStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get queue stats',
      });
    });
  });

  describe('Integration Tests', () => {
    test('should start and stop data collection', () => {
      expect(() => {
        dataService.startRealtimeCollection(1000);
        dataService.stopRealtimeCollection();
      }).not.toThrow();
    });

    test('should handle multiple subscribers', () => {
      const updates1: any[] = [];
      const updates2: any[] = [];

      const unsubscribe1 = dataService.subscribe('queue', (update) => updates1.push(update));
      const unsubscribe2 = dataService.subscribe('queue', (update) => updates2.push(update));

      expect(typeof unsubscribe1).toBe('function');
      expect(typeof unsubscribe2).toBe('function');

      unsubscribe1();
      unsubscribe2();
    });

    test('should maintain data history limits', async () => {
      // Start data collection
      dataService.startRealtimeCollection(100);

      // Wait for some data collection
      await new Promise(resolve => setTimeout(resolve, 200));

      // Stop collection
      dataService.stopRealtimeCollection();

      const history = dataService.getSystemHistory();
      expect(history.length).toBeLessThanOrEqual(1000); // Default maxHistorySize
    });

    test('should provide consistent chart data', () => {
      const chartData1 = dataService.getChartData('system', 'cpu', 10);
      const chartData2 = dataService.getChartData('system', 'cpu', 10);

      expect(chartData1.labels).toEqual(chartData2.labels);
      expect(chartData1.datasets).toEqual(chartData2.datasets);
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid data collection', async () => {
      const startTime = Date.now();

      // Perform multiple data collections
      for (let i = 0; i < 10; i++) {
        await dataService.collectAllData();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle multiple chart data requests', () => {
      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        dataService.getChartData('system', 'cpu', 10);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    test('should handle configuration updates efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        configService.updateConfig({
          refreshInterval: 1000 + i * 100,
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Security Tests', () => {
    test('should enforce authentication requirements', () => {
      const config = configService.getConfig();
      expect(config.security.requireAuth).toBe(true);
      expect(config.security.allowedRoles).toContain('admin');
    });

    test('should respect session timeout', () => {
      const config = configService.getConfig();
      expect(config.security.sessionTimeout).toBeGreaterThan(0);
      expect(config.security.sessionTimeout).toBeLessThan(86400000); // Less than 24 hours
    });

    test('should validate feature access', () => {
      const config = configService.getConfig();

      // With default config, only admin and operator should access
      expect(config.security.allowedRoles).toContain('admin');
      expect(config.security.allowedRoles).toContain('operator');
    });
  });

  describe('Error Handling', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        writeHead: jest.fn(),
        write: jest.fn(),
      };
    });

    test('should handle connection pool errors', async () => {
      // Enable systemHealth feature for this test
      const controllerConfigService = controller.getConfigService();
      controllerConfigService.updateConfig({
        enabled: true,
        features: {
          dashboard: true,
          realTimeMonitoring: true,
          queueManagement: true,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
      });

      // Mock connection pool error
      jest.spyOn(mockConnectionPool, 'getStats').mockImplementationOnce(() => {
        throw new Error('Connection pool error');
      });

      await controller.getRedisStats(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    test('should handle queue manager errors', async () => {
      // Enable queueManagement feature for this test
      const controllerConfigService = controller.getConfigService();
      controllerConfigService.updateConfig({
        enabled: true,
        features: {
          dashboard: true,
          realTimeMonitoring: true,
          queueManagement: true,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
      });

      // Mock controller's internal dataService error
      jest.spyOn(controller['dataService'], 'getQueueHistory').mockImplementationOnce(() => {
        throw new Error('Queue manager error');
      });

      await controller.getQueueStats(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    test('should handle monitoring service errors', async () => {
      // Enable dashboard feature for this test
      const controllerConfigService = controller.getConfigService();
      controllerConfigService.updateConfig({
        enabled: true,
        features: {
          dashboard: true,
          realTimeMonitoring: true,
          queueManagement: true,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
      });

      // Mock controller's internal dataService error for getRealtimeSummary
      jest.spyOn(controller['dataService'], 'getRealtimeSummary').mockImplementationOnce(() => {
        throw new Error('Monitoring service error');
      });

      await controller.getDashboardData(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle empty configuration', () => {
      const emptyConfig = new VisualizationConfigService();
      const config = emptyConfig.getConfig();

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('security');
    });

    test('should handle invalid preset', () => {
      const success = configService.applyPreset('invalid' as any);
      expect(success).toBe(false);
    });

    test('should handle boundary values', () => {
      const validation1 = configService.validateConfig({
        refreshInterval: 1000, // Min valid
        maxDataPoints: 10,   // Min valid
      });
      expect(validation1.valid).toBe(true);

      const validation2 = configService.validateConfig({
        refreshInterval: 300000, // Max valid
        maxDataPoints: 10000,  // Max valid
      });
      expect(validation2.valid).toBe(true);
    });
  });
});