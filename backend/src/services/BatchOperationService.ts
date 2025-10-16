/**
 * 批量操作服务
 * 提供高效的Redis批量操作，减少网络往返次数，提升吞吐量
 */

import Redis from 'ioredis';
import logger from '@/utils/logger';
import { QueueJob, QueueOptions, JobStatus, BackoffStrategy } from '@/types/queue';
import RedisConnectionPool from '@/utils/redisConnectionPool';

export interface BatchOperation {
  type: 'add' | 'remove' | 'retry' | 'update';
  jobs: Array<{
    id?: string;
    type?: string;
    data?: any;
    options?: QueueOptions;
    updates?: any;
  }>;
}

export interface BatchOperationResult {
  successful: Array<{
    id?: string;
    result?: any;
    index: number;
  }>;
  failed: Array<{
    index: number;
    error: string;
    data: any;
  }>;
  total: number;
  duration: number;
}

export interface BatchAddOperation {
  type: string;
  data: any;
  options?: QueueOptions;
  priority?: number;
  delay?: number;
}

export interface BatchRemoveOperation {
  id: string;
}

export interface BatchRetryOperation {
  id: string;
  resetAttempts?: boolean;
}

/**
 * 批量操作服务类
 */
export class BatchOperationService {
  private connectionPool: RedisConnectionPool;
  private batchSize: number;
  private enablePipelining: boolean;
  private enableTransactions: boolean;

  constructor(connectionPool: RedisConnectionPool, options: {
    batchSize?: number;
    enablePipelining?: boolean;
    enableTransactions?: boolean;
  } = {}) {
    this.connectionPool = connectionPool;
    this.batchSize = options.batchSize || 100;
    this.enablePipelining = options.enablePipelining ?? true;
    this.enableTransactions = options.enableTransactions ?? false;
  }

  /**
   * 批量添加任务
   */
  public async batchAddJobs(
    queueName: string,
    operations: BatchAddOperation[]
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const successful: Array<{ id?: string; result?: any; index: number }> = [];
    const failed: Array<{ index: number; error: string; data: any }> = [];

    try {
      if (this.enablePipelining) {
        // 使用Pipeline批量添加
        await this.batchAddWithPipeline(queueName, operations, successful, failed);
      } else {
        // 逐个添加
        await this.batchAddSequential(queueName, operations, successful, failed);
      }
    } catch (error) {
      logger.error(`BatchOperationService: Error in batch add jobs for queue ${queueName}:`, error);
      failed.push({
        index: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: operations
      });
    }

    const duration = Date.now() - startTime;

    logger.info(`BatchOperationService: Batch add completed for queue ${queueName}`, {
      total: operations.length,
      successful: successful.length,
      failed: failed.length,
      duration,
      opsPerSec: Math.round(operations.length / (duration / 1000))
    });

    return {
      successful,
      failed,
      total: operations.length,
      duration
    };
  }

