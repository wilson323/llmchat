/**
 * 混合存储管理器
 * 统一管理内存、IndexedDB和FastGPT远程存储
 * 提供透明的数据访问和智能缓存策略
 */

import {
  IStorageProvider,
  ICacheManager,
  ISyncManager,
  SyncStatus,
  SearchQuery,
  HybridStorageConfig,
  DataTemperature,
  CacheStrategy,
} from '@/types/hybrid-storage';


import { ChatSession, ChatMessage } from '@/types';

import { MemoryStorageProvider } from './MemoryStorageProvider';
import { IndexedDBStorageProvider } from './IndexedDBStorageProvider';
import { FastGPTStorageProvider } from './FastGPTStorageProvider';
import { CacheManager } from '../cache/CacheManager';
import { SyncManager } from '../sync/SyncManager';

export class HybridStorageManager {
  private memoryProvider: MemoryStorageProvider;
  private indexedDBProvider: IndexedDBStorageProvider;
  private fastgptProvider: FastGPTStorageProvider;
  private cacheManager: ICacheManager;
  private syncManager: ISyncManager;
  private config: HybridStorageConfig;
  private isInitialized = false;

  constructor(config: Partial<HybridStorageConfig> = {}) {
    // 默认配置
    this.config = {
      cache: {
        memory: {
          maxSize: 50 * 1024 * 1024, // 50MB
          maxEntries: 1000,
          strategy: CacheStrategy.LRU,
          ttl: 30 * 60 * 1000, // 30分钟
        },
        indexedDB: {
          maxSize: 100 * 1024 * 1024, // 100MB
          maxEntries: 10000,
          strategy: CacheStrategy.LFU,
          ttl: 7 * 24 * 60 * 60 * 1000, // 7天
        },
      },
      sync: {
        autoSync: true,
        syncInterval: 5 * 60 * 1000, // 5分钟
        batchSize: 10,
        maxRetries: 3,
        conflictResolution: 'prompt',
        compressData: true,
        deltaSync: true,
      },
      performance: {
        enableMonitoring: true,
        monitoringInterval: 30 * 1000, // 30秒
        enableOptimizations: true,
        compressionThreshold: 10 * 1024, // 10KB
      },
      storage: {
        enableEncryption: false,
        enableCompression: true,
        backupEnabled: false,
        cleanupInterval: 60 * 60 * 1000, // 1小时
      },
      ...config,
    };

    // 初始化存储提供者
    this.memoryProvider = new MemoryStorageProvider(
      this.config.cache.memory.maxSize,
      this.config.cache.memory.maxEntries,
    );

    this.indexedDBProvider = new IndexedDBStorageProvider(
      this.config.cache.indexedDB.maxSize,
      this.config.cache.indexedDB.maxEntries,
    );

    // FastGPT提供者需要外部配置
    this.fastgptProvider = new FastGPTStorageProvider({
      baseUrl: process.env.REACT_APP_FASTGPT_BASE_URL || '',
      apiKey: process.env.REACT_APP_FASTGPT_API_KEY || '',
      timeout: 30000,
    });

    // 初始化缓存和同步管理器
    this.cacheManager = new CacheManager(this.memoryProvider, this.indexedDBProvider);
    this.syncManager = new SyncManager(
      this.memoryProvider,
      this.indexedDBProvider,
      this.fastgptProvider,
      this.config.sync,
    );

    this.setupEventListeners();
  }

  // ==================== 初始化 ====================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('初始化混合存储管理器...');

      // 并行初始化所有组件
      await Promise.all([
        this.memoryProvider.init(),
        this.indexedDBProvider.init(),
        this.fastgptProvider.init(),
      ]);

      // 设置缓存策略
      this.cacheManager.setStrategy(this.config.cache.memory.strategy);

      // 设置同步策略
      this.syncManager.setSyncPolicy(this.config.sync);

      this.isInitialized = true;
      console.log('混合存储管理器初始化完成');

