/**
 * 混合存储服务使用示例
 * 展示如何在FastGPT聊天应用中集成和使用混合存储架构
 */

import {
  HybridStorageManager,
  useHybridChatStore,
  globalPerformanceMonitor,
  globalErrorHandler,
  defaultHybridStorageConfig,
} from '@/services/HybridStorageService';
import { CacheStrategy } from '@/types/hybrid-storage';
import { useEffect, useState } from 'react';

// ==================== 基础使用示例 ====================

/**
 * 初始化混合存储服务的示例
 */
export async function initializeHybridStorage() {
  try {
    // 创建存储管理器
    const storageManager = new HybridStorageManager({
      ...defaultHybridStorageConfig,
      // 自定义配置
      cache: {
        memory: {
          ...defaultHybridStorageConfig.cache!.memory,
          maxSize: 100 * 1024 * 1024, // 100MB内存缓存
          strategy: CacheStrategy.LRU,
        },
        indexedDB: {
          ...defaultHybridStorageConfig.cache!.indexedDB,
        },
      },
      sync: defaultHybridStorageConfig.sync,
    });

    // 初始化存储管理器
    await storageManager.initialize();

    // 检查健康状态
    const health = await storageManager.healthCheck();
    if (!health.overall) {
      console.warn('存储系统健康检查失败:', health);
    }

    // 设置性能监控
    globalPerformanceMonitor.startRealTimeMonitoring();

    // 设置错误处理
    globalErrorHandler.initialize();

    // 监听性能告警
    globalPerformanceMonitor.onPerformanceAlert((alert) => {
      console.warn('性能告警:', alert);
      // 可以显示用户友好的提示
    });

    // 监听同步错误
    storageManager.onSyncError((error) => {
      console.error('同步错误:', error);
      // 可以显示同步状态提示
    });

    console.log('混合存储服务初始化完成');
    return storageManager;

  } catch (error) {
    console.error('混合存储服务初始化失败:', error);
    throw error;
  }
}

// ==================== React Hook使用示例 ====================

/**
 * 在React组件中使用混合存储的Hook示例
 */
export function useHybridStorage() {
  const store = useHybridChatStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    // 初始化存储
    const initStorage = async () => {
      try {
        await store.initializeStorage();
        setIsInitialized(true);

        // 检查健康状态
        const health = await store.checkStorageHealth();
        setHealthStatus(health);

      } catch (error) {
        console.error('存储初始化失败:', error);
      }
    };

    initStorage();

    // 监听网络状态变化
    const handleOnline = () => {
      console.log('网络已连接');
      store.disableOfflineMode();
    };

    const handleOffline = () => {
      console.log('网络已断开');
      store.enableOfflineMode();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [store]);

  return {
    store,
    isInitialized,
    healthStatus,
    // 便捷方法
    syncCurrentSession: () => store.syncCurrentSession(),
    syncAllSessions: () => store.syncAllSessions(),
    preloadSessions: (agentId: string) => store.preloadSessions(agentId),
    cleanupCache: () => store.cleanupCache(),
  };
}

// ==================== 会话管理示例 ====================

/**
 * 会话管理操作的示例函数
 */
export class SessionManager {
  constructor(private storageManager: HybridStorageManager) {}

  /**
   * 创建新会话
   */
  async createSession(agentId: string, initialMessage?: string) {
    try {
      const newSession = {
        id: Date.now().toString(),
        title: initialMessage ? initialMessage.substring(0, 30) : '新对话',
        agentId,
        messages: initialMessage ? [{ HUMAN: initialMessage, timestamp: Date.now() }] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: Date.now(),
        messageCount: initialMessage ? 1 : 0,
        isPinned: false,
        tags: [],
        isArchived: false,
      };

      // 保存到混合存储
      await this.storageManager.saveSession(newSession);

      // 预加载相关会话
      await this.storageManager.preloadAgentSessions(agentId, 5);

      console.log('新会话创建成功:', newSession.id);
      return newSession;

    } catch (error) {
      console.error('创建会话失败:', error);
      throw error;
    }
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, content: string, isAI = false) {
    try {
      const message = {
        [isAI ? 'AI' : 'HUMAN']: content,
        id: `msg_${Date.now()}`,
        timestamp: Date.now(),
      };

      await this.storageManager.addMessageToSession(sessionId, message);

      // 同步会话（如果配置了自动同步）
      await this.storageManager.syncSession(sessionId);

      console.log('消息添加成功:', message.id);
      return message;

    } catch (error) {
      console.error('添加消息失败:', error);
      throw error;
    }
  }

