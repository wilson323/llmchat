/**
 * LLMChat 后端服务入口 - 生产级完整版本
 *
 * 功能：
 * - Express服务器
 * - 数据库连接
 * - 智能体配置
 * - 完整路由注册
 * - 错误处理
 */

import './dotenv-loader'; // 必须最先加载环境变量
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { prometheusMiddleware } from './middleware/prometheusMiddleware';
import { createErrorFromUnknown } from './types/errors';

// 🔧 核心路由导入
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import authRouter from './routes/auth';
import agentsRouter from './routes/agents';
import chatRouter from './routes/chat';
import adminRouter from './routes/admin';
import analyticsRouter from './routes/analytics';
import chatSessionsRouter from './routes/chatSessions';
import sessionRoutesRouter from './routes/sessionRoutes';
import uploadRouter from './routes/upload';

// 🔧 核心服务导入
import { initDB } from './utils/db';
import { AgentConfigService } from './services/AgentConfigService';

console.log('[INIT] ========================================');
console.log('[INIT] ✓ 所有模块导入成功');
console.log('[INIT] ========================================');

// ===== 全局错误处理器（必须在最前面） =====
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[REJECTION] 未处理的Promise拒绝:', reason?.message || reason);
  console.error('[REJECTION] 堆栈:', reason?.stack);
  logger.error('未处理的Promise拒绝', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: String(promise),
  });
});

process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT] 未捕获的异常:', error.message);
  console.error('[UNCAUGHT] 堆栈:', error.stack);
  logger.error('未捕获的异常', {
    message: error.message,
    stack: error.stack,
  });
  if (error.message?.includes('FATAL') || error.message?.includes('MODULE_NOT_FOUND')) {
    process.exit(1);
  }
});

// ===== Express应用实例 =====
console.log('[INIT] 创建Express应用实例...');
const app: express.Express = express();
console.log('[INIT] ✓ Express应用实例创建成功');

// 声明全局服务实例
let agentConfigService: AgentConfigService | null = null;

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

// ===== 中间件配置 =====
console.log('[INIT] ========================================');
console.log('[INIT] 开始配置中间件...');
logger.info('🔧 配置中间件...');

// 安全头部
app.use(helmet({
  contentSecurityPolicy: false, // 开发环境禁用
  xssFilter: false, // 禁用过时的X-XSS-Protection头
}));

// 响应头优化中间件
app.use((req, res, next) => {
  // 移除不必要的安全头
  res.removeHeader('X-XSS-Protection');

  // 确保JSON响应使用正确的Content-Type
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };

  next();
});

// 压缩
app.use(compression({
  filter: (req, res) => {
    // SSE流不压缩
    if (req.path.includes('/chat/completions') && req.query.stream === 'true') {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3004',
  credentials: true,
}));

// Cookie解析
app.use(cookieParser());

// Body解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prometheus监控中间件
app.use(prometheusMiddleware());

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '1000', 10),
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

logger.info('✅ 中间件配置完成');

// ===== 路由注册 =====
logger.info('🔧 注册路由...');

// 健康检查路由（无需认证）
app.use('/health', healthRouter);

// Prometheus metrics端点（无需认证）
app.use('/metrics', metricsRouter);

// 核心API路由
app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/analytics', analyticsRouter);
app.use('/api/chat-sessions', chatSessionsRouter);
app.use('/api/sessions', sessionRoutesRouter);
app.use('/api/upload', uploadRouter);

logger.info('✅ 路由注册完成');

// ===== 错误处理 =====
// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `路由 ${req.method} ${req.path} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
  });
});

// 全局错误处理
app.use(errorHandler);

logger.info('✅ 错误处理已配置');

// ===== 服务器启动 =====
async function startServer() {
  try {
    console.log('[INIT] ========================================');
    console.log('[INIT] 🚀 开始初始化服务器...');
    logger.info('🚀 开始初始化服务器...');

    // 1. 初始化数据库
    console.log('[INIT] 📦 初始化数据库连接...');
    logger.info('📦 初始化数据库连接...');
    await initDB();
    console.log('[INIT] ✅ 数据库连接成功');
    logger.info('✅ 数据库连接成功');

    // 2. 初始化智能体配置服务
    logger.info('🤖 初始化智能体配置服务...');
    agentConfigService = new AgentConfigService();
    logger.info('✅ 智能体配置服务已就绪');

    // 3. 查找可用端口
    const PORT = await findAvailablePort(parseInt(process.env.PORT ?? '3005'));

    // 4. 启动HTTP服务器
    app.listen(PORT, () => {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🎉 LLMChat 后端服务启动成功');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`📍 端口: ${PORT}`);
      logger.info(`🌍 环境: ${process.env.NODE_ENV ?? 'development'}`);
      logger.info(`🔗 健康检查: http://localhost:${PORT}/health`);
      logger.info(`🔗 API文档: http://localhost:${PORT}/api/agents`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (error: unknown) {
    const err = createErrorFromUnknown(error, {
      component: 'index',
      operation: 'startServer',
    });
    logger.error('服务器初始化失败', err.toLogObject());
    process.exit(1);
  }
}

// 启动服务器（非测试环境）
if (process.env.NODE_ENV !== 'test') {
  console.log('[INIT] ========================================');
  console.log('[INIT] NODE_ENV =', process.env.NODE_ENV);
  console.log('[INIT] 准备启动服务器...');
  startServer().catch(error => {
    console.error('[INIT] ❌ 服务器启动失败!');
    console.error('[INIT] 错误类型:', error?.constructor?.name);
    console.error('[INIT] 错误消息:', error?.message);
    console.error('[INIT] 错误堆栈:', error?.stack);
    console.error('[INIT] 完整错误:', error);
    logger.error('服务器启动失败:', error);
    process.exit(1);
  });
} else {
  console.log('[INIT] Test mode, server not started');
}

// ===== 优雅关闭 =====
const gracefulShutdown = (signal: string) => {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, agentConfigService };
export default app;
