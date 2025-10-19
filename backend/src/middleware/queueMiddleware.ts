/**
 * 队列中间件 - 简化版本
 * 原复杂功能已移除，仅保留基础结构
 */

import { Request, Response, NextFunction } from 'express';

export function queueMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 简化的队列处理
  next();
}

export default queueMiddleware;