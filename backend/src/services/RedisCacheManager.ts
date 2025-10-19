/**
 * Redis缓存管理器 - 高性能缓存层
 *
 * 功能特性:
 * - 多级缓存策略（L1内存 + L2 Redis）
 * - 智能缓存预热和失效
 * - 缓存穿透和雪崩防护
 * - 分布式锁支持
 * - 实时缓存监控
 * - 缓存压缩和序列化优化
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { AppConfig } from '@/config/AppConfig'; // ✅ 统一配置服务
import logger from '@/utils/logger';
import { createErrorFromUnknown } from '@/types/errors';

// 使用Node.js内置zlib替代lz4，避免原生模块编译问题
const compress = (data: Buffer): Buffer => gzipSync(data);
const decompress = (data: Buffer): Buffer => gunzipSync(data);

// 缓存项接口
export interface CacheItem<T = any> {
  /** 缓存数据 */
  data: T;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳 */
  expiresAt: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessAt: number;
  /** 数据大小（字节） */
  size: number;
  /** 是否压缩存储 */
  compressed: boolean;
  /** 缓存标签 */
  tags?: string[];
  /** 缓存来源 */
  source?: string;
}

// 缓存配置接口
export interface RedisCacheConfig {
  /** 默认TTL（秒） */
  defaultTtl: number;
  /** 最大内存缓存大小 */
  maxMemorySize: number;
  /** 压缩阈值（字节） */
  compressionThreshold: number;
  /** 缓存键前缀 */
  keyPrefix: string;
  /** 是否启用分布式锁 */
  enableLocks: boolean;
  /** 是否启用缓存预热 */
  enablePrewarming: boolean;
  /** 是否启用穿透防护 */
  enablePenetrationProtection: boolean;
  /** 是否启用雪崩防护 */
  enableAvalancheProtection: boolean;
  /** 穿透防护返回值 */
  nullFallback?: any;
}

// 缓存统计接口
export interface RedisCacheStats {
  /** 内存缓存项数 */
  memoryItems: number;
  /** 内存缓存大小 */
  memorySize: number;
  /** Redis连接状态 */
  redisConnected: boolean;
  /** 连接状态（别名） */
  connected: boolean;
  /** 总命中数 */
  hits: number;
  /** 总未命中数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 设置数 */
  sets: number;
  /** 删除数 */
  dels: number;
  /** 错误数 */
  errors: number;
  /** 压缩命中数 */
  compressionHits: number;
  /** 分布式锁数 */
  locks: number;
  /** 预热命中数 */
  prewarmedHits: number;
  /** 穿透防护命中数 */
  protectionHits: number;
  /** 雪崩防护命中数 */
  avalancheHits: number;
  /** 总请求数 */
  totalRequests: number;
  /** 内存使用量 */
  memoryUsage: number;
}

// 缓存策略枚举
export enum CacheStrategy {
  /** 仅内存缓存 */
  MEMORY_ONLY = 'memory_only',
  /** 仅Redis缓存 */
  REDIS_ONLY = 'redis_only',
  /** 内存+Redis（L1+L2） */
  HYBRID = 'hybrid',
  /** 写入时同步到Redis */
  WRITE_THROUGH = 'write_through',
  /** 写入时异步到Redis */
  WRITE_BEHIND = 'write_behind',
  /** 缓存未命中时写入 */
  CACHE_ASIDE = 'cache_aside',
}

/**
 * Redis缓存管理器类
 */
export class RedisCacheManager {
  private static instance: RedisCacheManager | null = null;
  private redis: Redis | null = null;
  private readonly memoryCache = new Map<string, CacheItem>();
  private config: RedisCacheConfig;
  private stats: RedisCacheStats;
  private readonly lockPromises = new Map<string, Promise<any>>();
  private readonly prewarmedKeys = new Set<string>();
  private readonly protectionCache = new Map<string, any>();

