/**
 * Prometheus metrics端点
 * 提供Prometheus格式的监控指标
 */

import { Router, Request, Response } from 'express';
import { prometheusService } from '@/services/PrometheusService';
import logger from '@/utils/logger';

const router: Router = Router();

/**
 * Prometheus metrics端点
 * GET /metrics
 *
 * 返回Prometheus格式的监控指标
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 获取metrics数据
    const metrics = await prometheusService.getMetrics();

    // 设置正确的Content-Type
    res.set('Content-Type', prometheusService.getContentType());

    // 返回metrics
    res.status(200).send(metrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics', { error });
    res.status(500).json({
      code: 'METRICS_ERROR',
      message: '获取监控指标失败',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

