/**
 * 测试工具函数
 * 为集成测试提供通用工具
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

export interface TestDatabase {
  pool: Pool;
  cleanup: () => Promise<void>;
}

/**
 * 创建测试用的Express应用
 */
export function createTestApp(): express.Application {
  const app = express();

  // 解析JSON请求体
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 基础中间件
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // CORS中间件
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 基础路由（模拟实际路由结构）
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/queue', queueRoutes);

  // 404处理
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  });

  // 错误处理中间件
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Test app error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  });

  return app;
}

/**
 * 认证路由（简化版本）
 */
function authRoutes(router: Router): void {
  // 用户登录
  router.post('/login', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, password } = req.body;

      // 模拟用户验证
      if (email === 'test@example.com' && password === 'testpassword123') {
        res.json({
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
        res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    return res;
  });

  // 用户注册
  router.post('/register', async (req: Request, res: Response): Promise<Response> => {
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
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 刷新token
  router.post('/refresh', async (req: Request, res: Response): Promise<Response> => {
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
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 登出
  router.post('/logout', async (req: Request, res: Response): Promise<Response> => {
    try {
      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取用户信息
  router.get('/profile', (req: Request, res: Response): Response => {
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
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * 聊天路由（简化版本）
 */
function chatRoutes(router: Router): void {
  // 初始化会话
  router.post('/init', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { agentId, title } = req.body;

      const session = {
        id: 'test-session-id',
        agentId: agentId || 'default-agent',
        title: title || 'Test Session',
        messages: [],
        createdAt: new Date().toISOString(),
        userId: 'test-user-id'
      };

      return res.status(201).json({
        success: true,
        data: session
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取会话列表
  router.get('/sessions', async (req: Request, res: Response): Promise<Response> => {
    try {
      const sessions = [
        {
          id: 'session-1',
          agentId: 'agent-1',
          title: 'Session 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 5
        },
        {
          id: 'session-2',
          agentId: 'agent-2',
          title: 'Session 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 3
        }
      ];

      return res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取特定会话
  router.get('/sessions/:sessionId', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { sessionId } = req.params;

      const session = {
        id: sessionId,
        agentId: 'test-agent',
        title: 'Test Session',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'test-user-id'
      };

      return res.json({
        success: true,
        data: session
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 删除会话
  router.delete('/sessions/:sessionId', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { sessionId } = req.params;

      return res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 发送聊天消息
  router.post('/completions', async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { sessionId, messages, stream = false } = req.body;

      if (stream) {
        // 流式响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        res.write('event: chunk\n');
        res.write('data: {"choices": [{"message": {"content": "Test response"}}]}\n\n');
        res.write('event: end\n');
        res.end();
        return; // Streaming response, no explicit return
      } else {
        // 非流式响应
        return res.json({
          success: true,
          data: {
            choices: [
              {
                message: {
                  content: 'Test response'
                }
              }
            ]
          }
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 会话状态
  router.get('/status/:sessionId', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { sessionId } = req.params;

      return res.json({
        success: true,
        data: {
          sessionId,
          isActive: true,
          messageCount: 2,
          lastActivity: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * 代理路由（简化版本）
 */
function agentRoutes(router: Router): void {
  // 获取代理列表
  router.get('/', async (req: Request, res: Response): Promise<Response> => {
    try {
      const agents = [
        {
          id: 'agent-1',
          name: 'Test Agent 1',
          description: 'A test agent for integration testing',
          provider: 'openai',
          status: 'active',
          features: {
            supportsStream: true,
            supportsFiles: false,
            supportsImages: false
          }
        },
        {
          id: 'agent-2',
          name: 'Test Agent 2',
          description: 'Another test agent',
          provider: 'anthropic',
          status: 'inactive',
          features: {
            supportsStream: false,
            supportsFiles: true,
            supportsImages: true
          }
        }
      ];

      return res.json({
        success: true,
        data: agents
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取特定代理
  router.get('/:id', async (req: Request, res: Response): Promise<Response> => {
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
          maxTokens: 2000
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
    } catch (error) {
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

  // 代理状态检查
  router.get('/:id/status', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;

      return res.json({
        success: true,
        data: {
          agentId: id,
          status: 'active',
          lastChecked: new Date().toISOString(),
          responseTime: 150,
          isHealthy: true,
          errorCount: 0,
          lastError: null
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 聊代理配置重载
  router.post('/reload', async (req: Request, res: Response): Promise<Response> => {
    try {
      return res.json({
        success: true,
        message: 'Agent configuration reloaded',
        reloadedAt: new Date().toISOString(),
        agentCount: 2
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * 队列路由（简化版本）
 */
function queueRoutes(router: Router): void {
  // 获取队列统计
  router.get('/stats/:queueName', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { queueName } = req.params;

      const stats = {
        queueName,
        total: 10,
        waiting: 5,
        active: 3,
        completed: 2,
        failed: 0,
        lastActivity: new Date().toISOString()
      };

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 队列健康检查
  router.get('/health/:queueName', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { queueName } = req.params;

      const health = {
        queueName,
        healthy: true,
        status: 'healthy',
        checks: {
          queueSize: 'pass',
          processingTime: 'pass',
          errorRate: 'pass',
          memoryUsage: 'pass',
          redisConnection: 'pass',
          staleJobs: 'pass',
          deadlockDetection: 'pass'
        },
        metrics: {
          totalJobs: 10,
          waitingJobs: 5,
          activeJobs: 3,
          completedJobs: 2,
          failedJobs: 0
        },
        lastCheck: new Date().toISOString(),
        checkDuration: 50
      };

      return res.json({
        success: true,
        data: health
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 暂停队列
  router.post('/:queueName/pause', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { queueName } = req.params;

      return res.json({
        success: true,
        message: `Queue ${queueName} has been paused`
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 恢复队列
  router.post('/:queueName/resume', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { queueName } = req.params;

      return res.json({
        success: true,
        message: `Queue ${queueName} has been resumed`
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清空队列
  router.post('/:queueName/clear', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { queueName } = req.params;

      return res.json({
        success: true,
        message: `Queue ${queueName} has been cleared`
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * 设置测试数据库
 */
export async function setupTestDatabase(): Promise<TestDatabase> {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'llmchat_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // 创建测试表（如果不存在）
  await createTestTables(pool);

  return {
    pool,
    cleanup: async () => {
      await pool.end();
    }
  };
}

/**
 * 创建测试表
 */
async function createTestTables(pool: Pool): Promise<void> {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      email VARCHAR(255) UNIQUE,
      email_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createUsersTable);
    await pool.query(createSessionsTable);
  } catch (error) {
    console.error('Error creating test tables:', error);
    throw error;
  }
}

/**
 * 清理测试数据库
 */
export async function cleanupTestDatabase(testDb: TestDatabase): Promise<void> {
  try {
    await testDb.cleanup();
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
}

/**
 * 创建测试Token
 */
export function createTestToken(): string {
  return 'test-jwt-token';
}

/**
 * 模拟等待
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 模拟随机ID生成
 */
export function generateId(): string {
  return 'test-' + Math.random().toString(36).substr(2, 9);
}