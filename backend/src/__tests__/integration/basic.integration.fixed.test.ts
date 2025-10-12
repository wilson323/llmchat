/**
 * 基础集成测试 - 修复版本
 * 修复错误处理测试以匹配实际API响应格式
 */

import request from 'supertest';
import { createTestApp, createTestToken } from './integrationTestUtils';

describe('Basic Integration Tests - Fixed Error Handling', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    app = createTestApp();
    authToken = createTestToken();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', 'test@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should register new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'newpassword123',
          fullName: 'New User'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user).toHaveProperty('email', 'newuser@example.com');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123',
          fullName: 'Weak Password'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });
  });

  describe('Agents', () => {
    it('should return list of agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data.agents)).toBe(true);
      expect(response.body.data.agents.length).toBeGreaterThan(0);
    });

    it('should return specific agent details', async () => {
      const response = await request(app)
        .get('/api/agents/test-agent-1')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'test-agent-1');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('provider');
    });

    it('should return 404 for non-existent agent', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent')
        .expect(404);

      // 修复：API返回的实际格式
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Agent not found');
    });
  });

  describe('Chat Sessions', () => {
    it('should initialize new chat session', async () => {
      const response = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent-1',
          title: 'Test Chat Session'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('title', 'Test Chat Session');
    });

    it('should require authentication for chat initialization', async () => {
      const response = await request(app)
        .post('/api/chat/init')
        .send({
          agentId: 'test-agent-1',
          title: 'Test Chat Session'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should get chat sessions list', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });
  });

  describe('Queue Management', () => {
    it('should get queue statistics', async () => {
      const response = await request(app)
        .get('/api/queue/stats/default')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('queueName', 'default');
    });

    it('should return queue names', async () => {
      const response = await request(app)
        .get('/api/queue/names')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('queueNames');
      expect(Array.isArray(response.body.data.queueNames)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      // 修复：API返回的实际格式
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // 修复：API返回的实际格式
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Invalid JSON format');
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Security', () => {
    it('should reject requests without proper authorization', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS requests properly', async () => {
      // 修复：OPTIONS请求现在返回200，应该有CORS头
      const response = await request(app)
        .options('/api/agents')
        .expect(200);

      // 检查CORS头（不区分大小写）
      const headers = response.headers;
      const corsHeaders = Object.keys(headers).filter(header =>
        header.toLowerCase().includes('access-control')
      );

      console.log('Available headers:', Object.keys(headers));
      console.log('CORS headers found:', corsHeaders);

      // 检查基本的CORS头是否存在
      expect(corsHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('Request/Response Format', () => {
    it('should return consistent response format for successful requests', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      // 成功响应的格式
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data', expect.any(Object));
    });

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      // 错误响应的格式
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', expect.any(String));
    });

    it('should handle content-type properly', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time', async () => {
      const start = Date.now();

      await request(app)
        .get('/api/agents')
        .expect(200);

      const duration = Date.now() - start;

      // Response should be under 100ms for a simple endpoint
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/agents').expect(200)
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(response => {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });
    });
  });
});