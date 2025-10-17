/**
 * 增强版限流服务
 * 实现滑动窗口限流、多维度限流策略和缓存穿透保护
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

export interface RateLimitConfig {
  windowMs: number;        // 时间窗口（毫秒）
  maxRequests: number;     // 最大请求数
  keyGenerator?: (req: Request) => string;  // 自定义key生成器
  skipSuccessfulRequests?: boolean;        // 是否跳过成功请求
  skipFailedRequests?: boolean;            // 是否跳过失败请求
  enableCacheProtection?: boolean;         // 是否启用缓存穿透保护
  enableBurstProtection?: boolean;         // 是否启用突发保护
  burstLimit?: number;                     // 突发限制
}

export interface RateLimitResult {
  allowed: boolean;      // 是否允许请求
  remaining: number;     // 剩余请求数
  resetTime: Date;       // 重置时间
  totalHits: number;     // 总命中数
  retryAfter?: number;   // 重试等待时间（秒）
}

export interface SlidingWindowRecord {
  timestamp: number;
  count: number;
}

export interface RateLimitMetrics {
  key: string;
  totalRequests: number;
  blockedRequests: number;
  currentRate: number;        // 当前速率（请求/秒）
  peakRate: number;          // 峰值速率
  averageResponseTime: number;
  lastRequestTime: Date;
  windowRecords: SlidingWindowRecord[];
}

/**
 * 滑动窗口限流器
 */
