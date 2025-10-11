/**
 * 缓存管理路由
 *
 * 提供缓存操作的API端点
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import CacheController from '@/controllers/cacheController';
import { authenticateToken } from '@/middleware/auth';
import { rateLimit } from '@/middleware/rateLimit';
import { auditLog } from '@/middleware/auditLog';
import { ApiError } from '@/utils/errors';

const router = Router();
const cacheController = new CacheController();

// 验证中间件
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return next(new ApiError(errorMessages.join(', '), 400));
  }
  next();
};

// 通用验证规则
const cacheKeyValidation = [
  param('key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('缓存键必须是1-255个字符的字符串'),
  handleValidationErrors
];

const cacheOperationValidation = [
  body('key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('缓存键必须是1-255个字符的字符串'),
  body('value')
    .notEmpty()
    .withMessage('缓存值不能为空'),
  body('ttl')
    .optional()
    .isInt({ min: 0, max: 86400 * 30 }) // 最大30天
    .withMessage('TTL必须是0-2592000之间的整数'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('标签必须是数组'),
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('每个标签必须是1-50个字符的字符串'),
  handleValidationErrors
];

const batchOperationValidation = [
  body('operations')
    .isArray({ min: 1, max: 100 })
    .withMessage('操作列表必须是1-100个元素的数组'),
  body('operations.*.key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('缓存键必须是1-255个字符的字符串'),
  body('operations.*.value')
    .notEmpty()
    .withMessage('缓存值不能为空'),
  body('defaultTtl')
    .optional()
    .isInt({ min: 0, max: 86400 * 30 })
    .withMessage('默认TTL必须是0-2592000之间的整数'),
  body('defaultTags')
    .optional()
    .isArray()
    .withMessage('默认标签必须是数组'),
  handleValidationErrors
];

const tagOperationValidation = [
  body('tags')
    .isArray({ min: 1, max: 50 })
    .withMessage('标签列表必须是1-50个元素的数组'),
  body('tags.*')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('每个标签必须是1-50个字符的字符串'),
  handleValidationErrors
];

const queryValidation = [
  query('pattern')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('查询模式必须是1-255个字符的字符串'),
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return value.split(',').every((tag: string) =>
          tag.trim().length >= 1 && tag.trim().length <= 50
        );
      }
      return true;
    })
    .withMessage('标签格式不正确'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('限制数量必须是1-1000之间的整数'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('偏移量必须是非负整数'),
  handleValidationErrors
];

// 缓存操作速率限制
const cacheRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 1000, // 每分钟最多1000次请求
  message: {
    success: false,
    error: '缓存操作请求过于频繁，请稍后再试'
  }
});

// 管理操作速率限制（更严格）
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 每分钟最多100次请求
  message: {
    success: false,
    error: '管理操作请求过于频繁，请稍后再试'
  }
});

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
  authenticateToken,
  auditLog('cache_stats_view'),
  cacheController.getCacheStats.bind(cacheController)
);

/**
 * @route POST /api/cache/stats/reset
 * @desc 重置缓存统计信息
 * @access Private
 */
router.post(
  '/stats/reset',
  authenticateToken,
  adminRateLimit,
  auditLog('cache_stats_reset'),
  cacheController.resetCacheStats.bind(cacheController)
);

/**
 * @route GET /api/cache/config
 * @desc 获取缓存配置
 * @access Private
 */
router.get(
  '/config',
  authenticateToken,
  auditLog('cache_config_view'),
  cacheController.getCacheConfig.bind(cacheController)
);

/**
 * @route PUT /api/cache/config
 * @desc 更新缓存配置
 * @access Private
 */
router.put(
  '/config',
  authenticateToken,
  adminRateLimit,
  auditLog('cache_config_update'),
  [
    body('defaultTtl')
      .optional()
      .isInt({ min: 0, max: 86400 * 30 })
      .withMessage('默认TTL必须是0-2592000之间的整数'),
    body('maxMemoryItems')
      .optional()
      .isInt({ min: 100, max: 10000 })
      .withMessage('最大内存项目数必须是100-10000之间的整数'),
    body('compressionThreshold')
      .optional()
      .isInt({ min: 100, max: 10240 })
      .withMessage('压缩阈值必须是100-10240之间的整数'),
    body('enableMemoryCache')
      .optional()
      .isBoolean()
      .withMessage('启用内存缓存必须是布尔值'),
    body('enableCompression')
      .optional()
      .isBoolean()
      .withMessage('启用压缩必须是布尔值'),
    handleValidationErrors
  ],
  cacheController.updateCacheConfig.bind(cacheController)
);

/**
 * @route GET /api/cache/:key
 * @desc 获取缓存值
 * @access Private
 */
