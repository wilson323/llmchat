import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

import { agentRoutes } from '@/routes/agents';
import { chatRoutes } from '@/routes/chat';
import { authRoutes } from '@/routes/auth';
import { adminRoutes } from '@/routes/admin';
import { productPreviewRoutes } from '@/routes/productPreview';
import sessionRoutes from '@/routes/sessionRoutes';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { rateLimiter } from '@/middleware/rateLimiter';

import { initDB, closeDB } from '@/utils/db';
import { initializeProtectionService, getProtectionService } from '@/services/ProtectionService';
import {
  protectionMiddleware,
  protectedApiMiddleware,
  monitoringMetricsMiddleware,
  enhancedHealthCheckMiddleware
} from '@/middleware/protectionMiddleware';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 基础中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 禁用对 SSE/流式接口的压缩，避免缓冲影响实时性
app.use(compression({
  filter: (req, res) => {
    const accept = req.headers['accept'];
    if (typeof accept === 'string' && accept.includes('text/event-stream')) {
      return false; // 不压缩 SSE
    }
    // 显式禁用对流式聊天接口的压缩
    if (req.path && req.path.startsWith('/api/chat/completions')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态资源：附件上传目录
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// 请求日志
app.use(requestLogger);

// 保护中间件 - 初始化保护上下文
app.use(protectionMiddleware());

// 监控指标中间件 - 收集性能指标
app.use(monitoringMetricsMiddleware());

// 速率限制
app.use('/api', rateLimiter);

// 增强健康检查中间件 - 包含保护系统状态
app.use(enhancedHealthCheckMiddleware());

// 健康检查端点（保留作为备用，实际由增强中间件处理）
app.get('/health/basic', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API路由
app.use('/api/agents', agentRoutes);
app.use('/api/chat', protectedApiMiddleware(), chatRoutes); // 聊天接口需要保护
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/product-preview', productPreviewRoutes);
app.use('/api/sessions', sessionRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `端点 ${req.originalUrl} 不存在`,
    timestamp: new Date().toISOString(),
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器（先初始化数据库，再初始化保护服务）
let server: import('http').Server;
initDB()
  .then(async () => {
    // 初始化保护服务
    try {
      initializeProtectionService();
      const protectionService = getProtectionService();
      console.log('🛡️ 保护服务初始化成功');
      console.log(`   - 熔断器阈值: ${process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 5}`);
      console.log(`   - 限流阈值: ${process.env.RATE_LIMIT_POINTS || 100} 请求/分钟`);
      console.log(`   - 重试次数: ${process.env.RETRY_MAX_RETRIES || 3}`);
      console.log(`   - 监控状态: ${process.env.MONITORING_ENABLED === 'true' ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('保护服务初始化失败:', error);
      // 保护服务初始化失败不应阻止服务器启动，但需要记录警告
      console.warn('⚠️ 服务将在无保护机制下启动');
    }

    server = app.listen(PORT, () => {
      console.log(`🚀 LLMChat后端服务启动成功`);
      console.log(`📡 服务地址: http://localhost:${PORT}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
      console.log(`🛡️ 保护状态: 已启用`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  server?.close(async () => {
    try {
      // 清理保护服务
      const protectionService = getProtectionService();
      protectionService?.destroy();
      console.log('🛡️ 保护服务已清理');
    } catch (error) {
      console.warn('清理保护服务时出错:', error);
    }

    await closeDB().catch(() => void 0);
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  server?.close(async () => {
    try {
      // 清理保护服务
      const protectionService = getProtectionService();
      protectionService?.destroy();
      console.log('🛡️ 保护服务已清理');
    } catch (error) {
      console.warn('清理保护服务时出错:', error);
    }

    await closeDB().catch(() => void 0);
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;