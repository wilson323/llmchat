/**
 * Request ID 中间件
 * 为每个请求生成唯一ID用于追踪
 */

import { Request, Response, NextFunction } from 'express';
import { generateId } from '@/utils/helpers';

// 扩展Request类型以包含requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  // ^ 忽略namespace警告，因为这是扩展Express命名空间的标准方法
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * 为每个请求添加唯一ID
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // 从header获取或生成新的requestId
  const id = (req.headers['x-request-id'] as string) || generateId();

  // 附加到请求对象
  req.requestId = id;

  // 设置响应header
  res.setHeader('x-request-id', id);

  next();
}
