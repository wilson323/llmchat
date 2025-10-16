/**
 * 数据库查询缓存工具
 *
 * 提供查询结果缓存、智能失效、缓存统计等功能
 */

import { createHash } from 'crypto';
import logger from '@/utils/logger';

// 缓存项接口
export interface CacheItem<T = any> {
  /** 缓存的数据 */
  data: T;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessAt: number;
  /** 缓存键 */
  key: string;
  /** 查询语句 */
  query: string;
  /** 参数 */
  params?: any[];
  /** 数据标签（用于失效） */
  tags?: string[];
  /** 数据大小（字节） */
  size: number;
}

// 缓存配置接口
export interface CacheConfig {
  /** 默认TTL（毫秒） */
  defaultTtl: number;
  /** 最大缓存项数量 */
  maxItems: number;
  /** 最大缓存大小（字节） */
  maxSize: number;
  /** 清理间隔（毫秒） */
  cleanupInterval: number;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 压缩阈值（字节） */
  compressionThreshold: number;
}

// 缓存统计接口
export interface CacheStats {
  /** 总缓存项数 */
  totalItems: number;
  /** 缓存大小（字节） */
  totalSize: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 过期项数 */
  expiredItems: number;
  /** 被驱逐项数 */
  evictedItems: number;
  /** 创建项数 */
  createdItems: number;
  /** 更新项数 */
  updatedItems: number;
}

/**
 * 查询缓存类
 */
export class QueryCache {
  private readonly cache = new Map<string, CacheItem>();
  private config: CacheConfig;
  private readonly stats: CacheStats = {
    totalItems: 0,
    totalSize: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    expiredItems: 0,
    evictedItems: 0,
    createdItems: 0,
    updatedItems: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly tagIndex = new Map<string, Set<string>>(); // 标签到缓存键的索引

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5分钟
      maxItems: 1000,
      maxSize: 100 * 1024 * 1024, // 100MB
      cleanupInterval: 60 * 1000, // 1分钟
      enableCompression: false,
      compressionThreshold: 1024, // 1KB
      ...config,
    };

