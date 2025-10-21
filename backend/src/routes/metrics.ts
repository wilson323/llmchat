/**
 * Prometheus metrics端点
 * 提供Prometheus格式的监控指标
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prometheusService } from '@/services/PrometheusService';
import logger from '@/utils/logger';

// HTTP状态常量
const HTTP_STATUS = {
  OK: 200,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const router: Router = Router();

/**
 * Prometheus metrics端点
 * GET /metrics
 *
 * 返回Prometheus格式的监控指标
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 获取metrics数据
    const metrics = await prometheusService.getMetrics();

    // 设置正确的Content-Type
    res.set('Content-Type', prometheusService.getContentType());

    // 返回metrics
    res.status(HTTP_STATUS.OK).send(metrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics', { error });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: 'METRICS_ERROR',
      message: '获取监控指标失败',
      timestamp: new Date().toISOString(),
    });
    next(error);
  }
});

export default router;
