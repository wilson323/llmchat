/**
 * 错误边界处理和异常捕获机制
 *
 * 提供全面的错误处理、异常捕获和恢复机制
 * 包含React错误边界组件、全局错误处理器和错误报告系统
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { SafeAccess } from './SafeAccess';

// ============================================================================
// 错误类型定义
// ============================================================================

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 错误类别
 */
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  RUNTIME = 'runtime',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  USER_INTERFACE = 'user_interface',
  SYSTEM = 'system'
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  additionalData?: Record<string, any>;
}

/**
 * 增强的错误信息
 */
export interface ErrorInfoType {
  id: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  recoverable: boolean;
  retryable: boolean;
  reported: boolean;
  handled: boolean;
}

/**
 * 错误报告配置
 */
export interface ErrorReportingConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  includeStackTrace: boolean;
  includeUserAgent: boolean;
  includeUrl: boolean;
  includeUserData: boolean;
  maxErrorsPerMinute: number;
  samplingRate: number;
}

// ============================================================================
// 错误处理器接口
// ============================================================================

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error, context?: Partial<ErrorContext>): Promise<ErrorHandlingResult>;
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  handled: boolean;
  recoverable: boolean;
  retryable: boolean;
  message?: string;
  action?: 'retry' | 'refresh' | 'redirect' | 'ignore';
  actionData?: any;
}

/**
 * 错误监听器
 */
export type ErrorListener = (error: ErrorInfoType) => void;

// ============================================================================
// 错误管理器
// ============================================================================

/**
 * 错误管理器 - 单例模式
 */
export class ErrorManager {
  private static instance: ErrorManager;
  private listeners: ErrorListener[] = [];
  private handlers: ErrorHandler[] = [];
  private errorCounts: Map<string, number> = new Map();
  private lastReset = Date.now();
  private config: ErrorReportingConfig;

  private constructor() {
    this.config = {
      enabled: true,
      includeStackTrace: true,
      includeUserAgent: true,
      includeUrl: true,
      includeUserData: false,
      maxErrorsPerMinute: 100,
      samplingRate: 1.0
    };

    // 设置全局错误监听器
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  /**
   * 配置错误报告
   */
  configure(config: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 注册错误监听器
   */
  addListener(listener: ErrorListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除错误监听器
   */
  removeListener(listener: ErrorListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 注册错误处理器
   */
  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 移除错误处理器
   */
  removeHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * 处理错误
   */
  async handleError(
    error: Error,
    context?: Partial<ErrorContext>
  ): Promise<ErrorHandlingResult> {
    const errorInfo = this.createErrorInfo(error, context);

    // 检查错误频率限制
    if (this.shouldThrottleError(errorInfo)) {
      return { handled: false, recoverable: false, retryable: false };
    }

    // 检查采样率
    if (!this.shouldSampleError(errorInfo)) {
      return { handled: false, recoverable: false, retryable: false };
    }

    // 尝试使用注册的处理器处理错误
    for (const handler of this.handlers) {
      if (handler.canHandle(error)) {
        try {
          const result = await handler.handle(error, context);
          if (result.handled) {
            errorInfo.handled = true;
            this.notifyListeners(errorInfo);
            return result;
          }
        } catch (handlerError) {
          console.error('Error handler failed:', handlerError);
        }
      }
    }

    // 默认错误处理
    errorInfo.handled = false;
    this.notifyListeners(errorInfo);

    // 异步报告错误
    if (this.config.enabled) {
      this.reportError(errorInfo).catch(console.error);
    }

    return this.getDefaultHandlingResult(errorInfo);
  }

  /**
   * 创建错误信息
   */
  createErrorInfo(
    error: Error,
    context?: Partial<ErrorContext>
  ): ErrorInfoType {
    const errorContext: ErrorContext = {
      timestamp: new Date().toISOString(),
      userAgent: this.config.includeUserAgent ? navigator.userAgent : '',
      url: this.config.includeUrl ? window.location.href : '',
      ...context
    };

    return {
      id: this.generateErrorId(),
      message: error.message,
      stack: this.config.includeStackTrace ? error.stack : undefined,
      severity: this.determineSeverity(error),
      category: this.categorizeError(error),
      context: errorContext,
      recoverable: this.isRecoverable(error),
      retryable: this.isRetryable(error),
      reported: false,
      handled: false
    };
  }

  /**
   * 确定错误严重级别
   */
  private determineSeverity(error: Error): ErrorSeverity {
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return ErrorSeverity.HIGH;
    }

    if (error instanceof NetworkError || error.message.includes('fetch')) {
      return ErrorSeverity.MEDIUM;
    }

    if (error.message.includes('timeout') || error.message.includes('abort')) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * 错误分类
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
      return ErrorCategory.NETWORK;
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return ErrorCategory.AUTHORIZATION;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }

    if (error instanceof TypeError || error instanceof ReferenceError) {
      return ErrorCategory.RUNTIME;
    }

    return ErrorCategory.SYSTEM;
  }

  /**
   * 判断错误是否可恢复
   */
  private isRecoverable(error: Error): boolean {
    const recoverableErrors = [
      'network',
      'timeout',
      'fetch',
      'connection'
    ];

    return recoverableErrors.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryable(error: Error): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      '503',
      '502',
      '504'
    ];

    return retryableErrors.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );
  }

