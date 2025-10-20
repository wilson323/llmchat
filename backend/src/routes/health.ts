/**
 * 增强的健康检查路由
 * 包含数据库和Redis状态检查
 */

import { Router, Request, Response } from 'express';
import { getPool } from '@/utils/db';
import { authService } from '@/services/authInstance';
import logger from '@/utils/logger';

const router: Router = Router();

/**
 * 基础健康检查端点
 * GET /health
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * 详细健康检查端点
 * GET /health/detailed
 * 包含数据库和Redis连接状态
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    database: {
      status: 'unknown',
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
    redis: {
      status: 'unknown',
      connected: false,
    },
  };

  // 检查数据库连接
  try {
    const pool = getPool();
    healthStatus.database = {
      status: 'connected',
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
    };

    // 执行简单查询验证数据库可用
    await pool.query('SELECT 1');
  } catch (error) {
    logger.error('Health check: Database check failed', { error });
    healthStatus.database.status = 'error';
    healthStatus.status = 'degraded';
  }

  // 检查Redis连接
  try {
    const redis = (authService as any).redis;
    if (redis) {
      // 检查Redis连接状态
      const pingResult = await redis.ping();
      healthStatus.redis = {
        status: pingResult === 'PONG' ? 'connected' : 'error',
        connected: pingResult === 'PONG',
      };
    } else {
      healthStatus.redis = {
        status: 'not_configured',
        connected: false,
      };
    }
  } catch (error) {
    logger.error('Health check: Redis check failed', { error });
    healthStatus.redis.status = 'error';
    healthStatus.status = 'degraded';
  }

  // 根据组件状态设置总体状态
  if (healthStatus.database.status === 'error' || healthStatus.redis.status === 'error') {
    healthStatus.status = 'degraded';
  }

  const statusCode = healthStatus.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

export default router;