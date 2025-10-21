/**
 * Redis连接池管理器
 * 提供连接池管理、连接重用、性能监控等功能
 */

import Redis from 'ioredis';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import { createErrorFromUnknown } from '@/types/errors';

export interface RedisPoolConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  // 连接池配置
  maxConnections?: number;
  minConnections?: number;
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  reapIntervalMillis?: number;
  // 性能配置
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number | null;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

export interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  errors: number;
  avgResponseTime: number;
  lastError?: string;
  lastUsed?: Date;
}

export class RedisConnectionPool extends EventEmitter {
  private readonly config: RedisPoolConfig;
  private pool: Redis[] = [];
  private readonly activeConnections: Set<Redis> = new Set();
  private waitingQueue: Array<{
    resolve: (connection: Redis) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private readonly stats: ConnectionStats = {
    total: 0,
    active: 0,
    idle: 0,
    waiting: 0,
    errors: 0,
    avgResponseTime: 0,
  };
  private responseTimes: number[] = [];
  private maintenanceInterval?: NodeJS.Timeout;
  private isShuttingDown = false;
  private lastStatsTime = 0; // ✅ 用于记录上次统计日志时间

  constructor(config: RedisPoolConfig) {
    super();
    this.config = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 5000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true, // 修改为延迟连接，避免构造函数中阻塞
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      ...config,
    };

    // 异步初始化，避免阻塞构造函数
    this.initializePool().catch((error) => {
      logger.error('RedisConnectionPool: 初始化失败，将以降级模式运行', error);
      // 不抛出错误，允许服务继续启动
    });
    this.startMaintenance();
  }

