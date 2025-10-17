/**
 * 简化的测试工具函数
 * 专门为集成测试设计，避免复杂的TypeScript类型错误
 */

import express, { Router, Request, Response } from 'express';

/**
 * 创建测试应用
 */
export function createTestApp(): express.Application {
  const app = express();

  // 基础中间件
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 健康检查路由
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 注册路由
  app.use('/api/auth', authRoutes(Router()));
  app.use('/api/agents', agentRoutes(Router()));
  app.use('/api/chat', chatRoutes(Router()));
  app.use('/api/queue', queueRoutes(Router()));

  // 404处理
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  });

  // 错误处理中间件
  app.use((error: Error, req: Request, res: Response, next: any) => {
    console.error('Test app error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  });

  return app;
}

/**
 * 创建测试Token
 */
export function createTestToken(): string {
  return 'test-jwt-token';
}

/**
 * 认证路由（简化版本）
 */
function authRoutes(router: Router): express.Router {
  // 用户登录
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // 模拟用户验证
      if (email === 'test@example.com' && password === 'testpassword123') {
        return res.json({
          success: true,
          data: {
            token: 'test-jwt-token',
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              fullName: 'Test User'
            }
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 用户注册
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, fullName } = req.body;

      // 简单验证
      if (!email || !password || password.length < 8) {
        return res.status(400).json({
          success: false,
          error: password.length < 8 ? 'Password must be at least 8 characters' : 'Email and password are required'
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: 'new-user-id',
            email,
            fullName: fullName || 'User'
          }
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 刷新token
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided'
        });
      }

      return res.json({
        success: true,
        data: {
          token: 'refreshed-test-token'
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取用户信息
  router.get('/profile', (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided'
        });
      }

      // 模拟用户信息
      return res.json({
        success: true,
        data: {
          id: 'test-user-id',
          email: 'test@example.com',
          fullName: 'Test User'
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

/**
 * 聊天路由（简化版本）
 */
function chatRoutes(router: Router): express.Router {
  // 初始化会话
  router.post('/init', async (req: Request, res: Response) => {
    try {
      const { agentId, title } = req.body;

      const session = {
        sessionId: 'test-session-' + Date.now(),
        title: title || 'New Chat',
        agentId: agentId || 'default-agent',
        messages: [],
        createdAt: new Date().toISOString(),
        userId: 'test-user-id'
      };

      return res.status(201).json({
        success: true,
        data: session
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取会话列表
  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const sessions = [
        {
          sessionId: 'test-session-1',
          title: 'Test Chat 1',
          agentId: 'test-agent-1',
          messages: [],
          createdAt: new Date().toISOString()
        },
        {
          sessionId: 'test-session-2',
          title: 'Test Chat 2',
          agentId: 'test-agent-2',
          messages: [],
          createdAt: new Date().toISOString()
        }
      ];

      return res.json({
        success: true,
        data: { sessions }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

/**
 * 代理路由（简化版本）
 */
function agentRoutes(router: Router): express.Router {
  // 获取代理列表
  router.get('/', async (req: Request, res: Response) => {
    try {
      const agents = [
        {
          id: 'test-agent-1',
          name: 'GPT-4 Assistant',
          description: 'A helpful AI assistant',
          provider: 'openai',
          status: 'active',
          config: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000
          },
          features: {
            supportsStream: true,
            supportsFiles: false,
            supportsImages: true
          }
        },
        {
          id: 'test-agent-2',
          name: 'Claude Assistant',
          description: 'AI assistant for creative tasks',
          provider: 'anthropic',
          status: 'active',
          config: {
            model: 'claude-3-sonnet',
            temperature: 0.5,
            maxTokens: 4000
          },
          features: {
            supportsStream: true,
            supportsFiles: true,
            supportsImages: false
          }
        }
      ];

      return res.json({
        success: true,
        data: { agents }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取特定代理
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const agent = {
        id,
        name: 'Test Agent',
        description: 'A test agent',
        provider: 'openai',
        status: 'active',
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 1500
        },
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: false
        }
      };

      return res.json({
        success: true,
        data: agent
      });
    } catch (error: any) {
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

/**
 * 队列路由（简化版本）
 */
function queueRoutes(router: Router): express.Router {
  // 获取队列统计
  router.get('/stats/:queueName', async (req: Request, res: Response) => {
    try {
      const { queueName } = req.params;

      const stats = {
        queueName,
        waiting: Math.floor(Math.random() * 10),
        active: Math.floor(Math.random() * 5),
        completed: Math.floor(Math.random() * 100),
        failed: Math.floor(Math.random() * 5),
        delayed: 0
      };

      return res.json({
        success: true,
        data: { stats }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取队列名称
  router.get('/names', async (req: Request, res: Response) => {
    try {
      const queueNames = ['default', 'high-priority', 'background'];

      return res.json({
        success: true,
        data: { queueNames }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
