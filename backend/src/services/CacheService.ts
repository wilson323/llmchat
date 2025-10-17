/**
 * Redis 缓存服务
 * 提供统一的缓存接口，支持多实例共享状态
 */

import Redis from 'ioredis';
import logger from '@/utils/logger';

export interface CacheOptions {
  ttl?: number;        // 过期时间（秒）
  nx?: boolean;        // 仅当 key 不存在时设置
  prefix?: string;     // key 前缀
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  dels: number;
  errors: number;
  hitRate: number;
}

/**
 * Redis 缓存服务类
 */
export class CacheService {
  private client: Redis | null = null;
  private connected = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    dels: 0,
    errors: 0,
    hitRate: 0,
  };

  private readonly prefix: string = 'llmchat';
  private readonly defaultTTL: number = 300; // 5 分钟

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * 连接到 Redis
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    const redisHost = process.env.REDIS_HOST;
    const redisPort = parseInt(process.env.REDIS_PORT ?? '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    if (!redisHost) {
      logger.warn('Redis 未配置，缓存功能将被禁用');
      return;
    }

    try {
      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        ...(redisPassword ? { password: redisPassword } : {}),
        retryStrategy: (times) => {
          if (times > 10) {
            logger.error('Redis 重连次数超过限制');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('error', (err) => {
        logger.error('Redis 客户端错误', { error: err });
        this.stats.errors++;
      });

      this.client.on('connect', () => {
        logger.info('Redis 连接成功');
        this.connected = true;
      });

      this.client.on('close', () => {
        logger.warn('Redis 连接断开');
        this.connected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis 重新连接中...');
      });

      // ioredis 自动连接，不需要显式调用 connect()
      // 等待连接完成
      await this.client.ping();
      this.connected = true;

      logger.info('✓ Redis 缓存服务已启动', { prefix: this.prefix, defaultTTL: this.defaultTTL });
    } catch (error) {
      logger.error('Redis 连接失败', { error });
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * 断开 Redis 连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis 连接已关闭');
    }
  }

  /**
   * 生成完整的 key（带前缀）
   */
  private getFullKey(key: string, prefix?: string): string {
    const p = prefix || this.prefix;
    return `${p}:${key}`;
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.client || !this.connected) {
      return null;
    }

    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const value = await this.client.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('缓存读取失败', { key, error });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);

      if (options?.nx) {
        // 仅当 key 不存在时设置（用于分布式锁）
        const result = await this.client.set(fullKey, serialized, 'EX', ttl, 'NX');
        this.stats.sets++;
        return result === 'OK';
      } else {
        await this.client.setex(fullKey, ttl, serialized);
        this.stats.sets++;
        return true;
      }
    } catch (error) {
      logger.error('缓存写入失败', { key, error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const result = await this.client.del(fullKey);
      this.stats.dels++;
      return result > 0;
    } catch (error) {
      logger.error('缓存删除失败', { key, error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 批量删除（通过模式匹配）
   */
  async delPattern(pattern: string, options?: CacheOptions): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    try {
      const fullPattern = this.getFullKey(pattern, options?.prefix);
      const keys = await this.client.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      this.stats.dels += result;
      return result;
    } catch (error) {
      logger.error('批量删除缓存失败', { pattern, error });
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * 检查 key 是否存在
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const result = await this.client.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('检查缓存存在失败', { key, error });
      return false;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const result = await this.client.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error('设置缓存过期时间失败', { key, ttl, error });
      return false;
    }
  }

  /**
   * 原子递增
   */
  async incr(key: string, options?: CacheOptions): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const result = await this.client.incr(fullKey);

      // 如果是新 key，设置过期时间
      if (result === 1 && options?.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      logger.error('缓存递增失败', { key, error });
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * 获取或设置缓存（缓存未命中时执行 fallback）
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T | null> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    try {
      // 缓存未命中，执行 fallback
      const value = await fallback();

      // 写入缓存
      await this.set(key, value, options);

      return value;
    } catch (error) {
      logger.error('getOrSet fallback 执行失败', { key, error });
      return null;
    }
  }

  /**
   * 分布式锁（简单实现）
   */
  async lock(key: string, ttl = 10): Promise<boolean> {
    return this.set(`lock:${key}`, Date.now(), { ttl, nx: true });
  }

  /**
   * 释放分布式锁
   */
  async unlock(key: string): Promise<boolean> {
    return this.del(`lock:${key}`);
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      dels: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Ping Redis
   */
  async ping(): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping 失败', { error });
      return false;
    }
  }

  /**
   * 获取Redis数据库键数量
   */
  async dbsize(): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    try {
      const size = await this.client.dbsize();
      return size;
    } catch (error) {
      logger.error('获取Redis dbsize失败', { error });
      return 0;
    }
  }

  /**
   * 健康检查
   * 返回缓存服务的健康状态和详细信息
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    details: {
      stats: CacheStats;
      redisConnected: boolean;
    };
  }> {
    const isConnected = this.isConnected();
    const canPing = await this.ping();

    let status: 'healthy' | 'degraded' | 'down';
    if (isConnected && canPing) {
      status = 'healthy';
    } else if (isConnected || canPing) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    return {
      status,
      details: {
        stats: this.getStats(),
        redisConnected: isConnected,
      },
    };
  }
}

// 全局单例
let cacheServiceInstance: CacheService | null = null;

/**
 * 获取缓存服务实例
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

/**
 * 初始化缓存服务
 */
export async function initCacheService(): Promise<CacheService> {
  const service = getCacheService();
  await service.connect();
  return service;
}

/**
 * 缓存装饰器（用于方法级缓存）
 */
export function Cacheable(key: string, ttl = 300) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = getCacheService();
      const cacheKey = `${key}:${JSON.stringify(args)}`;

      // 尝试从缓存获取
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // 缓存未命中，执行原方法
      const result = await originalMethod.apply(this, args);

      // 写入缓存
      await cache.set(cacheKey, result, { ttl });

      return result;
    };

    return descriptor;
  };
}

export default CacheService;
