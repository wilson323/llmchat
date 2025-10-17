/**
 * Performance Benchmark Tests - API Endpoint Response Time Benchmarks
 *
 * This test suite establishes baseline performance metrics for all API endpoints
 * and monitors performance regression over time.
 */

import request from 'supertest';
import { performance } from 'perf_hooks';
import { PerformanceBenchmark } from '../../utils/PerformanceBenchmark';
import { createTestApp } from '../utils/integrationTestUtils';

describe('Performance Benchmark Tests', () => {
  let benchmark: PerformanceBenchmark;
  let app: any;

  beforeAll(() => {
    benchmark = new PerformanceBenchmark();
    app = createTestApp();
  });

  describe('Authentication API Performance', () => {

    it('POST /api/auth/login - should respond within 200ms', async () => {
      const start = performance.now();

      try {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'testpassword123'
          });

        const end = performance.now();
        const responseTime = end - start;

        // Benchmark assertion - using Jest's expect
        expect(responseTime).toBeLessThan(200);

        // Record benchmark
        benchmark.record('auth.login', responseTime, {
          statusCode: response.status,
          success: response.status < 400
        });

        // Response validation
        expect([200, 401]).toContain(response.status); // Success or invalid credentials

      } catch (error: any) {
        const end = performance.now();
        const responseTime = end - start;

        // Even if request fails, record the metric
        benchmark.record('auth.login', responseTime, {
          statusCode: 500,
          success: false
        });

        // Response time should still be within acceptable range even for errors
        expect(responseTime).toBeLessThan(500);
      }
    });

    it('POST /api/auth/register - should respond within 300ms', async () => {
      const uniqueEmail = `test${Date.now()}@example.com`;
      const start = performance.now();

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'testpassword123',
          confirmPassword: 'testpassword123'
        });

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(300);

      // Record benchmark
      benchmark.record('auth.register', responseTime, {
        statusCode: response.status,
        success: response.status < 400
      });

      // Response validation
      expect([201, 400, 409]).toContain(response.status); // Created or validation error
    });

    it('POST /api/auth/refresh - should respond within 150ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'mock-refresh-token'
        });

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(150);

      // Record benchmark
      benchmark.record('auth.refresh', responseTime, {
        statusCode: response.status,
        success: response.status < 400
      });

      // Response validation
      expect([200, 401, 403]).toContain(response.status); // Success or token errors
    });
  });

  describe('Agent API Performance', () => {

    it('GET /api/agents - should respond within 100ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .get('/api/agents');

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(100);

      // Record benchmark
      benchmark.record('agents.list', responseTime, {
        statusCode: response.status,
        success: response.status < 400,
        agentCount: response.body?.agents?.length || 0
      });

      // Response validation
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
    });

    it('GET /api/agents/:id/status - should respond within 50ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .get('/api/agents/fastgpt/status');

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(50);

      // Record benchmark
      benchmark.record('agents.status', responseTime, {
        statusCode: response.status,
        success: response.status < 400
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or not found
    });
  });

  describe('Chat API Performance', () => {

    it('POST /api/chat/completions - should respond within 5000ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .post('/api/chat/completions')
        .send({
          agentId: 'fastgpt',
          message: 'Hello, this is a test message',
          sessionId: 'test-session-' + Date.now()
        });

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion (AI responses can be slower)
      expect(responseTime).toBeLessThan(5000);

      // Record benchmark
      benchmark.record('chat.completion', responseTime, {
        statusCode: response.status,
        success: response.status < 400,
        agentId: 'fastgpt',
        messageLength: 'Hello, this is a test message'.length
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or error
    });

    it('GET /api/chat/history/:sessionId - should respond within 200ms', async () => {
      const sessionId = 'test-session-' + Date.now();
      const start = performance.now();

      const response = await request(app)
        .get(`/api/chat/history/${sessionId}`);

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(200);

      // Record benchmark
      benchmark.record('chat.history', responseTime, {
        statusCode: response.status,
        success: response.status < 400,
        sessionId: sessionId
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or not found
    });
  });

  describe('Admin API Performance', () => {

    it('GET /api/admin/stats - should respond within 300ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .get('/api/admin/stats');

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(300);

      // Record benchmark
      benchmark.record('admin.stats', responseTime, {
        statusCode: response.status,
        success: response.status < 400
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or auth error
    });

    it('GET /api/admin/audit - should respond within 500ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .get('/api/admin/audit');

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion (audit logs can be large)
      expect(responseTime).toBeLessThan(500);

      // Record benchmark
      benchmark.record('admin.audit', responseTime, {
        statusCode: response.status,
        success: response.status < 400
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or auth error
    });
  });

  describe('Queue Management API Performance', () => {

    it('GET /api/queue/stats - should respond within 100ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .get('/api/queue/stats');

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(100);

      // Record benchmark
      benchmark.record('queue.stats', responseTime, {
        statusCode: response.status,
        success: response.status < 400
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or auth error
    });

    it('POST /api/queue/pause - should respond within 50ms', async () => {
      const start = performance.now();

      const response = await request(app)
        .post('/api/queue/pause')
        .send({ queueName: 'chat-queue' });

      const end = performance.now();
      const responseTime = end - start;

      // Benchmark assertion
      expect(responseTime).toBeLessThan(50);

      // Record benchmark
      benchmark.record('queue.pause', responseTime, {
        statusCode: response.status,
        success: response.status < 400,
        queueName: 'chat-queue'
      });

      // Response validation
      expect([1]).toContain(response.status); // Success or error
    });
  });

  afterAll(() => {
    // Generate benchmark report
    const report = benchmark.generateReport();
    console.log('\n📊 Performance Benchmark Report:');
    console.log('================================');
    console.log(report);

    // Save report to file
    require('fs').writeFileSync(
      './performance-benchmark-report.json',
      JSON.stringify(benchmark.getResults(), null, 2)
    );

    console.log('\n💾 Detailed benchmark data saved to: performance-benchmark-report.json');
  });
});