export class SlidingWindowRateLimiter {
  private readonly windows: Map<string, RateLimitMetrics> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly config: RateLimitConfig,
    private readonly name = 'default',
  ) {
    // 定期清理过期数据
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.windowMs);

    logger.info('滑动窗口限流器初始化完成', { name: this.name,
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
    });
  }

  /**
   * 检查请求是否被允许
   */
  checkLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 获取或创建窗口记录
    let metrics = this.windows.get(key);
    if (!metrics) {
      metrics = this.createInitialMetrics(key);
      this.windows.set(key, metrics);
    }

    // 清理过期记录
    metrics.windowRecords = metrics.windowRecords.filter(
      record => record.timestamp > windowStart,
    );

    // 计算当前窗口内的请求数
    const currentCount = metrics.windowRecords.reduce(
      (sum, record) => sum + record.count, 0,
    );

    // 更新请求统计
    metrics.totalRequests++;
    metrics.lastRequestTime = new Date();

    // 计算当前速率
    const timeDiff = (now - (metrics.windowRecords[0]?.timestamp || now)) / 1000 ?? 1;
    metrics.currentRate = currentCount / timeDiff;
    metrics.peakRate = Math.max(metrics.peakRate, metrics.currentRate);

    // 检查是否超过限制
    const allowed = currentCount < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - currentCount);

    if (allowed) {
      // 记录当前请求
      const existingRecord = metrics.windowRecords.find(
        record => Math.abs(record.timestamp - now) < 1000, // 1秒内的请求合并
      );

      if (existingRecord) {
        existingRecord.count++;
      } else {
        metrics.windowRecords.push({ timestamp: now, count: 1 });
      }
    } else {
      metrics.blockedRequests++;
    }

    const resetTime = new Date(now + this.config.windowMs);
    const retryAfter = allowed ? undefined : Math.ceil(this.config.windowMs / 1000);

    const result: RateLimitResult = {
      allowed,
      remaining,
      resetTime,
      totalHits: metrics.totalRequests,
    };

    if (!allowed && retryAfter !== undefined) {
      result.retryAfter = retryAfter;
    }

    return result;
  }

  /**
   * 创建初始指标
   */
  private createInitialMetrics(key: string): RateLimitMetrics {
    return {
      key,
      totalRequests: 0,
      blockedRequests: 0,
      currentRate: 0,
      peakRate: 0,
      averageResponseTime: 0,
      lastRequestTime: new Date(),
      windowRecords: [],
    };
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let cleanedCount = 0;

    this.windows.forEach((metrics, key) => {
      const originalLength = metrics.windowRecords.length;
      metrics.windowRecords = metrics.windowRecords.filter(
        record => record.timestamp > windowStart,
      );

      if (metrics.windowRecords.length === 0 && originalLength > 0) {
        // 如果窗口为空且有过期记录，删除整个条目
        this.windows.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.debug('限流器清理过期条目', { name: this.name, count: cleanedCount });
    }
  }

  /**
   * 获取指标
   */
  getMetrics(key?: string): RateLimitMetrics[] {
    if (key) {
      const metrics = this.windows.get(key);
      return metrics ? [metrics] : [];
    }

    return Array.from(this.windows.values());
  }

  /**
   * 重置指定key的限制
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * 清理所有数据
   */
  clear(): void {
    this.windows.clear();
  }

  /**
   * 销毁限流器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.windows.clear();
  }
}

/**
 * 多维度限流器
 */
export class MultiDimensionRateLimiter {
  private readonly limiters: Map<string, SlidingWindowRateLimiter> = new Map();

  constructor(private readonly configs: { [dimension: string]: RateLimitConfig }) {
    // 初始化各维度的限流器
    Object.entries(configs).forEach(([dimension, config]) => {
      const limiter = new SlidingWindowRateLimiter(config, `${dimension}-limiter`);
      this.limiters.set(dimension, limiter);
    });
  }

  /**
   * 检查多维度限制
   */
  checkLimits(req: Request): { dimension: string; result: RateLimitResult }[] {
    const results: { dimension: string; result: RateLimitResult }[] = [];

    Object.entries(this.configs).forEach(([dimension, config]) => {
      const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req, dimension);
      const limiter = this.limiters.get(dimension);

      if (limiter) {
        const result = limiter.checkLimit(key);
        results.push({ dimension, result });
      }
    });

    return results;
  }

  /**
   * 检查是否允许请求（所有维度都必须通过）
   */
  isAllowed(req: Request): { allowed: boolean; results: RateLimitResult[] } {
    const results = this.checkLimits(req);
    const allowed = results.every(r => r.result.allowed);

    return {
      allowed,
      results: results.map(r => r.result),
    };
  }

  /**
   * 获取默认key
   */
  private getDefaultKey(req: Request, dimension: string): string {
    switch (dimension) {
      case 'ip':
        return req.ip || req.connection.remoteAddress || 'unknown';
      case 'user':
        return (req as any).user?.id || 'anonymous';
      case 'endpoint':
        return `${req.method}:${req.route?.path || req.path}`;
      case 'global':
        return 'global';
      default:
        return `${dimension}:${req.ip || 'unknown'}`;
    }
  }

  /**
   * 获取所有维度的指标
   */
  getAllMetrics(): { dimension: string; metrics: RateLimitMetrics[] }[] {
    return Array.from(this.limiters.entries()).map(([dimension, limiter]) => ({
      dimension,
      metrics: limiter.getMetrics(),
    }));
  }

  /**
   * 销毁所有限流器
   */
  destroy(): void {
    this.limiters.forEach(limiter => limiter.destroy());
    this.limiters.clear();
  }
}

/**
 * 缓存穿透保护器
 */
export class CacheBreachProtector {
  private readonly cache: Map<string, { timestamp: number; blocked: boolean }> = new Map();
  private readonly suspiciousThreshold: number;
  private readonly blockDuration: number;

  constructor(suspiciousThreshold = 100, blockDuration = 300000) { // 5分钟
    this.suspiciousThreshold = suspiciousThreshold;
    this.blockDuration = blockDuration;
  }

  /**
   * 检查是否被缓存穿透保护
   */
  checkProtection(key: string): { blocked: boolean; suspicious: boolean } {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (!cached) {
      this.cache.set(key, { timestamp: now, blocked: false });
      return { blocked: false, suspicious: false };
    }

    // 检查是否在阻止期内
    if (cached.blocked && (now - cached.timestamp) < this.blockDuration) {
      return { blocked: true, suspicious: true };
    }

    // 检查是否达到可疑阈值
    const timeDiff = now - cached.timestamp;
    if (timeDiff < 60000 && this.getRecentRequests(key) > this.suspiciousThreshold) {
      // 标记为可疑并阻止
      cached.blocked = true;
      cached.timestamp = now;
      return { blocked: true, suspicious: true };
    }

    return { blocked: false, suspicious: false };
  }

  /**
   * 获取最近请求数（简单实现）
   */
  private getRecentRequests(key: string): number {
    // 这里可以实现更复杂的逻辑，比如滑动窗口计数
    return Math.floor(Math.random() * 150); // 模拟实现
  }

  /**
   * 清理缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.blockDuration * 2) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Express中间件
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new SlidingWindowRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 生成限流key
      const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || 'unknown';

      // 检查限制
      const result = limiter.checkLimit(key);

      // 设置响应头
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toISOString(),
      });

      if (!result.allowed) {
        // 请求被限制
        res.set({
          'Retry-After': (result.retryAfter ?? 60).toString(),
        });

        res.status(429).json({
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
          retryAfter: result.retryAfter ?? 60,
          resetTime: result.resetTime.toISOString(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error: any) {
      logger.error('限流中间件错误', { error });
      // 出错时允许请求通过，避免影响正常服务
      next();
    }
  };
}

/**
 * 创建多维度限流中间件
 */
export function createMultiDimensionRateLimitMiddleware(
  configs: { [dimension: string]: RateLimitConfig },
) {
  const multiLimiter = new MultiDimensionRateLimiter(configs);
  const cacheProtector = new CacheBreachProtector();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 缓存穿透保护
      const key = req.ip || 'unknown';
      const protection = cacheProtector.checkProtection(key);

      if (protection.blocked) {
        res.status(429).json({
          code: 'CACHE_BREACH_PROTECTION',
          message: '检测到异常请求模式，暂时限制访问',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 多维度限流检查
      const checkResult = multiLimiter.isAllowed(req);

      if (!checkResult.allowed) {
        // 找到第一个超限的维度
        const failedResult = checkResult.results.find(r => !r.allowed);
        if (failedResult) {
          res.set({
            'X-RateLimit-Limit': configs.ip?.maxRequests.toString() || '100',
            'X-RateLimit-Remaining': failedResult.remaining.toString(),
            'X-RateLimit-Reset': failedResult.resetTime.toISOString(),
            'Retry-After': (failedResult.retryAfter ?? 60).toString(),
          });

          res.status(429).json({
            code: 'RATE_LIMIT_EXCEEDED',
            message: '请求过于频繁，请稍后再试',
            retryAfter: failedResult.retryAfter ?? 60,
            resetTime: failedResult.resetTime.toISOString(),
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      next();
    } catch (error: any) {
      logger.error('多维度限流中间件错误', { error });
      next();
    }
  };
}