  /**
   * 搜索会话
   */
  async searchSessions(query: string, agentId?: string) {
    try {
      const searchQuery = {
        text: query,
        agentId,
        limit: 20,
        sortBy: 'updatedAt' as const,
        sortOrder: 'desc' as const,
      };

      const results = await this.storageManager.searchSessions(searchQuery);
      console.log(`搜索到 ${results.length} 个会话`);
      return results;

    } catch (error) {
      console.error('搜索会话失败:', error);
      return [];
    }
  }

  /**
   * 批量同步智能体会话
   */
  async syncAgentSessions(agentId: string) {
    try {
      console.log(`开始同步智能体 ${agentId} 的会话...`);
      const success = await this.storageManager.syncAgentSessions(agentId);

      if (success) {
        console.log('同步成功');
      } else {
        console.warn('同步失败或部分失败');
      }

      return success;

    } catch (error) {
      console.error('同步失败:', error);
      return false;
    }
  }
}

// ==================== 性能监控示例 ====================

/**
 * 性能监控使用示例
 */
export function setupPerformanceMonitoring() {
  // 启动实时监控
  globalPerformanceMonitor.startRealTimeMonitoring();

  // 监听性能告警
  const unsubscribe = globalPerformanceMonitor.onPerformanceAlert((alert) => {
    console.warn(`性能告警 [${alert.type}]:`, alert.message);

    // 根据告警类型采取行动
    switch (alert.metric) {
      case 'slow_access':
        console.log('建议:', alert.suggestions);
        break;
      case 'high_error_rate':
        console.error('需要立即关注错误率问题');
        break;
      case 'cache_hit_rate_low':
        console.log('缓存命中率低，建议调整缓存策略');
        break;
    }
  });

  // 定期生成性能报告
  setInterval(async () => {
    const report = await globalPerformanceMonitor.getPerformanceReport();

    console.log('性能报告:', {
      generatedAt: new Date(report.generatedAt).toISOString(),
      storage: report.storage,
      sync: report.sync,
      alerts: report.alerts.length,
      suggestions: report.suggestions.length,
    });

    // 如果有重要告警，可以通知用户
    if (report.alerts.some(a => a.type === 'critical')) {
      console.error('发现严重性能问题，需要立即处理');
    }

  }, 10 * 60 * 1000); // 每10分钟生成一次报告

  return unsubscribe;
}

// ==================== 错误处理示例 ====================

/**
 * 错误处理配置示例
 */
export function setupErrorHandling() {
  // 初始化错误处理服务
  globalErrorHandler.initialize();

  // 注册自定义错误恢复策略
  globalErrorHandler.registerRecoveryStrategy('CUSTOM_ERROR', {
    type: 'retry',
    maxRetries: 3,
    retryDelay: 2000,
  });

  // 监听错误事件
  const unsubscribeError = globalErrorHandler.onError((error) => {
    console.error('系统错误:', error);

    // 根据错误类型显示用户友好的提示
    if (error.type === 'network') {
      // 显示网络问题提示
      console.log('提示: 网络连接不稳定，请检查网络设置');
    } else if (error.type === 'storage') {
      // 显示存储问题提示
      console.log('提示: 存储空间不足，请清理数据');
    }
  });

  // 监听错误解决事件
  const unsubscribeResolved = globalErrorHandler.onErrorResolved((error) => {
    console.log('错误已解决:', error.id);
  });

  // 包装操作以自动处理错误
  // 示例：调用安全操作包装器
  void (async () => {
    const result = await globalErrorHandler.wrapOperation(
      async () => {
        // 可能失败的操作
        return someRiskyOperation();
      },
      'storage',
      'RISKY_OPERATION_FAILED',
      { operation: 'data_sync' },
    );

    if (result.success) {
      console.log('操作成功:', result.data);
    } else {
      console.error('操作失败:', result.error);
    }
  })();

  return () => {
    unsubscribeError();
    unsubscribeResolved();
  };
}

// ==================== 缓存优化示例 ====================

/**
 * 缓存优化策略示例
 */
export class CacheOptimizer {
  constructor(private storageManager: HybridStorageManager) {}

  /**
   * 智能预加载策略
   */
  async intelligentPreload(agentId: string) {
    try {
      // 1. 获取智能体的会话列表
      const sessions = await this.storageManager.getAgentSessions(agentId, 20);

      // 2. 按访问频率排序
      const sortedSessions = sessions.sort((a, b) =>
        (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0),
      );

      // 3. 预加载前10个最活跃的会话
      const topSessions = sortedSessions.slice(0, 10);
      const preloadPromises = topSessions.map(session =>
        this.storageManager.getSession(session.id),
      );

      await Promise.all(preloadPromises);
      console.log(`预加载了 ${topSessions.length} 个活跃会话`);

    } catch (error) {
      console.error('智能预加载失败:', error);
    }
  }

