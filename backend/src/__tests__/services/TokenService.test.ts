import { TokenService, TokenPayload } from "@/services/TokenService";
import Redis from "ioredis";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { getPool } from "@/utils/db";
import logger from "@/utils/logger";

// Mock dependencies
jest.mock("ioredis");
jest.mock("jsonwebtoken");
jest.mock("@/utils/db", () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(),
  })),
}));
jest.mock("@/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("TokenService", () => {
  let tokenService: TokenService;
  let mockRedis: jest.Mocked<Redis>;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Pool mock with default behavior
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    } as unknown as jest.Mocked<Pool>;

    // Mock getPool to return our mockPool
    (getPool as jest.Mock).mockReturnValue(mockPool);

    // Setup Redis mock
    mockRedis = {
      status: "ready",
      connect: jest.fn().mockResolvedValue(undefined),
      setex: jest.fn().mockResolvedValue("OK"),
      get: jest.fn().mockResolvedValue(null),
      exists: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      ttl: jest.fn().mockResolvedValue(3600),
      quit: jest.fn().mockResolvedValue("OK"),
      on: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    // Setup environment
    process.env.JWT_SECRET = "test-secret-key";
    process.env.TOKEN_TTL = "3600"; // 1 hour
    process.env.REFRESH_TOKEN_TTL = "7200"; // 2 hours

    tokenService = new TokenService();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.TOKEN_TTL;
    delete process.env.REFRESH_TOKEN_TTL;
  });

  describe("createAccessToken", () => {
    it("应该成功创建访问令牌", async () => {
      const mockToken = "mock-jwt-token";
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = await tokenService.createAccessToken(
        "user1",
        "testuser",
        "user"
      );

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user1",
          username: "testuser",
          role: "user",
        }),
        "test-secret-key"
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining("access:user1:"),
        3600,
        expect.any(String)
      );
    });

    it("应该在 Token 元数据中包含用户代理和 IP", async () => {
      const mockToken = "mock-jwt-token";
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      await tokenService.createAccessToken("user1", "testuser", "admin", {
        userAgent: "Mozilla/5.0",
        ip: "192.168.1.1",
      });

      const setexCall = mockRedis.setex.mock.calls[0];
      expect(setexCall).toBeDefined();
      const metadata = JSON.parse(setexCall![2] as string);

      expect(metadata.userAgent).toBe("Mozilla/5.0");
      expect(metadata.ip).toBe("192.168.1.1");
      expect(metadata.createdAt).toBeGreaterThan(0);
      expect(metadata.lastAccessedAt).toBeGreaterThan(0);
    });

    it("应该在 Redis 连接失败时抛出错误", async () => {
      mockRedis.status = "end";
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(
        tokenService.createAccessToken("user1", "testuser", "user")
      ).rejects.toThrow("Failed to connect to Redis");
    });
  });

  describe("createRefreshToken", () => {
    it("应该成功创建刷新令牌", async () => {
      const token = await tokenService.createRefreshToken("user1");

      expect(token).toHaveLength(64); // 32 bytes * 2 (hex)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining("refresh:user1:"),
        7200,
        expect.any(String)
      );
    });

    it("应该为不同用户生成不同的令牌", async () => {
      const token1 = await tokenService.createRefreshToken("user1");
      const token2 = await tokenService.createRefreshToken("user2");

      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyAccessToken", () => {
    it("应该成功验证有效令牌", async () => {
      const mockPayload: TokenPayload = {
        userId: "user1",
        username: "testuser",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          createdAt: mockPayload.iat,
          lastAccessedAt: mockPayload.iat,
        })
      );

      const result = await tokenService.verifyAccessToken("valid-token");

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret-key");
      expect(mockRedis.exists).toHaveBeenCalled();
    });

    it("应该拒绝已撤销的令牌（Redis 中不存在）", async () => {
      const mockPayload: TokenPayload = {
        userId: "user1",
        username: "testuser",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockRedis.exists.mockResolvedValue(0); // Token not in Redis

      const result = await tokenService.verifyAccessToken("revoked-token");

      expect(result).toBeNull();
    });

    it("应该拒绝无效的 JWT 令牌", async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError("invalid token");
      });

      const result = await tokenService.verifyAccessToken("invalid-token");

      expect(result).toBeNull();
    });

    it("应该拒绝过期的 JWT 令牌", async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new jwt.TokenExpiredError("jwt expired", new Date());
        throw error;
      });

      const result = await tokenService.verifyAccessToken("expired-token");

      expect(result).toBeNull();
    });

    it("应该更新最后访问时间", async () => {
      const mockPayload: TokenPayload = {
        userId: "user1",
        username: "testuser",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          createdAt: mockPayload.iat,
          lastAccessedAt: mockPayload.iat,
        })
      );
      mockRedis.ttl.mockResolvedValue(3000);

      await tokenService.verifyAccessToken("valid-token");

      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.ttl).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe("refreshAccessToken", () => {
    it("应该成功刷新访问令牌", async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockPool.query.mockResolvedValue({
        rows: [{ username: "testuser", role: "user" }],
        rowCount: 1,
      } as never);

      (jwt.sign as jest.Mock).mockReturnValue("new-access-token");

      const result = await tokenService.refreshAccessToken(
        "valid-refresh-token",
        "user1"
      );

      expect(result).not.toBeNull();
      if (result) {
        expect(result.accessToken).toBe("new-access-token");
        expect(result.newRefreshToken).toHaveLength(64);
      }
      expect(mockRedis.del).toHaveBeenCalled(); // Old refresh token deleted
    });

    it("应该拒绝无效的刷新令牌", async () => {
      mockRedis.exists.mockResolvedValue(0); // Refresh token not found

      const result = await tokenService.refreshAccessToken(
        "invalid-refresh-token",
        "user1"
      );

      expect(result).toBeNull();
    });

    it("应该在用户不存在时失败", async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as never);

      const result = await tokenService.refreshAccessToken(
        "valid-refresh-token",
        "user999"
      );

      expect(result).toBeNull();
    });
  });

  describe("revokeToken", () => {
    it("应该成功撤销单个令牌", async () => {
      await tokenService.revokeToken("token-to-revoke", "user1");

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("access:user1:")
      );
    });
  });

  describe("revokeAllTokens", () => {
    it("应该成功撤销用户所有令牌", async () => {
      const mockKeys = [
        "token:access:user1:hash1",
        "token:access:user1:hash2",
        "token:refresh:user1:hash3",
      ];
      mockRedis.keys.mockResolvedValue(mockKeys);

      await tokenService.revokeAllTokens("user1");

      expect(mockRedis.keys).toHaveBeenCalledWith("*:user1:*");
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys);
    });

    it("应该在没有令牌时不执行删除操作", async () => {
      mockRedis.keys.mockResolvedValue([]);

      await tokenService.revokeAllTokens("user1");

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("getActiveTokens", () => {
    it("应该返回用户活跃令牌列表", async () => {
      const mockKeys = ["token:access:user1:hash1", "token:access:user1:hash2"];
      const mockMetadata1 = { createdAt: 1000, lastAccessedAt: 2000 };
      const mockMetadata2 = { createdAt: 1000, lastAccessedAt: 3000 };

      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(mockMetadata1))
        .mockResolvedValueOnce(JSON.stringify(mockMetadata2));

      const tokens = await tokenService.getActiveTokens("user1");

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual(mockMetadata1);
      expect(tokens[1]).toEqual(mockMetadata2);
    });

    it("应该跳过无效的元数据", async () => {
      const mockKeys = ["token:access:user1:hash1", "token:access:user1:hash2"];
      const mockMetadata = { createdAt: 1000, lastAccessedAt: 2000 };

      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(mockMetadata))
        .mockResolvedValueOnce(null); // Second key has no data

      const tokens = await tokenService.getActiveTokens("user1");

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual(mockMetadata);
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("应该清理过期令牌", async () => {
      const mockKeys = ["token:access:user1:hash1", "token:access:user2:hash2"];
      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.ttl
        .mockResolvedValueOnce(-1) // First token expired
        .mockResolvedValueOnce(3600); // Second token still valid

      const cleaned = await tokenService.cleanupExpiredTokens();

      expect(cleaned).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith("token:access:user1:hash1");
    });

    it("应该在没有过期令牌时返回 0", async () => {
      mockRedis.keys.mockResolvedValue([]);

      const cleaned = await tokenService.cleanupExpiredTokens();

      expect(cleaned).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("应该成功关闭 Redis 连接", async () => {
      await tokenService.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe("安全性测试", () => {
    it("应该对令牌进行 SHA-256 散列", async () => {
      const mockToken = "test-token";
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      await tokenService.createAccessToken("user1", "testuser", "user");

      const setexCall = mockRedis.setex.mock.calls[0];
      expect(setexCall).toBeDefined();
      const key = setexCall![0] as string;

      // 验证 key 中包含散列后的 token
      expect(key).toMatch(/^access:user1:[a-f0-9]{64}$/);
    });

    it("应该生成加密安全的随机令牌", async () => {
      const token1 = await tokenService.createRefreshToken("user1");
      const token2 = await tokenService.createRefreshToken("user1");

      // 验证随机性
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("应该在缺少 JWT_SECRET 时生成警告", () => {
      delete process.env.JWT_SECRET;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // ^ 创建service实例仅用于触发警告日志，不需要使用返回的变量
      const service = new TokenService();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Using generated JWT secret"),
        expect.any(Object)
      );
    });
  });

  describe("并发场景测试", () => {
    it("应该正确处理并发令牌创建", async () => {
      (jwt.sign as jest.Mock).mockReturnValue("concurrent-token");

      const promises = Array.from({ length: 10 }, (_, i) =>
        tokenService.createAccessToken(`user${i}`, `testuser${i}`, "user")
      );

      const tokens = await Promise.all(promises);

      expect(tokens).toHaveLength(10);
      expect(mockRedis.setex).toHaveBeenCalledTimes(10);
    });

    it("应该正确处理并发令牌验证", async () => {
      const mockPayload: TokenPayload = {
        userId: "user1",
        username: "testuser",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          createdAt: mockPayload.iat,
          lastAccessedAt: mockPayload.iat,
        })
      );

      const promises = Array.from({ length: 10 }, () =>
        tokenService.verifyAccessToken("valid-token")
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toEqual(mockPayload);
      });
    });
  });

  describe("性能测试", () => {
    it("Token 创建应该在合理时间内完成 (<100ms)", async () => {
      (jwt.sign as jest.Mock).mockReturnValue("fast-token");

      const start = Date.now();
      await tokenService.createAccessToken("user1", "testuser", "user");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("Token 验证应该在合理时间内完成 (<50ms)", async () => {
      const mockPayload: TokenPayload = {
        userId: "user1",
        username: "testuser",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          createdAt: mockPayload.iat,
          lastAccessedAt: mockPayload.iat,
        })
      );

      const start = Date.now();
      await tokenService.verifyAccessToken("valid-token");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
