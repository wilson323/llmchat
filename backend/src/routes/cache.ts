/**
 * 缓存管理路由
 *
 * 提供缓存操作的API端点
 */

import { Router, Request, Response, NextFunction } from 'express';
import CacheController from '@/controllers/cacheController';
import { authenticateJWT } from '@/middleware/jwtAuth';
import { rateLimiterMiddleware } from '@/middleware/rateLimiter';
import { ValidationError } from '@/types/errors';

const router: Router = Router();
const cacheController = new CacheController();

// 简化的验证函数
const validateCacheKey = (key: string): boolean => {
  return typeof key === 'string' && key.trim().length >= 1 && key.trim().length <= 255;
};

const validateTtl = (ttl: any): boolean => {
  return ttl === undefined || (Number.isInteger(ttl) && ttl >= 0 && ttl <= 86400 * 30);
};

const validateTags = (tags: any): boolean => {
  if (tags === undefined) return true;
  if (!Array.isArray(tags)) return false;
  return tags.every(tag =>
    typeof tag === 'string' && tag.trim().length >= 1 && tag.trim().length <= 50
  );
};

// 验证中间件
const validateCacheRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, ttl, tags } = req.body;

    if (key && !validateCacheKey(key)) {
      throw new ValidationError({ message: '缓存键必须是1-255个字符的字符串' });
    }

    if (ttl !== undefined && !validateTtl(ttl)) {
      throw new ValidationError({ message: 'TTL必须是0-2592000之间的整数' });
    }

    if (tags && !validateTags(tags)) {
      throw new ValidationError({ message: '标签格式不正确' });
    }

    next();
  } catch (error: any) {
    next(error);
  }
};

// 验证路由参数
const validateKeyParam = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    if (!key || !validateCacheKey(key)) {
      throw new ValidationError({ message: '缓存键必须是1-255个字符的字符串' });
    }
    next();
  } catch (error: any) {
    next(error);
  }
};

/**
 * @route GET /api/cache/health
 * @desc 缓存健康检查
 * @access Public
 */
router.get('/health', cacheController.healthCheck.bind(cacheController));

/**
 * @route GET /api/cache/stats
 * @desc 获取缓存统计信息
 * @access Private
 */
router.get(
  '/stats',
  authenticateJWT(),
  rateLimiterMiddleware,
  cacheController.getCacheStats.bind(cacheController)
);

/**
 * @route POST /api/cache/stats/reset
 * @desc 重置缓存统计信息
 * @access Private
 */
router.post(
  '/stats/reset',
  authenticateJWT(),
  rateLimiterMiddleware,
  cacheController.resetCacheStats.bind(cacheController)
);

/**
 * @route GET /api/cache/config
 * @desc 获取缓存配置
 * @access Private
 */
router.get(
  '/config',
  authenticateJWT(),
  rateLimiterMiddleware,
  cacheController.getCacheConfig.bind(cacheController)
);

/**
 * @route PUT /api/cache/config
 * @desc 更新缓存配置
 * @access Private
 */
router.put(
  '/config',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateCacheRequest,
  cacheController.updateCacheConfig.bind(cacheController)
);

/**
 * @route GET /api/cache/:key
 * @desc 获取缓存值
 * @access Private
 */
router.get(
  '/:key',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateKeyParam,
  cacheController.getCache.bind(cacheController)
);

/**
 * @route PUT /api/cache/:key
 * @desc 设置缓存值
 * @access Private
 */
router.put(
  '/:key',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateKeyParam,
  validateCacheRequest,
  cacheController.setCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache/:key
 * @desc 删除缓存
 * @access Private
 */
router.delete(
  '/:key',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateKeyParam,
  cacheController.deleteCache.bind(cacheController)
);

/**
 * @route GET /api/cache/:key/exists
 * @desc 检查缓存是否存在
 * @access Private
 */
router.get(
  '/:key/exists',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateKeyParam,
  cacheController.existsCache.bind(cacheController)
);

/**
 * @route POST /api/cache/batch/set
 * @desc 批量设置缓存
 * @access Private
 */
router.post(
  '/batch/set',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateCacheRequest,
  cacheController.batchSetCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache/batch
 * @desc 批量删除缓存
 * @access Private
 */
router.delete(
  '/batch',
  authenticateJWT(),
  rateLimiterMiddleware,
  cacheController.batchDeleteCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache/tags
 * @desc 按标签删除缓存
 * @access Private
 */
router.delete(
  '/tags',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateCacheRequest,
  cacheController.deleteByTags.bind(cacheController)
);

/**
 * @route GET /api/cache
 * @desc 查询缓存
 * @access Private
 */
router.get(
  '/',
  authenticateJWT(),
  rateLimiterMiddleware,
  cacheController.queryCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache
 * @desc 清空缓存
 * @access Private
 */
router.delete(
  '/',
  authenticateJWT(),
  rateLimiterMiddleware,
  cacheController.clearCache.bind(cacheController)
);

/**
 * @route POST /api/cache/warmup
 * @desc 预热缓存
 * @access Private
 */
router.post(
  '/warmup',
  authenticateJWT(),
  rateLimiterMiddleware,
  validateCacheRequest,
  cacheController.warmupCache.bind(cacheController)
);

export default router;