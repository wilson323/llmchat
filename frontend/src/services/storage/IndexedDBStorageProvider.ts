/**
 * IndexedDB存储提供者
 * 提供持久化的本地存储，支持复杂查询和索引
 */

;
;
;
import { IStorageProvider, StorageTier, StorageOptions, StorageStats, SearchQuery, CacheEntry, DataTemperature, SyncStatus } from '@/types/hybrid-storage';

interface IndexedDBSchema {
  name: string;
  version: number;
  stores: {
    [key: string]: {
      keyPath?: string;
      autoIncrement?: boolean;
      indexes?: {
        name: string;
        keyPath: string;
        unique?: boolean;
      }[];
    };
  };
}

export class IndexedDBStorageProvider implements IStorageProvider {
  readonly name = 'IndexedDBStorage';
  readonly tier = StorageTier.INDEXED_DB;
  private db: IDBDatabase | null = null;
  private dbName = 'HybridStorageDB';
  private dbVersion = 1;
  private storeName = 'cache';
  private maxStorage: number;
  private maxEntries: number;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private readonly schema: IndexedDBSchema = {
    name: this.dbName,
    version: this.dbVersion,
    stores: {
      [this.storeName]: {
        keyPath: 'key',
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'lastAccessed', keyPath: 'lastAccessed' },
          { name: 'expiresAt', keyPath: 'expiresAt' },
          { name: 'storageTier', keyPath: 'storageTier' },
          { name: 'agentId', keyPath: 'data.agentId' },
          { name: 'syncStatus', keyPath: 'syncStatus' },
          { name: 'temperature', keyPath: 'temperature' },
        ],
      },
    },
  };

  constructor(maxStorage: number = 100 * 1024 * 1024, maxEntries: number = 10000) {
    this.maxStorage = maxStorage;
    this.maxEntries = maxEntries;
  }

  get isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           'indexedDB' in window &&
           this.isInitialized;
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 避免重复初始化
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      this.isInitialized = true;
      console.log('IndexedDBStorage initialized successfully');

      // 检查存储空间
      const estimate = await this.getStorageEstimate();
      if (estimate.quota && estimate.quota < this.maxStorage) {
        console.warn(`IndexedDB配额不足，调整最大存储从 ${this.maxStorage} 到 ${estimate.quota}`);
        this.maxStorage = estimate.quota;
      }

    } catch (error) {
      console.error('Failed to initialize IndexedDBStorage:', error);
      throw error;
    }
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    // 删除旧的对象存储（如果存在）
    if (db.objectStoreNames.contains(this.storeName)) {
      db.deleteObjectStore(this.storeName);
    }

    // 创建新的对象存储
    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });

    // 创建索引
    const storeConfig = this.schema.stores[this.storeName];
    const indexes = storeConfig?.indexes || [];
    indexes.forEach(index => {
      if (index.unique !== undefined) {
        store.createIndex(index.name, index.keyPath, { unique: index.unique });
      } else {
        store.createIndex(index.name, index.keyPath);
      }
    });
  }

  async destroy(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    // 删除数据库
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getTransaction(mode: IDBTransactionMode = 'readonly'): Promise<IDBTransaction> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.transaction([this.storeName], mode);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const tx = await this.getTransaction();
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const entry: CacheEntry | undefined = request.result;
          if (!entry) {
            resolve(null);
            return;
          }

          // 检查是否过期
          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.delete(key); // 异步删除过期条目
            resolve(null);
            return;
          }

          // 更新访问统计
          this.updateAccessStats(key);
          resolve(entry.data as T);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get from IndexedDB:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    try {
      const serializedSize = this.calculateSize(value);

      // 检查是否超过存储限制
      if (serializedSize > this.maxStorage) {
        console.warn(`数据大小 ${serializedSize} 超过最大存储限制 ${this.maxStorage}`);
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
        temperature: DataTemperature.WARM,
        ...(options.expiresAt && { expiresAt: options.expiresAt }),
        size: serializedSize,
        storageTier: this.tier,
        syncStatus: SyncStatus.SYNCED,
      };

      const tx = await this.getTransaction('readwrite');
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to set to IndexedDB:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction('readwrite');
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          if (request.error?.name === 'NotFoundError') {
            resolve(false);
          } else {
            reject(request.error);
          }
        };
      });
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction();
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.count(key);
        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to check existence in IndexedDB:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const tx = await this.getTransaction('readwrite');
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error);
      throw error;
    }
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
    const tx = await this.getTransaction('readwrite');
    const store = tx.objectStore(this.storeName);

    for (const entry of entries) {
      const serializedSize = this.calculateSize(entry.value);
      const now = Date.now();

      const cacheEntry: CacheEntry<T> = {
        key: entry.key,
        data: entry.value,
        timestamp: now,
        lastAccessed: now,
        accessCount: 1,
        temperature: DataTemperature.WARM,
        ...(entry.options?.expiresAt && { expiresAt: entry.options.expiresAt }),
        size: serializedSize,
        storageTier: this.tier,
        syncStatus: SyncStatus.SYNCED,
      };

      store.put(cacheEntry);
    }
  }

  async mdelete(keys: string[]): Promise<boolean> {
    const tx = await this.getTransaction('readwrite');
    const store = tx.objectStore(this.storeName);

    for (const key of keys) {
      store.delete(key);
    }

    return true;
  }

  async list<T>(prefix = '', limit?: number): Promise<Array<{key: string, value: T}>> {
    try {
      const tx = await this.getTransaction();
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.openCursor();
        const results: Array<{key: string, value: T}> = [];
        let count = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry: CacheEntry = cursor.value;
            if (!prefix || entry.key.startsWith(prefix)) {
              results.push({ key: entry.key, value: entry.data as T });
              count++;
            }

            if (limit && count >= limit) {
              resolve(results);
              return;
            }

            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to list from IndexedDB:', error);
      return [];
    }
  }

  async search<T>(query: SearchQuery): Promise<Array<{key: string, value: T, score: number}>> {
    try {
      const tx = await this.getTransaction();
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.openCursor();
        const matches: Array<{key: string, value: T, score: number}> = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry: CacheEntry = cursor.value;
            let score = 0;
            const value = entry.data;

            // 应用搜索逻辑
            score = this.calculateSearchScore(entry, value, query);

            if (score > 0) {
              matches.push({ key: entry.key, value: entry.data as T, score });
            }

            cursor.continue();
          } else {
            // 排序并限制结果
            matches.sort((a, b) => b.score - a.score);
            if (query.limit) {
              matches.splice(query.limit);
            }
            resolve(matches);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to search IndexedDB:', error);
      return [];
    }
  }

  async getStats(): Promise<StorageStats> {
    try {
      const tx = await this.getTransaction();
      const store = tx.objectStore(this.storeName);

      return await new Promise((resolve, reject) => {
        const request = store.openCursor();
        let totalSize = 0;
        let totalEntries = 0;
        let oldestEntry = Date.now();
        let newestEntry = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry: CacheEntry = cursor.value;
            totalSize += entry.size;
            totalEntries++;
            oldestEntry = Math.min(oldestEntry, entry.timestamp);
            newestEntry = Math.max(newestEntry, entry.timestamp);
            cursor.continue();
          } else {
            resolve({
              totalEntries,
              totalSize,
              hitCount: 0, // IndexedDB不跟踪命中率
              missCount: 0,
              hitRate: 0,
              averageAccessTime: 0,
              oldestEntry,
              newestEntry,
            });
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get IndexedDB stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0,
        averageAccessTime: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }
  }

  // 私有辅助方法

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16编码大小
    } catch {
      return 1024; // 默认大小
    }
  }

  private async updateAccessStats(key: string): Promise<void> {
    try {
      const tx = await this.getTransaction('readwrite');
      const store = tx.objectStore(this.storeName);
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        const entry: CacheEntry = getRequest.result;
        if (entry) {
          entry.lastAccessed = Date.now();
          entry.accessCount++;
          store.put(entry);
        }
      };
    } catch (error) {
      console.warn('Failed to update access stats:', error);
    }
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    const stats = await this.getStats();
    const availableSpace = this.maxStorage - stats.totalSize;

    if (availableSpace < requiredSize || stats.totalEntries >= this.maxEntries) {
      await this.evictEntries(requiredSize);
    }
  }

  private async evictEntries(_requiredSize: number): Promise<void> {
    const tx = await this.getTransaction('readwrite');
    const store = tx.objectStore(this.storeName);

    // 按最后访问时间排序，删除最旧的条目
    const index = store.index('lastAccessed');
    const request = index.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  private calculateSearchScore(entry: CacheEntry, value: any, query: SearchQuery): number {
    let score = 0;

    // 文本匹配
    if (query.text) {
      if (entry.key.includes(query.text) ||
          (value.title?.includes(query.text))) {
        score += 10;
      }
    }

    // agentId匹配
    if (query.agentId && value.agentId === query.agentId) {
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
    if (query.tags && query.tags.length > 0 && value.tags) {
      const matchingTags = query.tags.filter(tag => value.tags.includes(tag));
      score += matchingTags.length * 5;
    }

    return score;
  }

  private async getStorageEstimate(): Promise<{quota: number, usage: number}> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || this.maxStorage,
        usage: estimate.usage || 0,
      };
    }
    return { quota: this.maxStorage, usage: 0 };
  }

  // 公共方法：清理过期数据
  public async cleanup(): Promise<void> {
    try {
      const tx = await this.getTransaction('readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('expiresAt');
      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);

      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`IndexedDB cleanup: deleted ${deletedCount} expired entries`);
        }
      };
    } catch (error) {
      console.error('Failed to cleanup IndexedDB:', error);
    }
  }
}