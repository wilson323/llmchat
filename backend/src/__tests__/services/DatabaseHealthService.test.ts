/**
 * 数据库健康检查服务测试
 */

import DatabaseHealthService from '@/services/DatabaseHealthService';
import { getPool } from '@/utils/db';
import logger from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/db');
jest.mock('@/utils/logger');

describe('DatabaseHealthService', () => {
  let service: DatabaseHealthService;
  const mockPool = {
    query: jest.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 0,
    options: { max: 50 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getPool as jest.Mock).mockReturnValue(mockPool);
    service = DatabaseHealthService.getInstance();
    // 重置统计数据，确保测试隔离
    service.resetStats();
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] });

      const health = await service.performHealthCheck();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.pool.totalConnections).toBe(10);
      expect(health.pool.idleConnections).toBe(5);
      expect(health.pool.utilizationPercent).toBe(20); // 10/50 = 20%
    });

    it('should handle health check failure', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const health = await service.performHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection failed');
    });

    it('should detect degraded status on high utilization', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] });
      mockPool.totalCount = 45; // 90% utilization

      const health = await service.performHealthCheck();

      expect(health.status).toBe('degraded');
      expect(health.pool.utilizationPercent).toBe(90);
    });
  });

  describe('Query Statistics', () => {
    it('should record successful queries', () => {
      service.recordQuery(50, true);
      service.recordQuery(75, true);
      service.recordQuery(100, true);

      const stats = service.getPerformanceStats();

      expect(stats.totalQueries).toBe(3);
      expect(stats.failedQueries).toBe(0);
      expect(stats.avgQueryTime).toBeGreaterThan(0);
    });

    it('should record failed queries', () => {
      service.recordQuery(50, false);
      service.recordQuery(75, false);

      const stats = service.getPerformanceStats();

      expect(stats.totalQueries).toBe(2);
      expect(stats.failedQueries).toBe(2);
    });

    it('should detect slow queries', () => {
      const slowQueryListener = jest.fn();
      service.on('slowQuery', slowQueryListener);

      service.recordQuery(1500, true); // 超过1000ms阈值

      expect(slowQueryListener).toHaveBeenCalledWith({
        duration: 1500,
      });
    });

    it('should reset statistics', () => {
      service.recordQuery(50, true);
      service.recordQuery(75, true);

      service.resetStats();

      const stats = service.getPerformanceStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.failedQueries).toBe(0);
      expect(stats.avgQueryTime).toBe(0);
    });
  });

  describe('Alert Triggers', () => {
    it('should trigger high utilization alert', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] });
      mockPool.totalCount = 45; // 90% utilization

      const alertListener = jest.fn();
      service.on('highUtilization', alertListener);

      await service.performHealthCheck();

      expect(alertListener).toHaveBeenCalledWith(
        expect.objectContaining({
          utilization: 90,
        })
      );
    });

    it('should trigger high waiting requests alert', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] });
      mockPool.waitingCount = 10;

      const alertListener = jest.fn();
      service.on('highWaitingRequests', alertListener);

      await service.performHealthCheck();

      expect(alertListener).toHaveBeenCalledWith(
        expect.objectContaining({
          waiting: 10,
        })
      );
    });

    it('should trigger critical failure after consecutive failures', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const criticalListener = jest.fn();
      service.on('criticalFailure', criticalListener);

      // 连续失败3次
      await service.performHealthCheck();
      await service.performHealthCheck();
      await service.performHealthCheck();

      expect(criticalListener).toHaveBeenCalledWith(
        expect.objectContaining({
          failures: 3,
        })
      );
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('checkInterval');
      expect(config).toHaveProperty('slowQueryThreshold');
      expect(config).toHaveProperty('utilizationThreshold');
    });

    it('should update configuration', () => {
      service.updateConfig({
        slowQueryThreshold: 500,
        utilizationThreshold: 90,
      });

      const config = service.getConfig();

      expect(config.slowQueryThreshold).toBe(500);
      expect(config.utilizationThreshold).toBe(90);
    });
  });

  describe('Status Queries', () => {
    it('should get health status', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] });

      await service.performHealthCheck();
      const status = service.getHealthStatus();

      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('latency');
      expect(status).toHaveProperty('pool');
      expect(status).toHaveProperty('performance');
    });

    it('should check if service is healthy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health_check: 1 }] });

      await service.performHealthCheck();

      expect(service.isHealthy()).toBe(true);
    });

    it('should return unhealthy when database fails', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      await service.performHealthCheck();

      expect(service.isHealthy()).toBe(false);
    });
  });
});

