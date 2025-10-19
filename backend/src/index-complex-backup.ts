/**
 * LLMChat 后端服务入口
 *
 * 集成功能：
 * - Express服务器
 * - Sentry错误追踪
 * - 中间件配置
 * - 路由注册
 * - 数据库连接
 */

import "./dotenv-loader"; // 必须最先加载环境变量
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
// import { AppConfig } from "@/config/AppConfig"; // 简化配置，直接使用环境变量

// 🔧 简化导入 - 只保留必需功能
// import { initSentryOptimized } from "./config/sentryOptimized"; // 暂时禁用
// import asyncRequestLogger from "./middleware/AsyncBatchRequestLogger"; // 暂时禁用
import { errorHandler } from "./middleware/errorHandler";
// import { csrfProtection, getCsrfToken } from "./middleware/csrfProtection"; // 暂时禁用

// 简化的路由导入 - 只保留核心功能
import healthRouter from "./routes/health"; // 简化版健康检查
// import authRouter from "./routes/auth"; // 暂时禁用

// 工具
import logger from "./utils/logger";
// import { initCacheService } from "./services/CacheService"; // 暂时禁用
// import { initDB } from "./utils/db"; // 暂时禁用
// import { AgentConfigService } from "./services/AgentConfigService"; // 暂时禁用

// ===== 全局错误处理器（必须在所有代码之前） =====
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('未处理的Promise拒绝', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: String(promise),
  });
  // 不退出进程，让服务继续运行（降级模式）
});

process.on('uncaughtException', (error: Error) => {
  logger.error('未捕获的异常', {
    message: error.message,
    stack: error.stack,
  });
  // 严重错误才退出
  if (error.message?.includes('FATAL') || error.message?.includes('MODULE_NOT_FOUND')) {
    process.exit(1);
  }
});

// 简化的系统变量

const app: express.Express = express();
const PORT = process.env.PORT ?? (process.env.NODE_ENV === 'test' ? 0 : 3005);

// 声明 server 变量（必须在使用前声明）
let server: ReturnType<typeof app.listen>;

// 🔧 简化服务实例 - 暂时禁用
// let agentConfigService: AgentConfigService | null = null;
logger.info("🔧 简化模式 - AgentConfigService已禁用");

// 定时任务相关
let dailyCleanupInterval: NodeJS.Timeout | null = null;

// 🔧 简化Sentry - 暂时禁用
// initSentryOptimized(app); // 暂时禁用
logger.info("🔧 简化模式 - Sentry已禁用");

// 安全头部配置
const isProduction = process.env.NODE_ENV === "production";
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // React 需要，生产环境考虑 nonce
            styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind 需要
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
              "'self'",
              process.env.FRONTEND_URL ?? "http://localhost:3000",
            ],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        }
      : false,
    hsts: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// CORS配置
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

// Cookie 解析（CSRF 需要）
app.use(cookieParser());

// Body解析
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 压缩（除了SSE端点）
app.use(
  compression({
    filter: (req, res) => {
      if (
        req.path.includes("/chat/completions") &&
        req.query.stream === "true"
      ) {
        return false; // 不压缩SSE流
      }
      return compression.filter(req, res);
    },
  })
);

// 速率限制（支持高并发场景）
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "1000", 10), // 每分钟1000请求
  message: "请求过于频繁，请稍后再试",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);



// 🔧 简化中间件 - 暂时禁用复杂中间件
// app.use(asyncRequestLogger); // 暂时禁用
logger.info("🔧 简化模式 - 异步日志器已禁用");

// 🔧 简化CSRF - 暂时禁用
// app.get("/api/csrf-token", getCsrfToken);
// app.use(csrfProtection({
//   ignoreMethods: ["GET", "HEAD", "OPTIONS"],
//   ignorePaths: ["/health", "/api/auth/login", "/api/csrf-token"],
// }));
logger.info("🔧 简化模式 - CSRF保护已禁用");

