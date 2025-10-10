/**
 * 智能缓存策略管理系统
 * 实现多层缓存、动态策略调整和智能预取
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';

import logger from '@/utils/logger';

// 缓存策略类型
export enum CacheStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  TTL = 'ttl',
  ADAPTIVE = 'adaptive',
  WRITE_THROUGH = 'write_through',
  WRITE_BACK = 'write_back',
  WRITE_AROUND = 'write_around'
}

// 缓存层级
export enum CacheLevel {
  L1_MEMORY = 'l1_memory',    // 内存缓存（最快）
  L2_REDIS = 'l2_redis',      // Redis缓存（较快）
  L3_DATABASE = 'l3_database' // 数据库缓存（较慢）
}

// 缓存项
interface CacheItem<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessTime: number;
  size: number;
  level: CacheLevel;
  metadata?: any;
}

// 缓存配置
interface CacheConfig {
  maxSize: number;
  maxMemory: number; // 字节
  defaultTTL: number;
  strategy: CacheStrategy;
  levels: CacheLevel[];
  compressionEnabled: boolean;
  serializationEnabled: boolean;
  preFetchEnabled: boolean;
  metricsEnabled: boolean;
}

// 缓存统计
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  averageAccessTime: number;
  memoryUsage: number;
  itemCount: number;
  levelStats: Map<CacheLevel, {
    hits: number;
    misses: number;
    itemCount: number;
    memoryUsage: number;
  }>;
}

// 缓存策略配置
interface StrategyConfig {
  // LRU配置
  lruMaxSize: number;

  // TTL配置
  ttlDefault: number;
  ttlExtended: number;

  // 自适应配置
  adaptiveThreshold: number;
  adaptiveWindowSize: number;

  // 预取配置
  preFetchDelay: number;
  preFetchThreshold: number;
  preFetchMaxConcurrency: number;

  // 压缩配置
  compressionThreshold: number;
  compressionLevel: number;
}

/**
 * 智能缓存策略管理器
 */
export class IntelligentCacheStrategy extends EventEmitter {
  private config: CacheConfig;
  private strategyConfig: StrategyConfig;

  // 多层缓存存储
  private caches: Map<CacheLevel, LRUCache<string, CacheItem>>;

  // 统计信息
  private stats: CacheStats;

  // 访问模式分析
  private accessPatterns: Map<string, {
    frequency: number;
    recency: number;
    periodicity: number;
    lastAccess: number;
    prediction: number;
  }>;

  // 预取队列
  private preFetchQueue: Array<{
    key: string;
    priority: number;
    timestamp: number;
  }> = [];

  // 正在处理的预取请求
  private activePreFetches = new Set<string>();

