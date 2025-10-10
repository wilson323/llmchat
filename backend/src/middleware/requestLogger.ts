import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

/**
 * 请求日志中间件
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const startTime = Date.now();
  const { method, url, ip } = req;

  // 记录请求开始
  logger.debug('📝 HTTP请求', { method, url, ip, timestamp: new Date().toISOString() });

  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    // 根据状态码选择日志级别
    const logLevel = statusCode >= 400 ? '❌' : '✅';

    logger.debug(
      `${logLevel} [${new Date().toISOString()}] ${method} ${url} - ${statusCode} - ${duration}ms`,
    );
  });

  next();
};