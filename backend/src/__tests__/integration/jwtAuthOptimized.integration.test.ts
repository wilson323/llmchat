/**
 * 优化JWT认证中间件集成测试
 * 验证JWT缓存、性能监控和错误处理功能
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, createTestToken, createExpiredToken, verifyTestToken, createTestJWT } from './integrationTestUtils';
import { createOptimizedAuthMiddleware } from '../../middleware/jwtAuthOptimized';

describe('JWT Optimized Authentication Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('JWT Token Generation and Validation', () => {
    it('should create valid JWT token', () => {
      const token = createTestToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT格式：header.payload.signature
    });

    it('should verify JWT token correctly', () => {
      const token = createTestToken({
        userId: 'test-user-123',
        username: 'testuser'
      });

      const decoded = verifyTestToken(token);
      expect(decoded.sub).toBe('test-user-id');
      expect(decoded.userId).toBe('test-user-123');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('user');
    });

    it('should create admin token with correct role', () => {
      const adminToken = createTestToken({
        role: 'admin',
        userId: 'admin-user-123'
      });

      const decoded = verifyTestToken(adminToken);
      expect(decoded.role).toBe('admin');
      expect(decoded.userId).toBe('admin-user-123');
    });

    it('should create expired token for testing', () => {
      const expiredToken = createExpiredToken();
      expect(expiredToken).toBeDefined();

      // 验证token确实过期
      expect(() => {
        verifyTestToken(expiredToken);
      }).toThrow(jwt.TokenExpiredError);
    });
  });

  describe('Authentication with Real JWT', () => {
    it('should authenticate successfully with valid JWT token', async () => {
      const token = createTestToken();

      const response = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'test-agent-1',
          title: 'Test Chat Session'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('userId', 'test-user-id');
    });

    it('should reject requests with expired JWT token', async () => {
      const expiredToken = createExpiredToken();

      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'TOKEN_EXPIRED');
      expect(response.body.message).toContain('认证令牌已过期');
    });

    it('should reject requests with invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
    });

    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'AUTHENTICATION_REQUIRED');
    });

    it('should reject requests with malformed authorization header', async () => {
      const token = createTestToken();

      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `InvalidFormat ${token}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'AUTHENTICATION_REQUIRED');
    });
  });

  describe('Login and Registration with JWT', () => {
    it('should login and return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');

      const token = response.body.data.token;
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      // 验证返回的token确实有效
      const decoded = verifyTestToken(token);
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.fullName).toBe('Test User');
    });

    it('should register and return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'newpassword123',
          fullName: 'New User'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', 'newuser@example.com');

      const token = response.body.data.token;
      const decoded = verifyTestToken(token);
      expect(decoded.email).toBe('newuser@example.com');
      expect(decoded.fullName).toBe('New User');
    });

    it('should use returned JWT token for authenticated requests', async () => {
      // 先登录获取token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // 使用返回的token访问受保护的API
      const chatResponse = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(chatResponse.body).toHaveProperty('success', true);
      expect(chatResponse.body.data.sessions).toBeDefined();
    });
  });

  describe('Queue Management with JWT Authentication', () => {
    it('should access queue stats with valid JWT token', async () => {
      const token = createTestToken();

      const response = await request(app)
        .get('/api/queue/stats/default')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.stats).toHaveProperty('queueName', 'default');
      expect(response.body.data.stats).toHaveProperty('userId', 'test-user-id');
    });

    it('should access queue names with valid JWT token', async () => {
      const token = createTestToken();

      const response = await request(app)
        .get('/api/queue/names')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.queueNames).toContain('default');
      expect(response.body.data).toHaveProperty('userId', 'test-user-id');
    });

    it('should reject queue access without JWT token', async () => {
      const response = await request(app)
        .get('/api/queue/stats/default')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'AUTHENTICATION_REQUIRED');
    });
  });

  describe('JWT Token Caching and Performance', () => {
    it('should handle multiple requests with same token efficiently', async () => {
      const token = createTestToken();
      const startTime = Date.now();

      // 连续发送多个请求，测试缓存效果
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/queue/names')
          .set('Authorization', `Bearer ${token}`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 所有请求都应该成功
      results.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });

      // 总时间应该在合理范围内（小于500ms，说明缓存生效）
      expect(totalTime).toBeLessThan(500);

      console.log(`10个认证请求总耗时: ${totalTime}ms`);
    });

    it('should cache token validation results', async () => {
      const token = createTestToken();

      // 第一次请求
      const response1 = await request(app)
        .get('/api/queue/names')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 第二次请求（应该使用缓存）
      const response2 = await request(app)
        .get('/api/queue/names')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 两次响应应该一致
      expect(response1.body).toEqual(response2.body);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JWT tokens gracefully', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'header.payload', // 缺少signature
        '...',
        '',
        'Bearer', // 只有Bearer前缀
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/chat/sessions')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('code');
      }
    });

    it('should handle JWT tokens with invalid claims', async () => {
      // 创建包含无效claims的token（使用错误的issuer）
      const invalidClaimToken = createTestJWT({}, {
        // 故意设置无效的issuer（验证时会失败）
        issuer: 'invalid-issuer'
      });

      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${invalidClaimToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle very long authorization headers', async () => {
      const token = createTestToken();
      const veryLongAuthHeader = `Bearer ${token}` + 'a'.repeat(1000);

      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', veryLongAuthHeader)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
    });
  });
});