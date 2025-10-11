/**
 * 数据库性能管理路由
 *
 * 提供数据库性能监控、优化建议、统计信息等功能
 */

import { Router, Request, Response } from 'express';
import logger from '@/utils/logger';
import { getQueryOptimizer } from '@/utils/queryOptimizer';
import { connectionPoolOptimizer } from '@/utils/connectionPoolOptimizer';
import { defaultQueryCache } from '@/utils/queryCache';
// import { databasePerformanceMonitor } from '@/middleware/databasePerformanceMonitor';
import {
  updateDatabaseOptimizationConfig,
  generateDatabasePerformanceReport,
  performDatabaseAutoOptimization
} from '@/middleware/databaseOptimization';

const router: Router = Router();

/**
 * 获取数据库性能概览
 * GET /api/database/performance/overview
 */
router.get('/performance/overview', async (req: Request, res: Response) => {
  try {
    // 连接池统计
    const poolStats = connectionPoolOptimizer.getPoolStats();
    const poolDetails = connectionPoolOptimizer.getPoolDetails();

    // 查询缓存统计
    const cacheStats = defaultQueryCache.getStats();

    // 查询性能统计（暂时使用模拟数据）
    const perfStats = {
      totalQueries: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      slowQueries: 0,
      errorCount: 0,
    };
    const slowQueries: any[] = [];

    // 慢查询详情
    const slowQueriesDetails = slowQueries.map(query => ({
      requestId: query.requestId,
      duration: query.duration,
      query: query.query?.substring(0, 200) + (query.query && query.query.length > 200 ? '...' : ''),
      timestamp: new Date(query.startTime).toISOString(),
    }));

    const overview = {
      timestamp: new Date().toISOString(),
      connectionPool: {
        totalConnections: poolStats.totalCount,
        activeConnections: poolStats.activeCount,
        idleConnections: poolStats.idleCount,
        waitingConnections: poolStats.waitingCount,
        reuseRate: poolStats.reuseRate,
        isMonitoring: poolDetails.isMonitoring,
      },
      queryCache: {
        totalItems: cacheStats.totalItems,
        totalSize: `${(cacheStats.totalSize / 1024 / 1024).toFixed(2)}MB`,
        hitRate: cacheStats.hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      },
      queryPerformance: {
        totalQueries: perfStats.totalQueries,
        averageResponseTime: perfStats.averageResponseTime,
        maxResponseTime: perfStats.maxResponseTime,
        slowQueries: perfStats.slowQueries,
        errorCount: perfStats.errorCount,
        successRate: perfStats.totalQueries > 0 ?
          ((perfStats.totalQueries - perfStats.errorCount) / perfStats.totalQueries * 100).toFixed(1) : 0,
      },
      recentSlowQueries: slowQueriesDetails,
    };

    res.json({
      code: 'SUCCESS',
      message: '数据库性能概览获取成功',
      data: overview,
    });

  } catch (error) {
    logger.error('获取数据库性能概览失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取数据库性能概览失败',
      data: null,
    });
  }
});

/**
 * 获取连接池详细信息
 * GET /api/database/performance/pool
 */
router.get('/performance/pool', async (req: Request, res: Response) => {
  try {
    const poolDetails = connectionPoolOptimizer.getPoolDetails();
    const recommendations = connectionPoolOptimizer.getPerformanceRecommendations();

    res.json({
      code: 'SUCCESS',
      message: '连接池详细信息获取成功',
      data: {
        ...poolDetails,
        recommendations,
      },
    });

  } catch (error) {
    logger.error('获取连接池详细信息失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取连接池详细信息失败',
      data: null,
    });
  }
});

/**
 * 获取查询缓存详细信息
 * GET /api/database/performance/cache
 */
router.get('/performance/cache', async (req: Request, res: Response) => {
  try {
    const cacheStats = defaultQueryCache.getStats();
    const cacheItems = defaultQueryCache.getCacheItems(parseInt(req.query.limit as string) || 50);
    const config = defaultQueryCache.getConfig();

    const cacheDetails = {
      stats: cacheStats,
      config,
      topItems: cacheItems.map(item => ({
        key: item.key.substring(0, 16),
        query: item.query.substring(0, 100) + (item.query.length > 100 ? '...' : ''),
        accessCount: item.accessCount,
        size: item.size,
        createdAt: new Date(item.createdAt).toISOString(),
        lastAccessAt: new Date(item.lastAccessAt).toISOString(),
        expiresAt: new Date(item.expiresAt).toISOString(),
      })),
    };

    res.json({
      code: 'SUCCESS',
      message: '查询缓存详细信息获取成功',
      data: cacheDetails,
    });

  } catch (error) {
    logger.error('获取查询缓存详细信息失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取查询缓存详细信息失败',
      data: null,
    });
  }
});

/**
 * 获取慢查询列表
 * GET /api/database/performance/slow-queries
 */
router.get('/performance/slow-queries', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    // const slowQueries = databasePerformanceMonitor.getSlowQueries(limit);
    const slowQueries: any[] = [];

    const slowQueriesDetails = slowQueries.map((query: any) => ({
      requestId: query.requestId,
      duration: query.duration,
      query: query.query,
      params: query.params,
      queryType: query.queryType,
      rowCount: query.rowCount,
      timestamp: new Date(query.startTime).toISOString(),
      error: query.error,
    }));

    res.json({
      code: 'SUCCESS',
      message: '慢查询列表获取成功',
      data: {
        slowQueries: slowQueriesDetails,
        total: slowQueriesDetails.length,
        threshold: 1000, // 暂时使用固定阈值
      },
    });

  } catch (error) {
    logger.error('获取慢查询列表失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取慢查询列表失败',
      data: null,
    });
  }
});

