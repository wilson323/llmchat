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

// Sentry监控
import {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
} from "./utils/sentry";

// 中间件
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { csrfProtection, getCsrfToken } from "./middleware/csrfProtection";
import { performanceMiddleware } from "./middleware/PerformanceMonitor";
import {
  databaseOptimizationMiddleware,
  initializeDatabaseOptimization,
  generateDatabasePerformanceReport,
  performDatabaseAutoOptimization
} from "./middleware/databaseOptimization";
import { databasePerformanceMonitorMiddleware } from "./middleware/databasePerformanceMonitor";

// 路由
import agentsRouter from "./routes/agents";
import chatRouter from "./routes/chat";
import healthRouter from "./routes/health";
import cadRouter from "./routes/cad";
import authRouter from "./routes/auth";
import adminRoutes from "./routes/admin";
import auditRouter from "./routes/audit"; // 使用 default export
import difySessionRouter from "./routes/difySession"; // 使用 default export
import { productPreviewRoutes } from "./routes/productPreview"; // 使用 named export
import sessionRouter from "./routes/sessionRoutes"; // 使用 default export
import databasePerformanceRouter from "./routes/databasePerformance"; // 数据库性能管理路由
import cacheRouter from "./routes/cache"; // 缓存管理路由
import queueRouter from "./routes/queue"; // 消息队列管理路由

// 可视化路由
import { initializeVisualizationRoutes, default as visualizationRouter } from "./routes/visualizationRoutes";

// 工具
import { logger } from "./utils/logger";
import { initCacheService } from "./services/CacheService";
import { initDB } from "./utils/db";
import { AgentConfigService } from "./services/AgentConfigService";
import { initQueueService, shutdownQueueService } from "./services/initQueueService";
import QueueManager from "./services/QueueManager";
import MonitoringService from "./services/MonitoringService";
import VisualizationController from "./controllers/VisualizationController";

// 可视化系统变量
let visualizationController: VisualizationController | null = null;

const app: express.Express = express();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'test' ? 0 : 3001);

// 创建服务实例
const agentConfigService = new AgentConfigService();

// 声明 server 变量（必须在使用前声明）
let server: ReturnType<typeof app.listen>;

// 定时任务相关
let dailyCleanupInterval: NodeJS.Timeout | null = null;

// 初始化Sentry（必须在所有中间件之前）
initSentry(app);

// Sentry请求处理器（必须在所有路由之前）
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

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
              process.env.FRONTEND_URL || "http://localhost:3000",
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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000", 10), // 每分钟1000请求
  message: "请求过于频繁，请稍后再试",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);



// 请求日志
app.use(requestLogger);

// 性能监控
app.use(performanceMiddleware);

// 数据库性能监控
app.use(databasePerformanceMonitorMiddleware);

// 数据库优化中间件
app.use(databaseOptimizationMiddleware);

// CSRF Token 获取端点（必须在 CSRF 保护之前）
app.get("/api/csrf-token", getCsrfToken);

// CSRF 保护（排除 GET/健康检查/登录）
app.use(
  csrfProtection({
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
    ignorePaths: ["/health", "/api/auth/login", "/api/csrf-token"],
  })
);


// 路由注册
app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/cad", cadRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/audit", auditRouter); // 审计日志接口
app.use("/api/dify", difySessionRouter); // Dify会话管理接口
app.use("/api/product-preview", productPreviewRoutes); // 产品预览接口
app.use("/api/sessions", sessionRouter); // 会话管理接口
app.use("/api/database", databasePerformanceRouter); // 数据库性能管理接口
app.use("/api/cache", cacheRouter); // 缓存管理接口
app.use("/api/queue", queueRouter); // 消息队列管理接口

