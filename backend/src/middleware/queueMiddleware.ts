/**
 * Express消息队列中间件
 * 提供HTTP请求到队列任务的转换，支持异步处理
 */

import { Request, Response, NextFunction } from 'express';
import QueueManager from '@/services/QueueManager';
import logger from '@/utils/logger';
import { QueueOptions, MessagePriority } from '@/types/queue';

export interface QueueMiddlewareConfig {
  queueName: string;
  jobType: string;
  priority?: MessagePriority;
  delay?: number;
  attempts?: number;
  responseMode?: 'async' | 'sync' | 'hybrid';
  timeout?: number;
  resultKey?: string;
  enableProgress?: boolean;
  metadata?: Record<string, unknown>;
}

export interface QueueResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  progress?: number;
  estimatedTime?: number;
}

class QueueMiddlewareManager {
  private queueManager: QueueManager;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor() {
    this.queueManager = QueueManager.getInstance();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听队列事件
    this.queueManager.on('queue:*:events', (event: any) => {
      this.handleQueueEvent(event);
    });
  }

  private handleQueueEvent(event: any): void {
    const pending = this.pendingRequests.get(event.jobId);
    if (!pending) {
      return;
    }

    const { resolve, reject, timeout } = pending;

    switch (event.type) {
      case 'job:completed':
        clearTimeout(timeout);
        this.pendingRequests.delete(event.jobId);
        resolve({
          jobId: event.jobId,
          status: 'completed',
          result: event.data?.result,
          progress: 100
        });
        break;

      case 'job:failed':
        clearTimeout(timeout);
        this.pendingRequests.delete(event.jobId);
        reject(new Error(event.data?.error || 'Job failed'));
        break;

      case 'job:progress':
        if (pending) {
          // 可以发送进度更新（WebSocket或SSE）
          logger.debug(`Job ${event.jobId} progress: ${event.data?.progress}%`);
        }
        break;
    }
  }

