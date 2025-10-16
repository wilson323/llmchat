/**
 * 队列服务初始化
 * 在应用启动时初始化队列管理器和注册默认处理器
 */

import QueueManager from '@/services/QueueManager';
import logger from '@/utils/logger';
import { QueueProcessor, QueueMiddleware, JobType, MessagePriority } from '@/types/queue';

// 聊天消息处理器
const chatMessageProcessor: QueueProcessor = async (job) => {
  const { method, url, headers, body, query, params } = job.data as any;

  logger.info(`[QueueProcessor] Processing chat message: ${job.id}`, {
    method,
    url,
    body
  });

  // 模拟聊天消息处理
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // 返回处理结果
  return {
    success: true,
    message: 'Chat message processed successfully',
    data: {
      jobId: job.id,
      processedAt: new Date(),
      processingTime: Date.now() - job.createdAt.getTime()
    }
  };
};

// 邮件通知处理器
const emailNotificationProcessor: QueueProcessor = async (job) => {
  const { to, subject, template, data } = job.data as any;

  logger.info(`[QueueProcessor] Processing email notification: ${job.id}`, {
    to,
    subject,
    template
  });

  // 模拟邮件发送
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

  // 返回处理结果
  return {
    success: true,
    message: 'Email sent successfully',
    data: {
      jobId: job.id,
      to,
      subject,
      sentAt: new Date(),
      processingTime: Date.now() - job.createdAt.getTime()
    }
  };
};

// Webhook处理器
const webhookProcessor: QueueProcessor = async (job) => {
  const { url, method, headers, payload } = job.data as any;

  logger.info(`[QueueProcessor] Processing webhook: ${job.id}`, {
    url,
    method
  });

  // 模拟webhook调用
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));

  // 返回处理结果
  return {
    success: true,
    message: 'Webhook processed successfully',
    data: {
      jobId: job.id,
      url,
      method,
      processedAt: new Date(),
      processingTime: Date.now() - job.createdAt.getTime()
    }
  };
};

// 日志处理中间件
const loggingMiddleware: QueueMiddleware = {
  name: 'logging',
  beforeProcess: async (job) => {
    logger.info(`[QueueMiddleware] Starting job: ${job.id}`, {
      queue: job.opts.metadata?.queueName,
      type: job.name,
      attempts: job.attemptsMade
    });
  },
  afterProcess: async (job, result) => {
    logger.info(`[QueueMiddleware] Job completed: ${job.id}`, {
      queue: job.opts.metadata?.queueName,
      type: job.name,
      attempts: job.attemptsMade,
      result
    });
  },
  onError: async (job, error) => {
    logger.error(`[QueueMiddleware] Job error: ${job.id}`, {
      queue: job.opts.metadata?.queueName,
      type: job.name,
      attempts: job.attemptsMade,
      error: error.message
    });
  },
  onFailed: async (job, error) => {
    logger.error(`[QueueMiddleware] Job failed permanently: ${job.id}`, {
      queue: job.opts.metadata?.queueName,
      type: job.name,
      attemptsMade: job.attemptsMade,
      error: error.message
    });
  }
};

// 指标收集中间件
const metricsMiddleware: QueueMiddleware = {
  name: 'metrics',
  beforeProcess: async (job) => {
    // 记录开始时间
    job.opts.metadata = {
      ...job.opts.metadata,
      startTime: Date.now()
    };
  },
  afterProcess: async (job, result) => {
    // 计算处理时间
    const startTime = (job.opts.metadata?.startTime as number) || job.createdAt.getTime();
    const processingTime = Date.now() - startTime;

    // 这里可以发送指标到监控系统
    logger.debug(`[QueueMiddleware] Job metrics: ${job.id}`, {
      queue: job.opts.metadata?.queueName,
      type: job.name,
      processingTime,
      attempts: job.attemptsMade
    });
  }
};

/**
 * 初始化队列服务
 */
export async function initQueueService(): Promise<void> {
  try {
    // 获取Redis配置
    const redisConfig: {
      host: string;
      port: number;
      password?: string;
      db: number;
      keyPrefix: string;
    } = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '3019'),
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'llmchat:queue:'
    };

    // 只有在密码存在时才添加
    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    // 创建队列管理器配置
    const queueManagerConfig = {
      redis: redisConfig,
      defaultConcurrency: 5,
      stalledInterval: 30000,
      maxStalledCount: 3,
      enableMetrics: true,
      enableEvents: true,
      metricsInterval: 60000
    };

    // 初始化队列管理器
    const queueManager = QueueManager.getInstance(queueManagerConfig);

    // 注册队列处理器
    queueManager.process('chat-processing', chatMessageProcessor);
    queueManager.process('email-notification', emailNotificationProcessor);
    queueManager.process('webhook-processing', webhookProcessor);

    // 注册中间件
    queueManager.use('chat-processing', loggingMiddleware);
    queueManager.use('chat-processing', metricsMiddleware);
    queueManager.use('email-notification', loggingMiddleware);
    queueManager.use('email-notification', metricsMiddleware);
    queueManager.use('webhook-processing', loggingMiddleware);
    queueManager.use('webhook-processing', metricsMiddleware);

    // 测试队列连接
    await queueManager.healthCheck();

    logger.info('✅ Queue service initialized successfully');
    logger.info(`📊 Available queues: chat-processing, email-notification, webhook-processing`);

  } catch (error) {
    logger.warn('⚠️ 队列服务初始化失败，将以降级模式运行:', error);
    logger.info('📝 提示: 队列服务对核心功能不是必需的，应用可以正常运行');
    // 不抛出异常，允许应用继续启动
  }
}

/**
 * 关闭队列服务
 */
export async function shutdownQueueService(): Promise<void> {
  try {
    const queueManager = QueueManager.getInstance();
    await queueManager.shutdown();
    logger.info('✅ Queue service shutdown successfully');
  } catch (error) {
    logger.error('❌ Failed to shutdown queue service:', error);
    throw error;
  }
}

/**
 * 添加示例任务到队列
 */
export async function addSampleJobs(): Promise<void> {
  try {
    const queueManager = QueueManager.getInstance();

    // 添加聊天消息示例
    await queueManager.addJob('chat-processing', 'chat-message', {
      message: 'Hello, this is a sample chat message',
      userId: 'sample-user-123',
      sessionId: 'sample-session-456'
    }, {
      priority: MessagePriority.NORMAL,
      metadata: { sample: true }
    });

    // 添加邮件通知示例
    await queueManager.addJob('email-notification', 'email-send', {
      to: 'user@example.com',
      subject: 'Welcome to LLMChat',
      template: 'welcome',
      data: { name: 'John Doe' }
    }, {
      priority: MessagePriority.NORMAL,
      metadata: { sample: true }
    });

    // 添加webhook示例
    await queueManager.addJob('webhook-processing', 'webhook-call', {
      url: 'https://api.example.com/webhook',
      method: 'POST',
      payload: { event: 'user.registered', userId: '123' }
    }, {
      priority: MessagePriority.HIGH,
      metadata: { sample: true }
    });

    logger.info('✅ Sample jobs added to queues');

  } catch (error) {
    logger.error('❌ Failed to add sample jobs:', error);
    throw error;
  }
}

export default {
  initQueueService,
  shutdownQueueService,
  addSampleJobs
};