// 可视化接口（需要认证）
app.use("/api/visualization", visualizationRouter);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `路由 ${req.method} ${req.path} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
      });
});

// Sentry错误处理器（必须在其他错误处理器之前）
app.use(sentryErrorHandler());

// 全局错误处理
app.use(errorHandler);

// 启动定时任务
function startScheduledTasks(): void {
  // 每日清理任务（每天凌晨2点执行）
  const scheduleDailyCleanup = () => {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(2, 0, 0, 0); // 设置为今天凌晨2点

    // 如果今天已经过了凌晨2点，则设置为明天凌晨2点
    if (now > nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();

    setTimeout(() => {
      // 执行每日清理任务
      agentConfigService.dailyCleanupTask().catch((error: unknown) => {
        logger.error("[ScheduledTasks] 每日清理任务执行失败", { error });
      });

      // 设置每天执行一次的间隔任务
      if (dailyCleanupInterval) {
        clearInterval(dailyCleanupInterval);
      }
      dailyCleanupInterval = setInterval(() => {
        agentConfigService.dailyCleanupTask().catch((error: unknown) => {
          logger.error("[ScheduledTasks] 每日清理任务执行失败", { error });
        });
      }, 24 * 60 * 60 * 1000); // 每24小时执行一次

      logger.info(
        `[ScheduledTasks] 每日清理任务已安排，下次执行时间: ${nextRun.toLocaleString()}`
      );
    }, delay);
  };

  // 启动每日清理任务
  scheduleDailyCleanup();

  logger.info("[ScheduledTasks] 定时任务已启动");
}

// 初始化可视化系统
async function initializeVisualizationSystem(): Promise<void> {
  try {
    // 检查环境变量是否启用可视化
    const visualizationEnabled = process.env.VISUALIZATION_ENABLED !== 'false';

    if (!visualizationEnabled) {
      logger.info("可视化系统已禁用 (VISUALIZATION_ENABLED=false)");
      return;
    }

    // 获取QueueManager实例
    const queueManager = QueueManager.getInstance();

    // 获取MonitoringService实例
    const monitoringService = MonitoringService.getInstance();

    // 获取Redis连接池
    const connectionPool = queueManager.getConnectionPool();

    if (!connectionPool) {
      throw new Error('Redis连接池未初始化');
    }

    // 创建可视化控制器
    visualizationController = new VisualizationController(
      queueManager,
      monitoringService,
      connectionPool
    );

    // 初始化可视化路由
    initializeVisualizationRoutes(visualizationController);

    logger.info("可视化系统初始化完成");
  } catch (error) {
    logger.error("可视化系统初始化失败:", error);
    throw error;
  }
}

// 启动服务器（异步初始化）
async function startServer() {
  try {
    // 🔧 初始化数据库（创建表、种子智能体数据）
    logger.info("🔨 开始初始化数据库...");
    await initDB();
    logger.info("✅ 数据库初始化完成");

    // 初始化缓存服务
    await initCacheService();

    // 初始化数据库优化器
    await initializeDatabaseOptimization();
    logger.info("✅ 数据库优化器已初始化");

    // 初始化队列服务
    await initQueueService();
    logger.info("✅ 队列服务已初始化");

    // 初始化可视化系统（如果启用）
    try {
      await initializeVisualizationSystem();
      logger.info("✅ 可视化系统已初始化");
    } catch (error) {
      logger.warn("⚠️ 可视化系统初始化失败:", error);
    }

    server = app.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功`);
      logger.info(`📍 端口: ${PORT}`);
      logger.info(`🌍 环境: ${process.env.NODE_ENV || "development"}`);
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
  } catch (error) {
    logger.error("服务器启动失败", { error });
    process.exit(1);
  }
}

startServer();

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

  // 3. 关闭队列服务
  try {
    await shutdownQueueService();
    logger.info("✓ 队列服务已关闭");
  } catch (error) {
    logger.error("✗ 队列服务关闭失败:", error);
  }

  // 4. 清理可视化系统
  if (visualizationController) {
    try {
      visualizationController.cleanup();
      logger.info("✓ 可视化系统已清理");
    } catch (error) {
      logger.error("✗ 可视化系统清理失败:", error);
    }
  }

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
  } catch (error) {
    logger.error("关闭数据库连接池失败", { error });
  }

  try {
    // 5. 关闭 Redis 连接（如果存在）
    if (process.env.REDIS_HOST) {
      const { getCacheService } = await import("./services/CacheService");
      const cacheService = getCacheService();
      await cacheService.disconnect();
      logger.info("✓ Redis 连接已关闭");
    }
  } catch (error) {
    logger.error("关闭 Redis 连接失败", { error });
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
