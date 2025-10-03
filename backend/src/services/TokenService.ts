import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Pool } from 'pg';
import { ValidationError, SystemError } from '@/types/errors';
import logger from '@/utils/logger';
import { getPool } from '@/utils/db';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

export interface TokenMetadata {
  createdAt: number;
  userAgent?: string;
  ip?: string;
  lastAccessedAt: number;
}

export class TokenService {
  private redis: Redis;
  private secret: string;
  private ttl: number;
  private refreshTtl: number;

  /**
   * 延迟获取数据库连接池
   * 避免在模块导入时调用 getPool()，确保 initDB() 已执行
   */
  private get pool(): Pool {
    return getPool();
  }

  constructor() {
    const redisConfig: {
      host: string;
      port: number;
      password?: string;
      db: number;
      keyPrefix: string;
      retryStrategy: (times: number) => number;
      lazyConnect: boolean;
    } = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: 'token:',
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true, // 延迟连接,避免测试环境启动失败
    };

    // 只在有密码时添加password字段
    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    this.redis = new Redis(redisConfig);
    this.secret = process.env.JWT_SECRET || this.generateSecret();
    this.ttl = parseInt(process.env.TOKEN_TTL || '604800', 10); // 7 天
    this.refreshTtl = parseInt(process.env.REFRESH_TOKEN_TTL || '2592000', 10); // 30 天
    // ✅ 不再在构造函数中调用 getPool()，改为使用 getter 延迟获取

