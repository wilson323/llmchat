/**
 * 队列健康检查服务
 * 专门处理队列的健康状态监控和诊断
 */

import Redis from 'ioredis';
import logger from '@/utils/logger';
import { QueueOperationsService } from './QueueOperationsService';
import { QueueStatsService } from './QueueStatsService';
import { QueueConfig, QueueHealthStatus } from '@/types/queue';

export interface QueueHealthConfig {
  maxQueueSize?: number;
  maxProcessingTime?: number;
  maxErrorRate?: number;
  maxMemoryUsage?: number;
  checkInterval?: number;
}

export class QueueHealthService {
  private redis: Redis;
  private queueOperationsService: QueueOperationsService;
  private queueStatsService: QueueStatsService;
  private healthConfig: QueueHealthConfig;

  constructor(
    redis: Redis,
    queueOperationsService: QueueOperationsService,
    queueStatsService: QueueStatsService,
    healthConfig: QueueHealthConfig = {}
  ) {
    this.redis = redis;
      this.queueOperationsService = queueOperationsService;
      this.queueStatsService = queueStatsService;
      this.healthConfig = {
        maxQueueSize: 1000,
        maxProcessingTime: 60000, // 60秒
        maxErrorRate: 0.1, // 10%
        maxMemoryUsage: 0.8, // 80%
        checkInterval: 30000, // 30秒
        ...healthConfig
      };
    }

