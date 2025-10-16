import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { performance } from 'perf_hooks';

/**
 * 性能监控数据接口
 */
interface PerformanceData {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  userAgent: string | undefined;
  ip: string | undefined;
  userId: string | undefined;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } | undefined;
  errors: string[] | undefined;
}

/**
 * 性能统计摘要
 */
interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  slowestRequest: number;
  fastestRequest: number;
  errorRate: number;
  requestsPerMinute: number;
  memoryUsage: {
    averageRss: number;
    averageHeapUsed: number;
  };
}

/**
 * 性能监控中间件
 */
export class PerformanceMonitor {
  private performanceData: PerformanceData[] = [];
  private maxDataPoints = 10000; // 保留最近10000个请求的数据
  private slowRequestThreshold = 5000; // 超过5秒的请求被视为慢请求
  private summaryInterval = 60000; // 1分钟生成一次摘要
  private lastSummaryTime = Date.now();

  /**
   * 性能监控中间件
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const self = this;
      const startTime = performance.now();
      const requestId = this.generateRequestId();

      // 将requestId添加到请求对象中，以便后续使用
      req.requestId = requestId;

      // 记录初始内存使用情况
      const initialMemory = process.memoryUsage();

      // 捕获响应数据
      const originalSend = res.send;
      const errors: string[] = [];

      res.send = function (this: Response, data: any) {
        // 记录响应结束时间
        const endTime = performance.now();
        const duration = endTime - startTime;

        // 获取最终内存使用情况
        const finalMemory = process.memoryUsage();

        // 创建性能数据
        const perfData: PerformanceData = {
          requestId,
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress,
          userId: (req as any).user?.id, // 假设用户信息在req.user中
          memoryUsage: {
            rss: finalMemory.rss - initialMemory.rss,
            heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
            heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
            external: finalMemory.external - initialMemory.external,
          },
          errors: errors.length > 0 ? errors : undefined,
        };

        // 存储性能数据（异步执行，不阻塞响应）
        setImmediate(() => {
          try {
            self.storePerformanceData(perfData);
          } catch (err) {
            // 静默失败，不影响响应
          }
        });

        // 🔧 完全移除所有logger调用，避免阻塞
        // 仅保留性能头部
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.setHeader('X-Request-ID', requestId);

        // 调用原始send方法
        return originalSend.call(this, data);
      }.bind(res);

      // 监听错误事件（移除logger调用避免阻塞）
      res.on('error', (error) => {
        errors.push(error.message);
        // 🔧 移除logger.error避免阻塞
      });

      next();
    };
  }

  /**
   * 生成唯一的请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 存储性能数据
   */
  private storePerformanceData(data: PerformanceData): void {
    this.performanceData.push(data);

    // 限制数据点数量，避免内存泄漏
    if (this.performanceData.length > this.maxDataPoints) {
      this.performanceData = this.performanceData.slice(-this.maxDataPoints);
    }

    // 定期生成摘要
    const now = Date.now();
    if (now - this.lastSummaryTime >= this.summaryInterval) {
      this.generatePerformanceSummary();
      this.lastSummaryTime = now;
    }
  }

  /**
   * 生成性能摘要（异步执行，避免阻塞）
   */
  private generatePerformanceSummary(): void {
    if (this.performanceData.length === 0) {
      return;
    }

    // 🔧 使用setImmediate异步执行，避免阻塞事件循环
    setImmediate(() => {
      try {
        const summary = this.calculatePerformanceSummary();
        // 完全移除logger调用，避免任何可能的阻塞
      } catch (err) {
        // 静默失败
      }
    });
  }

  /**
   * 计算性能摘要
   */
  public calculatePerformanceSummary(): PerformanceSummary {
    if (this.performanceData.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowestRequest: 0,
        fastestRequest: 0,
        errorRate: 0,
        requestsPerMinute: 0,
        memoryUsage: {
          averageRss: 0,
          averageHeapUsed: 0,
        },
      };
    }

    const recentData = this.performanceData.slice(-1000); // 最近1000个请求
    const durations = recentData.map(d => d.duration);
    const errorCount = recentData.filter(d => d.statusCode >= 400).length;

    // 计算时间范围（分钟）
    const timeRange = recentData[0] ? (Date.now() - new Date(recentData[0].timestamp).getTime()) / 60000 : 0;
    const requestsPerMinute = timeRange > 0 ? recentData.length / timeRange : 0;

    // 计算内存使用平均值
    const memoryUsages = recentData
      .filter(d => d.memoryUsage)
      .map(d => d.memoryUsage!);

    const averageMemoryUsage = memoryUsages.length > 0
      ? memoryUsages.reduce((acc, mem) => ({
        rss: acc.rss + mem.rss,
        heapUsed: acc.heapUsed + mem.heapUsed,
      }), { rss: 0, heapUsed: 0 })
      : { rss: 0, heapUsed: 0 };

    const count = memoryUsages.length || 1;

    return {
      totalRequests: recentData.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      slowestRequest: Math.max(...durations),
      fastestRequest: Math.min(...durations),
      errorRate: errorCount / recentData.length,
      requestsPerMinute,
      memoryUsage: {
        averageRss: averageMemoryUsage.rss / count,
        averageHeapUsed: averageMemoryUsage.heapUsed / count,
      },
    };
  }

  /**
   * 获取详细性能数据
   */
  public getPerformanceData(limit: number = 100): PerformanceData[] {
    return this.performanceData.slice(-limit);
  }

  /**
   * 获取慢请求列表
   */
  public getSlowRequests(threshold?: number): PerformanceData[] {
    const slowThreshold = threshold || this.slowRequestThreshold;
    return this.performanceData
      .filter(d => d.duration > slowThreshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * 获取错误请求列表
   */
  public getErrorRequests(): PerformanceData[] {
    return this.performanceData
      .filter(d => d.statusCode >= 400)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * 清除旧数据
   */
  public clearOldData(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    this.performanceData = this.performanceData.filter(
      d => new Date(d.timestamp).getTime() > cutoffTime,
    );
  }
}

// 导出单例实例
export const performanceMonitor = new PerformanceMonitor();

// 导出中间件函数
export const performanceMiddleware = performanceMonitor.middleware.bind(performanceMonitor);