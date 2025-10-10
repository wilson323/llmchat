/**
 * 增强版健康检查路由
 * 支持基础检查、详细检查、就绪检查、存活检查、性能监控
 */

import { Router, Request, Response, type Router as RouterType } from 'express';
import { getPool } from '@/utils/db';
import logger from '@/utils/logger';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';
import { performanceMonitor } from '@/middleware/PerformanceMonitor';
import { databaseQueryOptimizer } from '@/utils/DatabaseQueryOptimizer';
import { connectionPoolOptimizer } from '@/utils/ConnectionPoolOptimizer';

const router: RouterType = Router();

/**
 * 检查数据库健康状态
 */
async function checkDatabaseHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  const startTime = Date.now();

  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1 as health_check');
    const latency = Date.now() - startTime;

    return {
      healthy: result.rows.length > 0,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 检查 Redis 健康状态
 */
async function checkRedisHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  const startTime = Date.now();

  try {
    // 使用 CacheService 检查 Redis
    const { getCacheService } = await import('@/services/CacheService');
    const cacheService = getCacheService();

    if (!cacheService.isConnected()) {
      return {
        healthy: false,
        error: 'Redis not configured or not connected',
      };
    }

    const pingResult = await cacheService.ping();
    const latency = Date.now() - startTime;

    return {
      healthy: pingResult,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 检查智能体服务健康状态
 */
async function checkAgentsHealth(): Promise<{ healthy: boolean; activeCount?: number; error?: string }> {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM agent_configs WHERE is_active = true',
    );

    const activeCount = parseInt(result.rows[0]?.count || '0', 10);

    return {
      healthy: activeCount > 0,
      activeCount,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 基本健康检查
 * GET /health
 * 用于快速检查服务是否运行
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'llmchat-backend',
    version: process.env.APP_VERSION || '1.0.0',
  });
});

/**
 * 详细健康检查
 * GET /health/detailed
 * 包含系统资源、内存、数据库、Redis、智能体状态
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  // 并行检查所有组件
  const [dbHealth, redisHealth, agentsHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkAgentsHealth(),
  ]);

  const allHealthy = dbHealth.healthy &&
    (redisHealth.healthy || redisHealth.error === 'Redis not configured') &&
    agentsHealth.healthy;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'llmchat-backend',
    version: process.env.APP_VERSION || '1.0.0',
    system: {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapUsedPercent: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}%`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      cpu: {
        user: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
        system: `${(cpuUsage.system / 1000000).toFixed(2)}s`,
      },
      env: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    },
    components: {
      database: dbHealth,
      redis: redisHealth,
      agents: agentsHealth,
    },
  });
});

/**
 * Kubernetes 就绪检查（Readiness Probe）
 * GET /health/ready
 * 检查服务是否准备好接收流量
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const [dbHealth, agentsHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkAgentsHealth(),
  ]);

  const ready = dbHealth.healthy && agentsHealth.healthy;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth.healthy,
      agents: agentsHealth.healthy,
    },
  });
});

/**
 * Kubernetes 存活检查（Liveness Probe）
 * GET /health/live
 * 检查服务是否存活（简单检查，避免误杀）
 */
