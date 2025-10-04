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

import './dotenv-loader'; // 必须最先加载环境变量
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// Sentry监控
import {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
} from './utils/sentry';

// 中间件
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { csrfProtection, getCsrfToken } from './middleware/csrfProtection';

// 路由
import agentsRouter from './routes/agents';
import chatRouter from './routes/chat';
import healthRouter from './routes/health';
import cadRouter from './routes/cad';

// 工具
import { logger } from './utils/logger';
import { initCacheService } from './services/CacheService';

const app: express.Express = express();
const PORT = process.env.PORT || 3001;

// 声明 server 变量（必须在使用前声明）
let server: ReturnType<typeof app.listen>;

// 初始化Sentry（必须在所有中间件之前）
initSentry(app);

// Sentry请求处理器（必须在所有路由之前）
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// 安全头部配置
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // React 需要，生产环境考虑 nonce
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind 需要
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false,
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Cookie 解析（CSRF 需要）
app.use(cookieParser());

// Body解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 压缩（除了SSE端点）
app.use(compression({
  filter: (req, res) => {
    if (req.path.includes('/chat/completions') && req.query.stream === 'true') {
      return false; // 不压缩SSE流
    }
    return compression.filter(req, res);
  },
}));

// 速率限制（支持高并发场景）
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10), // 每分钟1000请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 请求ID
app.use(requestId);

// 请求日志
app.use(requestLogger);

// CSRF Token 获取端点（必须在 CSRF 保护之前）
app.get('/api/csrf-token', getCsrfToken);

// CSRF 保护（排除 GET/健康检查/登录）
app.use(csrfProtection({
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  ignorePaths: ['/health', '/api/auth/login', '/api/csrf-token'],
}));

// 路由注册
app.use('/health', healthRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/cad', cadRouter);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
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

// 启动服务器（异步初始化）
async function startServer() {
  try {
    // 初始化缓存服务
    await initCacheService();
    
    server = app.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功`);
      logger.info(`📍 端口: ${PORT}`);
      logger.info(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`✅ Sentry: ${process.env.SENTRY_ENABLED === 'true' ? '已启用' : '已禁用'}`);
      logger.info(`🔒 CSRF: ${process.env.NODE_ENV === 'production' ? '已启用' : '开发模式'}`);
      logger.info(`🛡️ CSP: ${process.env.NODE_ENV === 'production' ? '已启用' : '开发模式'}`);
      logger.info(`💾 Redis: ${process.env.REDIS_HOST ? '已连接' : '未配置'}`);
      logger.info(`📊 监控: 完整集成`);
    });
  } catch (error) {
    logger.error('服务器启动失败', { error });
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
      logger.info('✓ HTTP 服务器已停止接收新请求');
    });
  }

  // 2. 等待现有请求完成（最多 10 秒）
  const activeConnections = await new Promise<number>((resolve) => {
    if (!server) {
      resolve(0);
      return;
    }
    
    server.getConnections((err, count) => {
      if (err) {
        logger.error('获取活跃连接数失败', { error: err });
        resolve(0);
      } else {
        logger.info(`等待 ${count} 个活跃连接完成...`);
        resolve(count);
      }
    });
  });

  if (activeConnections > 0) {
    logger.info('等待活跃连接完成（最多10秒）...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  try {
    // 3. 关闭数据库连接池
    const { getPool } = await import('./utils/db');
    const pool = getPool();
    await pool.end();
    logger.info('✓ 数据库连接池已关闭');
  } catch (error) {
    logger.error('关闭数据库连接池失败', { error });
  }

  try {
    // 4. 关闭 Redis 连接（如果存在）
    if (process.env.REDIS_HOST) {
      const { getCacheService } = await import('./services/CacheService');
      const cacheService = getCacheService();
      await cacheService.disconnect();
      logger.info('✓ Redis 连接已关闭');
    }
  } catch (error) {
    logger.error('关闭 Redis 连接失败', { error });
  }

  logger.info('✓ 优雅关闭完成');
  process.exit(0);
};

// 15 秒强制退出保护
const forceShutdownTimeout = 15000;

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
  setTimeout(() => {
    logger.error('强制关闭超时，立即退出');
    process.exit(1);
  }, forceShutdownTimeout);
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
  setTimeout(() => {
    logger.error('强制关闭超时，立即退出');
    process.exit(1);
  }, forceShutdownTimeout);
});

export default app;
