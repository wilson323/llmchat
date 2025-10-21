import type { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 常量定义
const RATE_LIMIT_CONSTANTS = {
  POINTS: 100, // 请求数量
  DURATION: 60, // 时间窗口（秒）
  BLOCK_DURATION: 60, // 阻止时间（秒）
  DEFAULT_TIMEOUT: 60000, // 默认超时时间（毫秒）
  HTTP_STATUS_TOO_MANY_REQUESTS: 429,
} as const;

interface RateLimitResult {
  remainingPoints?: number;
  msBeforeNext?: number;
}

// 创建速率限制器
const rateLimiter = new RateLimiterMemory({
  points: RATE_LIMIT_CONSTANTS.POINTS,
  duration: RATE_LIMIT_CONSTANTS.DURATION,
  blockDuration: RATE_LIMIT_CONSTANTS.BLOCK_DURATION,
});

/**
 * 速率限制中间件
 */
export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const key = req.ip ?? 'anonymous';
    await rateLimiter.consume(key);
    next();
  } catch (rejRes: unknown) {
    const r = rejRes as RateLimitResult;
    const remainingPoints = r?.remainingPoints ?? 0;
    const msBeforeNext = r?.msBeforeNext ?? RATE_LIMIT_CONSTANTS.DEFAULT_TIMEOUT;

    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000),
      'X-RateLimit-Limit': RATE_LIMIT_CONSTANTS.POINTS.toString(),
      'X-RateLimit-Remaining': remainingPoints.toString(),
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
    });

    res.status(RATE_LIMIT_CONSTANTS.HTTP_STATUS_TOO_MANY_REQUESTS).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试',
      retryAfter: Math.round(msBeforeNext / 1000),
      timestamp: new Date().toISOString(),
    });
  }
};

export { rateLimiterMiddleware as rateLimiter };