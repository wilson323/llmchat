/**
 * 队列管理可视化路由
 */

import type { Request, Response} from 'express';
import { Router, NextFunction } from 'express';
import type VisualizationController from '@/controllers/VisualizationController';
import { authenticateJWT } from '@/middleware/jwtAuth';
import { rateLimiterMiddleware } from '@/middleware/rateLimiter';
import { logger } from '@/utils/logger';

const router = Router() as any;

// 创建可视化控制器实例
let visualizationController: VisualizationController;

// 初始化函数
export const initializeVisualizationRoutes = (
  controller: VisualizationController
): void => {
  visualizationController = controller;
};

// 简化的认证中间件
const requireAuth = authenticateJWT();

// 速率限制中间件
const apiRateLimit = rateLimiterMiddleware;
const realtimeRateLimit = rateLimiterMiddleware;

// 配置相关路由
router.get('/config', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getConfig(req, res)
);

router.put('/config', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.updateConfig(req, res)
);

router.get('/presets', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getPresets(req, res)
);

router.post('/presets/apply', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.applyPreset(req, res)
);

// 仪表板数据路由
router.get('/dashboard', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getDashboardData(req, res)
);

// 队列统计路由
router.get('/queues/stats', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getQueueStats(req, res)
);

// 系统统计路由
router.get('/system/stats', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getSystemStats(req, res)
);

// Redis统计路由
router.get('/redis/stats', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getRedisStats(req, res)
);

// 图表数据路由
router.get('/charts/data', requireAuth, apiRateLimit,
  (req: Request, res: Response) => visualizationController.getChartData(req, res)
);

// 实时更新路由 (SSE)
router.get('/realtime', requireAuth, realtimeRateLimit,
  (req: Request, res: Response) => visualizationController.getRealtimeUpdates(req, res)
);

// 队列操作路由
router.post('/queues/:queueName/action', requireAuth, apiRateLimit,
  (req: Request, res: Response) => {
    req.body.queueName = req.params.queueName;
    visualizationController.performQueueAction(req, res);
  }
);

// 健康检查路由 (无需认证)
router.get('/health', apiRateLimit,
  (req: Request, res: Response) => visualizationController.healthCheck(req, res)
);

// 错误处理中间件
router.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Visualization route error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404处理
router.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

export default router;