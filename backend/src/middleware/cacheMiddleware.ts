/**
 * 缓存中间件 - 简化版本
 * 原复杂功能已移除，仅保留基础结构
 */

import { Request, Response, NextFunction } from 'express';

export function cacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 简化的缓存处理
  next();
}

export default cacheMiddleware;