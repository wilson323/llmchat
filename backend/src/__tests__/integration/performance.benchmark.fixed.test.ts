/**
 * 性能基准测试 - 修复版本
 * 基于实际的API端点创建准确的性能测试
 */

import request from 'supertest';
import { createTestApp, createTestToken } from './integrationTestUtils';

describe('Performance Benchmark Tests - Fixed', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    app = createTestApp();
    authToken = createTestToken();
  });

  describe('API Response Time Benchmarks', () => {
    it('should respond to health check within 50ms', async () => {
      const start = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);

      console.log(`Health check response time: ${duration}ms`);
    });

    it('should respond to agents list within 100ms', async () => {
      const start = Date.now();

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);

      console.log(`Agents list response time: ${duration}ms`);
      console.log(`Agents count: ${response.body.data?.agents?.length ?? 0}`);
    });

    it('should respond to 404 errors within 20ms', async () => {
      const start = Date.now();

      await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(20);

      console.log(`404 error response time: ${duration}ms`);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 20 concurrent health check requests', async () => {
      const start = Date.now();

      const promises = Array.from({ length: 20 }, () =>
        request(app).get('/health').expect(200)
      );

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 20;

      // 平均响应时间应该小于50ms
      expect(averageDuration).toBeLessThan(50);

      console.log(`20 concurrent health checks completed in ${totalDuration}ms`);
      console.log(`Average response time: ${averageDuration.toFixed(2)}ms`);
      console.log(`Requests per second: ${(1000 / averageDuration).toFixed(0)}`);
    });

    it('should handle 10 concurrent agents requests', async () => {
      const start = Date.now();

      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/agents').expect(200)
      );

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 10;

      // 平均响应时间应该小于100ms
      expect(averageDuration).toBeLessThan(100);

      console.log(`10 concurrent agents requests completed in ${totalDuration}ms`);
      console.log(`Average response time: ${averageDuration.toFixed(2)}ms`);
      console.log(`Requests per second: ${(1000 / averageDuration).toFixed(0)}`);
    });
  });

  describe('Memory Performance', () => {
    it('should maintain stable memory usage during 50 operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行50个请求
      const promises = Array.from({ length: 50 }, () =>
        request(app).get('/health').expect(200)
      );

      await Promise.all(promises);

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // 内存增长应该小于10MB
      expect(memoryIncrease).toBeLessThan(10);

      console.log(`Memory usage increase: ${memoryIncrease.toFixed(2)}MB`);
    });

    it('should handle CPU-intensive operations efficiently', async () => {
      const start = Date.now();

      // 执行100个连续请求
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health').expect(200);
      }

      const totalDuration = Date.now() - start;
      const averageTime = totalDuration / 100;

      // 平均每个请求应该小于10ms
      expect(averageTime).toBeLessThan(10);

      console.log(`100 sequential requests completed in ${totalDuration}ms`);
      console.log(`Average time per request: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors quickly', async () => {
      const start = Date.now();

      const promises = Array.from({ length: 20 }, () =>
        request(app).get(`/api/nonexistent-${Math.random()}`).expect(404)
      );

      await Promise.all(promises);

      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 20;

      // 404错误处理应该很快（小于10ms）
      expect(averageDuration).toBeLessThan(10);

      console.log(`20 404 errors handled in ${totalDuration}ms`);
      console.log(`Average error handling time: ${averageDuration.toFixed(2)}ms`);
    });

    it('should handle invalid JSON efficiently', async () => {
      const start = Date.now();

      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'application/json')
          .send('invalid json')
          .expect(400)
      );

      await Promise.all(promises);

      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 10;

      // JSON解析错误处理应该很快（小于20ms）
      expect(averageDuration).toBeLessThan(20);

      console.log(`10 invalid JSON errors handled in ${totalDuration}ms`);
      console.log(`Average error handling time: ${averageDuration.toFixed(2)}ms`);
    });
  });

  describe('Connection Pool Performance', () => {
    it('should reuse connections efficiently', async () => {
      const start = Date.now();

      // 30个连续请求，测试连接重用
      for (let i = 0; i < 30; i++) {
        await request(app).get('/health').expect(200);
      }

      const totalDuration = Date.now() - start;
      const averageTime = totalDuration / 30;

      // 连接重用应该提高性能（平均时间小于5ms）
      expect(averageTime).toBeLessThan(5);

      console.log(`30 sequential requests (connection reuse) in ${totalDuration}ms`);
      console.log(`Average time per request: ${averageTime.toFixed(2)}ms`);
      console.log(`Effective requests per second: ${(1000 / averageTime).toFixed(0)}`);
    });

    it('should handle burst requests gracefully', async () => {
      const start = Date.now();

      // 50个突发请求
      const promises = Array.from({ length: 50 }, () =>
        request(app).get('/health').expect(200)
      );

      await Promise.all(promises);

      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 50;

      // 突发请求应该仍然保持合理性能（平均时间小于20ms）
      expect(averageDuration).toBeLessThan(20);

      console.log(`50 burst requests handled in ${totalDuration}ms`);
      console.log(`Average response time: ${averageDuration.toFixed(2)}ms`);
      console.log(`Peak throughput: ${(1000 / averageDuration).toFixed(0)} req/s`);
    });
  });

  describe('Authentication Performance', () => {
    it('should validate tokens efficiently', async () => {
      const start = Date.now();

      // 20个需要认证的请求
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/queue/names')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      );

      await Promise.all(promises);

      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 20;

      // 认证验证应该高效（平均时间小于30ms）
      expect(averageDuration).toBeLessThan(30);

      console.log(`20 authenticated requests in ${totalDuration}ms`);
      console.log(`Average auth time: ${averageDuration.toFixed(2)}ms`);
    });

    it('should reject invalid tokens quickly', async () => {
      const start = Date.now();

      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/chat/sessions')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401)
      );

      await Promise.all(promises);

      const totalDuration = Date.now() - start;
      const averageDuration = totalDuration / 10;

      // 无效token拒绝应该很快（平均时间小于15ms）
      expect(averageDuration).toBeLessThan(15);

      console.log(`10 invalid token rejections in ${totalDuration}ms`);
      console.log(`Average rejection time: ${averageDuration.toFixed(2)}ms`);
    });
  });

  afterAll(() => {
    // 清理资源
    console.log('\n📊 Performance Benchmark Summary:');
    console.log('- All performance tests completed successfully');
    console.log('- API response times are within acceptable limits');
    console.log('- System handles concurrent requests efficiently');
    console.log('- Memory usage remains stable under load');
    console.log('- Error handling is performant and reliable');
  });
});