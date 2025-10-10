/**
 * Request ID 中间件
 * 为每个请求生成唯一ID用于追踪
 */

import { Request, Response, NextFunction } from "express";
import { generateId } from "@/utils/helpers";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

/**
 * 为每个请求添加唯一ID
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 从header获取或生成新的requestId
  const id = (req.headers["x-request-id"] as string) || generateId();

  // 附加到请求对象
  req.requestId = id;

  // 设置响应header
  res.setHeader("x-request-id", id);

  next();
}
