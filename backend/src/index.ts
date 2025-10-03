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

// 路由
import agentsRouter from './routes/agents';
import chatRouter from './routes/chat';
import healthRouter from './routes/health';

// 工具
import { logger } from './utils/logger';

const app: express.Express = express();
const PORT = process.env.PORT || 3001;

// 初始化Sentry（必须在所有中间件之前）
initSentry(app);

// Sentry请求处理器（必须在所有路由之前）
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// 安全头部
app.use(helmet({
  contentSecurityPolicy: false, // 开发时禁用CSP
}));

// CORS配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

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

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 请求ID
app.use(requestId);

// 请求日志
app.use(requestLogger);

// 路由注册
app.use('/health', healthRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/chat', chatRouter);

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

// 启动服务器
app.listen(PORT, () => {
  logger.info(`🚀 服务器启动成功`);
  logger.info(`📍 端口: ${PORT}`);
  logger.info(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`✅ Sentry: ${process.env.SENTRY_ENABLED === 'true' ? '已启用' : '已禁用'}`);
  logger.info(`📊 监控: 完整集成`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});

export default app;
