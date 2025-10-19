/**
 * 指标中间件 - 简化版本
 * 原复杂功能已移除，仅保留基础结构
 */

import { Request, Response, NextFunction } from 'express';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 简化的指标处理
  next();
}

export default metricsMiddleware;