/**
 * 管理员权限守卫中间件
 * 确保只有管理员用户才能访问特定路由
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

// HTTP 状态码常量
const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
} as const;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'user';
  };
}

/**
 * 管理员权限检查中间件
 */
export function adminGuard(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    // 检查用户是否已认证
    if (!authReq.user) {
      logger.warn('未认证用户尝试访问管理员路由', {
        component: 'adminGuard',
        path: req.path,
        ip: req.ip,
      });

      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        code: 'AUTHENTICATION_REQUIRED',
        message: '请先登录',
      });
      return;
    }

    // 检查用户是否为管理员
    if (authReq.user.role !== 'admin') {
      logger.warn('非管理员用户尝试访问管理员路由', {
        component: 'adminGuard',
        user: authReq.user.username,
        path: req.path,
        ip: req.ip,
      });

      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        code: 'ADMIN_REQUIRED',
        message: '需要管理员权限',
      });
      return;
    }

    // 权限检查通过，设置管理员验证头
    req.headers['x-admin-verified'] = 'true';
    next();
  };
}