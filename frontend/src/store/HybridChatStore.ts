/**
 * 混合存储聊天状态管理
 * 集成混合存储架构到现有的chatStore
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Agent, ChatMessage, ChatSession, AgentSessionsMap } from '@/types';
import { HybridStorageManager } from '@/services/storage/HybridStorageManager';
import { SearchQuery, CacheUsageStats } from '@/types/hybrid-storage';
import { logger } from '@/lib/logger';

interface HybridChatState {
  // 混合存储管理器
  storageManager: HybridStorageManager | null;
  isStorageInitialized: boolean;
  storageError: string | null;

  // 原有状态（从chatStore.ts复制）
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;
  agentSessions: AgentSessionsMap;
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingStatus: Record<string, unknown> | null;
  streamAbortController: AbortController | null;
  preferences: Record<string, unknown>;
  agentSelectorOpen: boolean;
  sidebarOpen: boolean;

  // 混合存储特有状态
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncTime: number;
  pendingSyncCount: number;
  cacheStats: CacheUsageStats | null;
  isOnline: boolean;

  // Actions
  initializeStorage: () => Promise<void>;
  setStorageManager: (manager: HybridStorageManager) => void;

  // 智能体操作
  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;

  // 会话操作（混合存储版本）
  loadAgentSessions: (agentId: string) => Promise<void>;
  saveCurrentSession: () => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchToSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;

  // 消息操作（混合存储版本）
  addMessage: (message: ChatMessage) => Promise<void>;
  updateLastMessage: (content: string) => Promise<void>;
  clearMessages: () => Promise<void>;

  // 同步操作
  syncCurrentSession: () => Promise<boolean>;
  syncAgentSessions: (agentId?: string) => Promise<boolean>;
  syncAllSessions: () => Promise<boolean>;
  forceSyncAll: () => Promise<boolean>;

  // 缓存操作
  preloadSessions: (agentId: string, limit?: number) => Promise<void>;
  cleanupCache: () => Promise<void>;
  optimizeCache: () => Promise<void>;
  refreshCacheStats: () => Promise<void>;

  // 搜索操作
  searchSessions: (query: SearchQuery) => Promise<Array<{session: ChatSession, score: number}>>;

  // 离线操作
  enableOfflineMode: () => Promise<void>;
  disableOfflineMode: () => Promise<void>;

  // UI状态
  setAgentSelectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingStatus: (status: Record<string, unknown> | null) => void;
  setStreamAbortController: (controller: AbortController | null) => void;
  stopStreaming: () => void;

  // 健康检查
  checkStorageHealth: () => Promise<any>;
}

export const useHybridChatStore = create<HybridChatState>()(
  subscribeWithSelector((set: any, get: any): HybridChatState => ({
    // 初始状态
    storageManager: null,
    isStorageInitialized: false,
    storageError: null,

    agents: [],
    currentAgent: null,
    agentsLoading: false,
    agentsError: null,
    agentSessions: {},
    currentSession: null,
    messages: [],
    isStreaming: false,
    streamingStatus: null,
    streamAbortController: null,
    preferences: {
      theme: { mode: 'auto', isAutoMode: true, userPreference: 'auto' },
      streamingEnabled: true,
      autoThemeSchedule: { enabled: true, lightModeStart: '06:00', darkModeStart: '18:00' },
      language: 'zh-CN',
    },
    agentSelectorOpen: false,
    sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,

    // 混合存储状态
    syncStatus: 'idle',
    lastSyncTime: 0,
    pendingSyncCount: 0,
    cacheStats: null,
    isOnline: navigator.onLine,

    // Actions
    initializeStorage: async () => {
      try {
        set({ storageError: null, agentsLoading: true });

        // 创建存储管理器
        const storageManager = new HybridStorageManager();
        await storageManager.initialize();

        // 设置事件监听器
        storageManager.onSyncProgress((progress) => {
          set({ syncStatus: 'syncing' });
          logger.info('同步进度', progress);
        });

        storageManager.onSyncError((error) => {
          set({ syncStatus: 'error', storageError: error.error });
          logger.error('同步错误', error as Error);
        });

        // 检查网络状态
        const isOfflineMode = await storageManager.isOfflineMode();
        set({ syncStatus: isOfflineMode ? 'offline' : 'idle' });

        // 获取缓存统计
        const cacheStats = await storageManager.getCacheStats();
        set({ cacheStats });

        set({
          storageManager,
          isStorageInitialized: true,
          agentsLoading: false,
        });

      } catch (error) {
        logger.error('存储初始化失败', error as Error);
        set({
          storageError: error instanceof Error ? error.message : '存储初始化失败',
          agentsLoading: false,
        });
      }
    },

    setStorageManager: (manager: HybridStorageManager) => set({ storageManager: manager }),

    // 智能体操作
    setAgents: (agents: Agent[]) => set({ agents }),

    setCurrentAgent: async (agent: Agent | null) => {
      const state = get();

      if (!agent) {
        set({
          currentAgent: null,
          currentSession: null,
          messages: [],
        });
        return;
      }

      set({ currentAgent: agent, agentsLoading: true });

      try {
        // 加载智能体的会话
        await state.loadAgentSessions(agent.id);

        // 选择最新会话
        const agentSessions = state.agentSessions[agent.id] || [];
        const latestSession = agentSessions[0] || null;

        set({
          currentSession: latestSession,
          messages: latestSession ? latestSession.messages : [],
          agentsLoading: false,
        });

        // 预加载相关会话
        if (state.storageManager) {
          state.storageManager.preloadAgentSessions(agent.id, 5);
        }

      } catch (error) {
        logger.error('设置当前智能体失败', error as Error, { agentId: agent.id });
        set({ agentsError: error instanceof Error ? error.message : '设置智能体失败' });
      }
    },

    setAgentsLoading: (loading: boolean) => set({ agentsLoading: loading }),
    setAgentsError: (error: string | null) => set({ agentsError: error }),

    // 会话操作（混合存储版本）
    loadAgentSessions: async (agentId: string) => {
      const state = get();
      if (!state.storageManager) {
        logger.warn('存储管理器未初始化');
        return;
      }

      try {
        set({ agentsLoading: true });

        // 从混合存储获取会话
        const sessions = await state.storageManager.getAgentSessions(agentId);

        set({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: sessions,
          },
          agentsLoading: false,
        });

      } catch (error) {
        logger.error('加载智能体会话失败', error as Error, { agentId });
        set({ agentsError: error instanceof Error ? error.message : '加载会话失败' });
      }
    },

    saveCurrentSession: async () => {
      const state = get();
      if (!state.storageManager || !state.currentSession) {
        return;
      }

      try {
        // 更新当前会话的消息
        const updatedSession = {
          ...state.currentSession,
          messages: state.messages,
          updatedAt: Date.now(),
          messageCount: state.messages.length,
        };

        await state.storageManager.saveSession(updatedSession);

        // 更新本地状态
        set({ currentSession: updatedSession });

        // 更新agentSessions中的会话
        if (state.currentAgent) {
          const agentSessions = state.agentSessions[state.currentAgent.id] || [];
          const updatedSessions = agentSessions.map((session: ChatSession) =>
            session.id === updatedSession.id ? updatedSession : session,
          );

          set({
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: updatedSessions,
            },
          });
        }

      } catch (error) {
        const currentSessionId = get().currentSession?.id;
        if (currentSessionId) {
          logger.error('保存当前会话失败', error as Error, { sessionId: currentSessionId });
        } else {
          logger.error('保存当前会话失败', error as Error);
        }
        set({ storageError: error instanceof Error ? error.message : '保存会话失败' });
      }
    },

    createNewSession: async () => {
      const state = get();
      if (!state.currentAgent || !state.storageManager) {
        return;
      }

      try {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: '新对话',
          agentId: state.currentAgent.id,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now(),
          messageCount: 0,
          isPinned: false,
          tags: [],
          isArchived: false,
        };

        // 保存到混合存储
        await state.storageManager.saveSession(newSession);

        // 更新本地状态
        const agentSessions = state.agentSessions[state.currentAgent.id] || [];
        set({
          agentSessions: {
            ...state.agentSessions,
            [state.currentAgent.id]: [newSession, ...agentSessions],
          },
          currentSession: newSession,
          messages: [],
        });

      } catch (error) {
        const currentAgentId = get().currentAgent?.id;
        if (currentAgentId) {
          logger.error('创建新会话失败', error as Error, { agentId: currentAgentId });
        } else {
          logger.error('创建新会话失败', error as Error);
        }
        set({ storageError: error instanceof Error ? error.message : '创建会话失败' });
      }
    },

    deleteSession: async (sessionId: string) => {
      const state = get();
      if (!state.storageManager || !state.currentAgent) {
        return;
      }

      try {
        // 从混合存储删除
        await state.storageManager.deleteSession(sessionId);

        // 更新本地状态
        const agentSessions = state.agentSessions[state.currentAgent.id] || [];
        const updatedSessions = agentSessions.filter((s: ChatSession) => s.id !== sessionId);

        const isCurrentSession = state.currentSession?.id === sessionId;
        const newCurrentSession = isCurrentSession ? updatedSessions[0] || null : state.currentSession;

        set({
          agentSessions: {
            ...state.agentSessions,
            [state.currentAgent.id]: updatedSessions,
          },
          currentSession: newCurrentSession,
          messages: newCurrentSession ? newCurrentSession.messages : [],
        });

      } catch (error) {
        logger.error('删除会话失败', error as Error, { sessionId });
        set({ storageError: error instanceof Error ? error.message : '删除会话失败' });
      }
    },

    switchToSession: async (sessionId: string) => {
      const state = get();
      if (!state.storageManager || !state.currentAgent) {
        return;
      }

      try {
        // 从混合存储获取会话
        const session = await state.storageManager.getSession(sessionId);
        if (!session) {
          logger.warn('会话不存在', { sessionId });
          return;
        }

        // 更新本地状态
        set({
          currentSession: session,
          messages: session.messages || [],
        });

        // 预加载相关会话
        state.storageManager.preloadAgentSessions(state.currentAgent.id, 3);

      } catch (error) {
        logger.error('切换会话失败', error as Error, { sessionId });
        set({ storageError: error instanceof Error ? error.message : '切换会话失败' });
      }
    },

    renameSession: async (sessionId: string, title: string) => {
      const state = get();
      if (!state.storageManager || !state.currentAgent) {
        return;
      }

      try {
        // 获取会话
        const session = await state.storageManager.getSession(sessionId);
        if (!session) {
          return;
        }

        // 更新标题
        const updatedSession = { ...session, title, updatedAt: Date.now() };
        await state.storageManager.saveSession(updatedSession);

        // 更新本地状态
        const agentSessions = state.agentSessions[state.currentAgent.id] || [];
        const updatedSessions = agentSessions.map((s: ChatSession) =>
          s.id === sessionId ? updatedSession : s,
        );

        set({
          agentSessions: {
            ...state.agentSessions,
            [state.currentAgent.id]: updatedSessions,
          },
          currentSession: state.currentSession?.id === sessionId ? updatedSession : state.currentSession,
        });

      } catch (error) {
        logger.error('重命名会话失败', error as Error, { sessionId, newTitle: title });
        set({ storageError: error instanceof Error ? error.message : '重命名会话失败' });
      }
    },

    // 消息操作（混合存储版本）
    addMessage: async (message: ChatMessage) => {
      const state = get();
      if (!state.storageManager || !state.currentSession) {
        return;
      }

      try {
        // 添加消息到存储
        await state.storageManager.addMessageToSession(state.currentSession.id, message);

        // 更新本地状态
        const updatedMessages = [...state.messages, message];
        set({ messages: updatedMessages });

        // 更新当前会话
        const updatedSession = {
          ...state.currentSession,
          messages: updatedMessages,
          updatedAt: Date.now(),
          messageCount: updatedMessages.length,
        };
        set({ currentSession: updatedSession });

      } catch (error) {
        const currentSessionId = get().currentSession?.id;
        if (currentSessionId) {
          logger.error('添加消息失败', error as Error, { sessionId: currentSessionId });
        } else {
          logger.error('添加消息失败', error as Error);
        }
        set({ storageError: error instanceof Error ? error.message : '添加消息失败' });
      }
    },

    updateLastMessage: async (content: string) => {
      const state = get();
      if (!state.storageManager || !state.currentSession || state.messages.length === 0) {
        return;
      }

      try {
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage?.id) {
          return;
        }

        // 更新存储中的消息
        await state.storageManager.updateMessageInSession(
          state.currentSession.id,
          lastMessage.id,
          (msg: ChatMessage) => ({
            ...msg,
            AI: ((msg.AI || '') + content),
          }),
        );

        // 更新本地状态
        const updatedMessages = state.messages.map((msg: ChatMessage, index: number) =>
          index === state.messages.length - 1
            ? { ...msg, AI: ((msg.AI || '') + content) }
            : msg,
        );

        set({ messages: updatedMessages });

        // 更新当前会话
        const updatedSession = {
          ...state.currentSession,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
        set({ currentSession: updatedSession });

      } catch (error) {
        const currentSessionId = get().currentSession?.id;
        if (currentSessionId) {
          logger.error('更新最后消息失败', error as Error, { sessionId: currentSessionId });
        } else {
          logger.error('更新最后消息失败', error as Error);
        }
        set({ storageError: error instanceof Error ? error.message : '更新消息失败' });
      }
    },

    clearMessages: async () => set({ messages: [] }),

    // 同步操作
    syncCurrentSession: async () => {
      const state = get();
      if (!state.storageManager || !state.currentSession) {
        return false;
      }

      try {
        set({ syncStatus: 'syncing' });
        const success = await state.storageManager.syncSession(state.currentSession.id);
        set({
          syncStatus: success ? 'idle' : 'error',
          lastSyncTime: Date.now(),
        });
        return success;
      } catch (error) {
        const currentSessionId = get().currentSession?.id;
        if (currentSessionId) {
          logger.error('同步当前会话失败', error as Error, { sessionId: currentSessionId });
        } else {
          logger.error('同步当前会话失败', error as Error);
        }
        set({ syncStatus: 'error' });
        return false;
      }
    },

    syncAgentSessions: async (agentId?: string) => {
      const state = get();
      if (!state.storageManager) {
        return false;
      }

      try {
        set({ syncStatus: 'syncing' });
        const targetAgentId = agentId || state.currentAgent?.id;
        if (!targetAgentId) {
          return false;
        }

        const success = await state.storageManager.syncAgentSessions(targetAgentId);

        // 重新加载会话
        if (success && targetAgentId === state.currentAgent?.id) {
          await state.loadAgentSessions(targetAgentId);
        }

        set({
          syncStatus: success ? 'idle' : 'error',
          lastSyncTime: Date.now(),
        });
        return success;
      } catch (error) {
        if (agentId) {
          logger.error('同步智能体会话失败', error as Error, { agentId });
        } else {
          logger.error('同步智能体会话失败', error as Error);
        }
        set({ syncStatus: 'error' });
        return false;
      }
    },

    syncAllSessions: async () => {
      const state = get();
      if (!state.storageManager) {
        return false;
      }

      try {
        set({ syncStatus: 'syncing' });
        const success = await state.storageManager.forceSyncAll();
        set({
          syncStatus: success ? 'idle' : 'error',
          lastSyncTime: Date.now(),
        });
        return success;
      } catch (error) {
        logger.error('同步所有会话失败', error as Error);
        set({ syncStatus: 'error' });
        return false;
      }
    },

    forceSyncAll: async () => {
      return get().syncAllSessions();
    },

    // 缓存操作
    preloadSessions: async (agentId: string, limit = 10) => {
      const state = get();
      if (!state.storageManager) {
        return;
      }

      try {
        await state.storageManager.preloadAgentSessions(agentId, limit);
      } catch (error) {
        logger.error('预加载会话失败', error as Error, { agentId });
      }
    },

    cleanupCache: async () => {
      const state = get();
      if (!state.storageManager) {
        return;
      }

      try {
        await state.storageManager.cleanupCache();
        await state.refreshCacheStats();
      } catch (error) {
        logger.error('清理缓存失败', error as Error);
      }
    },

    optimizeCache: async () => {
      const state = get();
      if (!state.storageManager) {
        return;
      }

      try {
        await state.storageManager.optimizeCache();
        await state.refreshCacheStats();
      } catch (error) {
        logger.error('优化缓存失败', error as Error);
      }
    },

    refreshCacheStats: async () => {
      const state = get();
      if (!state.storageManager) {
        return;
      }

      try {
        const stats = await state.storageManager.getCacheStats();
        set({ cacheStats: stats });
      } catch (error) {
        logger.error('获取缓存统计失败', error as Error);
      }
    },

    // 搜索操作
    searchSessions: async (query: SearchQuery) => {
      const state = get();
      if (!state.storageManager) {
        return [];
      }

      try {
        return await state.storageManager.searchSessions(query);
      } catch (error) {
        logger.error('搜索会话失败', error as Error, { query });
        return [];
      }
    },

    // 离线操作
    enableOfflineMode: async () => {
      const state = get();
      if (!state.storageManager) {
        return;
      }

      try {
        await state.storageManager.enableOfflineMode();
        set({ syncStatus: 'offline' });
      } catch (error) {
        logger.error('启用离线模式失败', error as Error);
      }
    },

    disableOfflineMode: async () => {
      const state = get();
      if (!state.storageManager) {
        return;
      }

      try {
        await state.storageManager.disableOfflineMode();
        set({ syncStatus: 'idle' });
      } catch (error) {
        logger.error('禁用离线模式失败', error as Error);
      }
    },

    // UI状态
    setAgentSelectorOpen: (open: boolean) => set({ agentSelectorOpen: open }),
    setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
    setIsStreaming: (streaming: boolean) => set({ isStreaming: streaming }),
    setStreamingStatus: (status: Record<string, unknown> | null) => set({ streamingStatus: status }),
    setStreamAbortController: (controller: AbortController | null) => set({ streamAbortController: controller }),
    stopStreaming: () => {
      const controller = get().streamAbortController;
      if (controller) {
        try {
          controller.abort();
        } catch (error) {
          logger.warn('停止流式传输失败', { error: error as Error | unknown });
        }
      }
      set({
        isStreaming: false,
        streamingStatus: null,
        streamAbortController: null,
      });
    },

    // 健康检查
    checkStorageHealth: async () => {
      const state = get();
      if (!state.storageManager) {
        return { overall: false };
      }

      try {
        return await state.storageManager.healthCheck();
      } catch (error) {
        logger.error('健康检查失败', error as Error);
        return { overall: false };
      }
    },
  })),
);

// 自动保存当前会话
useHybridChatStore.subscribe(
  (state: HybridChatState) => {
    // 只在消息变化且存储已初始化时自动保存
    if (
      state.isStorageInitialized &&
      state.currentSession &&
      state.messages.length > 0
    ) {
      // 延迟保存，避免频繁操作
      setTimeout(() => {
        const store = useHybridChatStore.getState();
        store.saveCurrentSession().catch(error => {
          console.error('Auto-save failed:', error);
        });
      }, 1000);
    }
  }
);

// 监听网络状态变化
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useHybridChatStore.setState({ isOnline: true });
  });

  window.addEventListener('offline', () => {
    useHybridChatStore.setState({ isOnline: false });
  });
}

export default useHybridChatStore;