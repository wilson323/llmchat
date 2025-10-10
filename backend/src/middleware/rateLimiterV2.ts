/**
 * 增强版速率限制中间件 V2
 *
 * 特性:
 * - Redis集中化存储（支持多实例部署）
 * - 内存降级模式（Redis不可用时）
 * - 灵活的限流策略（按IP/用户/端点）
 * - 详细的限流指标
 * - 白名单支持
 *
 * 向后兼容:
 * - 保留原rateLimiter接口
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import { EnvManager } from '@/config/EnvManager';
import logger from '@/utils/logger';

// ==================== 类型定义 ====================

export interface RateLimitConfig {
  points: number;           // 请求数量
  duration: number;         // 时间窗口（秒）
  blockDuration?: number;   // 阻止时间（秒）
  keyPrefix?: string;       // Redis键前缀
  whitelist?: Array<string>; // IP白名单
}

export interface RateLimitOptions {
  config?: RateLimitConfig;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// ==================== 预设配置 ====================

export const RATE_LIMIT_PRESETS = {
  // 通用API限流
  api: {
    points: 100,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rl:api:',
  },

  // 聊天接口限流
  chat: {
    points: 30,
    duration: 60,
    blockDuration: 120,
    keyPrefix: 'rl:chat:',
  },

  // 管理接口限流
  admin: {
    points: 200,
    duration: 60,
    blockDuration: 30,
    keyPrefix: 'rl:admin:',
  },

  // 登录接口限流（防止暴力破解）
  login: {
    points: 5,
    duration: 60,
    blockDuration: 900, // 15分钟
    keyPrefix: 'rl:login:',
  },

  // 注册接口限流
  register: {
    points: 3,
    duration: 3600, // 1小时
    blockDuration: 3600,
    keyPrefix: 'rl:register:',
  },
} as const;

// ==================== Rate Limiter管理器 ====================

class RateLimiterManager {
  private redis: Redis | null = null;
  private limiters = new Map<string, RateLimiterRedis | RateLimiterMemory>();
  private isRedisAvailable = false;

  constructor() {
    this.initRedis();
  }

  /**
   * 初始化Redis连接
   */
  private initRedis(): void {
    const envManager = EnvManager.getInstance();
    const redisHost = envManager.get('REDIS_HOST', '');

    if (!redisHost) {
      logger.info('RateLimiter: Redis未配置，使用内存模式');
      return;
    }

    try {
      this.redis = new Redis({
        host: envManager.get('REDIS_HOST'),
        port: envManager.getInt('REDIS_PORT', 6379),
        password: envManager.get('REDIS_PASSWORD', ''),
        db: envManager.getInt('REDIS_DB', 1), // 使用独立DB
        retryStrategy: (times) => {
          if (times > 3) {
            logger.error('RateLimiter: Redis连接失败，切换到内存模式');
            this.isRedisAvailable = false;
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.redis.on('connect', () => {
        this.isRedisAvailable = true;
        logger.info('✅ RateLimiter: Redis连接成功');
      });

      this.redis.on('error', (err) => {
        this.isRedisAvailable = false;
        logger.error('RateLimiter: Redis错误', { error: err.message });
      });

      this.redis.on('close', () => {
        this.isRedisAvailable = false;
        logger.warn('RateLimiter: Redis连接关闭，降级到内存模式');
      });

    } catch (error: any) {
      logger.error('RateLimiter: Redis初始化失败', { error: error.message });
      this.redis = null;
      this.isRedisAvailable = false;
    }
  }

  /**
   * 获取或创建Limiter实例
   */
  getLimiter(config: RateLimitConfig): RateLimiterRedis | RateLimiterMemory {
    const key = `${config.keyPrefix}${config.points}:${config.duration}`;

    if (this.limiters.has(key)) {
      return this.limiters.get(key)!;
    }

    let limiter: RateLimiterRedis | RateLimiterMemory;

    if (this.isRedisAvailable && this.redis) {
      const redisOptions: any = {
        storeClient: this.redis,
        points: config.points,
        duration: config.duration,
      };
      if (config.blockDuration !== undefined) {
        redisOptions.blockDuration = config.blockDuration;
      }
      if (config.keyPrefix !== undefined) {
        redisOptions.keyPrefix = config.keyPrefix;
      }
      limiter = new RateLimiterRedis(redisOptions);
      logger.debug('创建Redis RateLimiter', { config });
    } else {
      const memoryOptions: any = {
        points: config.points,
        duration: config.duration,
      };
      if (config.blockDuration !== undefined) {
        memoryOptions.blockDuration = config.blockDuration;
      }
      limiter = new RateLimiterMemory(memoryOptions);
      logger.debug('创建Memory RateLimiter (降级模式)', { config });
    }

    this.limiters.set(key, limiter);
    return limiter;
  }

  /**
   * 清理资源
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('RateLimiter: Redis连接已关闭');
    }
    this.limiters.clear();
  }

  /**
   * 获取状态
   */
  getStatus(): { mode: string; limiters: number } {
    return {
      mode: this.isRedisAvailable ? 'redis' : 'memory',
      limiters: this.limiters.size,
    };
  }
}

// 单例
const rateLimiterManager = new RateLimiterManager();

// ==================== 中间件工厂函数 ====================

/**
 * 创建速率限制中间件
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    config = RATE_LIMIT_PRESETS.api,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  const limiter = rateLimiterManager.getLimiter(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 检查白名单
      if ('whitelist' in config && config.whitelist && isWhitelisted(req, config.whitelist)) {
        return next();
      }

      // 生成限流键
      const key = keyGenerator(req);

      // 消费点数
      const rateLimiterRes = await limiter.consume(key);

      // 设置响应头
      setRateLimitHeaders(res, rateLimiterRes, config);

      // 跳过成功请求的计数（可选）
      if (skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode < 400) {
            limiter.reward(key, 1);
          }
        });
      }

      // 跳过失败请求的计数（可选）
      if (skipFailedRequests) {
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            limiter.reward(key, 1);
          }
        });
      }

      next();

    } catch (rejRes: any) {
      // 限流触发
      handleRateLimitExceeded(req, res, rejRes, config);
    }
  };
}

// ==================== 辅助函数 ====================

/**
 * 默认键生成器（使用IP地址）
 */
function defaultKeyGenerator(req: Request): string {
  // 优先使用真实IP（信任代理）
  const ip = req.ip ||
             req.headers['x-forwarded-for'] ||
             req.headers['x-real-ip'] ||
             req.socket.remoteAddress ||
             'anonymous';
  const finalIp = Array.isArray(ip) ? ip[0] : ip;
  return finalIp || 'anonymous';
}

/**
 * 基于用户的键生成器
 */
export function userKeyGenerator(req: Request): string {
  // 从req.user获取（需要auth middleware）
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }
  // 降级到IP
  return defaultKeyGenerator(req);
}

/**
 * 基于端点的键生成器
 */
export function endpointKeyGenerator(req: Request): string {
  const ip = defaultKeyGenerator(req);
  const path = req.path;
  return `${ip}:${path}`;
}

/**
 * 检查是否在白名单中
 */
function isWhitelisted(req: Request, whitelist: Array<string>): boolean {
  const ip = defaultKeyGenerator(req);
  return whitelist.includes(ip);
}

/**
 * 设置速率限制响应头
 */
function setRateLimitHeaders(
  res: Response,
  rateLimiterRes: RateLimiterRes,
  config: RateLimitConfig,
): void {
  res.set({
    'X-RateLimit-Limit': config.points.toString(),
    'X-RateLimit-Remaining': rateLimiterRes.remainingPoints.toString(),
    'X-RateLimit-Reset': new Date(
      Date.now() + rateLimiterRes.msBeforeNext,
    ).toISOString(),
  });
}

/**
 * 处理速率限制超出
 */
function handleRateLimitExceeded(
  req: Request,
  res: Response,
  rejRes: any,
  config: RateLimitConfig,
): void {
  const msBeforeNext = rejRes?.msBeforeNext || 60000;
  const retryAfter = Math.round(msBeforeNext / 1000);

  // 设置响应头
  res.set({
    'Retry-After': retryAfter.toString(),
    'X-RateLimit-Limit': config.points.toString(),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
  });

  // 记录日志
  logger.warn('速率限制触发', {
    ip: defaultKeyGenerator(req),
    path: req.path,
    method: req.method,
    retryAfter,
  });

  // 返回响应
  res.status(429).json({
    code: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试',
    retryAfter,
    timestamp: new Date().toISOString(),
  });
}

// ==================== 预设中间件 ====================

/**
 * 通用API限流
 */
export const apiRateLimiter = createRateLimiter({
  config: RATE_LIMIT_PRESETS.api,
});

/**
 * 聊天接口限流
 */
export const chatRateLimiter = createRateLimiter({
  config: RATE_LIMIT_PRESETS.chat,
  keyGenerator: userKeyGenerator,
});

/**
 * 管理接口限流
 */
export const adminRateLimiter = createRateLimiter({
  config: RATE_LIMIT_PRESETS.admin,
  keyGenerator: userKeyGenerator,
});

/**
 * 登录接口限流（防暴力破解）
 */
export const loginRateLimiter = createRateLimiter({
  config: RATE_LIMIT_PRESETS.login,
  keyGenerator: endpointKeyGenerator,
  skipSuccessfulRequests: true, // 成功登录不计数
});

/**
 * 注册接口限流
 */
export const registerRateLimiter = createRateLimiter({
  config: RATE_LIMIT_PRESETS.register,
});

// ==================== 导出 ====================

export default rateLimiterManager;
export { rateLimiterManager };

// 向后兼容旧接口
export { apiRateLimiter as rateLimiter, apiRateLimiter as rateLimiterMiddleware };
