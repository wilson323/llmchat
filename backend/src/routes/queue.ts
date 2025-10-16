/**
 * 队列管理路由
 * 提供队列操作、任务管理和监控的API端点
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import QueueController from '@/controllers/queueController';
import { rateLimit } from 'express-rate-limit';
import logger from '@/utils/logger';

const router: Router = Router();
const queueController = new QueueController();

// 队列操作的速率限制
const queueRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 最多100个请求
  message: {
    success: false,
    message: 'Too many queue operations, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 管理操作的更严格速率限制
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 20, // 最多20个请求
  message: {
    success: false,
    message: 'Too many admin operations, please try again later'
  }
});

// ==================== 队列管理 ====================

/**
 * GET /api/queue
 * 获取所有队列列表
 */
router.get('/', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getQueues(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/queue/:queueName
 * 获取指定队列的详细信息
 */
router.get('/:queueName', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getQueue(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue
 * 创建新队列
 */
router.post('/', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.createQueue(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue/:queueName/pause
 * 暂停队列
 */
router.post('/:queueName/pause', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.pauseQueue(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue/:queueName/resume
 * 恢复队列
 */
router.post('/:queueName/resume', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.resumeQueue(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue/:queueName/clean
 * 清理队列
 */
router.post('/:queueName/clean', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.cleanQueue(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/queue/:queueName/config
 * 更新队列配置
 */
router.put('/:queueName/config', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.updateQueueConfig(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ==================== 任务管理 ====================

/**
 * POST /api/queue/:queueName/jobs
 * 添加任务到队列
 */
router.post('/:queueName/jobs', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.addJob(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/queue/:queueName/jobs/:jobId
 * 获取任务详情
 */
router.get('/:queueName/jobs/:jobId', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getJob(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/queue/:queueName/jobs/:jobId
 * 删除任务
 */
router.delete('/:queueName/jobs/:jobId', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.removeJob(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue/:queueName/jobs/:jobId/retry
 * 重试失败的任务
 */
router.post('/:queueName/jobs/:jobId/retry', adminRateLimit, async (req, res, next) => {
  try {
    await queueController.retryJob(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue/:queueName/jobs/bulk
 * 批量操作任务
 */
router.post('/:queueName/jobs/bulk', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.bulkJobs(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ==================== 监控和统计 ====================

/**
 * GET /api/queue/:queueName/stats
 * 获取队列统计信息
 */
router.get('/:queueName/stats', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getQueueStats(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/queue/:queueName/metrics
 * 获取队列性能指标
 */
router.get('/:queueName/metrics', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getMetrics(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/queue/health
 * 获取所有队列的健康状态
 */
router.get('/health', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getHealthStatus(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/queue/status
 * 获取队列整体状态概览
 */
router.get('/status', queueRateLimit, async (req, res, next) => {
  try {
    await queueController.getHealthStatus(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ==================== 任务状态查询 ====================

/**
 * GET /api/queue/job/:jobId/status
 * 通过任务ID查询状态（不指定队列）
 */
router.get('/job/:jobId/status', queueRateLimit, async (req, res, next) => {
  try {
    // 这里需要一个特殊的控制器方法来跨队列搜索
    // 临时重定向到第一个队列
    const modifiedReq = req as Request;
    modifiedReq.params = { ...req.params, queueName: 'chat-processing' };
    await queueController.getJob(modifiedReq, res, next);
  } catch (error) {
    next(error);
  }
});

// 错误处理中间件
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Queue route error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: (req as any).ip || req.socket.remoteAddress
  });

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format',
      error: 'Invalid request body'
    });
  }

  return res.status((error).status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

export default router;