  /**
   * 获取默认处理结果
   */
  private getDefaultHandlingResult(errorInfo: ErrorInfoType): ErrorHandlingResult {
    if (errorInfo.recoverable) {
      return {
        handled: true,
        recoverable: true,
        retryable: errorInfo.retryable,
        action: errorInfo.retryable ? 'retry' : 'refresh',
        message: '发生了错误，正在尝试恢复...'
      };
    }

    return {
      handled: true,
      recoverable: false,
      retryable: false,
      action: 'ignore',
      message: '发生了错误，请刷新页面重试'
    };
  }

  /**
   * 错误频率限制
   */
  private shouldThrottleError(errorInfo: ErrorInfoType): boolean {
    const key = `${errorInfo.category}:${errorInfo.message}`;
    const count = this.errorCounts.get(key) || 0;

    // 重置计数器（每分钟）
    if (Date.now() - this.lastReset > 60000) {
      this.errorCounts.clear();
      this.lastReset = Date.now();
      return false;
    }

    if (count >= this.config.maxErrorsPerMinute) {
      return true;
    }

    this.errorCounts.set(key, count + 1);
    return false;
  }

  /**
   * 错误采样
   */
  private shouldSampleError(errorInfo: ErrorInfoType): boolean {
    if (errorInfo.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    return Math.random() < this.config.samplingRate;
  }

  /**
   * 通知监听器
   */
  private notifyListeners(errorInfo: ErrorInfoType): void {
    this.listeners.forEach(listener => {
      try {
        listener(errorInfo);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    });
  }

  /**
   * 报告错误
   */
  private async reportError(errorInfo: ErrorInfoType): Promise<void> {
    if (!this.config.endpoint) {
      return;
    }

    try {
      const payload = {
        ...errorInfo,
        reportedAt: new Date().toISOString()
      };

      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify(payload)
      });

      errorInfo.reported = true;
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 未捕获的JavaScript错误
    window.addEventListener('error', (event) => {
      event.preventDefault();
      this.handleError(event.error || new Error(event.message), {
        url: event.filename,
        additionalData: {
          line: event.lineno,
          column: event.colno
        }
      });
    });

    // 未捕获的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      event.preventDefault();
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

      this.handleError(error, {
        category: ErrorCategory.SYSTEM,
        action: 'unhandled_promise_rejection'
      });
    });
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// React错误边界组件
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfoType;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error?: Error; errorInfo?: ErrorInfoType; retry: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfoType, errorBoundary: ErrorBoundary) => void;
  maxRetries?: number;
  onErrorReset?: () => void;
}

