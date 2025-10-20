/**
 * 简化服务器 - 仅用于验证系统正常
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from '@/utils/logger';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// 基础中间件
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000,
}));

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LLMChat Backend - 简化模式',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 基础路由
app.get('/api', (req, res) => {
  res.json({
    message: 'LLMChat API - 简化模式',
    status: 'running',
  });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`🚀 简化服务器启动成功`);
  logger.info(`📍 端口: ${PORT}`);
  logger.info(`🌍 环境: ${process.env.NODE_ENV ?? 'development'}`);
  logger.info(`✅ 系统状态: 正常`);
});

export default app;