    // 监听 Redis 连接事件
    this.redis.on('error', (err) => {
      logger.error('Redis connection error', { component: 'TokenService', error: err });
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully', { component: 'TokenService' });
    });
  }

  /**
   * 确保 Redis 连接已建立
   */
  private async ensureRedisConnected(): Promise<void> {
    if (this.redis.status !== 'ready') {
      try {
        await this.redis.connect();
      } catch (error) {
        throw new SystemError({
          message: 'Failed to connect to Redis',
          code: 'REDIS_CONNECTION_ERROR',
          originalError: error as Error,
        });
      }
    }
  }

  /**
   * 创建访问令牌
   */
  async createAccessToken(
    userId: string,
    username: string,
    role: 'admin' | 'user',
    metadata?: Partial<TokenMetadata>
  ): Promise<string> {
    await this.ensureRedisConnected();

    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      userId,
      username,
      role,
      iat: now,
      exp: now + this.ttl,
    };

    const token = jwt.sign(payload, this.secret);

    // 存储到 Redis
    const tokenKey = `access:${userId}:${this.hashToken(token)}`;
    const tokenMetadata: TokenMetadata = {
      createdAt: now,
      lastAccessedAt: now,
    };

    // 只在有值时添加可选字段
    if (metadata?.userAgent) {
      tokenMetadata.userAgent = metadata.userAgent;
    }
    if (metadata?.ip) {
      tokenMetadata.ip = metadata.ip;
    }

    await this.redis.setex(tokenKey, this.ttl, JSON.stringify(tokenMetadata));

    logger.info('Access token created', {
      component: 'TokenService',
      userId,
      username,
      role,
    });

    return token;
  }

  /**
   * 创建刷新令牌
   */
  async createRefreshToken(userId: string): Promise<string> {
    await this.ensureRedisConnected();

    const token = this.generateRandomToken();
    const refreshKey = `refresh:${userId}:${this.hashToken(token)}`;

    await this.redis.setex(refreshKey, this.refreshTtl, Date.now().toString());

    logger.info('Refresh token created', { component: 'TokenService', userId });

    return token;
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<TokenPayload | null> {
    await this.ensureRedisConnected();

    try {
      // JWT 验证
      const payload = jwt.verify(token, this.secret) as TokenPayload;

      // Redis 检查(支持主动撤销)
      const tokenKey = `access:${payload.userId}:${this.hashToken(token)}`;
      const exists = await this.redis.exists(tokenKey);

      if (!exists) {
        logger.warn('Token not found in Redis', {
          component: 'TokenService',
          userId: payload.userId,
        });
        return null;
      }

      // 更新最后访问时间
      await this.updateLastAccessed(tokenKey);

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid JWT token', {
          component: 'TokenService',
          error: (error as Error).message,
        });
      } else if (error instanceof jwt.TokenExpiredError) {
        logger.info('Token expired', {
          component: 'TokenService',
          expiredAt: (error as jwt.TokenExpiredError).expiredAt,
        });
      } else {
        logger.error('Token verification error', {
          component: 'TokenService',
          error,
        });
      }
      return null;
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(
    refreshToken: string,
    userId: string
  ): Promise<{ accessToken: string; newRefreshToken: string } | null> {
    await this.ensureRedisConnected();

    const refreshKey = `refresh:${userId}:${this.hashToken(refreshToken)}`;
    const exists = await this.redis.exists(refreshKey);

    if (!exists) {
      logger.warn('Refresh token not found', { component: 'TokenService', userId });
      return null;
    }

    // 获取用户信息
    const userInfo = await this.getUserInfo(userId);
    if (!userInfo) {
      logger.error('User not found during token refresh', {
        component: 'TokenService',
        userId,
      });
      return null;
    }

    // 创建新令牌对
    const accessToken = await this.createAccessToken(userId, userInfo.username, userInfo.role);
    const newRefreshToken = await this.createRefreshToken(userId);

    // 撤销旧的刷新令牌
    await this.redis.del(refreshKey);

    logger.info('Tokens refreshed', { component: 'TokenService', userId });

    return { accessToken, newRefreshToken };
  }

  /**
   * 撤销用户所有令牌
   */
  async revokeAllTokens(userId: string): Promise<void> {
    await this.ensureRedisConnected();

    const pattern = `*:${userId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      logger.info('All tokens revoked', {
        component: 'TokenService',
        userId,
        count: keys.length,
      });
    }
  }

  /**
   * 撤销单个令牌
   */
  async revokeToken(token: string, userId: string): Promise<void> {
    await this.ensureRedisConnected();

    const tokenKey = `access:${userId}:${this.hashToken(token)}`;
    await this.redis.del(tokenKey);
    logger.info('Token revoked', { component: 'TokenService', userId });
  }

  /**
   * 获取活跃令牌列表
   */
  async getActiveTokens(userId: string): Promise<TokenMetadata[]> {
    await this.ensureRedisConnected();

    const pattern = `access:${userId}:*`;
    const keys = await this.redis.keys(pattern);

    const tokens: TokenMetadata[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        tokens.push(JSON.parse(data) as TokenMetadata);
      }
    }

    return tokens;
  }

  /**
   * 辅助方法 - Token 散列
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 辅助方法 - 生成随机 Token
   */
  private generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 辅助方法 - 生成 JWT Secret
   */
  private generateSecret(): string {
    const secret = crypto.randomBytes(64).toString('hex');
    logger.warn('Using generated JWT secret. Set JWT_SECRET in production!', {
      component: 'TokenService',
    });
    return secret;
  }

  /**
   * 辅助方法 - 更新最后访问时间
   */
  private async updateLastAccessed(tokenKey: string): Promise<void> {
    const data = await this.redis.get(tokenKey);
    if (data) {
      const metadata: TokenMetadata = JSON.parse(data);
      metadata.lastAccessedAt = Math.floor(Date.now() / 1000);
      const ttl = await this.redis.ttl(tokenKey);
      if (ttl > 0) {
        await this.redis.setex(tokenKey, ttl, JSON.stringify(metadata));
      }
    }
  }

  /**
   * 辅助方法 - 从数据库获取用户信息
   */
  private async getUserInfo(
    userId: string
  ): Promise<{ username: string; role: 'admin' | 'user' } | null> {
    try {
      const result = await this.pool.query(
        'SELECT username, role FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        username: user.username as string,
        role: user.role as 'admin' | 'user',
      };
    } catch (error) {
      logger.error('Failed to fetch user info from database', {
        component: 'TokenService',
        userId,
        error,
      });
      return null;
    }
  }

  /**
   * 清理过期令牌(定时任务)
   */
  async cleanupExpiredTokens(): Promise<number> {
    await this.ensureRedisConnected();

    const pattern = '*:*:*';
    const keys = await this.redis.keys(pattern);

    let cleaned = 0;
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl < 0) {
        await this.redis.del(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired tokens', { component: 'TokenService', count: cleaned });
    }

    return cleaned;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('TokenService Redis connection closed', { component: 'TokenService' });
  }
}

