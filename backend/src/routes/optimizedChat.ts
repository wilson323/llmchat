/**
 * 极致优化的聊天路由
 * 集成错误处理和降级策略
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';

import { optimizedChatController } from '@/controllers/OptimizedChatController';
import { optimizedErrorMiddleware } from '@/middleware/OptimizedErrorHandler';
import { requestPreprocessor } from '@/utils/RequestPreprocessor';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';
import logger from '@/utils/logger';

const router = Router();

// 安全中间件 - 排除SSE路由
router.use((req, res, next) => {
  if (req.path.includes('/completions') && req.body?.stream) {
    return next(); // 跳过SSE路由的安全中间件
  }
  helmet()(req, res, next);
});

// 压缩中间件 - 排除SSE路由
router.use((req, res, next) => {
  if (req.path.includes('/completions') && req.body?.stream) {
    return next(); // 跳过SSE路由的压缩
  }
  compression()(req, res, next);
});

// 速率限制 - 针对不同端点的不同限制
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 100, // 每分钟最多100个请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后重试',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 基于用户ID和IP的复合键
    const userId = (req as any).user?.id || req.ip;
    return `chat:${userId}`;
  }
});

const streamLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 50, // 流式请求限制更严格
  message: {
    success: false,
    error: {
      code: 'STREAM_RATE_LIMIT_EXCEEDED',
      message: '流式请求过于频繁，请稍后重试',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || req.ip;
    return `stream:${userId}`;
  }
});

// 请求预处理器
router.use(requestPreprocessor.middleware());

// 性能监控中间件
router.use(performanceMiddleware);

/**
 * 性能监控中间件
 */
