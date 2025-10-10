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
import { requestId } from "./middleware/requestId";
import { csrfProtection, getCsrfToken } from "./middleware/csrfProtection";

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

// 工具
import { logger } from "./utils/logger";
import { initCacheService } from "./services/CacheService";
import { initDB } from "./utils/db";
import { AgentConfigService } from "./services/AgentConfigService";
import { performanceOptimizer, createPerformanceMiddleware } from "./utils/PerformanceOptimizer";
import { memoryLeakDetector, createMemoryLeakMiddleware } from "./utils/MemoryLeakDetector";
import { memoryResourceManager } from "./utils/MemoryResourceManager";
import { monitoringManager } from "./utils/MonitoringManager";
import { databaseQueryOptimizer, createQueryOptimizationMiddleware } from "./utils/DatabaseQueryOptimizer";
import { connectionPoolOptimizer, createConnectionPoolOptimizationMiddleware } from "./utils/ConnectionPoolOptimizer";

const app: express.Express = express();
const PORT = process.env.PORT || 3001;

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

// 请求ID
app.use(requestId);

// 性能监控中间件
app.use(createPerformanceMiddleware());

// 内存泄漏检测中间件
app.use(createMemoryLeakMiddleware());

// 数据库查询优化中间件
app.use(createQueryOptimizationMiddleware());

// 连接池优化中间件
app.use(createConnectionPoolOptimizationMiddleware());

// 请求日志
app.use(requestLogger);

// CSRF Token 获取端点（必须在 CSRF 保护之前）
app.get("/api/csrf-token", getCsrfToken);

// CSRF 保护（排除 GET/健康检查/登录）
app.use(
  csrfProtection({
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
    ignorePaths: ["/health", "/api/auth/login", "/api/csrf-token"],
  })
);