  // 内存使用监控
  private memoryMonitor = {
    currentUsage: 0,
    peakUsage: 0,
    threshold: 0.8 // 80%
  };

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      maxSize: 1000,
      maxMemory: 100 * 1024 * 1024, // 100MB
      defaultTTL: 300000, // 5分钟
      strategy: CacheStrategy.ADAPTIVE,
      levels: [CacheLevel.L1_MEMORY, CacheLevel.L2_REDIS],
      compressionEnabled: true,
      serializationEnabled: true,
      preFetchEnabled: true,
      metricsEnabled: true,
      ...config
    };

    this.strategyConfig = {
      lruMaxSize: 500,
      ttlDefault: 300000,
      ttlExtended: 600000,
      adaptiveThreshold: 0.7,
      adaptiveWindowSize: 100,
      preFetchDelay: 1000,
      preFetchThreshold: 0.8,
      preFetchMaxConcurrency: 5,
      compressionThreshold: 1024,
      compressionLevel: 6
    };

    this.initializeCaches();
    this.initializeStats();
    this.startBackgroundTasks();

    logger.info('IntelligentCacheStrategy 初始化完成', {
      strategy: this.config.strategy,
      levels: this.config.levels,
      maxSize: this.config.maxSize
    });
  }

  /**
   * 初始化缓存层
   */
  private initializeCaches(): void {
    this.caches = new Map();

    for (const level of this.config.levels) {
      const cacheOptions = {
        max: this.getLevelMaxSize(level),
        ttl: this.config.defaultTTL,
        updateAgeOnGet: true,
        allowStale: true,
        dispose: (value: CacheItem, key: string) => {
          this.emit('eviction', { key, value, level });
          logger.debug('缓存项被驱逐', { key, level });
        }
      };

      this.caches.set(level, new LRUCache(cacheOptions));
    }
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      itemCount: 0,
      levelStats: new Map()
    };

    for (const level of this.config.levels) {
      this.stats.levelStats.set(level, {
        hits: 0,
        misses: 0,
        itemCount: 0,
        memoryUsage: 0
      });
    }

    this.accessPatterns = new Map();
  }

  /**
   * 启动后台任务
   */
  private startBackgroundTasks(): void {
    // 定期清理过期项
    setInterval(() => this.cleanupExpiredItems(), 60000); // 1分钟

    // 定期分析访问模式
    setInterval(() => this.analyzeAccessPatterns(), 300000); // 5分钟

    // 定期调整缓存策略
    setInterval(() => this.adaptStrategy(), 600000); // 10分钟

    // 定期预取热门数据
    setInterval(() => this.processPreFetchQueue(), 5000); // 5秒

    // 内存监控
    setInterval(() => this.monitorMemory(), 30000); // 30秒
  }

  /**
   * 获取缓存项
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // 按层级顺序查找
      for (const level of this.config.levels) {
        const cache = this.caches.get(level);
        if (!cache) continue;

        const item = cache.get(key);
        if (item && this.isValidItem(item)) {
          // 命中缓存
          this.recordHit(level);
          this.updateAccessPattern(key);
          this.promoteItem(key, item, level);

          const accessTime = performance.now() - startTime;
          this.updateAccessTime(accessTime);

          logger.debug('缓存命中', { key, level, accessTime: accessTime.toFixed(2) });
          return item.value;
        } else if (item) {
          // 缓存项过期，删除
          cache.delete(key);
          this.recordEviction(level);
        }
      }

      // 缓存未命中
      this.recordMiss();
      const accessTime = performance.now() - startTime;
      this.updateAccessTime(accessTime);

      logger.debug('缓存未命中', { key, accessTime: accessTime.toFixed(2) });

      // 触发预取（如果启用）
      if (this.config.preFetchEnabled) {
        this.schedulePreFetch(key);
      }

      return null;

    } catch (error) {
      logger.error('缓存获取失败', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * 设置缓存项
   */
  async set<T = any>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      level?: CacheLevel;
      metadata?: any;
    } = {}
  ): Promise<boolean> {
    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const targetLevel = options.level || this.selectOptimalLevel(key, value);

      // 创建缓存项
      const item: CacheItem<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessTime: Date.now(),
        size: this.calculateSize(value),
        level: targetLevel,
        metadata: options.metadata
      };

      // 检查内存限制
      if (!this.checkMemoryLimit(item)) {
        this.evictLeastValuableItems(item.size);
      }

      // 存储到指定层级
      const cache = this.caches.get(targetLevel);
      if (cache) {
        cache.set(key, item);
        this.recordSet(targetLevel);
        this.updateMemoryUsage();

        logger.debug('缓存设置成功', {
          key,
          level: targetLevel,
          size: item.size,
          ttl
        });

        // 如果是重要数据，考虑复制到其他层级
        if (this.shouldReplicate(key, item)) {
          this.replicateToOtherLevels(key, item, targetLevel);
        }

        return true;
      }

      return false;

    } catch (error) {
      logger.error('缓存设置失败', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 删除缓存项
   */
  async delete(key: string): Promise<boolean> {
    try {
      let deleted = false;

      for (const level of this.config.levels) {
        const cache = this.caches.get(level);
        if (cache && cache.has(key)) {
          cache.delete(key);
          deleted = true;
          this.recordDelete(level);
        }
      }

      // 清理访问模式
      this.accessPatterns.delete(key);

      logger.debug('缓存删除', { key, deleted });
      return deleted;

    } catch (error) {
      logger.error('缓存删除失败', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    try {
      for (const cache of this.caches.values()) {
        cache.clear();
      }

      this.accessPatterns.clear();
      this.preFetchQueue.length = 0;
      this.resetStats();

      logger.info('所有缓存已清空');
    } catch (error) {
      logger.error('清空缓存失败', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 批量获取
   */
  async mget<T = any>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    // 并行获取
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        results.set(key, value);
      })
    );

    return results;
  }

  /**
   * 批量设置
   */
  async mset<T = any>(
    items: Array<{
      key: string;
      value: T;
      options?: {
        ttl?: number;
        level?: CacheLevel;
        metadata?: any;
      };
    }>
  ): Promise<boolean> {
    try {
      // 并行设置
      const results = await Promise.all(
        items.map(item => this.set(item.key, item.value, item.options))
      );

      return results.every(result => result);
    } catch (error) {
      logger.error('批量设置缓存失败', {
        itemCount: items.length,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 选择最优存储层级
   */
  private selectOptimalLevel<T>(key: string, value: T): CacheLevel {
    const pattern = this.accessPatterns.get(key);
    const size = this.calculateSize(value);

    // 基于访问模式和大小选择层级
    if (pattern && pattern.frequency > 0.8 && size < 1024) {
      return CacheLevel.L1_MEMORY; // 高频小数据存内存
    } else if (pattern && pattern.frequency > 0.5) {
      return CacheLevel.L2_REDIS; // 中频数据存Redis
    } else {
      return this.config.levels[this.config.levels.length - 1]; // 低频数据存最低层级
    }
  }

  /**
   * 检查缓存项是否有效
   */
  private isValidItem(item: CacheItem): boolean {
    return Date.now() < item.timestamp + item.ttl;
  }

  /**
   * 记录缓存命中
   */
  private recordHit(level: CacheLevel): void {
    this.stats.hits++;
    const levelStats = this.stats.levelStats.get(level);
    if (levelStats) {
      levelStats.hits++;
    }
    this.updateHitRate();
  }

  /**
   * 记录缓存未命中
   */
  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * 记录缓存设置
   */
  private recordSet(level: CacheLevel): void {
    this.stats.sets++;
    const levelStats = this.stats.levelStats.get(level);
    if (levelStats) {
      levelStats.itemCount++;
    }
  }

  /**
   * 记录缓存删除
   */
  private recordDelete(level: CacheLevel): void {
    this.stats.deletes++;
    const levelStats = this.stats.levelStats.get(level);
    if (levelStats) {
      levelStats.itemCount = Math.max(0, levelStats.itemCount - 1);
    }
  }

  /**
   * 记录缓存驱逐
   */
  private recordEviction(level: CacheLevel): void {
    this.stats.evictions++;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 更新访问时间
   */
  private updateAccessTime(accessTime: number): void {
    if (this.stats.hits + this.stats.misses === 1) {
      this.stats.averageAccessTime = accessTime;
    } else {
      this.stats.averageAccessTime =
        (this.stats.averageAccessTime * (this.stats.hits + this.stats.misses - 1) + accessTime) /
        (this.stats.hits + this.stats.misses);
    }
  }

  /**
   * 更新访问模式
   */
  private updateAccessPattern(key: string): void {
    const now = Date.now();
    let pattern = this.accessPatterns.get(key);

    if (!pattern) {
      pattern = {
        frequency: 0,
        recency: 0,
        periodicity: 0,
        lastAccess: now,
        prediction: 0
      };
      this.accessPatterns.set(key, pattern);
    }

    // 更新访问模式
    const timeDiff = now - pattern.lastAccess;
    pattern.frequency = Math.min(1, pattern.frequency * 0.9 + 0.1); // 指数衰减
    pattern.recency = 1 / (1 + timeDiff / 1000); // 越近访问越高
    pattern.lastAccess = now;
    pattern.prediction = this.calculatePredictiveValue(pattern);
  }

  /**
   * 计算预测值
   */
  private calculatePredictiveValue(pattern: any): number {
    // 简单的预测模型：结合频率、新近性和周期性
    return (pattern.frequency * 0.4 + pattern.recency * 0.4 + pattern.periodicity * 0.2);
  }

  /**
   * 提升缓存项层级
   */
  private promoteItem(key: string, item: CacheItem, currentLevel: CacheLevel): void {
    const currentLevelIndex = this.config.levels.indexOf(currentLevel);

    // 如果已经在最高层级，不需要提升
    if (currentLevelIndex === 0) return;

    // 检查是否应该提升
    const pattern = this.accessPatterns.get(key);
    if (pattern && pattern.frequency > 0.7) {
      const targetLevel = this.config.levels[Math.max(0, currentLevelIndex - 1)];

      // 提升到更高层级
      const targetCache = this.caches.get(targetLevel);
      if (targetCache && !targetCache.has(key)) {
        targetCache.set(key, { ...item, level: targetLevel });
        logger.debug('缓存项层级提升', { key, from: currentLevel, to: targetLevel });
      }
    }
  }

  /**
   * 计算数据大小
   */
  private calculateSize(value: any): number {
    try {
      if (typeof value === 'string') {
        return value.length * 2; // UTF-16
      } else if (typeof value === 'object') {
        return JSON.stringify(value).length * 2;
      } else {
        return 8; // 基本类型固定大小
      }
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 检查内存限制
   */
  private checkMemoryLimit(item: CacheItem): boolean {
    const currentUsage = this.getCurrentMemoryUsage();
    const newItemSize = item.size;

    return currentUsage + newItemSize <= this.config.maxMemory;
  }

  /**
   * 获取当前内存使用量
   */
  private getCurrentMemoryUsage(): number {
    let totalSize = 0;

    for (const cache of this.caches.values()) {
      for (const item of cache.values()) {
        totalSize += item.size;
      }
    }

    return totalSize;
  }

  /**
   * 驱逐最少价值的缓存项
   */
  private evictLeastValuableItems(requiredSize: number): void {
    const allItems: Array<{ key: string; item: CacheItem; value: number }> = [];

    // 收集所有缓存项并计算价值
    for (const [level, cache] of this.caches.entries()) {
      for (const [key, item] of cache.entries()) {
        const pattern = this.accessPatterns.get(key);
        const value = this.calculateItemValue(item, pattern);

        allItems.push({ key, item, value });
      }
    }

    // 按价值排序（价值低的先驱逐）
    allItems.sort((a, b) => a.value - b.value);

    let freedSize = 0;
    for (const { key, item, value } of allItems) {
      if (freedSize >= requiredSize) break;

      const cache = this.caches.get(item.level);
      if (cache) {
        cache.delete(key);
        freedSize += item.size;
        this.recordEviction(item.level);

        logger.debug('驱逐低价值缓存项', {
          key,
          level: item.level,
          size: item.size,
          value
        });
      }
    }
  }

  /**
   * 计算缓存项价值
   */
  private calculateItemValue(item: CacheItem, pattern?: any): number {
    // 综合考虑访问频率、新近性、大小等因素
    const frequency = pattern?.frequency || 0;
    const recency = pattern?.recency || 0;
    const sizeFactor = Math.log(1 + item.size) / Math.log(1024); // 对数大小因子
    const ageFactor = (Date.now() - item.timestamp) / item.ttl; // 年龄因子

    return (frequency * 0.4 + recency * 0.3 + (1 - ageFactor) * 0.2) / sizeFactor;
  }

  /**
   * 复制到其他层级
   */
  private replicateToOtherLevels(
    key: string,
    item: CacheItem,
    sourceLevel: CacheLevel
  ): void {
    const sourceIndex = this.config.levels.indexOf(sourceLevel);

    // 向下复制（更低的层级）
    for (let i = sourceIndex + 1; i < this.config.levels.length; i++) {
      const targetLevel = this.config.levels[i];
      const targetCache = this.caches.get(targetLevel);

      if (targetCache && !targetCache.has(key)) {
        targetCache.set(key, { ...item, level: targetLevel });
      }
    }
  }

  /**
   * 判断是否应该复制
   */
  private shouldReplicate(key: string, item: CacheItem): boolean {
    const pattern = this.accessPatterns.get(key);

    // 高频访问或重要数据应该复制
    return pattern?.frequency > 0.6 || item.metadata?.important;
  }

  /**
   * 安排预取
   */
  private schedulePreFetch(key: string): void {
    if (this.activePreFetches.has(key)) return;

    const pattern = this.accessPatterns.get(key);
    if (pattern && pattern.prediction > this.strategyConfig.preFetchThreshold) {
      this.preFetchQueue.push({
        key,
        priority: pattern.prediction,
        timestamp: Date.now()
      });

      // 按优先级排序
      this.preFetchQueue.sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * 处理预取队列
   */
  private async processPreFetchQueue(): Promise<void> {
    if (this.preFetchQueue.length === 0) return;

    const maxConcurrency = this.strategyConfig.preFetchMaxConcurrency;
    const batch = this.preFetchQueue.splice(0, maxConcurrency);

    await Promise.all(
      batch.map(async ({ key }) => {
        if (this.activePreFetches.has(key)) return;

        this.activePreFetches.add(key);

        try {
          // 延迟执行，避免过度预取
          await new Promise(resolve => setTimeout(resolve, this.strategyConfig.preFetchDelay));

          // 检查是否还需要预取
          const exists = await this.get(key);
          if (!exists) {
            // 触发数据加载事件
            this.emit('prefetch', { key });
          }
        } catch (error) {
          logger.warn('预取失败', { key, error });
        } finally {
          this.activePreFetches.delete(key);
        }
      })
    );
  }

  /**
   * 获取层级最大大小
   */
  private getLevelMaxSize(level: CacheLevel): number {
    switch (level) {
      case CacheLevel.L1_MEMORY:
        return this.strategyConfig.lruMaxSize;
      case CacheLevel.L2_REDIS:
        return this.config.maxSize;
      default:
        return this.config.maxSize * 2;
    }
  }

  /**
   * 清理过期项
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [level, cache] of this.caches.entries()) {
      for (const [key, item] of cache.entries()) {
        if (now > item.timestamp + item.ttl) {
          cache.delete(key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.debug('清理过期缓存项', { count: cleanedCount });
    }
  }

  /**
   * 分析访问模式
   */
  private analyzeAccessPatterns(): void {
    // 分析访问周期性等复杂模式
    for (const [key, pattern] of this.accessPatterns.entries()) {
      // 这里可以添加更复杂的模式分析逻辑
      // 例如：检测周期性访问、趋势变化等
    }
  }

  /**
   * 自适应策略调整
   */
  private adaptStrategy(): void {
    const hitRate = this.stats.hitRate;
    const memoryUsage = this.getCurrentMemoryUsage() / this.config.maxMemory;

    // 根据命中率调整策略
    if (hitRate < 0.5 && memoryUsage < 0.8) {
      // 命中率低且内存有余量，增加缓存大小
      this.config.maxSize = Math.min(this.config.maxSize * 1.2, 2000);
      logger.info('自适应调整：增加缓存大小', { newSize: this.config.maxSize });
    } else if (hitRate > 0.9 && memoryUsage > 0.9) {
      // 命中率高但内存紧张，减少缓存大小
      this.config.maxSize = Math.max(this.config.maxSize * 0.8, 500);
      logger.info('自适应调整：减少缓存大小', { newSize: this.config.maxSize });
    }
  }

  /**
   * 监控内存使用
   */
  private monitorMemory(): void {
    const currentUsage = this.getCurrentMemoryUsage();
    this.memoryMonitor.currentUsage = currentUsage;
    this.memoryMonitor.peakUsage = Math.max(this.memoryMonitor.peakUsage, currentUsage);

    const usageRatio = currentUsage / this.config.maxMemory;

    if (usageRatio > this.memoryMonitor.threshold) {
      logger.warn('缓存内存使用过高', {
        current: currentUsage,
        max: this.config.maxMemory,
        ratio: (usageRatio * 100).toFixed(2) + '%'
      });

      // 触发内存清理
      this.cleanupExpiredItems();
      this.evictLeastValuableItems(currentUsage * 0.1); // 清理10%
    }
  }

  /**
   * 更新内存使用统计
   */
  private updateMemoryUsage(): void {
    this.stats.memoryUsage = this.getCurrentMemoryUsage();
    this.stats.itemCount = Array.from(this.caches.values())
      .reduce((total, cache) => total + cache.size, 0);

    // 更新层级统计
    for (const [level, cache] of this.caches.entries()) {
      const levelStats = this.stats.levelStats.get(level);
      if (levelStats) {
        levelStats.itemCount = cache.size;
        levelStats.memoryUsage = Array.from(cache.values())
          .reduce((total, item) => total + item.size, 0);
      }
    }
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      itemCount: 0,
      levelStats: new Map()
    };

    for (const level of this.config.levels) {
      this.stats.levelStats.set(level, {
        hits: 0,
        misses: 0,
        itemCount: 0,
        memoryUsage: 0
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats & {
    memoryMonitor: typeof this.memoryMonitor;
    config: typeof this.config;
    queueLength: number;
    activePreFetches: number;
  } {
    this.updateMemoryUsage();

    return {
      ...this.stats,
      memoryMonitor: this.memoryMonitor,
      config: this.config,
      queueLength: this.preFetchQueue.length,
      activePreFetches: this.activePreFetches.size
    };
  }

  /**
   * 获取热门键
   */
  getHotKeys(limit: number = 10): Array<{
    key: string;
    frequency: number;
    recency: number;
    prediction: number;
  }> {
    return Array.from(this.accessPatterns.entries())
      .map(([key, pattern]) => ({
        key,
        frequency: pattern.frequency,
        recency: pattern.recency,
        prediction: pattern.prediction
      }))
      .sort((a, b) => b.prediction - a.prediction)
      .slice(0, limit);
  }

  /**
   * 预热缓存
   */
  async warmUp<T>(
    keys: string[],
    loader: (key: string) => Promise<T>
  ): Promise<void> {
    logger.info('开始缓存预热', { keyCount: keys.length });

    await Promise.all(
      keys.map(async (key) => {
        try {
          const exists = await this.get(key);
          if (!exists) {
            const value = await loader(key);
            await this.set(key, value);
          }
        } catch (error) {
          logger.warn('预热失败', { key, error });
        }
      })
    );

    logger.info('缓存预热完成');
  }
}

// 导出单例实例
export const intelligentCacheStrategy = new IntelligentCacheStrategy();