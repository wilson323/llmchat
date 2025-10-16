import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

/**
 * 请求日志条目
 */
interface LogEntry {
  timestamp: Date;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string | undefined;
  userAgent: string | undefined;
  userId: string | undefined;
  requestId: string | undefined;
}

/**
 * 异步批量请求日志器
 * 
 * 性能优势：
 * - 日志收集不阻塞HTTP响应
 * - 批量写入降低I/O频率99%
 * - 内存队列，快速读写
 * 
 * 使用方式：
 * ```typescript
 * import { asyncRequestLogger } from '@/middleware/AsyncBatchRequestLogger';
 * app.use(asyncRequestLogger);
 * ```
 */
export class AsyncBatchRequestLogger {
  private logQueue: LogEntry[] = [];
  private batchSize = 100;           // 100条批量写入
  private flushInterval = 5000;      // 5秒强制刷新
  private lastFlushTime = Date.now();
  private flushTimer: NodeJS.Timeout;

  constructor() {
    // 定时刷新队列
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
    
    // 进程退出前刷新
    process.on('beforeExit', () => {
      this.flush();
      clearInterval(this.flushTimer);
    });
  }

  /**
   * Express中间件
   */
  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = (req as any).requestId || `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

    // 监听响应完成
    res.on('finish', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        requestId,
      };

      // 推入队列（不等待）
      this.logQueue.push(logEntry);

      // 队列满了立即刷新
      if (this.logQueue.length >= this.batchSize) {
        this.flush();
      }
    });

    // 立即调用next，不等待日志
    next();
  };

  /**
   * 批量刷新日志到文件
   */
  private flush(): void {
    if (this.logQueue.length === 0) {
      return;
    }

    // 异步执行，不阻塞主线程
    setImmediate(() => {
      try {
        const batch = this.logQueue.splice(0, this.batchSize);
        
        // 检查batch不为空
        if (batch.length === 0) {
          return;
        }
        
        // 批量记录
        logger.info('Request batch', {
          count: batch.length,
          period: {
            start: batch[0]!.timestamp,
            end: batch[batch.length - 1]!.timestamp,
          },
          summary: {
            totalRequests: batch.length,
            avgDuration: batch.reduce((sum, log) => sum + log.duration, 0) / batch.length,
            errorCount: batch.filter(log => log.statusCode >= 400).length,
            methods: this.countBy(batch, 'method'),
          },
          logs: batch.map(log => ({
            time: log.timestamp,
            method: log.method,
            url: log.url,
            status: log.statusCode,
            duration: log.duration,
            ...(log.userId && { userId: log.userId }),
          })),
        });
        
        this.lastFlushTime = Date.now();
      } catch (err) {
        // 静默失败，不影响服务
        logger.error('Log flush failed', { 
          error: (err as Error).message,
          queueSize: this.logQueue.length,
        });
      }
    });
  }

  /**
   * 辅助方法：按字段计数
   */
  private countBy(array: LogEntry[], key: keyof LogEntry): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      queueSize: this.logQueue.length,
      timeSinceLastFlush: Date.now() - this.lastFlushTime,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
    };
  }

  /**
   * 手动刷新（用于测试或紧急情况）
   */
  forceFlush(): void {
    this.flush();
  }
}

// 导出单例
export const asyncBatchRequestLogger = new AsyncBatchRequestLogger();

// 导出中间件
export const asyncRequestLogger = asyncBatchRequestLogger.middleware;

// 默认导出
export default asyncRequestLogger;