/**
 * 分析查询性能
 * POST /api/database/performance/analyze-query
 */
router.post('/performance/analyze-query', async (req: Request, res: Response) => {
  try {
    const { query, params = [] } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: '查询语句不能为空',
        data: null,
      });
    }

    const optimizer = getQueryOptimizer();
    const analysis = await optimizer.analyzeQuery(query, params);

    res.json({
      code: 'SUCCESS',
      message: '查询分析完成',
      data: {
        originalQuery: query,
        params,
        plan: analysis.plan,
        suggestions: analysis.suggestions,
        metrics: analysis.metrics,
        optimizedQuery: optimizer.optimizeQuery(query),
      },
    });

  } catch (error) {
    logger.error('查询分析失败', { error, query: req.body.query });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '查询分析失败',
      data: null,
    });
  }
});

/**
 * 生成完整性能报告
 * GET /api/database/performance/report
 */
router.get('/performance/report', async (req: Request, res: Response) => {
  try {
    const report = generateDatabasePerformanceReport();

    res.json({
      code: 'SUCCESS',
      message: '性能报告生成成功',
      data: {
        report,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('生成性能报告失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '生成性能报告失败',
      data: null,
    });
  }
});

/**
 * 执行自动优化
 * POST /api/database/performance/auto-optimize
 */
router.post('/performance/auto-optimize', async (req: Request, res: Response) => {
  try {
    await performDatabaseAutoOptimization();

    res.json({
      code: 'SUCCESS',
      message: '自动优化执行完成',
      data: {
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('执行自动优化失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '执行自动优化失败',
      data: null,
    });
  }
});

/**
 * 预热连接池
 * POST /api/database/performance/warmup-pool
 */
router.post('/performance/warmup-pool', async (req: Request, res: Response) => {
  try {
    const { connectionCount = 5 } = req.body;

    if (typeof connectionCount !== 'number' || connectionCount < 1 || connectionCount > 20) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: '连接数必须是1-20之间的数字',
        data: null,
      });
    }

    await connectionPoolOptimizer.warmupPool(connectionCount);

    res.json({
      code: 'SUCCESS',
      message: `连接池预热完成，预热连接数: ${connectionCount}`,
      data: {
        connectionCount,
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('预热连接池失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '预热连接池失败',
      data: null,
    });
  }
});

/**
 * 测试连接池性能
 * POST /api/database/performance/test-pool
 */
router.post('/performance/test-pool', async (req: Request, res: Response) => {
  try {
    const { concurrency = 10 } = req.body;

    if (typeof concurrency !== 'number' || concurrency < 1 || concurrency > 50) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: '并发数必须是1-50之间的数字',
        data: null,
      });
    }

    const result = await connectionPoolOptimizer.testPoolPerformance(concurrency);

    res.json({
      code: 'SUCCESS',
      message: '连接池性能测试完成',
      data: {
        ...result,
        concurrency,
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('测试连接池性能失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '测试连接池性能失败',
      data: null,
    });
  }
});

/**
 * 清理查询缓存
 * DELETE /api/database/performance/cache
 */
router.delete('/performance/cache', async (req: Request, res: Response) => {
  try {
    const { pattern, tag } = req.query;

    let deletedCount = 0;

    if (tag && typeof tag === 'string') {
      // 按标签删除
      deletedCount = defaultQueryCache.deleteByTag(tag);
    } else if (pattern && typeof pattern === 'string') {
      // 按查询模式删除
      const regex = new RegExp(pattern);
      deletedCount = defaultQueryCache.deleteByQueryPattern(regex);
    } else {
      // 清空所有缓存
      const stats = defaultQueryCache.getStats();
      deletedCount = stats.totalItems;
      defaultQueryCache.clear();
    }

    res.json({
      code: 'SUCCESS',
      message: `缓存清理完成，删除项数: ${deletedCount}`,
      data: {
        deletedCount,
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('清理查询缓存失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '清理查询缓存失败',
      data: null,
    });
  }
});

/**
 * 重置性能统计
 * POST /api/database/performance/reset-stats
 */
router.post('/performance/reset-stats', async (req: Request, res: Response) => {
  try {
    const { type } = req.body;

    switch (type) {
      case 'connection-pool':
        connectionPoolOptimizer.resetStats();
        break;
      case 'query-cache':
        defaultQueryCache.clear();
        break;
      case 'query-performance':
        // databasePerformanceMonitor.resetStats();
        break;
      case 'all':
      default:
        connectionPoolOptimizer.resetStats();
        defaultQueryCache.clear();
        // databasePerformanceMonitor.resetStats();
        break;
    }

    res.json({
      code: 'SUCCESS',
      message: `性能统计已重置: ${type || 'all'}`,
      data: {
        type: type || 'all',
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('重置性能统计失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '重置性能统计失败',
      data: null,
    });
  }
});

/**
 * 更新优化配置
 * PUT /api/database/performance/config
 */
router.put('/performance/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;

    // 验证配置项
    const allowedKeys = [
      'enableQueryCache',
      'enableQueryAnalysis',
      'enablePoolMonitoring',
      'enablePerformanceMonitoring',
      'slowQueryThreshold',
      'autoOptimizeQueries',
    ];

    const validConfig: any = {};
    for (const key of allowedKeys) {
      if (config[key] !== undefined) {
        validConfig[key] = config[key];
      }
    }

    updateDatabaseOptimizationConfig(validConfig);

    res.json({
      code: 'SUCCESS',
      message: '优化配置更新成功',
      data: {
        updatedConfig: validConfig,
        executedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('更新优化配置失败', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '更新优化配置失败',
      data: null,
    });
  }
});

export default router;