router.get('/live', (_req: Request, res: Response) => {
  // 简单检查：进程是否响应
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * 启动检查（Startup Probe）
 * GET /health/startup
 * 检查服务启动是否完成
 */
router.get('/startup', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');

    res.json({
      status: 'started',
      timestamp: new Date().toISOString(),
      message: 'Service startup complete',
    });
  } catch (error) {
    res.status(503).json({
      status: 'starting',
      timestamp: new Date().toISOString(),
      message: 'Service still starting',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 性能监控检查
 * GET /health/performance
 * 获取系统性能指标和统计信息
 */
router.get('/performance', async (_req: Request, res: Response) => {
  try {
    // 获取性能优化器统计
    const optimizerStats = performanceOptimizer.getPerformanceStats();

    // 获取性能监控器统计
    const monitorSummary = performanceMonitor.calculatePerformanceSummary();

    // 获取数据库查询优化器统计
    const dbQueryStats = databaseQueryOptimizer.getPerformanceStats();

    // 获取连接池优化器统计
    const poolStats = connectionPoolOptimizer.getPoolStats();

    // 获取慢请求列表
    const slowRequests = performanceMonitor.getSlowRequests().slice(0, 10);

    // 获取错误请求列表
    const errorRequests = performanceMonitor.getErrorRequests().slice(0, 10);

    // 获取当前系统资源使用情况
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 检查数据库健康状态
    const dbHealth = await checkDatabaseHealth();

    // 计算系统健康评分
    const healthScore = calculateHealthScore({
      memory: memUsage,
      optimizerStats,
      monitorSummary,
      dbHealth,
      dbQueryStats,
      poolStats,
    });

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      healthScore,
      system: {
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapUsedPercent: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}%`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        },
        cpu: {
          user: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
          system: `${(cpuUsage.system / 1000000).toFixed(2)}s`,
        },
        uptime: process.uptime(),
      },
      performance: {
        optimizer: optimizerStats,
        monitor: monitorSummary,
        slowRequests: slowRequests.map(req => ({
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          duration: `${req.duration}ms`,
          statusCode: req.statusCode,
          timestamp: req.timestamp,
        })),
        errorRequests: errorRequests.map(req => ({
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          statusCode: req.statusCode,
          timestamp: req.timestamp,
          errors: req.errors,
        })),
      },
      database: {
        health: dbHealth,
        queries: {
          totalQueries: dbQueryStats.totalQueries,
          avgDuration: `${dbQueryStats.avgDuration}ms`,
          slowQueries: dbQueryStats.slowQueries,
          cacheHitRate: `${(dbQueryStats.cacheHitRate * 100).toFixed(2)}%`,
          topSlowQueries: dbQueryStats.topSlowQueries.slice(0, 5),
        },
        connectionPool: {
          totalConnections: poolStats.totalConnections,
          activeConnections: poolStats.activeConnections,
          idleConnections: poolStats.idleConnections,
          waitingClients: poolStats.waitingClients,
          utilizationRate: `${((poolStats.activeConnections / poolStats.maxConnections) * 100).toFixed(2)}%`,
        },
      },
    });
  } catch (error) {
    logger.error('Performance health check failed', { error });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Performance monitoring failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 计算系统健康评分（0-100）
 */
function calculateHealthScore(context: {
  memory: NodeJS.MemoryUsage;
  optimizerStats: any;
  monitorSummary: any;
  dbHealth: { healthy: boolean; latency?: number };
  dbQueryStats: any;
  poolStats: any;
}): number {
  let score = 100;

  // 内存使用率评分 (权重: 25%)
  const memoryUsagePercent = (context.memory.heapUsed / context.memory.heapTotal) * 100;
  if (memoryUsagePercent > 90) {
    score -= 25;
  } else if (memoryUsagePercent > 80) {
    score -= 15;
  } else if (memoryUsagePercent > 70) {
    score -= 8;
  }

  // 错误率评分 (权重: 20%)
  const errorRate = context.monitorSummary.errorRate || 0;
  if (errorRate > 0.1) { // 错误率超过10%
    score -= 20;
  } else if (errorRate > 0.05) { // 错误率超过5%
    score -= 12;
  } else if (errorRate > 0.01) { // 错误率超过1%
    score -= 4;
  }

  // 平均响应时间评分 (权重: 15%)
  const avgResponseTime = context.monitorSummary.averageResponseTime || 0;
  if (avgResponseTime > 5000) { // 超过5秒
    score -= 15;
  } else if (avgResponseTime > 2000) { // 超过2秒
    score -= 8;
  } else if (avgResponseTime > 1000) { // 超过1秒
    score -= 4;
  }

  // 数据库健康评分 (权重: 12%)
  if (!context.dbHealth.healthy) {
    score -= 12;
  } else if (context.dbHealth.latency && context.dbHealth.latency > 1000) { // 超过1秒
    score -= 8;
  } else if (context.dbHealth.latency && context.dbHealth.latency > 500) { // 超过500ms
    score -= 4;
  }

  // 数据库查询性能评分 (权重: 10%)
  const avgQueryDuration = context.dbQueryStats.avgDuration || 0;
  const queryErrorRate = context.dbQueryStats.totalQueries > 0 ?
    (context.dbQueryStats.connectionErrors / context.dbQueryStats.totalQueries) : 0;

  if (avgQueryDuration > 2000) { // 超过2秒
    score -= 6;
  } else if (avgQueryDuration > 1000) { // 超过1秒
    score -= 3;
  }

  if (queryErrorRate > 0.05) { // 错误率超过5%
    score -= 8;
  } else if (queryErrorRate > 0.02) { // 错误率超过2%
    score -= 4;
  }

  // 连接池使用率评分 (权重: 8%)
  const poolUtilization = context.poolStats.maxConnections > 0 ?
    (context.poolStats.activeConnections / context.poolStats.maxConnections) : 0;

  if (poolUtilization > 0.9) { // 超过90%
    score -= 5;
  } else if (poolUtilization > 0.8) { // 超过80%
    score -= 3;
  } else if (poolUtilization > 0.6) { // 超过60%
    score -= 1;
  }

  // 连接池等待评分 (权重: 5%)
  if (context.poolStats.waitingClients > 10) {
    score -= 5;
  } else if (context.poolStats.waitingClients > 5) {
    score -= 2;
  }

  // 查询缓存命中率评分 (权重: 5%)
  const cacheHitRate = context.dbQueryStats.cacheHitRate || 0;
  if (cacheHitRate < 0.3) { // 命中率低于30%
    score -= 3;
  } else if (cacheHitRate < 0.5) { // 命中率低于50%
    score -= 1;
  }

  // 请求数量评分 (权重: 5%)
  const requestsPerMinute = context.monitorSummary.requestsPerMinute || 0;
  if (requestsPerMinute > 1000) {
    score -= 5;
  } else if (requestsPerMinute > 500) {
    score -= 2;
  }

  return Math.max(0, Math.round(score));
}

export default router;
export { router as healthRoutes };