/**
 * React错误边界组件
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorManager = ErrorManager.getInstance();
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const enhancedErrorInfo = this.errorManager.createErrorInfo(error, {
      component: errorInfo.componentStack,
      additionalData: {
        reactErrorInfo: errorInfo
      }
    });

    this.setState({ errorInfo: enhancedErrorInfo });

    // 处理错误
    this.errorManager.handleError(error, {
      component: this.constructor.name,
      action: 'react_error_boundary'
    }).then(result => {
      if (result.action === 'retry' && this.state.retryCount < (this.props.maxRetries || 3)) {
        this.scheduleRetry();
      }
    });

    // 调用外部错误处理器
    if (this.props.onError) {
      this.props.onError(error, enhancedErrorInfo, this);
    }
  }

  componentWillUnmount() {
    // 清理重试定时器
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  /**
   * 安排重试
   */
  private scheduleRetry = (): void => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 30000);
    const timeout = setTimeout(() => {
      this.retry();
    }, delay);

    this.retryTimeouts.push(timeout);
  };

  /**
   * 重试
   */
  private retry = (): void => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1
    }));

    if (this.props.onErrorReset) {
      this.props.onErrorReset();
    }
  };

  /**
   * 手动重试
   */
  public handleRetry = (): void => {
    this.retry();
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          retry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// 默认错误回退组件
// ============================================================================

interface DefaultErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfoType;
  retry: () => void;
}

/**
 * 默认错误回退组件
 */
export const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  errorInfo,
  retry
}) => {
  const isRecoverable = errorInfo?.recoverable ?? false;
  const canRetry = errorInfo?.retryable ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
          {isRecoverable ? '出现了可恢复的错误' : '出现了错误'}
        </h2>

        <p className="text-gray-600 text-center mb-6">
          {errorInfo?.message || error?.message || '应用程序遇到了意外错误'}
        </p>

        {canRetry && (
          <div className="space-y-3">
            <button
              onClick={retry}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              重试
            </button>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              刷新页面
            </button>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 p-4 bg-gray-100 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
              错误详情 (开发模式)
            </summary>
            <pre className="text-xs text-gray-600 overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 错误处理器实现
// ============================================================================

/**
 * 网络错误处理器
 */
export class NetworkErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof NetworkError ||
           error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch');
  }

  async handle(error: Error, context?: Partial<ErrorContext>): Promise<ErrorHandlingResult> {
    return {
      handled: true,
      recoverable: true,
      retryable: true,
      action: 'retry',
      message: '网络连接出现问题，正在重试...',
      actionData: {
        maxRetries: 3,
        retryDelay: 2000
      }
    };
  }
}

/**
 * 认证错误处理器
 */
export class AuthenticationErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.message.toLowerCase().includes('unauthorized') ||
           error.message.toLowerCase().includes('401');
  }

  async handle(error: Error, context?: Partial<ErrorContext>): Promise<ErrorHandlingResult> {
    return {
      handled: true,
      recoverable: false,
      retryable: false,
      action: 'redirect',
      message: '认证失败，请重新登录',
      actionData: {
        url: '/login'
      }
    };
  }
}

/**
 * 验证错误处理器
 */
export class ValidationErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.message.toLowerCase().includes('validation') ||
           error instanceof TypeError;
  }

  async handle(error: Error, context?: Partial<ErrorContext>): Promise<ErrorHandlingResult> {
    return {
      handled: true,
      recoverable: true,
      retryable: false,
      action: 'ignore',
      message: '数据验证失败，请检查输入',
      actionData: {
        field: this.extractFieldName(error.message)
      }
    };
  }

  private extractFieldName(message: string): string {
    // 简单的字段名提取逻辑
    const match = message.match(/field\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 全局错误处理函数
 */
export const handleError = (
  error: Error,
  context?: Partial<ErrorContext>
): Promise<ErrorHandlingResult> => {
  return ErrorManager.getInstance().handleError(error, context);
};

/**
 * 安全执行函数
 */
export const safeExecute = async function<T>(
  fn: () => T | Promise<T>,
  context?: Partial<ErrorContext>
): Promise<{ success: true; data: T } | { success: false; error: ErrorHandlingResult }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const errorResult = await handleError(error instanceof Error ? error : new Error(String(error)), context);
    return { success: false, error: errorResult };
  }
};

// ============================================================================
// 导出说明：所有导出已在定义处声明
// ============================================================================

export default ErrorManager;