function performanceMiddleware(req: any, res: any, next: any) {
  const startTime = performance.now();
  const requestId = require('crypto').randomUUID();

  req.requestId = requestId;
  req.startTime = startTime;

  // 添加请求ID到响应头
  res.setHeader('X-Request-ID', requestId);

  // 记录请求开始
  logger.debug('请求开始', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // 监听响应完成
  res.on('finish', () => {
    const duration = performance.now() - startTime;

    // 记录性能指标
    performanceOptimizer.recordRequest({
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      requestSize: JSON.stringify(req.body).length,
      responseSize: res.get('Content-Length') || 0,
      timestamp: Date.now()
    });

    logger.debug('请求完成', {
      requestId,
      statusCode: res.statusCode,
      duration: duration.toFixed(2) + 'ms'
    });
  });

  next();
}

/**
 * 极致优化的聊天完成接口
 * POST /api/chat/completions
 */
router.post('/completions',
  // 动态速率限制
  (req, res, next) => {
    if (req.body?.stream) {
      return streamLimiter(req, res, next);
    } else {
      return chatLimiter(req, res, next);
    }
  },
  // 请求验证和预处理
  (req, res, next) => {
    try {
      // 快速验证
      if (!req.body || !req.body.agentId || !req.body.messages) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '缺少必要参数: agentId, messages',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 验证消息数组
      if (!Array.isArray(req.body.messages) || req.body.messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'messages 必须是非空数组',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 验证agentId格式
      if (typeof req.body.agentId !== 'string' || req.body.agentId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'agentId 必须是非空字符串',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 清理和标准化输入
      req.body.agentId = req.body.agentId.trim();

      // 验证消息格式
      const messages = req.body.messages;
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg.role || !msg.content) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `消息 ${i + 1} 缺少必要字段: role, content`,
              timestamp: new Date().toISOString()
            }
          });
        }

        if (!['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `消息 ${i + 1} 的 role 必须是 user, assistant 或 system`,
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      next();
    } catch (error) {
      logger.error('请求预处理失败', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'PREPROCESSING_ERROR',
          message: '请求预处理失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  },
  // 主处理逻辑
  async (req, res, next) => {
    try {
      await optimizedChatController.chatCompletions(req, res, next);
    } catch (error) {
      logger.error('聊天处理失败', {
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        agentId: req.body.agentId
      });
      next(error);
    }
  },
  // 错误处理
  optimizedErrorMiddleware
);

/**
 * 极致优化的聊天初始化接口
 * GET /api/chat/init
 */
router.get('/init',
  // 轻量级速率限制
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 200, // 初始化请求限制较宽松
    message: {
      success: false,
      error: {
        code: 'INIT_RATE_LIMIT_EXCEEDED',
        message: '初始化请求过于频繁，请稍后重试',
        timestamp: new Date().toISOString()
      }
    }
  }),
  // 请求验证
  (req, res, next) => {
    const { appId, chatId, stream } = req.query;

    if (!appId || typeof appId !== 'string' || appId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'appId 是必需的参数',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 清理参数
    req.query.appId = appId.trim();

    next();
  },
  // 主处理逻辑
  async (req, res, next) => {
    try {
      await optimizedChatController.chatInit(req, res, next);
    } catch (error) {
      logger.error('聊天初始化失败', {
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        appId: req.query.appId
      });
      next(error);
    }
  },
  // 错误处理
  optimizedErrorMiddleware
);

/**
 * 聊天历史记录接口
 * GET /api/chat/history/:sessionId
 */
router.get('/history/:sessionId',
  // 速率限制
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300, // 历史查询限制更宽松
    message: {
      success: false,
      error: {
        code: 'HISTORY_RATE_LIMIT_EXCEEDED',
        message: '历史查询请求过于频繁，请稍后重试',
        timestamp: new Date().toISOString()
      }
    }
  }),
  // 参数验证
  (req, res, next) => {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sessionId 是必需的参数',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  },
  // 主处理逻辑（简化版本，实际应该调用专门的历史服务）
  async (req, res, next) => {
    try {
      // 这里应该调用优化后的历史服务
      // 为了演示，返回一个简单的响应
      res.json({
        success: true,
        data: {
          sessionId: req.params.sessionId,
          messages: [],
          total: 0,
          timestamp: new Date().toISOString()
        },
        message: '获取历史记录成功'
      });
    } catch (error) {
      next(error);
    }
  },
  // 错误处理
  optimizedErrorMiddleware
);

/**
 * 健康检查接口
 * GET /api/chat/health
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    performance: performanceOptimizer.getMetrics(),
    errorHandling: optimizedErrorHandler.getStats()
  };

  res.json(health);
});

/**
 * 性能指标接口
 * GET /api/chat/metrics
 */
router.get('/metrics',
  // 速率限制
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10, // 指标查询限制严格
    message: {
      success: false,
      error: {
        code: 'METRICS_RATE_LIMIT_EXCEEDED',
        message: '指标查询请求过于频繁，请稍后重试',
        timestamp: new Date().toISOString()
      }
    }
  }),
  (req, res) => {
    const metrics = {
      performance: performanceOptimizer.getMetrics(),
      errorHandling: optimizedErrorHandler.getStats(),
      controller: optimizedChatController.getPerformanceStats(),
      timestamp: new Date().toISOString()
    };

    res.json(metrics);
  }
);

/**
 * 错误测试接口（仅开发环境）
 * POST /api/chat/test-error
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test-error', (req, res, next) => {
    const { errorType, message } = req.body;

    let testError: Error;

    switch (errorType) {
      case 'validation':
        testError = new Error(message || '测试验证错误');
        (testError as any).code = 'VALIDATION_ERROR';
        break;
      case 'network':
        testError = new Error(message || '测试网络错误');
        (testError as any).code = 'NETWORK_ERROR';
        break;
      case 'external':
        testError = new Error(message || '测试外部服务错误');
        (testError as any).code = 'EXTERNAL_SERVICE_ERROR';
        break;
      case 'system':
        testError = new Error(message || '测试系统错误');
        (testError as any).code = 'SYSTEM_ERROR';
        break;
      default:
        testError = new Error(message || '测试未知错误');
        (testError as any).code = 'UNKNOWN_ERROR';
    }

    next(testError);
  }, optimizedErrorMiddleware);
}

export default router;