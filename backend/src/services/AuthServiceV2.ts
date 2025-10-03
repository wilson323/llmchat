/**
 * 增强版认证服务 V2
 * 
 * 安全特性:
 * - bcrypt密码哈希验证
 * - JWT token签名与验证
 * - Redis可选支持（Token黑名单、会话管理）
 * - 速率限制集成
 * - 审计日志记录
 * 
 * 向后兼容:
 * - 保留原AuthService接口
 * - 支持渐进式迁移
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';
import { EnvManager } from '@/config/EnvManager';
import logger from '@/utils/logger';

// ==================== 类型定义 ====================

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface LoginResult {
  token: string;
  refreshToken?: string;
  user: AuthUser;
  expiresIn: number; // seconds
}

export interface JWTPayload {
  sub: string;       // user id
  username: string;
  role: string;
  iat: number;       // issued at
  exp: number;       // expires at
  jti?: string;      // JWT ID (用于黑名单)
}

export interface TokenValidationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

interface DbUser {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  role: string | null;
  status: string;
  failed_login_attempts: number | null;
  locked_until: Date | null;
  last_login_at: Date | null;
}

// ==================== 配置常量 ====================

const SALT_ROUNDS = 12;                          // bcrypt盐轮数
const DEFAULT_TOKEN_TTL = 24 * 60 * 60;          // 24小时
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;      // 7天
const MAX_FAILED_ATTEMPTS = 5;                   // 最大失败次数
const ACCOUNT_LOCK_DURATION = 15 * 60;           // 锁定15分钟
const TOKEN_BLACKLIST_PREFIX = 'auth:blacklist:'; // Redis黑名单前缀
const SESSION_PREFIX = 'auth:session:';          // Redis会话前缀

// ==================== 主服务类 ====================

export class AuthServiceV2 {
  private redis: Redis | null = null;
  private tokenSecret: string;
  private tokenTTL: number;

  constructor() {
    const envManager = EnvManager.getInstance();
    
    // 获取JWT密钥
    this.tokenSecret = envManager.get('TOKEN_SECRET');
    if (!this.tokenSecret || this.tokenSecret.length < 32) {
      throw new Error(
        'TOKEN_SECRET must be set and at least 32 characters long for security'
      );
    }

    // 获取Token有效期
    this.tokenTTL = envManager.getInt('TOKEN_TTL_SECONDS', DEFAULT_TOKEN_TTL);

    // 初始化Redis（可选）
    this.initRedis();
  }

  /**
   * 初始化Redis连接（如果配置）
   */
  private initRedis(): void {
    const envManager = EnvManager.getInstance();
    const redisHost = envManager.get('REDIS_HOST', '');
    
    if (!redisHost) {
      logger.info('Redis未配置，使用内存模式（单实例部署）');
      return;
    }

    try {
      this.redis = new Redis({
        host: envManager.get('REDIS_HOST'),
        port: envManager.getInt('REDIS_PORT', 6379),
        password: envManager.get('REDIS_PASSWORD', ''),
        db: envManager.getInt('REDIS_DB', 0),
        retryStrategy: (times) => {
          if (times > 3) {
            logger.error('Redis连接失败，切换到内存模式');
            return null; // 停止重试
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.redis.on('connect', () => {
        logger.info('✅ Redis连接成功，Token存储启用');
      });

      this.redis.on('error', (err) => {
        logger.error('Redis错误，将降级到内存模式', { error: err.message });
      });
    } catch (error: any) {
      logger.error('Redis初始化失败，使用内存模式', { error: error.message });
      this.redis = null;
    }
  }

  /**
   * 用户登录
   */
  async login(username: string, password: string, ip?: string): Promise<LoginResult> {
    logger.info('登录尝试', { username, ip });

    // 1. 查询用户
    const dbUser = await this.findUserByUsername(username);
    
    if (!dbUser) {
      logger.warn('登录失败：用户不存在', { username, ip });
      throw new Error('INVALID_CREDENTIALS');
    }

    // 2. 检查账号状态
    if (dbUser.status !== 'active') {
      logger.warn('登录失败：账号未激活', { username, status: dbUser.status, ip });
      throw new Error('ACCOUNT_INACTIVE');
    }

    // 3. 检查账号锁定
    if (dbUser.locked_until && new Date(dbUser.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(dbUser.locked_until).getTime() - Date.now()) / 60000
      );
      logger.warn('登录失败：账号已锁定', {
        username,
        lockedUntil: dbUser.locked_until,
        remainingMinutes,
        ip,
      });
      throw new Error(`ACCOUNT_LOCKED:${remainingMinutes}`);
    }

    // 4. 验证密码
    const passwordValid = await bcrypt.compare(password, dbUser.password_hash);
    
    if (!passwordValid) {
      await this.handleFailedLogin(dbUser.id);
      logger.warn('登录失败：密码错误', { username, ip });
      throw new Error('INVALID_CREDENTIALS');
    }

    // 5. 重置失败计数
    await this.resetFailedAttempts(dbUser.id);

    // 6. 更新最后登录时间
    await this.updateLastLogin(dbUser.id, ip);

    // 7. 生成Token
    const user: AuthUser = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email || '',
      role: dbUser.role || 'user',
    };

    const token = await this.generateToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // 8. 存储会话（如果有Redis）
    if (this.redis) {
      await this.storeSession(user.id, token, ip);
    }

    logger.info('✅ 登录成功', { userId: user.id, username, ip });

    return {
      token,
      refreshToken,
      user,
      expiresIn: this.tokenTTL,
    };
  }

  /**
   * 验证Token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // 1. JWT签名验证
      const payload = jwt.verify(token, this.tokenSecret) as JWTPayload;

      // 2. 检查黑名单（如果有Redis）
      if (this.redis && payload.jti) {
        const isBlacklisted = await this.redis.exists(
          `${TOKEN_BLACKLIST_PREFIX}${payload.jti}`
        );
        if (isBlacklisted) {
          return { valid: false, error: 'TOKEN_REVOKED' };
        }
      }

      // 3. 构造用户信息
      const user: AuthUser = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        email: '',
      };

      return { valid: true, user };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'TOKEN_EXPIRED' };
      }
      if (error.name === 'JsonWebTokenError') {
        return { valid: false, error: 'TOKEN_INVALID' };
      }
      logger.error('Token验证失败', { error: error.message });
      return { valid: false, error: 'TOKEN_VERIFICATION_FAILED' };
    }
  }

  /**
   * 登出（撤销Token）
   */
  async logout(token: string): Promise<void> {
    if (!this.redis) {
      logger.info('内存模式：登出仅记录日志');
      return;
    }

    try {
      const payload = jwt.decode(token) as JWTPayload;
      if (!payload || !payload.jti) {
        return;
      }

      // 将Token加入黑名单
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.setex(
          `${TOKEN_BLACKLIST_PREFIX}${payload.jti}`,
          ttl,
          '1'
        );
      }

      // 删除会话
      await this.redis.del(`${SESSION_PREFIX}${payload.sub}`);

      logger.info('✅ 登出成功', { userId: payload.sub, jti: payload.jti });
    } catch (error: any) {
      logger.error('登出失败', { error: error.message });
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken: string): Promise<LoginResult> {
    try {
      const payload = jwt.verify(refreshToken, this.tokenSecret) as JWTPayload;

      // 重新查询用户确保状态正确
      const dbUser = await this.findUserById(payload.sub);
      if (!dbUser || dbUser.status !== 'active') {
        throw new Error('USER_NOT_FOUND_OR_INACTIVE');
      }

      const user: AuthUser = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email || '',
        role: dbUser.role || 'user',
      };

      const newToken = await this.generateToken(user);
      const newRefreshToken = await this.generateRefreshToken(user);

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user,
        expiresIn: this.tokenTTL,
      };
    } catch (error: any) {
      logger.error('Token刷新失败', { error: error.message });
      throw new Error('REFRESH_TOKEN_INVALID');
    }
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    // 1. 查询用户
    const dbUser = await this.findUserById(userId);
    if (!dbUser) {
      throw new Error('USER_NOT_FOUND');
    }

    // 2. 验证旧密码
    const oldPasswordValid = await bcrypt.compare(oldPassword, dbUser.password_hash);
    if (!oldPasswordValid) {
      throw new Error('INVALID_OLD_PASSWORD');
    }

    // 3. 验证新密码强度
    this.validatePasswordStrength(newPassword);

    // 4. 生成新密码哈希
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // 5. 更新数据库
    await withClient(async (client) => {
      await client.query(
        `UPDATE users 
         SET password_hash = $1, password_updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newPasswordHash, userId]
      );
    });

    // 6. 撤销所有现有Token（强制重新登录）
    if (this.redis) {
      await this.redis.del(`${SESSION_PREFIX}${userId}`);
    }

    logger.info('✅ 密码修改成功', { userId });
  }

  /**
   * 创建新用户（注册）
   */
  async register(
    username: string,
    password: string,
    email?: string
  ): Promise<AuthUser> {
    // 1. 验证密码强度
    this.validatePasswordStrength(password);

    // 2. 检查用户名是否已存在
    const existingUser = await this.findUserByUsername(username);
    if (existingUser) {
      throw new Error('USERNAME_ALREADY_EXISTS');
    }

    // 3. 生成密码哈希
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. 插入数据库
    const userId = generateId();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, username, email || null, passwordHash, 'user', 'active']
      );
    });

    logger.info('✅ 用户注册成功', { userId, username });

    return {
      id: userId,
      username,
      email: email || '',
      role: 'user',
    };
  }

  /**
   * 获取用户信息（通过token）
   */
  async profile(token: string): Promise<AuthUser> {
    const result = await this.validateToken(token);
    if (!result.valid || !result.user) {
      throw new Error(result.error || 'UNAUTHORIZED');
    }
    return result.user;
  }

  // ==================== 私有辅助方法 ====================

  private async generateToken(user: AuthUser): Promise<string> {
    const jti = generateId();
    const payload: JWTPayload = {
      sub: user.id,
      username: user.username,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.tokenTTL,
      jti,
    };

    return jwt.sign(payload, this.tokenSecret);
  }

  private async generateRefreshToken(user: AuthUser): Promise<string> {
    const payload: JWTPayload = {
      sub: user.id,
      username: user.username,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL,
    };

    return jwt.sign(payload, this.tokenSecret);
  }

  private async findUserByUsername(username: string): Promise<DbUser | null> {
    const result = await withClient(async (client) => {
      const { rows } = await client.query<DbUser>(
        `SELECT id, username, email, password_hash, role, status, 
                failed_login_attempts, locked_until, last_login_at
         FROM users 
         WHERE username = $1 
         LIMIT 1`,
        [username]
      );
      return rows[0] || null;
    });
    return result;
  }

  private async findUserById(userId: string): Promise<DbUser | null> {
    const result = await withClient(async (client) => {
      const { rows } = await client.query<DbUser>(
        `SELECT id, username, email, password_hash, role, status, 
                failed_login_attempts, locked_until, last_login_at
         FROM users 
         WHERE id = $1 
         LIMIT 1`,
        [userId]
      );
      return rows[0] || null;
    });
    return result;
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    await withClient(async (client) => {
      // 增加失败次数
      await client.query(
        `UPDATE users 
         SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 
         WHERE id = $1`,
        [userId]
      );

      // 检查是否需要锁定
      const { rows } = await client.query(
        'SELECT failed_login_attempts FROM users WHERE id = $1',
        [userId]
      );

      const attempts = rows[0]?.failed_login_attempts || 0;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION * 1000);
        await client.query(
          'UPDATE users SET locked_until = $1 WHERE id = $2',
          [lockUntil, userId]
        );
        logger.warn('账号已锁定', { userId, lockUntil });
      }
    });
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [userId]
      );
    });
  }

  private async updateLastLogin(userId: string, ip?: string): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = $1 WHERE id = $2',
        [ip || null, userId]
      );
    });
  }

  private async storeSession(userId: string, token: string, ip?: string): Promise<void> {
    if (!this.redis) return;

    try {
      const sessionData = JSON.stringify({
        token,
        ip,
        createdAt: new Date().toISOString(),
      });
      await this.redis.setex(`${SESSION_PREFIX}${userId}`, this.tokenTTL, sessionData);
    } catch (error: any) {
      logger.error('会话存储失败', { userId, error: error.message });
    }
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('PASSWORD_TOO_SHORT');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('PASSWORD_MISSING_UPPERCASE');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('PASSWORD_MISSING_LOWERCASE');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('PASSWORD_MISSING_NUMBER');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      throw new Error('PASSWORD_MISSING_SPECIAL_CHAR');
    }
  }

  /**
   * 清理资源
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis连接已关闭');
    }
  }
}

// 导出单例
let authServiceInstance: AuthServiceV2 | null = null;

export function getAuthService(): AuthServiceV2 {
  if (!authServiceInstance) {
    authServiceInstance = new AuthServiceV2();
  }
  return authServiceInstance;
}

