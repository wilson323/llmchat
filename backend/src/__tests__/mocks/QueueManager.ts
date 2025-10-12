/**
 * QueueManager Mock - 集成测试专用
 * 提供QueueManager的完整模拟实现
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  QueueJob,
  JobStatus as QueueJobStatus,
  QueueStats,
  MessagePriority,
  JOB_TYPES,
  QueueOptions,
  QueueConfig as QueueConfiguration
} from '../../types/queue';

// 简化的类型定义，用于测试
export interface QueueJobWithMetadata extends QueueJob {
  statusHistory: Array<{
    status: QueueJobStatus;
    timestamp: Date;
    message?: string;
  }>;
  completedAt?: Date;
  failedAt?: Date;
  lastError?: string;
  result?: unknown;
  attempts?: number;
  errorMessage?: string;
  maxAttempts?: number;
}

export interface QueueMetrics {
  queueName: string;
  timestamp: Date;
  totalJobs: number;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  redisMemoryUsage: number;
  oldestJobAge: number;
  configuration: QueueConfiguration;
}

export interface QueueHealthCheckResult {
  queueName: string;
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    queueSize: 'pass' | 'warn' | 'fail';
    processingTime: 'pass' | 'warn' | 'fail';
    errorRate: 'pass' | 'warn' | 'fail';
    memoryUsage: 'pass' | 'warn' | 'fail';
    redisConnection: 'pass' | 'warn' | 'fail';
    staleJobs: 'pass' | 'warn' | 'fail';
    deadlockDetection: 'pass' | 'warn' | 'fail';
  };
  metrics: QueueStats;
  lastCheck: Date;
  checkDuration: number;
}

export interface QueueAlert {
  id: string;
  queueName: string;
  type: 'queue_size' | 'error_rate' | 'processing_time' | 'memory_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface JobSearchOptions {
  status?: QueueJobStatus;
  type?: string;
  priority?: MessagePriority;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface JobSortOptions {
  field: 'createdAt' | 'priority' | 'status';
  order: 'asc' | 'desc';
}

export interface QueueAlertConfig {
  type: 'queue_size' | 'error_rate' | 'processing_time' | 'memory_usage';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface QueueEvent {
  type: string;
  queueName: string;
  jobId?: string;
  job?: QueueJob;
  oldStatus?: QueueJobStatus;
  newStatus?: QueueJobStatus;
  errorMessage?: string;
  result?: unknown;
  timestamp: Date;
}

export class MockQueueManager extends EventEmitter {
  private queues = new Map<string, QueueJob[]>();
  private jobs = new Map<string, QueueJobWithMetadata>();
  private configurations = new Map<string, QueueConfiguration>();
  private alertConfigs = new Map<string, QueueAlertConfig[]>();
  private metricsHistory: QueueMetrics[] = [];
  private isProcessing = false;
  private throttleTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.setupDefaultConfigurations();
  }

  /**
   * 添加作业到队列
   */
  public async addJob<T = unknown>(
    queueName: string,
    data: T,
    options: QueueOptions = {}
  ): Promise<string> {
    const jobId = uuidv4();
    const job: QueueJob = {
      id: jobId,
      name: `${queueName}-job`,
      data: data as Record<string, unknown>,
      opts: options,
      createdAt: new Date(),
      attemptsMade: 0
    };

    const jobWithMetadata: QueueJobWithMetadata = {
      ...job,
      statusHistory: [
        {
          status: QueueJobStatus.WAITING,
          timestamp: new Date(),
          message: 'Job created'
        }
      ]
    };

    // 存储作业
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queues.get(queueName)!.push(job);
    this.jobs.set(jobId, jobWithMetadata);

    // 更新作业状态为等待处理
    await this.updateJobStatus(jobId, QueueJobStatus.WAITING);

    // 触发事件
    this.emit('jobAdded', {
      type: 'jobAdded',
      queueName,
      jobId,
      job,
      timestamp: new Date()
    } as QueueEvent);

    // 如果没有延迟，尝试处理作业
    if (!options.delay) {
      setImmediate(() => this.processNextJob(queueName));
    }

    return jobId;
  }

  /**
   * 获取作业
   */
  public async getJob(jobId: string): Promise<QueueJobWithMetadata | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * 获取队列中的下一个作业
   */
  public async getNextJob(queueName: string): Promise<QueueJob | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return null;
    }

    // 找到下一个等待的作业
    const nextJob = queue.find(job =>
      job.name === JOB_TYPES.CHAT_MESSAGE && // 使用实际的状态字段
      (!job.opts?.delay || job.opts.delay <= 0)
    );

    return nextJob || null;
  }

  /**
   * 更新作业状态
   */
  public async updateJobStatus(
    jobId: string,
    status: QueueJobStatus,
    errorMessage?: string
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Store status in metadata for the mock
    if (!job.opts) job.opts = {};
    job.opts.metadata = { ...job.opts.metadata, status };
    job.statusHistory.push({
      status,
      timestamp: new Date(),
      message: errorMessage || `Status changed to ${status}`
    });

    // 更新队列中的作业
    const queueName = job.id.split('-')[0]; // 从jobId推断队列名
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (queue) {
        const queueJob = queue.find(j => j.id === jobId);
        if (queueJob) {
          // Store status in opts.metadata for the mock
          if (!queueJob.opts) queueJob.opts = {};
          queueJob.opts.metadata = { ...queueJob.opts.metadata, status };
        }
      }
    }

    // 触发事件
    this.emit('jobStatusUpdated', {
      type: 'jobStatusUpdated',
      queueName: queueName || 'unknown',
      jobId,
      // oldStatus removed,
      newStatus: status,
      errorMessage,
      timestamp: new Date()
    } as QueueEvent);
  }

  /**
   * 处理作业完成
   */
  public async completeJob(jobId: string, result?: unknown): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.completedAt = new Date();
    job.result = result;
    await this.updateJobStatus(jobId, QueueJobStatus.COMPLETED);

    const queueName = job.id.split('-')[0];
    // 触发事件
    this.emit('jobCompleted', {
      type: 'jobCompleted',
      queueName: queueName || 'unknown',
      jobId,
      result,
      timestamp: new Date()
    } as QueueEvent);

    // 处理下一个作业
    this.processNextJob(queueName || 'unknown');
  }

  /**
   * 处理作业失败
   */
  public async failJob(jobId: string, error: Error | string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.attempts = (job.attempts || 0) + 1;
    const errorMessage = typeof error === 'string' ? error : error.message;
    job.errorMessage = errorMessage;

    const queueName = job.id.split('-')[0];
    if (job.attempts >= (job.maxAttempts || 3)) {
      job.failedAt = new Date();
      await this.updateJobStatus(jobId, QueueJobStatus.FAILED, errorMessage);

      // 触发事件
      this.emit('jobFailed', {
        type: 'jobFailed',
        queueName: queueName || 'unknown',
        jobId,
        error: errorMessage,
        attempts: job.attempts,
        timestamp: new Date()
      } as QueueEvent);
    } else {
      await this.updateJobStatus(jobId, QueueJobStatus.WAITING, errorMessage);

      // 延迟重试
      setTimeout(() => {
        this.processNextJob(queueName || 'unknown');
      }, Math.min(1000 * Math.pow(2, job.attempts), 30000)); // 指数退避
    }

    // 处理下一个作业
    this.processNextJob(queueName || 'unknown');
  }

  /**
   * 获取队列统计
   */
  public async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.queues.get(queueName) || [];

    const stats: QueueStats = {
      name: queueName,
      status: 'active' as any, // Simplified for mock
      waiting: queue.filter(job => !job.processedOn && !job.finishedOn && !job.failedAt).length,
      active: queue.filter(job => job.processedOn && !job.finishedOn && !job.failedAt).length,
      completed: queue.filter(job => job.finishedOn && !job.failedAt).length,
      failed: queue.filter(job => job.failedAt).length,
      delayed: 0, // Simplified for mock
      paused: false,
      processing: queue.filter(job => job.processedOn && !job.finishedOn && !job.failedAt).length,
      concurrency: 10,
      maxConcurrency: 10,
      throughput: 0,
      avgProcessingTime: 0,
      errorRate: 0,
      lastProcessedAt: undefined,
      createdAt: new Date()
    };

    return stats;
  }

  /**
   * 获取队列名称
   */
  public getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * 清空队列
   */
  public async clearQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName) || [];

    // 删除所有作业记录
    for (const job of queue) {
      this.jobs.delete(job.id);
    }

    // 清空队列
    this.queues.set(queueName, []);

    this.emit('queueCleared', {
      type: 'queueCleared',
      queueName,
      timestamp: new Date()
    } as QueueEvent);
  }

  /**
   * 释放资源
   */
  public async shutdown(): Promise<void> {
    // 清理定时器
    for (const timer of Array.from(this.throttleTimers.values())) {
      clearTimeout(timer);
    }
    this.throttleTimers.clear();

    this.emit('shutdown', {
      type: 'shutdown',
      timestamp: new Date()
    } as QueueEvent);

    this.removeAllListeners();
  }

  // 私有方法

  private setupDefaultConfigurations(): void {
    // 设置默认配置
    const defaultConfig: QueueConfiguration = {
      name: 'default',
      concurrency: 1,
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      removeOnComplete: 100,
      removeOnFail: 50,
      defaultPriority: MessagePriority.NORMAL,
      stalledInterval: 30000,
      maxStalledCount: 3,
      delayOnFail: true
    };

    this.configurations.set('default', defaultConfig);
  }

  private async processNextJob(queueName: string): Promise<void> {
    if (this.isProcessing) {
      return; // 防止并发处理
    }

    const nextJob = await this.getNextJob(queueName);
    if (!nextJob) {
      return; // 没有等待的作业
    }

    this.isProcessing = true;
    try {
      // 更新作业状态为活跃
      await this.updateJobStatus(nextJob.id, QueueJobStatus.ACTIVE);
      nextJob.processedOn = new Date();

      // 触发作业处理事件
      this.emit('jobStarted', {
        type: 'jobStarted',
        queueName,
        jobId: nextJob.id,
        timestamp: new Date()
      } as QueueEvent);

      // 在Mock环境中，我们模拟作业处理
      // 实际环境中，这里会调用作业处理器
      setTimeout(async () => {
        try {
          // 模拟成功完成
          await this.completeJob(nextJob.id, { processed: true });
        } catch (error) {
          // 模拟失败
          await this.failJob(nextJob.id, error as Error);
        }
      }, 100); // 模拟处理时间

    } finally {
      this.isProcessing = false;
    }
  }
}