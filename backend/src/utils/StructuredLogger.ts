import winston from 'winston';
import path from 'path';
import { Request } from 'express';

/**
 * 日志级别
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

/**
 * 结构化日志上下文
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    operation?: string;
    duration?: number;
  };
  business?: {
    agentId?: string;
    chatId?: string;
    action?: string;
    [key: string]: any;
  };
  security?: {
    ip?: string;
    userAgent?: string;
    suspicious?: boolean;
    threat?: string;
    event?: string;
  };
  [key: string]: any;
}

/**
 * 日志条目
 */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
  service: string;
  version: string;
  environment: string;
}

/**
 * 结构化日志记录器
 */
export class StructuredLogger {
  private logger: winston.Logger;
  private serviceName: string;
  private version: string;
  private environment: string;

  constructor(serviceName: string = 'llmchat-backend') {
    this.serviceName = serviceName;
    this.version = process.env.npm_package_version || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';

    // 创建Winston logger
    this.logger = winston.createLogger({
      level: this.getLogLevel(),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatLogEntry.bind(this)),
      ),
      defaultMeta: {
        service: this.serviceName,
        version: this.version,
        environment: this.environment,
      },
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(this.formatConsoleLog.bind(this)),
          ),
        }),

        // 错误日志文件
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),

        // 组合日志文件
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],

      // 异常处理
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
        }),
      ],

      // 拒绝处理
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'rejections.log'),
        }),
      ],
    });
  }

  /**
   * 获取日志级别
   */
  private getLogLevel(): string {
    const envLevel = process.env.LOG_LEVEL;
    const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    return validLevels.includes(envLevel as string) ? envLevel as string : 'info';
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(info: winston.Logform.TransformableInfo): string {
    const { level, message, timestamp, service, version, environment, ...meta } = info;

    const logEntry: LogEntry = {
      level: level as LogLevel,
      message: String(message),
      timestamp: String(timestamp),
      context: meta as LogContext,
      service: String(service),
      version: String(version),
      environment: String(environment),
    };

    return JSON.stringify(logEntry);
  }

  /**
   * 格式化控制台日志
   */
  private formatConsoleLog(info: winston.Logform.TransformableInfo): string {
    const { timestamp, level, message, requestId, method, url, statusCode, duration, userId } = info;

    let output = `${timestamp} [${level.toUpperCase()}]`;

    if (requestId) {
      output += ` [${requestId}]`;
    }
    if (userId) {
      output += ` [user:${userId}]`;
    }

    output += `: ${message}`;

    if (method && url) {
      output += ` ${method} ${url}`;
      if (statusCode) {
        output += ` -> ${statusCode}`;
      }
      if (typeof duration === 'number') {
        output += ` (${duration.toFixed(2)}ms)`;
      }
    }

    return output;
  }

  /**
   * 记录错误
   */
  public error(message: string, context: LogContext = {}): void {
    this.logger.error(message, context);
  }

  /**
   * 记录警告
   */
  public warn(message: string, context: LogContext = {}): void {
    this.logger.warn(message, context);
  }

  /**
   * 记录信息
   */
  public info(message: string, context: LogContext = {}): void {
    this.logger.info(message, context);
  }

  /**
   * 记录HTTP请求
   */
  public http(message: string, context: LogContext = {}): void {
    this.logger.http(message, context);
  }

  /**
   * 记录详细信息
   */
  public verbose(message: string, context: LogContext = {}): void {
    this.logger.verbose(message, context);
  }

  /**
   * 记录调试信息
   */
  public debug(message: string, context: LogContext = {}): void {
    this.logger.debug(message, context);
  }

  /**
   * 记录详细调试信息
   */
  public silly(message: string, context: LogContext = {}): void {
    this.logger.silly(message, context);
  }

  /**
   * 记录HTTP请求开始
   */
  public logRequestStart(req: Request): void {
    const requestId = (req as any).requestId;
    const userId = (req as any).user?.id;
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    const context: LogContext = {
      method: req.method,
      url: req.originalUrl || req.url,
    };

    if (requestId) {
      context.requestId = requestId;
    }
    if (userId) {
      context.userId = userId;
    }
    if (userAgent) {
      context.userAgent = userAgent;
    }
    if (ip) {
      context.ip = ip;
    }

    this.http('Request started', context);
  }

  /**
   * 记录HTTP请求完成
   */
  public logRequestComplete(req: Request, statusCode: number, duration: number): void {
    const requestId = (req as any).requestId;
    const userId = (req as any).user?.id;

    const context: LogContext = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      duration,
    };

    if (requestId) {
      context.requestId = requestId;
    }
    if (userId) {
      context.userId = userId;
    }

    this.http('Request completed', context);
  }

  /**
   * 记录API错误
   */
  public logApiError(error: Error, req?: Request, context?: LogContext): void {
    const errorContext: LogContext = {
      ...(req && { requestId: (req as any).requestId }),
      ...(req?.method && { method: req.method }),
      ...(req && { url: req.originalUrl || req.url }),
      ...(req && { userId: (req as any).user?.id }),
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack }),
        ...(error as any).code && { code: (error as any).code },
      },
      ...context,
    };

    this.error('API error occurred', errorContext);
  }

  /**
   * 记录业务事件
   */
  public logBusinessEvent(event: string, context: LogContext = {}): void {
    this.info(`Business event: ${event}`, {
      business: {
        event,
        ...context.business,
      },
      ...context,
    });
  }

  /**
   * 记录安全事件
   */
  public logSecurityEvent(event: string, context: LogContext = {}): void {
    const { security, ...restContext } = context;
    this.warn(`Security event: ${event}`, {
      security: {
        event,
        ...security,
      },
      ...restContext,
    });
  }

  /**
   * 记录性能指标
   */
  public logPerformance(operation: string, duration: number, context: LogContext = {}): void {
    const { performance, ...restContext } = context;
    this.info(`Performance: ${operation}`, {
      performance: {
        operation,
        duration,
        memoryUsage: process.memoryUsage(),
        ...performance,
      },
      ...restContext,
    });
  }

  /**
   * 记录外部服务调用
   */
  public logExternalService(service: string, operation: string, statusCode?: number, duration?: number, error?: Error): void {
    const context: LogContext = {
      business: {
        externalService: service,
        operation,
        statusCode,
        duration,
      },
    };

    if (error) {
      context.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack }),
      };
      this.warn(`External service error: ${service} ${operation}`, context);
    } else {
      this.info(`External service call: ${service} ${operation}`, context);
    }
  }

  /**
   * 记录用户操作
   */
  public logUserAction(userId: string, action: string, context: LogContext = {}): void {
    this.info(`User action: ${action}`, {
      userId,
      business: {
        action,
        ...context.business,
      },
      ...context,
    });
  }

  /**
   * 创建子日志记录器（用于特定模块）
   */
  public createChildLogger(module: string): StructuredLogger {
    const childLogger = new StructuredLogger(this.serviceName);
    childLogger.logger = this.logger.child({ module });
    return childLogger;
  }

  /**
   * 获取原始Winston logger（用于兼容性）
   */
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

// 创建默认日志记录器实例
export const structuredLogger = new StructuredLogger();

// 创建特定模块的日志记录器
export const authLogger = structuredLogger.createChildLogger('auth');
export const chatLogger = structuredLogger.createChildLogger('chat');
export const agentLogger = structuredLogger.createChildLogger('agent');
export const performanceLogger = structuredLogger.createChildLogger('performance');
export const securityLogger = structuredLogger.createChildLogger('security');

// 为了向后兼容，导出默认实例
export default structuredLogger;