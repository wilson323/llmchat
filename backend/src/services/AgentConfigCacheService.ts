/**
 * 智能体配置缓存服务
 * 专注于智能体配置的高效缓存和热重载
 */

import { AgentConfig } from '@/types';
import logger from '@/utils/logger';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';
import { memoryResourceManager } from '@/utils/MemoryResourceManager';

// 缓存配置
interface CacheConfig {
  ttl: number; // 缓存生存时间（毫秒）
  maxSize: number; // 最大缓存条目数
  enableMetrics: boolean;
  cleanupInterval: number;
}

// 缓存条目
interface CacheEntry {
  agent: AgentConfig;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

// 缓存统计
interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
  averageAccessTime: number;
}

/**
 * 智能体配置缓存服务
 */
export class AgentConfigCacheService {
  private static instance: AgentConfigCacheService;

  // 主缓存 - 存储完整的智能体配置
  private cache = new Map<string, CacheEntry>();

  // 索引缓存 - 按类型和标签快速查找
  private indexByType = new Map<string, Set<string>>();
  private indexByTag = new Map<string, Set<string>>();
  private indexByProvider = new Map<string, Set<string>>();

  // 配置文件监听
  private watchers = new Set<() => void>();

  // 性能统计
  private stats: CacheStats = {
    totalHits: 0,
    totalMisses: 0,
    hitRate: 0,
    size: 0,
    memoryUsage: 0,
    averageAccessTime: 0,
  };

  // 配置
  private readonly config: CacheConfig = {
    ttl: 30 * 60 * 1000, // 30分钟
    maxSize: 10000,
    enableMetrics: true,
    cleanupInterval: 5 * 60 * 1000, // 5分钟
  };

  private constructor() {
    // 启动内存监控
    memoryResourceManager.start({
      cleanupInterval: this.config.cleanupInterval,
      enableMetrics: true,
    });

    // 定期清理过期缓存
    setInterval(() => this.cleanupExpiredEntries(), this.config.cleanupInterval);

    // 定期更新统计信息
    setInterval(() => this.updateStats(), 10 * 1000);

    logger.info('AgentConfigCacheService 初始化完成', {
      ttl: this.config.ttl,
      maxSize: this.config.maxSize,
      cleanupInterval: this.config.cleanupInterval,
    });
  }

  static getInstance(): AgentConfigCacheService {
    if (!AgentConfigCacheService.instance) {
      AgentConfigCache.instance = new AgentConfigCacheService();
    }
    return AgentConfigCacheCacheService.instance;
  }

