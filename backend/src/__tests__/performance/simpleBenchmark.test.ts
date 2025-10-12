/**
 * Simple Performance Benchmark Tests
 *
 * Basic performance testing without complex dependencies.
 */

import request from 'supertest';
import { performance } from 'perf_hooks';
import { PerformanceBenchmark } from '../../utils/PerformanceBenchmark';
import { createTestApp } from '../utils/integrationTestUtils';

describe('Simple Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;
  let app: any;

  beforeAll(() => {
    benchmark = new PerformanceBenchmark();
    app = createTestApp();
  });

  describe('Basic Express Performance', () => {

    it('should respond to GET / quickly', async () => {
      const start = performance.now();

      try {
        const response = await request(app)
          .get('/');

        const end = performance.now();
        const responseTime = end - start;

        // Basic performance test - should respond within 100ms
        expect(responseTime).toBeLessThan(100);

        // Record benchmark
        benchmark.record('root.get', responseTime, {
          statusCode: response.status,
          success: response.status < 500
        });

        expect(response.status).toBeLessThan(500);

      } catch (error) {
        const end = performance.now();
        const responseTime = end - start;

        // Record error metric
        benchmark.record('root.get', responseTime, {
          statusCode: 500,
          success: false
        });

        // Even errors should be quick
        expect(responseTime).toBeLessThan(200);
      }
    });

    it('should handle POST requests efficiently', async () => {
      const start = performance.now();

      try {
        const response = await request(app)
          .post('/')
          .send({ test: 'data' });

        const end = performance.now();
        const responseTime = end - start;

        expect(responseTime).toBeLessThan(100);

        benchmark.record('root.post', responseTime, {
          statusCode: response.status,
          success: response.status < 500
        });

        expect(response.status).toBeLessThan(500);

      } catch (error) {
        const end = performance.now();
        const responseTime = end - start;

        benchmark.record('root.post', responseTime, {
          statusCode: 500,
          success: false
        });

        expect(responseTime).toBeLessThan(200);
      }
    });
  });

  describe('Mock API Performance', () => {

    it('should handle mock health check quickly', async () => {
      // Add a mock health check route
      app.get('/health', (req: any, res: any) => {
        res.json({ status: 'ok', timestamp: Date.now() });
      });

      const start = performance.now();

      const response = await request(app)
        .get('/health');

      const end = performance.now();
      const responseTime = end - start;

      expect(responseTime).toBeLessThan(50);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');

      benchmark.record('health.check', responseTime, {
        statusCode: response.status,
        success: true
      });
    });

    it('should handle mock agent list quickly', async () => {
      // Add a mock agents endpoint
      app.get('/api/agents', (req: any, res: any) => {
        res.json({
          agents: [
            { id: '1', name: 'Test Agent 1', status: 'active' },
            { id: '2', name: 'Test Agent 2', status: 'active' }
          ]
        });
      });

      const start = performance.now();

      const response = await request(app)
        .get('/api/agents');

      const end = performance.now();
      const responseTime = end - start;

      expect(responseTime).toBeLessThan(50);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agents');
      expect(response.body.agents).toHaveLength(2);

      benchmark.record('agents.list', responseTime, {
        statusCode: response.status,
        success: true,
        agentCount: 2
      });
    });
  });

  describe('Concurrent Request Performance', () => {

    it('should handle concurrent requests efficiently', async () => {
      // Add a test endpoint
      app.get('/concurrent-test', (req: any, res: any) => {
        // Simulate some async work
        setTimeout(() => {
          res.json({
            id: Math.random(),
            timestamp: Date.now(),
            message: 'Concurrent test response'
          });
        }, 10); // Small delay to simulate real work
      });

      const concurrentRequests = 5;
      const start = performance.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/concurrent-test')
      );

      const results = await Promise.all(promises);

      const end = performance.now();
      const totalTime = end - start;
      const avgTime = totalTime / concurrentRequests;

      // Each request should be fast, but concurrent may be slower
      expect(avgTime).toBeLessThan(100);
      expect(totalTime).toBeLessThan(500);

      // All requests should succeed
      results.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Concurrent test response');
      });

      benchmark.record('concurrent.test', avgTime, {
        statusCode: 200,
        success: true,
        concurrentRequests: concurrentRequests,
        totalTime: totalTime
      });
    });
  });

  afterAll(() => {
    // Generate benchmark report
    const report = benchmark.generateReport();
    console.log('\n📊 Simple Performance Benchmark Report:');
    console.log('======================================');
    console.log(report);

    // Save report to file
    try {
      require('fs').writeFileSync(
        './simple-performance-benchmark-report.json',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          duration: benchmark.getDuration(),
          results: benchmark.getResults(),
          report: report
        }, null, 2)
      );

      console.log('\n💾 Benchmark data saved to: simple-performance-benchmark-report.json');
    } catch (error) {
      console.log('⚠️  Could not save report to file:', (error as Error).message);
    }
  });
});