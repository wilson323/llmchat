/**
 * 高性能Redis消息队列管理器
 * 支持优先级队列、延迟任务、重试机制、死信队列等高级特性
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import {
  QueueConfig,
  QueueStats,
  QueueJob,
  QueueOptions,
  QueueStatus,
  JobStatus,
  MessagePriority,
  BackoffStrategy,
  QueueProcessor,
  QueueMiddleware,
  QueueEvent,
  QueueManagerConfig,
  QueueType,
  JobType,
  QueueMessage
} from '@/types/queue';

export class QueueManager extends EventEmitter {
  private static instance: QueueManager | null = null;
  private redis: Redis;
  private subscriber: Redis;
  private config: QueueManagerConfig;
  private queues: Map<string, QueueConfig> = new Map();
  private processors: Map<string, QueueProcessor> = new Map();
  private middleware: Map<string, QueueMiddleware[]> = new Map();
  private workers: Map<string, NodeJS.Timeout[]> = new Map();
  private processing: Map<string, Set<string>> = new Map();
  private stats: Map<string, QueueStats> = new Map();
  private isShuttingDown = false;

  private constructor(config: QueueManagerConfig) {
    super();
    this.config = config;

    // 创建Redis连接
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'queue:',
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    // 创建订阅连接
    this.subscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'queue:',
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.setupEventListeners();
    this.initializeDefaultQueues();
  }

  public static getInstance(config?: QueueManagerConfig): QueueManager {
    if (!QueueManager.instance) {
      if (!config) {
        throw new Error('QueueManager config is required for first initialization');
      }
      QueueManager.instance = new QueueManager(config);
    }
    return QueueManager.instance;
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('QueueManager: Redis connected');
    });

    this.redis.on('error', (error) => {
      logger.error('QueueManager: Redis error:', error);
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleQueueEvent(channel, message);
    });
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
        backoff: options.backoff || { strategy: BackoffStrategy.EXPONENTIAL, delay: queue.retryDelay },
        metadata: options.metadata || {},
        deadLetterQueue: options.deadLetterQueue || queue.deadLetterQueue
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
      metadata: job.opts.metadata
    };

    // 存储任务数据
    await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

    // 根据延迟时间决定队列
    if (job.opts.delay! > 0) {
      const scheduledAt = new Date(Date.now() + job.opts.delay!);
      message.scheduledAt = scheduledAt;
      await this.redis.zadd(`${queueName}:delayed`, scheduledAt.getTime(), jobId);
      await this.redis.hset(`${queueName}:delayed:meta`, jobId, JSON.stringify(message));
    } else {
      await this.redis.zadd(`${queueName}:waiting`,
        this.getScore(job.opts.priority!, job.createdAt), jobId);
      await this.redis.hset(`${queueName}:waiting:meta`, jobId, JSON.stringify(message));
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
    const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
    if (!jobData) {
      return null;
    }

    try {
      return JSON.parse(jobData);
    } catch (error) {
      logger.error(`QueueManager: Failed to parse job ${jobId}:`, error);
      return null;
    }
  }

  public async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    // 从所有可能的队列中移除
    const pipelines = [
      this.redis.zrem(`${queueName}:waiting`, jobId),
      this.redis.zrem(`${queueName}:active`, jobId),
      this.redis.zrem(`${queueName}:delayed`, jobId),
      this.redis.zrem(`${queueName}:completed`, jobId),
      this.redis.zrem(`${queueName}:failed`, jobId),
      this.redis.hdel(`${queueName}:jobs`, jobId),
      this.redis.hdel(`${queueName}:waiting:meta`, jobId),
      this.redis.hdel(`${queueName}:active:meta`, jobId),
      this.redis.hdel(`${queueName}:delayed:meta`, jobId),
      this.redis.hdel(`${queueName}:completed:meta`, jobId),
      this.redis.hdel(`${queueName}:failed:meta`, jobId)
    ];

    await Promise.all(pipelines);

    // 更新统计
    await this.updateQueueStats(queueName);

    logger.debug(`QueueManager: Removed job ${jobId} from queue ${queueName}`);
    return true;
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

    await this.redis.hset(`${queueName}:config`, 'paused', 'true');

    // 发布事件
    await this.publishQueueEvent(queueName, {
      type: 'queue:paused',
      jobId: '',
      queueName,
      timestamp: new Date()
    });

    logger.info(`QueueManager: Paused queue ${queueName}`);
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

    await this.redis.hset(`${queueName}:config`, 'paused', 'false');

    // 发布事件
    await this.publishQueueEvent(queueName, {
      type: 'queue:resumed',
      jobId: '',
      queueName,
      timestamp: new Date()
    });

    logger.info(`QueueManager: Resumed queue ${queueName}`);
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

    const jobIds = await this.redis.zrevrange(key, 0, limit - 1);
    const jobsData = await this.redis.hmget(`${queueName}:jobs`, ...jobIds);

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

    // 移动到等待队列
    await this.redis.zrem(`${queueName}:failed`, jobId);
    await this.redis.zadd(`${queueName}:waiting`,
      this.getScore(job.opts.priority!, job.createdAt), jobId);
    await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

    // 更新消息元数据
    const message = await this.redis.hget(`${queueName}:failed:meta`, jobId);
    if (message) {
      await this.redis.hdel(`${queueName}:failed:meta`, jobId);
      await this.redis.hset(`${queueName}:waiting:meta`, jobId, message);
    }

    logger.info(`QueueManager: Retried job ${jobId} in queue ${queueName}`);
    return true;
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

    // 获取下一个任务
    const jobIds = await this.redis.zrange(`${queueName}:waiting`, 0, 0);
    if (jobIds.length === 0) {
      return;
    }

    const jobId = jobIds[0];

    // 原子性地移动任务到活动队列
    const removeResult = await this.redis.zrem(`${queueName}:waiting`, jobId);
    if (removeResult === 0) {
      return; // 任务已被其他处理器获取
    }

    processing.add(jobId);

    // 移动到活动队列
    await this.redis.zadd(`${queueName}:active`, Date.now(), jobId);

    // 更新任务状态
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      processing.delete(jobId);
      return;
    }

    job.processedOn = new Date();
    job.attemptsMade++;
    await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

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

      // 更新任务状态
      job.finishedOn = new Date();
      job.returnvalue = result;
      await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

      // 移动到完成队列
      await this.redis.zrem(`${queueName}:active`, job.id);
      await this.redis.zadd(`${queueName}:completed`, Date.now(), job.id);

      // 清理策略
      if (job.opts.removeOnComplete) {
        await this.redis.zremrangebyscore(`${queueName}:completed`, 0, Date.now() - queue.removeOnComplete * 1000);
        await this.redis.hdel(`${queueName}:jobs`, job.id);
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

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const err = error as Error;

      // 更新任务状态
      job.failedAt = new Date();
      job.failedReason = err.message;
      await this.redis.hset(`${queueName}:jobs`, job.id, JSON.stringify(job));

      // 检查是否需要重试
      if (job.attemptsMade < job.opts.attempts!) {
        // 计算重试延迟
        const retryDelay = this.calculateRetryDelay(job.attemptsMade, job.opts.backoff!);

        // 移动到延迟队列
        await this.redis.zrem(`${queueName}:active`, job.id);
        const retryAt = Date.now() + retryDelay;
        await this.redis.zadd(`${queueName}:delayed`, retryAt, job.id);

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
        await this.redis.zrem(`${queueName}:active`, job.id);
        await this.redis.zadd(`${queueName}:failed`, Date.now(), job.id);

        // 检查死信队列
        if (job.opts.deadLetterQueue) {
          await this.redis.zadd(job.opts.deadLetterQueue, Date.now(), job.id);
        }

        // 清理策略
        if (job.opts.removeOnFail) {
          await this.redis.zremrangebyscore(`${queueName}:failed`, 0, Date.now() - queue.removeOnFail * 1000);
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
    }
  }

  private async processDelayedJobs(queueName: string): Promise<void> {
    const now = Date.now();

    // 获取到期的延迟任务
    const jobIds = await this.redis.zrangebyscore(`${queueName}:delayed`, 0, now);

    for (const jobId of jobIds) {
      // 检查是否已被处理
      const exists = await this.redis.zscore(`${queueName}:delayed`, jobId);
      if (!exists) {
        continue;
      }

      // 移动到等待队列
      const removeResult = await this.redis.zrem(`${queueName}:delayed`, jobId);
      if (removeResult === 0) {
        continue;
      }

      // 获取任务信息
      const job = await this.getJob(queueName, jobId);
      if (!job) {
        continue;
      }

      // 移动到等待队列
      await this.redis.zadd(`${queueName}:waiting`,
        this.getScore(job.opts.priority!, job.createdAt), jobId);

      // 更新统计
      const stats = this.stats.get(queueName)!;
      stats.delayed--;
      stats.waiting++;

      logger.debug(`QueueManager: Moved delayed job ${jobId} to waiting queue`);
    }
  }

  private async updateQueueStats(queueName: string): Promise<void> {
    const stats = this.stats.get(queueName);
    if (!stats) {
      return;
    }

    // 实时计数
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.redis.zcard(`${queueName}:waiting`),
      this.redis.zcard(`${queueName}:active`),
      this.redis.zcard(`${queueName}:completed`),
      this.redis.zcard(`${queueName}:failed`),
      this.redis.zcard(`${queueName}:delayed`)
    ]);

    stats.waiting = waiting;
    stats.active = active;
    stats.completed = completed;
    stats.failed = failed;
    stats.delayed = delayed;
    stats.processing = this.processing.get(queueName)?.size || 0;
  }

  private getScore(priority: MessagePriority, createdAt: Date): number {
    // 优先级越高，分数越小（优先处理）
    // 分数 = (最大优先级 - 当前优先级) * 时间戳权重 + 时间戳
    const maxPriority = 20; // MessagePriority.CRITICAL
    const priorityWeight = 1000000000000; // 1天的时间戳权重
    const timestamp = createdAt.getTime();

    return (maxPriority - priority) * priorityWeight + timestamp;
  }

  private calculateRetryDelay(attempt: number, backoff: any): number {
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

    await this.redis.publish(`queue:${queueName}:events`, JSON.stringify(fullEvent));
  }

  private handleQueueEvent(channel: string, message: string): void {
    try {
      const event = JSON.parse(message);
      this.emit(channel, event);
    } catch (error) {
      logger.error('QueueManager: Failed to parse queue event:', error);
    }
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

    // 关闭Redis连接
    await Promise.all([
      this.redis.quit(),
      this.subscriber.quit()
    ]);

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
}

export default QueueManager;