import { useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
// 使用拆分的store架构
import agentStore from '@/store/agentStore';
import sessionStore from '@/store/sessionStore';
import { getSessionPerformanceMonitor } from '@/utils/sessionPerformance';

interface OptimisticSessionSwitchOptions {
  onSessionStartLoading?: (sessionId: string) => void;
  onSessionLoadComplete?: (sessionId: string, success: boolean) => void;
  enablePreloading?: boolean;
  maxPreloadedSessions?: number;
}

interface SessionCache {
  [sessionId: string]: {
    messages: ChatMessage[];
    lastAccessed: number;
    loading: boolean;
    error?: string;
  };
}

/**
 * 乐观会话切换Hook
 * 实现预加载、缓存和乐观更新机制
 */
export const useOptimisticSessionSwitch = ({
  onSessionStartLoading,
  onSessionLoadComplete,
  enablePreloading = true,
  maxPreloadedSessions = 5,
}: OptimisticSessionSwitchOptions = {}) => {
  const currentAgent = agentStore.getState().currentAgent;
  const currentSession = sessionStore.getState().currentSession;
  const switchToSession = sessionStore.getState().switchToSession;
  const setSessionMessages = sessionStore.getState().setSessionMessages;
  const agentSessions: Record<string, any> = {};

  const sessionCacheRef = useRef<SessionCache>({});
  const loadingSessionsRef = useRef<Set<string>>(new Set());
  const preloadQueueRef = useRef<string[]>([]);

  // 性能监控
  const performanceMonitor = useRef(getSessionPerformanceMonitor());

  // 获取缓存的会话
  const getCachedSession = useCallback((sessionId: string): ChatMessage[] | null => {
    const cached = sessionCacheRef.current[sessionId];
    if (cached && cached.messages.length > 0) {
      // 更新最后访问时间
      cached.lastAccessed = Date.now();
      return cached.messages;
    }
    return null;
  }, []);

  // 缓存会话数据
  const cacheSessionData = useCallback((sessionId: string, messages: ChatMessage[]): void => {
    sessionCacheRef.current[sessionId] = {
      messages: [...messages],
      lastAccessed: Date.now(),
      loading: false,
    };

    // 清理过期缓存
    cleanupCache();
  }, []);

  // 清理过期缓存
  const cleanupCache = useCallback((): void => {
    const cache = sessionCacheRef.current;
    const entries = Object.entries(cache);

    if (entries.length <= maxPreloadedSessions) {
      return;
    }

    // 按最后访问时间排序，保留最近访问的会话
    const sorted = entries
      .sort(([, a], [, b]) => b.lastAccessed - a.lastAccessed)
      .slice(0, maxPreloadedSessions);

    const newCache: SessionCache = {};
    sorted.forEach(([sessionId, data]) => {
      newCache[sessionId] = data;
    });

    sessionCacheRef.current = newCache;
  }, [maxPreloadedSessions]);

  // 模拟异步加载会话数据
  const loadSessionData = useCallback(async (sessionId: string): Promise<ChatMessage[]> => {
    // 防止重复加载
    if (loadingSessionsRef.current.has(sessionId)) {
      return getCachedSession(sessionId) || [];
    }

    loadingSessionsRef.current.add(sessionId);

    try {
      // 更新缓存状态
      if (sessionCacheRef.current[sessionId]) {
        sessionCacheRef.current[sessionId].loading = true;
      }

      onSessionStartLoading?.(sessionId);

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      // 这里应该是实际的数据加载逻辑
      // 比如从本地存储、IndexedDB或API获取
      const sessions = agentSessions[currentAgent?.id || ''] || [];
      const session = sessions.find((s: any) => s.id === sessionId);
      const messages: ChatMessage[] = session?.messages || [];

      // 缓存数据
      cacheSessionData(sessionId, messages);

      onSessionLoadComplete?.(sessionId, true);
      return messages;

    } catch (error) {
      console.error('加载会话数据失败:', error);

      if (sessionCacheRef.current[sessionId]) {
        sessionCacheRef.current[sessionId].error = '加载失败';
        sessionCacheRef.current[sessionId].loading = false;
      }

      onSessionLoadComplete?.(sessionId, false);
      return [];

    } finally {
      loadingSessionsRef.current.delete(sessionId);
    }
  }, [currentAgent, agentSessions, getCachedSession, cacheSessionData, onSessionStartLoading, onSessionLoadComplete]);

  // 预加载会话
  const preloadSession = useCallback(async (sessionId: string): Promise<void> => {
    // 如果已经缓存或正在加载，跳过
    if (getCachedSession(sessionId) || loadingSessionsRef.current.has(sessionId)) {
      return;
    }

    // 添加到预加载队列
    if (!preloadQueueRef.current.includes(sessionId)) {
      preloadQueueRef.current.push(sessionId);
    }

    // 处理预加载队列
    while (preloadQueueRef.current.length > 0) {
      const nextSessionId = preloadQueueRef.current.shift()!;
      await loadSessionData(nextSessionId);
    }
  }, [getCachedSession, loadSessionData]);

  // 乐观切换会话
  const optimisticSwitchToSession = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!currentAgent) {
      console.warn('没有选中的智能体');
      return false;
    }

    // 立即更新UI状态（乐观更新）
    const targetSession = agentSessions[currentAgent.id]?.find((s: any) => s.id === sessionId);
    if (!targetSession) {
      console.warn('找不到目标会话');
      return false;
    }

    // 获取消息数量用于性能监控
    const messageCount = targetSession.messages?.length || 0;
    const isCached = getCachedSession(sessionId) !== null;

    // 开始性能监控
    performanceMonitor.current.startSessionSwitch(sessionId, messageCount, isCached);

    try {
      // 立即切换UI，使用缓存数据或空数组
      switchToSession(currentAgent.id, sessionId);

      const cachedMessages = getCachedSession(sessionId);

      if (cachedMessages) {
        // 使用缓存数据，UI立即响应
        setSessionMessages(currentAgent.id, sessionId, cachedMessages);
        performanceMonitor.current.endSessionSwitch(sessionId);
        return true;
      }

      // 没有缓存，异步加载数据
      const messages = await loadSessionData(sessionId);
      setSessionMessages(currentAgent.id, sessionId, messages);
      performanceMonitor.current.endSessionSwitch(sessionId);
      return true;

    } catch (error) {
      console.error('切换会话失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      performanceMonitor.current.endSessionSwitch(sessionId, errorMessage);
      return false;
    }
  }, [currentAgent, agentSessions, switchToSession, setSessionMessages, getCachedSession, loadSessionData]);

  // 智能预加载
  const smartPreloadSessions = useCallback((): void => {
    if (!enablePreloading || !currentAgent) {
      return;
    }

    const agentSessionsList = agentSessions[currentAgent.id] || [];
    const currentSessionId = currentSession?.id;

    // 获取最近访问的会话（排除当前会话）
    const recentSessions = agentSessionsList
      .filter((s: any) => s.id !== currentSessionId)
      .slice(0, maxPreloadedSessions);

    // 预加载最近访问的会话
    recentSessions.forEach((session: any) => {
      if (!getCachedSession(session.id)) {
        preloadSession(session.id);
      }
    });
  }, [enablePreloading, currentAgent, currentSession, agentSessions, maxPreloadedSessions, getCachedSession, preloadSession]);

  // 预加载相邻会话
  const preloadAdjacentSessions = useCallback((): void => {
    if (!enablePreloading || !currentAgent || !currentSession) {
      return;
    }

    const agentSessionsList = agentSessions[currentAgent.id] || [];
    const currentIndex = agentSessionsList.findIndex((s: any) => s.id === currentSession.id);

    if (currentIndex === -1) {
      return;
    }

    // 预加载前后各2个会话
    const adjacentIndices = [
      currentIndex - 2,
      currentIndex - 1,
      currentIndex + 1,
      currentIndex + 2,
    ].filter(i => i >= 0 && i < agentSessionsList.length);

    adjacentIndices.forEach(index => {
      const session = agentSessionsList[index];
      if (session && !getCachedSession(session.id)) {
        preloadSession(session.id);
      }
    });
  }, [enablePreloading, currentAgent, currentSession, agentSessions, getCachedSession, preloadSession]);

  // 监听会话变化，触发智能预加载
  useEffect(() => {
    if (currentSession) {
      smartPreloadSessions();
      preloadAdjacentSessions();
    }
  }, [currentSession, smartPreloadSessions, preloadAdjacentSessions]);

  // 监听智能体变化，清理缓存
  useEffect(() => {
    sessionCacheRef.current = {};
    preloadQueueRef.current = [];
    loadingSessionsRef.current.clear();
  }, [currentAgent]);

  // 开发模式下输出性能统计
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        const stats = performanceMonitor.current.getPerformanceStats();
        const bottlenecks = performanceMonitor.current.analyzePerformanceBottlenecks();

        if (bottlenecks.issues.length > 0) {
          console.group('🚨 会话切换性能问题');
          bottlenecks.issues.forEach((issue) => console.warn('⚠️', issue));
          bottlenecks.recommendations.forEach((rec) => console.info('💡', rec));
          console.groupEnd();
        }

        console.log('📊 会话切换性能统计:', {
          总切换次数: stats.totalSwitches,
          平均切换时间: `${stats.averageSwitchTime.toFixed(2)}ms`,
          缓存命中率: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
          错误率: `${(stats.errorRate * 100).toFixed(1)}%`,
        });
      }, 10000); // 每10秒输出一次

      return () => clearInterval(interval);
    }
    return undefined;
  }, []);

  // 获取缓存统计信息
  const getCacheStats = useCallback((): {
    totalCached: number;
    totalMessages: number;
    loadingCount: number;
    maxCacheSize: number;
    cacheSize: number;
  } => {
    const cache = sessionCacheRef.current;
    const totalCached = Object.keys(cache).length;
    const totalMessages = Object.values(cache).reduce((sum, data) => sum + data.messages.length, 0);
    const loadingCount = loadingSessionsRef.current.size;

    return {
      totalCached,
      totalMessages,
      loadingCount,
      maxCacheSize: maxPreloadedSessions,
      cacheSize: totalCached / maxPreloadedSessions,
    };
  }, [maxPreloadedSessions]);

  // 清除指定会话的缓存
  const clearSessionCache = useCallback((sessionId: string): void => {
    delete sessionCacheRef.current[sessionId];
    preloadQueueRef.current = preloadQueueRef.current.filter((id) => id !== sessionId);
  }, []);

  // 清除所有缓存
  const clearAllCache = useCallback((): void => {
    sessionCacheRef.current = {};
    preloadQueueRef.current = [];
    loadingSessionsRef.current.clear();
  }, []);

  // 检查会话是否已缓存
  const isSessionCached = useCallback((sessionId: string): boolean => {
    const cached = sessionCacheRef.current[sessionId];
    return !!(cached && cached.messages.length > 0 && !cached.loading && !cached.error);
  }, []);

  return {
    // 主要功能
    switchToSession: optimisticSwitchToSession,

    // 预加载功能
    preloadSession,
    smartPreloadSessions,
    preloadAdjacentSessions,

    // 缓存管理
    getCachedSession,
    cacheSessionData,
    clearSessionCache,
    clearAllCache,
    isSessionCached,

    // 状态查询
    getCacheStats,
    isLoadingSession: (sessionId: string) => loadingSessionsRef.current.has(sessionId),

    // 性能监控
    getPerformanceStats: () => performanceMonitor.current.getPerformanceStats(),
    getSessionMetrics: (sessionId: string) => performanceMonitor.current.getSessionMetrics(sessionId),
    getPerformanceReport: () => performanceMonitor.current.getPerformanceReport(),
    analyzePerformanceBottlenecks: () => performanceMonitor.current.analyzePerformanceBottlenecks(),
  };
};