  /**
   * 初始化连接池
   */
  private async initializePool(): Promise<void> {
    logger.info(`RedisConnectionPool: Initializing pool with ${this.config.minConnections} connections`);

    try {
      // 创建最小连接数
      const promises = [];
      for (let i = 0; i < this.config.minConnections!; i++) {
        promises.push(this.createConnection());
      }

      await Promise.all(promises);
      logger.info(`RedisConnectionPool: Pool initialized with ${this.pool.length} connections`);
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisConnectionPool',
        operation: 'initializePool',
      });
      logger.error('RedisConnectionPool: Failed to initialize pool:', error.toLogObject());
      throw error;
    }
  }

  /**
   * 创建新连接
   */
  private async createConnection(): Promise<Redis> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const connection = new Redis({
        host: this.config.host,
        port: this.config.port,
        db: this.config.db ?? 0,
        keyPrefix: this.config.keyPrefix ?? 'llmchat:',
        ...(this.config.password !== undefined && { password: this.config.password }),
        ...(this.config.enableOfflineQueue !== undefined && { enableOfflineQueue: this.config.enableOfflineQueue }),
        ...(this.config.maxRetriesPerRequest !== undefined && { maxRetriesPerRequest: this.config.maxRetriesPerRequest }),
        ...(this.config.lazyConnect !== undefined && { lazyConnect: this.config.lazyConnect }),
        ...(this.config.keepAlive !== undefined && { keepAlive: this.config.keepAlive }),
        ...(this.config.connectTimeout !== undefined && { connectTimeout: this.config.connectTimeout }),
        ...(this.config.commandTimeout !== undefined && { commandTimeout: this.config.commandTimeout }),
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection creation timeout'));
      }, this.config.createTimeoutMillis);

      connection.on('connect', () => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);

        // ✅ 移除高频debug日志，改用定时统计
        this.emit('connection:created', connection);
        resolve(connection);
      });

      connection.on('error', (error) => {
        clearTimeout(timeout);
        this.stats.errors++;
        this.stats.lastError = error.message;
        this.emit('connection:error', connection, error);
        logger.error('RedisConnectionPool: Connection error:', error);

        // 从池中移除损坏的连接
        this.removeConnection(connection);
        reject(error);
      });

      connection.on('close', () => {
        this.emit('connection:closed', connection);
        // ✅ 移除高频debug日志
        this.removeConnection(connection);
      });

      // 将连接添加到池中
      this.pool.push(connection);
      this.stats.total++;
    });
  }

  /**
   * 获取连接
   */
  public async acquire(): Promise<Redis> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // 查找空闲连接
    const idleConnection = this.pool.find(conn => !this.activeConnections.has(conn));

    if (idleConnection) {
      this.activeConnections.add(idleConnection);
      this.stats.active++;
      this.stats.idle = Math.max(0, this.stats.idle - 1);
      this.stats.lastUsed = new Date();

      // ✅ 改为定时统计
      this.logStatsIfNeeded();
      return idleConnection;
    }

    // 如果池未满，创建新连接
    if (this.pool.length < this.config.maxConnections!) {
      const connection = this.pool[this.pool.length - 1]; // 最近创建的连接
      if (connection && !this.activeConnections.has(connection)) {
        this.activeConnections.add(connection);
        this.stats.active++;
        this.stats.lastUsed = new Date();

        // ✅ 改为定时统计
        this.logStatsIfNeeded();
        return connection;
      }

      try {
        const connection = await this.createConnection();
        this.activeConnections.add(connection);
        this.stats.active++;
        this.stats.lastUsed = new Date();
        this.logStatsIfNeeded(); // ✅ 添加统计调用
        return connection;
      } catch (unknownError: unknown) {
        const error = createErrorFromUnknown(unknownError, {
          component: 'RedisConnectionPool',
          operation: 'acquire.createConnection',
        });
        logger.error('RedisConnectionPool: Failed to create new connection:', error.toLogObject());
        throw error;
      }
    }

    // 池已满，等待连接释放
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMillis);

      this.waitingQueue.push({
        resolve,
        reject,
        timeout,
      });

      this.stats.waiting++;
      // ✅ 移除高频debug日志，改用定时统计
    });
  }

  /**
   * 释放连接
   */
  public release(connection: Redis): void {
    if (!this.activeConnections.has(connection)) {
      return; // 连接不在活跃集合中
    }

    this.activeConnections.delete(connection);
    this.stats.active--;
    this.stats.idle++;

    // 如果有等待的请求，立即分配
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        clearTimeout(waiting.timeout);

        this.activeConnections.add(connection);
        this.stats.active++;
        this.stats.idle = Math.max(0, this.stats.idle - 1);
        this.stats.waiting--;

        waiting.resolve(connection);
        // ✅ 移除重复的debug日志
      }
      // ✅ 移除重复的debug日志
    } else {
      // 将连接标记为空闲
      this.stats.lastUsed = new Date();
      // ✅ 移除高频debug日志
    }

    // ✅ 添加定时统计
    this.logStatsIfNeeded();
  }

  /**
   * 从池中移除连接
   */
  private removeConnection(connection: Redis): void {
    const index = this.pool.indexOf(connection);
    if (index !== -1) {
      this.pool.splice(index, 1);
      this.stats.total--;
    }

    this.activeConnections.delete(connection);
    this.stats.active = Math.max(0, this.stats.active - 1);

    // 如果有等待的请求，尝试创建新连接
    if (this.waitingQueue.length > 0 && this.pool.length < this.config.maxConnections!) {
      this.createConnection()
        .then(newConnection => {
          const waiting = this.waitingQueue.shift();
          if (waiting) {
            clearTimeout(waiting.timeout);
            this.activeConnections.add(newConnection);
            this.stats.active++;
            waiting.resolve(newConnection);
          }
        })
        .catch(error => {
          logger.error('RedisConnectionPool: Failed to create replacement connection:', error);
          const waiting = this.waitingQueue.shift();
          if (waiting) {
            clearTimeout(waiting.timeout);
            waiting.reject(error);
          }
        });
    }
  }

  /**
   * 获取连接池统计信息
   */
  public getStats(): ConnectionStats {
    return {
      ...this.stats,
      total: this.pool.length,
      idle: this.pool.filter(conn => !this.activeConnections.has(conn)).length,
    };
  }

  /**
   * 更新响应时间统计
   */
  private updateResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // 只保留最近100次请求的响应时间
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }

    // 计算平均响应时间
    this.stats.avgResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * 记录连接池统计信息（降频：每分钟最多1次）
   * ✅ 替代原来的高频debug日志
   */
  private logStatsIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastStatsTime > 60000) { // 60秒
      const stats = this.getStats();
      logger.info('RedisConnectionPool stats', {
        total: stats.total,
        active: stats.active,
        idle: stats.idle,
        waiting: stats.waiting,
        avgResponseTime: stats.avgResponseTime.toFixed(2) + 'ms',
      });
      this.lastStatsTime = now;
    }
  }

  /**
   * 启动维护任务
   */
  private startMaintenance(): void {
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, this.config.reapIntervalMillis);
  }

  /**
   * 执行维护任务
   */
  private performMaintenance(): void {
    // 关闭长时间空闲的连接
    const now = Date.now();
    const idleTimeout = this.config.idleTimeoutMillis!;

    for (let i = this.pool.length - 1; i >= 0; i--) {
      const connection = this.pool[i];
      if (connection && !this.activeConnections.has(connection) && this.stats.lastUsed) {
        const idleTime = now - this.stats.lastUsed.getTime();
        if (idleTime > idleTimeout && this.pool.length > this.config.minConnections!) {
          // ✅ 移除高频debug日志，维护操作不需要逐个记录
          connection.disconnect();
          this.removeConnection(connection);
        }
      }
    }
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const connection = await this.acquire();
      await connection.ping();
      this.release(connection);
      return true;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisConnectionPool',
        operation: 'healthCheck',
      });
      logger.error('RedisConnectionPool: Health check failed:', error.toLogObject());
      return false;
    }
  }

  /**
   * 关闭连接池
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    // 拒绝所有等待的请求
    this.waitingQueue.forEach(waiting => {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error('Connection pool is shutting down'));
    });
    this.waitingQueue = [];

    // 关闭所有连接
    const closePromises = this.pool.map(connection => {
      return connection.quit().catch(error => {
        logger.error('RedisConnectionPool: Error closing connection:', error);
      });
    });

    await Promise.all(closePromises);
    this.pool = [];
    this.activeConnections.clear();

    logger.info('RedisConnectionPool: Pool shutdown complete');
  }
}

export default RedisConnectionPool;
