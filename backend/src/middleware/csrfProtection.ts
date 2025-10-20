/**
 * CSRF 防护中间件
 * 使用 Double Submit Cookie 模式
 */

import type { Request, Response, NextFunction } from 'express';
import { createErrorFromUnknown, SystemError, AuthenticationError } from '@/types/errors';
import crypto from 'crypto';
import logger from '@/utils/logger';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

/**
 * 生成 CSRF Token
 */
function generateToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * 验证 CSRF Token
 */
function verifyToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // 使用 timingSafeEqual 防止时序攻击
  try {
    const cookieBuffer = Buffer.from(cookieToken, 'hex');
    const headerBuffer = Buffer.from(headerToken, 'hex');

    if (cookieBuffer.length !== headerBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'csrfProtection',
      operation: 'verifyToken',
    });
    logger.warn('CSRF token 验证异常', error.toLogObject());
    return false;
  }
}

/**
 * CSRF 保护中间件
 *
 * 使用 Double Submit Cookie 模式：
 * 1. 服务器生成 token 存入 cookie
 * 2. 前端从 cookie 读取 token，放入请求头
 * 3. 服务器比对 cookie 和 header 中的 token
 */
export function csrfProtection(options: {
  ignoreMethods?: string[];
  ignorePaths?: string[];
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
} = {}) {
  const {
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    ignorePaths = ['/health', '/api/auth/login'],
    cookieOptions = {
      httpOnly: false, // 前端需要读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400000, // 24小时
    },
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // 跳过特定方法
    if (ignoreMethods.includes(req.method)) {
      // GET 请求仍需设置 cookie
      let token = req.cookies?.[CSRF_COOKIE_NAME];
      if (!token) {
        token = generateToken();
        res.cookie(CSRF_COOKIE_NAME, token, cookieOptions);
      }
      return next();
    }

    // 跳过特定路径
    if (ignorePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // 验证 token
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.get(CSRF_HEADER_NAME);

    if (!verifyToken(cookieToken, headerToken)) {
      logger.warn('CSRF token 验证失败', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
      });

      res.status(403).json({
        code: 'CSRF_TOKEN_INVALID',
        message: 'CSRF token 验证失败',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 验证成功，刷新 token
    const newToken = generateToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, cookieOptions);

    next();
  };
}

/**
 * 生成 CSRF Token 的路由处理器
 */
export function getCsrfToken(req: Request, res: Response): void {
  const token = generateToken();

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000,
  });

  res.json({
    code: 'SUCCESS',
    message: 'CSRF token 生成成功',
    data: { token },
    timestamp: new Date().toISOString(),
  });
}

