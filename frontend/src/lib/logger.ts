/**
 * 前端统一日志工具
 *
 * 功能：
 * - 结构化日志记录
 * - Sentry错误追踪集成
 * - 开发/生产环境区分
 * - 日志级别控制
 * - 敏感信息过滤
 */

// Sentry import - optional, use dynamic import to avoid type errors
let Sentry: {
  captureException: (
    error: Error,
    options?: { extra?: Record<string, unknown>; level?: string }
  ) => void;
  captureMessage: (
    message: string,
    options?: { level?: string; extra?: Record<string, unknown> }
  ) => void;
} | null = null;

if (typeof window !== "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // ^ 使用require()动态导入可选依赖，避免在依赖未安装时报错
    Sentry = require("@sentry/react") as typeof Sentry;
  } catch {
    // Sentry not installed, will use stub
  }
}

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * 日志元数据类型
 */
export interface LogMetadata {
  [key: string]: unknown;
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  agentId?: string;
  requestId?: string;
}

/**
 * 日志配置
 */
interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  sentryEnabled: boolean;
  consoleEnabled: boolean;
}

/**
 * Logger类
 */
class Logger {
  private config: LoggerConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.config = {
      level: this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      enabled: true,
      sentryEnabled:
        import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLED === "true",
      consoleEnabled: this.isDevelopment,
    };
  }

  /**
   * 检查日志级别是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * 过滤敏感信息
   */
  private sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    const sensitiveKeys = [
      "password",
      "token",
      "apikey",
      "api_key",
      "secret",
      "authorization",
      "auth",
    ];

    Object.keys(sanitized).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata
  ): string {
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * 输出到控制台
   */
  private logToConsole(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata
  ): void {
    if (!this.config.consoleEnabled) return;

    const sanitized = this.sanitizeMetadata(metadata);
    const formattedMessage = this.formatMessage(level, message, sanitized);

    switch (level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(formattedMessage, sanitized);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(formattedMessage, sanitized);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(formattedMessage, sanitized);
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(formattedMessage, sanitized);
        break;
    }
  }

  /**
   * 发送到Sentry
   */
  private logToSentry(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    if (!this.config.sentryEnabled || !Sentry) return;

    const sanitized = this.sanitizeMetadata(metadata);

    // 只有warn和error级别才发送到Sentry
    if (level === LogLevel.ERROR && error) {
      Sentry.captureException(error, {
        extra: sanitized,
        level: "error",
      });
    } else if (level === LogLevel.WARN || level === LogLevel.ERROR) {
      Sentry.captureMessage(message, {
        level: level === LogLevel.ERROR ? "error" : "warning",
        extra: sanitized,
      });
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.logToConsole(LogLevel.DEBUG, message, metadata);
  }

  /**
   * 信息日志
   */
  info(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.logToConsole(LogLevel.INFO, message, metadata);
  }

  /**
   * 警告日志
   */
  warn(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    this.logToConsole(LogLevel.WARN, message, metadata);
    this.logToSentry(LogLevel.WARN, message, metadata);
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const enrichedMetadata: LogMetadata = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };

    this.logToConsole(LogLevel.ERROR, message, enrichedMetadata);
    this.logToSentry(LogLevel.ERROR, message, enrichedMetadata, error);
  }

  /**
   * 性能日志
   */
  performance(
    operation: string,
    duration: number,
    metadata?: LogMetadata
  ): void {
    this.info(`Performance: ${operation}`, {
      ...metadata,
      duration,
      unit: "ms",
      type: "performance",
    });
  }

  /**
   * API请求日志
   */
  apiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: LogMetadata
  ): void {
    const level =
      statusCode >= 500
        ? LogLevel.ERROR
        : statusCode >= 400
        ? LogLevel.WARN
        : LogLevel.INFO;
    const message = `API ${method} ${url} - ${statusCode}`;

    const enrichedMetadata: LogMetadata = {
      ...metadata,
      method,
      url,
      statusCode,
      duration,
      type: "api",
    };

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, enrichedMetadata);
    } else if (level === LogLevel.WARN) {
      this.warn(message, enrichedMetadata);
    } else {
      this.info(message, enrichedMetadata);
    }
  }

  /**
   * 用户行为日志
   */
  userAction(action: string, metadata?: LogMetadata): void {
    this.info(`User Action: ${action}`, {
      ...metadata,
      type: "user_action",
    });
  }

  /**
   * 设置日志配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// 导出单例
export const logger = new Logger();

// 导出默认实例
export default logger;
