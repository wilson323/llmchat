/**
 * Prometheus Metrics中间件
 * 
 * 自动记录所有HTTP请求的metrics：
 * - 请求duration
 * - 请求计数
 * - 活动连接数
 */

import type { Request, Response, NextFunction } from 'express';
import MetricsService from '@/services/MetricsService';

/**
 * Metrics收集中间件
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const metricsService = MetricsService;

    // 增加活动连接数
    metricsService.incrementActiveConnections();

    // 捕获响应完成事件
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const route = getRoutePath(req);

      // 记录HTTP请求metrics
      metricsService.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration
      );

      // 减少活动连接数
      metricsService.decrementActiveConnections();
    });

    // 处理连接关闭事件
    res.on('close', () => {
      if (!res.writableEnded) {
        // 连接提前关闭，减少活动连接数
        metricsService.decrementActiveConnections();
      }
    });

    next();
  };
}

/**
 * 获取标准化的路由路径
 * 将参数化路由转换为模板形式，如 /api/agents/:id -> /api/agents/:id
 */
function getRoutePath(req: Request): string {
  // 使用matched route（如果存在）
  if (req.route?.path) {
    const baseUrl = req.baseUrl ?? 1242;
    return `${baseUrl}${req.route.path}`;
  }

  // 否则使用原始路径
  let path = req.originalUrl || req.url;
  
  // 移除query string
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) {
    path = path.substring(0, queryIndex);
  }

  // 标准化常见的ID路径
  path = path.replace(/\/[0-9a-f-]{36}\b/gi, '/:id'); // UUID
  path = path.replace(/\/\d+\b/g, '/:id'); // 数字ID
  
  return path;
}

/**
 * 记录智能体使用metrics的辅助函数
 */
export function recordAgentUsage(
  agentId: string,
  userId: string,
  startTime: number,
  success = true
): void {
  const metricsService = MetricsService;
  const duration = Date.now() - startTime;

  // 记录智能体请求状态
  metricsService.recordAgentRequest(agentId, success ? 'success' : 'failure');
  
  // 记录消息发送
  if (success) {
    metricsService.recordMessageSent(agentId, userId, duration);
  }
}

/**
 * 记录智能体错误的辅助函数
 */
export function recordAgentError(agentId: string, errorType: string): void {
  const metricsService = MetricsService;
  metricsService.recordAgentError(agentId, errorType);
}

