/**
 * 测试专用的缓存服务实现
 * 使用简单的内存存储，避免Redis依赖
 */

export interface TestCacheOptions {
  ttl?: number;        // 过期时间（秒）
  nx?: boolean;        // 仅当 key 不存在时设置
  prefix?: string;     // key 前缀
}

export interface TestCacheStats {
  hits: number;
  misses: number;
  sets: number;
  dels: number;
  errors: number;
  hitRate: number;
}

/**
 * 测试用的缓存服务类（内存实现）
 */
export class TestCacheService {
  private data: Map<string, { value: unknown; expiry?: number }> = new Map();
  private stats: TestCacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    dels: 0,
    errors: 0,
    hitRate: 0,
  };

  private readonly prefix: string = 'llmchat-test';
  private readonly DEFAULT_TTL: number = 300; // 5 分钟

  // Redis TTL返回值常量
  private readonly TTL_KEY_NOT_EXIST: number = -2;
  private readonly TTL_NO_EXPIRY: number = -1;

  /**
   * 检查是否已连接（对于测试总是返回true）
   */
  isConnected(): boolean {
    return true;
  }

  /**
   * 连接到缓存（对于测试总是成功）
   */
  connect(): Promise<void> {
    // 测试中不需要真实连接
    return Promise.resolve();
  }

  /**
   * 断开连接
   */
  disconnect(): Promise<void> {
    // 测试中不需要真实断开
    return Promise.resolve();
  }

  /**
   * 生成完整的 key（带前缀）
   */
  private getFullKey(key: string, prefix?: string): string {
    const p = prefix ?? this.prefix;
    return `${p}:${key}`;
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options?: TestCacheOptions): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const item = this.data.get(fullKey);

      if (!item) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      // 检查过期
      if (item.expiry && Date.now() > item.expiry) {
        this.data.delete(fullKey);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      return item.value as T;
    } catch (error: any) {
      this.stats.errors++;
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, options?: TestCacheOptions): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const ttl = options?.ttl ?? this.DEFAULT_TTL;

      // 检查 NX 选项
      if (options?.nx && this.data.has(fullKey)) {
        return false;
      }

      const expiry = Date.now() + ttl * 1000;
      this.data.set(fullKey, { value, expiry });
      this.stats.sets++;

      return true;
    } catch (error: any) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 删除缓存
   */
  del(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const existed = this.data.has(fullKey);
      this.data.delete(fullKey);

      if (existed) {
        this.stats.dels++;
        return Promise.resolve(1);
      }

      return Promise.resolve(0);
    } catch (error: any) {
      this.stats.errors++;
      return Promise.resolve(0);
    }
  }

  /**
   * 检查 key 是否存在
   */
  exists(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const item = this.data.get(fullKey);

      if (!item) {
        return Promise.resolve(0);
      }

      // 检查过期
      if (item.expiry && Date.now() > item.expiry) {
        this.data.delete(fullKey);
        return Promise.resolve(0);
      }

      return Promise.resolve(1);
    } catch (error: any) {
      this.stats.errors++;
      return Promise.resolve(0);
    }
  }

  /**
   * 设置过期时间
   */
  expire(key: string, seconds: number): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const item = this.data.get(fullKey);

      if (!item) {
        return Promise.resolve(0);
      }

      item.expiry = Date.now() + seconds * 1000;
      return Promise.resolve(1);
    } catch (error: any) {
      this.stats.errors++;
      return Promise.resolve(0);
    }
  }

  /**
   * 获取剩余过期时间
   */
  ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const item = this.data.get(fullKey);

      if (!item) {
        return Promise.resolve(this.TTL_KEY_NOT_EXIST);
      }

      if (!item.expiry) {
        return Promise.resolve(this.TTL_NO_EXPIRY);
      }

      const remaining = Math.floor((item.expiry - Date.now()) / 1000);
      return Promise.resolve(remaining > 0 ? remaining : this.TTL_KEY_NOT_EXIST);
    } catch (error: any) {
      this.stats.errors++;
      return Promise.resolve(this.TTL_KEY_NOT_EXIST);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): TestCacheStats {
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
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? Math.round((this.stats.hits / total) * 100 * 100) / 100 : 0;
  }

  /**
   * 健康检查
   */
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    details: {
      stats: TestCacheStats;
      redisConnected: boolean;
      memoryUsage: number;
    };
  }> {
    return Promise.resolve({
      status: 'healthy',
      details: {
        stats: this.getStats(),
        redisConnected: true,
        memoryUsage: this.data.size,
      },
    });
  }

  /**
   * 清空所有缓存
   */
  flushall(): Promise<string> {
    this.data.clear();
    return Promise.resolve('OK');
  }

  /**
   * 清空测试数据
   */
  clear(): void {
    this.data.clear();
    this.resetStats();
  }

  /**
   * 获取缓存项数量
   */
  size(): number {
    return this.data.size;
  }

  /**
   * 获取所有 keys
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }
}
