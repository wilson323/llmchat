/**
 * 数据库性能监控中间件
 *
 * 提供数据库查询性能监控、慢查询检测、性能报告等功能
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { getQueryOptimizer } from '@/utils/queryOptimizer';

// 性能指标接口
export interface DatabasePerformanceMetrics {
  /** 请求ID */
  requestId: string;
  /** 查询开始时间 */
  startTime: number;
  /** 查询结束时间 */
  endTime?: number;
  /** 执行时间（毫秒） */
  duration?: number;
  /** 查询语句 */
  query?: string;
  /** 参数 */
  params?: any[];
  /** 查询类型 */
  queryType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | undefined;
  /** 影响行数 */
  rowCount?: number;
  /** 是否为慢查询 */
  isSlowQuery?: boolean;
  /** 错误信息 */
  error?: string;
}

// 性能统计接口
export interface PerformanceStats {
  /** 总查询数 */
  totalQueries: number;
  /** 慢查询数 */
  slowQueries: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 最大响应时间 */
  maxResponseTime: number;
  /** 按类型统计的查询数 */
  queriesByType: Record<string, number>;
  /** 错误数 */
  errorCount: number;
  /** 统计时间范围 */
  timeRange: {
    startTime: Date;
    endTime: Date;
  };
}

/**
 * 数据库性能监控类
 */
class DatabasePerformanceMonitor {
  private static instance: DatabasePerformanceMonitor;
  private readonly activeQueries = new Map<string, DatabasePerformanceMetrics>();
  private completedQueries: DatabasePerformanceMetrics[] = [];
  private readonly maxCompletedQueries = 1000; // 最多保存1000条完成的查询记录
  private slowQueryThreshold = 1000; // 1秒
  private slowQueryQueue: DatabasePerformanceMetrics[] = []; // ✅ 慢查询队列
  private stats: PerformanceStats = {
    totalQueries: 0,
    slowQueries: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    queriesByType: {},
    errorCount: 0,
    timeRange: {
      startTime: new Date(),
      endTime: new Date(),
    },
  };

