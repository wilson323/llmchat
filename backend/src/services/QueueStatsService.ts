/**
 * 队列统计服务
 * 专门处理队列的统计信息和监控数据
 */

import type Redis from 'ioredis';
import logger from '@/utils/logger';
import type {
  QueueStats,
  QueueJob,
  QueueType} from '@/types/queue';
import {
  JobStatus,
  QueueStatus,
  MessagePriority,
  QUEUE_TYPES
} from '@/types/queue';

export class QueueStatsService {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(queueName: string): Promise<QueueStats | null> {
    try {
      const pipeline = this.redis.pipeline();

      // 获取各个队列的作业数量
      pipeline.zcard(`${queueName}:waiting`);
      pipeline.zcard(`${queueName}:active`);
      pipeline.zcard(`${queueName}:completed`);
      pipeline.zcard(`${queueName}:failed`);
      pipeline.zcard(`${queueName}:delayed`);
      pipeline.hlen(`${queueName}:jobs`);

      const results = await pipeline.exec();

      if (!results) {
        return null;
      }

      const [
        waitingError,
        waitingCount,
        activeError,
        activeCount,
        completedError,
        completedCount,
        failedError,
        failedCount,
        delayedError,
        delayedCount,
        totalError,
        totalCount
      ] = results;

      // 检查是否有Redis错误
      if (waitingError || activeError || completedError || failedError || delayedError || totalError) {
        throw new Error('Redis pipeline execution failed');
      }

      const stats: QueueStats = {
        name: queueName,
        status: QueueStatus.ACTIVE,
        waiting: Number(waitingCount?.[1]) || 0,
        active: Number(activeCount?.[1]) || 0,
        completed: Number(completedCount?.[1]) || 0,
        failed: Number(failedCount?.[1]) || 0,
        delayed: Number(delayedCount?.[1]) || 0,
        paused: false,
        processing: Number(activeCount?.[1]) || 0,
        concurrency: 10,
        maxConcurrency: 10,
        throughput: await this.calculateThroughput(queueName),
        avgProcessingTime: await this.calculateAvgProcessingTime(queueName),
        errorRate: await this.calculateErrorRate(queueName),
        lastProcessedAt: await this.getLastActivity(queueName) || undefined,
        createdAt: new Date()
      };

      return stats;
    } catch (error: any) {
      logger.error('❌ [QueueStatsService] 获取队列统计失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取队列中的作业列表
   */
  async getQueueJobs(
    queueName: string,
    status?: JobStatus,
    limit = 50
  ): Promise<QueueJob[]> {
    try {
      let jobIds: string[] = [];

      // 根据状态获取不同的队列
      switch (status) {
        case JobStatus.WAITING:
          jobIds = await this.redis.zrevrange(`${queueName}:waiting`, 0, limit - 1);
          break;
        case JobStatus.ACTIVE:
          jobIds = await this.redis.zrevrange(`${queueName}:active`, 0, limit - 1);
          break;
        case JobStatus.COMPLETED:
          jobIds = await this.redis.zrevrange(`${queueName}:completed`, 0, limit - 1);
          break;
        case JobStatus.FAILED:
          jobIds = await this.redis.zrevrange(`${queueName}:failed`, 0, limit - 1);
          break;
        default:
          // 获取所有状态的作业，按优先级排序
          const waitingJobs = await this.redis.zrevrange(`${queueName}:waiting`, 0, limit - 1);
          const activeJobs = await this.redis.zrevrange(`${queueName}:active`, 0, Math.max(0, limit - waitingJobs.length - 1));
          jobIds = [...waitingJobs, ...activeJobs];
      }

      if (jobIds.length === 0) {
        return [];
      }

      // 批量获取作业数据
      const pipeline = this.redis.pipeline();
      jobIds.forEach(jobId => {
        pipeline.hget(`${queueName}:jobs`, jobId);
      });

      const results = await pipeline.exec();
      if (!results) {
        return [];
      }

      const jobs: QueueJob[] = [];
      results.forEach(([error, jobData], index) => {
        if (!error && jobData) {
          try {
            const job: QueueJob = JSON.parse(jobData as string);
            // Infer job status from available properties
            const jobStatus = job.failedAt ? JobStatus.FAILED :
                            job.finishedOn ? JobStatus.COMPLETED :
                            job.processedOn ? JobStatus.ACTIVE : JobStatus.WAITING;
            if (!status || jobStatus === status) {
              jobs.push(job);
            }
          } catch (parseError) {
            logger.warn('⚠️ [QueueStatsService] 作业数据解析失败', {
              queueName,
              jobId: jobIds[index],
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
        }
      });

      return jobs;
    } catch (error: any) {
      logger.error('❌ [QueueStatsService] 获取队列作业列表失败', {
        queueName,
        status,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 批量获取多个队列的统计信息
   */
  async batchGetQueueStats(queueNames: string[]): Promise<Record<string, QueueStats>> {
    try {
      const statsPromises = queueNames.map(queueName =>
        this.getQueueStats(queueName).catch(error => {
          logger.error('❌ [QueueStatsService] 批量获取统计失败', {
            queueName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return null;
        })
      );

      const results = await Promise.all(statsPromises);
      const stats: Record<string, QueueStats> = {};

      results.forEach((queueStats, index) => {
        const queueName = queueNames[index];
        if (queueName && queueStats) {
          stats[queueName] = queueStats;
        }
      });

      return stats;
    } catch (error: any) {
      logger.error('❌ [QueueStatsService] 批量获取队列统计失败', {
        queueNames,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取队列的优先级分布
   */
  async getPriorityDistribution(queueName: string): Promise<Record<MessagePriority, number>> {
    try {
      const jobs = await this.getQueueJobs(queueName, undefined, 1000); // 获取更多作业进行分析
      const distribution: Record<MessagePriority, number> = {
        [MessagePriority.LOW]: 0,
        [MessagePriority.NORMAL]: 0,
        [MessagePriority.HIGH]: 0,
        [MessagePriority.CRITICAL]: 0
      };

      jobs.forEach(job => {
        const priority = job.opts?.priority || MessagePriority.NORMAL;
        distribution[priority] = (distribution[priority] || 0) + 1;
      });

      return distribution;
    } catch (error: any) {
      logger.error('❌ [QueueStatsService] 获取优先级分布失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取队列的类型分布
   */
  async getTypeDistribution(queueName: string): Promise<Record<QueueType, number>> {
    try {
      const jobs = await this.getQueueJobs(queueName, undefined, 1000);
      const distribution: Record<QueueType, number> = {
        [QUEUE_TYPES.CHAT_PROCESSING]: 0,
        [QUEUE_TYPES.EMAIL_NOTIFICATION]: 0,
        [QUEUE_TYPES.WEBHOOK_PROCESSING]: 0,
        [QUEUE_TYPES.DATA_SYNC]: 0,
        [QUEUE_TYPES.LOG_PROCESSING]: 0,
        [QUEUE_TYPES.REPORT_GENERATION]: 0,
        [QUEUE_TYPES.CLEANUP_TASKS]: 0,
        [QUEUE_TYPES.AUDIT_LOGS]: 0,
        [QUEUE_TYPES.PERFORMANCE_METRICS]: 0,
        [QUEUE_TYPES.HEALTH_CHECKS]: 0
      };

      jobs.forEach(job => {
        // 基于作业名称进行队列类型推断
        const jobType = job.name || QUEUE_TYPES.CHAT_PROCESSING;
        if (jobType in distribution) {
          distribution[jobType as QueueType]++;
        } else {
          distribution[QUEUE_TYPES.CHAT_PROCESSING]++;
        }
      });

      return distribution;
    } catch (error: any) {
      logger.error('❌ [QueueStatsService] 获取类型分布失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 获取最后活动时间
   */
  private async getLastActivity(queueName: string): Promise<Date | null> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.zrange(`${queueName}:completed`, -1, -1, 'WITHSCORES');
      pipeline.zrange(`${queueName}:failed`, -1, -1, 'WITHSCORES');
      pipeline.zrange(`${queueName}:active`, -1, -1, 'WITHSCORES');

      const results = await pipeline.exec();
      if (!results) {
        return null;
      }

      const completedResult = results[0];
      const failedResult = results[1];
      const activeResult = results[2];

      let latestTimestamp = 0;

      if (completedResult && completedResult[0] === null && completedResult[1] && Array.isArray(completedResult[1]) && completedResult[1].length > 0) {
        latestTimestamp = Math.max(latestTimestamp, completedResult[1][1] as number);
      }
      if (failedResult && failedResult[0] === null && failedResult[1] && Array.isArray(failedResult[1]) && failedResult[1].length > 0) {
        latestTimestamp = Math.max(latestTimestamp, failedResult[1][1] as number);
      }
      if (activeResult && activeResult[0] === null && activeResult[1] && Array.isArray(activeResult[1]) && activeResult[1].length > 0) {
        latestTimestamp = Math.max(latestTimestamp, activeResult[1][1] as number);
      }

      return latestTimestamp > 0 ? new Date(latestTimestamp) : null;
    } catch (error: any) {
      logger.warn('⚠️ [QueueStatsService] 获取最后活动时间失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * 计算吞吐量（每分钟处理的作业数）
   */
  private async calculateThroughput(queueName: string): Promise<number> {
    try {
      const oneMinuteAgo = Date.now() - 60000; // 1分钟前
      const completedJobs = await this.redis.zrangebyscore(
        `${queueName}:completed`,
        oneMinuteAgo,
        '+inf',
        'LIMIT',
        0,
        -1
      );

      return completedJobs.length;
    } catch (error: any) {
      logger.warn('⚠️ [QueueStatsService] 计算吞吐量失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * 计算错误率
   */
  private async calculateErrorRate(queueName: string): Promise<number> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.zcard(`${queueName}:completed`);
      pipeline.zcard(`${queueName}:failed`);

      const results = await pipeline.exec();
      if (!results) {
        return 0;
      }

      const completedResult = results[0];
      const failedResult = results[1];

      if (!completedResult || !failedResult) {
        return 0;
      }

      const [, completedCount] = completedResult;
      const [, failedCount] = failedResult;

      const totalProcessed = (completedCount as number) + (failedCount as number);
      return totalProcessed > 0 ? (failedCount as number) / totalProcessed : 0;
    } catch (error: any) {
      logger.warn('⚠️ [QueueStatsService] 计算错误率失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * 计算平均处理时间
   */
  private async calculateAvgProcessingTime(queueName: string): Promise<number> {
    try {
      // 获取最近100个完成的作业
      const completedJobs = await this.redis.zrevrange(`${queueName}:completed`, 0, 99);
      if (completedJobs.length === 0) {
        return 0;
      }

      const pipeline = this.redis.pipeline();
      completedJobs.forEach(jobId => {
        pipeline.hget(`${queueName}:jobs`, jobId);
      });

      const results = await pipeline.exec();
      if (!results) {
        return 0;
      }

      let totalProcessingTime = 0;
      let validJobs = 0;

      results.forEach(([error, jobData]) => {
        if (!error && jobData) {
          try {
            const job: QueueJob = JSON.parse(jobData as string);
            if (job.processedOn && job.createdAt) {
              const processingTime = job.processedOn.getTime() - job.createdAt.getTime();
              totalProcessingTime += processingTime;
              validJobs++;
            }
          } catch (parseError) {
            // 忽略解析错误
          }
        }
      });

      return validJobs > 0 ? totalProcessingTime / validJobs : 0;
    } catch (error: any) {
      logger.warn('⚠️ [QueueStatsService] 计算平均处理时间失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}
