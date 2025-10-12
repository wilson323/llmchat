/**
 * 集成测试工具
 * 专门为集成测试设计，支持优化的JWT认证
 */

import express from 'express';
import request from 'supertest';
import { createOptimizedAuthMiddleware } from '../../middleware/jwtAuthOptimized';
import jwt from 'jsonwebtoken';

/**
 * 创建测试用的JWT令牌
 */
export function createTestJWT(payload: any = {}, options?: any): string {
  const defaultPayload = {
    sub: 'test-user-id',
    userId: 'test-user-id',
    username: 'testuser',
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1小时后过期
  };

  const finalPayload = { ...defaultPayload, ...payload };

  // 默认选项
  const defaultOptions = {
    algorithm: 'HS256' as const,
    issuer: 'llmchat-backend-test',
    audience: 'llmchat-frontend-test'
  };

  // 合并选项，允许覆盖默认值
  const finalOptions = { ...defaultOptions, ...options };

  // 使用简单的测试密钥（仅用于测试环境）
  return jwt.sign(finalPayload, 'test-jwt-secret-for-integration-testing', finalOptions);
}

/**
 * 创建完整的测试应用（包含优化的JWT认证）
 */
export function createTestApp(): express.Application {
  const app = express();

  // 基础中间件（添加JSON解析错误处理）
  app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        // 设置错误标记，将在错误处理中间件中使用
        (req as any).jsonParseError = true;
      }
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // OPTIONS请求处理 - 放在中间件之后，路由注册之前
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  // 健康检查（无需认证）
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 认证路由
  const authRouter = express.Router();
  authRouter.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'test@example.com' && password === 'testpassword123') {
      // 生成真实的JWT令牌用于测试
      const token = createTestJWT({
        sub: 'test-user-id',
        userId: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User'
      });

      res.json({
        success: true,
        data: {
          token,
          user: { id: 'test-user-id', email, fullName: 'Test User' }
        }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  });

  authRouter.post('/register', (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: password.length < 8 ? 'Password must be at least 8 characters' : 'Email and password are required'
      });
    }

    // 为新注册用户生成JWT令牌
    const token = createTestJWT({
      sub: 'new-user-id',
      userId: 'new-user-id',
      username: email.split('@')[0],
      email: email,
      fullName: fullName || 'User'
    });

    return res.status(201).json({
      success: true,
      data: {
        user: { id: 'new-user-id', email, fullName: fullName || 'User' },
        token
      }
    });
  });

  // 代理路由
  const agentRouter = express.Router();
  agentRouter.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        agents: [
          {
            id: 'test-agent-1',
            name: 'GPT-4 Assistant',
            provider: 'openai',
            status: 'active',
            features: { supportsStream: true, supportsFiles: false }
          },
          {
            id: 'test-agent-2',
            name: 'Claude Assistant',
            provider: 'anthropic',
            status: 'active',
            features: { supportsStream: true, supportsFiles: true }
          }
        ]
      }
    });
  });

  agentRouter.get('/:id', (req, res) => {
    const { id } = req.params;
    if (id === 'non-existent' || id === 'non-existent-agent') {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    return res.json({
      success: true,
      data: {
        id,
        name: 'Test Agent',
        provider: 'openai',
        status: 'active',
        features: { supportsStream: true, supportsFiles: false }
      }
    });
  });

  // 聊天路由（需要JWT认证）
  const chatRouter = express.Router();
  chatRouter.use(createOptimizedAuthMiddleware({ testMode: true })); // 添加优化的JWT中间件

  chatRouter.post('/init', (req, res) => {
    const { agentId, title } = req.body;
    const user = (req as any).user; // 从JWT中间件获取用户信息

    res.status(201).json({
      success: true,
      data: {
        sessionId: 'test-session-' + Date.now(),
        title: title || 'New Chat',
        agentId: agentId || 'default-agent',
        userId: user?.id || 'test-user-id',
        messages: [],
        createdAt: new Date().toISOString()
      }
    });
  });

  chatRouter.get('/sessions', (req, res) => {
    const user = (req as any).user; // 从JWT中间件获取用户信息

    res.json({
      success: true,
      data: {
        sessions: [
          {
            sessionId: 'test-session-1',
            title: 'Test Chat 1',
            agentId: 'test-agent-1',
            userId: user?.id || 'test-user-id',
            createdAt: new Date().toISOString()
          }
        ]
      }
    });
  });

  // 队列路由（需要JWT认证）
  const queueRouter = express.Router();
  queueRouter.use(createOptimizedAuthMiddleware({ testMode: true })); // 添加优化的JWT中间件

  queueRouter.get('/stats/:queueName', (req, res) => {
    const { queueName } = req.params;
    const user = (req as any).user; // 从JWT中间件获取用户信息

    res.json({
      success: true,
      data: {
        stats: {
          queueName,
          waiting: Math.floor(Math.random() * 10),
          active: Math.floor(Math.random() * 5),
          completed: Math.floor(Math.random() * 100),
          failed: Math.floor(Math.random() * 5),
          userId: user?.id || 'test-user-id'
        }
      }
    });
  });

  queueRouter.get('/names', (req, res) => {
    const user = (req as any).user; // 从JWT中间件获取用户信息

    res.json({
      success: true,
      data: {
        queueNames: ['default', 'high-priority', 'background'],
        userId: user?.id || 'test-user-id'
      }
    });
  });

  // 注册路由
  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/queue', queueRouter);

  // 错误处理中间件
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if ((req as any).jsonParseError) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON format'
      });
      return;
    }

    // 处理其他错误
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  
  // 404处理
  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  return app;
}

/**
 * 创建测试Token（兼容性函数）
 */
export function createTestToken(payload?: any): string {
  return createTestJWT(payload);
}

/**
 * 创建管理员Token
 */
export function createAdminToken(payload?: any): string {
  return createTestJWT({
    role: 'admin',
    ...payload
  });
}

/**
 * 创建过期的Token（用于测试过期场景）
 */
export function createExpiredToken(): string {
  const expiredPayload = {
    sub: 'test-user-id',
    userId: 'test-user-id',
    username: 'testuser',
    role: 'user',
    iat: Math.floor(Date.now() / 1000) - 3600, // 1小时前
    exp: Math.floor(Date.now() / 1000) - 60   // 1分钟前过期
  };

  return jwt.sign(expiredPayload, 'test-jwt-secret-for-integration-testing', {
    algorithm: 'HS256',
    issuer: 'llmchat-backend-test',
    audience: 'llmchat-frontend-test'
  });
}

/**
 * 验证JWT Token（测试辅助函数）
 */
export function verifyTestToken(token: string): any {
  try {
    return jwt.verify(token, 'test-jwt-secret-for-integration-testing', {
      algorithms: ['HS256'],
      issuer: 'llmchat-backend-test',
      audience: 'llmchat-frontend-test'
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw error; // 直接重新抛出TokenExpiredError
    }
    throw new Error(`Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}