  private constructor() {}

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor();
    }
    return DatabasePerformanceMonitor.instance;
  }

  /**
   * 开始监控查询
   */
  startQuery(requestId: string, query?: string, params?: any[]): DatabasePerformanceMetrics {
    const metrics: DatabasePerformanceMetrics = {
      requestId,
      startTime: performance.now(),
      query: query || '',
      params: params || [],
      queryType: this.extractQueryType(query),
    };

    this.activeQueries.set(requestId, metrics);
    this.stats.totalQueries++;

    if (metrics.queryType) {
      this.stats.queriesByType[metrics.queryType] = (this.stats.queriesByType[metrics.queryType] || 0) + 1;
    }

    // ✅ 移除高频debug日志，使用定时统计替代

    return metrics;
  }

  /**
   * 结束监控查询
   */
  endQuery(requestId: string, rowCount?: number, error?: Error): DatabasePerformanceMetrics | null {
    const metrics = this.activeQueries.get(requestId);
    if (!metrics) {
      logger.warn('未找到查询监控记录', { requestId });
      return null;
    }

    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.rowCount = rowCount || 0;
    metrics.isSlowQuery = metrics.duration > this.slowQueryThreshold;
    if (error?.message) {
      metrics.error = error.message;
    }

    // 更新统计信息
    this.updateStats(metrics);

    // 移动到完成队列
    this.completedQueries.push(metrics);
    this.activeQueries.delete(requestId);

    // 限制完成队列大小
    if (this.completedQueries.length > this.maxCompletedQueries) {
      this.completedQueries.shift();
    }

    // ✅ 异步批量记录慢查询
    if (metrics.isSlowQuery) {
      setImmediate(() => {
        this.slowQueryQueue.push(metrics);
        
        // 批量记录（10条慢查询批量写入）
        if (this.slowQueryQueue.length >= 10) {
          logger.warn('慢查询批次', {
            count: this.slowQueryQueue.length,
            queries: this.slowQueryQueue.map(m => ({
              requestId: m.requestId,
              duration: `${m.duration?.toFixed(2)}ms`,
              query: m.query?.substring(0, 100),
              rowCount: m.rowCount,
            })),
          });
          this.slowQueryQueue = [];
        }
      });
    }

    // 记录错误（保留，因为错误频率低）
    if (error) {
      this.stats.errorCount++;
      logger.error('数据库查询错误', {
        requestId,
        error: error.message,
        duration: `${metrics.duration?.toFixed(2)}ms`,
      });
    }

    // ✅ 移除高频debug日志

    return metrics;
  }

  /**
   * 提取查询类型
   */
  private extractQueryType(query?: string): DatabasePerformanceMetrics['queryType'] {
    if (!query) {
      return undefined;
    }

    const trimmedQuery = query.trim().toUpperCase();

    if (trimmedQuery.startsWith('SELECT')) return 'SELECT';
    if (trimmedQuery.startsWith('INSERT')) return 'INSERT';
    if (trimmedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (trimmedQuery.startsWith('DELETE')) return 'DELETE';
    if (trimmedQuery.startsWith('CREATE')) return 'CREATE';
    if (trimmedQuery.startsWith('DROP')) return 'DROP';
    if (trimmedQuery.startsWith('ALTER')) return 'ALTER';

    return undefined;
  }

  /**
   * 更新统计信息
   */
  private updateStats(metrics: DatabasePerformanceMetrics): void {
    if (!metrics.duration) return;

    // 更新最大响应时间
    if (metrics.duration > this.stats.maxResponseTime) {
      this.stats.maxResponseTime = metrics.duration;
    }

    // 更新慢查询数
    if (metrics.isSlowQuery) {
      this.stats.slowQueries++;
    }

    // 更新平均响应时间
    const totalDuration = this.stats.averageResponseTime * (this.stats.totalQueries - 1) + metrics.duration;
    this.stats.averageResponseTime = totalDuration / this.stats.totalQueries;

    // 更新时间范围
    this.stats.timeRange.endTime = new Date();
  }

  /**
   * 获取性能统计
   */
  getStats(): PerformanceStats {
    return { ...this.stats };
  }

  /**
   * 获取活跃查询
   */
  getActiveQueries(): DatabasePerformanceMetrics[] {
    return Array.from(this.activeQueries.values());
  }

  /**
   * 获取完成的查询（最近N条）
   */
  getCompletedQueries(limit = 100): DatabasePerformanceMetrics[] {
    return this.completedQueries.slice(-limit);
  }

  /**
   * 获取慢查询
   */
  getSlowQueries(limit = 50): DatabasePerformanceMetrics[] {
    return this.completedQueries
      .filter(query => query.isSlowQuery)
      .slice(-limit)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const stats = this.getStats();
    const slowQueries = this.getSlowQueries(10);
    const activeQueries = this.getActiveQueries();

    const successRate = stats.totalQueries > 0 ?
      ((stats.totalQueries - stats.errorCount) / stats.totalQueries * 100).toFixed(1) : '0';
    const slowQueryRate = stats.totalQueries > 0 ?
      (stats.slowQueries / stats.totalQueries * 100).toFixed(1) : '0';

    return `
数据库性能报告
================

📊 基础统计
- 总查询数: ${stats.totalQueries}
- 成功率: ${successRate}%
- 平均响应时间: ${stats.averageResponseTime.toFixed(2)}ms
- 最大响应时间: ${stats.maxResponseTime.toFixed(2)}ms
- 慢查询数: ${stats.slowQueries}
- 慢查询率: ${slowQueryRate}%
- 错误数: ${stats.errorCount}

📈 查询类型分布
${Object.entries(stats.queriesByType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

🐌 慢查询TOP10
${slowQueries.length > 0 ?
  slowQueries.map((query, index) =>
    `${index + 1}. ${query.duration?.toFixed(2)}ms - ${query.query?.substring(0, 100)}...`
  ).join('\n') :
  '暂无慢查询'
}

🔄 当前活跃查询
${activeQueries.length > 0 ?
  activeQueries.map(query =>
    `- ${query.requestId}: ${query.queryType} - 运行中${(performance.now() - query.startTime).toFixed(2)}ms`
  ).join('\n') :
  '无活跃查询'
}

📅 统计时间范围
- 开始时间: ${stats.timeRange.startTime.toLocaleString()}
- 结束时间: ${stats.timeRange.endTime.toLocaleString()}
    `.trim();
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      queriesByType: {},
      errorCount: 0,
      timeRange: {
        startTime: new Date(),
        endTime: new Date(),
      },
    };

    this.completedQueries = [];
    this.activeQueries.clear();

    logger.info('数据库性能统计已重置');
  }

  /**
   * 设置慢查询阈值
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
    logger.info(`慢查询阈值已设置为 ${threshold}ms`);
  }

  /**
   * 获取慢查询阈值
   */
  getSlowQueryThreshold(): number {
    return this.slowQueryThreshold;
  }

  /**
   * 导出性能数据
   */
  exportData(): {
    stats: PerformanceStats;
    activeQueries: DatabasePerformanceMetrics[];
    slowQueries: DatabasePerformanceMetrics[];
    recentQueries: DatabasePerformanceMetrics[];
  } {
    return {
      stats: this.getStats(),
      activeQueries: this.getActiveQueries(),
      slowQueries: this.getSlowQueries(),
      recentQueries: this.getCompletedQueries(100),
    };
  }
}

// 创建单例实例
const databasePerformanceMonitor = DatabasePerformanceMonitor.getInstance();

/**
 * 数据库性能监控中间件
 */
export function databasePerformanceMonitorMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 为请求生成唯一ID
  const requestId = req.headers['x-request-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.requestId = requestId;

  // 记录请求开始时间
  const startTime = performance.now();

  // 拦截响应结束事件
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // 记录请求完成日志
    logger.debug('请求完成', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
    });

    return originalEnd.apply(this, args as any);
  };

  next();
}

/**
 * 查询监控装饰器
 */
export function monitorQuery(target: any, propertyName: string, descriptor: PropertyDescriptor): void {
  const method = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    const requestId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const query = typeof args[0] === 'string' ? args[0] : undefined;
    const params = Array.isArray(args[1]) ? args[1] : undefined;

    // 开始监控
    databasePerformanceMonitor.startQuery(requestId, query, params);

    try {
      const result = await method.apply(this, args);

      // 结束监控
      const rowCount = result?.rowCount || result?.rows?.length;
      databasePerformanceMonitor.endQuery(requestId, rowCount);

      return result;
    } catch (error) {
      // 记录错误
      databasePerformanceMonitor.endQuery(requestId, undefined, error as Error);
      throw error;
    }
  };
}

export default databasePerformanceMonitor;