/**
 * 高性能Redis消息队列管理器
 * 支持优先级队列、延迟任务、重试机制、死信队列等高级特性
 * 集成Redis连接池优化性能
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import RedisConnectionPool from '@/utils/redisConnectionPool';
import BatchOperationService from '@/services/BatchOperationService';
import MemoryOptimizationService from '@/services/MemoryOptimizationService';
import type {
  QueueConfig,
  QueueStats,
  QueueJob,
  QueueOptions,
  QueueProcessor,
  QueueMiddleware,
  QueueEvent,
  QueueManagerConfig,
  QueueMessage
} from '@/types/queue';
import {
  QueueStatus,
  JobStatus,
  MessagePriority,
  BackoffStrategy,
  QueueType,
  JobType
} from '@/types/queue';

export class QueueManager extends EventEmitter {
  private static instance: QueueManager | null = null;
  private readonly redis!: Redis;
  private readonly subscriber!: Redis;
  private readonly config: QueueManagerConfig;
  private readonly queues: Map<string, QueueConfig> = new Map();
  private readonly processors: Map<string, QueueProcessor> = new Map();
  private readonly middleware: Map<string, QueueMiddleware[]> = new Map();
  private readonly workers: Map<string, NodeJS.Timeout[]> = new Map();
  private readonly processing: Map<string, Set<string>> = new Map();
  private readonly stats: Map<string, QueueStats> = new Map();
  private isShuttingDown = false;

  // 连接池
  private readonly connectionPool!: RedisConnectionPool;
  private connectionPoolStatsInterval?: NodeJS.Timeout;

  // 批量操作服务
  private readonly batchOperationService!: BatchOperationService;

  // 内存优化服务
  private readonly memoryOptimizationService!: MemoryOptimizationService;
  private readonly memoryMonitoringEnabled: boolean;

  private constructor(config: QueueManagerConfig) {
    super();
    this.config = config;

    // 创建Redis连接池
    this.connectionPool = new RedisConnectionPool({
      host: config.redis.host,
      port: config.redis.port,
      ...(config.redis.password && { password: config.redis.password }),
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'queue:',
      maxConnections: 20,
      minConnections: 5,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 60000,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    // 创建专用订阅连接（不使用连接池）
    this.subscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      ...(config.redis.password && { password: config.redis.password }),
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'queue:',
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    // 初始化批量操作服务
    this.batchOperationService = new BatchOperationService(this.connectionPool, {
      batchSize: config.batchSize || 100,
      enablePipelining: config.enablePipelining ?? true,
      enableTransactions: config.enableTransactions ?? false
    });

    // 初始化内存优化服务
    this.memoryMonitoringEnabled = config.memoryOptimization?.enabled ?? true;
    if (this.memoryMonitoringEnabled) {
      this.memoryOptimizationService = new MemoryOptimizationService({
        monitoringEnabled: true,
        autoOptimizationEnabled: config.memoryOptimization?.autoOptimization ?? true,
        optimizationThreshold: config.memoryOptimization?.threshold ?? 75,
        monitoringIntervalMs: config.memoryOptimization?.intervalMs ?? 30000,
        maxHeapSizeMB: config.memoryOptimization?.maxHeapSizeMB ?? 1024,
        maxRSSSizeMB: config.memoryOptimization?.maxRSSSizeMB ?? 2048
      });

      // 设置连接池引用
      this.memoryOptimizationService.setConnectionPool(this.connectionPool);

      // 设置内存监控事件监听
      this.setupMemoryOptimizationListeners();
    }

    this.setupEventListeners();
    this.initializeDefaultQueues();
    this.startConnectionPoolStatsMonitoring();

    // 启动内存优化服务
    if (this.memoryMonitoringEnabled && this.memoryOptimizationService) {
      this.memoryOptimizationService.start();
      logger.info('QueueManager: Memory optimization service started');
    }
  }

  public static getInstance(config?: QueueManagerConfig): QueueManager {
    if (!QueueManager.instance) {
      // 如果没有提供配置，使用默认配置
      if (!config) {
        config = QueueManager.createDefaultConfig();
      }
      QueueManager.instance = new QueueManager(config);
    }
    return QueueManager.instance;
  }

  private static createDefaultConfig(): QueueManagerConfig {
    return {
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '3019'),
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: parseInt(process.env.REDIS_DB ?? '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'llmchat:queue:'
      },
      defaultConcurrency: 5,
      stalledInterval: 30000,
      maxStalledCount: 3,
      enableMetrics: true,
      enableEvents: true,
      metricsInterval: 60000,
      memoryOptimization: {
        enabled: true,
        autoOptimization: true,
        threshold: 75,
        intervalMs: 30000,
        maxHeapSizeMB: 1024,
        maxRSSSizeMB: 2048
      }
    };
  }

  private setupEventListeners(): void {
    // 监听连接池事件
    this.connectionPool.on('connection:created', () => {
      logger.debug('QueueManager: New connection created in pool');
    });

    this.connectionPool.on('connection:error', (connection, error) => {
      logger.error('QueueManager: Connection pool error:', error);
    });

    this.connectionPool.on('connection:closed', () => {
      logger.debug('QueueManager: Connection closed in pool');
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleQueueEvent(channel, message);
    });
  }

  /**
   * 设置内存优化监听器
   */
  private setupMemoryOptimizationListeners(): void {
    if (!this.memoryOptimizationService) {
      return;
    }

    // 监听内存告警
    this.memoryOptimizationService.on('alert:memory-threshold', (data) => {
      logger.warn('QueueManager: Memory threshold alert', data);
      this.emit('memory:alert', data);
    });

    // 监听内存快速增长
    this.memoryOptimizationService.on('alert:rapid-growth', (data) => {
      logger.warn('QueueManager: Rapid memory growth detected', data);
      this.emit('memory:rapid-growth', data);
    });

    // 监听内存泄漏
    this.memoryOptimizationService.on('alert:memory-leak', (data) => {
      logger.error('QueueManager: Memory leak detected', data);
      this.emit('memory:leak', data);
    });

    // 监听优化完成
    this.memoryOptimizationService.on('optimization:completed', (data) => {
      logger.info('QueueManager: Memory optimization completed', {
        reason: data.reason,
        freedMemory: data.report.freedMemoryMB,
        duration: data.report.durationMs
      });
      this.emit('memory:optimization:completed', data);
    });

    // 监听优化失败
    this.memoryOptimizationService.on('optimization:failed', (data) => {
      logger.error('QueueManager: Memory optimization failed', {
        reason: data.reason,
        error: data.error,
        duration: data.duration
      });
      this.emit('memory:optimization:failed', data);
    });

    // 监听服务状态变化
    this.memoryOptimizationService.on('service:started', () => {
      logger.info('QueueManager: Memory optimization service started');
      this.emit('memory:service:started');
    });

    this.memoryOptimizationService.on('service:stopped', () => {
      logger.info('QueueManager: Memory optimization service stopped');
      this.emit('memory:service:stopped');
    });
  }

  /**
   * 获取内存优化服务实例（提供给MonitoringService使用）
   */
  public getMemoryOptimizationService(): MemoryOptimizationService | undefined {
    return this.memoryOptimizationService;
  }

  private initializeDefaultQueues(): void {
    const defaultQueues = [
      {
        name: 'chat-processing',
        concurrency: 5,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        removeOnComplete: 100,
        removeOnFail: 50,
        defaultPriority: MessagePriority.NORMAL,
        stalledInterval: 30000,
        maxStalledCount: 3,
        delayOnFail: true
      },
      {
        name: 'email-notification',
        concurrency: 3,
        maxRetries: 5,
        retryDelay: 2000,
        backoffMultiplier: 2,
        removeOnComplete: 200,
        removeOnFail: 100,
        defaultPriority: MessagePriority.NORMAL,
        stalledInterval: 60000,
        maxStalledCount: 5,
        delayOnFail: true
      },
      {
        name: 'webhook-processing',
        concurrency: 8,
        maxRetries: 3,
        retryDelay: 500,
        backoffMultiplier: 1.5,
        removeOnComplete: 100,
        removeOnFail: 50,
        defaultPriority: MessagePriority.HIGH,
        stalledInterval: 30000,
        maxStalledCount: 2,
        delayOnFail: false
      }
    ];

    defaultQueues.forEach(queueConfig => {
      this.createQueue(queueConfig);
    });
  }

  public createQueue(config: QueueConfig): void {
    this.queues.set(config.name, config);
    this.processing.set(config.name, new Set());

    // 初始化队列统计
    this.stats.set(config.name, {
      name: config.name,
      status: QueueStatus.ACTIVE,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
      processing: 0,
      concurrency: config.concurrency,
      maxConcurrency: config.concurrency,
      throughput: 0,
      avgProcessingTime: 0,
      errorRate: 0,
      lastProcessedAt: undefined,
      createdAt: new Date()
    });

    // 启动队列处理器
    this.startQueueProcessor(config.name);

    logger.info(`QueueManager: Created queue ${config.name}`);
  }

  public async addJob<T = unknown>(
    queueName: string,
    jobType: string,
    data: T,
    options: QueueOptions = {}
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    const jobId = uuidv4();
    const job: QueueJob = {
      id: jobId,
      name: jobType,
      data: data as Record<string, unknown>,
      opts: {
        priority: options.priority || queue.defaultPriority,
        delay: options.delay || 0,
        attempts: options.attempts || queue.maxRetries,
        removeOnComplete: options.removeOnComplete ?? true,
        removeOnFail: options.removeOnFail ?? true,
        backoff: (options.backoff as any)?.strategy || BackoffStrategy.EXPONENTIAL,
        metadata: options.metadata || {},
        deadLetterQueue: options.deadLetterQueue || queue.deadLetterQueue || ''
      },
      createdAt: new Date(),
      attemptsMade: 0
    };

    const message: QueueMessage = {
      id: jobId,
      type: jobType,
      payload: data as Record<string, unknown>,
      priority: job.opts.priority!,
      attempts: 0,
      maxAttempts: job.opts.attempts!,
      delay: job.opts.delay!,
      createdAt: job.createdAt,
      metadata: job.opts.metadata || {}
    };

    // 使用连接池存储任务数据
    const redis = await this.getRedisConnection();
    try {
      await redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

      // 根据延迟时间决定队列
      if (job.opts.delay! > 0) {
        const scheduledAt = new Date(Date.now() + job.opts.delay!);
        message.scheduledAt = scheduledAt;
        await redis.zadd(`${queueName}:delayed`, scheduledAt.getTime(), jobId);
        await redis.hset(`${queueName}:delayed:meta`, jobId, JSON.stringify(message));
      } else {
        await redis.zadd(`${queueName}:waiting`,
          this.getScore(job.opts.priority!, job.createdAt), jobId);
        await redis.hset(`${queueName}:waiting:meta`, jobId, JSON.stringify(message));
      }
    } finally {
      this.releaseRedisConnection(redis);
    }

    // 更新统计
    const stats = this.stats.get(queueName)!;
    stats.waiting++;

    // 发布事件
    await this.publishQueueEvent(queueName, {
      type: 'job:added',
      jobId,
      queueName,
      timestamp: new Date(),
      data: { jobType, priority: job.opts.priority }
    });

    logger.debug(`QueueManager: Added job ${jobId} to queue ${queueName}`);
    return jobId;
  }

  public async getJob(queueName: string, jobId: string): Promise<QueueJob | null> {
    const redis = await this.getRedisConnection();
    try {
      const jobData = await redis.hget(`${queueName}:jobs`, jobId);
      if (!jobData) {
        return null;
      }

      try {
        return JSON.parse(jobData);
      } catch (error) {
        logger.error(`QueueManager: Failed to parse job ${jobId}:`, error);
        return null;
      }
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  public async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    // 使用连接池从所有可能的队列中移除
    const redis = await this.getRedisConnection();
    try {
      const pipelines = [
        redis.zrem(`${queueName}:waiting`, jobId),
        redis.zrem(`${queueName}:active`, jobId),
        redis.zrem(`${queueName}:delayed`, jobId),
        redis.zrem(`${queueName}:completed`, jobId),
        redis.zrem(`${queueName}:failed`, jobId),
        redis.hdel(`${queueName}:jobs`, jobId),
        redis.hdel(`${queueName}:waiting:meta`, jobId),
        redis.hdel(`${queueName}:active:meta`, jobId),
        redis.hdel(`${queueName}:delayed:meta`, jobId),
        redis.hdel(`${queueName}:completed:meta`, jobId),
        redis.hdel(`${queueName}:failed:meta`, jobId)
      ];

      await Promise.all(pipelines);

      // 更新统计
      await this.updateQueueStats(queueName);

      logger.debug(`QueueManager: Removed job ${jobId} from queue ${queueName}`);
      return true;
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  public process(queueName: string, processor: QueueProcessor): void {
    this.processors.set(queueName, processor);
    logger.info(`QueueManager: Registered processor for queue ${queueName}`);
  }

  public use(queueName: string, middleware: QueueMiddleware): void {
    if (!this.middleware.has(queueName)) {
      this.middleware.set(queueName, []);
    }
    this.middleware.get(queueName)!.push(middleware);
    logger.info(`QueueManager: Added middleware ${middleware.name} to queue ${queueName}`);
  }

  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    // 停止处理器
    this.stopQueueProcessor(queueName);

    // 更新状态
    const stats = this.stats.get(queueName)!;
    stats.status = QueueStatus.PAUSED;
    stats.paused = true;

    // 使用连接池更新配置
    const redis = await this.getRedisConnection();
    try {
      await redis.hset(`${queueName}:config`, 'paused', 'true');

      // 发布事件
      await this.publishQueueEvent(queueName, {
        type: 'queue:paused',
        jobId: '',
        queueName,
        timestamp: new Date()
      });

      logger.info(`QueueManager: Paused queue ${queueName}`);
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    // 重启处理器
    this.startQueueProcessor(queueName);

    // 更新状态
    const stats = this.stats.get(queueName)!;
    stats.status = QueueStatus.ACTIVE;
    stats.paused = false;

    // 使用连接池更新配置
    const redis = await this.getRedisConnection();
    try {
      await redis.hset(`${queueName}:config`, 'paused', 'false');

      // 发布事件
      await this.publishQueueEvent(queueName, {
        type: 'queue:resumed',
        jobId: '',
        queueName,
        timestamp: new Date()
      });

      logger.info(`QueueManager: Resumed queue ${queueName}`);
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  public async getQueueStats(queueName: string): Promise<QueueStats | null> {
    const stats = this.stats.get(queueName);
    if (!stats) {
      return null;
    }

    // 实时更新计数
    await this.updateQueueStats(queueName);
    return this.stats.get(queueName)!;
  }

  public async getQueueJobs(queueName: string, status?: JobStatus, limit = 50): Promise<QueueJob[]> {
    let key: string;

    switch (status) {
      case JobStatus.WAITING:
        key = `${queueName}:waiting`;
        break;
      case JobStatus.ACTIVE:
        key = `${queueName}:active`;
        break;
      case JobStatus.COMPLETED:
        key = `${queueName}:completed`;
        break;
      case JobStatus.FAILED:
        key = `${queueName}:failed`;
        break;
      case JobStatus.DELAYED:
        key = `${queueName}:delayed`;
        break;
      default:
        // 返回所有状态的任务
        const allJobs: QueueJob[] = [];
        for (const s of [JobStatus.WAITING, JobStatus.ACTIVE, JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.DELAYED]) {
          const jobs = await this.getQueueJobs(queueName, s, limit);
          allJobs.push(...jobs);
        }
        return allJobs.slice(0, limit);
    }

    // 使用连接池获取任务数据
    const redis = await this.getRedisConnection();
    try {
      const jobIds = await redis.zrevrange(key, 0, limit - 1);
      const jobsData = await redis.hmget(`${queueName}:jobs`, ...jobIds);

      const jobs: QueueJob[] = [];
      for (const jobData of jobsData) {
        if (jobData) {
          try {
            jobs.push(JSON.parse(jobData));
          } catch (error) {
            logger.error(`QueueManager: Failed to parse job data:`, error);
          }
        }
      }

      return jobs;
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  public async retryJob(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return false;
    }

    // 重置任务状态
    job.attemptsMade = 0;
    delete job.failedAt;
    delete job.failedReason;
    delete job.processedOn;
    delete job.finishedOn;

    // 使用连接池移动到等待队列
    const redis = await this.getRedisConnection();
    try {
      await redis.zrem(`${queueName}:failed`, jobId);
      await redis.zadd(`${queueName}:waiting`,
        this.getScore(job.opts.priority!, job.createdAt), jobId);
      await redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

      // 更新消息元数据
      const message = await redis.hget(`${queueName}:failed:meta`, jobId);
      if (message) {
        await redis.hdel(`${queueName}:failed:meta`, jobId);
        await redis.hset(`${queueName}:waiting:meta`, jobId, message);
      }

      logger.info(`QueueManager: Retried job ${jobId} in queue ${queueName}`);
      return true;
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  // ==================== 批量操作方法 ====================

  /**
   * 批量添加任务
   */
  public async batchAddJobs(
    queueName: string,
    jobs: Array<{ type: string; data: unknown; options?: QueueOptions }>
  ): Promise<{
    successful: Array<{ id: string; index: number }>;
    failed: Array<{ index: number; error: string; data: unknown }>;
    total: number;
    duration: number;
  }> {
    const batchOperations = jobs.map(job => {
      const operation: {type: string; data: unknown; options?: QueueOptions} = {
        type: job.type,
        data: job.data
      };

      // 只有当options存在时才添加该属性
      if (job.options !== undefined) {
        operation.options = job.options;
      }

      return operation;
    });

    const result = await this.batchOperationService.batchAddJobs(queueName, batchOperations);

    // 更新队列统计
    for (const success of result.successful) {
      const stats = this.stats.get(queueName);
      if (stats) {
        stats.waiting++;
      }
    }

    // 发布批量操作事件
    await this.publishQueueEvent(queueName, {
      type: 'batch:added',
      jobId: '',
      queueName,
      timestamp: new Date(),
      data: {
        operation: 'add',
        successful: result.successful.length,
        failed: result.failed.length,
        duration: result.duration
      }
    });

    logger.info(`QueueManager: Batch added ${result.successful.length} jobs to queue ${queueName} in ${result.duration}ms`);

    return {
      successful: result.successful.map(s => ({ id: s.id!, index: s.index })),
      failed: result.failed,
      total: result.total,
      duration: result.duration
    };
  }

  /**
   * 批量删除任务
   */
  public async batchRemoveJobs(
    queueName: string,
    jobIds: string[]
  ): Promise<{
    successful: Array<{ id: string; index: number }>;
    failed: Array<{ index: number; error: string; data: unknown }>;
    total: number;
    duration: number;
  }> {
    const result = await this.batchOperationService.batchRemoveJobs(queueName, jobIds);

    // 更新队列统计
    await this.updateQueueStats(queueName);

    // 发布批量操作事件
    await this.publishQueueEvent(queueName, {
      type: 'batch:removed',
      jobId: '',
      queueName,
      timestamp: new Date(),
      data: {
        operation: 'remove',
        successful: result.successful.length,
        failed: result.failed.length,
        duration: result.duration
      }
    });

    logger.info(`QueueManager: Batch removed ${result.successful.length} jobs from queue ${queueName} in ${result.duration}ms`);

    return {
      successful: result.successful.map(s => ({ id: s.id!, index: s.index })),
      failed: result.failed,
      total: result.total,
      duration: result.duration
    };
  }

  /**
   * 批量重试任务
   */
  public async batchRetryJobs(
    queueName: string,
    jobIds: string[],
    options: { resetAttempts?: boolean } = {}
  ): Promise<{
    successful: Array<{ id: string; index: number }>;
    failed: Array<{ index: number; error: string; data: unknown }>;
    total: number;
    duration: number;
  }> {
    const result = await this.batchOperationService.batchRetryJobs(queueName, jobIds, options);

    // 更新队列统计
    await this.updateQueueStats(queueName);

    // 发布批量操作事件
    await this.publishQueueEvent(queueName, {
      type: 'batch:retried',
      jobId: '',
      queueName,
      timestamp: new Date(),
      data: {
        operation: 'retry',
        successful: result.successful.length,
        failed: result.failed.length,
        duration: result.duration,
        resetAttempts: options.resetAttempts
      }
    });

    logger.info(`QueueManager: Batch retried ${result.successful.length} jobs in queue ${queueName} in ${result.duration}ms`);

    return {
      successful: result.successful.map(s => ({ id: s.id!, index: s.index })),
      failed: result.failed,
      total: result.total,
      duration: result.duration
    };
  }

  /**
   * 批量获取队列统计
   */
  public async batchGetQueueStats(queueNames: string[]): Promise<Record<string, QueueStats>> {
    const batchStats = await this.batchOperationService.batchGetQueueStats(queueNames);

    const stats: Record<string, QueueStats> = {};

    for (const queueName of queueNames) {
      const queueStats = this.stats.get(queueName);
      if (queueStats) {
        stats[queueName] = {
          ...queueStats,
          ...batchStats[queueName],
          processing: this.processing.get(queueName)?.size || 0,
          throughput: queueStats.throughput,
          avgProcessingTime: queueStats.avgProcessingTime,
          errorRate: queueStats.errorRate,
          lastProcessedAt: queueStats.lastProcessedAt
        };
      }
    }

    return stats;
  }

  /**
   * 批量清理过期任务
   */
  public async batchCleanExpiredJobs(
    queueName: string,
    olderThanMs = 3600000, // 默认1小时
    batchSize = 1000
  ): Promise<number> {
    const cleanedCount = await this.batchOperationService.batchCleanCompletedJobs(queueName, olderThanMs, batchSize);

    // 更新队列统计
    await this.updateQueueStats(queueName);

    // 发布清理事件
    await this.publishQueueEvent(queueName, {
      type: 'batch:cleaned',
      jobId: '',
      queueName,
      timestamp: new Date(),
      data: {
        cleanedCount,
        olderThanMs,
        batchSize
      }
    });

    logger.info(`QueueManager: Batch cleaned ${cleanedCount} expired jobs from queue ${queueName}`);
    return cleanedCount;
  }

  /**
   * 获取批量操作配置
   */
  public getBatchOperationConfig(): {
    batchSize: number;
    enablePipelining: boolean;
    enableTransactions: boolean;
  } {
    return this.batchOperationService.getConfig();
  }

  /**
   * 更新批量操作配置
   */
  public updateBatchOperationConfig(config: {
    batchSize?: number;
    enablePipelining?: boolean;
    enableTransactions?: boolean;
  }): void {
    this.batchOperationService.updateConfig(config);
    logger.info('QueueManager: Batch operation configuration updated', config);
  }

  private startQueueProcessor(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return;
    }

    // 清理现有处理器
    this.stopQueueProcessor(queueName);

    // 创建新的处理器
    const workers: NodeJS.Timeout[] = [];

    for (let i = 0; i < queue.concurrency; i++) {
      const worker = setInterval(async () => {
        if (!this.isShuttingDown) {
          await this.processNextJob(queueName);
        }
      }, 100); // 每100ms检查一次新任务

      workers.push(worker);
    }

    this.workers.set(queueName, workers);

    // 定期处理延迟任务
    const delayedProcessor = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.processDelayedJobs(queueName);
      }
    }, 1000); // 每秒检查一次延迟任务

    workers.push(delayedProcessor);

    logger.debug(`QueueManager: Started ${queue.concurrency} workers for queue ${queueName}`);
  }

  private stopQueueProcessor(queueName: string): void {
    const workers = this.workers.get(queueName);
    if (workers) {
      workers.forEach(worker => clearInterval(worker));
      this.workers.delete(queueName);
    }
  }

  private async processNextJob(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    const processor = this.processors.get(queueName);

    if (!queue || !processor || this.isShuttingDown) {
      return;
    }

    const processing = this.processing.get(queueName)!;

    // 检查并发限制
    if (processing.size >= queue.concurrency) {
      return;
    }

    // 使用连接池获取下一个任务
    const redis = await this.getRedisConnection();
    try {
      const jobIds = await redis.zrange(`${queueName}:waiting`, 0, 0);
      if (jobIds.length === 0) {
        return;
      }

      const jobId = jobIds[0];

      // 验证jobId存在性
      if (!jobId) {
        return;
      }

      // 原子性地移动任务到活动队列
      const removeResult = await redis.zrem(`${queueName}:waiting`, jobId);
      if (removeResult === 0) {
        return; // 任务已被其他处理器获取
      }

      processing.add(jobId);

      // 移动到活动队列
      await redis.zadd(`${queueName}:active`, Date.now(), jobId);

      // 更新任务状态
      const job = await this.getJob(queueName, jobId);
      if (!job) {
        processing.delete(jobId);
        return;
      }

      job.processedOn = new Date();
      job.attemptsMade++;
      await redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

      // 更新统计
      const stats = this.stats.get(queueName)!;
      stats.waiting--;
      stats.active++;
      stats.processing++;

      // 发布事件
      await this.publishQueueEvent(queueName, {
        type: 'job:active',
        jobId,
        queueName,
        timestamp: new Date(),
        data: { jobName: job.name, attemptsMade: job.attemptsMade }
      });

      // 执行中间件和处理器
      this.executeJob(queueName, job, processor).finally(() => {
        processing.delete(jobId);
      });
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  private async executeJob(
    queueName: string,
    job: QueueJob,
    processor: QueueProcessor
  ): Promise<void> {
    const startTime = Date.now();
    const queue = this.queues.get(queueName)!;
    const middlewareList = this.middleware.get(queueName) || [];

    try {
      // 执行前置中间件
      for (const middleware of middlewareList) {
        if (middleware.beforeProcess) {
          await middleware.beforeProcess(job);
        }
      }

      // 执行处理器
      const result = await processor(job);

      // 计算处理时间
      const processingTime = Date.now() - startTime;

      // 使用连接池更新任务状态
      const redis = await this.getRedisConnection();
      try {
        job.finishedOn = new Date();
        job.returnvalue = result;
        await redis.hset(`${queueName}:jobs`, job.id, JSON.stringify(job));

        // 移动到完成队列
        await redis.zrem(`${queueName}:active`, job.id);
        await redis.zadd(`${queueName}:completed`, Date.now(), job.id);

        // 清理策略
        if (job.opts.removeOnComplete) {
          await redis.zremrangebyscore(`${queueName}:completed`, 0, Date.now() - queue.removeOnComplete * 1000);
          await redis.hdel(`${queueName}:jobs`, job.id);
        }

        // 执行后置中间件
        for (const middleware of middlewareList) {
          if (middleware.afterProcess) {
            await middleware.afterProcess(job, result);
          }
        }

        // 执行完成中间件
        for (const middleware of middlewareList) {
          if (middleware.onCompleted) {
            await middleware.onCompleted(job, result);
          }
        }

        // 更新统计
        const stats = this.stats.get(queueName)!;
        stats.active--;
        stats.completed++;
        stats.processing--;
        stats.throughput = this.calculateThroughput(stats);
        stats.avgProcessingTime = this.calculateAvgProcessingTime(stats, processingTime);
        stats.lastProcessedAt = new Date();

        // 发布事件
        await this.publishQueueEvent(queueName, {
          type: 'job:completed',
          jobId: job.id,
          queueName,
          timestamp: new Date(),
          data: { result, processingTime }
        });

        logger.debug(`QueueManager: Completed job ${job.id} in queue ${queueName} in ${processingTime}ms`);

      } finally {
        this.releaseRedisConnection(redis);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const err = error as Error;

      // 使用连接池处理错误情况
      const errorRedis = await this.getRedisConnection();
      try {
        // 更新任务状态
        job.failedAt = new Date();
        job.failedReason = err.message;
        await errorRedis.hset(`${queueName}:jobs`, job.id, JSON.stringify(job));

        // 检查是否需要重试
        if (job.attemptsMade < job.opts.attempts!) {
          // 计算重试延迟
          const retryDelay = this.calculateRetryDelay(job.attemptsMade, job.opts.backoff!);

          // 移动到延迟队列
          await errorRedis.zrem(`${queueName}:active`, job.id);
          const retryAt = Date.now() + retryDelay;
          await errorRedis.zadd(`${queueName}:delayed`, retryAt, job.id);

          // 发布重试事件
          await this.publishQueueEvent(queueName, {
            type: 'job:retry',
            jobId: job.id,
            queueName,
            timestamp: new Date(),
            data: { error: err.message, retryDelay, attempt: job.attemptsMade }
          });

          logger.warn(`QueueManager: Job ${job.id} failed, retrying in ${retryDelay}ms:`, err);

        } else {
          // 任务失败，移动到失败队列
          await errorRedis.zrem(`${queueName}:active`, job.id);
          await errorRedis.zadd(`${queueName}:failed`, Date.now(), job.id);

          // 检查死信队列
          if (job.opts.deadLetterQueue) {
            await errorRedis.zadd(job.opts.deadLetterQueue, Date.now(), job.id);
          }

          // 清理策略
          if (job.opts.removeOnFail) {
            await errorRedis.zremrangebyscore(`${queueName}:failed`, 0, Date.now() - queue.removeOnFail * 1000);
          }

          // 执行错误中间件
          for (const middleware of middlewareList) {
            if (middleware.onError) {
              await middleware.onError(job, err);
            }
          }

          // 执行失败中间件
          for (const middleware of middlewareList) {
            if (middleware.onFailed) {
              await middleware.onFailed(job, err);
            }
          }

          // 更新统计
          const stats = this.stats.get(queueName)!;
          stats.active--;
          stats.failed++;
          stats.processing--;
          stats.errorRate = this.calculateErrorRate(stats);

          // 发布事件
          await this.publishQueueEvent(queueName, {
            type: 'job:failed',
            jobId: job.id,
            queueName,
            timestamp: new Date(),
            data: { error: err.message, attemptsMade: job.attemptsMade }
          });

          logger.error(`QueueManager: Job ${job.id} failed permanently:`, err);
        }
      } finally {
        this.releaseRedisConnection(errorRedis);
      }
    }
  }

  private async processDelayedJobs(queueName: string): Promise<void> {
    const now = Date.now();

    // 使用连接池获取到期的延迟任务
    const redis = await this.getRedisConnection();
    try {
      const jobIds = await redis.zrangebyscore(`${queueName}:delayed`, 0, now);

      for (const jobId of jobIds) {
        // 检查是否已被处理
        const exists = await redis.zscore(`${queueName}:delayed`, jobId);
        if (!exists) {
          continue;
        }

        // 移动到等待队列
        const removeResult = await redis.zrem(`${queueName}:delayed`, jobId);
      if (removeResult === 0) {
        continue;
      }

      // 获取任务信息
        const job = await this.getJob(queueName, jobId);
        if (!job) {
          continue;
        }

        // 移动到等待队列
        await redis.zadd(`${queueName}:waiting`,
          this.getScore(job.opts.priority!, job.createdAt), jobId);

        // 更新统计
        const stats = this.stats.get(queueName)!;
        stats.delayed--;
        stats.waiting++;

        logger.debug(`QueueManager: Moved delayed job ${jobId} to waiting queue`);
      }
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  private async updateQueueStats(queueName: string): Promise<void> {
    const stats = this.stats.get(queueName);
    if (!stats) {
      return;
    }

    // 使用连接池进行实时计数
    const redis = await this.getRedisConnection();
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        redis.zcard(`${queueName}:waiting`),
        redis.zcard(`${queueName}:active`),
        redis.zcard(`${queueName}:completed`),
        redis.zcard(`${queueName}:failed`),
        redis.zcard(`${queueName}:delayed`)
      ]);

      stats.waiting = waiting;
      stats.active = active;
      stats.completed = completed;
      stats.failed = failed;
      stats.delayed = delayed;
      stats.processing = this.processing.get(queueName)?.size || 0;
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  private getScore(priority: MessagePriority, createdAt: Date): number {
    // 优先级越高，分数越小（优先处理）
    // 分数 = (最大优先级 - 当前优先级) * 时间戳权重 + 时间戳
    const maxPriority = 20; // MessagePriority.CRITICAL
    const priorityWeight = 1000000000000; // 1天的时间戳权重
    const timestamp = createdAt.getTime();

    return (maxPriority - priority) * priorityWeight + timestamp;
  }

  private calculateRetryDelay(attempt: number, backoff: {strategy: string; baseDelay?: number; maxDelay?: number; factor?: number}): number {
    switch (backoff.strategy) {
      case BackoffStrategy.FIXED:
        return backoff.delay;

      case BackoffStrategy.LINEAR:
        return backoff.delay * attempt;

      case BackoffStrategy.EXPONENTIAL:
        return Math.min(
          backoff.delay * Math.pow(backoff.multiplier || 2, attempt - 1),
          backoff.maxDelay || 30000
        );

      case BackoffStrategy.CUSTOM:
        return backoff.customFn ? backoff.customFn(attempt, new Error('Retry')) : backoff.delay;

      default:
        return backoff.delay;
    }
  }

  private calculateThroughput(stats: QueueStats): number {
    // 简单的吞吐量计算（每分钟完成任务数）
    const oneMinuteAgo = Date.now() - 60000;
    // 这里需要更复杂的实现，暂时返回0
    return 0;
  }

  private calculateAvgProcessingTime(stats: QueueStats, currentProcessingTime: number): number {
    // 简单的移动平均
    return stats.avgProcessingTime * 0.9 + currentProcessingTime * 0.1;
  }

  private calculateErrorRate(stats: QueueStats): number {
    const total = stats.completed + stats.failed;
    return total > 0 ? (stats.failed / total) * 100 : 0;
  }

  private async publishQueueEvent(queueName: string, event: Omit<QueueEvent, 'type'> & { type: string }): Promise<void> {
    if (!this.config.enableEvents) {
      return;
    }

    const fullEvent: QueueEvent = {
      type: event.type as any,
      jobId: event.jobId,
      queueName,
      timestamp: event.timestamp,
      data: event.data || {}
    };

    // 使用连接池发布事件
    const redis = await this.getRedisConnection();
    try {
      await redis.publish(`queue:${queueName}:events`, JSON.stringify(fullEvent));
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  private handleQueueEvent(channel: string, message: string): void {
    try {
      const event = JSON.parse(message);
      this.emit(channel, event);
    } catch (error) {
      logger.error('QueueManager: Failed to parse queue event:', error);
    }
  }

  /**
   * 启动连接池统计监控
   */
  private startConnectionPoolStatsMonitoring(): void {
    this.connectionPoolStatsInterval = setInterval(() => {
      const stats = this.connectionPool.getStats();
      logger.debug('RedisConnectionPool stats:', {
        total: stats.total,
        active: stats.active,
        idle: stats.idle,
        waiting: stats.waiting,
        errors: stats.errors,
        avgResponseTime: stats.avgResponseTime.toFixed(2) + 'ms'
      });
    }, 30000); // 每30秒记录一次统计
  }

  /**
   * 获取连接池统计信息
   */
  public getConnectionPoolStats(): Record<string, unknown> {
    const stats = this.connectionPool.getStats();
    return {
      pool: {
        totalConnections: stats.total,
        activeConnections: stats.active,
        idleConnections: stats.idle,
        waitingRequests: stats.waiting,
        totalErrors: stats.errors,
        averageResponseTime: stats.avgResponseTime,
        lastError: stats.lastError,
        lastUsed: stats.lastUsed
      },
      health: {
        status: 'healthy',
        message: 'Connection pool operating normally'
      }
    };
  }

  /**
   * 获取Redis连接
   */
  private async getRedisConnection(): Promise<Redis> {
    return await this.connectionPool.acquire();
  }

  /**
   * 释放Redis连接
   */
  private releaseRedisConnection(connection: Redis): void {
    this.connectionPool.release(connection);
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('QueueManager: Shutting down...');

    // 停止所有处理器
    for (const queueName of this.queues.keys()) {
      this.stopQueueProcessor(queueName);
    }

    // 停止连接池统计监控
    if (this.connectionPoolStatsInterval) {
      clearInterval(this.connectionPoolStatsInterval);
    }

    // 关闭连接池
    await this.connectionPool.shutdown();

    // 关闭内存优化服务
    if (this.memoryOptimizationService) {
      this.memoryOptimizationService.shutdown();
    }

    // 关闭订阅连接
    await this.subscriber.quit();

    logger.info('QueueManager: Shutdown complete');
  }

  public async healthCheck(): Promise<{ healthy: boolean; queues: Record<string, any> }> {
    const queues: Record<string, any> = {};
    let healthy = true;

    for (const [queueName, config] of this.queues) {
      const stats = await this.getQueueStats(queueName);
      if (stats) {
        queues[queueName] = {
          status: stats.status,
          waiting: stats.waiting,
          active: stats.active,
          failed: stats.failed,
          errorRate: stats.errorRate.toFixed(2) + '%'
        };

        // 健康检查条件
        if (stats.errorRate > 50 || stats.waiting > 1000) {
          healthy = false;
        }
      }
    }

    return { healthy, queues };
  }

  /**
   * 手动执行内存优化
   */
  public async optimizeMemory(
    options: { aggressive?: boolean; reason?: string } = {}
  ): Promise<{
    success: boolean;
    freedMemoryMB?: number;
    durationMs?: number;
    error?: string;
    details?: Record<string, unknown>;
  }> {
    if (!this.memoryOptimizationService) {
      return {
        success: false,
        error: 'Memory optimization service is not enabled'
      };
    }

    try {
      const reason: 'manual' | 'scheduled' | 'emergency' | 'preventive' =
        (options.reason === 'scheduled' || options.reason === 'emergency' || options.reason === 'preventive')
          ? options.reason
          : 'manual';
      const report = await this.memoryOptimizationService.performOptimization(reason, {
        aggressive: options.aggressive ?? false,
        force: false
      });

      return {
        success: report.success,
        freedMemoryMB: report.freedMemoryMB,
        durationMs: report.durationMs,
        details: {
          method: report.method,
          optimizations: report.optimizations,
          beforeMemory: `${(report.beforeStats.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          afterMemory: `${(report.afterStats.heapUsed / 1024 / 1024).toFixed(2)}MB`
        }
      };
    } catch (error) {
      logger.error('QueueManager: Manual memory optimization failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取内存监控状态
   */
  public async getMemoryStatus(): Promise<{
    enabled: boolean;
    current?: {
      heapUsed: number;
      heapTotal: number;
      heapUsedPercentage: number;
      rssMB: number;
      timestamp: number;
    };
    optimization?: {
      totalOptimizations: number;
      successfulOptimizations: number;
      totalMemoryFreed: number;
      lastOptimizationTime: number;
      averageOptimizationTime: number;
    };
    health?: {
      healthy: boolean;
      issues: string[];
    };
    recommendations?: string[];
  }> {
    if (!this.memoryOptimizationService) {
      return {
        enabled: false
      };
    }

    const memoryReport = await this.memoryOptimizationService.getMemoryReport();
    const serviceStats = await this.memoryOptimizationService.getServiceStats();
    const healthCheck = await this.memoryOptimizationService.healthCheck();

    return {
      enabled: true,
      ...(memoryReport.current && {
        current: {
          heapUsed: memoryReport.current.heapUsed,
          heapTotal: memoryReport.current.heapTotal,
          heapUsedPercentage: memoryReport.current.heapUsedPercentage,
          rssMB: memoryReport.current.rssMB,
          timestamp: memoryReport.current.timestamp
        }
      }),
      optimization: {
        totalOptimizations: serviceStats.totalOptimizations,
        successfulOptimizations: serviceStats.successfulOptimizations,
        totalMemoryFreed: serviceStats.totalMemoryFreed,
        lastOptimizationTime: serviceStats.lastOptimizationTime,
        averageOptimizationTime: serviceStats.averageOptimizationTime
      },
      health: healthCheck,
      recommendations: memoryReport.recommendations
    };
  }

  /**
   * 获取内存优化历史
   */
  public getMemoryOptimizationHistory(count = 10): Array<{
    timestamp: number;
    method: string;
    freedMemoryMB: number;
    durationMs: number;
    success: boolean;
    optimizations: string[];
  }> {
    if (!this.memoryOptimizationService) {
      return [];
    }

    return this.memoryOptimizationService.getOptimizationHistory(count).map(report => ({
      timestamp: report.timestamp,
      method: report.method,
      freedMemoryMB: report.freedMemoryMB,
      durationMs: report.durationMs,
      success: report.success,
      optimizations: report.optimizations
    }));
  }

  /**
   * 更新内存优化配置
   */
  public updateMemoryOptimizationConfig(config: {
    autoOptimizationEnabled?: boolean;
    optimizationThreshold?: number;
    monitoringIntervalMs?: number;
    maxHeapSizeMB?: number;
    maxRSSSizeMB?: number;
  }): boolean {
    if (!this.memoryOptimizationService) {
      return false;
    }

    try {
      this.memoryOptimizationService.updateConfig(config);
      logger.info('QueueManager: Memory optimization configuration updated', config);
      return true;
    } catch (error) {
      logger.error('QueueManager: Failed to update memory optimization config', error);
      return false;
    }
  }

  /**
   * 创建内存使用快照
   */
  public createMemorySnapshot(): {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    queueStats?: {
      totalQueues: number;
      totalJobs: number;
      activeJobs: number;
    };
    connectionPoolStats?: {
      active: number;
      idle: number;
      total: number;
    };
  } | null {
    if (!this.memoryOptimizationService) {
      return null;
    }

    const snapshot = this.memoryOptimizationService.createUsageSnapshot();
    const connectionPoolStats = this.connectionPool.getStats();

    // 计算队列统计
    let totalJobs = 0;
    let activeJobs = 0;
    for (const [queueName, queueConfig] of this.queues.entries()) {
      const stats = this.stats.get(queueName);
      if (stats) {
        totalJobs += stats.waiting + stats.active + stats.completed + stats.failed;
        activeJobs += stats.active;
      }
    }

    return {
      timestamp: snapshot.timestamp,
      heapUsed: snapshot.heapUsed,
      heapTotal: snapshot.heapTotal,
      rss: snapshot.rss,
      queueStats: {
        totalQueues: this.queues.size,
        totalJobs,
        activeJobs
      },
      connectionPoolStats: {
        active: connectionPoolStats.active,
        idle: connectionPoolStats.idle,
        total: connectionPoolStats.active + connectionPoolStats.idle
      }
    };
  }

  
  /**
   * 获取Redis连接池实例
   */
  public getConnectionPool(): RedisConnectionPool {
    return this.connectionPool;
  }

  /**
   * 获取所有队列名称
   */
  public async getAllQueues(): Promise<string[]> {
    const redis = await this.getRedisConnection();
    try {
      const queues = await redis.smembers('queues');
      return queues || [];
    } finally {
      this.releaseRedisConnection(redis);
    }
  }

  
  /**
   * 清空队列
   */
  public async clearQueue(queueName: string): Promise<boolean> {
    try {
      const redis = await this.getRedisConnection();
      try {
        await redis.del(`${queueName}:waiting`);
        await redis.del(`${queueName}:active`);
        await redis.del(`${queueName}:completed`);
        await redis.del(`${queueName}:failed`);
        await redis.del(`${queueName}:delayed`);
        await redis.del(`${queueName}:jobs`);

        // 重置统计
        this.stats.delete(queueName);

        logger.info(`QueueManager: Queue ${queueName} cleared`);
        return true;
      } finally {
        this.releaseRedisConnection(redis);
      }
    } catch (error) {
      logger.error(`QueueManager: Failed to clear queue ${queueName}:`, error);
      return false;
    }
  }

  /**
   * 重试失败任务
   */
  public async retryFailedJobs(queueName: string, limit = 10): Promise<number> {
    try {
      const redis = await this.getRedisConnection();
      try {
        // 获取失败的任务
        const failedJobs = await redis.zrange(`${queueName}:failed`, 0, limit - 1);
        let retriedCount = 0;

        for (const jobId of failedJobs) {
          // 从失败队列移除
          await redis.zrem(`${queueName}:failed`, jobId);

          // 获取任务详情
          const jobData = await redis.hget(`${queueName}:jobs`, jobId);
          if (jobData) {
            const job = JSON.parse(jobData);

            // 重置任务状态
            job.attemptsMade = 0;
            job.failedAt = null;
            job.failedReason = null;

            // 重新添加到等待队列
            await redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));
            await redis.lpush(`${queueName}:waiting`, jobId);

            retriedCount++;
          }
        }

        logger.info(`QueueManager: Retried ${retriedCount} failed jobs in queue ${queueName}`);
        return retriedCount;
      } finally {
        this.releaseRedisConnection(redis);
      }
    } catch (error) {
      logger.error(`QueueManager: Failed to retry failed jobs in queue ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * 获取已完成的任务
   */
  public async getCompletedJobs(queueName: string, limit = 100): Promise<any[]> {
    try {
      const redis = await this.getRedisConnection();
      try {
        const completedJobs = await redis.zrevrange(`${queueName}:completed`, 0, limit - 1);
        const jobs = [];

        for (const jobId of completedJobs) {
          const jobData = await redis.hget(`${queueName}:jobs`, jobId);
          if (jobData) {
            const job = JSON.parse(jobData);
            jobs.push({
              id: job.id,
              type: job.type,
              data: job.data,
              finishedOn: job.finishedOn,
              processingTime: job.processingTime,
              attemptsMade: job.attemptsMade
            });
          }
        }

        return jobs;
      } finally {
        this.releaseRedisConnection(redis);
      }
    } catch (error) {
      logger.error(`QueueManager: Failed to get completed jobs from queue ${queueName}:`, error);
      return [];
    }
  }

  /**
   * 获取失败的任务
   */
  public async getFailedJobs(queueName: string, limit = 100): Promise<any[]> {
    try {
      const redis = await this.getRedisConnection();
      try {
        const failedJobs = await redis.zrevrange(`${queueName}:failed`, 0, limit - 1);
        const jobs = [];

        for (const jobId of failedJobs) {
          const jobData = await redis.hget(`${queueName}:jobs`, jobId);
          if (jobData) {
            const job = JSON.parse(jobData);
            jobs.push({
              id: job.id,
              type: job.type,
              data: job.data,
              failedAt: job.failedAt,
              failedReason: job.failedReason,
              attemptsMade: job.attemptsMade
            });
          }
        }

        return jobs;
      } finally {
        this.releaseRedisConnection(redis);
      }
    } catch (error) {
      logger.error(`QueueManager: Failed to get failed jobs from queue ${queueName}:`, error);
      return [];
    }
  }
}

export default QueueManager;