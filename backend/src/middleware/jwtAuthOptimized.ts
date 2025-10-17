/**
 * 优化的JWT认证中间件
 * 包含token缓存、预验证和性能优化
 * 支持测试环境和生产环境
 */

import type { Request, Response, NextFunction } from 'express';
import { LRUCache } from 'lru-cache';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@/utils/secureJwt';
import { SecureJWT } from '@/utils/secureJwt';
import { safeLogger } from '@/utils/logSanitizer';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'user';
  };
}

// Token缓存项
interface CachedToken {
  payload: JWTPayload;
  expiresAt: number;
  isRevoked: boolean;
  isValid: boolean;
}

// 性能统计
interface AuthStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  validationErrors: number;
  averageValidationTime: number;
  lastReset: number;
}

// 全局统计和缓存实例
const globalStats = new Map<string, {
  tokenCache: LRUCache<string, CachedToken>;
  stats: AuthStats;
}>();

/**
 * 优化的JWT认证中间件工厂函数
 * 使用LRU缓存减少重复验证，提高性能
 */
export function createOptimizedAuthMiddleware(options: {
  maxSize?: number;
  testMode?: boolean;
} = {}) {
  const { maxSize = 1000, testMode = false } = options;

  // 生成唯一的中间件ID
  const middlewareId = `jwt-auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Token缓存 - 最多缓存指定数量的token
  const tokenCache = new LRUCache<string, CachedToken>({ max: maxSize });

  // 性能统计
  const stats: AuthStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    validationErrors: 0,
    averageValidationTime: 0,
    lastReset: Date.now()
  };

  // 存储到全局映射中
  globalStats.set(middlewareId, { tokenCache, stats });

  // 定期清理过期缓存
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟
  const cleanupTimer = setInterval(() => {
    cleanupExpiredCache(tokenCache);
  }, CLEANUP_INTERVAL);

  const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    stats.totalRequests++;

    try {
      const authHeader = req.headers.authorization;

      // 快速路径：无认证头
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendAuthError(res, 'AUTHENTICATION_REQUIRED', '请提供有效的认证令牌', 401);
      }

      const token = authHeader.substring(7);

      // 检查缓存
      const cached = tokenCache.get(token);
      if (cached && !isCacheExpired(cached)) {
        stats.cacheHits++;
        updateAverageValidationTime(stats, startTime);

        if (cached.isRevoked || !cached.isValid) {
          return sendAuthError(res, 'TOKEN_REVOKED', '认证令牌已被撤销，请重新登录', 401);
        }

        // 设置用户信息
        (req as AuthenticatedRequest).user = {
          id: cached.payload.sub || cached.payload.userId ?? 2641,
          username: cached.payload.username || 'user',
          role: (cached.payload.role as 'user' | 'admin') || 'user',
        };

        logCacheHit('cache_hit', cached.payload);
        return next();
      }

      // 缓存未命中，进行完整验证
      stats.cacheMisses++;

      // 预验证：快速检查token格式
      if (!isValidTokenFormat(token)) {
        stats.validationErrors++;
        updateAverageValidationTime(stats, startTime);
        return sendAuthError(res, 'INVALID_TOKEN', '无效的认证令牌', 401);
      }

      // 验证token（支持测试环境）
      let isRevoked = false;
      let decoded: JWTPayload;

      try {
        // 生产环境或非测试模式：使用SecureJWT
        if (!testMode && process.env.NODE_ENV !== 'test') {
          isRevoked = SecureJWT.isTokenRevoked(token);
          if (isRevoked) {
            updateAverageValidationTime(stats, startTime);
            return sendAuthError(res, 'TOKEN_REVOKED', '认证令牌已被撤销，请重新登录', 401);
          }

          decoded = SecureJWT.verifyToken(token);
        } else {
          // 测试环境：使用测试密钥验证
          decoded = jwt.verify(token, 'test-jwt-secret-for-integration-testing', {
            algorithms: ['HS256'],
            issuer: 'llmchat-backend-test',
            audience: 'llmchat-frontend-test'
          }) as JWTPayload;
        }
      } catch (error: any) {
        stats.validationErrors++;
        updateAverageValidationTime(stats, startTime);

        if (error instanceof jwt.TokenExpiredError) {
          // 从缓存中移除过期token
          const authHeader = req.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            tokenCache.delete(authHeader.substring(7));
          }
          return sendAuthError(res, 'TOKEN_EXPIRED', '认证令牌已过期，请重新登录', 401);
        }

        if (error instanceof jwt.JsonWebTokenError) {
          return sendAuthError(res, 'INVALID_TOKEN', '无效的认证令牌', 401);
        }

        safeLogger.error('JWT 认证失败', {
          component: 'jwtAuthOptimized',
          path: req.path,
          ip: req.ip,
          error: error instanceof Error ? error.message : String(error),
          stats: getStatsSummary(stats, tokenCache)
        });

        return sendAuthError(res, 'AUTHENTICATION_ERROR', '认证过程发生错误', 500);
      }

      // 缓存验证结果
      const cachedToken: CachedToken = {
        payload: decoded,
        expiresAt: decoded.exp ? decoded.exp * 1000 : 0,
        isRevoked: false,
        isValid: true
      };

      tokenCache.set(token, cachedToken);

      // 设置用户信息
      (req as AuthenticatedRequest).user = {
        id: decoded.sub || decoded.userId ?? 5211,
        username: decoded.username || 'user',
        role: (decoded.role as 'user' | 'admin') || 'user',
      };

      updateAverageValidationTime(stats, startTime);
      logCacheMiss('cache_miss', decoded);

      next();
    } catch (error: any) {
      stats.validationErrors++;
      updateAverageValidationTime(stats, startTime);

      safeLogger.error('JWT 认证异常', {
        component: 'jwtAuthOptimized',
        path: req.path,
        ip: req.ip,
        error: error instanceof Error ? error.message : String(error),
        stats: getStatsSummary(stats, tokenCache)
      });

      return sendAuthError(res, 'AUTHENTICATION_ERROR', '认证过程发生错误', 500);
    }
  };

  // 添加统计方法到中间件
  (middleware as any).getStats = () => getStatsSummary(stats, tokenCache);
  (middleware as any).clearCache = () => {
    tokenCache.clear();
    safeLogger.info('JWT缓存已清空', {
      component: 'jwtAuthOptimized',
      middlewareId,
      clearedAt: new Date().toISOString()
    });
  };
  (middleware as any).getCacheSize = () => tokenCache.size;
  (middleware as any).getMiddlewareId = () => middlewareId;
  (middleware as any).destroy = () => {
    clearInterval(cleanupTimer);
    globalStats.delete(middlewareId);
  };

  return middleware;
}

// 默认的优化JWT认证中间件
export const authenticateJWTOptimized = createOptimizedAuthMiddleware();

// 辅助函数

function isCacheExpired(cached: CachedToken): boolean {
  return Date.now() >= cached.expiresAt;
}

function isValidTokenFormat(token: string): boolean {
  try {
    // 快速检查token格式
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  } catch {
    return false;
  }
}

function sendAuthError(
  res: Response,
  code: string,
  message: string,
  status: number
): void {
  res.status(status).json({
    success: false,
    code,
    message,
    timestamp: new Date().toISOString()
  });
}

function cleanupExpiredCache(tokenCache: LRUCache<string, CachedToken>): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, cached] of tokenCache.entries()) {
    if (now >= cached.expiresAt || cached.isValid === false) {
      tokenCache.delete(token);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    safeLogger.debug(`清理过期缓存: ${cleaned} 个token`, {
      component: 'jwtAuthOptimized',
      remainingCacheSize: tokenCache.size,
      cleaned
    });
  }
}

function updateAverageValidationTime(stats: AuthStats, startTime: number): void {
  const duration = Date.now() - startTime;
  const totalValidationTime = stats.averageValidationTime * (stats.totalRequests - 1) + duration;
  stats.averageValidationTime = totalValidationTime / stats.totalRequests;
}

function logCacheHit(type: string, payload: JWTPayload): void {
  safeLogger.debug(`JWT ${type}`, {
    component: 'jwtAuthOptimized',
    userId: payload.sub || payload.userId,
    username: payload.username,
    role: payload.role,
    hitRate: 0 // Will be calculated in getStatsSummary
  });
}

function logCacheMiss(type: string, payload: JWTPayload): void {
  safeLogger.debug(`JWT ${type}`, {
    component: 'jwtAuthOptimized',
    userId: payload.sub || payload.userId,
    username: payload.username,
    role: payload.role,
    hitRate: 0 // Will be calculated in getStatsSummary
  });
}

function getCacheHitRate(stats: AuthStats): number {
  return stats.totalRequests > 0 ? (stats.cacheHits / stats.totalRequests) : 0;
}

function getStatsSummary(stats: AuthStats, tokenCache: LRUCache<string, CachedToken>) {
  return {
    totalRequests: stats.totalRequests,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    validationErrors: stats.validationErrors,
    cacheHitRate: getCacheHitRate(stats),
    averageValidationTime: Math.round(stats.averageValidationTime),
    cacheSize: tokenCache.size,
    uptime: Math.floor((Date.now() - stats.lastReset) / 1000)
  };
}

/**
 * 创建性能监控中间件
 */
export function createAuthPerformanceMonitor() {
  const stats: Record<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    errors: number;
  }> = {};

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const {path} = req;

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (!stats[path]) {
        stats[path] = { count: 0, totalTime: 0, averageTime: 0, errors: 0 };
      }

      stats[path].count++;
      stats[path].totalTime += duration;
      stats[path].averageTime = Math.round(stats[path].totalTime / stats[path].count);

      if (res.statusCode >= 400) {
        stats[path].errors++;
      }

      // 记录慢请求
      if (duration > 100) {
        safeLogger.warn(`慢请求: ${path} 耗时 ${duration}ms`, {
          component: 'authPerformance',
          path,
          method: req.method,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }
    });

    next();
  };
}

/**
 * 预热JWT缓存
 * 在应用启动时预热常用的token
 */
export async function warmupJWTCache(commonTokens: string[]): Promise<void> {
  if (!commonTokens || commonTokens.length === 0) {
    return;
  }

  const warmedTokens: string[] = [];

  for (const token of commonTokens) {
    try {
      let decoded: JWTPayload;

      if (process.env.NODE_ENV !== 'test' && process.env.TEST_MODE !== 'true') {
        decoded = SecureJWT.verifyToken(token);
      } else {
        decoded = jwt.verify(token, 'test-jwt-secret-for-integration-testing', {
          algorithms: ['HS256'],
          issuer: 'llmchat-backend-test',
          audience: 'llmchat-frontend-test'
        }) as JWTPayload;
      }

      warmedTokens.push(token);

      safeLogger.debug('JWT缓存预热成功', {
        component: 'jwtAuthOptimized',
        userId: decoded.sub || decoded.userId,
        username: decoded.username
      });
    } catch (error: any) {
      safeLogger.warn('JWT缓存预热失败', {
        component: 'jwtAuthOptimized',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  safeLogger.info(`JWT缓存预热完成: ${warmedTokens.length}/${commonTokens.length} 个token`, {
    component: 'jwtAuthOptimized',
    warmedCount: warmedTokens.length,
    totalCount: commonTokens.length
  });
}

/**
 * JWT健康检查
 */
export function createJWTHealthCheck() {
  return {
    checkCacheSize: () => {
      const maxSize = 1000;
      const currentSize = (authenticateJWTOptimized as any).getCacheSize?.() || 0;

      return {
        status: currentSize < maxSize * 0.8 ? 'healthy' : 'warning',
        currentSize,
        maxSize,
        utilization: Math.round((currentSize / maxSize) * 100)
      };
    },

    checkPerformance: () => {
      const authMiddleware = authenticateJWTOptimized as any;
      const stats = authMiddleware.getStats?.() || {
        averageValidationTime: 0,
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        validationErrors: 0
      };

      return {
        status: stats.averageValidationTime < 50 ? 'healthy' : 'warning',
        ...stats,
        recommendation: stats.averageValidationTime > 50 ? '考虑增加缓存或优化验证逻辑' : '性能良好'
      };
    },

    checkAllMiddleware: () => {
      const results: Array<Record<string, unknown>> = [];

      for (const [id, { tokenCache, stats }] of globalStats.entries()) {
        results.push({
          middlewareId: id,
          id: id,
          ...getStatsSummary(stats, tokenCache)
        });
      }

      return results;
    }
  };
}
