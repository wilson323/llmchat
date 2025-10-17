/**
 * AuthService 单元测试
 * 
 * 测试范围：
 * - 密码验证逻辑
 * - Token生成和验证
 * - 用户注册业务逻辑
 * - 登录验证流程
 * 
 * 覆盖率目标：≥90%
 */

import { AuthServiceV2 } from '@/services/AuthServiceV2';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { createTestUser, generateToken, generateExpiredToken } from '../../helpers/testUtils';
import { createMockPool } from '../../mocks/database.mock';
import { createMockRedisClient } from '../../mocks/redis.mock';

// Mock数据库和Redis
jest.mock('@/utils/db');
jest.mock('ioredis');

describe('AuthServiceV2', () => {
  let authService: AuthServiceV2;
  let mockPool: any;
  let mockRedis: any;
  
  beforeEach(() => {
    mockPool = createMockPool();
    mockRedis = createMockRedisClient();
    authService = new AuthServiceV2();
    
    // 注入Mock依赖
    (authService as any).pool = mockPool;
    (authService as any).redis = mockRedis;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'Test123!@#',
        'MyP@ssw0rd',
        'Secure#Pass123',
        'C0mpl3x!Pass'
      ];
      
      strongPasswords.forEach(password => {
        expect(() => authService.validatePassword(password)).not.toThrow();
      });
    });
    
    it('should reject weak passwords', () => {
      const weakPasswords = [
        '123456',           // 纯数字
        'password',         // 纯字母
        'Pass123',          // 缺少特殊字符
        'pass!',            // 太短
        'PASSWORD123!',     // 缺少小写
        'password123!'      // 缺少大写
      ];
      
      weakPasswords.forEach(password => {
        expect(() => authService.validatePassword(password))
          .toThrow('Password does not meet requirements');
      });
    });
    
    it('should check minimum length', () => {
      const shortPassword = 'Aa1!';
      expect(() => authService.validatePassword(shortPassword))
        .toThrow('at least 8 characters');
    });
    
    it('should require uppercase letter', () => {
      const noUppercase = 'test123!@#';
      expect(() => authService.validatePassword(noUppercase))
        .toThrow('uppercase letter');
    });
    
    it('should require lowercase letter', () => {
      const noLowercase = 'TEST123!@#';
      expect(() => authService.validatePassword(noLowercase))
        .toThrow('lowercase letter');
    });
    
    it('should require digit', () => {
      const noDigit = 'TestPass!@#';
      expect(() => authService.validatePassword(noDigit))
        .toThrow('digit');
    });
    
    it('should require special character', () => {
      const noSpecial = 'TestPass123';
      expect(() => authService.validatePassword(noSpecial))
        .toThrow('special character');
    });
  });
  
  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const userId = 'user-123';
      const token = authService.generateToken(userId);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT格式
    });
    
    it('should include correct claims', () => {
      const userId = 'user-123';
      const token = authService.generateToken(userId, { isAdmin: true });
      
      const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-purposes-only';
      const decoded = jwt.verify(token, secret) as any;
      
      expect(decoded).toHaveProperty('userId', userId);
      expect(decoded).toHaveProperty('isAdmin', true);
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });
    
    it('should set correct expiration', () => {
      const userId = 'user-123';
      const token = authService.generateToken(userId, { expiresIn: '2h' });
      
      const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-purposes-only';
      const decoded = jwt.verify(token, secret) as any;
      
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBeCloseTo(2 * 3600, -2); // 2小时，允许±100秒误差
    });
  });
  
  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const userId = 'user-123';
      const token = generateToken(userId);
      
      const decoded = authService.verifyToken(token);
      
      expect(decoded).toHaveProperty('userId', userId);
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });
    
    it('should reject expired token', () => {
      const userId = 'user-123';
      const expiredToken = generateExpiredToken(userId);
      
      expect(() => authService.verifyToken(expiredToken))
        .toThrow('Token expired');
    });
    
    it('should reject tampered token', () => {
      const userId = 'user-123';
      const token = generateToken(userId);
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      
      expect(() => authService.verifyToken(tamperedToken))
        .toThrow('Invalid token');
    });
    
    it('should reject malformed token', () => {
      const malformedToken = 'not.a.valid.token';
      
      expect(() => authService.verifyToken(malformedToken))
        .toThrow('Invalid token');
    });
    
    it('should reject empty token', () => {
      expect(() => authService.verifyToken(''))
        .toThrow('Token required');
    });
  });
  
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'Test123!@#';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });
    
    it('should generate different hashes for same password', async () => {
      const password = 'Test123!@#';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // 因为salt不同
    });
    
    it('should generate valid bcrypt hash', async () => {
      const password = 'Test123!@#';
      const hash = await authService.hashPassword(password);
      
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });
  });
  
  describe('comparePassword', () => {
    it('should match correct password', async () => {
      const password = 'Test123!@#';
      const hash = await bcrypt.hash(password, 10);
      
      const isMatch = await authService.comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });
    
    it('should reject incorrect password', async () => {
      const password = 'Test123!@#';
      const hash = await bcrypt.hash(password, 10);
      
      const isMatch = await authService.comparePassword('WrongPassword!', hash);
      expect(isMatch).toBe(false);
    });
    
    it('should handle empty password', async () => {
      const hash = await bcrypt.hash('Test123!@#', 10);
      
      const isMatch = await authService.comparePassword('', hash);
      expect(isMatch).toBe(false);
    });
  });
  
  describe('register', () => {
    it('should register new user successfully', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // 检查邮箱不存在
        .mockResolvedValueOnce({ rows: [{ id: testUser.id, email: testUser.email }] }); // 插入用户
      
      // Act
      const result = await authService.register({
        email: testUser.email,
        password: testUser.password,
        username: 'testuser'
      });
      
      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', testUser.email);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
    
    it('should reject duplicate email', async () => {
      // Arrange
      const existingUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [existingUser] }); // 邮箱已存在
      
      // Act & Assert
      await expect(authService.register({
        email: existingUser.email,
        password: 'Test123!',
        username: 'test'
      })).rejects.toThrow('Email already exists');
    });
    
    it('should validate password strength before hashing', async () => {
      // Arrange
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] });
      
      // Act & Assert
      await expect(authService.register({
        email: 'test@example.com',
        password: '123', // 弱密码
        username: 'test'
      })).rejects.toThrow('Password does not meet requirements');
    });
    
    it('should handle database errors', async () => {
      // Arrange
      mockPool.query = jest.fn()
        .mockRejectedValue(new Error('Database connection failed'));
      
      // Act & Assert
      await expect(authService.register({
        email: 'test@example.com',
        password: 'Test123!',
        username: 'test'
      })).rejects.toThrow('Database connection failed');
    });
  });
  
  describe('login', () => {
    it('should login with correct credentials', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            email: testUser.email,
            password_hash: testUser.passwordHash,
            email_verified: true
          }]
        });
      
      // Act
      const result = await authService.login(testUser.email, testUser.password);
      
      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.id).toBe(testUser.id);
    });
    
    it('should reject non-existent user', async () => {
      // Arrange
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] });
      
      // Act & Assert
      await expect(authService.login('nonexistent@example.com', 'Test123!'))
        .rejects.toThrow('Invalid credentials');
    });
    
    it('should reject incorrect password', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            email: testUser.email,
            password_hash: testUser.passwordHash,
            email_verified: true
          }]
        });
      
      // Act & Assert
      await expect(authService.login(testUser.email, 'WrongPassword!'))
        .rejects.toThrow('Invalid credentials');
    });
    
    it('should reject unverified email', async () => {
      // Arrange
      const testUser = await createTestUser({ emailVerified: false });
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            email: testUser.email,
            password_hash: testUser.passwordHash,
            email_verified: false
          }]
        });
      
      // Act & Assert
      await expect(authService.login(testUser.email, testUser.password))
        .rejects.toThrow('Email not verified');
    });
  });
  
  describe('refreshToken', () => {
    it('should refresh valid refresh token', async () => {
      // Arrange
      const userId = 'user-123';
      const refreshToken = 'valid-refresh-token';
      
      mockRedis.get = jest.fn().mockResolvedValue(userId);
      
      // Act
      const result = await authService.refreshToken(refreshToken);
      
      // Assert
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRedis.get).toHaveBeenCalledWith(`refresh_token:${refreshToken}`);
    });
    
    it('should reject expired refresh token', async () => {
      // Arrange
      const refreshToken = 'expired-token';
      mockRedis.get = jest.fn().mockResolvedValue(null);
      
      // Act & Assert
      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow('Invalid or expired refresh token');
    });
    
    it('should generate new tokens', async () => {
      // Arrange
      const userId = 'user-123';
      const oldRefreshToken = 'old-refresh-token';
      
      mockRedis.get = jest.fn().mockResolvedValue(userId);
      mockRedis.del = jest.fn().mockResolvedValue(1);
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      // Act
      const result = await authService.refreshToken(oldRefreshToken);
      
      // Assert
      expect(result.token).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.refreshToken).not.toBe(oldRefreshToken);
      
      // 验证旧token被删除
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh_token:${oldRefreshToken}`);
      
      // 验证新token被保存
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });
  
  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const testUser = await createTestUser();
      const newPassword = 'NewPassword123!';
      
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            password_hash: testUser.passwordHash
          }]
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
      
      // Act
      const result = await authService.changePassword(
        testUser.id,
        testUser.password,
        newPassword
      );
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
    
    it('should verify old password', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            password_hash: testUser.passwordHash
          }]
        });
      
      // Act & Assert
      await expect(authService.changePassword(
        testUser.id,
        'WrongOldPassword!',
        'NewPassword123!'
      )).rejects.toThrow('Incorrect old password');
    });
    
    it('should validate new password strength', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            password_hash: testUser.passwordHash
          }]
        });
      
      // Act & Assert
      await expect(authService.changePassword(
        testUser.id,
        testUser.password,
        '123' // 弱密码
      )).rejects.toThrow('Password does not meet requirements');
    });
    
    it('should prevent password reuse', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: testUser.id,
            password_hash: testUser.passwordHash
          }]
        });
      
      // Act & Assert
      await expect(authService.changePassword(
        testUser.id,
        testUser.password,
        testUser.password // 相同密码
      )).rejects.toThrow('Cannot use the same password');
    });
  });
  
  describe('verifyEmail', () => {
    it('should verify valid verification token', async () => {
      // Arrange
      const userId = 'user-123';
      const verifyToken = 'valid-verify-token';
      
      mockRedis.get = jest.fn().mockResolvedValue(userId);
      mockPool.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      mockRedis.del = jest.fn().mockResolvedValue(1);
      
      // Act
      const result = await authService.verifyEmail(verifyToken);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
      expect(mockRedis.del).toHaveBeenCalledWith(`verify_email:${verifyToken}`);
    });
    
    it('should reject invalid token', async () => {
      // Arrange
      mockRedis.get = jest.fn().mockResolvedValue(null);
      
      // Act & Assert
      await expect(authService.verifyEmail('invalid-token'))
        .rejects.toThrow('Invalid or expired verification token');
    });
    
    it('should update user verification status', async () => {
      // Arrange
      const userId = 'user-123';
      const verifyToken = 'valid-token';
      
      mockRedis.get = jest.fn().mockResolvedValue(userId);
      mockPool.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      mockRedis.del = jest.fn().mockResolvedValue(1);
      
      // Act
      await authService.verifyEmail(verifyToken);
      
      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([userId])
      );
    });
  });
  
  describe('logout', () => {
    it('should invalidate token successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const token = generateToken(userId);
      
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      // Act
      const result = await authService.logout(userId, token);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist'),
        expect.any(String),
        expect.any(String),
        expect.any(Number)
      );
    });
    
    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const token = generateToken(userId);
      
      mockRedis.set = jest.fn().mockRejectedValue(new Error('Redis error'));
      
      // Act
      const result = await authService.logout(userId, token);
      
      // Assert
      // 即使Redis失败，登出应该继续（降级处理）
      expect(result.success).toBe(true);
    });
  });
  
  describe('edge cases', () => {
    it('should handle concurrent registration attempts', async () => {
      // Arrange
      const email = 'test@example.com';
      mockPool.query = jest.fn()
        .mockResolvedValue({ rows: [] });
      
      // Act
      const promises = Array(10).fill(null).map(() =>
        authService.register({
          email,
          password: 'Test123!',
          username: 'test'
        })
      );
      
      const results = await Promise.allSettled(promises);
      
      // Assert
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      expect(fulfilled).toBeGreaterThan(0);
      expect(fulfilled).toBeLessThan(10); // 应该有一些失败（重复邮箱）
    });
    
    it('should handle null/undefined inputs', async () => {
      // Act & Assert
      await expect(authService.register({
        email: null as any,
        password: 'Test123!',
        username: 'test'
      })).rejects.toThrow();
      
      await expect(authService.login('', 'password'))
        .rejects.toThrow();
    });
  });
});

