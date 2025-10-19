/**
 * 性能数据持久化和缓存服务
 * 提供数据本地存储、缓存管理和同步功能
 */

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  size: number; // 数据大小(bytes)
  tags: string[]; // 标签
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number; // 最大缓存大小(MB)
  maxEntries: number; // 最大条目数
  defaultTTL: number; // 默认TTL(毫秒)
  compressionEnabled: boolean; // 是否启用压缩
  encryptionEnabled: boolean; // 是否启用加密
  syncEnabled: boolean; // 是否启用云同步
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
  lastSync: number | null;
}

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: Array<{
    key: string;
    localVersion: number;
    remoteVersion: number;
    resolution: 'local' | 'remote' | 'merge';
  }>;
  error?: string;
}

class PerformanceDataCache {
  private static instance: PerformanceDataCache;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private compressionWorker: Worker | null = null;
  private syncInProgress: boolean = false;

  private constructor() {
    this.config = {
      maxSize: 100, // 100MB
      maxEntries: 10000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24小时
      compressionEnabled: true,
      encryptionEnabled: false,
      syncEnabled: false
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      compressionRatio: 1,
      lastSync: null
    };

    this.initializeCache();
  }

  static getInstance(): PerformanceDataCache {
    if (!PerformanceDataCache.instance) {
      PerformanceDataCache.instance = new PerformanceDataCache();
    }
    return PerformanceDataCache.instance;
  }

  /**
   * 初始化缓存
   */
  private async initializeCache(): Promise<void> {
    try {
      // 从localStorage加载缓存数据
      const storedData = localStorage.getItem('performance_cache_data');
      const storedConfig = localStorage.getItem('performance_cache_config');
      const storedStats = localStorage.getItem('performance_cache_stats');

      if (storedConfig) {
        this.config = { ...this.config, ...JSON.parse(storedConfig) };
      }

      if (storedStats) {
        this.stats = { ...this.stats, ...JSON.parse(storedStats) };
      }

      if (storedData) {
        const cacheData = JSON.parse(storedData);
        Object.entries(cacheData).forEach(([key, entry]) => {
          // 检查是否过期
          if (entry.expiresAt > Date.now()) {
            this.cache.set(key, entry);
          }
        });
        this.updateStats();
      }

      // 初始化压缩Worker
      if (this.config.compressionEnabled && typeof Worker !== 'undefined') {
        this.initializeCompressionWorker();
      }

      console.log('性能数据缓存已初始化');
    } catch (error) {
      console.error('初始化缓存失败:', error);
    }
  }