    this.startCleanupTimer();
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: string, params?: any[]): string {
    const keyData = {
      query: query.trim().toLowerCase(),
      params: params || [],
    };

    const keyString = JSON.stringify(keyData);
    return createHash('md5').update(keyString).digest('hex');
  }

  /**
   * 计算数据大小
   */
  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  /**
   * 压缩数据（如果需要）
   */
  private compressData(data: any): any {
    if (!this.config.enableCompression) {
      return data;
    }

    const size = this.calculateSize(data);
    if (size < this.config.compressionThreshold) {
      return data;
    }

    // 这里可以添加实际的压缩逻辑
    // 为了简单起见，暂时返回原数据
    return data;
  }

  /**
   * 解压数据
   */
  private decompressData(data: any): any {
    // 对应压缩逻辑的实现
    return data;
  }

  /**
   * 设置缓存项
   */
  set<T = any>(
    query: string,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      params?: any[];
    } = {}
  ): void {
    const cacheKey = this.generateCacheKey(query, options.params);
    const now = Date.now();
    const ttl = options.ttl || this.config.defaultTtl;
    const size = this.calculateSize(data);

    // 检查是否需要清理空间
    this.ensureSpace(size);

    const cacheItem: CacheItem<T> = {
      data: this.compressData(data),
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessAt: now,
      key: cacheKey,
      query,
      params: options.params || [],
      tags: options.tags || [],
      size,
    };

    const isUpdate = this.cache.has(cacheKey);
    this.cache.set(cacheKey, cacheItem);

    // 更新标签索引
    if (options.tags) {
      options.tags.forEach(tag => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(cacheKey);
      });
    }

    // 更新统计
    if (isUpdate) {
      this.stats.updatedItems++;
    } else {
      this.stats.createdItems++;
      this.stats.totalItems++;
    }
    this.stats.totalSize = this.getCurrentTotalSize();

    logger.debug('缓存项已设置', {
      cacheKey: cacheKey.substring(0, 8),
      isUpdate,
      size,
      ttl,
    });
  }

  /**
   * 获取缓存项
   */
  get<T = any>(query: string, params?: any[]): T | null {
    const cacheKey = this.generateCacheKey(query, params);
    const item = this.cache.get(cacheKey);

    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();

    // 检查是否过期
    if (now > item.expiresAt) {
      this.delete(cacheKey);
      this.stats.misses++;
      this.stats.expiredItems++;
      this.updateHitRate();
      return null;
    }

    // 更新访问统计
    item.accessCount++;
    item.lastAccessAt = now;

    this.stats.hits++;
    this.updateHitRate();

    logger.debug('缓存命中', {
      cacheKey: cacheKey.substring(0, 8),
      accessCount: item.accessCount,
      age: now - item.createdAt,
    });

    return this.decompressData(item.data);
  }

  /**
   * 删除缓存项
   */
  delete(cacheKey: string): boolean {
    const item = this.cache.get(cacheKey);
    if (!item) {
      return false;
    }

    // 从标签索引中移除
    if (item.tags) {
      item.tags.forEach(tag => {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.delete(cacheKey);
          if (keys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      });
    }

    this.cache.delete(cacheKey);
    this.stats.totalItems--;
    this.stats.totalSize = this.getCurrentTotalSize();

    return true;
  }

  /**
   * 按标签删除缓存项
   */
  deleteByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return 0;
    }

    let deletedCount = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deletedCount++;
      }
    }

    logger.info(`按标签删除缓存项`, { tag, deletedCount });
    return deletedCount;
  }

  /**
   * 按查询模式删除缓存项
   */
  deleteByQueryPattern(pattern: RegExp): number {
    let deletedCount = 0;

    for (const [key, item] of this.cache) {
      if (pattern.test(item.query)) {
        if (this.delete(key)) {
          deletedCount++;
        }
      }
    }

    logger.info(`按查询模式删除缓存项`, { pattern: pattern.toString(), deletedCount });
    return deletedCount;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const itemCount = this.cache.size;
    this.cache.clear();
    this.tagIndex.clear();

    this.stats.totalItems = 0;
    this.stats.totalSize = 0;

    logger.info(`缓存已清空`, { itemCount });
  }

  /**
   * 确保有足够的空间
   */
  private ensureSpace(requiredSize: number): void {
    // 检查项数限制
    while (this.cache.size >= this.config.maxItems) {
      this.evictLeastRecentlyUsed();
    }

    // 检查大小限制
    while (this.getCurrentTotalSize() + requiredSize > this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }
  }

  /**
   * 驱逐最少使用的缓存项
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.lastAccessAt < lruTime) {
        lruTime = item.lastAccessAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictedItems++;
      logger.debug('驱逐LRU缓存项', { cacheKey: lruKey.substring(0, 8) });
    }
  }

  /**
   * 获取当前总大小
   */
  private getCurrentTotalSize(): number {
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 清理过期项
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        expiredKeys.push(key);
      }
    }

    let cleanedCount = 0;
    for (const key of expiredKeys) {
      if (this.delete(key)) {
        cleanedCount++;
        this.stats.expiredItems++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('清理过期缓存项', { cleanedCount });
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存项详情
   */
  getCacheItems(limit = 100): CacheItem[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.lastAccessAt - a.lastAccessAt)
      .slice(0, limit);
  }

  /**
   * 获取缓存配置
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('缓存配置已更新', { config: this.config });
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const stats = this.getStats();
    const config = this.getConfig();
    const topItems = this.getCacheItems(10);

    return `
查询缓存性能报告
================

📊 基础统计
- 总缓存项: ${stats.totalItems}
- 缓存大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB
- 命中次数: ${stats.hits}
- 未命中次数: ${stats.misses}
- 命中率: ${stats.hitRate.toFixed(2)}%
- 过期项数: ${stats.expiredItems}
- 驱逐项数: ${stats.evictedItems}

⚙️ 缓存配置
- 默认TTL: ${(config.defaultTtl / 1000).toFixed(0)}秒
- 最大项数: ${config.maxItems}
- 最大大小: ${(config.maxSize / 1024 / 1024).toFixed(0)}MB
- 清理间隔: ${(config.cleanupInterval / 1000).toFixed(0)}秒
- 启用压缩: ${config.enableCompression ? '是' : '否'}

🏆 热门缓存项TOP10
${topItems.length > 0 ?
  topItems.map((item, index) =>
    `${index + 1}. ${item.query.substring(0, 50)}... (访问${item.accessCount}次)`
  ).join('\n') :
  '暂无缓存项'
}

💡 缓存建议
${this.generateRecommendations()}
    `.trim();
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();
    const config = this.getConfig();

    // 命中率建议
    if (stats.hitRate < 50) {
      recommendations.push('命中率较低，建议检查缓存策略或增加TTL时间');
    } else if (stats.hitRate > 90) {
      recommendations.push('命中率很高，缓存策略效果良好');
    }

    // 大小建议
    const usageRatio = stats.totalSize / config.maxSize;
    if (usageRatio > 0.9) {
      recommendations.push('缓存使用率过高，建议增加最大缓存大小');
    } else if (usageRatio < 0.3) {
      recommendations.push('缓存使用率较低，可以减少最大缓存大小以节省内存');
    }

    // 驱逐建议
    if (stats.evictedItems > stats.createdItems * 0.1) {
      recommendations.push('驱逐项数较多，建议增加最大缓存大小或优化缓存策略');
    }

    // 过期建议
    if (stats.expiredItems > stats.createdItems * 0.3) {
      recommendations.push('过期项数较多，建议调整TTL时间');
    }

    return recommendations.length > 0 ? recommendations : ['缓存运行状态良好'];
  }

  /**
   * 停止缓存（清理定时器）
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    logger.info('查询缓存已停止');
  }

  /**
   * 导出缓存数据
   */
  exportData(): {
    stats: CacheStats;
    config: CacheConfig;
    items: CacheItem[];
  } {
    return {
      stats: this.getStats(),
      config: this.getConfig(),
      items: this.getCacheItems(),
    };
  }
}

// 创建默认缓存实例
export const defaultQueryCache = new QueryCache();

/**
 * 缓存装饰器
 */
export function cacheQuery(options: {
  ttl?: number;
  tags?: string[];
  key?: string;
} = {}) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const query = typeof args[0] === 'string' ? args[0] : '';
      const params = Array.isArray(args[1]) ? args[1] : undefined;

      // 尝试从缓存获取
      const cached = defaultQueryCache.get(query, params);
      if (cached !== null) {
        return cached;
      }

      // 执行原方法
      const result = await method.apply(this, args);

      // 存入缓存
      const cacheOptions: { ttl?: number; tags?: string[]; params?: any[] } = {};
      if (options.ttl !== undefined) {
        cacheOptions.ttl = options.ttl;
      }
      if (options.tags) {
        cacheOptions.tags = options.tags;
      }
      if (params) {
        cacheOptions.params = params;
      }

      defaultQueryCache.set(query, result, cacheOptions);

      return result;
    };
  };
}

export default QueryCache;