/**
 * 队列管理可视化路由
 */

import { Router, Request, Response } from 'express';
import VisualizationController from '@/controllers/VisualizationController';
import { authenticateToken, requirePermission } from '@/middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router() as any;

// 创建可视化控制器实例
let visualizationController: VisualizationController;

// 初始化函数
export const initializeVisualizationRoutes = (
  controller: VisualizationController
): void => {
  visualizationController = controller;
};

// 认证中间件
const requireAuth = authenticateToken;

// 权限中间件
const requireAdmin = requirePermission('admin');
const requireOperator = requirePermission('operator');

// 速率限制中间件
const createRateLimit = (windowMs: number, max: number) => rateLimit({
  windowMs,
  max,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API速率限制
const apiRateLimit = createRateLimit(15 * 60 * 1000, 100); // 15分钟100次请求
const realtimeRateLimit = createRateLimit(1 * 60 * 1000, 10); // 1分钟10次请求

// 配置相关路由
router.get('/config', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getConfig(req, res)
);

router.put('/config', requireAuth, requireAdmin, apiRateLimit,
  (req, res) => visualizationController.updateConfig(req, res)
);

router.get('/presets', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getPresets(req, res)
);

router.post('/presets/apply', requireAuth, requireAdmin, apiRateLimit,
  (req, res) => visualizationController.applyPreset(req, res)
);

// 仪表板数据路由
router.get('/dashboard', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getDashboardData(req, res)
);

// 队列统计路由
router.get('/queues/stats', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getQueueStats(req, res)
);

// 系统统计路由
router.get('/system/stats', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getSystemStats(req, res)
);

// Redis统计路由
router.get('/redis/stats', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getRedisStats(req, res)
);

// 图表数据路由
router.get('/charts/data', requireAuth, requireOperator, apiRateLimit,
  (req, res) => visualizationController.getChartData(req, res)
);

// 实时更新路由 (SSE)
router.get('/realtime', requireAuth, requireOperator, realtimeRateLimit,
  (req, res) => visualizationController.getRealtimeUpdates(req, res)
);

// 队列操作路由
router.post('/queues/:queueName/action', requireAuth, requireOperator, apiRateLimit,
  (req, res) => {
    req.body.queueName = req.params.queueName;
    visualizationController.performQueueAction(req, res);
  }
);

// 健康检查路由 (无需认证)
router.get('/health', apiRateLimit,
  (req, res) => visualizationController.healthCheck(req, res)
);

// 错误处理中间件
router.use((error: Error, req: Request, res: Response, next: any) => {
  console.error('Visualization route error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404处理
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

export default router;