  /**
   * 获取智能体配置
   */
  async getAgent(agentId: string): Promise<AgentConfig | null> {
    const startTime = performance.now();

    try {
      // 检查缓存
      const cached = this.cache.get(agentId);
      if (cached && !this.isExpired(cached)) {
        // 更新访问统计
        this.updateAccessStats(cached);
        this.stats.totalHits++;

        logger.debug('🎯 命中智能体缓存', {
          agentId,
          accessTime: performance.now() - startTime,
        });

        return { ...cached.agent };
      }

      // 缓存未命中
      this.stats.totalMisses++;
      this.updateHitRate();

      logger.debug('❌ 智能体缓存未命中', {
        agentId,
        accessTime: performance.now() - startTime,
      });

      return null;
    } catch (error) {
      logger.error('获取智能体配置失败', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      this.updateAverageAccessTime(performance.now() - startTime);
    }
  }

  /**
   * 设置智能体配置
   */
  async setAgent(agent: AgentConfig): Promise<void> {
    try {
      const agentId = agent.id;
      const now = Date.now();

      // 如果缓存已满，移除最旧的条目
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldestEntries();
      }

      // 创建缓存条目
      const entry: CacheEntry = {
        agent: { ...agent },
        timestamp: now,
        ttl: this.config.ttl,
        accessCount: 0,
        lastAccessed: now,
      };

      // 如果已存在，先移除旧的索引
      const existingEntry = this.cache.get(agentId);
      if (existingEntry) {
        this.removeFromIndexes(existingEntry.agent);
      }

      // 添加到缓存
      this.cache.set(agentId, entry);

      // 更新索引
      this.addToIndexes(entry.agent, agentId);

      // 更新统计
      this.stats.size = this.cache.size;
      this.updateMemoryUsage();

      logger.debug('💾 智能体配置已缓存', {
        agentId,
        provider: agent.provider,
        type: agent.type,
      });

      // 通知监听器
      this.notifyWatchers();

    } catch (error) {
      logger.error('设置智能体配置失败', {
        agentId: agent.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 批量设置智能体配置
   */
  async setAgents(agents: AgentConfig[]): Promise<void> {
    try {
      const startTime = performance.now();
      let successCount = 0;
      let failureCount = 0;

      for (const agent of agents) {
        try {
          await this.setAgent(agent);
          successCount++;
        } catch (error) {
          failureCount++;
          logger.warn('批量缓存智能体失败', {
            agentId: agent.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const duration = performance.now() - startTime;
      logger.info('智能体批量缓存完成', {
        totalCount: agents.length,
        successCount,
        failureCount,
        duration: duration.toFixed(2),
        cacheSize: this.cache.size,
      });

    } catch (error) {
      logger.error('批量设置智能体配置失败', {
        agentsCount: agents.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 删除智能体配置
   */
  async removeAgent(agentId: string): Promise<boolean> {
    try {
      const entry = this.cache.get(agentId);
      if (!entry) {
        return false;
      }

      // 从缓存中移除
      this.cache.delete(agentId);

      // 从索引中移除
      this.removeFromIndexes(entry.agent, agentId);

      // 更新统计
      this.stats.size = this.cache.size;
      this.updateMemoryUsage();

      logger.debug('🗑️ 智能体配置已从缓存中删除', { agentId });

      // 通知监听器
      this.notifyWatchers();

      return true;
    } catch (error) {
      logger.error('删除智能体配置失败', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  async clearCache(): Promise<void> {
    try {
      const size = this.cache.size;
      this.cache.clear();

      // 清空所有索引
      this.indexByType.clear();
      this.indexByTag.clear();
      this.indexByProvider.clear();

      // 重置统计
      this.stats = {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        size: 0,
        memoryUsage: 0,
        averageAccessTime: 0,
      };

      logger.info('🧹 智能体配置缓存已清空', { clearedCount: size });

      // 通知监听器
      this.notifyWatchers();

    } catch (error) {
      logger.error('清空缓存失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 按类型获取智能体列表
   */
  async getAgentsByType(type: string): Promise<AgentConfig[]> {
    try {
      const agentIds = this.indexByType.get(type);
      if (!agentIds) {
        return [];
      }

      const agents: AgentConfig[] = [];
      for (const agentId of agentIds) {
        const entry = this.cache.get(agentId);
        if (entry && !this.isExpired(entry)) {
          agents.push({ ...entry.agent });
        }
      }

      return agents;
    } catch (error) {
      logger.error('按类型获取智能体失败', {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 按提供商获取智能体列表
   */
  async getAgentsByProvider(provider: string): Promise<AgentConfig[]> {
    try {
      const agentIds = this.indexByProvider.get(provider);
      if (!agentIds) {
        return [];
      }

      const agents: AgentConfig[] = [];
      for (const agentId of agentIds) {
        const entry = this.cache.get(agentId);
        if (entry && !this.isExpired(entry)) {
          agents.push({ ...entry.agent });
        }
      }

      return agents;
    } catch (error) {
      logger.error('按提供商获取智能体失败', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 按标签获取智能体列表
   */
  async getAgentsByTag(tag: string): Promise<AgentConfig[]> {
    try {
      const agentIds = this.indexByTag.get(tag);
      if (!agentIds) {
        return [];
      }

      const agents: AgentConfig[] = [];
      for (const agentId of agentIds) {
        const entry = this.cache.get(agentId);
        if (entry && !this.isExpired(entry)) {
          agents.push({ ...entry.agent });
        }
      }

      return agents;
    } catch (error) {
      logger.error('按标签获取智能体失败', {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取所有活跃的智能体
   */
  async getActiveAgents(): Promise<AgentConfig[]> {
    try {
      const agents: AgentConfig[] = [];

      for (const [agentId, entry] of this.cache.entries()) {
        if (!this.isExpired(entry) && entry.agent.isActive) {
          agents.push({ ...entry.agent });
        }
      }

      return agents;
    } catch (error) {
      logger.error('获取活跃智能体失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取所有智能体（包括非活跃的）
   */
  async getAllAgents(): Promise<AgentConfig[]> {
    try {
      const agents: AgentConfig[] = [];

      for (const [agentId, entry] of this.cache.entries()) {
        if (!this.isExpired(entry)) {
          agents.push({ ...entry.agent });
        }
      }

      return agents;
    } catch (error) {
      logger.error('获取所有智能体失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 搜索智能体
   */
  async searchAgents(query: string): Promise<AgentConfig[]> {
    try {
      const lowercaseQuery = query.toLowerCase();
      const agents: AgentConfig[] = [];

      for (const [agentId, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          continue;
        }

        const agent = entry.agent;

        // 检查名称、描述、提供商
        if (
          agent.name.toLowerCase().includes(lowercaseQuery) ||
          agent.description?.toLowerCase().includes(lowercaseQuery) ||
          agent.provider.toLowerCase().includes(lowercaseQuery) ||
          agent.type.toLowerCase().includes(lowercaseQuery)
        ) {
          agents.push({ ...agent });
        }
      }

      return agents;
    } catch (error) {
      logger.error('搜索智能体失败', {
        query,
        error: error.error instanceof Error ? error.error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 预热缓存
   */
  async preloadCache(agents: AgentConfig[]): Promise<void> {
    try {
      const startTime = performance.now();

      logger.info('🔥 开始预热智能体缓存', { agentCount: agents.length });

      await this.setAgents(agents);

      const duration = performance.now() - startTime;
      logger.info('🔥 智能体缓存预热完成', {
        agentCount: agents.length,
        cacheSize: this.cache.size,
        duration: duration.toFixed(2),
      });

    } catch (error) {
      logger.error('预热缓存失败', {
        agentCount: agents.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存健康状态
   */
  getHealthStatus() {
    const memoryUsage = memoryResourceManager.getMetrics();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;

    return {
      status: this.getHealthStatusByMetrics(),
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      hitRate: this.stats.hitRate,
      memoryPressure: memoryPressure,
      memoryUsage: this.stats.memoryUsage,
      lastCleanup: Date.now(),
      uptime: Date.now(), // 这里可以记录服务启动时间
    };
  }

  /**
   * 添加配置变更监听器
   */
  addWatcher(watcher: () => void): void {
    this.watchers.add(watcher);
  }

  /**
   * 移除配置变更监听器
   */
  removeWatcher(watcher: () => void): void {
    this.watchers.delete(watcher);
  }

  /**
   * 手动触发缓存清理
   */
  async cleanup(): Promise<void> {
    await this.cleanupExpiredEntries();
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    try {
      // 清空缓存
      await this.clearCache();

      // 清理监听器
      this.watchers.clear();

      logger.info('AgentConfigCacheService 已销毁');
    } catch (error) {
      logger.error('销毁服务失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 私有方法

  /**
   * 检查缓存条目是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * 更新访问统计
   */
  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? this.stats.totalHits / total : 0;
  }

  /**
   * 更新平均访问时间
   */
  private updateAverageAccessTime(accessTime: number): void {
    this.stats.averageAccessTime =
      (this.stats.averageAccessTime * 0.9) + (accessTime * 0.1);
  }

  /**
   * 更新内存使用量
   */
  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      // 估算JSON序列化后的大小
      totalSize += JSON.stringify(entry.agent).length;
    }
    this.stats.memoryUsage = totalSize;
  }

  /**
   * 添加到索引
   */
  private addToIndexes(agent: AgentConfig, agentId: string): void {
    // 按类型索引
    if (agent.type) {
      if (!this.indexByType.has(agent.type)) {
        this.indexByType.set(agent.type, new Set());
      }
      this.indexByType.get(agent.type)!.add(agentId);
    }

    // 按提供商索引
    if (agent.provider) {
      if (!this.indexByProvider.has(agent.provider)) {
        this.indexByProvider.set(agent.provider, new Set());
      }
      this.indexByProvider.get(agent.provider)!.add(agentId);
    }

    // 按标签索引
    if (agent.tags && agent.tags.length > 0) {
      for (const tag of agent.tags) {
        if (!this.indexByTag.has(tag)) {
          this.indexByTag.set(tag, new Set());
        }
        this.indexByTag.get(tag)!.add(agentId);
      }
    }
  }

  /**
   * 从索引中移除
   */
  private removeFromIndexes(agent: AgentConfig, agentId: string): void {
    // 从类型索引中移除
    if (agent.type) {
      const typeIndex = this.indexByType.get(agent.type);
      if (typeIndex) {
        typeIndex.delete(agentId);
        if (typeIndex.size === 0) {
          this.indexByType.delete(agent.type);
        }
      }
    }

    // 从提供商索引中移除
    if (agent.provider) {
      const providerIndex = this.indexByProvider.get(agent.provider);
      if (providerIndex) {
        providerIndex.delete(agentId);
        if (providerIndex.size === 0) {
          this.indexByProvider.delete(agent.provider);
        }
      }
    }

    // 从标签索引中移除
    if (agent.tags && agent.tags.length > 0) {
      for (const tag of agent.tags) {
        const tagIndex = this.indexByTag.get(tag);
        if (tagIndex) {
          tagIndex.delete(agentId);
          if (tagIndex.size === 0) {
            this.indexByTag.delete(tag);
          }
        }
      }
    }
  }

  /**
   * 清理过期条目
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      logger.debug('🧹 清理过期智能体缓存', {
        expiredCount: expiredKeys.length,
        remainingCount: this.cache.size - expiredKeys.length,
      });

      for (const key of expiredKeys) {
        const entry = this.cache.get(key);
        if (entry) {
          this.removeFromIndexes(entry.agent, key);
        }
        this.cache.delete(key);
      }

      // 更新统计
      this.stats.size = this.cache.size;
      this.updateMemoryUsage();
    }
  }

  /**
   * 驺逐最旧的条目
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toEvict = Math.max(1, entries.length - this.config.maxCacheSize + 1);

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const [key, entry] = entries[i];

      this.removeFromIndexes(entry.agent, key);
      this.cache.delete(key);
    }

    if (toEvict > 0) {
      logger.debug('🗑️ 驱逐智能体缓存条目', {
        evictedCount: toEvict,
        remainingCount: this.cache.size,
      });
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    try {
      this.updateHitRate();
      this.updateMemoryUsage();

      if (this.config.enableMetrics) {
        logger.debug('AgentConfigCacheService 统计更新', {
          ...this.stats,
          cacheSize: this.cache.size,
          maxCacheSize: this.config.maxCacheSize,
        });
      }
    } catch (error) {
      logger.error('更新统计信息失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 通知监听器
   */
  private notifyWatchers(): void {
    try {
      for (const watcher of this.watchers) {
        watcher();
      }
    } catch (error) {
      logger.error('通知监听器失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 根据指标获取健康状态
   */
  private getHealthStatusByMetrics(): string {
    if (this.stats.hitRate < 0.5) {
      return 'DEGRADED';
    }

    if (this.cache.size === 0) {
      return 'EMPTY';
    }

    if (this.cache.size >= this.config.maxCacheSize * 0.9) {
      return 'FULL';
    }

    return 'HEALTHY';
  }
}

// 导出单例实例
export const agentConfigCacheService = AgentConfigCacheService.getInstance();