/**
 * 异步处理器工具函数
 * 统一处理异步路由中的错误
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;