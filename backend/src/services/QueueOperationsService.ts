/**
 * 队列操作服务
 * 专门处理队列的基本操作：添加、获取、删除作业
 */

import type Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import type {
  QueueJob,
  QueueOptions} from '@/types/queue';
import {
  QueueConfig,
  JobStatus,
  MessagePriority,
  QueueType,
  JOB_TYPES,
  JobType
} from '@/types/queue';

export class QueueOperationsService {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 添加作业到队列
   */
  async addJob<T = unknown>(
    queueName: string,
    data: T,
    options: QueueOptions = {}
  ): Promise<string> {
    const jobId = uuidv4();
    const job: QueueJob = {
      id: jobId,
      name: `${queueName}-job`,
      type: options.type || JOB_TYPES.CHAT_MESSAGE,
      data: data as Record<string, unknown>,
      opts: {
        priority: options.priority || MessagePriority.NORMAL,
        delay: options.delay || 0,
        maxAttempts: options.maxAttempts || 3,
        timeout: options.timeout || 30000,
        metadata: options.metadata || {}
      },
      attemptsMade: 0,
      status: JobStatus.WAITING,
      createdAt: new Date(),
      scheduledAt: new Date(Date.now() + (options.delay || 0))
    };

    const serializedJob = JSON.stringify(job);

    try {
      if ((job.opts.delay || 0) > 0) {
        // 延迟作业 - 添加到延迟队列
        await this.redis.zadd(`${queueName}:delayed`, job.scheduledAt!.getTime(), jobId);
        await this.redis.hset(`${queueName}:jobs`, jobId, serializedJob);
      } else {
        // 立即作业 - 添加到等待队列
        await this.redis.zadd(`${queueName}:waiting`, Date.now(), jobId);
        await this.redis.hset(`${queueName}:jobs`, jobId, serializedJob);
      }

      logger.debug('📝 [QueueOperationsService] 作业添加成功', {
        queueName,
        jobId,
        type: job.type,
        priority: job.opts.priority,
        delay: job.opts.delay
      });

      return jobId;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 作业添加失败', {
        queueName,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取作业
   */
  async getJob(queueName: string, jobId: string): Promise<QueueJob | null> {
    try {
      const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
      if (!jobData) {
        return null;
      }

      const job: QueueJob = JSON.parse(jobData);
      return job;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 获取作业失败', {
        queueName,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 删除作业
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const deleted = await this.redis.hdel(`${queueName}:jobs`, jobId);
      if (deleted > 0) {
        // 从所有队列中删除
        await this.redis.zrem(`${queueName}:waiting`, jobId);
        await this.redis.zrem(`${queueName}:active`, jobId);
        await this.redis.zrem(`${queueName}:completed`, jobId);
        await this.redis.zrem(`${queueName}:failed`, jobId);
        await this.redis.zrem(`${queueName}:delayed`, jobId);

        logger.debug('🗑️ [QueueOperationsService] 作业删除成功', {
          queueName,
          jobId
        });

        return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 作业删除失败', {
        queueName,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 更新作业状态
   */
  async updateJobStatus(
    queueName: string,
    jobId: string,
    status: JobStatus,
    error?: string
  ): Promise<boolean> {
    try {
      const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
      if (!jobData) {
        return false;
      }

      const job: QueueJob = JSON.parse(jobData);
      job.status = status;

      if (status === JobStatus.FAILED && error) {
        job.error = error;
      }

      if (status === JobStatus.ACTIVE) {
        job.processedOn = new Date();
      }

      if (status === JobStatus.COMPLETED) {
        job.finishedOn = new Date();
        job.returnvalue = job.returnvalue; // 保留返回值
      }

      // 更新作业数据
      await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

      // 移动到相应的队列
      const timestamp = Date.now();
      await this.redis.zrem(`${queueName}:waiting`, jobId);
      await this.redis.zrem(`${queueName}:active`, jobId);
      await this.redis.zrem(`${queueName}:completed`, jobId);
      await this.redis.zrem(`${queueName}:failed`, jobId);

      switch (status) {
        case JobStatus.WAITING:
          await this.redis.zadd(`${queueName}:waiting`, timestamp, jobId);
          break;
        case JobStatus.ACTIVE:
          await this.redis.zadd(`${queueName}:active`, timestamp, jobId);
          break;
        case JobStatus.COMPLETED:
          await this.redis.zadd(`${queueName}:completed`, timestamp, jobId);
          break;
        case JobStatus.FAILED:
          await this.redis.zadd(`${queueName}:failed`, timestamp, jobId);
          break;
      }

      logger.debug('🔄 [QueueOperationsService] 作业状态更新成功', {
        queueName,
        jobId,
        status,
        hasError: !!error
      });

      return true;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 作业状态更新失败', {
        queueName,
        jobId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 增加作业重试次数
   */
  async incrementJobAttempts(queueName: string, jobId: string): Promise<boolean> {
    try {
      const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
      if (!jobData) {
        return false;
      }

      const job: QueueJob = JSON.parse(jobData);
      job.attemptsMade++;
      job.lastAttemptAt = new Date();

      await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));

      logger.debug('🔄 [QueueOperationsService] 作业重试次数增加', {
        queueName,
        jobId,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.maxAttempts
      });

      return true;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 作业重试次数增加失败', {
        queueName,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取队列中的下一个作业（不处理，只获取）
   */
  async getNextJob(queueName: string): Promise<QueueJob | null> {
    try {
      // 检查延迟队列
      const now = Date.now();
      const delayedJobs = await this.redis.zrangebyscore(`${queueName}:delayed`, 0, now, 'LIMIT', 0, 1);

      if (delayedJobs.length > 0) {
        const jobId = delayedJobs[0]!;
        const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
        if (jobData) {
          const job: QueueJob = JSON.parse(jobData);
          // 移动到等待队列
          await this.redis.zrem(`${queueName}:delayed`, jobId);
          await this.redis.zadd(`${queueName}:waiting`, now, jobId);
          return job;
        }
      }

      // 从等待队列获取作业
      const waitingJobs = await this.redis.zrange(`${queueName}:waiting`, 0, 0);
      if (waitingJobs.length === 0) {
        return null;
      }

      const jobId = waitingJobs[0]!;
      const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
      if (!jobData) {
        return null;
      }

      const job: QueueJob = JSON.parse(jobData);
      return job;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 获取下一个作业失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 原子性地获取作业并移动到活动队列
   */
  async acquireJob(queueName: string): Promise<QueueJob | null> {
    try {
      const {redis} = this;
      const jobId = await redis.zrange(`${queueName}:waiting`, 0, 0);

      if (jobId.length === 0) {
        return null;
      }

      const actualJobId = jobId[0];
      if (!actualJobId) {
        return null;
      }

      // 原子性地移动任务到活动队列
      const removeResult = await redis.zrem(`${queueName}:waiting`, actualJobId);
      if (removeResult === 0) {
        return null; // 任务已被其他处理器获取
      }

      const jobData = await redis.hget(`${queueName}:jobs`, actualJobId);
      if (!jobData) {
        return null;
      }

      const job: QueueJob = JSON.parse(jobData);

      // 移动到活动队列
      await redis.zadd(`${queueName}:active`, Date.now().toString(), actualJobId);

      // 更新作业状态
      await this.updateJobStatus(queueName, actualJobId, JobStatus.ACTIVE);

      logger.debug('🎯 [QueueOperationsService] 作业获取成功', {
        queueName,
        jobId: actualJobId,
        type: job.type
      });

      return job;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 作业获取失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 释放作业（处理完成后）
   */
  async releaseJob(
    queueName: string,
    jobId: string,
    result?: any,
    error?: string
  ): Promise<boolean> {
    try {
      if (error) {
        // 处理失败
        await this.updateJobStatus(queueName, jobId, JobStatus.FAILED, error);
      } else {
        // 处理成功
        const jobData = await this.redis.hget(`${queueName}:jobs`, jobId);
        if (jobData) {
          const job: QueueJob = JSON.parse(jobData);
          job.returnvalue = result;
          await this.redis.hset(`${queueName}:jobs`, jobId, JSON.stringify(job));
        }
        await this.updateJobStatus(queueName, jobId, JobStatus.COMPLETED);
      }

      // 从活动队列中移除
      await this.redis.zrem(`${queueName}:active`, jobId);

      logger.debug('✅ [QueueOperationsService] 作业释放成功', {
        queueName,
        jobId,
        hasError: !!error
      });

      return true;
    } catch (error) {
      logger.error('❌ [QueueOperationsService] 作业释放失败', {
        queueName,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}