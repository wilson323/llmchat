/**
 * 限流中间件V2 - 简化版本
 * 原复杂功能已移除，仅保留基础结构
 */

import { Request, Response, NextFunction } from 'express';

export function rateLimiterV2(req: Request, res: Response, next: NextFunction): void {
  // 简化的限流处理
  next();
}

export default rateLimiterV2;