  /**
   * 执行健康检查
   */
  async performHealthCheck(queueName: string, queueConfig?: QueueConfig): Promise<QueueHealthStatus> {
    try {
      const startTime = Date.now();

      // 获取队列统计
      const stats = await this.queueStatsService.getQueueStats(queueName);
      if (!stats) {
        return this.createUnhealthyStatus(queueName, '队列不存在', startTime);
      }

      // 检查各项健康指标
      const checks = await Promise.allSettled([
        this.checkQueueSize(queueName, stats),
        this.checkProcessingTime(queueName, stats),
        this.checkErrorRate(queueName, stats),
        this.checkMemoryUsage(queueName),
        this.checkRedisConnection(queueName),
        this.checkStaleJobs(queueName, stats),
        this.checkDeadlockDetection(queueName)
      ]);

      // 分析检查结果
      const issues: string[] = [];
      let isHealthy = true;

      checks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (!result.value.healthy) {
            isHealthy = false;
            issues.push(result.value.message);
          }
        } else {
          isHealthy = false;
          issues.push(`健康检查失败: ${result.reason}`);
        }
      });

      // 检查队列配置
      const configIssues = this.checkQueueConfiguration(queueName, queueConfig);
      if (configIssues.length > 0) {
        isHealthy = false;
        issues.push(...configIssues);
      }

      const healthStatus: QueueHealthStatus = {
        queueName,
        healthy: isHealthy,
        status: isHealthy ? 'healthy' : 'unhealthy',
        checks: {
          queueSize: isHealthy ? 'pass' : 'fail',
          processingTime: isHealthy ? 'pass' : 'fail',
          errorRate: isHealthy ? 'pass' : 'fail',
          memoryUsage: isHealthy ? 'pass' : 'fail',
          redisConnection: isHealthy ? 'pass' : 'fail',
          staleJobs: isHealthy ? 'pass' : 'fail',
          deadlockDetection: isHealthy ? 'pass' : 'fail',
          queueConfiguration: configIssues.length === 0 ? 'pass' : 'fail'
        },
        metrics: {
          totalJobs: stats.total || 0,
          waitingJobs: stats.waiting,
          activeJobs: stats.active,
          completedJobs: stats.completed,
          failedJobs: stats.failed,
          delayedJobs: stats.delayed,
          throughput: stats.throughput,
          errorRate: stats.errorRate,
          avgProcessingTime: stats.avgProcessingTime,
          lastActivity: stats.lastActivity ?? null
        },
        issues: issues.length > 0 ? issues : [],
        lastCheck: new Date(),
        checkDuration: Date.now() - startTime
      };

      if (isHealthy) {
        logger.debug('💚� [QueueHealthService] 队列健康检查通过', {
          queueName,
          checkDuration: healthStatus.checkDuration
        });
      } else {
        logger.warn('⚠️ [QueueHealthService] 队列健康检查发现问题', {
          queueName,
          issues,
          checkDuration: healthStatus.checkDuration
        });
      }

      return healthStatus;
    } catch (error) {
      logger.error('❌ [QueueHealthService] 健康检查失败', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return this.createUnhealthyStatus(
        queueName,
        `健康检查异常: ${error instanceof Error ? error.message : 'Unknown error'}`,
        Date.now()
      );
    }
  }

  /**
   * 批量健康检查
   */
  async performBatchHealthCheck(queueNames: string[], queueConfigs?: Record<string, QueueConfig>): Promise<Record<string, QueueHealthStatus>> {
    try {
      const healthPromises = queueNames.map(async (queueName) => {
        const config = queueConfigs?.[queueName];
        return this.performHealthCheck(queueName, config);
      });

      const results = await Promise.all(healthPromises);
      const healthStatuses: Record<string, QueueHealthStatus> = {};

      results.forEach((status: QueueHealthStatus, index: number) => {
        const queueName = queueNames[index];
        if (queueName) {
          healthStatuses[queueName] = status;
        }
      });

      return healthStatuses;
    } catch (error) {
      logger.error('❌ [QueueHealthService] 批量健康检查失败', {
        queueNames,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 检查队列大小
   */
  private async checkQueueSize(queueName: string, stats: any): Promise<{ healthy: boolean; message: string }> {
    try {
      const maxSize = this.healthConfig.maxQueueSize || 1000;
      const currentSize = stats.total;

      if (currentSize > maxSize) {
        return {
          healthy: false,
          message: `队列大小超限: ${currentSize}/${maxSize}`
        };
      }

      return {
        healthy: true,
        message: `队列大小正常: ${currentSize}/${maxSize}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `队列大小检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查处理时间
   */
  private async checkProcessingTime(queueName: string, stats: any): Promise<{ healthy: boolean; message: string }> {
    try {
      const maxTime = this.healthConfig.maxProcessingTime || 60000;
      const avgTime = stats.avgProcessingTime;

      if (avgTime > maxTime) {
        return {
          healthy: false,
          message: `平均处理时间过长: ${Math.round(avgTime / 1000)}s/${Math.round(maxTime / 1000)}s`
        };
      }

      return {
        healthy: true,
        message: `处理时间正常: ${Math.round(avgTime / 1000)}s/${Math.round(maxTime / 1000)}s`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `处理时间检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查错误率
   */
  private async checkErrorRate(queueName: string, stats: any): Promise<{ healthy: boolean; message: string }> {
    try {
      const maxErrorRate = this.healthConfig.maxErrorRate || 0.1;
      const currentErrorRate = stats.errorRate;

      if (currentErrorRate > maxErrorRate) {
        return {
          healthy: false,
          message: `错误率过高: ${Math.round(currentErrorRate * 100)}%/${Math.round(maxErrorRate * 100)}%`
        };
      }

      return {
        healthy: true,
        message: `错误率正常: ${Math.round(currentErrorRate * 100)}%/${Math.round(maxErrorRate * 100)}%`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `错误率检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查内存使用
   */
  private async checkMemoryUsage(queueName: string): Promise<{ healthy: boolean; message: string }> {
    try {
      const maxUsage = this.healthConfig.maxMemoryUsage || 0.8;

      // 获取Redis内存使用情况
      const memoryInfo = await this.redis.info('memory') as string;
      const memoryLines = memoryInfo.split('\r\n');
      const memoryData: Record<string, string> = {};

      memoryLines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            memoryData[key] = value;
          }
        }
      });
      const memoryStats = Object.entries(memoryData).reduce((acc, [key, value]) => {
        if (key.includes('used_memory_human')) {
          const usedMB = parseFloat(value.split(' ')[0] || '0');
          const totalMB = parseFloat(memoryData['maxmemory_human']?.split(' ')[0] || '0');
          acc.used = usedMB;
          acc.total = totalMB;
        }
        return acc;
      }, {} as { used: number; total: number });

      // 防止除零错误
      if (memoryStats.total === 0) {
        return {
          healthy: false,
          message: 'Redis内存信息不可用'
        };
      }

      const currentUsage = memoryStats.used / memoryStats.total;

      if (currentUsage > maxUsage) {
        return {
          healthy: false,
          message: `Redis内存使用过高: ${Math.round(currentUsage * 100)}%/${Math.round(maxUsage * 100)}%`
        };
      }

      return {
        healthy: true,
        message: `Redis内存使用正常: ${Math.round(currentUsage * 100)}%/${Math.round(maxUsage * 100)}%`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `内存使用检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查Redis连接
   */
  private async checkRedisConnection(queueName: string): Promise<{ healthy: boolean; message: string }> {
    try {
      const pingResult = await this.redis.ping();
      if (pingResult !== 'PONG') {
        return {
          healthy: false,
          message: 'Redis连接异常'
        };
      }

      // 检查队列相关的键是否存在
      const keysExist = await this.redis.exists(`${queueName}:jobs`);
      if (!keysExist) {
        return {
          healthy: false,
          message: '队列键不存在'
        };
      }

      return {
        healthy: true,
        message: 'Redis连接正常'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Redis连接检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查过期作业
   */
  private async checkStaleJobs(queueName: string, stats: any): Promise<{ healthy: boolean; message: string }> {
    try {
      const now = Date.now();
      const staleThreshold = 24 * 60 * 60 * 1000; // 24小时

      // 检查等待队列中过期的作业
      const staleWaitingJobs = await this.redis.zrangebyscore(
        `${queueName}:waiting`,
        0,
        now - staleThreshold,
        'LIMIT',
        0,
        10
      );

      // 检查活动队列中过期的作业
      const staleActiveJobs = await this.redis.zrangebyscore(
        `${queueName}:active`,
        0,
        now - staleThreshold,
        'LIMIT',
        0,
        10
      );

      const totalStaleJobs = staleWaitingJobs.length + staleActiveJobs.length;

      if (totalStaleJobs > 5) {
        return {
          healthy: false,
          message: `发现过多过期作业: ${totalStaleJobs}个`
        };
      }

      return {
        healthy: true,
        message: totalStaleJobs > 0 ? `发现少量过期作业: ${totalStaleJobs}个` : '无过期作业'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `过期作业检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查死锁检测
   */
  private async checkDeadlockDetection(queueName: string): Promise<{ healthy: boolean; message: string }> {
    try {
      // 检查活动作业的处理时间
      const activeJobs = await this.redis.zrangebyscore(
        `${queueName}:active`,
        0,
        Date.now() - 300000, // 5分钟前
        'LIMIT',
        0,
        10
      );

      if (activeJobs.length > 0) {
        return {
          healthy: false,
          message: `检测到可能的死锁: ${activeJobs.length}个作业处理时间过长`
        };
      }

      return {
        healthy: true,
        message: '未检测到死锁'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `死锁检测失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 检查队列配置
   */
  private checkQueueConfiguration(queueName: string, queueConfig?: QueueConfig): string[] {
    const issues: string[] = [];

    if (!queueConfig) {
      return ['队列配置缺失'];
    }

    // 检查关键配置
    if (queueConfig.concurrency <= 0) {
      issues.push('并发数配置无效');
    }

    if (queueConfig.maxRetries < 0) {
      issues.push('最大重试次数配置无效');
    }

    if (queueConfig.retryDelay < 0) {
      issues.push('重试延迟配置无效');
    }

    if ((queueConfig.visibilityTimeout || 0) < 0) {
      issues.push('可见性超时配置无效');
    }

    return issues;
  }

  /**
   * 创建不健康状态
   */
  private createUnhealthyStatus(queueName: string, reason: string, checkTime: number): QueueHealthStatus {
    return {
      queueName,
      healthy: false,
      status: 'unhealthy',
      checks: {
        queueSize: 'fail',
        processingTime: 'fail',
        errorRate: 'fail',
        memoryUsage: 'fail',
        redisConnection: 'fail',
        staleJobs: 'fail',
        deadlockDetection: 'fail',
        queueConfiguration: 'fail'
      },
      metrics: {
        totalJobs: 0,
        waitingJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        delayedJobs: 0,
        throughput: 0,
        errorRate: 0,
        avgProcessingTime: 0,
        lastActivity: null
      },
      issues: [reason],
      lastCheck: new Date(checkTime),
      checkDuration: 0
    };
  }
}