/**
 * 增强版前端日志工具
 * 提供更丰富的日志功能，包括性能监控、用户行为追踪等
 */

import { logger, type LogMetadata } from './logger';

/**
 * 增强日志元数据类型
 */
export interface EnhancedLogMetadata extends LogMetadata {
  // 性能相关
  duration?: number;
  timestamp?: string;
  userAgent?: string;
  
  // 用户行为相关
  userId?: string;
  sessionId?: string;
  userAgentId?: string;
  
  // 组件和操作相关
  component?: string;
  operation?: string;
  action?: string;
  
  // 错误相关
  errorId?: string;
  errorCode?: string;
  errorStack?: string;
  
  // API相关
  method?: string;
  url?: string;
  statusCode?: number;
  
  // 业务相关
  agentId?: string;
  chatId?: string;
  messageId?: string;
  requestId?: string;
}

/**
 * 增强版Logger类
 */
class EnhancedLogger {
  private baseLogger = logger;

  /**
   * 记录用户行为日志
   */
  userAction(action: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.userAction(action, {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录性能日志
   */
  performance(operation: string, duration: number, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.performance(operation, duration, {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录API请求日志
   */
  apiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: EnhancedLogMetadata,
  ): void {
    this.baseLogger.apiRequest(method, url, statusCode, duration, {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录组件渲染性能
   */
  componentRender(componentName: string, duration: number, metadata?: EnhancedLogMetadata): void {
    this.performance(`Component Render: ${componentName}`, duration, {
      ...metadata,
      component: componentName,
      type: 'component_render',
    });
  }

  /**
   * 记录状态更新日志
   */
  stateUpdate(storeName: string, action: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.info(`State Update: ${storeName}`, {
      ...metadata,
      store: storeName,
      action,
      type: 'state_update',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录Hook执行日志
   */
  hookExecution(hookName: string, operation: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.debug(`Hook Execution: ${hookName}`, {
      ...metadata,
      hook: hookName,
      operation,
      type: 'hook_execution',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录服务调用日志
   */
  serviceCall(serviceName: string, method: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.info(`Service Call: ${serviceName}.${method}`, {
      ...metadata,
      service: serviceName,
      method,
      type: 'service_call',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录错误日志（增强版）
   */
  error(message: string, error?: Error, metadata?: EnhancedLogMetadata): void {
    const enhancedMetadata: EnhancedLogMetadata = {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      errorId: error ? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined,
      errorCode: error?.name,
      errorStack: error?.stack,
    };

    this.baseLogger.error(message, error, enhancedMetadata);
  }

  /**
   * 记录警告日志（增强版）
   */
  warn(message: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.warn(message, {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录信息日志（增强版）
   */
  info(message: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.info(message, {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录调试日志（增强版）
   */
  debug(message: string, metadata?: EnhancedLogMetadata): void {
    this.baseLogger.debug(message, {
      ...metadata,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 开始性能计时
   */
  startTimer(label: string): number {
    return performance.now();
  }

  /**
   * 结束性能计时并记录日志
   */
  endTimer(
    label: string,
    startTime: number,
    operation: string,
    metadata?: EnhancedLogMetadata,
  ): number {
    const duration = performance.now() - startTime;
    this.performance(operation, duration, {
      ...metadata,
      label,
    });
    return duration;
  }

  /**
   * 包装异步操作并记录性能
   */
  async timeAsync<T>(
    label: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: EnhancedLogMetadata,
  ): Promise<T> {
    const startTime = this.startTimer(label);
    try {
      const result = await fn();
      this.endTimer(label, startTime, operation, metadata);
      return result;
    } catch (unknownError: unknown) {
      this.endTimer(label, startTime, operation, metadata);
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      throw error;
    }
  }

  /**
   * 包装同步操作并记录性能
   */
  timeSync<T>(
    label: string,
    operation: string,
    fn: () => T,
    metadata?: EnhancedLogMetadata,
  ): T {
    const startTime = this.startTimer(label);
    try {
      const result = fn();
      this.endTimer(label, startTime, operation, metadata);
      return result;
    } catch (unknownError: unknown) {
      this.endTimer(label, startTime, operation, metadata);
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      throw error;
    }
  }
}

// 导出增强版logger实例
export const enhancedLogger = new EnhancedLogger();

// 默认导出
export default enhancedLogger;