  public queueRequest(config: QueueMiddlewareConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const queueManager = QueueManager.getInstance();

        // 准备任务数据
        const jobData = {
          method: req.method,
          url: req.url,
          headers: this.sanitizeHeaders(req.headers),
          body: req.body,
          query: req.query,
          params: req.params,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        };

        // 准备队列选项
        const queueOptions: QueueOptions = {
          priority: config.priority || MessagePriority.NORMAL,
          delay: config.delay || 0,
          attempts: config.attempts || 3,
          metadata: {
            ...config.metadata,
            originalRequest: {
              method: req.method,
              url: req.url,
              ip: req.ip || 'unknown'
            }
          }
        };

        // 添加任务到队列
        const jobId = await queueManager.addJob(
          config.queueName,
          config.jobType,
          jobData,
          queueOptions
        );

        // 根据响应模式处理
        switch (config.responseMode) {
          case 'async':
            this.handleAsyncResponse(res, jobId, config);
            break;

          case 'sync':
            await this.handleSyncResponse(req, res, jobId, config);
            break;

          case 'hybrid':
            this.handleHybridResponse(req, res, jobId, config);
            break;

          default:
            this.handleAsyncResponse(res, jobId, config);
        }

      } catch (error) {
        logger.error('QueueMiddleware: Error queuing request:', error);
        next(error);
      }
    };
  }

  private handleAsyncResponse(res: Response, jobId: string, config: QueueMiddlewareConfig): void {
    const response: QueueResponse = {
      jobId,
      status: 'queued',
      estimatedTime: this.estimateProcessingTime(config)
    };

    res.status(202).json({
      success: true,
      message: 'Request queued for processing',
      data: response
    });
  }

  private async handleSyncResponse(
    req: Request,
    res: Response,
    jobId: string,
    config: QueueMiddlewareConfig
  ): Promise<void> {
    try {
      const result = await this.waitForJobCompletion(jobId, config.timeout || 30000);

      res.json({
        success: true,
        message: 'Request processed successfully',
        data: result
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Request processing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private handleHybridResponse(
    req: Request,
    res: Response,
    jobId: string,
    config: QueueMiddlewareConfig
  ): void {
    // 立即返回任务ID
    this.handleAsyncResponse(res, jobId, config);

    // 可选：在后台处理完成时发送通知（邮件、WebSocket等）
    this.waitForJobCompletion(jobId, config.timeout || 30000)
      .then(result => {
        logger.info(`Hybrid mode: Job ${jobId} completed`, result);
        // 这里可以添加通知逻辑
      })
      .catch(error => {
        logger.error(`Hybrid mode: Job ${jobId} failed`, error);
      });
  }

  private async waitForJobCompletion(
    jobId: string,
    timeout: number
  ): Promise<QueueResponse> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(jobId);
        reject(new Error('Job processing timeout'));
      }, timeout);

      this.pendingRequests.set(jobId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
    });
  }

  private estimateProcessingTime(config: QueueMiddlewareConfig): number {
    // 基于历史数据和队列状态估算处理时间
    // 这里返回一个默认估算
    return 5000; // 5秒
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        // 移除敏感头信息
        if (!key.toLowerCase().includes('authorization') &&
            !key.toLowerCase().includes('cookie') &&
            !key.toLowerCase().includes('password')) {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  public async getJobStatus(jobId: string, queueName?: string): Promise<QueueResponse | null> {
    try {
      const queueManager = QueueManager.getInstance();

      if (queueName) {
        const job = await queueManager.getJob(queueName, jobId);
        if (!job) {
          return null;
        }

        const response: QueueResponse = {
          jobId,
          status: job.finishedOn ? 'completed' :
                 job.failedAt ? 'failed' :
                 job.processedOn ? 'processing' : 'queued',
          progress: job.progress || 0
        };

        // 只在有值时添加可选属性
        if (job.returnvalue !== undefined) {
          response.result = job.returnvalue;
        }

        if (job.failedReason !== undefined) {
          response.error = job.failedReason;
        }

        return response;
      }

      // 如果没有指定队列，在所有队列中搜索
      const queues = ['chat-processing', 'email-notification', 'webhook-processing'];

      for (const queue of queues) {
        const job = await queueManager.getJob(queue, jobId);
        if (job) {
          const response: QueueResponse = {
            jobId,
            status: job.finishedOn ? 'completed' :
                   job.failedAt ? 'failed' :
                   job.processedOn ? 'processing' : 'queued',
            progress: job.progress || 0
          };

          // 只在有值时添加可选属性
          if (job.returnvalue !== undefined) {
            response.result = job.returnvalue;
          }

          if (job.failedReason !== undefined) {
            response.error = job.failedReason;
          }

          return response;
        }
      }

      return null;

    } catch (error) {
      logger.error('QueueMiddleware: Error getting job status:', error);
      return null;
    }
  }

  public async handleBulkAdd(
    queueManager: QueueManager,
    queueName: string,
    jobs: any[],
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const results = await Promise.allSettled(
        jobs.map(job => queueManager.addJob(queueName, job.type, job.data, job.options))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      res.json({
        success: true,
        message: `Bulk add completed. Success: ${successful}, Failed: ${failed}`,
        data: {
          total: jobs.length,
          successful,
          failed,
          jobIds: results.map(r => r.status === 'fulfilled' ? r.value : null)
        }
      });

    } catch (error) {
      logger.error('Bulk add error:', error);
      next(error);
    }
  }

  public async handleBulkRemove(
    queueManager: QueueManager,
    queueName: string,
    jobs: any[],
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const results = await Promise.allSettled(
        jobs.map(job => queueManager.removeJob(queueName, job.jobId))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

      res.json({
        success: true,
        message: `Bulk remove completed. Success: ${successful}, Failed: ${failed}`,
        data: {
          total: jobs.length,
          successful,
          failed
        }
      });

    } catch (error) {
      logger.error('Bulk remove error:', error);
      next(error);
    }
  }

  public async handleBulkRetry(
    queueManager: QueueManager,
    queueName: string,
    jobs: any[],
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const results = await Promise.allSettled(
        jobs.map(job => queueManager.retryJob(queueName, job.jobId))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

      res.json({
        success: true,
        message: `Bulk retry completed. Success: ${successful}, Failed: ${failed}`,
        data: {
          total: jobs.length,
          successful,
          failed
        }
      });

    } catch (error) {
      logger.error('Bulk retry error:', error);
      next(error);
    }
  }
}

// 全局队列中间件管理器实例
const queueMiddlewareManager = new QueueMiddlewareManager();

/**
 * 创建队列中间件
 * @param config 队列配置
 * @returns Express中间件函数
 */
export function queueMiddleware(config: QueueMiddlewareConfig) {
  return queueMiddlewareManager.queueRequest(config);
}

/**
 * 获取任务状态中间件
 * 检查任务处理状态和结果
 */
export function jobStatusMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { jobId } = req.params;
  const { queue } = req.query;

  if (!jobId) {
    res.status(400).json({
      success: false,
      message: 'Job ID is required'
    });
    return;
  }

  queueMiddlewareManager.getJobStatus(jobId, queue as string)
    .then(status => {
      if (!status) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });
    })
    .catch(error => {
      logger.error('Job status middleware error:', error);
      next(error);
    });
}