router.get(
  '/:key',
  authenticateToken,
  cacheRateLimit,
  cacheKeyValidation,
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return value.split(',').every((tag: string) => tag.trim().length > 0);
      }
      return true;
    })
    .withMessage('标签格式不正确'),
  query('strategy')
    .optional()
    .isIn(['lazy_loading', 'write_through', 'write_behind', 'refresh_ahead'])
    .withMessage('缓存策略必须是有效的枚举值'),
  cacheController.getCache.bind(cacheController)
);

/**
 * @route PUT /api/cache/:key
 * @desc 设置缓存值
 * @access Private
 */
router.put(
  '/:key',
  authenticateToken,
  cacheRateLimit,
  auditLog('cache_set', { resourceType: 'cache' }),
  [
    body('value')
      .notEmpty()
      .withMessage('缓存值不能为空'),
    body('ttl')
      .optional()
      .isInt({ min: 0, max: 86400 * 30 })
      .withMessage('TTL必须是0-2592000之间的整数'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('标签必须是数组'),
    body('tags.*')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('每个标签必须是1-50个字符的字符串'),
    body('strategy')
      .optional()
      .isIn(['lazy_loading', 'write_through', 'write_behind', 'refresh_ahead'])
      .withMessage('缓存策略必须是有效的枚举值'),
    body('compress')
      .optional()
      .isBoolean()
      .withMessage('压缩选项必须是布尔值'),
    handleValidationErrors
  ],
  cacheController.setCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache/:key
 * @desc 删除缓存
 * @access Private
 */
router.delete(
  '/:key',
  authenticateToken,
  cacheRateLimit,
  auditLog('cache_delete', { resourceType: 'cache' }),
  cacheKeyValidation,
  cacheController.deleteCache.bind(cacheController)
);

/**
 * @route GET /api/cache/:key/exists
 * @desc 检查缓存是否存在
 * @access Private
 */
router.get(
  '/:key/exists',
  authenticateToken,
  cacheRateLimit,
  cacheKeyValidation,
  cacheController.existsCache.bind(cacheController)
);

/**
 * @route POST /api/cache/batch/set
 * @desc 批量设置缓存
 * @access Private
 */
router.post(
  '/batch/set',
  authenticateToken,
  cacheRateLimit,
  auditLog('cache_batch_set', { resourceType: 'cache' }),
  batchOperationValidation,
  cacheController.batchSetCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache/batch
 * @desc 批量删除缓存
 * @access Private
 */
router.delete(
  '/batch',
  authenticateToken,
  cacheRateLimit,
  auditLog('cache_batch_delete', { resourceType: 'cache' }),
  [
    body('keys')
      .isArray({ min: 1, max: 100 })
      .withMessage('缓存键列表必须是1-100个元素的数组'),
    body('keys.*')
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('每个缓存键必须是1-255个字符的字符串'),
    handleValidationErrors
  ],
  cacheController.batchDeleteCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache/tags
 * @desc 按标签删除缓存
 * @access Private
 */
router.delete(
  '/tags',
  authenticateToken,
  adminRateLimit,
  auditLog('cache_delete_by_tags', { resourceType: 'cache' }),
  tagOperationValidation,
  cacheController.deleteByTags.bind(cacheController)
);

/**
 * @route GET /api/cache
 * @desc 查询缓存
 * @access Private
 */
router.get(
  '/',
  authenticateToken,
  cacheRateLimit,
  queryValidation,
  cacheController.queryCache.bind(cacheController)
);

/**
 * @route DELETE /api/cache
 * @desc 清空缓存
 * @access Private
 */
router.delete(
  '/',
  authenticateToken,
  adminRateLimit,
  auditLog('cache_clear', { resourceType: 'cache' }),
  query('pattern')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('清空模式必须是1-255个字符的字符串'),
  handleValidationErrors,
  cacheController.clearCache.bind(cacheController)
);

/**
 * @route POST /api/cache/warmup
 * @desc 预热缓存
 * @access Private
 */
router.post(
  '/warmup',
  authenticateToken,
  adminRateLimit,
  auditLog('cache_warmup', { resourceType: 'cache' }),
  [
    body('data')
      .isArray({ min: 1, max: 1000 })
      .withMessage('预热数据必须是1-1000个元素的数组'),
    body('data.*.key')
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('缓存键必须是1-255个字符的字符串'),
    body('data.*.value')
      .notEmpty()
      .withMessage('缓存值不能为空'),
    body('data.*.ttl')
      .optional()
      .isInt({ min: 0, max: 86400 * 30 })
      .withMessage('TTL必须是0-2592000之间的整数'),
    body('data.*.tags')
      .optional()
      .isArray()
      .withMessage('标签必须是数组'),
    handleValidationErrors
  ],
  cacheController.warmupCache.bind(cacheController)
);

export default router;