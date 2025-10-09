/**
 * 智能缓存管理器
 * 实现LRU/LFU策略、预加载机制和智能失效管理
 */

import {
  ICacheManager,
  CacheStrategy,
  DataTemperature,
  CacheOptions,
  CacheUsageStats,
  IStorageProvider
} from '@/types/hybrid-storage';

import { ChatSession } from '@/types';

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  promotions: number;
  demotions: number;
  preloads: number;
  totalRequests: number;
  averageResponseTime: number;
}

interface PreloadTask {
  key: string;
  priority: number;
  dependencies: string[];
  callback?: () => Promise<void>;
}

export class CacheManager implements ICacheManager {
  private memoryProvider: IStorageProvider;
  private indexedDBProvider: IStorageProvider;
  private strategy: CacheStrategy = CacheStrategy.LRU;
  private metrics: CacheMetrics;
  private preloadQueue: PreloadTask[] = [];
  private isPreloading = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private preloadHistory = new Set<string>();

  constructor(
    memoryProvider: IStorageProvider,
    indexedDBProvider: IStorageProvider
  ) {
    this.memoryProvider = memoryProvider;
    this.indexedDBProvider = indexedDBProvider;

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      promotions: 0,
      demotions: 0,
      preloads: 0,
      totalRequests: 0,
      averageResponseTime: 0
    };

