/**
 * QueueManager 集成测试
 * 验证重构后的QueueManager与专门服务类的集成
 */

import request from 'supertest';
import express from 'express';
import { createTestApp, setupTestDatabase, cleanupTestDatabase } from '../testUtils';
import QueueManager from '../../services/QueueManager';
import { QueueOperationsService } from '../../services/QueueOperationsService';
import { QueueStatsService } from '../../services/QueueStatsService';
import { QueueHealthService } from '../../services/QueueHealthService';
import { QueueMonitoringService } from '../../services/QueueMonitoringService';
import Redis from 'ioredis';
import type { QueueConfig, MessagePriority } from '../../types/queue';

// 辅助函数：创建完整的QueueConfig
function createQueueConfig(name: string, partial: Partial<QueueConfig> = {}): QueueConfig {
  return {
    name,
    concurrency: partial.concurrency || 5,
    maxRetries: partial.maxRetries || 3,
    retryDelay: partial.retryDelay || 1000,
    backoffMultiplier: partial.backoffMultiplier || 2,
    removeOnComplete: partial.removeOnComplete || 100,
    removeOnFail: partial.removeOnFail || 50,
    defaultPriority: (partial.defaultPriority || 5) as MessagePriority,
    stalledInterval: partial.stalledInterval || 30000,
    maxStalledCount: partial.maxStalledCount || 3,
    delayOnFail: partial.delayOnFail !== undefined ? partial.delayOnFail : false,
    deadLetterQueue: partial.deadLetterQueue,
    paused: partial.paused,
    visibilityTimeout: partial.visibilityTimeout || 30000,
  };
}

