/**
 * 极致优化的错误处理中间件
 * 集成错误处理服务和降级策略
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

import { optimizedErrorHandlingService } from '@/services/OptimizedErrorHandlingService';
import { FallbackResponseFactory } from '@/services/FallbackResponseFactory';
import { FallbackStrategy, ErrorCategory } from '@/services/OptimizedErrorHandlingService';
import logger from '@/utils/logger';

/**
 * 扩展的Express Request接口
 */
interface ExtendedRequest extends Request {
  startTime?: number;
  errorContext?: {
    operation?: string;
    requestId?: string;
    userId?: string;
    metadata?: any;
  };
}

/**
 * 错误处理中间件配置
 */
interface ErrorHandlerConfig {
  enableFallback: boolean;
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
  enableMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  excludeRoutes: string[];
  customHandlers: Map<string, (error: any, req: Request, res: Response) => void>;
}

/**
 * 默认配置
 */
const defaultConfig: ErrorHandlerConfig = {
  enableFallback: true,
  enableCircuitBreaker: true,
  enableRetry: true,
  enableMetrics: true,
  logLevel: 'error',
  excludeRoutes: ['/health', '/metrics', '/favicon.ico'],
  customHandlers: new Map()
};

/**
 * 极致优化的错误处理中间件
 */
