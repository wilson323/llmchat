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

type IntegrationLike = {
  name: string;
  setupOnce: (...args: unknown[]) => void;
};

type ExtendedSentryModule = typeof import('@sentry/react') & {
  Replay?: new (...args: any[]) => IntegrationLike;
  reactRouterV6Instrumentation?: (
    history: History,
    location: Location
  ) => (...args: unknown[]) => void;
  startTransaction?: (context: { name: string; op: string }) => unknown;
};

type BrowserTracingCtor = new (...args: any[]) => IntegrationLike;

// 尝试导入Sentry（可选依赖）
let Sentry: ExtendedSentryModule | null = null;
let BrowserTracing: BrowserTracingCtor | null = null;
let sentryAvailable = false;
let sentryLoadPromise: Promise<void> | null = null;

async function ensureSentryLoaded(): Promise<void> {
  if (sentryAvailable || typeof window === 'undefined') {
    return;
  }

  if (sentryLoadPromise) {
    await sentryLoadPromise;
    return;
  }

  sentryLoadPromise = (async () => {
    try {
      const [sentryModule, tracingModule] = await Promise.all([
        import('@sentry/react'),
        import('@sentry/tracing'),
      ]);

      Sentry = sentryModule as ExtendedSentryModule;
      BrowserTracing =
        ((tracingModule as { BrowserTracing?: BrowserTracingCtor }).BrowserTracing ??
        null);
      sentryAvailable = true;
    } catch (error) {
      console.info('ℹ️  Sentry未安装，错误追踪功能禁用', error);
      Sentry = null;
      BrowserTracing = null;
      sentryAvailable = false;
    } finally {
      sentryLoadPromise = null;
    }
  })();

  await sentryLoadPromise;
}

if (typeof window !== 'undefined') {
  void ensureSentryLoaded();
}

/**
 * 初始化Sentry
 */
export async function initSentry(): Promise<void> {
  await ensureSentryLoaded();

  // 检查Sentry是否可用
  if (!sentryAvailable || !Sentry) {
    return;
  }

  // 仅在生产环境或明确启用时初始化
  if (import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLED === "true") {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
      console.warn("⚠️  Sentry DSN未配置，错误追踪已禁用");
      return;
    }

    const integrations: Parameters<typeof Sentry.init>[0]['integrations'] = [];

    if (
      BrowserTracing &&
      typeof Sentry.reactRouterV6Instrumentation === 'function'
    ) {
      integrations?.push(
        new BrowserTracing({
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            // React Router v6需要手动传入
            window.history,
            window.location
          ),
        })
      );
    }

    if (typeof Sentry.Replay === 'function') {
      integrations?.push(
        new Sentry.Replay({
          // Session回放配置
          maskAllText: true,
          blockAllMedia: true,
        })
      );
    }

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || "unknown",

      // 集成
      integrations,

      // 性能监控（低延时：仅采样部分请求）
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 生产环境10%采样，降低开销

      // Session回放
      replaysSessionSampleRate: 0.1, // 10%的会话
      replaysOnErrorSampleRate: 1.0, // 100%的错误会话

      // 忽略的错误
      ignoreErrors: [
        // 浏览器扩展错误
        "top.GLOBALS",
        "originalCreateNotification",
        "canvas.contentDocument",
        "MyApp_RemoveAllHighlights",
        "atomicFindClose",

        // 网络错误（通常不是代码问题）
        "Network request failed",
        "NetworkError",
        "Failed to fetch",

        // 用户取消的请求
        "AbortError",
        "The user aborted a request",
      ],

      // 数据清理
      beforeSend(event: any, _hint: any) {
        // 移除敏感数据
        if (event.request) {
          delete event.request.cookies;

          // 清理URL中的敏感参数
          if (event.request.url) {
            const url = new URL(event.request.url);
            url.searchParams.delete("apiKey");
            url.searchParams.delete("token");
            event.request.url = url.toString();
          }
        }

        // 清理表单数据中的密码等
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) data.password = "[Filtered]";
          if (data.apiKey) data.apiKey = "[Filtered]";
          if (data.token) data.token = "[Filtered]";
        }

        return event;
      },
    });

    console.log("Sentry错误追踪已启用");
  } else {
    console.log("Sentry错误追踪已禁用（开发环境）");
  }
}

/**
 * 设置用户上下文
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  username?: string;
}) {
  if (!sentryAvailable || !Sentry || typeof Sentry.setUser !== "function") {
    return;
  }

  try {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    console.warn("设置Sentry用户上下文失败:", error);
  }
}

/**
 * 清除用户上下文（登出时）
 */
export function clearSentryUser() {
  if (!sentryAvailable || !Sentry || typeof Sentry.setUser !== "function") {
    return;
  }

  try {
    Sentry.setUser(null);
  } catch (error) {
    console.warn("清除Sentry用户上下文失败:", error);
  }
}

/**
 * 手动捕获错误
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (
    !sentryAvailable ||
    !Sentry ||
    typeof Sentry.captureException !== "function"
  ) {
    console.error("错误追踪未可用:", error);
    return;
  }

  try {
    Sentry.captureException(error, {
      extra: context,
    });
  } catch (e) {
    console.error("Sentry捕获错误失败:", e);
  }
}

/**
 * 添加面包屑（用于调试）
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: "info" | "warning" | "error" | "debug" = "info"
) {
  // 安全检查：确保Sentry已初始化
  if (
    !sentryAvailable ||
    !Sentry ||
    typeof Sentry.addBreadcrumb !== "function"
  ) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.warn("添加Sentry面包屑失败:", error);
  }
}

/**
 * 性能追踪
 */
export function startTransaction(name: string, op: string) {
  if (
    !sentryAvailable ||
    !Sentry ||
    typeof Sentry.startTransaction !== "function"
  ) {
    return null;
  }

  try {
    return Sentry.startTransaction({ name, op });
  } catch (error) {
    console.warn("启动Sentry事务失败:", error);
    return null;
  }
}

// 导出Sentry实例供高级使用
export { Sentry };
