/**
 * Simple visualization test focused only on core functionality
 */

import VisualizationConfigService from '../services/VisualizationConfigService';
import VisualizationDataService from '../services/VisualizationDataService';
import { VisualizationController } from '../controllers/VisualizationController';
import { QueueManager } from '../services/QueueManager';
import { MonitoringService } from '../services/MonitoringService';
import { RedisConnectionPool } from '../utils/redisConnectionPool';

describe('Visualization System Simple Tests', () => {
  let configService: VisualizationConfigService;
  let dataService: VisualizationDataService;
  let controller: VisualizationController;
  let mockQueueManager: jest.Mocked<QueueManager>;
  let mockMonitoringService: jest.Mocked<MonitoringService>;
  let mockConnectionPool: jest.Mocked<RedisConnectionPool>;

  beforeEach(() => {
    // Create comprehensive mocks
    mockQueueManager = {
      getInstance: jest.fn(),
      getQueueStats: jest.fn(),
      getSystemStats: jest.fn(),
      getConnectionPool: jest.fn(),
      getAllQueues: jest.fn().mockResolvedValue(['test-queue']),
      getCompletedJobs: jest.fn().mockResolvedValue([]),
      getFailedJobs: jest.fn().mockResolvedValue([]),
      pauseQueue: jest.fn(),
      resumeQueue: jest.fn(),
      clearQueue: jest.fn(),
      retryFailedJobs: jest.fn(),
      queues: new Map(),
      config: {},
      redis: null,
      subscriber: null,
      isProcessing: false,
      isShuttingDown: false,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 10,
      defaultJobOptions: {},
      addJob: jest.fn(),
      process: jest.fn(),
      getJob: jest.fn(),
      removeJob: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clear: jest.fn(),
      getJobs: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
      listenerCount: jest.fn(),
      eventNames: jest.fn(),
      getMaxListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      once: jest.fn(),
    } as any;

    mockMonitoringService = {
      getInstance: jest.fn(),
      getStats: jest.fn(),
      getMetrics: jest.fn(),
      healthCheck: jest.fn(),
      isRunning: true,
      config: {
        enabled: true,
        interval: 1000,
        thresholds: {},
        alerts: {}
      },
      stats: {
        startTime: Date.now(),
        totalMetrics: 0,
        totalAlerts: 0,
        activeAlerts: 0
      },
      metricsHistory: [],
      alertHistory: [],
      activeAlerts: new Map(),
      alertRules: new Map(),
      start: jest.fn(),
      stop: jest.fn(),
      collectMetrics: jest.fn(),
      addAlertRule: jest.fn(),
      removeAlertRule: jest.fn(),
      checkAlerts: jest.fn(),
      getActiveAlerts: jest.fn(),
      getAlertHistory: jest.fn(),
      getMetricsHistory: jest.fn(),
      getRecommendations: jest.fn(),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      listenerCount: jest.fn(),
      eventNames: jest.fn(),
      getMaxListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      once: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      off: jest.fn(),
    } as any;

    mockConnectionPool = {
      getStats: jest.fn(),
      getConnection: jest.fn(),
      releaseConnection: jest.fn(),
      healthCheck: jest.fn(),
      close: jest.fn(),
      config: {},
      stats: {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingClients: 0
      }
    } as any;

    configService = new VisualizationConfigService();
    dataService = new VisualizationDataService(mockQueueManager, mockMonitoringService, mockConnectionPool);
    controller = new VisualizationController(mockQueueManager, mockMonitoringService, mockConnectionPool);

    // Enable all features for testing
    configService.updateConfig({
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
  });

  describe('VisualizationConfigService', () => {
    test('should have default configuration', () => {
      const config = configService.getConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('refreshInterval');
      expect(config.enabled).toBe(true);
    });

    test('should update configuration', () => {
      const newConfig = { refreshInterval: 2000 };
      const success = configService.updateConfig(newConfig);
      expect(success).toBe(true);

      const config = configService.getConfig();
      expect(config.refreshInterval).toBe(2000);
    });

    test('should validate configuration', () => {
      const invalidConfig = { refreshInterval: -1 };
      const validation = configService.validateConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      // Error message is in Chinese, so we just check that there is an error
    });
  });

  describe('VisualizationDataService', () => {
    test('should collect queue stats', async () => {
      mockQueueManager.getQueueStats.mockResolvedValue({
        name: 'test-queue',
        status: 'active' as any,
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 0,
        paused: false,
        processing: 2,
        concurrency: 2,
        maxConcurrency: 10,
        throughput: 1.5,
        avgProcessingTime: 150,
        errorRate: 0.03,
        createdAt: new Date(),
      });

      const timestamp = Date.now();
      const stats = await dataService.collectQueueStats(timestamp);

      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBe(1);
      expect(stats[0]).toHaveProperty('queueName', 'test-queue');
      expect(stats[0]).toHaveProperty('timestamp', timestamp);
      expect(mockQueueManager.getQueueStats).toHaveBeenCalled();
    });

    test('should collect system stats', async () => {
      const timestamp = Date.now();
      const stats = await dataService.collectSystemStats(timestamp);

      expect(stats).toHaveProperty('timestamp', timestamp);
      expect(stats).toHaveProperty('cpu');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('uptime');
    });

    test('should collect Redis stats', async () => {
      mockConnectionPool.getStats.mockReturnValue({
        total: 10,
        active: 3,
        idle: 7,
        waiting: 0,
        errors: 0,
        avgResponseTime: 5.2,
      });

      const timestamp = Date.now();
      const stats = await dataService.collectRedisStats(timestamp);

      expect(stats).toHaveProperty('timestamp', timestamp);
      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('operations');
      expect(mockConnectionPool.getStats).toHaveBeenCalled();
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
        data: expect.objectContaining({
          enabled: true,
          features: expect.any(Object),
        }),
      });
    });

    test('should handle disabled features', async () => {
      // Disable queueManagement feature
      controller.getConfigService().updateConfig({
        enabled: true,
        features: {
          dashboard: true,
          realTimeMonitoring: true,
          queueManagement: false,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
      });

      await controller.getQueueStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Queue management feature is disabled',
      });
    });

    test('should handle errors properly', async () => {
      // Force an error by making the controller's dataService throw an error
      jest.spyOn(controller['dataService'], 'getQueueHistory').mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      // Enable the feature to allow the method to execute
      controller.getConfigService().updateConfig({
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

      await controller.getQueueStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get queue stats',
      });
    });

    test('should perform health check', async () => {
      await controller.healthCheck(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: expect.any(String),
          enabled: true,
          features: expect.any(Object),
          timestamp: expect.any(Number),
        }),
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

    test('should subscribe to data updates', () => {
      const updates: any[] = [];
      const unsubscribe = dataService.subscribe('test', (update: any) => updates.push(update));

      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
    });
  });
});