export class OptimizedErrorHandler {
  private config: ErrorHandlerConfig;
  private stats = {
    totalErrors: 0,
    handledErrors: 0,
    fallbackUsed: 0,
    averageHandlingTime: 0,
    errorsByRoute: new Map<string, number>(),
    errorsByCategory: new Map<ErrorCategory, number>()
  };

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.setupDefaultHandlers();
  }

  /**
   * 设置默认处理器
   */
  private setupDefaultHandlers(): void {
    // 聊天相关错误处理
    this.config.customHandlers.set('/api/chat/completions', this.handleChatError.bind(this));
    this.config.customHandlers.set('/api/chat/init', this.handleChatInitError.bind(this));

    // 认证相关错误处理
    this.config.customHandlers.set('/api/auth/login', this.handleAuthError.bind(this));
    this.config.customHandlers.set('/api/auth/register', this.handleAuthError.bind(this));

    // 管理后台错误处理
    this.config.customHandlers.set('/api/admin/', this.handleAdminError.bind(this));
  }

  /**
   * 主要错误处理中间件
   */
  middleware = async (error: any, req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = performance.now();
    this.stats.totalErrors++;

    try {
      // 记录请求开始时间（如果还没有）
      if (!req.startTime) {
        req.startTime = startTime;
      }

      // 构建错误上下文
      const context = {
        operation: this.getOperationFromRoute(req.route?.path),
        requestId: req.headers['x-request-id'] as string || req.id,
        userId: this.extractUserId(req),
        metadata: {
          method: req.method,
          url: req.originalUrl,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress,
          headers: this.sanitizeHeaders(req.headers),
          body: this.sanitizeBody(req.body)
        }
      };

      // 检查是否应该排除此路由
      if (this.shouldExcludeRoute(req.originalUrl)) {
        return this.sendBasicErrorResponse(error, res);
      }

      // 检查是否有自定义处理器
      const customHandler = this.getCustomHandler(req.originalUrl);
      if (customHandler) {
        return customHandler(error, req, res);
      }

      // 使用优化的错误处理服务
      const result = await optimizedErrorHandlingService.handleError(error, context);

      if (result.handled) {
        // 错误已被处理，发送降级响应
        this.sendFallbackResponse(result, res, req, context);
        this.stats.handledErrors++;

        if (result.strategy) {
          this.stats.fallbackUsed++;
        }
      } else {
        // 错误未被处理，发送基本错误响应
        this.sendBasicErrorResponse(error, res);
      }

      // 更新统计
      this.updateStats(req, error, startTime);

    } catch (handlingError) {
      // 错误处理本身失败
      logger.error('错误处理中间件失败', {
        originalError: error instanceof Error ? error.message : String(error),
        handlingError: handlingError instanceof Error ? handlingError.message : String(handlingError),
        url: req.originalUrl
      });

      // 发送最基本的错误响应
      this.sendEmergencyResponse(res);
    }
  };

  /**
   * 处理聊天相关错误
   */
  private async handleChatError(error: any, req: Request, res: Response): Promise<void> {
    const context = {
      operation: 'chat_completion',
      requestId: req.headers['x-request-id'] as string,
      userId: this.extractUserId(req),
      metadata: {
        agentId: req.body?.agentId,
        stream: req.body?.stream,
        messageCount: req.body?.messages?.length
      }
    };

    const result = await optimizedErrorHandlingService.handleError(error, context);

    if (result.handled) {
      // 如果是流式请求，发送SSE错误事件
      if (req.body?.stream && !res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');

        const streamError = FallbackResponseFactory.createStreamFallback(
          this.categorizeError(error),
          result.strategy || FallbackStrategy.FAST_FAIL,
          context.requestId,
          error instanceof Error ? error.message : String(error)
        );

        res.write(`event: ${streamError.event}\n`);
        res.write(`data: ${JSON.stringify(streamError.data)}\n\n`);
        res.end();
        return;
      }

      // 普通请求响应
      const fallbackResponse = FallbackResponseFactory.createChatFallback(
        this.categorizeError(error),
        result.strategy || FallbackStrategy.FAST_FAIL,
        error instanceof Error ? error.message : String(error),
        context
      );

      res.status(500).json(fallbackResponse);
    } else {
      this.sendBasicErrorResponse(error, res);
    }
  }

  /**
   * 处理聊天初始化错误
   */
  private async handleChatInitError(error: any, req: Request, res: Response): Promise<void> {
    const context = {
      operation: 'chat_init',
      requestId: req.headers['x-request-id'] as string,
      userId: this.extractUserId(req),
      metadata: {
        appId: req.query?.appId,
        chatId: req.query?.chatId,
        stream: req.query?.stream === 'true'
      }
    };

    const result = await optimizedErrorHandlingService.handleError(error, context);

    if (result.handled) {
      const fallbackResponse = FallbackResponseFactory.createChatFallback(
        this.categorizeError(error),
        result.strategy || FallbackStrategy.FAST_FAIL,
        error instanceof Error ? error.message : String(error),
        context
      );

      res.status(500).json(fallbackResponse);
    } else {
      this.sendBasicErrorResponse(error, res);
    }
  }

  /**
   * 处理认证相关错误
   */
  private async handleAuthError(error: any, req: Request, res: Response): Promise<void> {
    const context = {
      operation: 'authentication',
      requestId: req.headers['x-request-id'] as string,
      userId: this.extractUserId(req),
      metadata: {
        endpoint: req.route?.path,
        method: req.method
      }
    };

    const result = await optimizedErrorHandlingService.handleError(error, context);

    if (result.handled) {
      const statusCode = this.getStatusCodeForError(error);
      const fallbackResponse = FallbackResponseFactory.createGenericFallback(
        this.categorizeError(error),
        result.strategy || FallbackStrategy.FAST_FAIL,
        error instanceof Error ? error.message : String(error)
      );

      res.status(statusCode).json(fallbackResponse);
    } else {
      this.sendBasicErrorResponse(error, res);
    }
  }

  /**
   * 处理管理后台错误
   */
  private async handleAdminError(error: any, req: Request, res: Response): Promise<void> {
    const context = {
      operation: 'admin_operation',
      requestId: req.headers['x-request-id'] as string,
      userId: this.extractUserId(req),
      metadata: {
        endpoint: req.route?.path,
        method: req.method,
        admin: true
      }
    };

    const result = await optimizedErrorHandlingService.handleError(error, context);

    if (result.handled) {
      const fallbackResponse = FallbackResponseFactory.createSystemFallback(
        this.categorizeError(error),
        result.strategy || FallbackStrategy.FAST_FAIL,
        error instanceof Error ? error.message : String(error),
        {
          service: 'admin_api',
          component: req.route?.path?.split('/')[3] || 'unknown'
        }
      );

      res.status(500).json(fallbackResponse);
    } else {
      this.sendBasicErrorResponse(error, res);
    }
  }

  /**
   * 发送降级响应
   */
  private sendFallbackResponse(
    result: any,
    res: Response,
    req: Request,
    context: any
  ): void {
    if (result.response) {
      // 如果错误处理服务已提供响应，直接使用
      const statusCode = this.getStatusCodeForError(result.originalError || {});
      res.status(statusCode).json(result.response);
    } else {
      // 否则生成默认降级响应
      const fallbackResponse = FallbackResponseFactory.createGenericFallback(
        this.categorizeError(result.originalError || {}),
        result.strategy || FallbackStrategy.FAST_FAIL,
        result.originalError instanceof Error ? result.originalError.message : String(result.originalError)
      );

      const statusCode = this.getStatusCodeForError(result.originalError || {});
      res.status(statusCode).json(fallbackResponse);
    }
  }

  /**
   * 发送基本错误响应
   */
  private sendBasicErrorResponse(error: any, res: Response): void {
    const statusCode = this.getStatusCodeForError(error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';

    const basicResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    };

    res.status(statusCode).json(basicResponse);
  }

  /**
   * 发送紧急响应（当错误处理失败时）
   */
  private sendEmergencyResponse(res: Response): void {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'EMERGENCY_ERROR',
          message: 'System encountered an unexpected error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * 获取操作类型
   */
  private getOperationFromRoute(route?: string): string {
    if (!route) return 'unknown';

    const routeMap: Record<string, string> = {
      '/api/chat/completions': 'chat_completion',
      '/api/chat/init': 'chat_init',
      '/api/chat/history': 'chat_history',
      '/api/auth/login': 'login',
      '/api/auth/register': 'register',
      '/api/auth/refresh': 'token_refresh',
      '/api/agents': 'agent_management',
      '/api/admin': 'admin_operation'
    };

    // 精确匹配
    if (routeMap[route]) {
      return routeMap[route];
    }

    // 模糊匹配
    for (const [key, value] of Object.entries(routeMap)) {
      if (route.startsWith(key)) {
        return value;
      }
    }

    return 'unknown';
  }

  /**
   * 提取用户ID
   */
  private extractUserId(req: Request): string | undefined {
    // 从不同位置提取用户ID
    return (
      (req as any).user?.id ||
      req.headers['x-user-id'] as string ||
      req.body?.userId ||
      req.query?.userId as string
    );
  }

  /**
   * 清理请求头
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };

    // 移除敏感信息
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    delete sanitized['x-auth-token'];

    return sanitized;
  }

  /**
   * 清理请求体
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };

    // 移除敏感字段
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;

    return sanitized;
  }

  /**
   * 检查是否应该排除路由
   */
  private shouldExcludeRoute(url: string): boolean {
    return this.config.excludeRoutes.some(route => {
      if (route.endsWith('*')) {
        return url.startsWith(route.slice(0, -1));
      }
      return url === route;
    });
  }

  /**
   * 获取自定义处理器
   */
  private getCustomHandler(url: string): ((error: any, req: Request, res: Response) => void) | undefined {
    for (const [route, handler] of this.config.customHandlers.entries()) {
      if (route.endsWith('*')) {
        if (url.startsWith(route.slice(0, -1))) {
          return handler;
        }
      } else if (url.startsWith(route)) {
        return handler;
      }
    }
    return undefined;
  }

  /**
   * 错误分类
   */
  private categorizeError(error: any): ErrorCategory {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
      return ErrorCategory.AUTHORIZATION;
    }
    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return ErrorCategory.NETWORK;
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('service unavailable')) {
      return ErrorCategory.EXTERNAL_SERVICE;
    }
    if (errorMessage.includes('resource') || errorMessage.includes('memory') || errorMessage.includes('disk')) {
      return ErrorCategory.RESOURCE;
    }
    if (errorMessage.includes('system') || errorMessage.includes('internal') || errorMessage.includes('critical')) {
      return ErrorCategory.SYSTEM;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * 获取错误状态码
   */
  private getStatusCodeForError(error: any): number {
    if (error.statusCode) {
      return error.statusCode;
    }

    if (error.status) {
      return error.status;
    }

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 400;
    }
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      return 401;
    }
    if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
      return 403;
    }
    if (errorMessage.includes('not found')) {
      return 404;
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return 429;
    }
    if (errorMessage.includes('timeout')) {
      return 408;
    }

    return 500;
  }

  /**
   * 更新统计信息
   */
  private updateStats(req: Request, error: any, startTime: number): void {
    const handlingTime = performance.now() - startTime;

    // 更新平均处理时间
    if (this.stats.handledErrors > 0) {
      this.stats.averageHandlingTime =
        (this.stats.averageHandlingTime * this.stats.handledErrors + handlingTime) / (this.stats.handledErrors + 1);
    } else {
      this.stats.averageHandlingTime = handlingTime;
    }

    // 按路由统计
    const route = req.route?.path || req.originalUrl;
    const routeCount = this.stats.errorsByRoute.get(route) || 0;
    this.stats.errorsByRoute.set(route, routeCount + 1);

    // 按类别统计
    const category = this.categorizeError(error);
    const categoryCount = this.stats.errorsByCategory.get(category) || 0;
    this.stats.errorsByCategory.set(category, categoryCount + 1);

    // 记录日志
    if (this.config.enableMetrics) {
      logger[this.config.logLevel]('错误处理统计', {
        handlingTime: handlingTime.toFixed(2),
        route,
        category,
        totalErrors: this.stats.totalErrors,
        handledErrors: this.stats.handledErrors,
        fallbackUsed: this.stats.fallbackUsed
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    return {
      ...this.stats,
      config: {
        enableFallback: this.config.enableFallback,
        enableCircuitBreaker: this.config.enableCircuitBreaker,
        enableRetry: this.config.enableRetry,
        enableMetrics: this.config.enableMetrics
      },
      routesWithMostErrors: Array.from(this.stats.errorsByRoute.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      categoriesWithMostErrors: Array.from(this.stats.errorsByCategory.entries())
        .sort(([, a], [, b]) => b - a)
    };
  }

  /**
   * 添加自定义处理器
   */
  addCustomHandler(route: string, handler: (error: any, req: Request, res: Response) => void): void {
    this.config.customHandlers.set(route, handler);
  }

  /**
   * 移除自定义处理器
   */
  removeCustomHandler(route: string): void {
    this.config.customHandlers.delete(route);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalErrors: 0,
      handledErrors: 0,
      fallbackUsed: 0,
      averageHandlingTime: 0,
      errorsByRoute: new Map(),
      errorsByCategory: new Map()
    };
  }
}

// 创建默认实例
export const optimizedErrorHandler = new OptimizedErrorHandler();

// 导出中间件函数
export const optimizedErrorMiddleware = optimizedErrorHandler.middleware;