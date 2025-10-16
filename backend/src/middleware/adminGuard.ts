/**
 * 管理员权限守卫中间件
 * 确保只有管理员用户才能访问特定路由
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '@/types/errors';
import logger from '@/utils/logger';

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
export function adminGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    // 检查用户是否已认证
    if (!authReq.user) {
      logger.warn('未认证用户尝试访问管理员路由', {
        component: 'adminGuard',
        path: req.path,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        code: 'AUTHENTICATION_REQUIRED',
        message: '请先登录',
      });
    }

    // 检查用户是否为管理员
    if (authReq.user.role !== 'admin') {
      logger.warn('非管理员用户尝试访问管理员路由', {
        component: 'adminGuard',
        user: authReq.user.username,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        code: 'ADMIN_REQUIRED',
        message: '需要管理员权限',
      });
    }

    // 权限检查通过
    return next();
  };
}
