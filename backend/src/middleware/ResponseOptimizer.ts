/**
 * 简化的API响应优化中间件
 * 提供基本的性能优化功能
 */

import type { Request, Response, NextFunction } from 'express';
import { logPerformance } from '@/utils/logger';

export interface OptimizationOptions {
  enableCache?: boolean;
  cacheTTL?: number;
}

class ResponseOptimizer {
  constructor(private readonly options: OptimizationOptions = {}) {
    this.options = {
      enableCache: true,
      cacheTTL: 300, // 5分钟
      ...options,
    };
  }

  /**
   * 响应优化中间件
   */
  optimize() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // 添加性能优化头
      this.setPerformanceHeaders(res);

      // 监听响应完成事件
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logPerformanceMetrics(req, res, duration);
      });

      next();
    };
  }

  /**
   * 设置性能优化头
   */
  private setPerformanceHeaders(res: Response): void {
    res.set({
      'X-Response-Time': '0ms', // 将在响应完成时更新
      'X-Server-Timestamp': new Date().toISOString(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
  }

  /**
   * 记录性能指标
   */
  private logPerformanceMetrics(req: Request, res: Response, duration: number): void {
    // 使用统一的logger.ts中的logPerformance方法
    logPerformance('api.response', duration, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      ...(res.get('Content-Length') && { contentLength: parseInt(res.get('Content-Length')!) }),
      cacheHit: res.get('X-Cache') === 'HIT',
    });

    // 更新响应时间头
    res.set('X-Response-Time', `${duration}ms`);
  }
}

// 默认优化器实例
export const defaultOptimizer = new ResponseOptimizer();

// 中间件导出
export const optimizeResponse = defaultOptimizer.optimize();

export default ResponseOptimizer;