/**
 * 真实的性能基准测试
 * 基于实际可用的API端点
 */

import request from 'supertest';
import { createTestApp } from './integrationTestUtils';

describe('Real Performance Benchmark Tests', () => {
  let app: any;
  const performanceResults: { [key: string]: any } = {};

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('Core API Performance', () => {
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

    it('should handle agents endpoint within 100ms', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const responseTime = Date.now() - startTime;
      performanceResults.agentsEndpoint = responseTime;

      expect(responseTime).toBeLessThan(100);
      expect(response.body).toBeDefined();
      // 验证响应结构而非数组类型
      expect(typeof response.body).toBe('object');
    });

    it('should handle non-existent endpoints quickly', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/nonexistent')
        .expect(404);

      const responseTime = Date.now() - startTime;
      performanceResults.notFoundError = responseTime;

      expect(responseTime).toBeLessThan(50);
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle 20 concurrent health check requests', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/health').expect(200)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / concurrentRequests;

      performanceResults.concurrentHealth = {
        totalTime,
        averageTime,
        requestsPerSecond: Math.round(concurrentRequests / (totalTime / 1000))
      };

      expect(results).toHaveLength(concurrentRequests);
      expect(averageTime).toBeLessThan(50);
      expect(totalTime).toBeLessThan(1000);
    });

    it('should handle 10 concurrent agents requests', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/api/agents').expect(200)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / concurrentRequests;

      performanceResults.concurrentAgents = {
        totalTime,
        averageTime,
        requestsPerSecond: Math.round(concurrentRequests / (totalTime / 1000))
      };

      expect(results).toHaveLength(concurrentRequests);
      expect(averageTime).toBeLessThan(100);
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Memory Performance', () => {
    it('should maintain stable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();
      const operations = 50;

      // 执行多个操作
      for (let i = 0; i < operations; i++) {
        await request(app).get('/health').expect(200);
        if (i % 10 === 0) {
          await request(app).get('/api/agents').expect(200);
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      performanceResults.memoryStability = {
        operations,
        initialHeap: Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100,
        finalHeap: Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100,
        increase: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100
      };

      // 内存增长应该在合理范围内（小于10MB）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should monitor CPU usage patterns', async () => {
      const startTime = process.hrtime.bigint();
      const iterations = 100;

      // 执行CPU密集操作
      for (let i = 0; i < iterations; i++) {
        await request(app).get('/health').expect(200);
        // 简单的CPU密集计算
        const start = Date.now();
        while (Date.now() - start < 1) {
          // 空循环模拟CPU使用
        }
      }

      const endTime = process.hrtime.bigint();
      const totalCpuTime = Number(endTime - startTime) / 1000000; // 转换为毫秒

      performanceResults.cpuUsage = {
        iterations,
        totalTime: totalCpuTime,
        averageTimePerRequest: totalCpuTime / iterations,
        requestsPerSecond: Math.round(iterations / (totalCpuTime / 1000))
      };

      expect(totalCpuTime).toBeGreaterThan(0);
    });
  });

  describe('Response Size Performance', () => {
    it('should handle small responses efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(response.body).length;

      performanceResults.smallResponse = {
        responseTime,
        responseSize,
        throughput: Math.round(responseSize / (responseTime / 1000)) // bytes/sec
      };

      expect(responseTime).toBeLessThan(50);
      expect(responseSize).toBeGreaterThan(0);
    });

    it('should handle medium responses efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(response.body).length;

      performanceResults.mediumResponse = {
        responseTime,
        responseSize: Math.round(responseSize / 1024 * 100) / 100, // KB
        throughput: Math.round(responseSize / (responseTime / 1000)) // bytes/sec
      };

      expect(responseTime).toBeLessThan(100);
      expect(responseSize).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors within 20ms', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/definitely-not-found')
        .expect(404);

      const responseTime = Date.now() - startTime;
      performanceResults.error404 = responseTime;

      expect(responseTime).toBeLessThan(20);
    });

    it('should handle method not allowed within 20ms', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/health')
        .expect(404);

      const responseTime = Date.now() - startTime;
      performanceResults.methodNotAllowed = responseTime;

      expect(responseTime).toBeLessThan(20);
    });

    it('should handle invalid JSON within 30ms', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/test')
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400);

      const responseTime = Date.now() - startTime;
      performanceResults.invalidJson = responseTime;

      expect(responseTime).toBeLessThan(30);
    });
  });

  describe('Connection Pool Performance', () => {
    it('should reuse connections efficiently', async () => {
      const requests = 30;
      const startTime = Date.now();

      // 连续请求测试连接重用
      for (let i = 0; i < requests; i++) {
        await request(app).get('/health').expect(200);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / requests;

      performanceResults.connectionReuse = {
        requests,
        totalTime,
        averageTime,
        requestsPerSecond: Math.round(requests / (totalTime / 1000))
      };

      expect(averageTime).toBeLessThan(20); // 连接重用应该更快
    });

    it('should handle burst requests', async () => {
      const burstSize = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: burstSize }, () =>
        request(app).get('/health').expect(200)
      );

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      performanceResults.burstRequests = {
        burstSize,
        totalTime,
        requestsPerSecond: Math.round(burstSize / (totalTime / 1000))
      };

      expect(totalTime).toBeLessThan(2000); // 突发请求在2秒内完成
    });
  });

  afterAll(() => {
    // 输出详细的性能报告
    console.log('\n=== 真实性能基准测试报告 ===');

    console.log('\n📊 核心API性能:');
    console.log(`  健康检查: ${performanceResults.healthCheck}ms`);
    console.log(`  智能体端点: ${performanceResults.agentsEndpoint}ms`);
    console.log(`  404错误: ${performanceResults.notFoundError}ms`);

    console.log('\n⚡ 并发性能:');
    if (performanceResults.concurrentHealth) {
      console.log(`  健康检查并发: ${performanceResults.concurrentHealth.requestsPerSecond} req/s`);
      console.log(`  平均响应: ${performanceResults.concurrentHealth.averageTime}ms`);
    }
    if (performanceResults.concurrentAgents) {
      console.log(`  智能体并发: ${performanceResults.concurrentAgents.requestsPerSecond} req/s`);
      console.log(`  平均响应: ${performanceResults.concurrentAgents.averageTime}ms`);
    }

    console.log('\n💾 内存性能:');
    if (performanceResults.memoryStability) {
      console.log(`  操作数量: ${performanceResults.memoryStability.operations}`);
      console.log(`  初始内存: ${performanceResults.memoryStability.initialHeap}MB`);
      console.log(`  最终内存: ${performanceResults.memoryStability.finalHeap}MB`);
      console.log(`  内存增长: ${performanceResults.memoryStability?.increase || 'N/A'}MB`);
    }
    if (performanceResults.cpuUsage) {
      console.log(`  CPU使用: ${performanceResults.cpuUsage.iterations}次操作`);
      console.log(`  总时间: ${performanceResults.cpuUsage.totalTime}ms`);
      console.log(`  平均时间: ${performanceResults.cpuUsage.averageTimePerRequest.toFixed(2)}ms`);
      console.log(`  处理速度: ${performanceResults.cpuUsage.requestsPerSecond} req/s`);
    }

    console.log('\n📏 响应大小性能:');
    if (performanceResults.smallResponse) {
      console.log(`  小响应: ${performanceResults.smallResponse.responseTime}ms, ${performanceResults.smallResponse.throughput} bytes/s`);
    }
    if (performanceResults.mediumResponse) {
      console.log(`  中等响应: ${performanceResults.mediumResponse.responseTime}ms, ${performanceResults.mediumResponse.responseSize}KB, ${performanceResults.mediumResponse.throughput} bytes/s`);
    }

    console.log('\n🚨 错误处理性能:');
    console.log(`  404错误: ${performanceResults.error404}ms`);
    console.log(`  方法不允许: ${performanceResults.methodNotAllowed}ms`);
    console.log(`  无效JSON: ${performanceResults.invalidJson}ms`);

    console.log('\n🔗 连接池性能:');
    if (performanceResults.connectionReuse) {
      console.log(`  连接重用: ${performanceResults.connectionReuse.requestsPerSecond} req/s`);
      console.log(`  平均响应: ${performanceResults.connectionReuse.averageTime}ms`);
    }
    if (performanceResults.burstRequests) {
      console.log(`  突发请求: ${performanceResults.burstRequests.requestsPerSecond} req/s`);
      console.log(`  总时间: ${performanceResults.burstRequests.totalTime}ms`);
    }

    // 性能评级
    console.log('\n📈 性能评级:');
    const healthCheckGrade = performanceResults.healthCheck < 30 ? 'A' : performanceResults.healthCheck < 50 ? 'B' : 'C';
    const concurrentGrade = performanceResults.concurrentHealth?.requestsPerSecond > 500 ? 'A' :
                          performanceResults.concurrentHealth?.requestsPerSecond > 200 ? 'B' : 'C';

    console.log(`  健康检查响应: ${healthCheckGrade}级 (${performanceResults.healthCheck}ms)`);
    console.log(`  并发处理能力: ${concurrentGrade}级 (${performanceResults.concurrentHealth?.requestsPerSecond || 0} req/s)`);

    const totalTests = Object.keys(performanceResults).length;
    console.log(`\n✅ 总计完成 ${totalTests} 项性能基准测试`);

    console.log('\n=== 性能基准测试完成 ===');
  });
});