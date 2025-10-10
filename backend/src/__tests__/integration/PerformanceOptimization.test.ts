/**
 * 性能优化集成测试
 * 测试缓存、响应优化和数据库性能
 */

import request from 'supertest';
import { app } from '../../index';
import { getCacheService } from '../../services/CacheService';
import { performanceLogger } from '../../utils/StructuredLogger';

describe('Performance Optimization Integration Tests', () => {
  let cacheService: any;

  beforeAll(async () => {
    cacheService = getCacheService();
    await cacheService.connect();
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  describe('Response Optimization', () => {
    it('should set performance headers', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.headers).toHaveProperty('x-response-time');
      expect(response.headers).toHaveProperty('x-server-timestamp');
      expect(response.headers).toHaveProperty('x-cache-status');
    });

    it('should cache GET requests to agent list', async () => {
      // 第一次请求
      const response1 = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response1.headers['x-cache']).toBe('MISS');

      // 第二次请求应该命中缓存
      const response2 = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.body).toEqual(response1.body);
    });

    it('should not cache POST requests', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({ test: 'data' });

      expect(response.headers['x-cache']).toBeUndefined();
    });

    it('should generate ETag for consistent responses', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.headers).toHaveProperty('etag');
      expect(typeof response.headers.etag).toBe('string');
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
      const promises = Array.from({ length: 20 }, () =>
        request(app).get('/api/agents').expect(200)
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // 20个并发请求应该在2秒内完成
    });

    it('should use database indexes effectively', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      // 检查响应时间（索引应该使查询更快）
      const responseTime = parseInt(response.headers['x-response-time'] || '0');
      expect(responseTime).toBeLessThan(500); // 应该在500ms内完成
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during cache operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行大量缓存操作
      for (let i = 0; i < 1000; i++) {
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

  describe('Performance Logging', () => {
    it('should log performance metrics for API calls', async () => {
      // 清除之前的日志
      performanceLogger.clearLogs?.();

      await request(app).get('/api/agents').expect(200);

      // 验证性能日志被记录
      const logs = performanceLogger.getPerformanceLogs?.();
      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThan(0);

      const apiLog = logs.find((log: any) => log.business?.action === 'api_response');
      expect(apiLog).toBeDefined();
      expect(apiLog.business.method).toBe('GET');
      expect(apiLog.business.url).toBe('/api/agents');
      expect(apiLog.duration).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should handle rate limiting efficiently', async () => {
      const clientIp = '192.168.1.100';

      // 快速发送多个请求
      const promises = Array.from({ length: 15 }, () =>
        request(app)
          .get('/api/agents')
          .set('X-Forwarded-For', clientIp)
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const rateLimited = results.filter(r =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && r.value.status === 429)
      ).length;

      expect(successful + rateLimited).toBe(15);
      expect(rateLimited).toBeGreaterThan(0); // 应该有一些请求被限流
    });
  });

  describe('Security Performance Impact', () => {
    it('should handle security middleware efficiently', async () => {
      const maliciousRequest = request(app)
        .post('/api/test')
        .send({
          sql: "SELECT * FROM users",
          xss: "<script>alert('xss')</script>",
          path: "../../../etc/passwd"
        });

      const startTime = Date.now();
      const response = await maliciousRequest;
      const duration = Date.now() - startTime;

      // 安全检查应该在合理时间内完成
      expect(duration).toBeLessThan(100);

      // 恶意请求应该被阻止
      expect([400, 403, 422]).toContain(response.status);
    });
  });
});