/**
 * JWT 认证中间件
 * 验证请求中的 Bearer Token 并解析用户信息
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SecureJWT } from '@/utils/secureJwt';
import { safeLogger } from '@/utils/logSanitizer';

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
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        safeLogger.warn('缺少 Authorization header', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        res.status(401).json({
          success: false,
          code: 'AUTHENTICATION_REQUIRED',
          message: '请提供有效的认证令牌',
        });
        return;
      }

      const token = authHeader.substring(7); // 移除 "Bearer " 前缀

      // 检查令牌是否已撤销
      const isRevoked = await SecureJWT.isTokenRevoked(token);
      if (isRevoked) {
        safeLogger.warn('JWT token 已被撤销', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
        });

        res.status(401).json({
          success: false,
          code: 'TOKEN_REVOKED',
          message: '认证令牌已被撤销，请重新登录',
        });
        return;
      }

      // 使用安全的JWT验证
      const decoded = SecureJWT.verifyToken(token);

      // 将用户信息附加到请求对象
      (req as AuthenticatedRequest).user = {
        id: decoded.sub || decoded.userId || '',
        username: decoded.username || 'user',
        role: (decoded.role as 'user' | 'admin') || 'user',
      };

      safeLogger.info('JWT 认证成功', {
        component: 'jwtAuth',
        userId: decoded.sub,
        username: decoded.username,
        role: decoded.role,
        path: req.path,
        tokenId: decoded.jti,
        tokenTTL: SecureJWT.getTokenTTL(token),
      });

      next();
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError) {
        safeLogger.warn('JWT token 已过期', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
          expiredAt: error.expiredAt,
        });

        res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: '认证令牌已过期，请重新登录',
        });
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        safeLogger.warn('无效的 JWT token', {
          component: 'jwtAuth',
          path: req.path,
          ip: req.ip,
          error: error.message,
        });

        res.status(401).json({
          success: false,
          code: 'INVALID_TOKEN',
          message: '无效的认证令牌',
        });
        return;
      }

      safeLogger.error('JWT 认证失败', {
        component: 'jwtAuth',
        path: req.path,
        ip: req.ip,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        code: 'AUTHENTICATION_ERROR',
        message: '认证过程发生错误',
      });
      return;
    }
  };
}