  constructor(config: Partial<RedisCacheConfig> = {}) {
    this.config = {
      defaultTtl: 300, // 5分钟
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      compressionThreshold: 1024, // 1KB
      keyPrefix: 'llmchat:cache',
      enableLocks: true,
      enablePrewarming: true,
      enablePenetrationProtection: true,
      enableAvalancheProtection: true,
      ...config,
    };

    this.stats = {
      memoryItems: 0,
      memorySize: 0,
      redisConnected: false,
      connected: false,
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      dels: 0,
      errors: 0,
      compressionHits: 0,
      locks: 0,
      prewarmedHits: 0,
      protectionHits: 0,
      avalancheHits: 0,
      totalRequests: 0,
      memoryUsage: 0,
    };
  }

  /**
   * 初始化Redis连接
   */
  async initialize(): Promise<void> {
    try {
      const redisConfig = AppConfig.getRedisConfig(); // ✅ 使用统一配置
      const redisHost = redisConfig.host;
      const redisPort = redisConfig.port;
      const redisPassword = redisConfig.password;

      if (redisHost) {
        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          ...(redisPassword ? { password: redisPassword } : {}),
          retryStrategy: (times) => {
            if (times > 10) {
              logger.error('Redis重连次数超过限制');
              return null;
            }
            return Math.min(times * 100, 3000);
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableAutoPipelining: true,
        });

        this.redis.on('connect', () => {
          logger.info('✅ Redis缓存管理器连接成功');
          this.stats.redisConnected = true;
        });

        this.redis.on('error', (err) => {
          logger.error('❌ Redis缓存管理器连接错误', { error: err });
          this.stats.redisConnected = false;
          this.stats.errors++;
        });

        this.redis.on('close', () => {
          logger.warn('⚠️ Redis缓存管理器连接断开');
          this.stats.redisConnected = false;
        });
      } else {
        logger.warn('⚠️ Redis未配置，将使用内存缓存模式');
      }

      // 启动缓存预热
      if (this.config.enablePrewarming) {
        setTimeout(() => this.startPrewarming(), 5000);
      }

      logger.info('🚀 Redis缓存管理器初始化完成', {
        config: {
          ...this.config,
          compressionThreshold: `${this.config.compressionThreshold}B`,
          maxMemorySize: `${(this.config.maxMemorySize / 1024 / 1024).toFixed(2)}MB`,
        },
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'initialize',
      });
      logger.error('❌ Redis缓存管理器初始化失败', error.toLogObject());
      this.stats.errors++;
    }
  }

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.stats.redisConnected = false;
    }
    this.memoryCache.clear();
    logger.info('📴 Redis缓存管理器已关闭');
  }

  /**
   * 生成缓存键
   */
  private generateKey(key: string, tags?: string[]): string {
    const baseKey = `${this.config.keyPrefix}:${key}`;
    if (tags && tags.length > 0) {
      const tagHash = createHash('md5').update(tags.join(':')).digest('hex').substring(0, 8);
      return `${baseKey}:${tagHash}`;
    }
    return baseKey;
  }

  /**
   * 压缩数据
   */
  private compressData(data: any): { compressed: boolean; data: any; size: number } {
    const serialized = JSON.stringify(data);
    const size = Buffer.byteLength(serialized, 'utf8');

    if (size > this.config.compressionThreshold) {
      try {
        const compressed = compress(Buffer.from(serialized));
        return {
          compressed: true,
          data: compressed,
          size: compressed.length,
        };
      } catch (unknownError: unknown) {
        const error = createErrorFromUnknown(unknownError, {
          component: 'RedisCacheManager',
          operation: 'compressData',
        });
        logger.warn('数据压缩失败，使用原始数据', { error: error.toLogObject(), size });
      }
    }

    return {
      compressed: false,
      data: serialized,
      size,
    };
  }

  /**
   * 解压数据
   */
  private decompressData(item: CacheItem): any {
    if (!item.compressed) {
      return JSON.parse(item.data as string);
    }

    try {
      const decompressed = decompress(item.data as Buffer);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'decompressData',
      });
      logger.error('数据解压失败', error.toLogObject());
      return null;
    }
  }

  /**
   * 确保内存缓存有足够空间
   */
  private ensureMemorySpace(requiredSize: number): void {
    // 检查总大小限制
    while (this.getCurrentMemorySize() + requiredSize > this.config.maxMemorySize) {
      this.evictLRUItem();
    }
  }

  /**
   * 驱逐最少使用的内存缓存项
   */
  private evictLRUItem(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, item] of this.memoryCache) {
      if (item.lastAccessAt < lruTime) {
        lruTime = item.lastAccessAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey);
      this.stats.memoryItems--;
      logger.debug('驱逐LRU内存缓存项', { key: lruKey.substring(0, 50) });
    }
  }

  /**
   * 获取当前内存缓存总大小
   */
  private getCurrentMemorySize(): number {
    let totalSize = 0;
    for (const item of this.memoryCache.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    this.stats.memoryItems = this.memoryCache.size;
    this.stats.memorySize = this.getCurrentMemorySize();
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options: {
    tags?: string[];
    strategy?: CacheStrategy;
  } = {}): Promise<T | null> {
    const now = Date.now();
    const fullKey = this.generateKey(key, options.tags);

    try {
      // 1. 尝试从内存缓存获取
      const memoryItem = this.memoryCache.get(fullKey);
      if (memoryItem && memoryItem.expiresAt > now) {
        memoryItem.accessCount++;
        memoryItem.lastAccessAt = now;
        this.stats.hits++;
        this.updateStats();
        logger.debug('🎯 内存缓存命中', { key: key.substring(0, 50) });
        return this.decompressData(memoryItem);
      }

      // 2. 穿透防护
      if (this.config.enablePenetrationProtection && options.tags) {
        const protectionKey = `protect:${fullKey}`;
        const protectedValue = this.protectionCache.get(protectionKey);
        if (protectedValue !== undefined) {
          this.stats.protectionHits++;
          logger.debug('🛡️ 穿透防护命中', { key: key.substring(0, 50) });
          return protectedValue;
        }
      }

      // 3. 尝试从Redis获取
      if (this.redis && this.stats.redisConnected) {
        try {
          const redisValue = await this.redis.get(fullKey);
          if (redisValue) {
            const redisItem: CacheItem = JSON.parse(redisValue);

            // 雪崩防护：如果大量请求同时访问，设置短期保护
            if (this.config.enableAvalancheProtection && redisItem.accessCount > 100) {
              const protectionKey = `protect:${fullKey}`;
              const protectionTtl = Math.min(60, redisItem.expiresAt - now);
              this.protectionCache.set(protectionKey, this.decompressData(redisItem));
              this.stats.avalancheHits++;
              logger.debug('🏔️ 雪崩防护触发', { key: key.substring(0, 50) });
            }

            // 写入内存缓存（如果策略允许）
            if (options.strategy !== CacheStrategy.REDIS_ONLY) {
              this.ensureMemorySpace(redisItem.size);
              this.memoryCache.set(fullKey, {
                ...redisItem,
                accessCount: redisItem.accessCount + 1,
                lastAccessAt: now,
              });
            }

            this.stats.hits++;
            this.updateStats();
            logger.debug('🔥 Redis缓存命中', { key: key.substring(0, 50) });
            return this.decompressData(redisItem);
          }
        } catch (unknownError: unknown) {
          const error = createErrorFromUnknown(unknownError, {
            component: 'RedisCacheManager',
            operation: 'get.redisRead',
          });
          logger.error('Redis缓存读取失败', { key, ...error.toLogObject() });
          this.stats.errors++;
        }
      }

      this.stats.misses++;
      this.updateStats();
      logger.debug('❌ 缓存未命中', { key: key.substring(0, 50) });
      return null;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'get',
      });
      logger.error('缓存获取失败', { key, ...error.toLogObject() });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      strategy?: CacheStrategy;
      compress?: boolean;
    } = {}
  ): Promise<boolean> {
    const now = Date.now();
    const ttl = options.ttl || this.config.defaultTtl;
    const fullKey = this.generateKey(key, options.tags);
    const expiresAt = now + ttl;

    try {
      // 压缩数据
      const { compressed, data, size } = this.compressData(value);

      const cacheItem: CacheItem<T> = {
        data,
        createdAt: now,
        expiresAt,
        accessCount: 0,
        lastAccessAt: now,
        size,
        compressed,
        ...(options.tags && { tags: options.tags }),
        source: 'set',
      };

      // 1. 写入内存缓存
      if (options.strategy !== CacheStrategy.REDIS_ONLY) {
        this.ensureMemorySpace(size);
        this.memoryCache.set(fullKey, cacheItem);
      }

      // 2. 写入Redis
      if (this.redis && this.stats.redisConnected && options.strategy !== CacheStrategy.MEMORY_ONLY) {
        try {
          const serialized = JSON.stringify(cacheItem);
          await this.redis.setex(fullKey, ttl, serialized);
        } catch (unknownError: unknown) {
          const error = createErrorFromUnknown(unknownError, {
            component: 'RedisCacheManager',
            operation: 'set.redisWrite',
          });
          logger.error('Redis缓存写入失败', { key, ...error.toLogObject() });
          this.stats.errors++;
          return false;
        }
      }

      this.stats.sets++;
      this.updateStats();
      logger.debug('💾 缓存设置成功', {
        key: key.substring(0, 50),
        ttl,
        size,
        compressed,
        strategy: options.strategy
      });
      return true;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'set',
      });
      logger.error('缓存设置失败', { key, ...error.toLogObject() });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string, options: { tags?: string[] } = {}): Promise<boolean> {
    return await this.delete(key, options);
  }

  /**
   * 删除缓存（别名方法）
   */
  async delete(key: string, options: { tags?: string[] } = {}): Promise<boolean> {
    const fullKey = this.generateKey(key, options.tags);

    try {
      // 从内存缓存删除
      const memoryDeleted = this.memoryCache.delete(fullKey);
      if (memoryDeleted) {
        this.stats.memoryItems--;
      }

      // 从Redis删除
      let redisDeleted = false;
      if (this.redis && this.stats.redisConnected) {
        try {
          const result = await this.redis.del(fullKey);
          redisDeleted = result > 0;
        } catch (unknownError: unknown) {
          const error = createErrorFromUnknown(unknownError, {
            component: 'RedisCacheManager',
            operation: 'delete.redisDelete',
          });
          logger.error('Redis缓存删除失败', { key, ...error.toLogObject() });
          this.stats.errors++;
        }
      }

      if (memoryDeleted || redisDeleted) {
        this.stats.dels++;
        this.updateStats();
        logger.debug('🗑️ 缓存删除成功', { key: key.substring(0, 50) });
        return true;
      }

      return false;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'delete',
      });
      logger.error('缓存删除失败', { key, ...error.toLogObject() });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 按标签批量删除缓存
   */
  async delByTag(tag: string): Promise<number> {
    let deletedCount = 0;

    try {
      // 删除内存缓存中的匹配项
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.tags && item.tags.includes(tag)) {
          this.memoryCache.delete(key);
          this.stats.memoryItems--;
          deletedCount++;
        }
      }

      // 删除Redis中的匹配项（如果模式匹配）
      if (this.redis && this.stats.redisConnected) {
        try {
          const pattern = `${this.config.keyPrefix}:*:${tag}`;
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            const result = await this.redis.del(keys);
            deletedCount += result;
          }
        } catch (unknownError: unknown) {
          const error = createErrorFromUnknown(unknownError, {
            component: 'RedisCacheManager',
            operation: 'delByTag.redisBatchDelete',
          });
          logger.error('Redis批量删除失败', { tag, ...error.toLogObject() });
          this.stats.errors++;
        }
      }

      if (deletedCount > 0) {
        this.stats.dels += deletedCount;
        this.updateStats();
        logger.info('🏷️ 按标签删除缓存', { tag, count: deletedCount });
      }

      return deletedCount;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'delByTag',
      });
      logger.error('按标签删除缓存失败', { tag, ...error.toLogObject() });
      this.stats.errors++;
      return 0;
    }
  }

  // Duplicate clear function removed - detailed version exists at line 1172

  /**
   * 获取或设置缓存（缓存未命中时执行fallback）
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    options: {
      ttl?: number;
      tags?: string[];
      strategy?: CacheStrategy;
      compress?: boolean;
    } = {}
  ): Promise<T | null> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    try {
      // 缓存未命中，执行fallback
      const result = await fallback();

      // 写入缓存
      await this.set(key, result, options);

      return result;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'getOrSet',
      });
      logger.error('getOrSet fallback执行失败', { key, ...error.toLogObject() });
      return null;
    }
  }

  /**
   * 分布式锁
   */
  async lock(
    key: string,
    ttl = 30,
    options: { retry?: number; delay?: number } = {}
  ): Promise<boolean> {
    if (!this.config.enableLocks) {
      return true; // 未启用锁，直接返回成功
    }

    const lockKey = `lock:${this.generateKey(key)}`;
    const retry = options.retry ?? 0;
    const delay = options.delay ?? 100;

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        // 检查是否已有锁
        if (this.lockPromises.has(lockKey)) {
          const existingPromise = this.lockPromises.get(lockKey);
          if (existingPromise) {
            const result = await existingPromise;
            if (result) {
              return true;
            }
          }
        }

        // 尝试获取锁
        // 使用Redis原生的SET NX EX命令实现分布式锁
        const lockValue = JSON.stringify({
          locked: true,
          timestamp: Date.now()
        });

        let acquired = false;
        if (this.redis && this.stats.redisConnected) {
          const result = await this.redis.set(lockKey, lockValue, 'EX', ttl, 'NX');
          acquired = result === 'OK';
        }

        if (acquired) {
          this.stats.locks++;
          logger.debug('🔒 分布式锁获取成功', { key: key.substring(0, 50) });

          // 设置锁过期自动释放
          setTimeout(async () => {
            await this.unlock(key);
          }, ttl * 1000);

          return true;
        }

        // 等待重试
        if (attempt < retry) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (unknownError: unknown) {
        const error = createErrorFromUnknown(unknownError, {
          component: 'RedisCacheManager',
          operation: 'lock',
        });
        logger.error('分布式锁获取失败', { key, attempt, error: error.toLogObject() });
        this.stats.errors++;
      }
    }

    return false;
  }

  /**
   * 释放分布式锁
   */
  async unlock(key: string): Promise<boolean> {
    if (!this.config.enableLocks) {
      return true;
    }

    try {
      const result = await this.del(`lock:${key}`);
      this.lockPromises.delete(`lock:${this.generateKey(key)}`);
      logger.debug('🔓 分布式锁释放', { key: key.substring(0, 50) });
      return result;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'unlock',
      });
      logger.error('分布式锁释放失败', { key, ...error.toLogObject() });
      return false;
    }
  }

  /**
   * 缓存预热
   */
  async prewarmKeys(keys: Array<{
    key: string;
    fallback: () => Promise<any>;
    ttl?: number;
    tags?: string[];
  }>): Promise<void> {
    if (!this.config.enablePrewarming) {
      return;
    }

    logger.info('🔥 开始缓存预热', { keyCount: keys.length });

    const promises = keys.map(async ({ key, fallback, ttl, tags }) => {
      try {
        const options: { ttl?: number; tags?: string[] } = {};
        if (ttl !== undefined) options.ttl = ttl;
        if (tags) options.tags = tags;
        await this.getOrSet(key, fallback, options);
        this.prewarmedKeys.add(key);
        this.stats.prewarmedHits++;
      } catch (unknownError: unknown) {
        const error = createErrorFromUnknown(unknownError, {
          component: 'RedisCacheManager',
          operation: 'prewarmKeys',
        });
        logger.error('缓存预热失败', { key, ...error.toLogObject() });
      }
    });

    const results = await Promise.allSettled(promises);
    logger.info('✅ 缓存预热完成', {
      totalKeys: keys.length,
      successCount: results.filter(r => r.status === 'fulfilled').length
    });
  }

  /**
   * 启动缓存预热
   */
  private async startPrewarming(): Promise<void> {
    // 这里可以预加载常用数据
    const prewarmData = [
      {
        key: 'system:config',
        fallback: async () => ({
          version: '1.0.0',
          features: ['redis', 'memory', 'compression', 'locks'],
        }),
        ttl: 3600, // 1小时
      },
      {
        key: 'stats:cache:warmup',
        fallback: async () => ({
          timestamp: Date.now(),
          type: 'warmup',
        }),
        ttl: 1800, // 30分钟
      },
    ];

    await this.prewarmKeys(prewarmData);
  }

  /**
   * 获取缓存统计
   */
  getStats(): RedisCacheStats {
    return { ...this.stats };
  }

  /**
   * 获取内存缓存详情
   */
  getMemoryCacheItems(limit = 50): CacheItem[] {
    return Array.from(this.memoryCache.values())
      .sort((a, b) => b.lastAccessAt - a.lastAccessAt)
      .slice(0, limit);
  }

  /**
   * Redis健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    details: {
      memoryCache: { items: number; size: string };
      redis: { connected: boolean; latency?: number };
      stats: RedisCacheStats;
    };
  }> {
    const details = {
      memoryCache: {
        items: this.stats.memoryItems,
        size: `${(this.stats.memorySize / 1024 / 1024).toFixed(2)}MB`,
      },
      redis: {
        connected: this.stats.redisConnected,
        latency: 0,
      },
      stats: this.stats,
    };

    // 检查Redis延迟
    if (this.redis && this.stats.redisConnected) {
      try {
        const start = Date.now();
        await this.redis.ping();
        details.redis.latency = Date.now() - start;
      } catch (unknownError: unknown) {
        const error = createErrorFromUnknown(unknownError, {
          component: 'RedisCacheManager',
          operation: 'healthCheck.redisPing',
        });
        logger.error('Redis健康检查失败', error.toLogObject());
        details.redis.connected = false;
      }
    }

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (!details.redis.connected) {
      status = this.stats.memoryItems > 0 ? 'degraded' : 'down';
    }

    return { status, details };
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(): Promise<string> {
    const stats = this.getStats();
    const memoryItems = Array.from(this.memoryCache.entries()).slice(0, 10).map(([key, item]) => ({
      key,
      ...item
    }));
    const health = await this.healthCheck();

    return `
Redis缓存性能报告
===================

📊 基础统计
- 内存缓存项数: ${stats.memoryItems}
- 内存缓存大小: ${(stats.memorySize / 1024 / 1024).toFixed(2)}MB
- Redis连接状态: ${stats.redisConnected ? '已连接' : '未连接'}
- 总命中数: ${stats.hits}
- 总未命中数: ${stats.misses}
- 命中率: ${stats.hitRate.toFixed(2)}%

⚡ 性能指标
- 设置操作数: ${stats.sets}
- 删除操作数: ${stats.dels}
- 错误数: ${stats.errors}
- 压缩命中数: ${stats.compressionHits}

🔒 高级功能
- 分布式锁数: ${stats.locks}
- 预热命中数: ${stats.prewarmedHits}
- 穿透防护命中: ${stats.protectionHits}
- 雪崩防护命中: ${stats.avalancheHits}

🏥 健康状态
- 整体状态: ${health.status}
- Redis延迟: ${health.details.redis.latency ? `${health.details.redis.latency}ms` : 'N/A'}

🔥 热门缓存项TOP10
${memoryItems.length > 0 ?
  memoryItems.map((item, index) => {
    const age = (Date.now() - item.createdAt) / 1000;
    return `${index + 1}. ${item.key.substring(0, 50)}... (访问${item.accessCount}次, ${age.toFixed(0)}秒前)`;
  }).join('\n') :
  '暂无内存缓存项'
}

💡 优化建议
${this.generateRecommendations()}
    `.trim();
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    // 命中率建议
    if (stats.hitRate < 70) {
      recommendations.push('命中率较低，建议检查缓存策略或增加TTL时间');
    } else if (stats.hitRate > 95) {
      recommendations.push('命中率很高，缓存策略效果良好');
    }

    // 内存使用建议
    const memoryUsage = stats.memorySize / this.config.maxMemorySize;
    if (memoryUsage > 0.9) {
      recommendations.push('内存缓存使用率过高，建议增加最大内存大小');
    } else if (memoryUsage < 0.3) {
      recommendations.push('内存缓存使用率较低，可以减少最大内存大小以节省资源');
    }

    // Redis连接建议
    if (!stats.redisConnected) {
      recommendations.push('Redis未连接，检查Redis服务状态');
    }

    // 错误率建议
    const errorRate = stats.errors / (stats.hits + stats.misses + stats.errors) * 100;
    if (errorRate > 5) {
      recommendations.push('错误率较高，检查Redis连接和网络状态');
    }

    return recommendations.length > 0 ? recommendations : ['缓存运行状态良好'];
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<RedisCacheConfig>): RedisCacheManager {
    if (!RedisCacheManager.instance) {
      RedisCacheManager.instance = new RedisCacheManager(config);
    }
    return RedisCacheManager.instance;
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      // 先检查内存缓存
      if (this.memoryCache.has(key)) {
        return true;
      }

      // 检查Redis
      if (this.redis && this.stats.redisConnected) {
        const result = await this.redis.exists(key);
        return result === 1;
      }

      return false;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'exists',
      });
      logger.error('检查缓存存在性失败', { key, ...error.toLogObject() });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 获取缓存TTL
   */
  async getTtl(key: string): Promise<number> {
    try {
      if (this.redis && this.stats.redisConnected) {
        const ttl = await this.redis.ttl(key);
        return ttl;
      }
      return -1;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'getTtl',
      });
      logger.error('获取缓存TTL失败', { key, ...error.toLogObject() });
      this.stats.errors++;
      return -1;
    }
  }

  /**
   * 按标签删除缓存
   */
  async deleteByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;

    for (const tag of tags) {
      deletedCount += await this.delByTag(tag);
    }

    return deletedCount;
  }

  /**
   * 根据模式获取键列表
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      const keys: string[] = [];

      // 内存缓存键
      const fullPattern = this.config.keyPrefix ? `${this.config.keyPrefix}:${pattern}` : pattern;
      for (const key of this.memoryCache.keys()) {
        if (this.matchPattern(key, fullPattern)) {
          keys.push(key);
        }
      }

      // Redis键
      if (this.redis && this.stats.redisConnected) {
        try {
          const redisKeys = await this.redis.keys(fullPattern);
          keys.push(...redisKeys);
        } catch (unknownError: unknown) {
          const error = createErrorFromUnknown(unknownError, {
            component: 'RedisCacheManager',
            operation: 'getKeysByPattern.redisKeys',
          });
          logger.error('获取Redis键列表失败', { pattern, ...error.toLogObject() });
          this.stats.errors++;
        }
      }

      return [...new Set(keys)]; // 去重
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'getKeysByPattern',
      });
      logger.error('获取键列表失败', { pattern, ...error.toLogObject() });
      this.stats.errors++;
      return [];
    }
  }

  /**
   * 根据标签获取键列表
   */
  async getKeysByTags(tags: string[]): Promise<string[]> {
    try {
      const keys: string[] = [];

      // 内存缓存中的键
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.tags && tags.some(tag => item.tags!.includes(tag))) {
          keys.push(key);
        }
      }

      // Redis中的键（简化处理）
      if (this.redis && this.stats.redisConnected) {
        for (const tag of tags) {
          try {
            const tagPattern = `${this.config.keyPrefix}:*:${tag}`;
            const redisKeys = await this.redis.keys(tagPattern);
            keys.push(...redisKeys);
          } catch (unknownError: unknown) {
            const error = createErrorFromUnknown(unknownError, {
              component: 'RedisCacheManager',
              operation: 'getKeysByTags.tagKeys',
            });
            logger.error('获取标签键列表失败', { tag, ...error.toLogObject() });
            this.stats.errors++;
          }
        }
      }

      return [...new Set(keys)]; // 去重
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'getKeysByTags',
      });
      logger.error('根据标签获取键列表失败', { tags, ...error.toLogObject() });
      this.stats.errors++;
      return [];
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RedisCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('缓存配置已更新', { config: this.config });
  }

  /**
   * 获取配置
   */
  getConfig(): RedisCacheConfig {
    return { ...this.config };
  }

  /**
   * 简单的模式匹配
   */
  private matchPattern(key: string, pattern: string): boolean {
    // 简单的通配符匹配，实际项目中可以使用更复杂的模式匹配
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    const connectedState = this.stats.redisConnected;
    this.stats = {
      memoryItems: 0,
      memorySize: 0,
      redisConnected: connectedState,
      connected: connectedState,
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      dels: 0,
      errors: 0,
      compressionHits: 0,
      locks: 0,
      prewarmedHits: 0,
      protectionHits: 0,
      avalancheHits: 0,
      totalRequests: 0,
      memoryUsage: 0,
    };
    logger.info('缓存统计已重置');
  }

  /**
   * 停止缓存管理器
   */
  async stop(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
      this.memoryCache.clear();
      this.lockPromises.clear();
      this.prewarmedKeys.clear();
      this.protectionCache.clear();
      this.stats.redisConnected = false;
      logger.info('Redis缓存管理器已停止');
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'stop',
      });
      logger.error('停止Redis缓存管理器失败', error.toLogObject());
    }
  }

  // Duplicate healthCheck function removed - detailed version exists at line 817

  /**
   * 缓存预热
   */
  async warmup(data: Array<{
    key: string;
    value: any;
    ttl?: number;
    tags?: string[];
  }>): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    for (const item of data) {
      try {
        const options: { ttl?: number; tags?: string[] } = {};
        if (item.ttl !== undefined) options.ttl = item.ttl;
        if (item.tags) options.tags = item.tags;
        const result = await this.set(item.key, item.value, options);
        if (result) {
          success++;
          this.prewarmedKeys.add(item.key);
        } else {
          failed++;
        }
      } catch (unknownError: unknown) {
        const error = createErrorFromUnknown(unknownError, {
          component: 'RedisCacheManager',
          operation: 'warmup',
        });
        logger.error('预热缓存项失败', { key: item.key, error: error.toLogObject() });
        failed++;
      }
    }

    logger.info(`缓存预热完成`, { total: data.length, success, failed });
    return { success, failed };
  }

  /**
   * 清空缓存
   */
  async clear(pattern = '*'): Promise<number> {
    let deletedCount = 0;

    try {
      // 清空内存缓存
      if (pattern === '*') {
        const itemCount = this.memoryCache.size;
        this.memoryCache.clear();
        deletedCount += itemCount;
        this.stats.memoryItems = 0;
        this.stats.memorySize = 0;
      } else {
        const keysToDelete: string[] = [];
        for (const key of this.memoryCache.keys()) {
          if (this.matchPattern(key, pattern)) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          const item = this.memoryCache.get(key);
          if (item) {
            this.stats.memoryItems--;
            this.stats.memorySize -= item.size;
          }
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }

      // 清空Redis缓存
      if (this.redis && this.stats.redisConnected) {
        try {
          const redisDeleted = await this.redis.del(pattern);
          deletedCount += redisDeleted;
        } catch (unknownError: unknown) {
          const error = createErrorFromUnknown(unknownError, {
            component: 'RedisCacheManager',
            operation: 'clear.redisDelete',
          });
          logger.error('清空Redis缓存失败', { pattern, ...error.toLogObject() });
          this.stats.errors++;
        }
      }

      this.stats.dels += deletedCount;
      logger.info('缓存清空完成', { pattern, deletedCount });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'RedisCacheManager',
        operation: 'clear',
      });
      logger.error('清空缓存失败', { pattern, ...error.toLogObject() });
      this.stats.errors++;
    }

    return deletedCount;
  }
}

// 创建全局实例
export const redisCacheManager = new RedisCacheManager();

export default RedisCacheManager;
