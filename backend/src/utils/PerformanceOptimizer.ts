/**
 * 后端性能优化器
 * 专注于资源监控、内存管理和API响应优化
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import logger from './logger';

// 性能指标接口
export interface PerformanceMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  requests: {
    active: number;
    total: number;
    averageResponseTime: number;
    slowRequests: number;
  };
  errors: {
    total: number;
    recent: Array<{
      timestamp: number;
      error: string;
      stack?: string;
    }>;
  };
}

// 请求性能监控接口
export interface RequestMetrics {
  id: string;
  method: string;
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  error?: string;
  memoryUsage: {
    start: number;
    end: number;
  };
}

// 内存使用监控器
export class MemoryMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxHistory = 1000;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  constructor(private eventEmitter: EventEmitter) {
    // Memory monitor specific event handling
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('启动内存监控');

    this.monitoringInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);

      // 保持历史记录在合理范围内
      if (this.metrics.length > this.maxHistory) {
        this.metrics.shift();
      }

      // 检查内存使用情况
      this.checkMemoryUsage(metrics);

      // 发送性能指标事件
      this.eventEmitter.emit('metrics', metrics);
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    logger.info('停止内存监控');
  }

  private collectMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 获取负载平均值（Linux/Unix）
    let loadAverage: number[] = [];
    try {
      if (typeof require !== 'undefined') {
        const os = require('os');
        loadAverage = os.loadavg();
      }
    } catch (err) {
      // 忽略loadavg获取错误
    }

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpu: {
        usage: cpuUsage.user + cpuUsage.system,
        loadAverage,
      },
      requests: {
        active: this.getActiveRequests(),
        total: this.getTotalRequests(),
        averageResponseTime: this.getAverageResponseTime(),
        slowRequests: this.getSlowRequests(),
      },
      errors: {
        total: this.getTotalErrors(),
        recent: this.getRecentErrors(),
      },
    };
  }

  private checkMemoryUsage(metrics: PerformanceMetrics): void {
    const { heapUsed, heapTotal } = metrics.memory;
    const usagePercent = (heapUsed / heapTotal) * 100;

    // 内存使用率超过80%时发出警告
    if (usagePercent > 80) {
      logger.warn('内存使用率过高', {
        usagePercent: usagePercent.toFixed(2),
        heapUsed: (heapUsed / 1024 / 1024).toFixed(2) + 'MB',
        heapTotal: (heapTotal / 1024 / 1024).toFixed(2) + 'MB',
      });

      // 触发垃圾回收建议
      this.eventEmitter.emit('memory:high', metrics);
    }

    // 内存使用率超过90%时强制垃圾回收
    if (usagePercent > 90) {
      logger.error('内存使用率危险，建议手动触发垃圾回收');
      this.eventEmitter.emit('memory:critical', metrics);

      if (global.gc) {
        try {
          global.gc();
          logger.info('手动触发垃圾回收完成');
        } catch (err) {
          logger.error('手动垃圾回收失败', err);
        }
      }
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1]! : null;
  }

  // 这些方法将在RequestMonitor中实现
  private getActiveRequests(): number { return 0; }
  private getTotalRequests(): number { return 0; }
  private getAverageResponseTime(): number { return 0; }
  private getSlowRequests(): number { return 0; }
  private getTotalErrors(): number { return 0; }
  private getRecentErrors(): Array<{ timestamp: number; error: string; stack?: string }> { return []; }
}

// 请求性能监控器
export class RequestMonitor {
  private activeRequests = new Map<string, RequestMetrics>();
  private completedRequests: RequestMetrics[] = [];
  private maxHistory = 10000;
  private slowRequestThreshold = 5000; // 5秒

  constructor(private eventEmitter: EventEmitter) {
    // Request monitor specific event handling
  }

  startRequest(id: string, method: string, url: string): void {
    const metrics: RequestMetrics = {
      id,
      method,
      url,
      startTime: Date.now(),
      memoryUsage: {
        start: process.memoryUsage().heapUsed,
        end: 0,
      },
    };

    this.activeRequests.set(id, metrics);
    this.eventEmitter.emit('request:started', metrics);
  }

  endRequest(id: string, statusCode: number, error?: string): void {
    const request = this.activeRequests.get(id);
    if (!request) {
      logger.warn('尝试结束不存在的请求', { requestId: id });
      return;
    }

    request.endTime = Date.now();
    request.duration = request.endTime - request.startTime;
    request.statusCode = statusCode;
    if (error) {
      request.error = error;
    }
    request.memoryUsage = {
      ...request.memoryUsage!,
      end: process.memoryUsage().heapUsed,
    };

    this.activeRequests.delete(id);
    this.completedRequests.push(request);

    // 保持历史记录在合理范围内
    if (this.completedRequests.length > this.maxHistory) {
      this.completedRequests.shift();
    }

    // 检查是否为慢请求
    if (request.duration && request.duration > this.slowRequestThreshold) {
      this.eventEmitter.emit('request:slow', request);
      logger.warn('检测到慢请求', {
        id: request.id,
        method: request.method,
        url: request.url,
        duration: request.duration,
        statusCode: request.statusCode,
      });
    }

    // 记录内存使用变化
    if (request.memoryUsage) {
      const memoryDelta = request.memoryUsage.end - request.memoryUsage.start;
      if (Math.abs(memoryDelta) > 10 * 1024 * 1024) { // 10MB
        this.eventEmitter.emit('request:memory-leak', {
          request,
          memoryDelta,
        });
      }
    }

    this.eventEmitter.emit('request:completed', request);
  }

  getActiveRequests(): RequestMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  getCompletedRequests(): RequestMetrics[] {
    return [...this.completedRequests];
  }

  getSlowRequests(): RequestMetrics[] {
    return this.completedRequests
      .filter(req => req.duration && req.duration > this.slowRequestThreshold)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }

  getAverageResponseTime(): number {
    const completed = this.completedRequests;
    if (completed.length === 0) return 0;

    const totalDuration = completed.reduce((sum, req) => sum + (req.duration || 0), 0);
    return totalDuration / completed.length;
  }

  getStats() {
    return {
      active: this.activeRequests.size,
      total: this.completedRequests.length,
      averageDuration: this.getAverageResponseTime(),
      slowRequests: this.getSlowRequests().length,
      errors: this.completedRequests.filter(req => req.error).length,
    };
  }
}

// 错误监控器
export class ErrorMonitor {
  private errors: Array<{
    timestamp: number;
    error: string;
    stack?: string;
    context?: any;
  }> = [];
  private maxHistory = 1000;

  constructor(private eventEmitter: EventEmitter) {
    // Error monitor specific event handling
  }

  recordError(error: Error, context?: any): void {
    const errorRecord = {
      timestamp: Date.now(),
      error: error.message,
      ...(error.stack && { stack: error.stack }),
      context,
    };

    this.errors.push(errorRecord);

    // 保持历史记录在合理范围内
    if (this.errors.length > this.maxHistory) {
      this.errors.shift();
    }

    logger.error('记录错误', {
      error: error.message,
      stack: error.stack,
      context,
    });

    this.eventEmitter.emit('error:recorded', errorRecord);

    // 检查错误率
    this.checkErrorRate();
  }

  private checkErrorRate(): void {
    const recentErrors = this.errors.filter(
      err => Date.now() - err.timestamp < 60000 // 最近1分钟
    );

    if (recentErrors.length > 10) {
      this.eventEmitter.emit('error:high-rate', recentErrors);
      logger.error('错误率过高', {
        count: recentErrors.length,
        timeWindow: '1分钟',
      });
    }
  }

  getRecentErrors(timeWindowMs: number = 300000): Array<{
    timestamp: number;
    error: string;
    stack?: string;
    context?: any;
  }> {
    const cutoff = Date.now() - timeWindowMs;
    return this.errors.filter(err => err.timestamp > cutoff);
  }

  getErrorStats() {
    const total = this.errors.length;
    const recent = this.getRecentErrors();

    return {
      total,
      recent: recent.length,
      rate: total > 0 ? (recent.length / total) : 0,
    };
  }
}

// 主性能优化器
export class PerformanceOptimizer {
  private eventEmitter = new EventEmitter();
  private memoryMonitor: MemoryMonitor;
  private requestMonitor: RequestMonitor;
  private errorMonitor: ErrorMonitor;

  constructor() {
    this.memoryMonitor = new MemoryMonitor(this.eventEmitter);
    this.requestMonitor = new RequestMonitor(this.eventEmitter);
    this.errorMonitor = new ErrorMonitor(this.eventEmitter);

    this.setupEventHandlers();
  }

  start(monitoringIntervalMs?: number): void {
    this.memoryMonitor.startMonitoring(monitoringIntervalMs);
    logger.info('性能优化器已启动');
  }

  stop(): void {
    this.memoryMonitor.stopMonitoring();
    logger.info('性能优化器已停止');
  }

  private setupEventHandlers(): void {
    // 内存高使用率警告
    this.eventEmitter.on('memory:high', (metrics) => {
      logger.warn('内存使用率过高', metrics);
    });

    // 内存危险使用率警告
    this.eventEmitter.on('memory:critical', (metrics) => {
      logger.error('内存使用率危险', metrics);
      // 可以在这里触发紧急优化措施
    });

    // 慢请求警告
    this.eventEmitter.on('request:slow', (request) => {
      logger.warn('检测到慢请求', {
        id: request.id,
        duration: request.duration,
        url: request.url,
      });
    });

    // 高错误率警告
    this.eventEmitter.on('error:high-rate', (errors) => {
      logger.error('错误率过高', {
        count: errors.length,
        timeWindow: '1分钟',
      });
    });

    // 请求内存泄漏警告
    this.eventEmitter.on('request:memory-leak', ({ request, memoryDelta }) => {
      logger.warn('请求可能造成内存泄漏', {
        requestId: request.id,
        memoryDelta: (memoryDelta / 1024 / 1024).toFixed(2) + 'MB',
      });
    });
  }

  // 公共API
  getMemoryMonitor() {
    return this.memoryMonitor;
  }

  getRequestMonitor() {
    return this.requestMonitor;
  }

  getErrorMonitor() {
    return this.errorMonitor;
  }

  getPerformanceStats() {
    return {
      memory: this.memoryMonitor.getLatestMetrics(),
      requests: this.requestMonitor.getStats(),
      errors: this.errorMonitor.getErrorStats(),
    };
  }

  // 事件监听
  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.off(event, listener);
  }
}

// 全局实例
export const performanceOptimizer = new PerformanceOptimizer();

// Express中间件辅助函数
export function createPerformanceMiddleware() {
  return (req: any, res: any, next: any) => {
    // 生成请求ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    // 记录请求开始
    performanceOptimizer.getRequestMonitor().startRequest(
      requestId,
      req.method,
      req.url
    );

    // 记录请求结束
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      performanceOptimizer.getRequestMonitor().endRequest(
        requestId,
        res.statusCode,
        res.locals.error?.message
      );
      return originalEnd.apply(this, args);
    };

    // 错误处理
    const originalNext = next;
    const wrappedNext = (error?: any) => {
      if (error) {
        performanceOptimizer.getErrorMonitor().recordError(error, {
          requestId,
          method: req.method,
          url: req.url,
        });
      }
      return originalNext(error);
    };

    next();
  };
}

export default {
  PerformanceOptimizer,
  MemoryMonitor,
  RequestMonitor,
  ErrorMonitor,
  performanceOptimizer,
  createPerformanceMiddleware,
};