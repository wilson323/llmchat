/**
 * AuthController 单元测试
 * 
 * 测试范围：
 * - 用户注册
 * - 用户登录
 * - 邮箱验证
 * - Token刷新
 * - 密码修改
 * - 用户登出
 * 
 * 覆盖率目标：≥90%
 */

import { Request, Response } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { AuthServiceV2 } from '@/services/AuthServiceV2';
import { createTestUser, generateToken } from '../../helpers/testUtils';

// Mock AuthService
jest.mock('@/services/AuthServiceV2');

describe('AuthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAuthService: jest.Mocked<AuthServiceV2>;
  let authController: AuthController;
  
  beforeEach(() => {
    // 创建Mock Request
    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: undefined
    };
    
    // 创建Mock Response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    // 创建Mock Service
    mockAuthService = new AuthServiceV2() as jest.Mocked<AuthServiceV2>;
    authController = new AuthController();
    
    // 注入Mock Service
    (authController as any).authService = mockAuthService;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('register', () => {
    it('should register new user with valid data', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockRequest.body = {
        email: testUser.email,
        password: testUser.password,
        username: 'testuser'
      };
      
      mockAuthService.register = jest.fn().mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        emailVerified: false
      });
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockAuthService.register).toHaveBeenCalledWith({
        email: testUser.email,
        password: testUser.password,
        username: 'testuser'
      });
      
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUCCESS',
          message: expect.any(String),
          data: expect.objectContaining({
            id: testUser.id,
            email: testUser.email
          })
        })
      );
    });
    
    it('should reject duplicate email', async () => {
      // Arrange
      mockRequest.body = {
        email: 'existing@example.com',
        password: 'Test123!',
        username: 'existing'
      };
      
      mockAuthService.register = jest.fn().mockRejectedValue(
        new Error('Email already exists')
      );
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'EMAIL_EXISTS',
          message: expect.stringContaining('already exists')
        })
      );
    });
    
    it('should validate password strength', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        password: '123', // 弱密码
        username: 'test'
      };
      
      mockAuthService.register = jest.fn().mockRejectedValue(
        new Error('Password too weak')
      );
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_PASSWORD'
        })
      );
    });
    
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Test123!',
        username: 'test'
      };
      
      mockAuthService.register = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: expect.any(String)
        })
      );
    });
    
    it('should reject missing required fields', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com'
        // 缺少password
      };
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('required')
        })
      );
    });
    
    it('should reject invalid email format', async () => {
      // Arrange
      mockRequest.body = {
        email: 'invalid-email',
        password: 'Test123!',
        username: 'test'
      };
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_EMAIL'
        })
      );
    });
  });
  
  describe('login', () => {
    it('should login with correct credentials', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockRequest.body = {
        email: testUser.email,
        password: testUser.password
      };
      
      const token = generateToken(testUser.id);
      mockAuthService.login = jest.fn().mockResolvedValue({
        user: {
          id: testUser.id,
          email: testUser.email,
          emailVerified: true
        },
        token,
        refreshToken: 'refresh-token'
      });
      
      // Act
      await authController.login(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockAuthService.login).toHaveBeenCalledWith(
        testUser.email,
        testUser.password
      );
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUCCESS',
          data: expect.objectContaining({
            token,
            user: expect.objectContaining({
              id: testUser.id,
              email: testUser.email
            })
          })
        })
      );
    });
    
    it('should reject incorrect password', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };
      
      mockAuthService.login = jest.fn().mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      // Act
      await authController.login(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_CREDENTIALS'
        })
      );
    });
    
    it('should reject unverified email', async () => {
      // Arrange
      mockRequest.body = {
        email: 'unverified@example.com',
        password: 'Test123!'
      };
      
      mockAuthService.login = jest.fn().mockRejectedValue(
        new Error('Email not verified')
      );
      
      // Act
      await authController.login(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'EMAIL_NOT_VERIFIED'
        })
      );
    });
    
    it('should handle rate limiting', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Test123!'
      };
      
      mockAuthService.login = jest.fn().mockRejectedValue(
        new Error('Too many login attempts')
      );
      
      // Act
      await authController.login(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED'
        })
      );
    });
  });
  
  describe('verifyEmail', () => {
    it('should verify valid token', async () => {
      // Arrange
      mockRequest.params = { token: 'valid-verify-token' };
      
      mockAuthService.verifyEmail = jest.fn().mockResolvedValue({
        success: true,
        userId: 'user-123'
      });
      
      // Act
      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid-verify-token');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUCCESS',
          message: expect.stringContaining('verified')
        })
      );
    });
    
    it('should reject expired token', async () => {
      // Arrange
      mockRequest.params = { token: 'expired-token' };
      
      mockAuthService.verifyEmail = jest.fn().mockRejectedValue(
        new Error('Token expired')
      );
      
      // Act
      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOKEN_EXPIRED'
        })
      );
    });
    
    it('should reject invalid token', async () => {
      // Arrange
      mockRequest.params = { token: 'invalid-token' };
      
      mockAuthService.verifyEmail = jest.fn().mockRejectedValue(
        new Error('Invalid token')
      );
      
      // Act
      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_TOKEN'
        })
      );
    });
  });
  
  describe('refreshToken', () => {
    it('should refresh valid token', async () => {
      // Arrange
      mockRequest.body = { refreshToken: 'valid-refresh-token' };
      
      const newToken = generateToken('user-123');
      mockAuthService.refreshToken = jest.fn().mockResolvedValue({
        token: newToken,
        refreshToken: 'new-refresh-token'
      });
      
      // Act
      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUCCESS',
          data: expect.objectContaining({
            token: newToken
          })
        })
      );
    });
    
    it('should reject expired refresh token', async () => {
      // Arrange
      mockRequest.body = { refreshToken: 'expired-refresh-token' };
      
      mockAuthService.refreshToken = jest.fn().mockRejectedValue(
        new Error('Refresh token expired')
      );
      
      // Act
      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOKEN_EXPIRED'
        })
      );
    });
  });
  
  describe('changePassword', () => {
    it('should change password with correct old password', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockRequest.user = { userId: testUser.id };
      mockRequest.body = {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };
      
      mockAuthService.changePassword = jest.fn().mockResolvedValue({
        success: true
      });
      
      // Act
      await authController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        testUser.id,
        'OldPassword123!',
        'NewPassword123!'
      );
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUCCESS',
          message: expect.stringContaining('changed')
        })
      );
    });
    
    it('should reject incorrect old password', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockRequest.user = { userId: testUser.id };
      mockRequest.body = {
        oldPassword: 'WrongOldPassword!',
        newPassword: 'NewPassword123!'
      };
      
      mockAuthService.changePassword = jest.fn().mockRejectedValue(
        new Error('Incorrect old password')
      );
      
      // Act
      await authController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_PASSWORD'
        })
      );
    });
    
    it('should validate new password strength', async () => {
      // Arrange
      const testUser = await createTestUser();
      mockRequest.user = { userId: testUser.id };
      mockRequest.body = {
        oldPassword: 'OldPassword123!',
        newPassword: '123' // 弱密码
      };
      
      mockAuthService.changePassword = jest.fn().mockRejectedValue(
        new Error('New password too weak')
      );
      
      // Act
      await authController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'WEAK_PASSWORD'
        })
      );
    });
  });
  
  describe('logout', () => {
    it('should invalidate token on logout', async () => {
      // Arrange
      const testUser = await createTestUser();
      const token = generateToken(testUser.id);
      mockRequest.user = { userId: testUser.id };
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockAuthService.logout = jest.fn().mockResolvedValue({
        success: true
      });
      
      // Act
      await authController.logout(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockAuthService.logout).toHaveBeenCalledWith(testUser.id, token);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUCCESS',
          message: expect.stringContaining('logged out')
        })
      );
    });
    
    it('should handle missing token', async () => {
      // Arrange
      mockRequest.user = { userId: 'user-123' };
      mockRequest.headers = {}; // 缺少token
      
      // Act
      await authController.logout(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MISSING_TOKEN'
        })
      );
    });
  });
  
  describe('edge cases', () => {
    it('should handle malformed request body', async () => {
      // Arrange
      mockRequest.body = null;
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
    
    it('should handle very long email', async () => {
      // Arrange
      const longEmail = 'a'.repeat(300) + '@example.com';
      mockRequest.body = {
        email: longEmail,
        password: 'Test123!',
        username: 'test'
      };
      
      mockAuthService.register = jest.fn().mockRejectedValue(
        new Error('Email too long')
      );
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
    
    it('should handle SQL injection attempts', async () => {
      // Arrange
      mockRequest.body = {
        email: "'; DROP TABLE users; --",
        password: 'Test123!',
        username: 'test'
      };
      
      // Act
      await authController.register(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });
  });
});

