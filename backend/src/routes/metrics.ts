/**
 * Prometheus Metrics路由
 * 
 * 提供/metrics端点供Prometheus抓取指标
 */

import { Router } from 'express';
import type { Router as ExpressRouter , Request, Response } from 'express';
import MetricsService from '@/services/MetricsService';
import logger from '@/utils/logger';

const router: ExpressRouter = Router();

/**
 * GET /metrics
 * 
 * 返回Prometheus格式的所有指标
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metricsService = MetricsService;
    const metrics = await metricsService.getMetrics();
    
    // 设置正确的Content-Type
    res.set('Content-Type', metricsService.getContentType());
    res.send(metrics);
  } catch (error: any) {
    logger.error('获取metrics失败', { error: error.message });
    res.status(500).send('Internal Server Error');
  }
});

/**
 * POST /metrics/reset (可选，仅用于开发/测试)
 * 
 * 重置所有metrics计数器
 * 注意：生产环境应该禁用此端点或添加认证
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/reset', (req: Request, res: Response) => {
    try {
      const metricsService = MetricsService;
      metricsService.reset();
      
      res.json({
        success: true,
        message: 'Metrics已重置',
      });
    } catch (error: any) {
      logger.error('重置metrics失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '重置失败',
        error: error.message,
      });
    }
  });
}

export default router;

