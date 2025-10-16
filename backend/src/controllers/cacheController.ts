/**
 * 缓存管理控制器
 *
 * 提供缓存管理API，支持手动缓存操作、监控和配置
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import type { CacheStrategy } from '@/services/RedisCacheManager';
import { RedisCacheManager } from '@/services/RedisCacheManager';
import type {
  CacheMiddlewareStats
} from '@/middleware/cacheMiddleware';
import {
  getCacheMiddlewareStats,
  generateCachePerformanceReport
} from '@/middleware/cacheMiddleware';

// 缓存操作请求接口
export interface CacheOperationRequest {
  /** 缓存键 */
  key: string;
  /** 缓存值 */
  value?: any;
  /** TTL（秒） */
  ttl?: number;
  /** 缓存标签 */
  tags?: string[];
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 是否压缩 */
  compress?: boolean;
}

// 批量缓存操作请求接口
export interface BatchCacheOperationRequest {
  /** 缓存操作列表 */
  operations: Array<{
    key: string;
    value: any;
    ttl?: number;
    tags?: string[];
  }>;
  /** 默认TTL */
  defaultTtl?: number;
  /** 默认标签 */
  defaultTags?: string[];
}

// 缓存查询请求接口
export interface CacheQueryRequest {
  /** 缓存键模式 */
  pattern?: string;
  /** 缓存标签 */
  tags?: string[];
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

// 缓存统计响应接口
export interface CacheStatsResponse {
  /** Redis缓存统计 */
  redisStats: any;
  /** 中间件统计 */
  middlewareStats: CacheMiddlewareStats;
  /** 总体统计 */
  overallStats: {
    totalCacheSize: number;
    hitRate: number;
    averageResponseTime: number;
    timeSaved: number;
  };
  /** 性能报告 */
  performanceReport: string;
}

/**
 * 缓存管理控制器类
 */
export class CacheController {
  private readonly cacheManager: RedisCacheManager;

  constructor() {
    this.cacheManager = RedisCacheManager.getInstance();
  }

  /**
   * 获取缓存值
   */
  async getCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const { tags, strategy } = req.query;

      if (!key) {
        res.status(400).json({
          success: false,
          error: '缓存键不能为空'
        });
        return;
      }

      const cacheOptions: {
        tags?: string[];
        strategy?: CacheStrategy;
      } = {};

      if (tags) {
        cacheOptions.tags = (tags as string).split(',');
      }

      if (strategy) {
        cacheOptions.strategy = strategy as CacheStrategy;
      }

      const value = await this.cacheManager.get(key, cacheOptions);

      if (value !== null) {
        res.json({
          success: true,
          data: {
            key,
            value,
            found: true
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          success: true,
          data: {
            key,
            value: null,
            found: false
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('获取缓存失败', { key: req.params.key, error });
      next(error);
    }
  }

  /**
   * 设置缓存值
   */
  async setCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, value, ttl, tags, strategy, compress } = req.body as CacheOperationRequest;

      if (!key || value === undefined) {
        res.status(400).json({
          success: false,
          error: '缓存键和值不能为空'
        });
        return;
      }

      const cacheOptions: {
        ttl?: number;
        tags?: string[];
        strategy?: CacheStrategy;
        compress?: boolean;
      } = {};

      if (ttl !== undefined) {
        cacheOptions.ttl = ttl;
      }

      if (tags !== undefined) {
        cacheOptions.tags = tags;
      }

      if (strategy !== undefined) {
        cacheOptions.strategy = strategy;
      }

      if (compress !== undefined) {
        cacheOptions.compress = compress;
      }

      const success = await this.cacheManager.set(key, value, cacheOptions);

      if (success) {
        res.json({
          success: true,
          data: {
            key,
            ttl: ttl || 'default',
            tags: tags || [],
            compressed: compress || false
          },
          message: '缓存设置成功',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: '缓存设置失败'
        });
      }
    } catch (error) {
      logger.error('设置缓存失败', { key: req.body.key, error });
      next(error);
    }
  }