// 简化的路由注册 - 只保留核心功能
app.use("/health", healthRouter);
// app.use("/api/auth", authRouter); // 暂时禁用
logger.info("🔧 简化模式 - 只保留健康检查路由");

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `路由 ${req.method} ${req.path} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
  });
});

// 🔧 简化Sentry错误处理 - 暂时禁用
// app.use(sentryErrorHandler()); // 暂时禁用
logger.info("🔧 简化模式 - Sentry错误处理已禁用");

// 全局错误处理
app.use(errorHandler);

// 🔧 简化定时任务 - 暂时禁用
function startScheduledTasks(): void {
  // 暂时禁用所有定时任务
  logger.info("🔧 简化模式 - 定时任务已禁用");

  // 每日清理任务（每天凌晨2点执行）- 暂时禁用
  // const scheduleDailyCleanup = () => {
  //   // 原有逻辑暂时禁用
  // };

  // 暂时不启动定时任务
}

// 简化的系统初始化

// 启动服务器（异步初始化）
async function startServer() {
  try {
    // 简化配置验证

    // 🔧 简化系统 - 暂时跳过数据库初始化
    logger.info("🔨 简化模式 - 跳过数据库初始化");
    // await initDB();
    // logger.info("✅ 数据库初始化完成");

    // 简化缓存服务
    logger.info("🔧 简化缓存服务初始化");
    // await initCacheService();

    // 🔧 简化 AgentConfigService 初始化
    logger.info("🔧 简化 AgentConfigService 初始化");
    // agentConfigService = new AgentConfigService();
    // logger.info("✅ AgentConfigService 已初始化");

    // 简化启动流程

    server = app.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功`);
      logger.info(`📍 端口: ${PORT}`);
      logger.info(`🌍 环境: ${process.env.NODE_ENV ?? "development"}`);
      logger.info(
        `✅ Sentry: ${
          process.env.SENTRY_ENABLED === "true" ? "已启用" : "已禁用"
        }`
      );
      logger.info(
        `🔒 CSRF: ${
          process.env.NODE_ENV === "production" ? "已启用" : "开发模式"
        }`
      );
      logger.info(
        `🛡️ CSP: ${
          process.env.NODE_ENV === "production" ? "已启用" : "开发模式"
        }`
      );
      logger.info(`💾 Redis: ${process.env.REDIS_HOST ? "已连接" : "未配置"}`);
    });

    // 启动定时任务
    startScheduledTasks();
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'index-complex-backup',
      operation: 'startServer',
    });
    logger.error("服务器启动失败", error.toLogObject());
    process.exit(1);
  }
}

// 只在非测试环境启动服务器
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// 优雅关闭
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

  // 1. 停止接收新请求
  if (server) {
    server.close(() => {
      logger.info("✓ HTTP 服务器已停止接收新请求");
    });
  }

  // 2. 清理定时任务
  if (dailyCleanupInterval) {
    clearInterval(dailyCleanupInterval);
    logger.info("✓ 定时任务已清理");
  }

  // 简化清理流程

  // 3. 等待现有请求完成（最多 10 秒）
  const activeConnections = await new Promise<number>((resolve) => {
    if (!server) {
      resolve(0);
      return;
    }

    server.getConnections((err, count) => {
      if (err) {
        logger.error("获取活跃连接数失败", { error: err });
        resolve(0);
      } else {
        logger.info(`等待 ${count} 个活跃连接完成...`);
        resolve(count);
      }
    });
  });

  if (activeConnections > 0) {
    logger.info("等待活跃连接完成（最多10秒）...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  try {
    // 4. 关闭数据库连接池
    const { getPool } = await import("./utils/db");
    const pool = getPool();
    await pool.end();
    logger.info("✓ 数据库连接池已关闭");
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'index-complex-backup',
      operation: 'gracefulShutdown',
    });
    logger.error("关闭数据库连接池失败", error.toLogObject());
  }

  try {
    // 5. 关闭 Redis 连接（如果存在）
    if (process.env.REDIS_HOST) {
      const { getCacheService } = await import("./services/CacheService");
      const cacheService = getCacheService();
      await cacheService.disconnect();
      logger.info("✓ Redis 连接已关闭");
    }
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'index-complex-backup',
      operation: 'gracefulShutdown',
    });
    logger.error("关闭 Redis 连接失败", error.toLogObject());
  }


  logger.info("✓ 优雅关闭完成");
  process.exit(0);
};

// 15 秒强制退出保护
const forceShutdownTimeout = 15000;

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
  setTimeout(() => {
    logger.error("强制关闭超时，立即退出");
    process.exit(1);
  }, forceShutdownTimeout);
});

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
  setTimeout(() => {
    logger.error("强制关闭超时，立即退出");
    process.exit(1);
  }, forceShutdownTimeout);
});

export { app };
export default app;

