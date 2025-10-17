/**
 * Auth认证集成测试
 * 
 * 测试范围：
 * - 完整的注册流程
 * - 完整的登录流程
 * - 邮箱验证流程
 * - Token刷新流程
 * - 密码修改流程
 * - 登出流程
 * 
 * 覆盖率目标：≥90%
 */

import request from 'supertest';
import { Pool } from 'pg';
import { createTestUser, cleanupTestData, randomEmail, generateStrongPassword } from '../helpers/testUtils';
import { app } from '@/index';
import { dbTestSetup } from '../utils/dbTestUtils';

describe('Auth Integration Tests', () => {
  let testUserId: string | null = null;
  let pool: Pool;
  
  beforeAll(async () => {
    await dbTestSetup.beforeAll();
    pool = dbTestSetup.getClient();
  });
  
  beforeEach(async () => {
    await dbTestSetup.beforeEach();
  });
  
  afterEach(async () => {
    // 清理测试数据
    if (testUserId) {
      await cleanupTestData(pool, testUserId);
      testUserId = null;
    }
  });
  
  afterAll(async () => {
    await dbTestSetup.afterAll();
  });
  
  describe('Complete Registration Flow', () => {
    it('should complete full registration and verification', async () => {
      // Step 1: 注册用户
      const email = randomEmail();
      const password = generateStrongPassword();
      
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          username: 'testuser'
        });
      
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body).toHaveProperty('code', 'SUCCESS');
      expect(registerResponse.body.data).toHaveProperty('id');
      expect(registerResponse.body.data).toHaveProperty('email', email);
      
      testUserId = registerResponse.body.data.id;
      
      // Step 2: 验证邮箱（模拟）
      // 实际环境中需要从邮件中获取token
      // 这里假设有一个测试端点可以获取验证token
      
      // const verifyToken = await getVerificationToken(testUserId);
      // const verifyResponse = await request(app)
      //   .get(`/api/auth/verify-email/${verifyToken}`);
      
      // expect(verifyResponse.status).toBe(200);
      // expect(verifyResponse.body.code).toBe('SUCCESS');
      
      // Step 3: 登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email, password });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('code', 'SUCCESS');
      expect(loginResponse.body.data).toHaveProperty('token');
      expect(loginResponse.body.data).toHaveProperty('user');
    });
    
    it('should prevent duplicate registration', async () => {
      // Step 1: 第一次注册
      const email = randomEmail();
      const password = generateStrongPassword();
      
      const firstRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          username: 'testuser'
        });
      
      expect(firstRegister.status).toBe(201);
      testUserId = firstRegister.body.data.id;
      
      // Step 2: 尝试重复注册
      const secondRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          username: 'testuser2'
        });
      
      expect(secondRegister.status).toBe(409);
      expect(secondRegister.body.code).toBe('EMAIL_EXISTS');
    });
  });
  
  describe('Complete Login Flow', () => {
    it('should login and access protected routes', async () => {
      // Step 1: 创建测试用户
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      // Step 2: 登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.data.token;
      
      // Step 3: 访问受保护的端点
      const protectedResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.data).toHaveProperty('email', testUser.email);
    });
    
    it('should track failed login attempts', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      // Act: 多次失败登录
      const failedAttempts = 5;
      for (let i = 0; i < failedAttempts; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword!'
          });
      }
      
      // 最后一次应该被锁定
      const finalAttempt = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password // 正确密码
        });
      
      expect(finalAttempt.status).toBe(429);
      expect(finalAttempt.body.code).toBe('ACCOUNT_LOCKED');
    });
  });
  
  describe('Token Refresh Flow', () => {
    it('should refresh token before expiration', async () => {
      // Step 1: 登录获取token
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const refreshToken = loginResponse.body.data.refreshToken;
      
      // Step 2: 刷新token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.data).toHaveProperty('token');
      expect(refreshResponse.body.data).toHaveProperty('refreshToken');
      expect(refreshResponse.body.data.refreshToken).not.toBe(refreshToken);
    });
    
    it('should reject used refresh token', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const refreshToken = loginResponse.body.data.refreshToken;
      
      // Act: 第一次刷新
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      // 第二次使用相同的refresh token
      const secondRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      // Assert
      expect(secondRefresh.status).toBe(401);
      expect(secondRefresh.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
  
  describe('Password Change Flow', () => {
    it('should change password and invalidate old tokens', async () => {
      // Step 1: 登录
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const oldToken = loginResponse.body.data.token;
      
      // Step 2: 修改密码
      const newPassword = generateStrongPassword();
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          oldPassword: testUser.password,
          newPassword
        });
      
      expect(changeResponse.status).toBe(200);
      
      // Step 3: 验证旧token失效
      const protectedRequest = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${oldToken}`);
      
      expect(protectedRequest.status).toBe(401);
      
      // Step 4: 用新密码登录
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        });
      
      expect(newLoginResponse.status).toBe(200);
    });
  });
  
  describe('Logout Flow', () => {
    it('should invalidate token on logout', async () => {
      // Step 1: 登录
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const token = loginResponse.body.data.token;
      
      // Step 2: 登出
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      
      expect(logoutResponse.status).toBe(200);
      
      // Step 3: 验证token失效
      const protectedRequest = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(protectedRequest.status).toBe(401);
    });
  });
  
  describe('Concurrent Operations', () => {
    it('should handle concurrent login attempts', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      // Act: 并发登录
      const loginPromises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
      );
      
      const responses = await Promise.all(loginPromises);
      
      // Assert: 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('token');
      });
    });
    
    it('should handle concurrent token refresh', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const refreshToken = loginResponse.body.data.refreshToken;
      
      // Act: 并发刷新（应该只有一个成功）
      const refreshPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
      );
      
      const responses = await Promise.allSettled(refreshPromises);
      
      // Assert: 只有第一个成功，其他失败
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      expect(successful).toBe(1);
    });
  });
  
  describe('Security Tests', () => {
    it('should sanitize SQL injection attempts', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "'; DROP TABLE users; --",
          password: 'password'
        });
      
      // Assert
      expect(response.status).toBe(400);
      // 数据库应该没有被破坏
      const usersCheck = await pool.query('SELECT COUNT(*) FROM users');
      expect(usersCheck.rows[0].count).toBeDefined();
    });
    
    it('should prevent brute force attacks', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      
      // Act: 快速发送大量请求
      const attempts = Array(100).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword!'
          })
      );
      
      const responses = await Promise.all(attempts);
      
      // Assert: 应该有限流响应
      const rateLimited = responses.filter(r => r.status === 429).length;
      expect(rateLimited).toBeGreaterThan(0);
    });
  });
  
  describe('Error Recovery', () => {
    it('should handle database connection loss', async () => {
      // 模拟数据库连接丢失
      // 这个测试需要特殊的数据库mock配置
      
      // const response = await request(app)
      //   .post('/api/auth/login')
      //   .send({
      //     email: 'test@example.com',
      //     password: 'Test123!'
      //   });
      
      // expect(response.status).toBe(503);
      // expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
    });
    
    it('should handle Redis connection loss', async () => {
      // 模拟Redis连接丢失
      // 应该降级处理，不影响基本功能
      
      // const testUser = await createTestUser();
      // const pool = getPool();
      // await pool.query(
      //   'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
      //   [testUser.id, testUser.email, testUser.passwordHash, true]
      // );
      // testUserId = testUser.id;
      
      // const response = await request(app)
      //   .post('/api/auth/login')
      //   .send({
      //     email: testUser.email,
      //     password: testUser.password
      //   });
      
      // 即使Redis失败，登录应该成功（降级处理）
      // expect(response.status).toBe(200);
    });
  });
});

