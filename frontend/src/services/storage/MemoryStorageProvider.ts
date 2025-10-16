/**
 * 内存存储提供者
 * 提供高速的内存缓存功能，支持LRU/LFU策略
 */

;
;
import { IStorageProvider, StorageTier, StorageOptions, StorageStats, SearchQuery, CacheEntry, DataTemperature, SyncStatus } from '@/types/hybrid-storage';

export class MemoryStorageProvider implements IStorageProvider {
  readonly name = 'MemoryStorage';
  readonly tier = StorageTier.MEMORY;
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxEntries: number;
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private hitCount = 0;
  private missCount = 0;
  private isInitialized = false;

  constructor(maxSize: number = 50 * 1024 * 1024, maxEntries: number = 1000) {
    this.maxSize = maxSize;
    this.maxEntries = maxEntries;
  }

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && this.isInitialized;
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 检查内存可用性
    if (typeof performance !== 'undefined' && 'memory' in (performance as Performance & { memory?: any })) {
      const perfMemory = (performance as Performance & { memory?: {
        jsHeapSizeLimit: number;
        usedJSHeapSize: number;
      } }).memory;

      if (perfMemory && perfMemory.jsHeapSizeLimit && perfMemory.usedJSHeapSize) {
        const availableMemory = perfMemory.jsHeapSizeLimit - perfMemory.usedJSHeapSize;
        if (availableMemory > 0 && availableMemory < this.maxSize) {
          console.warn(`内存可用空间不足，调整缓存大小从 ${this.maxSize} 到 ${availableMemory}`);
          this.maxSize = Math.floor(availableMemory * 0.8); // 使用80%的可用内存
        }
      }
    }

    this.isInitialized = true;
    console.log(`MemoryStorage initialized: maxSize=${this.maxSize}, maxEntries=${this.maxEntries}`);
  }

  async destroy(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.isInitialized = false;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isInitialized) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.missCount++;
      return null;
    }

    // 更新访问统计
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.accessOrder.set(key, ++this.accessCounter);
    this.hitCount++;

    return entry.data as T;
  }

  async set<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const serializedSize = this.calculateSize(value);

    // 如果单个条目超过最大缓存大小，拒绝存储
    if (serializedSize > this.maxSize) {
      console.warn(`数据大小 ${serializedSize} 超过最大缓存限制 ${this.maxSize}`);
      return;
    }

    // 确保有足够空间
    await this.ensureCapacity(serializedSize);

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      data: value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      temperature: DataTemperature.WARM, // 新数据默认为温数据
      ...(options.expiresAt && { expiresAt: options.expiresAt }),
      size: serializedSize,
      storageTier: this.tier,
      syncStatus: SyncStatus.SYNCED,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder.delete(key);
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    return this.cache.has(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      result.set(key, value);
    }

    return result;
  }

  async mset<T>(entries: Array<{key: string, value: T, options?: StorageOptions}>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.options);
    }
  }

  async mdelete(keys: string[]): Promise<boolean> {
    let allDeleted = true;
    for (const key of keys) {
      const deleted = await this.delete(key);
      if (!deleted) {
        allDeleted = false;
      }
    }
    return allDeleted;
  }

  async list<T>(prefix = '', limit?: number): Promise<Array<{key: string, value: T}>> {
    const result: Array<{key: string, value: T}> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (prefix && !key.startsWith(prefix)) {
        continue;
      }
      result.push({ key, value: entry.data as T });

      if (limit && result.length >= limit) {
        break;
      }
    }

    return result;
  }

  async search<T>(query: SearchQuery): Promise<Array<{key: string, value: T, score: number}>> {
    const results: Array<{key: string, value: T, score: number}> = [];

    for (const [key, entry] of this.cache.entries()) {
      let score = 0;
      const value = entry.data;

      // 文本匹配
      if (query.text) {
        const keyMatches = key.includes(query.text);
        const titleMatches = value && typeof value === 'object' && 'title' in value &&
                           typeof value.title === 'string' && value.title.includes(query.text);

        if (keyMatches || titleMatches) {
          score += 10;
        }
      }

      // agentId匹配
      if (query.agentId && value && typeof value === 'object' && 'agentId' in value &&
          value.agentId === query.agentId) {
        score += 20;
      }

      // 日期范围匹配
      if (query.dateRange) {
        const timestamp = entry.timestamp;
        if (timestamp >= query.dateRange.start && timestamp <= query.dateRange.end) {
          score += 15;
        }
      }

      // 标签匹配
      if (query.tags && query.tags.length > 0 && value && typeof value === 'object' && 'tags' in value &&
          Array.isArray(value.tags)) {
        const matchingTags = query.tags.filter(tag =>
          Array.isArray(value.tags) && value.tags.includes(tag)
        );
        score += matchingTags.length * 5;
      }

      if (score > 0) {
        results.push({ key, value: entry.data as T, score });
      }
    }

    // 排序
    results.sort((a, b) => b.score - a.score);

    // 限制结果数量
    if (query.limit) {
      results.splice(query.limit);
    }

    return results;
  }

  async getStats(): Promise<StorageStats> {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const timestamps = Array.from(this.cache.values()).map(entry => entry.timestamp);

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount + this.missCount > 0 ? this.hitCount / (this.hitCount + this.missCount) : 0,
      averageAccessTime: 0, // 内存访问时间极短，可以忽略
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  // 私有方法

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // 粗略估算UTF-16编码大小
    } catch {
      return 1024; // 默认大小
    }
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const availableSize = this.maxSize - currentSize;

    // 如果需要更多空间或者超过条目限制，执行清理
    if (availableSize < requiredSize || this.cache.size >= this.maxEntries) {
      await this.evictEntries(requiredSize);
    }
  }

  private async evictEntries(_requiredSize: number): Promise<void> {
    const entries = Array.from(this.cache.entries());

    // 按访问时间和访问频率排序（LRU + LFU混合策略）
    entries.sort(([, a], [, b]) => {
      const scoreA = a.lastAccessed * a.accessCount;
      const scoreB = b.lastAccessed * b.accessCount;
      return scoreA - scoreB;
    });

    let freedSize = 0;
    const targetSize = this.maxSize * 0.8; // 清理到80%容量
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);

    for (const [key, entry] of entries) {
      if (currentSize - freedSize <= targetSize && this.cache.size <= this.maxEntries * 0.8) {
        break;
      }

      this.cache.delete(key);
      this.accessOrder.delete(key);
      freedSize += entry.size;
    }

    console.log(`MemoryStorage evicted ${entries.length} entries, freed ${freedSize} bytes`);
  }

  // 公共方法：手动触发清理
  public async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredEntries: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expiredEntries.push(key);
      }
    }

    for (const key of expiredEntries) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    if (expiredEntries.length > 0) {
      console.log(`MemoryStorage cleaned up ${expiredEntries.length} expired entries`);
    }
  }

  // 公共方法：获取热数据
  public getHotData(limit = 10): Array<{key: string, entry: CacheEntry}> {
    const entries = Array.from(this.cache.entries());

    // 按访问频率和最近访问时间排序
    entries.sort(([, a], [, b]) => {
      const scoreA = a.accessCount * (a.lastAccessed / Date.now());
      const scoreB = b.accessCount * (b.lastAccessed / Date.now());
      return scoreB - scoreA;
    });

    return entries.slice(0, limit).map(([key, entry]) => ({ key, entry }));
  }
}