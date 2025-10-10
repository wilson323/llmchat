/**
 * FastGPT远程存储提供者
 * 与FastGPT API交互，获取和同步对话数据
 */

import { IStorageProvider, StorageTier, StorageOptions, StorageStats, SearchQuery } from '@/types/hybrid-storage';
import { FastGPTChatHistorySummary, FastGPTChatHistoryDetail } from '@/types';

interface FastGPTConfig {
  baseUrl: string;
  apiKey: string;
  appId?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface FastGPTResponse<T = any> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export class FastGPTStorageProvider implements IStorageProvider {
  readonly name = 'FastGPTStorage';
  readonly tier = StorageTier.FASTGPT_REMOTE;
  private config: FastGPTConfig;
  private isInitialized = false;
  private requestCache = new Map<string, {data: any, timestamp: number}>();
  private cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

  constructor(config: FastGPTConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  get isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           !!this.config.apiKey &&
           !!this.config.baseUrl &&
           this.isInitialized;
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 验证API连接
      await this.validateConnection();
      this.isInitialized = true;
      console.log('FastGPTStorage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FastGPTStorage:', error);
      throw error;
    }
  }

  private async validateConnection(): Promise<void> {
    try {
      const response = await this.makeRequest('/api/health', 'GET');
      if (response.code !== 200) {
        throw new Error(`FastGPT API validation failed: ${response.message}`);
      }
    } catch (error) {
      throw new Error(`FastGPT API connection failed: ${error}`);
    }
  }

  async destroy(): Promise<void> {
    this.requestCache.clear();
    this.isInitialized = false;
  }

  // ==================== 基础存储接口实现 ====================

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      // FastGPT使用chatId作为key
      const chatId = this.extractChatIdFromKey(key);
      if (!chatId) {
        return null;
      }

      // 检查缓存
      const cached = this.getCachedData(`chat:${chatId}`);
      if (cached) {
        return cached as T;
      }

      const detail = await this.getChatHistory(chatId);
      if (!detail) {
        return null;
      }