// 性能监控端点
app.get("/api/performance/stats", (req, res) => {
  try {
    const stats = performanceOptimizer.getPerformanceStats();
    res.json({
      code: "SUCCESS",
      message: "性能统计获取成功",
      data: stats,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取性能统计失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取性能统计失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/performance/gc", (req, res) => {
  try {
    if (global.gc) {
      global.gc();
      res.json({
        code: "SUCCESS",
        message: "手动垃圾回收完成",
        data: null,
        timestamp: new Date().toISOString(),
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } else {
      res.status(400).json({
        code: "NOT_SUPPORTED",
        message: "垃圾回收不可用（需要使用 --expose-gc 标志启动）",
        data: null,
        timestamp: new Date().toISOString(),
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    }
  } catch (error) {
    logger.error("手动垃圾回收失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "垃圾回收失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

// 内存泄漏检测API端点
app.get("/api/memory/leaks", (req, res) => {
  try {
    const report = memoryLeakDetector.getMemoryLeakReport();
    res.json({
      code: "SUCCESS",
      message: "内存泄漏报告获取成功",
      data: report,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取内存泄漏报告失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取内存泄漏报告失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/memory/check", async (req, res) => {
  try {
    const leaks = await memoryLeakDetector.checkForLeaks();
    res.json({
      code: "SUCCESS",
      message: "内存泄漏检查完成",
      data: {
        leakCount: leaks.length,
        leaks,
      },
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("内存泄漏检查失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "内存泄漏检查失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.get("/api/memory/resources", (req, res) => {
  try {
    const metrics = memoryResourceManager.getMetrics();
    const report = memoryResourceManager.generateReport();
    res.json({
      code: "SUCCESS",
      message: "内存资源报告获取成功",
      data: {
        metrics,
        report,
      },
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取内存资源报告失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取内存资源报告失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/memory/cleanup", (req, res) => {
  try {
    memoryResourceManager.forceCleanup();
    res.json({
      code: "SUCCESS",
      message: "强制内存清理完成",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("强制内存清理失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "强制内存清理失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

// 数据库查询优化API端点
app.get("/api/database/query-stats", (req, res) => {
  try {
    const stats = databaseQueryOptimizer.getPerformanceStats();
    res.json({
      code: "SUCCESS",
      message: "数据库查询统计获取成功",
      data: stats,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取数据库查询统计失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取数据库查询统计失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.get("/api/database/slow-queries", (req, res) => {
  try {
    const stats = databaseQueryOptimizer.getPerformanceStats();
    res.json({
      code: "SUCCESS",
      message: "慢查询统计获取成功",
      data: {
        slowQueries: stats.slowQueries,
        topSlowQueries: stats.topSlowQueries,
        recommendations: stats.recommendations,
      },
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取慢查询统计失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取慢查询统计失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.get("/api/database/cache-stats", (req, res) => {
  try {
    const cacheStats = databaseQueryOptimizer.getCacheStats();
    res.json({
      code: "SUCCESS",
      message: "查询缓存统计获取成功",
      data: cacheStats,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取查询缓存统计失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取查询缓存统计失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/database/cache-clear", (req, res) => {
  try {
    databaseQueryOptimizer.clearCache();
    res.json({
      code: "SUCCESS",
      message: "查询缓存已清除",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("清除查询缓存失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "清除查询缓存失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/database/metrics-clear", (req, res) => {
  try {
    databaseQueryOptimizer.clearMetrics();
    res.json({
      code: "SUCCESS",
      message: "数据库查询指标已清除",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("清除数据库查询指标失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "清除数据库查询指标失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

// 连接池优化API端点
app.get("/api/database/pool-stats", (req, res) => {
  try {
    const stats = connectionPoolOptimizer.getPoolStats();
    res.json({
      code: "SUCCESS",
      message: "连接池统计获取成功",
      data: stats,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取连接池统计失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取连接池统计失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.get("/api/database/pool-leaks", (req, res) => {
  try {
    const leakedConnections = connectionPoolOptimizer.getLeakedConnections();
    res.json({
      code: "SUCCESS",
      message: "连接泄露统计获取成功",
      data: {
        leakedConnections,
        count: leakedConnections.length,
      },
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取连接泄露统计失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取连接泄露统计失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.get("/api/database/pool-report", (req, res) => {
  try {
    const report = connectionPoolOptimizer.getPerformanceReport();
    res.json({
      code: "SUCCESS",
      message: "连接池性能报告获取成功",
      data: report,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("获取连接池性能报告失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "获取连接池性能报告失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/database/pool-config", (req, res) => {
  try {
    const { minConnections, maxConnections, idleTimeoutMillis, connectionTimeoutMillis, maxUses, maxLifetimeSeconds } = req.body;

    const config = {
      minConnections: minConnections || 5,
      maxConnections: maxConnections || 50,
      idleTimeoutMillis: idleTimeoutMillis || 30000,
      connectionTimeoutMillis: connectionTimeoutMillis || 10000,
      maxUses: maxUses || 7500,
      maxLifetimeSeconds: maxLifetimeSeconds || 3600,
    };

    connectionPoolOptimizer.setConfiguration(config);

    res.json({
      code: "SUCCESS",
      message: "连接池配置更新成功",
      data: { config: connectionPoolOptimizer.getConfiguration() },
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("更新连接池配置失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "更新连接池配置失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

app.post("/api/database/pool-leaks-clear", (req, res) => {
  try {
    connectionPoolOptimizer.clearLeakedConnections();
    res.json({
      code: "SUCCESS",
      message: "连接泄露记录已清除",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  } catch (error) {
    logger.error("清除连接泄露记录失败", { error });
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "清除连接泄露记录失败",
      data: null,
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }
});

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

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `路由 ${req.method} ${req.path} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
    ...(req.requestId ? { requestId: req.requestId } : {}),
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

// 启动服务器（异步初始化）
async function startServer() {
  try {
    // 🔧 初始化数据库（创建表、种子智能体数据）
    logger.info("🔨 开始初始化数据库...");
    await initDB();
    logger.info("✅ 数据库初始化完成");

    // 初始化缓存服务
    await initCacheService();

    // 启动性能监控器
    performanceOptimizer.start(5000); // 每5秒监控一次
    logger.info("✅ 性能监控器已启动");

    // 启动内存泄漏检测器
    memoryLeakDetector.start();
    logger.info("✅ 内存泄漏检测器已启动");

    // 启动内存资源管理器
    memoryResourceManager.start({
      cleanupInterval: 60000, // 每分钟清理一次
      enableMetrics: true,
    });
    logger.info("✅ 内存资源管理器已启动");

    // 启动监控管理器
    monitoringManager.start();
    logger.info("✅ 监控管理器已启动");

    // 启动数据库查询优化器
    databaseQueryOptimizer.start({
      metricsInterval: 30000, // 30秒间隔
      enableCache: true,
      enableSlowQueryDetection: true,
    });
    logger.info("✅ 数据库查询优化器已启动");

    // 启动连接池优化器
    connectionPoolOptimizer.start({
      monitoringInterval: 10000, // 10秒间隔
      enableLeakDetection: true,
      enableAutoOptimization: true,
    });
    logger.info("✅ 连接池优化器已启动");

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
      logger.info(`📊 监控: 完整集成`);
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

  try {
    // 6. 停止性能监控器
    performanceOptimizer.stop();
    logger.info("✓ 性能监控器已停止");
  } catch (error) {
    logger.error("停止性能监控器失败", { error });
  }

  try {
    // 7. 停止内存泄漏检测器
    memoryLeakDetector.stop();
    logger.info("✓ 内存泄漏检测器已停止");
  } catch (error) {
    logger.error("停止内存泄漏检测器失败", { error });
  }

  try {
    // 8. 停止内存资源管理器
    memoryResourceManager.stop();
    logger.info("✓ 内存资源管理器已停止");
  } catch (error) {
    logger.error("停止内存资源管理器失败", { error });
  }

  try {
    // 9. 停止监控管理器
    monitoringManager.stop();
    logger.info("✓ 监控管理器已停止");
  } catch (error) {
    logger.error("停止监控管理器失败", { error });
  }

  try {
    // 10. 停止数据库查询优化器
    databaseQueryOptimizer.stop();
    logger.info("✓ 数据库查询优化器已停止");
  } catch (error) {
    logger.error("停止数据库查询优化器失败", { error });
  }

  try {
    // 11. 停止连接池优化器
    connectionPoolOptimizer.stop();
    logger.info("✓ 连接池优化器已停止");
  } catch (error) {
    logger.error("停止连接池优化器失败", { error });
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

export default app;