/**
 * 队列监控中间件
 * 提供队列状态和性能指标
 */
export function queueMonitorMiddleware(req: Request, res: Response, next: NextFunction): void {
  const queueManager = QueueManager.getInstance();
  const { queue } = req.params;

  if (queue) {
    // 获取特定队列状态
    queueManager.getQueueStats(queue)
      .then(stats => {
        if (!stats) {
          res.status(404).json({
            success: false,
            message: 'Queue not found'
          });
          return;
        }

        res.json({
          success: true,
          data: stats
        });
      })
      .catch(error => {
        logger.error('Queue monitor error:', error);
        next(error);
      });
  } else {
    // 获取所有队列状态
    const queues = ['chat-processing', 'email-notification', 'webhook-processing'];
    const promises = queues.map(q => queueManager.getQueueStats(q));

    Promise.all(promises)
      .then(allStats => {
        const validStats = allStats.filter(Boolean);

        res.json({
          success: true,
          data: {
            queues: validStats,
            summary: {
              totalQueues: validStats.length,
              totalWaiting: validStats.reduce((sum, s) => sum + s!.waiting, 0),
              totalActive: validStats.reduce((sum, s) => sum + s!.active, 0),
              totalCompleted: validStats.reduce((sum, s) => sum + s!.completed, 0),
              totalFailed: validStats.reduce((sum, s) => sum + s!.failed, 0)
            }
          }
        });
      })
      .catch(error => {
        logger.error('Queue monitor error:', error);
        next(error);
      });
  }
}

/**
 * 批量队列操作中间件
 */
export function queueBulkMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { operation } = req.params;
  const { jobs, queue } = req.body;

  if (!queue || !Array.isArray(jobs)) {
    res.status(400).json({
      success: false,
      message: 'Queue name and jobs array are required'
    });
    return;
  }

  const queueManager = QueueManager.getInstance();
  const middlewareManager = new QueueMiddlewareManager();

  switch (operation) {
    case 'add':
      middlewareManager.handleBulkAdd(queueManager, queue, jobs, res, next);
      break;

    case 'remove':
      middlewareManager.handleBulkRemove(queueManager, queue, jobs, res, next);
      break;

    case 'retry':
      middlewareManager.handleBulkRetry(queueManager, queue, jobs, res, next);
      break;

    default:
      res.status(400).json({
        success: false,
        message: 'Invalid operation. Supported: add, remove, retry'
      });
  }
}

export default queueMiddlewareManager;