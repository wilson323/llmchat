/**
 * Sentry 后端错误追踪配置
 * 
 * 功能：
 * - 自动捕获未处理异常
 * - Express中间件集成
 * - 性能监控
 * - 请求上下文追踪
 * 
 * 注意：适配 Sentry v10+ API
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express } from 'express';

/**
 * 初始化Sentry
 */
export function initSentry(app: Express): void {
  // 仅在生产环境或明确启用时初始化
  if (process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true') {
    const dsn = process.env.SENTRY_DSN;
    
    if (!dsn) {
      console.warn('Sentry DSN未配置，错误追踪已禁用');
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || 'unknown',
      
      // 集成（Sentry v10+ 使用函数式API）
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
        nodeProfilingIntegration(),
      ],

      // 性能监控
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // 数据清理
      beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
        // 移除敏感数据
        if (event.request) {
          delete event.request.cookies;
          
          // 清理headers中的敏感信息
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers['x-api-key'];
            delete event.request.headers.cookie;
          }
          
          // 清理URL中的敏感参数
          if (event.request.url) {
            try {
              const url = new URL(event.request.url, 'http://localhost');
              url.searchParams.delete('apiKey');
              url.searchParams.delete('token');
              event.request.url = url.pathname + url.search;
            } catch (e) {
              // URL解析失败，保持原样
            }
          }
        }

        // 清理请求体中的敏感数据
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) data.password = '[Filtered]';
          if (data.apiKey) data.apiKey = '[Filtered]';
          if (data.token) data.token = '[Filtered]';
          if (data.api_key) data.api_key = '[Filtered]';
        }

        return event;
      },
    });

    console.log('Sentry错误追踪已启用（后端）');
  } else {
    console.log('Sentry错误追踪已禁用（开发环境）');
  }
}

/**
 * Express请求处理器（必须在所有路由之前）
 * v10中已自动集成到 expressIntegration，这里保留为空中间件以兼容
 */
export function sentryRequestHandler() {
  return (_req: any, _res: any, next: any) => next();
}

/**
 * Express追踪处理器（必须在所有路由之前）
 * v10中已集成到 expressIntegration 中
 */
export function sentryTracingHandler() {
  return (_req: any, _res: any, next: any) => next();
}

/**
 * Express错误处理器（必须在所有路由之后）
 */
export function sentryErrorHandler(): any {
  return Sentry.expressErrorHandler();
}

/**
 * 设置用户上下文
 */
export function setSentryUser(user: { id: string; email?: string; username?: string }): void {
  const userData: Sentry.User = {
    id: user.id,
  };
  if (user.email) userData.email = user.email;
  if (user.username) userData.username = user.username;
  
  Sentry.setUser(userData);
}

/**
 * 清除用户上下文
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * 手动捕获错误
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * 添加面包屑
 */
export function addBreadcrumb(
  message: string, 
  category: string, 
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * 性能追踪中间件（简化版，v10推荐使用自动追踪）
 */
export function performanceMiddleware(name: string) {
  return (_req: any, _res: any, next: any) => {
    // v10中由 expressIntegration 自动处理
    // 这里保留接口兼容性但不做实际操作
    next();
  };
}

// 导出Sentry实例供高级使用
export { Sentry };
