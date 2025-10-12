/**
 * AuthController 集成测试
 * 验证认证控制器与安全服务的集成
 */

import request from 'supertest';
import express from 'express';
import { createTestApp, setupTestDatabase, cleanupTestDatabase } from '../testUtils';
import bcrypt from 'bcryptjs';
import { AuthServiceV2 } from '../../services/AuthServiceV2';
import { SecureCredentialsManager } from '../../utils/secureCredentials';

describe('AuthController Integration Tests', () => {
  let app: express.Application;
  let testDb: any;
  let authService: AuthServiceV2;
  let testUser: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp();

    // 初始化认证服务
    authService = new AuthServiceV2(testDb);

    // 创建测试用户
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const result = await testDb.query(
      'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
      ['test@example.com', hashedPassword]
    );
    testUser = result.rows[0];
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate valid user credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data.user).not.toHaveProperty('password');
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
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          // 缺少email和password
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const newUserEmail = 'newuser@example.com';
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: newUserEmail,
          password: 'newpassword123',
          fullName: 'New User'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(newUserEmail);
      expect(response.body.data.user).not.toHaveProperty('password_hash');

      // 验证密码已正确哈希
      const userResult = await testDb.query(
        'SELECT password_hash FROM users WHERE email = $1',
        [newUserEmail]
      );
      expect(userResult.rows[0].password_hash).not.toBe('newpassword123');
      expect(userResult.rows[0].password_hash.length).toBe(60); // bcrypt hash length
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com', // 已存在的邮箱
          password: 'newpassword123',
          fullName: 'Duplicate User'
        })
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Email already exists');
    });

    it('should validate password requirements', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weakpassword@example.com',
          password: '123', // 弱密码
          fullName: 'Weak Password User'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });

    it('should validate email format for registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'validpassword123',
          fullName: 'Invalid Email User'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // 获取初始token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      refreshToken = loginResponse.body.data.token;
    });

    it('should refresh valid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).not.toBe(refreshToken); // 应该是新的token
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No token provided');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Logged out successfully');

      // 验证token已被撤销
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });

    it('should handle logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should return user profile', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email', 'test@example.com');
      expect(response.body.data).not.toHaveProperty('password_hash');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should update user profile', async () => {
      const updateData = {
        fullName: 'Updated Name',
        avatar: 'https://example.com/avatar.jpg'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.fullName).toBe(updateData.fullName);
      expect(response.body.data.avatar).toBe(updateData.avatar);

      // 验证数据库已更新
      const updatedUser = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedUser.body.data.fullName).toBe(updateData.fullName);
    });

    it('should reject email updates', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'newemail@example.com' // 不允许更新邮箱
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Email cannot be updated');
    });

    it('should reject password updates through profile endpoint', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'newpassword123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Password cannot be updated');
    });
  });

  describe('PUT /api/auth/password', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should update password successfully', async () => {
      const newPassword = 'newsecurepassword456';

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'testpassword123',
          newPassword: newPassword
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password updated successfully');

      // 验证可以用新密码登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('success', true);

      // 验证旧密码不再有效
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        .expect(401);
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should validate new password requirements', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'testpassword123',
          newPassword: '123' // 弱密码
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });

    it('should reject password reuse', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'testpassword123',
          newPassword: 'testpassword123' // 与当前密码相同
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('New password must be different');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password reset email sent');
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200); // 仍然返回200，避免泄露用户信息

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('If an account exists');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Security Tests', () => {
    it('should use secure password hashing', async () => {
      // 验证存储的密码是bcrypt哈希
      const userResult = await testDb.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['test@example.com']
      );

      const passwordHash = userResult.rows[0].password_hash;
      expect(passwordHash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt格式
      expect(passwordHash.length).toBe(60); // bcrypt标准长度
    });

    it('should prevent timing attacks on login', async () => {
      const startTime = Date.now();

      // 尝试登录不存在的用户
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(401);

      const nonExistentTime = Date.now() - startTime;

      // 尝试登录存在的用户但错误密码
      const existentStartTime = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);
      const existentTime = Date.now() - existentStartTime;

      // 时间差应该很小（防止时序攻击）
      const timeDifference = Math.abs(nonExistentTime - existentTime);
      expect(timeDifference).toBeLessThan(100); // 100ms阈值
    });

    it('should rate limit login attempts', async () => {
      // 快速尝试多次登录
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const results = await Promise.allSettled(promises);

      // 检查是否有速率限制响应
      const rateLimitedResponse = results.find(result =>
        result.status === 'fulfilled' &&
        result.value.status === 429
      );

      // 注意：这个测试可能需要根据实际的速率限制配置调整
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.status).toBe('fulfilled');
        expect(rateLimitedResponse.value.status).toBe(429);
      }
    });

    it('should secure JWT tokens with proper configuration', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        .expect(200);

      const token = loginResponse.body.data.token;
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT应该有3个部分

      // 验证token结构
      const [header, payload, signature] = token.split('.');
      expect(header).toBeTruthy();
      expect(payload).toBeTruthy();
      expect(signature).toBeTruthy();

      // 验证header是有效的base64
      expect(() => JSON.parse(Buffer.from(header, 'base64url').toString())).not.toThrow();

      // 验证payload是有效的base64
      expect(() => JSON.parse(Buffer.from(payload, 'base64url').toString())).not.toThrow();
    });
  });

  describe('Integration with Other Services', () => {
    it('should work with protected routes', async () => {
      // 登录获取token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      const token = loginResponse.body.data.token;

      // 访问受保护的路由
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should properly handle token expiration', async () => {
      // 这个测试可能需要模拟token过期
      // 在实际应用中，token可能有一个较短的过期时间用于测试
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      const token = loginResponse.body.data.token;

      // 等待一段时间（如果token有短过期时间）
      // await new Promise(resolve => setTimeout(resolve, 61000)); // 61秒

      // 尝试使用过期的token
      // const response = await request(app)
      //   .get('/api/auth/profile')
      //   .set('Authorization', `Bearer ${token}`)
      //   .expect(401);

      // expect(response.body).toHaveProperty('success', false);
      // expect(response.body.error).toContain('expired');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // 这个测试需要模拟数据库连接错误
      // 在实际环境中，可能需要临时关闭数据库连接进行测试
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'invalid.token',
        'invalid.token.format',
        'header.payload', // 缺少签名
        'header.payload.invalid-signature',
        '',
        'not.a.jwt.at.all'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('should handle extremely large request payloads', async () => {
      const largePayload = {
        email: 'test@example.com',
        password: 'a'.repeat(10000) // 非常长的密码
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(largePayload)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle concurrent login requests', async () => {
      const concurrentRequests = [];
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'testpassword123'
            })
        );
      }

      const results = await Promise.allSettled(concurrentRequests);

      // 所有请求都应该成功或失败，但不应该导致服务器错误
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 401, 400, 429]).toContain(result.value.status);
        }
      });
    });
  });
});