/**
 * 健康检查路由
 */

import { Router, Request, Response, type Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * 基本健康检查
 * GET /health
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'llmchat-backend',
  });
});

/**
 * 详细健康检查
 * GET /health/detailed
 */
router.get('/detailed', (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'llmchat-backend',
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    env: process.env.NODE_ENV || 'development',
  });
});

export default router;
export { router as healthRoutes };

