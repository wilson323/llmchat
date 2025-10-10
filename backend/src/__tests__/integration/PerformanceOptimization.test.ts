/**
 * 性能优化集成测试
 * 测试缓存、响应优化和数据库性能（使用Mock Redis）
 */

import request from 'supertest';
import { app } from '../../index';
import { TestCacheService } from '../services/TestCacheService';

describe('Performance Optimization Integration Tests', () => {
  let cacheService: TestCacheService;

  beforeAll(async () => {
    // 创建测试专用的缓存服务
    cacheService = new TestCacheService();
    await cacheService.connect();

    console.log('✅ 测试缓存服务设置完成，开始性能优化集成测试');
  });

  beforeEach(() => {
    // 清空缓存数据
    cacheService.clear();
  });

  afterAll(async () => {
    if (cacheService) {
      await cacheService.disconnect();
    }
  });

  describe('Response Optimization', () => {
    it('should set performance headers', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      // 检查性能头是否存在
      expect(response.headers).toHaveProperty('x-response-time');
      expect(response.headers).toHaveProperty('x-server-timestamp');
    });

    it('should generate consistent responses', async () => {
      // 第一次请求
      const response1 = await request(app)
        .get('/api/agents')
        .expect(200);

      // 第二次请求应该返回一致的数据
      const response2 = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response2.body).toEqual(response1.body);
    });

    it('should not cache POST requests', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({ test: 'data' });

      expect(response.headers['x-cache']).toBeUndefined();
    });

    it('should respond within reasonable time', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      // 检查响应时间头（如果存在）
      if (response.headers['x-response-time']) {
        const responseTime = parseInt(response.headers['x-response-time'] || '0');
        expect(responseTime).toBeLessThan(1000); // 应该在1秒内完成
      }
    });
  });

  describe('Cache Service Performance', () => {
    const testData = { id: 1, name: 'test', data: 'x'.repeat(1000) };

    it('should cache and retrieve data efficiently', async () => {
      const startTime = Date.now();

      // 设置缓存
      await cacheService.set('test-key', testData, { ttl: 60 });
      const setTime = Date.now() - startTime;

      // 获取缓存
      const getStartTime = Date.now();
      const cachedData = await cacheService.get('test-key');
      const getTime = Date.now() - getStartTime;

      expect(cachedData).toEqual(testData);
      expect(setTime).toBeLessThan(100); // 应该在100ms内完成
      expect(getTime).toBeLessThan(50);  // 获取应该更快
    });

    it('should handle concurrent cache operations', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        cacheService.set(`concurrent-${i}`, { id: i }, { ttl: 60 })
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // 100个并发操作应该在1秒内完成

      // 验证所有数据都被正确缓存
      for (let i = 0; i < 100; i++) {
        const data = await cacheService.get(`concurrent-${i}`);
        expect(data).toEqual({ id: i });
      }
    });

    it('should maintain good cache hit rate', async () => {
      // 预热缓存
      for (let i = 0; i < 50; i++) {
        await cacheService.set(`hitrate-${i}`, { data: `value-${i}` });
      }

      // 测试命中率
      let hits = 0;
      for (let i = 0; i < 100; i++) {
        const key = `hitrate-${Math.floor(Math.random() * 50)}`;
        const data = await cacheService.get(key);
        if (data) hits++;
      }

      const stats = cacheService.getStats();
      expect(stats.hitRate).toBeGreaterThan(50); // 至少50%命中率
    });
  });

  describe('Database Performance', () => {
    it('should handle concurrent database queries efficiently', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/agents').expect(200)
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 10个并发请求应该在5秒内完成
    });

    it('should respond within acceptable time limits', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      // 检查响应时间（索引应该使查询更快）
      if (response.headers['x-response-time']) {
        const responseTime = parseInt(response.headers['x-response-time'] || '0');
        expect(responseTime).toBeLessThan(2000); // 应该在2秒内完成
      }
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during cache operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行大量缓存操作
      for (let i = 0; i < 100; i++) {
        await cacheService.set(`memory-test-${i}`, { data: 'x'.repeat(100) }, { ttl: 1 });
        await cacheService.get(`memory-test-${i}`);
        await cacheService.del(`memory-test-${i}`);
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该小于10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Security Performance Impact', () => {
    it('should handle security middleware efficiently', async () => {
      const startTime = Date.now();

      // 测试正常请求的安全性检查性能
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const duration = Date.now() - startTime;

      // 安全检查应该在合理时间内完成
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cache Integration', () => {
    it('should work with mock cache in integration tests', async () => {
      // 验证缓存服务正常工作
      await cacheService.set('integration-test', { message: 'test' });
      const result = await cacheService.get('integration-test');

      expect(result).toEqual({ message: 'test' });

      // 验证统计信息
      const stats = cacheService.getStats();
      expect(stats.sets).toBe(1);
      expect(stats.hits).toBe(1);
    });

    it('should handle cache operations gracefully', async () => {
      // 测试正常缓存操作
      await cacheService.set('test-key', 'test-value');
      const result = await cacheService.get('test-key');
      expect(result).toEqual('test-value');

      // 测试不存在的键
      const nonExistent = await cacheService.get('non-existent-key');
      expect(nonExistent).toBeNull();

      // 测试删除操作
      const deleted = await cacheService.del('test-key');
      expect(deleted).toBe(1);

      const afterDelete = await cacheService.get('test-key');
      expect(afterDelete).toBeNull();
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache performance metrics', async () => {
      // 执行一些缓存操作
      await cacheService.set('metric-test-1', { data: 'test1' });
      await cacheService.set('metric-test-2', { data: 'test2' });
      await cacheService.get('metric-test-1');
      await cacheService.get('metric-test-2');
      await cacheService.get('non-existent-key');

      const stats = cacheService.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(2);
      expect(stats.hitRate).toBe(66.67); // 2/3 * 100

      console.log(`📊 Performance Metrics:`, stats);
    });

    it('should provide cache health information', async () => {
      const health = await cacheService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'down']).toContain(health.status);
      expect(health.details).toHaveProperty('stats');
      expect(health.details).toHaveProperty('redisConnected');

      console.log(`📊 Cache Health:`, health);
    });
  });
});