    this.initializeCleanup();
  }

  // ==================== 基础缓存操作 ====================

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      // 1. 首先尝试内存缓存
      let result = await this.memoryProvider.get<T>(key);
      if (result !== null) {
        this.metrics.hits++;
        this.updateAverageResponseTime(performance.now() - startTime);
        return result;
      }

      // 2. 尝试IndexedDB缓存
      result = await this.indexedDBProvider.get<T>(key);
      if (result !== null) {
        this.metrics.hits++;

        // 提升到内存缓存（热数据）
        await this.promoteToMemory(key, result);

        this.updateAverageResponseTime(performance.now() - startTime);
        return result;
      }

      // 3. 缓存未命中
      this.metrics.misses++;
      this.updateAverageResponseTime(performance.now() - startTime);

      // 触发预加载相关数据
      this.triggerRelatedPreload(key);

      return null;

    } catch (error) {
      console.error('缓存获取失败:', error);
      this.metrics.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const temperature = options.temperature || this.determineTemperature(key, value);

      // 根据温度决定存储层级
      if (temperature === DataTemperature.HOT) {
        // 热数据存储到内存和IndexedDB
        await Promise.all([
          this.memoryProvider.set(key, value, options),
          this.indexedDBProvider.set(key, value, options)
        ]);
      } else if (temperature === DataTemperature.WARM) {
        // 温数据存储到IndexedDB
        await this.indexedDBProvider.set(key, value, options);

        // 如果空间允许，也存储到内存
        if (await this.hasMemorySpace()) {
          await this.memoryProvider.set(key, value, options);
        }
      } else {
        // 冷数据只存储到IndexedDB
        await this.indexedDBProvider.set(key, value, options);
      }

      // 触发相关数据预加载
      if (options.preloadRelated) {
        this.triggerRelatedPreload(key);
      }

    } catch (error) {
      console.error('缓存设置失败:', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const [memoryDeleted, indexedDBDeleted] = await Promise.all([
        this.memoryProvider.delete(key),
        this.indexedDBProvider.delete(key)
      ]);

      return memoryDeleted || indexedDBDeleted;
    } catch (error) {
      console.error('缓存删除失败:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await Promise.all([
        this.memoryProvider.clear(),
        this.indexedDBProvider.clear()
      ]);
    } catch (error) {
      console.error('缓存清空失败:', error);
    }
  }

  // ==================== 批量操作 ====================

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    // 并行获取所有键
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key);
      return { key, value };
    });

    const results = await Promise.all(promises);
    results.forEach(({ key, value }) => {
      result.set(key, value);
    });

    return result;
  }

  async mset<T>(entries: Array<{key: string, value: T, options?: CacheOptions}>): Promise<void> {
    // 按温度分组
    const hotEntries: Array<{key: string, value: T, options?: CacheOptions}> = [];
    const warmEntries: Array<{key: string, value: T, options?: CacheOptions}> = [];
    const coldEntries: Array<{key: string, value: T, options?: CacheOptions}> = [];

    entries.forEach(entry => {
      const temperature = entry.options?.temperature || this.determineTemperature(entry.key, entry.value);

      switch (temperature) {
        case DataTemperature.HOT:
          hotEntries.push(entry);
          break;
        case DataTemperature.WARM:
          warmEntries.push(entry);
          break;
        case DataTemperature.COLD:
          coldEntries.push(entry);
          break;
      }
    });

    // 并行设置不同温度的数据
    await Promise.all([
      this.setBatchInMemory(hotEntries.concat(warmEntries)),
      this.setBatchInIndexedDB(hotEntries.concat(warmEntries).concat(coldEntries))
    ]);
  }

  // ==================== 缓存策略管理 ====================

  setStrategy(strategy: CacheStrategy): void {
    this.strategy = strategy;
    console.log(`缓存策略已更改为: ${strategy}`);
  }

  getStrategy(): CacheStrategy {
    return this.strategy;
  }

  // ==================== 温度管理 ====================

  async promoteToHot(key: string): Promise<void> {
    try {
      const value = await this.indexedDBProvider.get(key);
      if (value !== null) {
        await this.promoteToMemory(key, value);
        this.metrics.promotions++;
      }
    } catch (error) {
      console.error('提升到热数据失败:', error);
    }
  }

  async demoteToCold(key: string): Promise<void> {
    try {
      // 从内存中移除，保留在IndexedDB中
      await this.memoryProvider.delete(key);
      this.metrics.demotions++;
    } catch (error) {
      console.error('降级到冷数据失败:', error);
    }
  }

  async getTemperature(key: string): Promise<DataTemperature> {
    try {
      // 检查内存缓存
      if (await this.memoryProvider.exists(key)) {
        return DataTemperature.HOT;
      }

      // 检查IndexedDB缓存
      if (await this.indexedDBProvider.exists(key)) {
        return DataTemperature.WARM;
      }

      return DataTemperature.COLD;
    } catch (error) {
      console.error('获取数据温度失败:', error);
      return DataTemperature.COLD;
    }
  }

  // ==================== 预加载机制 ====================

  async preload(keys: string[]): Promise<void> {
    if (this.isPreloading) {
      // 添加到预加载队列
      keys.forEach(key => this.addToPreloadQueue(key, 1));
      return;
    }

    this.isPreloading = true;

    try {
      // 按优先级排序
      const sortedKeys = this.sortKeysByPriority(keys);

      for (const key of sortedKeys) {
        try {
          // 检查是否已存在
          if (await this.get(key) !== null) {
            continue;
          }

          // 执行预加载
          await this.executePreload(key);
          this.metrics.preloads++;

        } catch (error) {
          console.error(`预加载失败 ${key}:`, error);
        }
      }

    } finally {
      this.isPreloading = false;

      // 处理队列中的预加载任务
      await this.processPreloadQueue();
    }
  }

  async preloadAgentSessions(agentId: string, limit = 10): Promise<void> {
    try {
      // 获取智能体的会话列表
      const sessionKeys = await this.getAgentSessionKeys(agentId, limit);

      // 预加载这些会话
      await this.preload(sessionKeys);

    } catch (error) {
      console.error(`预加载智能体会话失败 ${agentId}:`, error);
    }
  }

  // ==================== 清理和优化 ====================

  async cleanup(): Promise<void> {
    try {
      // 清理过期的内存缓存
      if ('cleanup' in this.memoryProvider) {
        await (this.memoryProvider as any).cleanup();
      }

      // 清理过期的IndexedDB缓存
      if ('cleanup' in this.indexedDBProvider) {
        await (this.indexedDBProvider as any).cleanup();
      }

      // 清理预加载历史
      if (this.preloadHistory.size > 1000) {
        this.preloadHistory.clear();
      }

    } catch (error) {
      console.error('缓存清理失败:', error);
    }
  }

  async optimize(): Promise<void> {
    try {
      // 1. 分析缓存使用模式
      const usageStats = await this.getUsageStats();

      // 2. 根据使用模式调整缓存策略
      if (usageStats.performance.hitRate < 0.7) {
        console.log('命中率较低，调整缓存策略');
        // 可能需要增加缓存大小或调整策略
      }

      // 3. 清理低频访问的数据
      await this.cleanupLowFrequencyData();

      // 4. 重新平衡内存和IndexedDB的存储
      await this.rebalanceStorage();

    } catch (error) {
      console.error('缓存优化失败:', error);
    }
  }

  async getUsageStats(): Promise<CacheUsageStats> {
    try {
      const memoryStats = await this.memoryProvider.getStats();

      // 估算内存使用
      const memoryUsage = {
        total: 50 * 1024 * 1024, // 50MB估算
        used: memoryStats.totalSize,
        free: 50 * 1024 * 1024 - memoryStats.totalSize,
        percentage: (memoryStats.totalSize / (50 * 1024 * 1024)) * 100
      };

      // 获取IndexedDB使用情况
      const indexedDBUsage = await this.getIndexedDBUsage();

      // 估算缓存条目分布
      const cacheEntries = await this.estimateCacheDistribution();

      // 计算性能指标
      const hitRate = this.metrics.totalRequests > 0
        ? this.metrics.hits / this.metrics.totalRequests
        : 0;

      const performance = {
        hitRate,
        averageResponseTime: this.metrics.averageResponseTime,
        evictionRate: this.metrics.totalRequests > 0
          ? this.metrics.evictions / this.metrics.totalRequests
          : 0
      };

      return {
        memoryUsage,
        indexedDBUsage,
        cacheEntries,
        performance
      };

    } catch (error) {
      console.error('获取缓存使用统计失败:', error);
      return this.getDefaultUsageStats();
    }
  }

  // ==================== 私有方法 ====================

  private initializeCleanup(): void {
    // 定期清理过期数据
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  private determineTemperature<T>(key: string, value: T): DataTemperature {
    // 基于访问模式和数据特征判断温度

    // 1. 检查是否是最近访问的会话
    if (key.includes('session:') && value && typeof value === 'object' && 'lastAccessedAt' in (value as any)) {
      const lastAccessed = (value as any).lastAccessedAt;
      const now = Date.now();
      const timeDiff = now - lastAccessed;

      if (timeDiff < 24 * 60 * 60 * 1000) { // 24小时内
        return DataTemperature.HOT;
      } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) { // 7天内
        return DataTemperature.WARM;
      }
    }

    // 2. 基于数据类型判断
    if (key.includes('current') || key.includes('active')) {
      return DataTemperature.HOT;
    }

    // 3. 基于数据大小判断（小数据更容易成为热数据）
    const dataSize = JSON.stringify(value).length;
    if (dataSize < 10 * 1024) { // 小于10KB
      return DataTemperature.HOT;
    } else if (dataSize < 100 * 1024) { // 小于100KB
      return DataTemperature.WARM;
    }

    return DataTemperature.COLD;
  }

  private async promoteToMemory<T>(key: string, value: T): Promise<void> {
    try {
      // 检查内存空间
      if (!(await this.hasMemorySpace())) {
        await this.evictColdMemoryData();
      }

      await this.memoryProvider.set(key, value);
    } catch (error) {
      console.error('提升到内存缓存失败:', error);
    }
  }

  private async hasMemorySpace(): Promise<boolean> {
    try {
      const stats = await this.memoryProvider.getStats();
      const maxSize = 50 * 1024 * 1024; // 50MB
      return stats.totalSize < maxSize * 0.8; // 使用80%阈值
    } catch (error) {
      return true; // 默认认为有空间
    }
  }

  private async evictColdMemoryData(): Promise<void> {
    try {
      // 如果内存存储支持获取热数据，使用其内置的清理机制
      if ('cleanup' in this.memoryProvider) {
        await (this.memoryProvider as any).cleanup();
      } else {
        // 简单清理：删除最旧的一半数据
        const entries = await this.memoryProvider.list();
        const halfLength = Math.floor(entries.length / 2);
        const toDelete = entries.slice(halfLength).map(e => e.key);

        for (const key of toDelete) {
          await this.memoryProvider.delete(key);
        }
      }
    } catch (error) {
      console.error('清理内存缓存失败:', error);
    }
  }

  private triggerRelatedPreload(key: string): void {
    // 根据key分析相关数据并预加载
    if (key.includes('session:')) {
      // 预加载同智能体的其他会话
      const agentId = this.extractAgentIdFromKey(key);
      if (agentId) {
        this.preloadAgentSessions(agentId, 3);
      }
    }
  }

  private extractAgentIdFromKey(key: string): string | null {
    const match = key.match(/session:([^:]+)/);
    return match ? match[1] : null;
  }

  private async getAgentSessionKeys(agentId: string, limit: number): Promise<string[]> {
    try {
      const sessions = await this.indexedDBProvider.list<ChatSession>(`session:${agentId}:`);
      return sessions.slice(0, limit).map(entry => entry.key);
    } catch (error) {
      console.error('获取智能体会话键失败:', error);
      return [];
    }
  }

  private addToPreloadQueue(key: string, priority: number): void {
    // 避免重复添加
    if (this.preloadQueue.some(task => task.key === key)) {
      return;
    }

    this.preloadQueue.push({
      key,
      priority,
      dependencies: []
    });

    // 按优先级排序
    this.preloadQueue.sort((a, b) => b.priority - a.priority);
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.length === 0) return;

    const tasks = this.preloadQueue.splice(0, 5); // 处理前5个任务
    const keys = tasks.map(task => task.key);

    await this.preload(keys);
  }

  private sortKeysByPriority(keys: string[]): string[] {
    // 基于访问模式和时间排序
    return keys.sort((a, b) => {
      // 当前会话优先
      if (a.includes('current')) return -1;
      if (b.includes('current')) return 1;

      // 最近访问的优先
      const aTime = this.extractTimestampFromKey(a);
      const bTime = this.extractTimestampFromKey(b);

      return bTime - aTime;
    });
  }

  private extractTimestampFromKey(key: string): number {
    const match = key.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private async executePreload(key: string): Promise<void> {
    // 避免重复预加载
    if (this.preloadHistory.has(key)) {
      return;
    }

    this.preloadHistory.add(key);

    // 这里应该实现具体的预加载逻辑
    // 例如从远程API获取数据并缓存
    console.log(`预加载数据: ${key}`);
  }

  private async setBatchInMemory<T>(entries: Array<{key: string, value: T, options?: CacheOptions}>): Promise<void> {
    const promises = entries.map(entry =>
      this.memoryProvider.set(entry.key, entry.value, entry.options)
    );
    await Promise.all(promises);
  }

  private async setBatchInIndexedDB<T>(entries: Array<{key: string, value: T, options?: CacheOptions}>): Promise<void> {
    const promises = entries.map(entry =>
      this.indexedDBProvider.set(entry.key, entry.value, entry.options)
    );
    await Promise.all(promises);
  }

  private async getIndexedDBUsage(): Promise<{total: number, used: number, free: number, percentage: number}> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const total = estimate.quota || 100 * 1024 * 1024; // 默认100MB
        const used = estimate.usage || 0;

        return {
          total,
          used,
          free: total - used,
          percentage: (used / total) * 100
        };
      }
    } catch (error) {
      console.warn('无法获取IndexedDB使用情况:', error);
    }

    // 默认值
    return {
      total: 100 * 1024 * 1024,
      used: 0,
      free: 100 * 1024 * 1024,
      percentage: 0
    };
  }

  private async estimateCacheDistribution(): Promise<{hot: number, warm: number, cold: number, total: number}> {
    try {
      const memoryEntries = await this.memoryProvider.getStats();
      const indexedDBEntries = await this.indexedDBProvider.getStats();

      return {
        hot: memoryEntries.totalEntries,
        warm: indexedDBEntries.totalEntries,
        cold: 0, // 索引外的数据难以统计
        total: memoryEntries.totalEntries + indexedDBEntries.totalEntries
      };
    } catch (error) {
      return { hot: 0, warm: 0, cold: 0, total: 0 };
    }
  }

  private async cleanupLowFrequencyData(): Promise<void> {
    // 清理访问频率低的数据
    try {
      const indexedDBStats = await this.indexedDBProvider.getStats();

      // 如果IndexedDB条目过多，清理旧数据
      if (indexedDBStats.totalEntries > 1000) {
        const entries = await this.indexedDBProvider.list();
        const oldEntries = entries.slice(-100); // 删除最旧的100个条目

        for (const entry of oldEntries) {
          await this.indexedDBProvider.delete(entry.key);
        }
      }
    } catch (error) {
      console.error('清理低频数据失败:', error);
    }
  }

  private async rebalanceStorage(): Promise<void> {
    // 重新平衡内存和IndexedDB的存储分布
    try {
      const memoryStats = await this.memoryProvider.getStats();

      // 如果内存使用率过高，将一些数据降级到IndexedDB
      if (memoryStats.totalSize > 40 * 1024 * 1024) { // 40MB
        const hotData = await this.getHotDataFromMemory();
        const toDemote = hotData.slice(-20); // 降级最后20个条目

        for (const {key} of toDemote) {
          await this.demoteToCold(key);
        }
      }
    } catch (error) {
      console.error('重新平衡存储失败:', error);
    }
  }

  private async getHotDataFromMemory(): Promise<Array<{key: string, entry: any}>> {
    try {
      // 如果内存存储支持获取热数据，使用该方法
      if ('getHotData' in this.memoryProvider) {
        return await (this.memoryProvider as any).getHotData();
      }

      // 否则返回所有数据
      const entries = await this.memoryProvider.list();
      return entries.map(entry => ({key: entry.key, entry: entry.value}));
    } catch (error) {
      console.error('获取内存热数据失败:', error);
      return [];
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    const alpha = 0.1; // 平滑因子
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  private getDefaultUsageStats(): CacheUsageStats {
    return {
      memoryUsage: {
        total: 50 * 1024 * 1024,
        used: 0,
        free: 50 * 1024 * 1024,
        percentage: 0
      },
      indexedDBUsage: {
        total: 100 * 1024 * 1024,
        used: 0,
        free: 100 * 1024 * 1024,
        percentage: 0
      },
      cacheEntries: {
        hot: 0,
        warm: 0,
        cold: 0,
        total: 0
      },
      performance: {
        hitRate: 0,
        averageResponseTime: 0,
        evictionRate: 0
      }
    };
  }

  // 公共方法：获取详细指标
  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  // 公共方法：重置指标
  public resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      promotions: 0,
      demotions: 0,
      preloads: 0,
      totalRequests: 0,
      averageResponseTime: 0
    };
  }

  // 公共方法：销毁缓存管理器
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.preloadQueue.length = 0;
    this.preloadHistory.clear();
  }
}