  /**
   * 初始化压缩Worker
   */
  private initializeCompressionWorker(): void {
    try {
      const workerCode = `
        self.onmessage = function(e) {
          const { id, data, action } = e.data;

          if (action === 'compress') {
            try {
              const compressed = JSON.stringify(data);
              self.postMessage({
                id,
                success: true,
                result: compressed,
                originalSize: new Blob([JSON.stringify(data)]).size,
                compressedSize: new Blob([compressed]).size
              });
            } catch (error) {
              self.postMessage({
                id,
                success: false,
                error: error.message
              });
            }
          } else if (action === 'decompress') {
            try {
              const decompressed = JSON.parse(data);
              self.postMessage({
                id,
                success: true,
                result: decompressed
              });
            } catch (error) {
              self.postMessage({
                id,
                success: false,
                error: error.message
              });
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.compressionWorker = new Worker(URL.createObjectURL(blob));

      console.log('压缩Worker已初始化');
    } catch (error) {
      console.warn('初始化压缩Worker失败:', error);
      this.config.compressionEnabled = false;
    }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(
    key: string,
    data: T,
    ttl?: number,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const expiresAt = now + (ttl || this.config.defaultTTL);

      // 压缩数据
      let processedData = data;
      let dataSize = 0;

      if (this.config.compressionEnabled) {
        const compressedData = await this.compressData(data);
        processedData = compressedData.data;
        dataSize = compressedData.compressedSize;
      } else {
        const serializedData = JSON.stringify(data);
        dataSize = new Blob([serializedData]).size;
      }

      const entry: CacheEntry<T> = {
        key,
        data: processedData,
        timestamp: now,
        expiresAt,
        size: dataSize,
        tags: tags || [],
        metadata
      };

      // 检查缓存大小限制
      if (this.shouldEvict(dataSize)) {
        this.evictLeastRecentlyUsed(dataSize);
      }

      this.cache.set(key, entry);
      this.updateStats();
      this.persistCache();

      return true;
    } catch (error) {
      console.error('设置缓存数据失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.updateMissRate();
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        this.updateStats();
        this.persistCache();
        this.updateMissRate();
        return null;
      }

      // 解压缩数据
      let data = entry.data;
      if (this.config.compressionEnabled && typeof entry.data === 'string') {
        data = await this.decompressData(entry.data);
      }

      // 更新访问时间
      entry.timestamp = Date.now();
      this.updateHitRate();
      this.persistCache();

      return data as T;
    } catch (error) {
      console.error('获取缓存数据失败:', error);
      this.updateMissRate();
      return null;
    }
  }

  /**
   * 删除缓存数据
   */
  delete(key: string): boolean {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.updateStats();
        this.persistCache();
      }
      return deleted;
    } catch (error) {
      console.error('删除缓存数据失败:', error);
      return false;
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    try {
      this.cache.clear();
      this.updateStats();
      this.persistCache();
      localStorage.removeItem('performance_cache_data');
    } catch (error) {
      console.error('清空缓存失败:', error);
    }
  }

  /**
   * 按标签删除
   */
  deleteByTag(tag: string): number {
    try {
      let deletedCount = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.includes(tag)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        this.updateStats();
        this.persistCache();
      }

      return deletedCount;
    } catch (error) {
      console.error('按标签删除缓存失败:', error);
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存配置
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 更新缓存配置
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('performance_cache_config', JSON.stringify(this.config));
  }

  /**
   * 压缩数据
   */
  private async compressData(data: any): Promise<{ data: any; compressedSize: number }> {
    if (!this.compressionWorker) {
      const serialized = JSON.stringify(data);
      return {
        data: serialized,
        compressedSize: new Blob([serialized]).size
      };
    }

    return new Promise((resolve, reject) => {
      const id = Date.now();

      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage);

          if (e.data.success) {
            resolve({
              data: e.data.result,
              compressedSize: e.data.compressedSize
            });
          } else {
            reject(new Error(e.data.error));
          }
        }
      };

      this.compressionWorker.addEventListener('message', handleMessage);
      this.compressionWorker.postMessage({
        id,
        data,
        action: 'compress'
      });
    });
  }

  /**
   * 解压缩数据
   */
  private async decompressData(compressedData: string): Promise<any> {
    if (!this.compressionWorker) {
      return JSON.parse(compressedData);
    }

    return new Promise((resolve, reject) => {
      const id = Date.now();

      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage);

          if (e.data.success) {
            resolve(e.data.result);
          } else {
            reject(new Error(e.data.error));
          }
        }
      };

      this.compressionWorker.addEventListener('message', handleMessage);
      this.compressionWorker.postMessage({
        id,
        data: compressedData,
        action: 'decompress'
      });
    });
  }

  /**
   * 检查是否需要清理缓存
   */
  private shouldEvict(newEntrySize: number): boolean {
    const currentSize = this.stats.totalSize + newEntrySize;
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;

    return currentSize > maxSizeBytes || this.cache.size >= this.config.maxEntries;
  }

  /**
   * 清理最少使用的缓存条目
   */
  private evictLeastRecentlyUsed(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    let freedSpace = 0;
    const evictionCandidates: string[] = [];

    for (const [key, entry] of entries) {
      evictionCandidates.push(key);
      freedSpace += entry.size;
      this.stats.evictionCount++;

      if (freedSpace >= requiredSpace) {
        break;
      }
    }

    evictionCandidates.forEach(key => this.cache.delete(key));
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hitRate + this.stats.missRate + 1;
    this.stats.hitRate = ((this.stats.hitRate * (total - 1)) + 1) / total;
  }

  /**
   * 更新失效率
   */
  private updateMissRate(): void {
    const total = this.stats.hitRate + this.stats.missRate + 1;
    this.stats.missRate = ((this.stats.missRate * (total - 1)) + 1) / total;
  }

  /**
   * 持久化缓存到localStorage
   */
  private persistCache(): void {
    try {
      const cacheData: Record<string, any> = {};

      this.cache.forEach((entry, key) => {
        cacheData[key] = entry;
      });

      localStorage.setItem('performance_cache_data', JSON.stringify(cacheData));
      localStorage.setItem('performance_cache_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.error('持久化缓存失败:', error);
    }
  }

  /**
   * 导出缓存数据
   */
  exportData(): string {
    try {
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        config: this.config,
        stats: this.stats,
        data: {}
      };

      this.cache.forEach((entry, key) => {
        exportData.data[key] = entry;
      });

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('导出缓存数据失败:', error);
      return '';
    }
  }

  /**
   * 导入缓存数据
   */
  importData(jsonData: string): boolean {
    try {
      const importData = JSON.parse(jsonData);

      if (importData.version !== '1.0.0') {
        console.warn('缓存数据版本不匹配');
      }

      // 合并配置
      if (importData.config) {
        this.config = { ...this.config, ...importData.config };
        localStorage.setItem('performance_cache_config', JSON.stringify(this.config));
      }

      // 导入数据
      if (importData.data) {
        Object.entries(importData.data).forEach(([key, entry]) => {
          // 检查是否过期
          if (entry.expiresAt > Date.now()) {
            this.cache.set(key, entry);
          }
        });
        this.updateStats();
        this.persistCache();
      }

      console.log('缓存数据导入成功');
      return true;
    } catch (error) {
      console.error('导入缓存数据失败:', error);
      return false;
    }
  }

  /**
   * 同步到云端
   */
  async syncToCloud(): Promise<SyncResult> {
    if (!this.config.syncEnabled || this.syncInProgress) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        error: '同步未启用或正在进行中'
      };
    }

    this.syncInProgress = true;

    try {
      // 这里应该实现实际的云端同步逻辑
      // 以下是模拟实现

      const localData = this.exportData();
      const uploaded = localData.length;

      // 模拟下载冲突检测
      const conflicts: SyncResult['conflicts'] = [];

      // 模拟同步结果
      const result: SyncResult = {
        success: true,
        uploaded,
        downloaded: 0,
        conflicts
      };

      this.stats.lastSync = Date.now();
      this.persistCache();

      return result;
    } catch (error) {
      console.error('云端同步失败:', error);
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 从云端同步
   */
  async syncFromCloud(): Promise<SyncResult> {
    if (!this.config.syncEnabled || this.syncInProgress) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        error: '同步未启用或正在进行中'
      };
    }

    this.syncInProgress = true;

    try {
      // 这里应该实现实际的云端同步逻辑
      // 以下是模拟实现

      // 模拟下载数据
      const downloaded = 1024; // 模拟下载的字节数

      // 模拟冲突检测
      const conflicts: SyncResult['conflicts'] = [];

      // 模拟同步结果
      const result: SyncResult = {
        success: true,
        uploaded: 0,
        downloaded,
        conflicts
      };

      this.stats.lastSync = Date.now();
      this.persistCache();

      return result;
    } catch (error) {
      console.error('云端同步失败:', error);
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 获取缓存键列表
   */
  getKeys(tag?: string): string[] {
    if (!tag) {
      return Array.from(this.cache.keys());
    }

    const keys: string[] = [];
    this.cache.forEach((entry, key) => {
      if (entry.tags.includes(tag)) {
        keys.push(key);
      }
    });

    return keys;
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && entry.expiresAt > Date.now();
  }

  /**
   * 获取缓存大小
   */
  getSize(): number {
    return this.stats.totalSize;
  }

  /**
   * 获取缓存条目数量
   */
  getCount(): number {
    return this.stats.totalEntries;
  }

  /**
   * 清理过期条目
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.updateStats();
      this.persistCache();
    }

    return cleanedCount;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }

    this.clear();
  }
}

// 导出单例实例
export const performanceDataCache = PerformanceDataCache.getInstance();

// 导出类型和服务类
export default PerformanceDataCache;