/**
 * AuthServiceV2 Redis 功能测试
 * 
 * 测试 Redis 相关功能:
 * - Token 黑名单
 * - 会话存储
 * - 登出功能
 * 
 * 目标: 提升覆盖率到 90%+
 */

import { AuthServiceV2 } from '@/services/AuthServiceV2';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';
import { EnvManager } from '@/config/EnvManager';
import Redis from 'ioredis';

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

describe('AuthServiceV2 - Redis 功能', () => {
  let authService: AuthServiceV2;
  let mockEnvManager: jest.Mocked<EnvManager>;
  let mockWithClient: jest.MockedFunction<typeof withClient>;
  let mockGenerateId: jest.MockedFunction<typeof generateId>;
  let mockRedis: jest.Mocked<Redis>;

  const TEST_TOKEN_SECRET = 'test-secret-key-at-least-32-characters-long';
  const TEST_USER_ID = 'test-user-id-123';
  const TEST_USERNAME = 'testuser';
  const TEST_EMAIL = 'test@example.com';
  const TEST_PASSWORD = 'Test123!@#';
  const TEST_PASSWORD_HASH = '$2b$12$test.hash.value';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      exists: jest.fn().mockResolvedValue(0),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    } as any;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    // Mock EnvManager with Redis enabled
    mockEnvManager = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'TOKEN_SECRET') return TEST_TOKEN_SECRET;
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return '6379';
        if (key === 'REDIS_PASSWORD') return '';
        return defaultValue || '';
      }),
      getInt: jest.fn((key: string, defaultValue: number) => {
        if (key === 'TOKEN_TTL_SECONDS') return 86400;
        if (key === 'REDIS_PORT') return 6379;
        if (key === 'REDIS_DB') return 0;
        return defaultValue;
      }),
      getBoolean: jest.fn((key: string) => {
        if (key === 'REDIS_ENABLED') return true;
        return false;
      }),
      getString: jest.fn(() => ''),
      getInstance: jest.fn(() => mockEnvManager),
    } as any;

    (EnvManager.getInstance as jest.Mock).mockReturnValue(mockEnvManager);

    // Mock withClient
    mockWithClient = withClient as jest.MockedFunction<typeof withClient>;

    // Mock generateId
    mockGenerateId = generateId as jest.MockedFunction<typeof generateId>;
    mockGenerateId.mockReturnValue(TEST_USER_ID);

    // Mock bcrypt
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

    // Mock jwt
    jest.spyOn(jwt, 'sign').mockReturnValue('test-jwt-token' as never);
    jest.spyOn(jwt, 'decode').mockReturnValue({
      sub: TEST_USER_ID,
      jti: 'test-jti-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
    } as any);

    // 创建服务实例 (启用 Redis)
    authService = new AuthServiceV2();
  });

  afterEach(async () => {
    await authService.close();
  });

  describe('validateToken - Redis 黑名单', () => {
    it('应该在 token 在黑名单中时返回 TOKEN_REVOKED', async () => {
      const mockPayload = {
        sub: TEST_USER_ID,
        username: TEST_USERNAME,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        jti: 'test-jti-123',
      };

      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);
      mockRedis.exists.mockResolvedValue(1); // Token 在黑名单中

      const result = await authService.validateToken('blacklisted-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_REVOKED');
      expect(mockRedis.exists).toHaveBeenCalledWith('auth:blacklist:test-jti-123');
    });

    it('应该在 token 不在黑名单中时验证成功', async () => {
      const mockPayload = {
        sub: TEST_USER_ID,
        username: TEST_USERNAME,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        jti: 'test-jti-123',
      };

      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);
      mockRedis.exists.mockResolvedValue(0); // Token 不在黑名单中

      const result = await authService.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
    });
  });

  describe('logout - Redis 模式', () => {
    it('应该成功将 token 加入黑名单并删除会话', async () => {
      await authService.logout('test-token');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'auth:blacklist:test-jti-123',
        expect.any(Number),
        '1'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`auth:session:${TEST_USER_ID}`);
    });

    it('应该在 token 没有 jti 时直接返回', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        sub: TEST_USER_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as any);

      await authService.logout('token-without-jti');

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('应该在 token 已过期时不加入黑名单', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        sub: TEST_USER_ID,
        jti: 'test-jti-123',
        exp: Math.floor(Date.now() / 1000) - 3600, // 已过期
      } as any);

      await authService.logout('expired-token');

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('应该在 Redis 错误时记录日志但不抛出异常', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(authService.logout('test-token')).resolves.not.toThrow();
    });
  });

  describe('login - Redis 会话存储', () => {
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

    it('应该在登录成功后存储会话到 Redis', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDbUser] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient);
      });

      await authService.login(TEST_USERNAME, TEST_PASSWORD, '127.0.0.1');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `auth:session:${TEST_USER_ID}`,
        86400,
        expect.stringContaining('127.0.0.1')
      );
    });

    it('应该在 Redis 存储失败时记录日志但不影响登录', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDbUser] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient);
      });

      await expect(
        authService.login(TEST_USERNAME, TEST_PASSWORD)
      ).resolves.toHaveProperty('token');
    });
  });

  describe('changePassword - Redis 会话清理', () => {
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

    it('应该在修改密码后删除 Redis 会话', async () => {
      mockWithClient.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockDbUser] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient);
      });

      await authService.changePassword(TEST_USER_ID, TEST_PASSWORD, 'NewPass123!@#');

      expect(mockRedis.del).toHaveBeenCalledWith(`auth:session:${TEST_USER_ID}`);
    });
  });

  describe('close - Redis 连接关闭', () => {
    it('应该成功关闭 Redis 连接', async () => {
      await authService.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('Redis 初始化错误处理', () => {
    it('应该在 Redis 连接失败时记录错误但不抛出异常', () => {
      mockRedis.on.mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
        if (event === 'error') {
          callback(new Error('Connection failed'));
        }
        return mockRedis;
      });

      // 创建新实例触发 Redis 初始化
      expect(() => new AuthServiceV2()).not.toThrow();
    });
  });
});