      // 启动后台任务
      if (this.config.performance.enableOptimizations) {
        this.startBackgroundTasks();
      }

    } catch (error) {
      console.error('混合存储管理器初始化失败:', error);
      throw error;
    }
  }

  // ==================== 会话管理 ====================

  /**
   * 获取会话
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 1. 尝试从缓存获取
      let session = await this.cacheManager.get<ChatSession>(`session:${sessionId}`);
      if (session) {
        // 更新访问时间
        session.lastAccessedAt = Date.now();
        await this.cacheManager.set(`session:${sessionId}`, session, {
          temperature: DataTemperature.HOT,
        });
        return session;
      }

      // 2. 尝试从IndexedDB获取
      session = await this.indexedDBProvider.get<ChatSession>(`session:${sessionId}`);
      if (session) {
        // 提升到缓存
        await this.cacheManager.set(`session:${sessionId}`, session, {
          temperature: DataTemperature.WARM,
        });
        return session;
      }

      // 3. 尝试从FastGPT获取
      if (this.fastgptProvider.isAvailable) {
        const remoteSession = await this.fastgptProvider.get<any>(sessionId);
        if (remoteSession) {
          const localSession = this.convertRemoteSessionToLocal(remoteSession);

          // 保存到本地存储
          await this.saveSession(localSession);

          return localSession;
        }
      }

      return null;

    } catch (error) {
      console.error(`获取会话失败 ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * 保存会话
   */
  async saveSession(session: ChatSession): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const key = `session:${session.id}`;
      const now = Date.now();

      // 更新时间戳
      session.updatedAt = now;
      session.lastAccessedAt = now;

      // 确定数据温度
      const temperature = this.determineSessionTemperature(session);

      // 保存到缓存
      await this.cacheManager.set(key, session, {
        temperature,
        compress: session.messages.length > 50, // 大会话压缩存储
      });

      // 如果是热数据，也保存到内存
      if (temperature === DataTemperature.HOT) {
        await this.memoryProvider.set(key, session);
      }

      // 标记需要同步
      await this.syncManager.setSyncStatus(session.id, SyncStatus.PENDING);

    } catch (error) {
      console.error(`保存会话失败 ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const key = `session:${sessionId}`;

      // 从所有存储层删除
      await Promise.all([
        this.cacheManager.delete(key),
        this.memoryProvider.delete(key),
        this.indexedDBProvider.delete(key),
      ]);

    } catch (error) {
      console.error(`删除会话失败 ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 获取智能体的所有会话
   */
  async getAgentSessions(agentId: string, limit = 50): Promise<ChatSession[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const sessions: ChatSession[] = [];

      // 1. 从本地缓存获取
      const localSessions = await this.indexedDBProvider.list<ChatSession>(
        `session:${agentId}:`,
        limit,
      );
      sessions.push(...localSessions.map(s => s.value));

      // 2. 如果本地数据不足，从FastGPT获取
      if (sessions.length < limit && this.fastgptProvider.isAvailable) {
        try {
          const remoteSessions = await (this.fastgptProvider as any).getChatSummariesByAgent(agentId);

          for (const remoteSummary of remoteSessions.slice(0, limit - sessions.length)) {
            // 检查是否已存在
            if (!sessions.find(s => s.metadata?.fastgptChatId === remoteSummary.chatId)) {
              const remoteSession = await this.fastgptProvider.get<any>(remoteSummary.chatId);
              if (remoteSession) {
                const localSession = this.convertRemoteSessionToLocal(remoteSession);
                sessions.push(localSession);

                // 缓存新获取的会话
                await this.cacheManager.set(`session:${localSession.id}`, localSession, {
                  temperature: DataTemperature.WARM,
                });
              }
            }
          }
        } catch (error) {
          console.warn('从FastGPT获取会话失败:', error);
        }
      }

      // 按更新时间排序
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return sessions.slice(0, limit);

    } catch (error) {
      console.error(`获取智能体会话失败 ${agentId}:`, error);
      return [];
    }
  }

  /**
   * 搜索会话
   */
  async searchSessions(query: SearchQuery): Promise<Array<{session: ChatSession, score: number}>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const results: Array<{session: ChatSession, score: number}> = [];

      // 搜索本地缓存
      const localResults = await this.indexedDBProvider.search<ChatSession>(query);
      for (const { value: session, score } of localResults) {
        results.push({ session, score });
      }

      // 搜索FastGPT（如果需要更多结果）
      if (results.length < (query.limit || 20) && this.fastgptProvider.isAvailable) {
        try {
          const remoteResults = await this.fastgptProvider.search<any>(query);

          for (const { value: remoteSession, score: remoteScore } of remoteResults) {
            // 转换为本地格式
            const localSession = this.convertRemoteSessionToLocal(remoteSession);

            // 检查是否已存在
            const existingIndex = results.findIndex(r => r.session.id === localSession.id);
            if (existingIndex === -1) {
              results.push({ session: localSession, score: remoteScore });
            } else {
              // 更新分数（取较高值）
              const existingResult = results[existingIndex];
              if (existingResult) {
                existingResult.score = Math.max(existingResult.score, remoteScore);
              }
            }
          }
        } catch (error) {
          console.warn('搜索FastGPT失败:', error);
        }
      }

      // 排序并限制结果
      results.sort((a, b) => b.score - a.score);
      if (query.limit) {
        results.splice(query.limit);
      }

      return results;

    } catch (error) {
      console.error('搜索会话失败:', error);
      return [];
    }
  }

  // ==================== 消息管理 ====================

  /**
   * 添加消息到会话
   */
  async addMessageToSession(sessionId: string, message: ChatMessage): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      // 添加消息
      session.messages.push(message);
      session.messageCount = session.messages.length;
      session.updatedAt = Date.now();

      // 保存更新后的会话
      await this.saveSession(session);

      // 预加载相关数据
      this.cacheManager.preload([`session:${sessionId}`]);

    } catch (error) {
      console.error(`添加消息失败 ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 更新会话中的消息
   */
  async updateMessageInSession(
    sessionId: string,
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage | undefined,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      // 查找并更新消息
      const messageIndex = session.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        throw new Error(`消息不存在: ${messageId}`);
      }

      // 查找消息并确保它存在
      const message = session.messages[messageIndex];
      if (!message) {
        throw new Error(`消息不存在: ${messageId}`);
      }

      // updater函数可能返回undefined，进行类型检查
      const updatedMessage = updater(message);
      if (!updatedMessage) {
        throw new Error(`消息更新失败: ${messageId} - updater返回了无效的消息`);
      }

      session.messages[messageIndex] = updatedMessage;
      session.updatedAt = Date.now();

      // 保存更新后的会话
      await this.saveSession(session);

    } catch (error) {
      console.error(`更新消息失败 ${sessionId}:`, error);
      throw error;
    }
  }

  // ==================== 同步操作 ====================

  /**
   * 同步会话
   */
  async syncSession(sessionId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.syncManager.syncSession(sessionId);
      return result.success;
    } catch (error) {
      console.error(`同步会话失败 ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 同步智能体的所有会话
   */
  async syncAgentSessions(agentId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.syncManager.syncAgentSessions(agentId);
      return result.failureCount === 0;
    } catch (error) {
      console.error(`同步智能体会话失败 ${agentId}:`, error);
      return false;
    }
  }

  /**
   * 强制同步所有数据
   */
  async forceSyncAll(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.syncManager.syncAllSessions();
      return result.failureCount === 0;
    } catch (error) {
      console.error('强制同步失败:', error);
      return false;
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * 预加载智能体会话
   */
  async preloadAgentSessions(agentId: string, limit = 10): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.cacheManager.preloadAgentSessions(agentId, limit);
  }

  /**
   * 清理缓存
   */
  async cleanupCache(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.cacheManager.cleanup();
  }

  /**
   * 优化缓存
   */
  async optimizeCache(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.cacheManager.optimize();
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.cacheManager.getUsageStats();
  }

  // ==================== 离线支持 ====================

  /**
   * 启用离线模式
   */
  async enableOfflineMode(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.syncManager.enableOfflineMode();
  }

  /**
   * 禁用离线模式
   */
  async disableOfflineMode(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.syncManager.disableOfflineMode();
  }

  /**
   * 检查是否为离线模式
   */
  async isOfflineMode(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.syncManager.isOfflineMode();
  }

  // ==================== 统计和监控 ====================

  /**
   * 获取存储统计
   */
  async getStorageStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const [memoryStats, indexedDBStats, fastgptStats] = await Promise.all([
      this.memoryProvider.getStats(),
      this.indexedDBProvider.getStats(),
      this.fastgptProvider.getStats(),
    ]);

    return {
      memory: memoryStats,
      indexedDB: indexedDBStats,
      fastgpt: fastgptStats,
      cache: await this.cacheManager.getUsageStats(),
    };
  }

  /**
   * 获取同步统计
   */
  async getSyncStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.syncManager.getSyncStats();
  }

  // ==================== 事件监听 ====================

  /**
   * 监听同步进度
   */
  onSyncProgress(callback: (progress: any) => void): () => void {
    return this.syncManager.onSyncProgress(callback);
  }

  /**
   * 监听同步冲突
   */
  onSyncConflict(callback: (conflict: any) => void): () => void {
    return this.syncManager.onSyncConflict(callback);
  }

  /**
   * 监听同步错误
   */
  onSyncError(callback: (error: any) => void): () => void {
    return this.syncManager.onSyncError(callback);
  }

  // ==================== 私有方法 ====================

  private setupEventListeners(): void {
    // 监听在线/离线状态变化
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('网络已连接，尝试同步数据...');
        this.syncManager.disableOfflineMode();
      });

      window.addEventListener('offline', () => {
        console.log('网络已断开，启用离线模式...');
        this.syncManager.enableOfflineMode();
      });
    }
  }

  private startBackgroundTasks(): void {
    // 定期清理缓存
    setInterval(async () => {
      await this.cleanupCache();
    }, this.config.storage.cleanupInterval);

    // 定期优化缓存
    setInterval(async () => {
      await this.optimizeCache();
    }, 2 * this.config.storage.cleanupInterval);
  }

  private determineSessionTemperature(session: ChatSession): DataTemperature {
    const now = Date.now();
    const timeSinceLastAccess = now - (session.lastAccessedAt ?? now);
    const timeSinceUpdate = now - new Date(session.updatedAt).getTime();

    // 最近访问的会话是热数据
    if (timeSinceLastAccess < 60 * 60 * 1000) { // 1小时内
      return DataTemperature.HOT;
    }

    // 最近更新的会话是温数据
    if (timeSinceUpdate < 24 * 60 * 60 * 1000) { // 24小时内
      return DataTemperature.WARM;
    }

    // 其他情况是冷数据
    return DataTemperature.COLD;
  }

  private convertRemoteSessionToLocal(remoteSession: any): ChatSession {
    // 转换FastGPT格式的会话为本地格式
    return {
      id: remoteSession.chatId,
      title: remoteSession.title || '未命名会话',
      agentId: remoteSession.appId || 'default',
      messages: this.convertRemoteMessages(remoteSession.messages || []),
      createdAt: new Date(remoteSession.createdAt || Date.now()).getTime(),
      updatedAt: new Date(remoteSession.updatedAt || Date.now()).getTime(),
      lastAccessedAt: Date.now(),
      messageCount: remoteSession.messages?.length || 0,
      isPinned: false,
      tags: remoteSession.tags || [],
      isArchived: false,
      metadata: {
        fastgptChatId: remoteSession.chatId,
        remoteMetadata: remoteSession.metadata,
        syncedAt: Date.now(),
      },
    };
  }

  private convertRemoteMessages(remoteMessages: any[]): ChatMessage[] {
    return remoteMessages.map(msg => ({
      [msg.role === 'user' ? 'HUMAN' : 'AI']: msg.content,
      id: msg.id || msg.dataId,
      feedback: msg.feedback,
      timestamp: msg.timestamp || Date.now(),
      raw: msg.raw,
    }));
  }

  // ==================== 公共工具方法 ====================

  /**
   * 检查健康状态
   */
  async healthCheck(): Promise<{
    memory: boolean;
    indexedDB: boolean;
    fastgpt: boolean;
    overall: boolean;
  }> {
    try {
      const [memoryOk, indexedDBOk, fastgptOk] = await Promise.all([
        this.checkProviderHealth(this.memoryProvider),
        this.checkProviderHealth(this.indexedDBProvider),
        this.checkProviderHealth(this.fastgptProvider),
      ]);

      return {
        memory: memoryOk,
        indexedDB: indexedDBOk,
        fastgpt: fastgptOk,
        overall: memoryOk && indexedDBOk && fastgptOk,
      };

    } catch (error) {
      console.error('健康检查失败:', error);
      return {
        memory: false,
        indexedDB: false,
        fastgpt: false,
        overall: false,
      };
    }
  }

  private async checkProviderHealth(provider: IStorageProvider): Promise<boolean> {
    try {
      // 尝试读写测试
      const testKey = `health_test_${Date.now()}`;
      const testValue = { test: true, timestamp: Date.now() };

      await provider.set(testKey, testValue);
      const retrieved = await provider.get(testKey);
      await provider.delete(testKey);

      return retrieved !== null && (retrieved as {test: boolean}).test === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 销毁存储管理器
   */
  async destroy(): Promise<void> {
    try {
      // 销毁所有组件
      await Promise.all([
        this.memoryProvider.destroy(),
        this.indexedDBProvider.destroy(),
        this.fastgptProvider.destroy(),
      ]);

      // 销毁管理器
      (this.cacheManager as any).destroy();
      this.isInitialized = false;

    } catch (error) {
      console.error('销毁存储管理器失败:', error);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<HybridStorageConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig);

    // 更新同步策略
    if (newConfig.sync) {
      this.syncManager.setSyncPolicy({
        ...this.config.sync,
        ...newConfig.sync,
      });
    }

    // 更新缓存策略
    if (newConfig.cache?.memory?.strategy) {
      this.cacheManager.setStrategy(newConfig.cache.memory.strategy);
    }
  }

  private mergeConfig(
    base: HybridStorageConfig,
    update: Partial<HybridStorageConfig>,
  ): HybridStorageConfig {
    return {
      cache: { ...base.cache, ...update.cache },
      sync: { ...base.sync, ...update.sync },
      performance: { ...base.performance, ...update.performance },
      storage: { ...base.storage, ...update.storage },
    } as HybridStorageConfig;
  }
}