describe('QueueManager Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let testDb: any;
  let redis: Redis;
  let queueManager: QueueManager;
  let queueOpsService: QueueOperationsService;
  let queueStatsService: QueueStatsService;
  let queueHealthService: QueueHealthService;
  let queueMonitoringService: QueueMonitoringService;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp();

    // 初始化Redis连接
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/1');

    // 初始化服务
    queueOpsService = new QueueOperationsService(redis);
    queueStatsService = new QueueStatsService(redis);
    queueHealthService = new QueueHealthService(redis, queueOpsService, queueStatsService);
    queueMonitoringService = new QueueMonitoringService(
      redis,
      queueStatsService,
      queueHealthService
    );

    queueManager = QueueManager.getInstance({
      redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // 获取测试认证token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // 清理测试数据
    await redis.flushdb();
    await redis.quit();
    await cleanupTestDatabase(testDb);
  });

  beforeEach(async () => {
    // 每个测试前清理队列数据
    await redis.flushdb();
  });

  describe('Queue Operations Integration', () => {
    const testQueueName = 'test-integration-queue';

    beforeEach(async () => {
      // 创建测试队列
      queueManager.createQueue(createQueueConfig(testQueueName, {
        concurrency: 5,
        maxRetries: 3,
        retryDelay: 1000,
      }));
    });

    afterEach(async () => {
      // 清理测试队列（QueueManager没有delete方法，清理Redis数据即可）
      await redis.del(`queue:${testQueueName}:*`);
    });

    it('should handle complete job lifecycle', async () => {
      const jobData = { message: 'test job data', timestamp: Date.now() };

      // 1. 添加作业
      const jobId = await queueOpsService.addJob(testQueueName, jobData, {
        priority: MessagePriority.NORMAL,
        maxAttempts: 3,
      });
      expect(jobId).toBeTruthy();

      // 2. 获取作业
      const job = await queueOpsService.getJob(testQueueName, jobId);
      expect(job).toBeTruthy();
      expect(job!.data).toEqual(jobData);
      expect(job!.status).toBe('waiting');

      // 3. 获取并处理作业
      const acquiredJob = await queueOpsService.acquireJob(testQueueName);
      expect(acquiredJob).toBeTruthy();
      expect(acquiredJob!.id).toBe(jobId);
      expect(acquiredJob!.status).toBe('active');

      // 4. 完成作业
      const result = await queueOpsService.releaseJob(testQueueName, jobId, {
        success: true,
        processedAt: new Date(),
      });
      expect(result).toBe(true);

      // 5. 验证作业状态
      const completedJob = await queueOpsService.getJob(testQueueName, jobId);
      expect(completedJob).toBeTruthy();
      expect(completedJob!.status).toBe('completed');
    });

    it('should handle job failure and retry', async () => {
      const jobData = { message: 'failing job' };

      // 添加作业
      const jobId = await queueOpsService.addJob(testQueueName, jobData, {
        maxAttempts: 2,
      });

      // 获取作业
      const job = await queueOpsService.acquireJob(testQueueName);
      expect(job).toBeTruthy();

      // 模拟处理失败
      const result = await queueOpsService.releaseJob(testQueueName, jobId, undefined, 'Processing failed');
      expect(result).toBe(true);

      // 验证作业状态和重试次数
      const failedJob = await queueOpsService.getJob(testQueueName, jobId);
      expect(failedJob).toBeTruthy();
      expect(failedJob!.status).toBe('failed');
      expect(failedJob!.attemptsMade).toBe(1);

      // 增加重试次数
      await queueOpsService.incrementJobAttempts(testQueueName, jobId);

      const retriedJob = await queueOpsService.getJob(testQueueName, jobId);
      expect(retriedJob!.attemptsMade).toBe(2);
    });

    it('should handle delayed jobs', async () => {
      const jobData = { message: 'delayed job' };
      const delay = 5000; // 5秒延迟

      // 添加延迟作业
      const jobId = await queueOpsService.addJob(testQueueName, jobData, {
        delay,
      });

      // 验证作业在延迟队列中
      const job = await queueOpsService.getJob(testQueueName, jobId);
      expect(job).toBeTruthy();
      expect(job!.scheduledAt).toBeInstanceOf(Date);

      // 尝试获取作业（应该为空，因为还在延迟中）
      const nextJob = await queueOpsService.getNextJob(testQueueName);
      expect(nextJob).toBeNull();

      // 手动移动到等待队列（模拟延迟时间到达）
      await redis.zrem(`${testQueueName}:delayed`, jobId);
      await redis.zadd(`${testQueueName}:waiting`, Date.now(), jobId);

      // 现在应该能获取到作业
      const availableJob = await queueOpsService.getNextJob(testQueueName);
      expect(availableJob).toBeTruthy();
      expect(availableJob!.id).toBe(jobId);
    });
  });

  describe('Queue Statistics Integration', () => {
    const testQueueName = 'test-stats-queue';

    beforeEach(async () => {
      queueManager.createQueue(createQueueConfig(testQueueName, {
        concurrency: 3,
      }));
    });

    afterEach(async () => {
      // 清理测试队列（QueueManager没有delete方法，清理Redis数据即可）
      await redis.del(`queue:${testQueueName}:*`);
    });

    it('should provide accurate queue statistics', async () => {
      // 添加测试作业
      const jobIds = [];
      for (let i = 0; i < 10; i++) {
        const jobId = await queueOpsService.addJob(testQueueName, {
          index: i,
          data: `test data ${i}`,
        });
        jobIds.push(jobId);
      }

      // 获取统计信息
      const stats = await queueStatsService.getQueueStats(testQueueName);
      expect(stats).toBeTruthy();
      expect(stats!.queueName).toBe(testQueueName);
      expect(stats!.total).toBe(10);
      expect(stats!.waiting).toBe(10);
      expect(stats!.active).toBe(0);
      expect(stats!.completed).toBe(0);
      expect(stats!.failed).toBe(0);

      // 处理一些作业
      const processedJobs = [];
      for (let i = 0; i < 5; i++) {
        const job = await queueOpsService.acquireJob(testQueueName);
        if (job) {
          await queueOpsService.releaseJob(testQueueName, job.id, { processed: true });
          processedJobs.push(job);
        }
      }

      // 重新获取统计信息
      const updatedStats = await queueStatsService.getQueueStats(testQueueName);
      expect(updatedStats!.total).toBe(10);
      expect(updatedStats!.waiting).toBe(5);
      expect(updatedStats!.active).toBe(0);
      expect(updatedStats!.completed).toBe(5);
      expect(updatedStats!.failed).toBe(0);
      expect(updatedStats!.throughput).toBeGreaterThanOrEqual(0);
      expect(updatedStats!.avgProcessingTime).toBeGreaterThanOrEqual(0);
      expect(updatedStats!.errorRate).toBe(0);
    });

    it('should calculate performance metrics correctly', async () => {
      // 添加具有不同处理时间的作业
      const fastJobId = await queueOpsService.addJob(testQueueName, { type: 'fast' });
      const slowJobId = await queueOpsService.addJob(testQueueName, { type: 'slow' });

      // 处理快速作业
      const fastJob = await queueOpsService.acquireJob(testQueueName);
      if (fastJob) {
        // 模拟快速处理
        await new Promise(resolve => setTimeout(resolve, 10));
        await queueOpsService.releaseJob(testQueueName, fastJob.id, { fast: true });
      }

      // 处理慢速作业
      const slowJob = await queueOpsService.acquireJob(testQueueName);
      if (slowJob) {
        // 模拟慢速处理
        await new Promise(resolve => setTimeout(resolve, 100));
        await queueOpsService.releaseJob(testQueueName, slowJob.id, { slow: true });
      }

      // 获取性能指标
      const stats = await queueStatsService.getQueueStats(testQueueName);
      expect(stats).toBeTruthy();
      expect(stats!.completed).toBe(2);
      expect(stats!.avgProcessingTime).toBeGreaterThan(0);
      expect(stats!.throughput).toBeGreaterThan(0);
    });

    it('should handle priority distribution', async () => {
      // 添加不同优先级的作业
      await queueOpsService.addJob(testQueueName, { priority: MessagePriority.LOW }, { priority: MessagePriority.LOW });
      await queueOpsService.addJob(testQueueName, { priority: MessagePriority.NORMAL }, { priority: MessagePriority.NORMAL });
      await queueOpsService.addJob(testQueueName, { priority: MessagePriority.HIGH }, { priority: MessagePriority.HIGH });
      await queueOpsService.addJob(testQueueName, { priority: MessagePriority.CRITICAL }, { priority: MessagePriority.CRITICAL });

      const distribution = await queueStatsService.getPriorityDistribution(testQueueName);
      expect(distribution).toHaveProperty(MessagePriority.LOW);
      expect(distribution).toHaveProperty(MessagePriority.NORMAL);
      expect(distribution).toHaveProperty(MessagePriority.HIGH);
      expect(distribution).toHaveProperty(MessagePriority.CRITICAL);
      expect(distribution[MessagePriority.LOW]).toBe(1);
      expect(distribution[MessagePriority.NORMAL]).toBe(1);
      expect(distribution[MessagePriority.HIGH]).toBe(1);
      expect(distribution[MessagePriority.CRITICAL]).toBe(1);
    });
  });

  describe('Queue Health Monitoring Integration', () => {
    const testQueueName = 'test-health-queue';

    beforeEach(async () => {
      queueManager.createQueue(createQueueConfig(testQueueName));
    });

    afterEach(async () => {
      // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
    });

    it('should perform comprehensive health checks', async () => {
      const healthStatus = await queueHealthService.performHealthCheck(
        testQueueName,
        createQueueConfig(testQueueName, {
          concurrency: 2,
          maxRetries: 3,
          retryDelay: 1000,
          visibilityTimeout: 30000,
        })
      );

      expect(healthStatus).toBeTruthy();
      expect(healthStatus.queueName).toBe(testQueueName);
      expect(healthStatus.healthy).toBe(true);
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.checks).toBeDefined();
      expect(healthStatus.metrics).toBeDefined();

      // 验证各项检查
      expect(healthStatus.checks.queueSize).toBe('pass');
      expect(healthStatus.checks.processingTime).toBe('pass');
      expect(healthStatus.checks.errorRate).toBe('pass');
      expect(healthStatus.checks.memoryUsage).toBe('pass');
      expect(healthStatus.checks.redisConnection).toBe('pass');
      expect(healthStatus.checks.staleJobs).toBe('pass');
      expect(healthStatus.checks.deadlockDetection).toBe('pass');
      expect(healthStatus.checks.queueConfiguration).toBe('pass');
    });

    it('should detect queue size issues', async () => {
      // 添加大量作业（超过健康阈值）
      const maxQueueSize = 5;
      for (let i = 0; i < maxQueueSize + 2; i++) {
        await queueOpsService.addJob(testQueueName, { index: i });
      }

      const healthStatus = await queueHealthService.performHealthCheck(
        testQueueName,
        createQueueConfig(testQueueName, {
          concurrency: 2,
          maxRetries: 3,
        })
      );

      expect(healthStatus.healthy).toBe(false);
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.issues).toBeDefined();
      expect(healthStatus.issues!.some(issue =>
        issue.includes('队列大小超限')
      )).toBe(true);
    });

    it('should detect stale jobs', async () => {
      // 添加作业并手动设置为过期状态
      const jobId = await queueOpsService.addJob(testQueueName, { stale: true });

      // 手动将作业添加到等待队列并设置过期时间戳
      const staleTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25小时前
      await redis.zadd(`${testQueueName}:waiting`, staleTimestamp, jobId);

      const healthStatus = await queueHealthService.performHealthCheck(testQueueName, createQueueConfig(testQueueName));

      expect(healthStatus.issues).toBeDefined();
      expect(healthStatus.issues!.some(issue =>
        issue.includes('过期作业')
      )).toBe(true);
    });

    it('should handle batch health checks', async () => {
      const queueNames = [testQueueName, `${testQueueName}-2`];

      // 创建第二个队列
      queueManager.createQueue(createQueueConfig(queueNames[1]));

      const batchHealthStatus = await queueHealthService.performBatchHealthCheck(queueNames, {
        [queueNames[0]]: { concurrency: 2 },
        [queueNames[1]]: { concurrency: 1 },
      });

      expect(batchHealthStatus).toHaveProperty(queueNames[0]);
      expect(batchHealthStatus).toHaveProperty(queueNames[1]);
      expect(Object.keys(batchHealthStatus)).toHaveLength(2);

      // 清理第二个队列
      // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
    });
  });

  describe('Queue Monitoring Integration', () => {
    const testQueueName = 'test-monitoring-queue';

    beforeEach(async () => {
      queueManager.createQueue(createQueueConfig(testQueueName));
    });

    afterEach(async () => {
      await queueMonitoringService.stopMonitoring(testQueueName);
      // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
    });

    it('should collect and monitor queue metrics', async () => {
      // 开始监控
      queueMonitoringService.startMonitoring(testQueueName, createQueueConfig(testQueueName));

      // 添加一些作业
      const jobIds = [];
      for (let i = 0; i < 5; i++) {
        const jobId = await queueOpsService.addJob(testQueueName, { index: i });
        jobIds.push(jobId);
      }

      // 手动收集指标
      const metrics = await queueMonitoringService.collectQueueMetrics(testQueueName, createQueueConfig(testQueueName));

      expect(metrics).toBeTruthy();
      expect(metrics.queueName).toBe(testQueueName);
      expect(metrics.stats).toBeDefined();
      expect(metrics.healthStatus).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.trends).toBeDefined();
      expect(metrics.alerts).toBeDefined();

      // 验证性能指标
      expect(metrics.performance.throughput).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.avgProcessingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.p95ProcessingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.p99ProcessingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.memoryUsage).toBeLessThanOrEqual(1);
    });

    it('should trigger alerts for threshold violations', async () => {
      // 配置低阈值以触发告警
      queueMonitoringService.startMonitoring(testQueueName, {
        concurrency: 3,
        maxRetries: 2,
      }, {
        alertThresholds: {
          queueSize: 3, // 低阈值
          errorRate: 0.1,
          processingTime: 30000,
          memoryUsage: 0.8,
        },
      });

      // 添加超过阈值的作业
      for (let i = 0; i < 5; i++) {
        await queueOpsService.addJob(testQueueName, { index: i });
      }

      // 手动收集指标以触发告警
      await queueMonitoringService.collectQueueMetrics(testQueueName, createQueueConfig(testQueueName));

      const alerts = queueMonitoringService.getCurrentAlerts(testQueueName);
      expect(alerts.length).toBeGreaterThan(0);

      const queueSizeAlert = alerts.find(alert => alert.type === 'queue_size');
      expect(queueSizeAlert).toBeTruthy();
      expect(queueSizeAlert!.severity).toBe('warning');
      expect(queueSizeAlert!.message).toContain('队列大小过大');
    });

    it('should maintain metrics history', async () => {
      queueMonitoringService.startMonitoring(testQueueName, createQueueConfig(testQueueName));

      // 多次收集指标
      for (let i = 0; i < 3; i++) {
        await queueOpsService.addJob(testQueueName, { iteration: i });
        await queueMonitoringService.collectQueueMetrics(testQueueName, createQueueConfig(testQueueName));

        // 短暂延迟以确保不同的时间戳
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const history = queueMonitoringService.getMetricsHistory(testQueueName);
      expect(history.length).toBeGreaterThan(0);

      // 验证时间顺序
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
      }

      // 测试时间范围过滤
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentHistory = queueMonitoringService.getMetricsHistory(testQueueName, {
        start: new Date(oneMinuteAgo),
        end: new Date(now),
      });

      expect(recentHistory.length).toBeGreaterThan(0);
      expect(recentHistory.length).toBeLessThanOrEqual(history.length);
    });
  });

  describe('API Integration Tests', () => {
    describe('GET /api/queue/stats/:queueName', () => {
      it('should return queue statistics', async () => {
        const queueName = 'test-api-stats';
        queueManager.createQueue(createQueueConfig(queueName);

        // 添加测试作业
        await queueOpsService.addJob(queueName));

        const response = await request(app)
          .get(`/api/queue/stats/${queueName}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('queueName', queueName);
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('waiting');
        expect(response.body.data).toHaveProperty('active');
        expect(response.body.data).toHaveProperty('completed');
        expect(response.body.data).toHaveProperty('failed');

        // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
      });
    });

    describe('GET /api/queue/health/:queueName', () => {
      it('should return queue health status', async () => {
        const queueName = 'test-api-health';
        await queueManager.createQueue(createQueueConfig(queueName));

        const response = await request(app)
          .get(`/api/queue/health/${queueName}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('queueName', queueName);
        expect(response.body.data).toHaveProperty('healthy');
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('checks');
        expect(response.body.data).toHaveProperty('metrics');

        // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
      });
    });

    describe('POST /api/queue/:queueName/pause', () => {
      it('should pause queue processing', async () => {
        const queueName = 'test-api-pause';
        await queueManager.createQueue(createQueueConfig(queueName));

        const response = await request(app)
          .post(`/api/queue/${queueName}/pause`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toContain('队列已暂停');

        // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
      });
    });

    describe('POST /api/queue/:queueName/resume', () => {
      it('should resume queue processing', async () => {
        const queueName = 'test-api-resume';
        await queueManager.createQueue(createQueueConfig(queueName));

        // 先暂停
        await request(app)
          .post(`/api/queue/${queueName}/pause`)
          .set('Authorization', `Bearer ${authToken}`);

        // 然后恢复
        const response = await request(app)
          .post(`/api/queue/${queueName}/resume`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toContain('队列已恢复');

        // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
      });
    });

    describe('POST /api/queue/:queueName/clear', () => {
      it('should clear queue', async () => {
        const queueName = 'test-api-clear';
        queueManager.createQueue(createQueueConfig(queueName);

        // 添加作业
        await queueOpsService.addJob(queueName));
        await queueOpsService.addJob(queueName, { test: true });

        // 清空队列
        const response = await request(app)
          .post(`/api/queue/${queueName}/clear`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toContain('队列已清空');

        // 验证队列已清空
        const stats = await queueStatsService.getQueueStats(queueName);
        expect(stats!.total).toBe(0);

        // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent queue gracefully', async () => {
      const nonExistentQueue = 'non-existent-queue';

      // 统计信息应该返回null
      const stats = await queueStatsService.getQueueStats(nonExistentQueue);
      expect(stats).toBeNull();

      // 健康检查应该返回不健康状态
      const healthStatus = await queueHealthService.performHealthCheck(nonExistentQueue);
      expect(healthStatus.healthy).toBe(false);
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.issues).toContain('队列不存在');

      // API端点应该返回404
      await request(app)
        .get(`/api/queue/stats/${nonExistentQueue}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle Redis connection failures', async () => {
      // 创建一个无效的Redis连接
      const invalidRedis = new Redis('redis://invalid-host:6379/2');
      const invalidQueueOps = new QueueOperationsService(invalidRedis);

      await expect(invalidQueueOps.addJob('test', {})).rejects.toThrow();
      await invalidRedis.quit();
    });

    it('should handle malformed job data', async () => {
      const queueName = 'test-malformed';
      queueManager.createQueue(createQueueConfig(queueName);

      // 添加正常作业
      const jobId = await queueOpsService.addJob(queueName));

      // 手动破坏作业数据
      await redis.hset(`${queueName}:jobs`, jobId, 'invalid json');

      // 尝试获取作业应该优雅处理
      const job = await queueOpsService.getJob(queueName, jobId);
      expect(job).toBeNull();

      // QueueManager没有delete方法，清理将在afterEach/afterAll中统一进行
    });
  });
});