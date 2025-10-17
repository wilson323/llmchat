/**
 * 集成测试工具
 * 提供集成测试的通用工具函数
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// 路由
import agentsRouter from '../../routes/agents';
import chatRouter from '../../routes/chat';
import healthRouter from '../../routes/health';
import cadRouter from '../../routes/cad';
import authRouter from '../../routes/auth';
import adminRoutes from '../../routes/admin';
import auditRouter from '../../routes/audit';
import difySessionRouter from '../../routes/difySession';
import { productPreviewRoutes } from '../../routes/productPreview';
import sessionRouter from '../../routes/sessionRoutes';
import chatSessionsRouter from '../../routes/chatSessions';
import uploadRouter from '../../routes/upload';
import databasePerformanceRouter from '../../routes/databasePerformance';
import cacheRouter from '../../routes/cache';
import queueRouter from '../../routes/queue';
import metricsRouter from '../../routes/metrics';
import visualizationRouter from '../../routes/visualizationRoutes';

// 中间件
import { errorHandler } from '../../middleware/errorHandler';

export const setupTestDatabase = async () => {
  // Mock implementation
  return Promise.resolve();
};

export const cleanupTestDatabase = async () => {
  // Mock implementation
  return Promise.resolve();
};

/**
 * 创建测试应用实例（包含所有路由）
 * 用于性能测试和集成测试
 */
export const createTestApp = (): express.Express => {
  const app = express();

  // CORS配置
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );

  // Cookie 解析
  app.use(cookieParser());

  // Body解析
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 路由注册（与主应用保持一致）
  app.use('/metrics', metricsRouter);
  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/cad', cadRouter);
  app.use('/api/admin', adminRoutes);
  app.use('/api/audit', auditRouter);
  app.use('/api/dify', difySessionRouter);
  app.use('/api/product-preview', productPreviewRoutes);
  app.use('/api/sessions', sessionRouter);
  app.use('/api/chat-sessions', chatSessionsRouter);
  app.use('/api/chat/sessions', chatSessionsRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/database', databasePerformanceRouter);
  app.use('/api/cache', cacheRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/visualization', visualizationRouter);

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

  return app;
};

export const createTestUser = async (userData: any) => {
  // Mock implementation
  return { id: 'test-user', ...userData };
};

export const generateTestToken = () => {
  // Mock implementation
  return 'test-jwt-token';
};