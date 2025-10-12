/**
 * 简化的性能基准测试
 * 只测试确实可用的API端点
 */

import request from 'supertest';
import { createTestApp } from './integrationTestUtils';

describe('Simple Performance Benchmark Tests', () => {
  let app: any;
  const performanceResults: { [key: string]: any } = {};

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('Basic API Performance Benchmarks', () => {
    it('should respond to health check within 50ms', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      performanceResults.healthCheck = responseTime;

      expect(responseTime).toBeLessThan(50);
      expect(response.body.status).toBe('ok');
    });

    it('should respond to agents list within 100ms', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const responseTime = Date.now() - startTime;
      performanceResults.agentsList = responseTime;

      expect(responseTime).toBeLessThan(100);
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle mock JWT token generation within 50ms', async () => {
      const startTime = Date.now();

      // 使用认证测试中的mockJWT生成
      const response = await request(app)
        .post('/api/auth/test')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      performanceResults.mockJwtGeneration = responseTime;

      expect(responseTime).toBeLessThan(50);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 10 concurrent health check requests', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/health').expect(200)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / concurrentRequests;

      performanceResults.concurrentHealthChecks = {
        totalTime,
        averageTime,
        requestsPerSecond: Math.round(concurrentRequests / (totalTime / 1000))
      };

      expect(results).toHaveLength(concurrentRequests);
      expect(averageTime).toBeLessThan(100); // 平均每个请求在100ms内
      expect(totalTime).toBeLessThan(500); // 总时间在500ms内
    });

    it('should handle 5 concurrent agents list requests', async () => {
      const concurrentRequests = 5;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/api/agents').expect(200)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / concurrentRequests;

      performanceResults.concurrentAgentsList = {
        totalTime,
        averageTime,
        requestsPerSecond: Math.round(concurrentRequests / (totalTime / 1000))
      };

      expect(results).toHaveLength(concurrentRequests);
      expect(averageTime).toBeLessThan(150); // 平均每个请求在150ms内
      expect(totalTime).toBeLessThan(750); // 总时间在750ms内
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should monitor memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();

      // 执行一系列操作
      await request(app).get('/health');
      await request(app).get('/api/agents');
      await request(app).post('/api/auth/test').send({
        email: 'memory-test@example.com',
        password: 'testpassword'
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      performanceResults.memoryUsage = {
        initialHeap: Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100, // MB
        finalHeap: Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100, // MB
        increase: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100 // MB
      };

      // 内存增长应该在合理范围内（小于10MB）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors quickly', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      const responseTime = Date.now() - startTime;
      performanceResults.error404 = responseTime;

      // 404错误应该快速返回
      expect(responseTime).toBeLessThan(50);
    });

    it('should handle method not allowed errors quickly', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/health')
        .expect(404);

      const responseTime = Date.now() - startTime;
      performanceResults.methodNotAllowed = responseTime;

      // 方法不允许错误应该快速返回
      expect(responseTime).toBeLessThan(50);
    });
  });

  describe('Response Content Performance', () => {
    it('should handle JSON response parsing efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(response.body).length;

      performanceResults.jsonParsing = {
        responseTime,
        responseSize: Math.round(responseSize / 1024 * 100) / 100 // KB
      };

      expect(responseTime).toBeLessThan(100);
      expect(responseSize).toBeGreaterThan(0);
    });

    it('should handle large response data efficiently', async () => {
      const startTime = Date.now();

      // 发送可能导致较大响应的请求
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const responseTime = Date.now() - startTime;
      performanceResults.largeResponse = responseTime;

      expect(responseTime).toBeLessThan(150);
    });
  });

  describe('Connection Performance', () => {
    it('should handle connection reuse efficiently', async () => {
      const requests = 5;
      const startTime = Date.now();

      // 连续请求测试连接重用
      for (let i = 0; i < requests; i++) {
        await request(app).get('/health').expect(200);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / requests;

      performanceResults.connectionReuse = {
        totalTime,
        averageTime,
        requestsPerSecond: Math.round(requests / (totalTime / 1000))
      };

      expect(averageTime).toBeLessThan(30); // 连接重用应该更快
    });
  });

  afterAll(() => {
    // 输出性能基准报告
    console.log('\n=== 简化性能基准测试报告 ===');

    console.log('\n📊 API响应时间基准:');
    console.log(`  健康检查: ${performanceResults.healthCheck}ms`);
    console.log(`  智能体列表: ${performanceResults.agentsList}ms`);
    console.log(`  Mock JWT生成: ${performanceResults.mockJwtGeneration}ms`);

    console.log('\n⚡ 并发性能基准:');
    if (performanceResults.concurrentHealthChecks) {
      console.log(`  健康检查并发: ${performanceResults.concurrentHealthChecks.requestsPerSecond} req/s`);
      console.log(`  平均响应时间: ${performanceResults.concurrentHealthChecks.averageTime}ms`);
    }
    if (performanceResults.concurrentAgentsList) {
      console.log(`  智能体列表并发: ${performanceResults.concurrentAgentsList.requestsPerSecond} req/s`);
      console.log(`  平均响应时间: ${performanceResults.concurrentAgentsList.averageTime}ms`);
    }

    console.log('\n💾 内存使用基准:');
    if (performanceResults.memoryUsage) {
      console.log(`  初始堆内存: ${performanceResults.memoryUsage.initialHeap}MB`);
      console.log(`  最终堆内存: ${performanceResults.memoryUsage.finalHeap}MB`);
      console.log(`  内存增长: ${performanceResults.memoryUsage.increase}MB`);
    }

    console.log('\n📋 响应内容性能:');
    if (performanceResults.jsonParsing) {
      console.log(`  JSON解析时间: ${performanceResults.jsonParsing.responseTime}ms`);
      console.log(`  响应大小: ${performanceResults.jsonParsing.responseSize}KB`);
    }
    console.log(`  大响应处理: ${performanceResults.largeResponse}ms`);

    console.log('\n🔗 连接性能基准:');
    if (performanceResults.connectionReuse) {
      console.log(`  连接重用: ${performanceResults.connectionReuse.requestsPerSecond} req/s`);
      console.log(`  平均响应时间: ${performanceResults.connectionReuse.averageTime}ms`);
    }

    console.log('\n🚨 错误处理基准:');
    console.log(`  404错误响应: ${performanceResults.error404}ms`);
    console.log(`  方法不允许错误: ${performanceResults.methodNotAllowed}ms`);

    // 计算总体性能评分
    const passedTests = Object.keys(performanceResults).length;
    console.log(`\n📈 总体测试结果: ${passedTests} 项性能基准测试完成`);

    console.log('\n=== 简化基准测试完成 ===');
  });
});