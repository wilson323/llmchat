/**
 * 最小化服务器 - 逐步排查问题
 */

import "./dotenv-loader"; // 必须最先加载环境变量
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import logger from "./utils/logger";

const app: express.Express = express();

// 自动端口检测函数
async function findAvailablePort(startPort: number = 3005): Promise<number> {
  const net = await import('net');
  const { createServer } = net.default;

  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(startPort, () => {
      const address = server.address();
      let port = 0;
      if (typeof address === 'string') {
        port = parseInt(address.split(':').pop() || '0');
      } else if (address && typeof address === 'object' && 'port' in address) {
        port = address.port;
      }
      server.close(() => resolve(port));
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        if (startPort < 3010) {
          resolve(findAvailablePort(startPort + 1));
        } else {
          reject(err);
        }
      } else {
        reject(err);
      }
    });
  });
}

async function startServer() {
  const PORT = await findAvailablePort(parseInt(process.env.PORT ?? '3005'));

  // 全局错误处理器
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('未处理的Promise拒绝', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: String(promise),
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('未捕获的异常', {
    message: error.message,
    stack: error.stack,
  });
  if (error.message?.includes('FATAL') || error.message?.includes('MODULE_NOT_FOUND')) {
    process.exit(1);
  }
});

logger.info("🔧 开始初始化最小化服务器");

// 基础中间件
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "1000", 10),
  message: "请求过于频繁，请稍后再试",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

logger.info("✅ 基础中间件已配置");

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LLMChat Backend - 最小化模式',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

logger.info("✅ 健康检查路由已配置");

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `路由 ${req.method} ${req.path} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
  });
});

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('全局错误处理', { error: err.message, stack: err.stack });
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "服务器内部错误",
    data: null,
    timestamp: new Date().toISOString(),
  });
});

logger.info("✅ 错误处理已配置");

  // 启动服务器
  app.listen(PORT, () => {
    logger.info(`🚀 最小化服务器启动成功`);
    logger.info(`📍 端口: ${PORT}`);
    logger.info(`🌍 环境: ${process.env.NODE_ENV ?? "development"}`);
    logger.info(`✅ 系统状态: 正常`);
  });
}

// 启动服务器
startServer().catch(error => {
  logger.error('服务器启动失败:', error);
  process.exit(1);
});

export { app };
export default app;