  /**
   * 使用Pipeline批量添加任务
   */
  private async batchAddWithPipeline(
    queueName: string,
    operations: BatchAddOperation[],
    successful: Array<{ id?: string; result?: any; index: number }>,
    failed: Array<{ index: number; error: string; data: any }>
  ): Promise<void> {
    const redis = await this.connectionPool.acquire();
    try {
      const batchSize = Math.min(operations.length, this.batchSize);

      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const pipeline = redis.pipeline();

        for (const [batchIndex, operation] of batch.entries()) {
          const globalIndex = i + batchIndex;

          try {
            const jobId = this.generateJobId();
            const job: QueueJob = {
              id: jobId,
              name: operation.type,
              data: operation.data,
              opts: {
                priority: operation.priority || 5,
                delay: operation.delay || 0,
                attempts: operation.options?.attempts || 3,
                removeOnComplete: operation.options?.removeOnComplete ?? true,
                removeOnFail: operation.options?.removeOnFail ?? true,
                backoff: operation.options?.backoff || BackoffStrategy.EXPONENTIAL,
                metadata: operation.options?.metadata || {}
              },
              createdAt: new Date(),
              attemptsMade: 0
            };

            // 存储任务数据
            pipeline.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

            // 根据延迟时间决定队列
            if (operation.delay && operation.delay > 0) {
              const scheduledAt = new Date(Date.now() + operation.delay);
              pipeline.zadd(`${queueName}:delayed`, scheduledAt.getTime(), jobId);
              pipeline.hset(`${queueName}:delayed:meta`, jobId, JSON.stringify({
                id: jobId,
                type: operation.type,
                payload: operation.data,
                priority: job.opts.priority!,
                attempts: 0,
                maxAttempts: job.opts.attempts!,
                delay: operation.delay!,
                createdAt: job.createdAt,
                metadata: job.opts.metadata,
                scheduledAt
              }));
            } else {
              const score = this.getScore(job.opts.priority!, job.createdAt);
              pipeline.zadd(`${queueName}:waiting`, score, jobId);
              pipeline.hset(`${queueName}:waiting:meta`, jobId, JSON.stringify({
                id: jobId,
                type: operation.type,
                payload: operation.data,
                priority: job.opts.priority!,
                attempts: 0,
                maxAttempts: job.opts.attempts!,
                delay: 0,
                createdAt: job.createdAt,
                metadata: job.opts.metadata
              }));
            }

            successful.push({ id: jobId, index: globalIndex });
          } catch (error) {
            failed.push({
              index: globalIndex,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: operation
            });
          }
        }

        // 执行批量操作
        const results = await pipeline.exec();

        // 检查Pipeline执行结果
        if (results) {
          results.forEach((result, index) => {
            if (result[0]) {
              // Pipeline操作失败，从successful中移除对应的成功记录
              const failedIndex = successful.findIndex(s => s.index === i + index);
              if (failedIndex !== -1) {
                const failedOp = successful[failedIndex];
                if (failedOp) {
                  successful.splice(failedIndex, 1);
                  failed.push({
                    index: failedOp.index,
                    error: `Pipeline error: ${result[0]}`,
                    data: operations[failedOp.index]
                  });
                }
              }
            }
          });
        }
      }
    } finally {
      this.connectionPool.release(redis);
    }
  }

  /**
   * 逐个批量添加任务（回退方案）
   */
  private async batchAddSequential(
    queueName: string,
    operations: BatchAddOperation[],
    successful: Array<{ id?: string; result?: any; index: number }>,
    failed: Array<{ index: number; error: string; data: any }>
  ): Promise<void> {
    // 这里可以调用QueueManager的addJob方法
    // 为了简化，这里只记录日志
    logger.debug(`BatchOperationService: Sequential batch add for ${operations.length} operations`);
  }

  /**
   * 批量删除任务
   */
  public async batchRemoveJobs(
    queueName: string,
    jobIds: string[]
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const successful: Array<{ id?: string; result?: any; index: number }> = [];
    const failed: Array<{ index: number; error: string; data: any }> = [];

    try {
      const redis = await this.connectionPool.acquire();
      try {
        const batchSize = Math.min(jobIds.length, this.batchSize);

        for (let i = 0; i < jobIds.length; i += batchSize) {
          const batch = jobIds.slice(i, i + batchSize);
          const pipeline = redis.pipeline();

          for (const [batchIndex, jobId] of batch.entries()) {
            const globalIndex = i + batchIndex;

            // 从所有可能的队列中批量删除
            pipeline.zrem(`${queueName}:waiting`, jobId);
            pipeline.zrem(`${queueName}:active`, jobId);
            pipeline.zrem(`${queueName}:delayed`, jobId);
            pipeline.zrem(`${queueName}:completed`, jobId);
            pipeline.zrem(`${queueName}:failed`, jobId);
            pipeline.hdel(`${queueName}:jobs`, jobId);
            pipeline.hdel(`${queueName}:waiting:meta`, jobId);
            pipeline.hdel(`${queueName}:active:meta`, jobId);
            pipeline.hdel(`${queueName}:delayed:meta`, jobId);
            pipeline.hdel(`${queueName}:completed:meta`, jobId);
            pipeline.hdel(`${queueName}:failed:meta`, jobId);

            successful.push({ id: jobId, index: globalIndex });
          }

          // 执行批量删除
          await pipeline.exec();
        }
      } finally {
        this.connectionPool.release(redis);
      }
    } catch (error) {
      logger.error(`BatchOperationService: Error in batch remove jobs for queue ${queueName}:`, error);
      failed.push({
        index: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: jobIds
      });
    }

    const duration = Date.now() - startTime;

    return {
      successful,
      failed,
      total: jobIds.length,
      duration
    };
  }

  /**
   * 批量重试任务
   */
  public async batchRetryJobs(
    queueName: string,
    jobIds: string[],
    options: { resetAttempts?: boolean } = {}
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const successful: Array<{ id?: string; result?: any; index: number }> = [];
    const failed: Array<{ index: number; error: string; data: any }> = [];

    try {
      const redis = await this.connectionPool.acquire();
      try {
        const batchSize = Math.min(jobIds.length, this.batchSize);

        for (let i = 0; i < jobIds.length; i += batchSize) {
          const batch = jobIds.slice(i, i + batchSize);
          const pipeline = redis.pipeline();

          for (const [batchIndex, jobId] of batch.entries()) {
            const globalIndex = i + batchIndex;

            // 移动到等待队列
            pipeline.zrem(`${queueName}:failed`, jobId);
            pipeline.hget(`${queueName}:jobs`, jobId);

            successful.push({ id: jobId, index: globalIndex });
          }

          // 执行批量操作
          const results = await pipeline.exec();

          // 处理结果，更新任务状态并移动到等待队列
          if (results) {
            for (let j = 0; j < results.length; j++) {
              const result = results[j];
              const globalIndex = i + j;

              if (result && !result[0] && result[1]) {
                // 成功获取任务数据
                try {
                  const job = JSON.parse(result[1] as string);

                  if (options.resetAttempts) {
                    job.attemptsMade = 0;
                    delete job.failedAt;
                    delete job.failedReason;
                  }

                  // 重新添加到等待队列
                  const score = this.getScore(job.opts.priority!, job.createdAt);
                  const currentJobId = jobIds[globalIndex] || 'unknown';

                  // 注意：这里需要重新创建pipeline，因为之前的pipeline已经执行了
                  const newPipeline = redis.pipeline();
                  newPipeline.zadd(`${queueName}:waiting`, score, currentJobId);
                  newPipeline.hset(`${queueName}:jobs`, currentJobId, JSON.stringify(job));
                  await newPipeline.exec();

                } catch (parseError) {
                  failed.push({
                    index: globalIndex,
                    error: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                    data: { jobId: jobIds[globalIndex] || 'unknown' }
                  });
                }
              } else if (result) {
                failed.push({
                  index: globalIndex,
                  error: `Operation failed: ${result[0] as Error}`,
                  data: { jobId: jobIds[globalIndex] || 'unknown' }
                });
              }
          }
        }
        }
      } finally {
        this.connectionPool.release(redis);
      }
    } catch (error) {
      logger.error(`BatchOperationService: Error in batch retry jobs for queue ${queueName}:`, error);
      failed.push({
        index: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: jobIds
      });
    }

    const duration = Date.now() - startTime;

    return {
      successful,
      failed,
      total: jobIds.length,
      duration
    };
  }

  /**
   * 获取队列统计信息（批量查询）
   */
  public async batchGetQueueStats(queueNames: string[]): Promise<Record<string, any>> {
    const redis = await this.connectionPool.acquire();
    try {
      const pipeline = redis.pipeline();

      for (const queueName of queueNames) {
        pipeline.zcard(`${queueName}:waiting`);
        pipeline.zcard(`${queueName}:active`);
        pipeline.zcard(`${queueName}:completed`);
        pipeline.zcard(`${queueName}:failed`);
        pipeline.zcard(`${queueName}:delayed`);
      }

      const results = await pipeline.exec();
      const stats: Record<string, any> = {};

      if (results) {
        for (let i = 0; i < queueNames.length; i++) {
          const queueName = queueNames[i];
          if (!queueName) continue; // Skip undefined queue names
          const baseIndex = i * 5;

          const waitingResult = results[baseIndex];
          const activeResult = results[baseIndex + 1];
          const completedResult = results[baseIndex + 2];
          const failedResult = results[baseIndex + 3];
          const delayedResult = results[baseIndex + 4];

          stats[queueName] = {
            waiting: waitingResult && !waitingResult[0] ? (waitingResult[1] as number) : 0,
            active: activeResult && !activeResult[0] ? (activeResult[1] as number) : 0,
            completed: completedResult && !completedResult[0] ? (completedResult[1] as number) : 0,
            failed: failedResult && !failedResult[0] ? (failedResult[1] as number) : 0,
            delayed: delayedResult && !delayedResult[0] ? (delayedResult[1] as number) : 0
          } as any;
        }
      }

      return stats;
    } finally {
      this.connectionPool.release(redis);
    }
  }

  /**
   * 清理过期的完成任务（批量操作）
   */
  public async batchCleanCompletedJobs(
    queueName: string,
    olderThanMs: number,
    batchSize: number = 1000
  ): Promise<number> {
    const redis = await this.connectionPool.acquire();
    try {
      const cutoffTime = Date.now() - olderThanMs;
      let totalRemoved = 0;

      while (true) {
        // 获取过期的任务ID
        const expiredJobIds = await redis.zrangebyscore(
          `${queueName}:completed`,
          0,
          cutoffTime,
          'LIMIT',
          0,
          batchSize
        );

        if (expiredJobIds.length === 0) {
          break;
        }

        // 批量删除
        const pipeline = redis.pipeline();
        for (const jobId of expiredJobIds) {
          pipeline.zrem(`${queueName}:completed`, jobId);
          pipeline.hdel(`${queueName}:jobs`, jobId);
          pipeline.hdel(`${queueName}:completed:meta`, jobId);
        }

        const results = await pipeline.exec();
        const batchRemoved = results ? results.filter(r => r[1] === 1).length : 0;
        totalRemoved += batchRemoved;

        logger.debug(`BatchOperationService: Cleaned ${batchRemoved} completed jobs from queue ${queueName}`);
      }

      logger.info(`BatchOperationService: Total cleaned ${totalRemoved} completed jobs from queue ${queueName}`);
      return totalRemoved;
    } finally {
      this.connectionPool.release(redis);
    }
  }

  /**
   * 生成任务ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 计算任务优先级分数
   */
  private getScore(priority: number, createdAt: Date): number {
    const maxPriority = 20;
    const priorityWeight = 1000000000000;
    return (maxPriority - priority) * priorityWeight + createdAt.getTime();
  }

  /**
   * 获取批量操作配置
   */
  public getConfig(): {
    batchSize: number;
    enablePipelining: boolean;
    enableTransactions: boolean;
  } {
    return {
      batchSize: this.batchSize,
      enablePipelining: this.enablePipelining,
      enableTransactions: this.enableTransactions
    };
  }

  /**
   * 更新批量操作配置
   */
  public updateConfig(config: {
    batchSize?: number;
    enablePipelining?: boolean;
    enableTransactions?: boolean;
  }): void {
    if (config.batchSize !== undefined) {
      this.batchSize = Math.max(1, Math.min(1000, config.batchSize));
    }
    if (config.enablePipelining !== undefined) {
      this.enablePipelining = config.enablePipelining;
    }
    if (config.enableTransactions !== undefined) {
      this.enableTransactions = config.enableTransactions;
    }

    logger.info('BatchOperationService: Configuration updated', this.getConfig());
  }
}

export default BatchOperationService;