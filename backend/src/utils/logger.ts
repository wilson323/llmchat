/**
 * Winston 日志配置
 *
 * 提供结构化日志记录功能：
 * - 多级别日志 (info/warn/error/debug)
 * - 日志文件轮转 (按日期)
 * - 开发环境控制台输出
 * - 异常和拒绝处理
 * - 审计日志和性能日志
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// 日志目录
const logDir = path.join(__dirname, '../../log');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * 自定义日志格式 - JSON 结构化
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillWith: ['service', 'component', 'environment'] }),
  winston.format.json(),
);

/**
 * 控制台格式 - 彩色可读 (仅开发环境)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  }),
);

/**
 * 创建日志传输器
 */

// 应用日志 (每日轮转)
const appLogTransport = new DailyRotateFile({
  filename: path.join(logDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',
});

// 错误日志 (单独文件)
const errorLogTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
});

// 审计日志 (敏感操作, 保留90天)
const auditLogTransport = new DailyRotateFile({
  filename: path.join(logDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '90d',
  level: 'warn',
});

/**
 * 创建 Logger 实例
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'llmchat-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    appLogTransport,
    errorLogTransport,
    auditLogTransport,
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
    }),
  ],
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info', // ✅ 使用环境变量控制日志级别
  }));
}

/**
 * 审计日志便捷方法
 *
 * @param action 操作类型
 * @param details 详细信息
 */
export function logAudit(action: string, details: Record<string, unknown>): void {
  logger.warn('AUDIT', {
    action,
    ...details,
    timestamp: new Date().toISOString(),
    auditType: 'security',
  });
}

/**
 * 性能日志便捷方法
 *
 * @param operation 操作名称
 * @param duration 耗时(ms)
 * @param metadata 额外元数据
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>,
): void {
  logger.info('PERFORMANCE', {
    operation,
    duration,
    unit: 'ms',
    ...metadata,
    timestamp: new Date().toISOString(),
    performanceType: 'metric',
  });
}

/**
 * HTTP 请求日志便捷方法
 *
 * @param method HTTP 方法
 * @param url 请求 URL
 * @param statusCode 状态码
 * @param duration 耗时(ms)
 * @param metadata 额外元数据
 */
export function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, unknown>,
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger.log(level, 'HTTP_REQUEST', {
    method,
    url,
    statusCode,
    duration,
    unit: 'ms',
    ...metadata,
    timestamp: new Date().toISOString(),
    requestType: 'http',
  });
}

/**
 * 数据库操作日志便捷方法
 *
 * @param operation 操作类型 (SELECT/INSERT/UPDATE/DELETE)
 * @param table 表名
 * @param duration 耗时(ms)
 * @param metadata 额外元数据
 */
export function logDatabaseOperation(
  operation: string,
  table: string,
  duration: number,
  metadata?: Record<string, unknown>,
): void {
  logger.debug('DB_OPERATION', {
    operation,
    table,
    duration,
    unit: 'ms',
    ...metadata,
    timestamp: new Date().toISOString(),
    operationType: 'database',
  });
}

/**
 * 外部服务调用日志便捷方法
 *
 * @param service 服务名称
 * @param operation 操作名称
 * @param success 是否成功
 * @param duration 耗时(ms)
 * @param metadata 额外元数据
 */
export function logExternalService(
  service: string,
  operation: string,
  success: boolean,
  duration: number,
  metadata?: Record<string, unknown>,
): void {
  const level = success ? 'info' : 'warn';

  logger.log(level, 'EXTERNAL_SERVICE', {
    service,
    operation,
    success,
    duration,
    unit: 'ms',
    ...metadata,
    timestamp: new Date().toISOString(),
    serviceType: 'external',
  });
}

// 导出默认实例
export default logger;
