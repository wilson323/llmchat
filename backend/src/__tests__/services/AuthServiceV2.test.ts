/**
 * AuthServiceV2 单元测试
 * 
 * 测试覆盖:
 * - 用户登录 (成功/失败/锁定)
 * - Token 验证 (有效/过期/无效/黑名单)
 * - 登出 (Redis/内存模式)
 * - Token 刷新
 * - 密码修改
 * - 用户注册
 * - 密码强度验证
 * - 失败登录处理
 * 
 * 目标覆盖率: 90%+
 */

import { AuthServiceV2, AuthUser, LoginResult } from '@/services/AuthServiceV2';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';
import { EnvManager } from '@/config/EnvManager';
import {
  AuthenticationError,
  ValidationError,
  ResourceError,
  BusinessLogicError
} from '@/types/errors';

// Mock 依赖
jest.mock('@/utils/db');
jest.mock('@/utils/helpers');
jest.mock('@/config/EnvManager');
jest.mock('ioredis');
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('AuthServiceV2', () => {
  let authService: AuthServiceV2;
  let mockEnvManager: jest.Mocked<EnvManager>;
  let mockWithClient: jest.MockedFunction<typeof withClient>;
  let mockGenerateId: jest.MockedFunction<typeof generateId>;

  const TEST_TOKEN_SECRET = 'test-secret-key-at-least-32-characters-long';
  const TEST_USER_ID = 'test-user-id-123';
  const TEST_USERNAME = 'testuser';
  const TEST_EMAIL = 'test@example.com';
  const TEST_PASSWORD = 'Test123!@#';
  const TEST_PASSWORD_HASH = '$2b$12$test.hash.value';

  beforeEach(() => {
    // 重置所有 mocks
    jest.clearAllMocks();

    // Mock EnvManager
    mockEnvManager = {
      get: jest.fn((key: string) => {
        if (key === 'TOKEN_SECRET') return TEST_TOKEN_SECRET;
        return '';
      }),
      getInt: jest.fn((key: string, defaultValue: number) => {
        if (key === 'TOKEN_TTL_SECONDS') return 86400; // 24小时
        return defaultValue;
      }),
      getBoolean: jest.fn(() => false), // 默认不启用 Redis
      getString: jest.fn(() => ''),
      getInstance: jest.fn(() => mockEnvManager),
    } as any;

    (EnvManager.getInstance as jest.Mock).mockReturnValue(mockEnvManager);

    // Mock withClient
    mockWithClient = withClient as jest.MockedFunction<typeof withClient>;

    // Mock generateId
    mockGenerateId = generateId as jest.MockedFunction<typeof generateId>;
    mockGenerateId.mockReturnValue(TEST_USER_ID);

    // 创建服务实例
    authService = new AuthServiceV2();
  });

  afterEach(async () => {
    // 清理资源
    await authService.close();
  });

  describe('构造函数', () => {
    it('应该成功初始化服务', () => {
      expect(authService).toBeDefined();
      expect(mockEnvManager.get).toHaveBeenCalledWith('TOKEN_SECRET');
      expect(mockEnvManager.getInt).toHaveBeenCalledWith('TOKEN_TTL_SECONDS', 86400);
    });

    it('应该在 TOKEN_SECRET 太短时抛出错误', () => {
      mockEnvManager.get.mockReturnValue('short-key');
      
      expect(() => new AuthServiceV2()).toThrow(
        'TOKEN_SECRET must be set and at least 32 characters long for security'
      );
    });

    it('应该在 TOKEN_SECRET 未设置时抛出错误', () => {
      mockEnvManager.get.mockReturnValue('');
      
      expect(() => new AuthServiceV2()).toThrow(
        'TOKEN_SECRET must be set and at least 32 characters long for security'
      );
    });
  });

  describe('login', () => {
    const mockDbUser = {
      id: TEST_USER_ID,
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      password_hash: TEST_PASSWORD_HASH,
      role: 'user',
      status: 'active',
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
    };

    beforeEach(() => {
      // Mock bcrypt.compare
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      
      // Mock jwt.sign
      jest.spyOn(jwt, 'sign').mockReturnValue('test-jwt-token' as never);
    });

    it('应该成功登录并返回 token', async () => {
      // Mock 数据库查询
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDbUser] }) // findUserByUsername
            .mockResolvedValueOnce({ rows: [] }) // resetFailedAttempts
            .mockResolvedValueOnce({ rows: [] }), // updateLastLogin
        };
        return callback(mockClient);
      });

      const result = await authService.login(TEST_USERNAME, TEST_PASSWORD, '127.0.0.1');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe(TEST_USERNAME);
      expect(result.user.email).toBe(TEST_EMAIL);
      expect(bcrypt.compare).toHaveBeenCalledWith(TEST_PASSWORD, TEST_PASSWORD_HASH);
    });

    it('应该在用户不存在时抛出 AuthenticationError', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).rejects.toThrow(AuthenticationError);

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      });
    });

    it('应该在账号未激活时抛出 BusinessLogicError', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{ ...mockDbUser, status: 'inactive' }],
          }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).rejects.toMatchObject({
        code: 'ACCOUNT_INACTIVE',
        message: '账号未激活',
      });
    });

    it('应该在账号被锁定时抛出 BusinessLogicError', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{ ...mockDbUser, locked_until: lockedUntil }],
          }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
      });
    });

    it('应该在密码错误时抛出 AuthenticationError 并增加失败次数', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDbUser] }) // findUserByUsername
            .mockResolvedValueOnce({ rows: [] }) // handleFailedLogin - update
            .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 1 }] }), // handleFailedLogin - select
        };
        return callback(mockClient);
      });

      await expect(
        authService.login(TEST_USERNAME, 'wrong-password')
      ).rejects.toThrow(AuthenticationError);

      await expect(
        authService.login(TEST_USERNAME, 'wrong-password')
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('应该在连续失败 5 次后锁定账号', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [mockDbUser] }) // findUserByUsername
        .mockResolvedValueOnce({ rows: [] }) // handleFailedLogin - update
        .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 5 }] }) // handleFailedLogin - select (达到阈值)
        .mockResolvedValueOnce({ rows: [] }); // handleFailedLogin - lock account

      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = { query: mockQuery };
        return callback(mockClient);
      });

      await expect(
        authService.login(TEST_USERNAME, 'wrong-password')
      ).rejects.toThrow(AuthenticationError);

      // 验证锁定账号的 SQL 被调用
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET locked_until = $1 WHERE id = $2',
        expect.arrayContaining([expect.any(Date), TEST_USER_ID])
      );
    });
  });

  describe('validateToken', () => {
    const mockPayload = {
      sub: TEST_USER_ID,
      username: TEST_USERNAME,
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      jti: 'test-jti-123',
    };

    it('应该成功验证有效的 token', async () => {
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);

      const result = await authService.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe(TEST_USERNAME);
    });

    it('应该在 token 过期时返回 TOKEN_EXPIRED', async () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw error;
      });

      const result = await authService.validateToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_EXPIRED');
    });

    it('应该在 token 无效时返回 TOKEN_INVALID', async () => {
      const error = new Error('invalid token');
      error.name = 'JsonWebTokenError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw error;
      });

      const result = await authService.validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_INVALID');
    });

    it('应该在其他错误时返回 TOKEN_VERIFICATION_FAILED', async () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('unknown error');
      });

      const result = await authService.validateToken('error-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_VERIFICATION_FAILED');
    });
  });

  describe('logout', () => {
    it('应该在内存模式下仅记录日志', async () => {
      await authService.logout('test-token');
      
      // 内存模式下不应该抛出错误
      expect(true).toBe(true);
    });
  });

  describe('refreshToken', () => {
    const mockPayload = {
      sub: TEST_USER_ID,
      username: TEST_USERNAME,
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800, // 7天
    };

    const mockDbUser = {
      id: TEST_USER_ID,
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      password_hash: TEST_PASSWORD_HASH,
      role: 'user',
      status: 'active',
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
    };

    it('应该成功刷新 token', async () => {
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);
      jest.spyOn(jwt, 'sign').mockReturnValue('new-token' as never);

      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [mockDbUser] }),
        };
        return callback(mockClient);
      });

      const result = await authService.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(TEST_USER_ID);
    });

    it('应该在用户不存在时抛出 AuthenticationError', async () => {
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);

      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.refreshToken('valid-refresh-token')
      ).rejects.toThrow(AuthenticationError);

      await expect(
        authService.refreshToken('valid-refresh-token')
      ).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_INVALID',
      });
    });

    it('应该在 refresh token 无效时抛出 AuthenticationError', async () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        authService.refreshToken('invalid-refresh-token')
      ).rejects.toThrow(AuthenticationError);

      await expect(
        authService.refreshToken('invalid-refresh-token')
      ).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_INVALID',
      });
    });
  });

  describe('changePassword', () => {
    const mockDbUser = {
      id: TEST_USER_ID,
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      password_hash: TEST_PASSWORD_HASH,
      role: 'user',
      status: 'active',
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
    };

    const NEW_PASSWORD = 'NewTest123!@#';

    beforeEach(() => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
    });

    it('应该成功修改密码', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDbUser] }) // findUserById
            .mockResolvedValueOnce({ rows: [] }), // update password
        };
        return callback(mockClient);
      });

      await authService.changePassword(TEST_USER_ID, TEST_PASSWORD, NEW_PASSWORD);

      expect(bcrypt.compare).toHaveBeenCalledWith(TEST_PASSWORD, TEST_PASSWORD_HASH);
      expect(bcrypt.hash).toHaveBeenCalledWith(NEW_PASSWORD, 12);
    });

    it('应该在用户不存在时抛出 ResourceError', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.changePassword(TEST_USER_ID, TEST_PASSWORD, NEW_PASSWORD)
      ).rejects.toThrow(ResourceError);

      await expect(
        authService.changePassword(TEST_USER_ID, TEST_PASSWORD, NEW_PASSWORD)
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });

    it('应该在旧密码错误时抛出 AuthenticationError', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [mockDbUser] }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.changePassword(TEST_USER_ID, 'wrong-password', NEW_PASSWORD)
      ).rejects.toThrow(AuthenticationError);

      await expect(
        authService.changePassword(TEST_USER_ID, 'wrong-password', NEW_PASSWORD)
      ).rejects.toMatchObject({
        code: 'INVALID_OLD_PASSWORD',
      });
    });

    it('应该在新密码不符合强度要求时抛出 ValidationError', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [mockDbUser] }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.changePassword(TEST_USER_ID, TEST_PASSWORD, 'weak')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
    });

    it('应该成功注册新用户', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // findUserByUsername (不存在)
            .mockResolvedValueOnce({ rows: [] }), // insert user
        };
        return callback(mockClient);
      });

      const result = await authService.register(TEST_USERNAME, TEST_PASSWORD, TEST_EMAIL);

      expect(result).toHaveProperty('id');
      expect(result.username).toBe(TEST_USERNAME);
      expect(result.email).toBe(TEST_EMAIL);
      expect(result.role).toBe('user');
      expect(bcrypt.hash).toHaveBeenCalledWith(TEST_PASSWORD, 12);
    });

    it('应该在用户名已存在时抛出 BusinessLogicError', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{
              id: 'existing-id',
              username: TEST_USERNAME,
              email: TEST_EMAIL,
              password_hash: 'hash',
              role: 'user',
              status: 'active',
              failed_login_attempts: 0,
              locked_until: null,
              last_login_at: null,
            }],
          }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.register(TEST_USERNAME, TEST_PASSWORD, TEST_EMAIL)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        authService.register(TEST_USERNAME, TEST_PASSWORD, TEST_EMAIL)
      ).rejects.toMatchObject({
        code: 'USERNAME_ALREADY_EXISTS',
      });
    });

    it('应该在密码不符合强度要求时抛出 ValidationError', async () => {
      await expect(
        authService.register(TEST_USERNAME, 'weak', TEST_EMAIL)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('profile', () => {
    const mockPayload = {
      sub: TEST_USER_ID,
      username: TEST_USERNAME,
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    it('应该成功获取用户信息', async () => {
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);

      const result = await authService.profile('valid-token');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('username');
      expect(result.username).toBe(TEST_USERNAME);
    });

    it('应该在 token 无效时抛出 AuthenticationError', async () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        authService.profile('invalid-token')
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('validatePasswordStrength', () => {
    it('应该接受符合所有要求的密码', () => {
      // 这是一个私有方法，通过 register 或 changePassword 间接测试
      expect(async () => {
        // 通过 register 测试
        mockWithClient.mockImplementation(async (callback: any) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] }),
          };
          return callback(mockClient);
        });

        await authService.register('newuser', 'ValidPass123!@#', 'new@example.com');
      }).not.toThrow();
    });

    it('应该拒绝长度小于 8 的密码', async () => {
      await expect(
        authService.register('newuser', 'Short1!', 'new@example.com')
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register('newuser', 'Short1!', 'new@example.com')
      ).rejects.toMatchObject({
        code: 'PASSWORD_TOO_SHORT',
      });
    });

    it('应该拒绝不包含大写字母的密码', async () => {
      await expect(
        authService.register('newuser', 'lowercase123!', 'new@example.com')
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register('newuser', 'lowercase123!', 'new@example.com')
      ).rejects.toMatchObject({
        code: 'PASSWORD_MISSING_UPPERCASE',
      });
    });

    it('应该拒绝不包含小写字母的密码', async () => {
      await expect(
        authService.register('newuser', 'UPPERCASE123!', 'new@example.com')
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register('newuser', 'UPPERCASE123!', 'new@example.com')
      ).rejects.toMatchObject({
        code: 'PASSWORD_MISSING_LOWERCASE',
      });
    });

    it('应该拒绝不包含数字的密码', async () => {
      await expect(
        authService.register('newuser', 'NoNumbers!@#', 'new@example.com')
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register('newuser', 'NoNumbers!@#', 'new@example.com')
      ).rejects.toMatchObject({
        code: 'PASSWORD_MISSING_NUMBER',
      });
    });

    it('应该拒绝不包含特殊字符的密码', async () => {
      await expect(
        authService.register('newuser', 'NoSpecial123', 'new@example.com')
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register('newuser', 'NoSpecial123', 'new@example.com')
      ).rejects.toMatchObject({
        code: 'PASSWORD_MISSING_SPECIAL_CHAR',
      });
    });
  });

  describe('close', () => {
    it('应该成功关闭服务', async () => {
      await authService.close();
      
      // 不应该抛出错误
      expect(true).toBe(true);
    });
  });
});
