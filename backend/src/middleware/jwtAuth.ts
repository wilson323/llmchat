/**
 * JWT 认证中间件
 * 验证请求中的 Bearer Token 并解析用户信息
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '@/utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'user';
  };
}

/**
 * JWT 认证中间件
 * 从 Authorization header 中提取并验证 JWT token
 */
export function authenticateJWT() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('缺少 Authorization header', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
        });
        
        return res.status(401).json({
          success: false,
          code: 'AUTHENTICATION_REQUIRED',
          message: '请提供有效的认证令牌',
        });
      }
      
      const token = authHeader.substring(7); // 移除 "Bearer " 前缀
      
      // 验证 JWT（使用与 AuthServiceV2 相同的密钥）
      const jwtSecret = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'default-secret-change-in-production';
      const decoded = jwt.verify(token, jwtSecret) as {
        sub?: string;      // AuthServiceV2 使用 sub 存储 user id
        id?: string;       // 兼容旧格式
        username: string;
        role: 'admin' | 'user';
      };
      
      // 兼容 AuthServiceV2 的 JWT payload 格式（使用 sub 字段）
      const userId = decoded.sub || decoded.id;
      
      // 将用户信息附加到请求对象
      (req as AuthenticatedRequest).user = {
        id: userId!,
        username: decoded.username,
        role: decoded.role,
      };
      
      logger.debug('JWT 认证成功', {
        component: 'jwtAuth',
        userId: userId,
        username: decoded.username,
        role: decoded.role,
        path: req.path,
      });
      
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('JWT token 已过期', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
        });
        
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: '认证令牌已过期，请重新登录',
        });
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('无效的 JWT token', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
          error: error.message,
        });
        
        return res.status(401).json({
          success: false,
          code: 'INVALID_TOKEN',
          message: '无效的认证令牌',
        });
      }
      
      logger.error('JWT 认证失败', {
        component: 'jwtAuth',
        path: req.path,
        ip: req.ip,
        error,
      });
      
      return res.status(500).json({
        success: false,
        code: 'AUTHENTICATION_ERROR',
        message: '认证过程发生错误',
      });
    }
  };
}
