/**
 * Prometheus监控中间件
 * 自动记录所有HTTP请求的响应时间和状态码
 */

import { Request, Response, NextFunction } from 'express';
import { prometheusService } from '@/services/PrometheusService';

// 常量定义
const PROMETHEUS_CONSTANTS = {
  NANOSECONDS_PER_SECOND: 1e9,
} as const;

/**
 * Prometheus请求监控中间件
 */
export function prometheusMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime();

    // 增加活动连接数
    prometheusService.incrementActiveConnections();

    // 监听响应完成事件
    res.on('finish', () => {
      // 计算响应时间（秒）
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationSeconds = seconds + nanoseconds / PROMETHEUS_CONSTANTS.NANOSECONDS_PER_SECOND;

      // 记录请求指标
      prometheusService.recordHttpRequest(
        req.method,
        (req.route as { path?: string })?.path ?? req.path,
        res.statusCode,
        durationSeconds,
      );

      // 减少活动连接数
      prometheusService.decrementActiveConnections();
    });

    next();
  };
}

export default prometheusMiddleware;