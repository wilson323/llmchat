/**
 * 增强版健康检查路由
 * 支持基础检查、详细检查、就绪检查、存活检查
 */

import { Router, Request, Response, type Router as RouterType } from 'express';
import { getPool } from '@/utils/db';
import logger from '@/utils/logger';

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

export default router;
export { router as healthRoutes };