  /**
   * 缓存清理策略
   */
  async performCacheCleanup() {
    try {
      // 1. 清理过期数据
      await this.storageManager.cleanupCache();

      // 2. 优化缓存结构
      await this.storageManager.optimizeCache();

      // 3. 获取清理后的统计信息
      const stats = await this.storageManager.getCacheStats();

      console.log('缓存清理完成:', {
        memoryUsage: stats.memoryUsage.percentage.toFixed(1) + '%',
        indexedDBUsage: stats.indexedDBUsage.percentage.toFixed(1) + '%',
        hitRate: (stats.performance.hitRate * 100).toFixed(1) + '%',
      });

    } catch (error) {
      console.error('缓存清理失败:', error);
    }
  }

  /**
   * 基于使用模式的缓存优化
   */
  async optimizeBasedOnUsage() {
    try {
      // 获取性能统计
      const stats = await this.storageManager.getStorageStats();

      // 分析使用模式
      const memoryHitRate = stats.memory.hitRate;
      const indexedDBHitRate = stats.indexedDB.hitRate;

      if (memoryHitRate < 0.6) {
        console.log('内存缓存命中率较低，建议增加内存缓存大小');
        // 可以动态调整缓存配置
      }

      if (indexedDBHitRate < 0.8) {
        console.log('IndexedDB缓存命中率较低，建议优化查询索引');
      }

      // 生成优化建议
      const suggestions = await globalPerformanceMonitor.getOptimizationSuggestions();
      suggestions.forEach(suggestion => {
        console.log(`优化建议 [${suggestion.priority}]:`, suggestion.title);
        console.log('描述:', suggestion.description);
        console.log('预期影响:', suggestion.expectedImpact);
      });

    } catch (error) {
      console.error('缓存优化分析失败:', error);
    }
  }
}

// ==================== 完整集成示例 ====================

/**
 * 完整的混合存储集成示例
 */
export class HybridStorageIntegration {
  private storageManager: HybridStorageManager | null = null;
  private sessionManager: SessionManager | null = null;
  private cacheOptimizer: CacheOptimizer | null = null;

  async initialize() {
    try {
      console.log('开始初始化混合存储集成...');

      // 1. 初始化存储管理器
      this.storageManager = await initializeHybridStorage();

      // 2. 初始化会话管理器
      this.sessionManager = new SessionManager(this.storageManager);

      // 3. 初始化缓存优化器
      this.cacheOptimizer = new CacheOptimizer(this.storageManager);

      // 4. 设置性能监控
      setupPerformanceMonitoring();

      // 5. 设置错误处理
      setupErrorHandling();

      // 6. 执行初始优化
      await this.performInitialOptimization();

      console.log('混合存储集成初始化完成');
      return true;

    } catch (error) {
      console.error('混合存储集成初始化失败:', error);
      return false;
    }
  }

  private async performInitialOptimization() {
    if (!this.cacheOptimizer) {
      return;
    }

    try {
      // 执行缓存清理
      await this.cacheOptimizer.performCacheCleanup();

      // 获取存储统计
      const stats = await this.storageManager!.getStorageStats();
      console.log('初始存储统计:', stats);

    } catch (error) {
      console.error('初始优化失败:', error);
    }
  }

  getStorageManager() {
    return this.storageManager;
  }

  getSessionManager() {
    return this.sessionManager;
  }

  getCacheOptimizer() {
    return this.cacheOptimizer;
  }

  async destroy() {
    try {
      // 停止性能监控
      globalPerformanceMonitor.destroy();

      // 销毁错误处理服务
      globalErrorHandler.destroy();

      // 销毁存储管理器
      if (this.storageManager) {
        await this.storageManager.destroy();
      }

      console.log('混合存储集成已销毁');

    } catch (error) {
      console.error('销毁混合存储集成失败:', error);
    }
  }
}

// ==================== 辅助函数 ====================

// 示例风险操作
async function someRiskyOperation(): Promise<string> {
  // 模拟可能失败的操作
  if (Math.random() > 0.7) {
    throw new Error('操作失败');
  }
  return '操作成功';
}

// 导出默认实例
export const hybridStorageIntegration = new HybridStorageIntegration();