      this.setCachedData(`chat:${chatId}`, detail);
      return detail as T;
    } catch (error) {
      console.error('Failed to get from FastGPT:', error);
      return null;
    }
  }

  async set<T>(_key: string, _value: T, _options: StorageOptions = {}): Promise<void> {
    // FastGPT是只读存储，不支持直接写入
    console.warn('FastGPTStorage is read-only, set operation ignored');
  }

  async delete(_key: string): Promise<boolean> {
    // FastGPT不支持通过API删除对话
    console.warn('FastGPTStorage is read-only, delete operation ignored');
    return false;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const chatId = this.extractChatIdFromKey(key);
      if (!chatId) {
        return false;
      }

      const summary = await this.getChatSummary(chatId);
      return !!summary;
    } catch (error) {
      console.error('Failed to check existence in FastGPT:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    // FastGPT不支持清空操作
    console.warn('FastGPTStorage is read-only, clear operation ignored');
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    // 批量获取优化：一次性获取多个会话
    const chatIds = keys.map(key => this.extractChatIdFromKey(key)).filter(Boolean) as string[];
    const summaries = await this.getChatSummaries(chatIds);

    for (const key of keys) {
      const chatId = this.extractChatIdFromKey(key);
      if (!chatId) {
        result.set(key, null);
        continue;
      }

      const summary = summaries.find(s => s.chatId === chatId);
      if (summary) {
        // 获取完整会话详情
        const detail = await this.get<T>(key);
        result.set(key, detail);
      } else {
        result.set(key, null);
      }
    }

    return result;
  }

  async mset<T>(_entries: Array<{key: string, value: T, options?: StorageOptions}>): Promise<void> {
    // FastGPT不支持批量写入
    console.warn('FastGPTStorage is read-only, mset operation ignored');
  }

  async mdelete(_keys: string[]): Promise<boolean> {
    // FastGPT不支持批量删除
    console.warn('FastGPTStorage is read-only, mdelete operation ignored');
    return false;
  }

  async list<T>(prefix = '', limit?: number): Promise<Array<{key: string, value: T}>> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      // 获取会话列表
      const summaries = await this.getAllChatSummaries();

      // 应用前缀过滤
      const filtered = prefix
        ? summaries.filter(s => s.chatId.startsWith(prefix))
        : summaries;

      // 限制结果数量
      const limited = limit ? filtered.slice(0, limit) : filtered;

      // 获取完整数据
      const results: Array<{key: string, value: T}> = [];
      for (const summary of limited) {
        const key = this.generateKeyFromChatId(summary.chatId);
        const value = await this.get<T>(key);
        if (value) {
          results.push({ key, value });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to list from FastGPT:', error);
      return [];
    }
  }

  async search<T>(query: SearchQuery): Promise<Array<{key: string, value: T, score: number}>> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      // 获取所有会话摘要
      const summaries = await this.getAllChatSummaries();
      const results: Array<{key: string, value: T, score: number}> = [];

      for (const summary of summaries) {
        let score = 0;

        // 文本匹配
        if (query.text) {
          if (summary.title.includes(query.text) ||
              summary.chatId.includes(query.text)) {
            score += 10;
          }
        }

        // 日期范围匹配
        if (query.dateRange) {
          const createdAt = new Date(summary.createdAt).getTime();
          if (createdAt >= query.dateRange.start && createdAt <= query.dateRange.end) {
            score += 15;
          }
        }

        // 消息数量匹配
        if (query.messageCount) {
          const msgCount = summary.messageCount || 0;
          if ((!query.messageCount.min || msgCount >= query.messageCount.min) &&
              (!query.messageCount.max || msgCount <= query.messageCount.max)) {
            score += 5;
          }
        }

        if (score > 0) {
          const key = this.generateKeyFromChatId(summary.chatId);
          const value = await this.get<T>(key);
          if (value) {
            results.push({ key, value, score });
          }
        }
      }

      // 排序和限制结果
      results.sort((a, b) => b.score - a.score);
      if (query.limit) {
        results.splice(query.limit);
      }

      return results;
    } catch (error) {
      console.error('Failed to search FastGPT:', error);
      return [];
    }
  }

  async getStats(): Promise<StorageStats> {
    if (!this.isAvailable) {
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

    try {
      const summaries = await this.getAllChatSummaries();
      const totalEntries = summaries.length;
      const totalSize = JSON.stringify(summaries).length * 2; // 粗略估算

      const timestamps = summaries.map(s => new Date(s.createdAt).getTime());
      const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
      const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

      return {
        totalEntries,
        totalSize,
        hitCount: 0, // 远程存储不跟踪本地命中
        missCount: 0,
        hitRate: 0,
        averageAccessTime: this.config.timeout || 30000, // 使用超时时间作为平均访问时间
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      console.error('Failed to get FastGPT stats:', error);
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

  // ==================== FastGPT特定方法 ====================

  /**
   * 获取会话摘要列表
   */
  async getChatSummaries(chatIds?: string[]): Promise<FastGPTChatHistorySummary[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const cacheKey = `summaries:${chatIds?.join(',') || 'all'}`;
      const cached = this.getCachedData<FastGPTChatHistorySummary[]>(cacheKey);
      if (cached) {
        return cached;
      }

      let url = '/api/chat/list';
      if (chatIds && chatIds.length > 0) {
        url += `?chatIds=${chatIds.join(',')}`;
      }

      const response = await this.makeRequest<FastGPTChatHistorySummary[]>(url);
      this.setCachedData(cacheKey, response.data, 2 * 60 * 1000); // 2分钟缓存
      return response.data;
    } catch (error) {
      console.error('Failed to get chat summaries:', error);
      return [];
    }
  }

  /**
   * 获取所有会话摘要
   */
  async getAllChatSummaries(): Promise<FastGPTChatHistorySummary[]> {
    return this.getChatSummaries();
  }

  /**
   * 获取会话详情
   */
  async getChatHistory(chatId: string): Promise<FastGPTChatHistoryDetail | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const cacheKey = `chat:${chatId}`;
      const cached = this.getCachedData<FastGPTChatHistoryDetail>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest<FastGPTChatHistoryDetail>(`/api/chat/detail?chatId=${chatId}`);
      this.setCachedData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error(`Failed to get chat history for ${chatId}:`, error);
      return null;
    }
  }

  /**
   * 获取会话摘要
   */
  async getChatSummary(chatId: string): Promise<FastGPTChatHistorySummary | null> {
    const summaries = await this.getChatSummaries([chatId]);
    return summaries.find(s => s.chatId === chatId) || null;
  }

  /**
   * 按智能体ID过滤会话
   */
  async getChatSummariesByAgent(agentId: string): Promise<FastGPTChatHistorySummary[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const cacheKey = `summaries:agent:${agentId}`;
      const cached = this.getCachedData<FastGPTChatHistorySummary[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest<FastGPTChatHistorySummary[]>(`/api/chat/list?appId=${agentId}`);
      this.setCachedData(cacheKey, response.data, 2 * 60 * 1000);
      return response.data;
    } catch (error) {
      console.error(`Failed to get chat summaries for agent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * 增量获取会话更新
   */
  async getIncrementalUpdates(agentId: string, since?: number): Promise<any[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      let url = `/api/chat/updates?appId=${agentId}`;
      if (since) {
        url += `&since=${since}`;
      }

      const response = await this.makeRequest<any[]>(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get incremental updates:', error);
      return [];
    }
  }

  // ==================== 私有辅助方法 ====================

  private async makeRequest<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
  ): Promise<FastGPTResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const maxRetries = this.config.retryAttempts || 3;
    const retryDelay = this.config.retryDelay || 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: FastGPTResponse<T> = await response.json();

        if (result.code !== 200) {
          throw new Error(`FastGPT API error: ${result.message}`);
        }

        return result;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // 指数退避重试
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  private extractChatIdFromKey(key: string): string | null {
    // 从key中提取chatId
    // 假设key格式为: session:{agentId}:{chatId} 或 chatId本身
    const parts = key.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : key;
  }

  private generateKeyFromChatId(chatId: string): string {
    return `fastgpt:${chatId}`;
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    if (cached) {
      this.requestCache.delete(key);
    }

    return null;
  }

  private setCachedData<T>(key: string, data: T, expiry?: number): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // 如果设置了自定义过期时间，使用定时器清理
    if (expiry && expiry !== this.cacheExpiry) {
      setTimeout(() => {
        this.requestCache.delete(key);
      }, expiry);
    }
  }

  // 公共方法：清理缓存
  public clearCache(): void {
    this.requestCache.clear();
  }

  // 公共方法：更新配置
  public updateConfig(newConfig: Partial<FastGPTConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}