  /**
   * 删除缓存
   */
  async deleteCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        res.status(400).json({
          success: false,
          error: '缓存键不能为空'
        });
        return;
      }

      const success = await this.cacheManager.delete(key);

      if (success) {
        res.json({
          success: true,
          data: { key },
          message: '缓存删除成功',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          error: '缓存不存在或删除失败'
        });
      }
    } catch (error) {
      logger.error('删除缓存失败', { key: req.params.key, error });
      next(error);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async existsCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        res.status(400).json({
          success: false,
          error: '缓存键不能为空'
        });
        return;
      }

      const exists = await this.cacheManager.exists(key);

      res.json({
        success: true,
        data: {
          key,
          exists
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('检查缓存存在性失败', { key: req.params.key, error });
      next(error);
    }
  }

  /**
   * 批量设置缓存
   */
  async batchSetCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operations, defaultTtl, defaultTags } = req.body as BatchCacheOperationRequest;

      if (!operations || !Array.isArray(operations) || operations.length === 0) {
        res.status(400).json({
          success: false,
          error: '操作列表不能为空'
        });
        return;
      }

      const results = await Promise.allSettled(
        operations.map(async (operation) => {
          const { key, value, ttl, tags } = operation;

          const cacheOptions: {
            ttl?: number;
            tags?: string[];
          } = {};

          if (ttl !== undefined) {
            cacheOptions.ttl = ttl;
          } else if (defaultTtl !== undefined) {
            cacheOptions.ttl = defaultTtl;
          }

          if (tags !== undefined) {
            cacheOptions.tags = tags;
          } else if (defaultTags !== undefined) {
            cacheOptions.tags = defaultTags;
          }

          return await this.cacheManager.set(key, value, cacheOptions);
        })
      );

      const successCount = results.filter(result =>
        result.status === 'fulfilled' && result.value === true
      ).length;

      const failedOperations = results
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ index, result }) => ({
          index,
          operation: operations[index],
          error: result.status === 'rejected' ? result.reason : 'Unknown error'
        }));

      res.json({
        success: true,
        data: {
          total: operations.length,
          success: successCount,
          failed: operations.length - successCount,
          successRate: (successCount / operations.length * 100).toFixed(1) + '%',
          failedOperations
        },
        message: `批量操作完成，成功 ${successCount}/${operations.length}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('批量设置缓存失败', { error });
      next(error);
    }
  }

  /**
   * 批量删除缓存
   */
  async batchDeleteCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { keys } = req.body;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        res.status(400).json({
          success: false,
          error: '缓存键列表不能为空'
        });
        return;
      }

      const results = await Promise.allSettled(
        keys.map(async (key: string) => {
          return await this.cacheManager.delete(key);
        })
      );

      const successCount = results.filter(result =>
        result.status === 'fulfilled' && result.value === true
      ).length;

      res.json({
        success: true,
        data: {
          total: keys.length,
          success: successCount,
          failed: keys.length - successCount,
          successRate: (successCount / keys.length * 100).toFixed(1) + '%'
        },
        message: `批量删除完成，成功 ${successCount}/${keys.length}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('批量删除缓存失败', { error });
      next(error);
    }
  }

  /**
   * 按标签删除缓存
   */
  async deleteByTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        res.status(400).json({
          success: false,
          error: '标签列表不能为空'
        });
        return;
      }

      const deletedCount = await this.cacheManager.deleteByTags(tags);

      res.json({
        success: true,
        data: {
          tags,
          deletedCount
        },
        message: `按标签删除完成，删除了 ${deletedCount} 个缓存`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('按标签删除缓存失败', { tags: req.body.tags, error });
      next(error);
    }
  }

  /**
   * 查询缓存
   */
  async queryCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern, tags, limit = 100, offset = 0 } = req.query as CacheQueryRequest;

      let keys: string[];

      if (tags && Array.isArray(tags)) {
        // 按标签查询
        keys = await this.cacheManager.getKeysByTags(tags);
      } else {
        // 按模式查询
        keys = await this.cacheManager.getKeysByPattern(pattern || '*');
      }

      // 分页处理
      const paginatedKeys = keys.slice(offset, offset + limit);

      // 获取缓存信息
      const cacheInfo = await Promise.all(
        paginatedKeys.map(async (key) => {
          const exists = await this.cacheManager.exists(key);
          const ttl = exists ? await this.cacheManager.getTtl(key) : -1;
          return {
            key,
            exists,
            ttl
          };
        })
      );

      res.json({
        success: true,
        data: {
          keys: cacheInfo,
          total: keys.length,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: offset + limit < keys.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('查询缓存失败', { query: req.query, error });
      next(error);
    }
  }

  /**
   * 清空缓存
   */
  async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern } = req.query;
      const clearPattern = pattern as string || '*';

      const deletedCount = await this.cacheManager.clear(clearPattern);

      res.json({
        success: true,
        data: {
          pattern: clearPattern,
          deletedCount
        },
        message: `清空缓存完成，删除了 ${deletedCount} 个缓存`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('清空缓存失败', { pattern: req.query.pattern, error });
      next(error);
    }
  }

  /**
   * 预热缓存
   */
  async warmupCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { data } = req.body;

      if (!data || !Array.isArray(data)) {
        res.status(400).json({
          success: false,
          error: '预热数据不能为空'
        });
        return;
      }

      const results = await this.cacheManager.warmup(data);

      res.json({
        success: true,
        data: {
          total: data.length,
          success: results.success,
          failed: results.failed,
          successRate: (results.success / data.length * 100).toFixed(1) + '%'
        },
        message: `缓存预热完成，成功 ${results.success}/${data.length}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('缓存预热失败', { error });
      next(error);
    }
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const redisStats = this.cacheManager.getStats();
      const middlewareStats = getCacheMiddlewareStats();
      const performanceReport = generateCachePerformanceReport();

      // 计算总体统计
      const overallStats = {
        totalCacheSize: redisStats.memoryUsage || 0,
        hitRate: middlewareStats.hitRate || 0,
        averageResponseTime: middlewareStats.averageResponseTime || 0,
        timeSaved: middlewareStats.timeSaved || 0
      };

      const response: CacheStatsResponse = {
        redisStats,
        middlewareStats,
        overallStats,
        performanceReport
      };

      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('获取缓存统计失败', { error });
      next(error);
    }
  }

  /**
   * 重置缓存统计
   */
  async resetCacheStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.cacheManager.resetStats();
      const { resetCacheMiddlewareStats } = await import('@/middleware/cacheMiddleware');
      resetCacheMiddlewareStats();

      res.json({
        success: true,
        message: '缓存统计已重置',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('重置缓存统计失败', { error });
      next(error);
    }
  }

  /**
   * 获取缓存配置
   */
  async getCacheConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = this.cacheManager.getConfig();

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('获取缓存配置失败', { error });
      next(error);
    }
  }

  /**
   * 更新缓存配置
   */
  async updateCacheConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const newConfig = req.body;

      this.cacheManager.updateConfig(newConfig);

      res.json({
        success: true,
        data: newConfig,
        message: '缓存配置已更新',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('更新缓存配置失败', { error });
      next(error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isHealthy = await this.cacheManager.healthCheck();
      const stats = this.cacheManager.getStats();

      res.json({
        success: true,
        data: {
          healthy: isHealthy,
          stats: {
            connected: stats.connected,
            totalRequests: stats.totalRequests,
            hitRate: stats.hitRate,
            memoryUsage: stats.memoryUsage
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('缓存健康检查失败', { error });
      next(error);
    }
  }
}

export default CacheController;