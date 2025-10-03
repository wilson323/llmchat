/**
 * Sentry 错误追踪配置
 * 
 * 功能：
 * - 自动捕获未处理错误
 * - React错误边界集成
 * - 性能监控
 * - 用户上下文追踪
 * 
 * 高可用设计:
 * - 可选依赖，缺失时自动禁用
 * - 不影响应用启动
 */

// 尝试导入Sentry（可选依赖）
let Sentry: any = null;
let BrowserTracing: any = null;
let sentryAvailable = false;

try {
  // @ts-ignore - 可选依赖
  const sentryModule = require('@sentry/react');
  // @ts-ignore - 可选依赖
  const tracingModule = require('@sentry/tracing');
  
  Sentry = sentryModule;
  BrowserTracing = tracingModule.BrowserTracing;
  sentryAvailable = true;
} catch (error) {
  console.info('ℹ️  Sentry未安装，错误追踪功能禁用');
  sentryAvailable = false;
}

/**
 * 初始化Sentry
 */
export function initSentry() {
  // 检查Sentry是否可用
  if (!sentryAvailable || !Sentry) {
    return;
  }

  // 仅在生产环境或明确启用时初始化
  if (import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLED === 'true') {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    
    if (!dsn) {
      console.warn('⚠️  Sentry DSN未配置，错误追踪已禁用');
      return;
    }

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || 'unknown',
      
      // 集成
      integrations: [
        new BrowserTracing({
          // 路由追踪
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            // React Router v6需要手动传入
            window.history,
            window.location
          ),
        }),
        new Sentry.Replay({
          // Session回放配置
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // 性能监控（低延时：仅采样部分请求）
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 生产环境10%采样，降低开销
      
      // Session回放
      replaysSessionSampleRate: 0.1, // 10%的会话
      replaysOnErrorSampleRate: 1.0, // 100%的错误会话

      // 忽略的错误
      ignoreErrors: [
        // 浏览器扩展错误
        'top.GLOBALS',
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        'atomicFindClose',
        
        // 网络错误（通常不是代码问题）
        'Network request failed',
        'NetworkError',
        'Failed to fetch',
        
        // 用户取消的请求
        'AbortError',
        'The user aborted a request',
      ],

      // 数据清理
      beforeSend(event: any, _hint: any) {
        // 移除敏感数据
        if (event.request) {
          delete event.request.cookies;
          
          // 清理URL中的敏感参数
          if (event.request.url) {
            const url = new URL(event.request.url);
            url.searchParams.delete('apiKey');
            url.searchParams.delete('token');
            event.request.url = url.toString();
          }
        }

        // 清理表单数据中的密码等
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) data.password = '[Filtered]';
          if (data.apiKey) data.apiKey = '[Filtered]';
          if (data.token) data.token = '[Filtered]';
        }

        return event;
      },
    });

    console.log('Sentry错误追踪已启用');
  } else {
    console.log('Sentry错误追踪已禁用（开发环境）');
  }
}

/**
 * 设置用户上下文
 */
export function setSentryUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * 清除用户上下文（登出时）
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * 手动捕获错误
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * 添加面包屑（用于调试）
 */
export function addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' | 'debug' = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * 性能追踪
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({ name, op });
}

// 导出Sentry实例供高级使用
export { Sentry };

