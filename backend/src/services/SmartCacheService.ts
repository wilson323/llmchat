/**
 * 智能缓存服务
 * 
 * 提供高级缓存策略：
 * - 多层缓存（内存+Redis）
 * - 智能失效策略
 * - 缓存预热
 * - 缓存命中率统计
 */

import { getCacheService } from '@/services/CacheService';
import logger from '@/utils/logger';

/**
 * 缓存配置
 */
export interface CacheConfig {
  ttl: number;                    // 过期时间（秒）
  prefix: string;                 // 缓存键前缀
  enableMemoryCache?: boolean;    // 启用内存缓存
  memoryTtl?: number;            // 内存缓存TTL（秒）
  tags?: string[];               // 缓存标签（用于批量失效）
}

/**
 * 缓存统计
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

/**
 * 智能缓存服务
 */
export class SmartCacheService {
  private static instance: SmartCacheService | null = null;
  private readonly memoryCache: Map<string, { value: any; expiresAt: number }> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };
  private readonly tagIndex: Map<string, Set<string>> = new Map();

  private constructor() {
    // 定期清理过期的内存缓存（每分钟）
    setInterval(() => this.cleanupMemoryCache(), 60000);
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SmartCacheService {
    if (!SmartCacheService.instance) {
      SmartCacheService.instance = new SmartCacheService();
    }
    return SmartCacheService.instance;
  }

  /**
   * 获取缓存值（带智能回源）
   */
  public async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    config: CacheConfig,
  ): Promise<T> {
    const fullKey = `${config.prefix}:${key}`;

    // 1. 尝试从内存缓存获取
    if (config.enableMemoryCache) {
      const memValue = this.getFromMemory(fullKey);
      if (memValue !== null) {
        this.stats.hits++;
        this.updateHitRate();
        return memValue as T;
      }
    }

    // 2. 尝试从Redis获取
    try {
      const cacheService = getCacheService();
      if (cacheService.isConnected()) {
        const cached = await cacheService.get(fullKey);
        if (cached !== null) {
          this.stats.hits++;
          this.updateHitRate();

          // 回填到内存缓存
          if (config.enableMemoryCache) {
            this.setToMemory(fullKey, cached, config.memoryTtl || 30);
          }

          return cached as T;
        }
      }
    } catch (error) {
      logger.warn('SmartCache: Redis获取失败，回源数据', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. 缓存未命中，执行回源
    this.stats.misses++;
    this.updateHitRate();

    const value = await fallback();

    // 4. 存储到缓存
    await this.set(fullKey, value, config);

    return value;
  }

  /**
   * 设置缓存
   */
  public async set<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    const fullKey = key.startsWith(config.prefix) ? key : `${config.prefix}:${key}`;

    this.stats.sets++;

    // 存储到Redis
    try {
      const cacheService = getCacheService();
      if (cacheService.isConnected()) {
        await cacheService.set(fullKey, value, { ttl: config.ttl });
      }
    } catch (error) {
      logger.error('SmartCache: Redis存储失败', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 存储到内存缓存
    if (config.enableMemoryCache) {
      this.setToMemory(fullKey, value, config.memoryTtl || 30);
    }

    // 更新标签索引
    if (config.tags) {
      for (const tag of config.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(fullKey);
      }
    }
  }

  /**
   * 删除缓存
   */
  public async delete(key: string, prefix?: string): Promise<void> {
    const fullKey = prefix ? `${prefix}:${key}` : key;

    this.stats.deletes++;

    // 从内存删除
    this.memoryCache.delete(fullKey);

    // 从Redis删除
    try {
      const cacheService = getCacheService();
      if (cacheService.isConnected()) {
        await cacheService.del(fullKey);
      }
    } catch (error) {
      logger.error('SmartCache: Redis删除失败', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 从标签索引中移除
    for (const [tag, keys] of this.tagIndex.entries()) {
      keys.delete(fullKey);
    }
  }

  /**
   * 按标签批量失效
   */
  public async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    let invalidated = 0;
    for (const key of keys) {
      await this.delete(key);
      invalidated++;
    }

    this.tagIndex.delete(tag);

    logger.info('SmartCache: 按标签失效缓存', {
      tag,
      invalidated,
    });

    return invalidated;
  }

  /**
   * 批量失效（按模式匹配）
   */
  public async invalidatePattern(pattern: string): Promise<number> {
    let invalidated = 0;

    // 从内存缓存失效
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    // 注意：CacheService目前不支持keys()方法
    // 需要依赖标签系统或者扩展CacheService
    
    logger.info('SmartCache: 按模式失效缓存（仅内存）', {
      pattern,
      invalidated,
    });

    return invalidated;
  }

  /**
   * 从内存缓存获取
   */
  private getFromMemory(key: string): any | null {
    const item = this.memoryCache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * 存储到内存缓存
   */
  private setToMemory(key: string, value: any, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryCache.set(key, { value, expiresAt });
  }

  /**
   * 清理过期的内存缓存
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiresAt) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('SmartCache: 清理过期内存缓存', { cleaned });
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 获取缓存统计
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };

    logger.info('SmartCache: 统计已重置');
  }

  /**
   * 清空所有缓存
   */
  public async clear(): Promise<void> {
    // 清空内存缓存
    this.memoryCache.clear();
    this.tagIndex.clear();

    // 注意：CacheService目前不支持clear()方法
    // 需要手动删除各个缓存键或扩展CacheService

    logger.warn('SmartCache: 内存缓存已清空');
  }

  /**
   * 获取缓存大小
   */
  public getCacheSize(): { memory: number; redis: number } {
    return {
      memory: this.memoryCache.size,
      redis: 0, // TODO: 从Redis获取
    };
  }
}

// 导出单例实例
export default SmartCacheService;

// 预定义的缓存配置
export const CacheConfigs = {
  // 智能体列表缓存（5分钟）
  AGENTS_LIST: {
    ttl: 300,
    prefix: 'agents',
    enableMemoryCache: true,
    memoryTtl: 60,
    tags: ['agents'],
  } as CacheConfig,

  // 单个智能体缓存（10分钟）
  AGENT_DETAIL: {
    ttl: 600,
    prefix: 'agent',
    enableMemoryCache: true,
    memoryTtl: 120,
    tags: ['agents'],
  } as CacheConfig,

  // 用户会话列表（1分钟，频繁更新）
  USER_SESSIONS: {
    ttl: 60,
    prefix: 'user:sessions',
    enableMemoryCache: true,
    memoryTtl: 30,
    tags: ['sessions'],
  } as CacheConfig,

  // 会话详情（3分钟）
  SESSION_DETAIL: {
    ttl: 180,
    prefix: 'session',
    enableMemoryCache: true,
    memoryTtl: 60,
    tags: ['sessions'],
  } as CacheConfig,

  // 会话消息（30秒，实时性要求高）
  SESSION_MESSAGES: {
    ttl: 30,
    prefix: 'session:messages',
    enableMemoryCache: false, // 消息量大，不适合内存缓存
    tags: ['messages'],
  } as CacheConfig,

  // 用户信息（5分钟）
  USER_INFO: {
    ttl: 300,
    prefix: 'user:info',
    enableMemoryCache: true,
    memoryTtl: 120,
    tags: ['users'],
  } as CacheConfig,
};

