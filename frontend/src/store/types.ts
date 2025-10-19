/**
 * Store 类型定义 - 统一导出所有 Store State 类型
 *
 * 用于消除 Store Selector 中的 any 类型
 * 提供类型安全的 Selector 工具类型
 */

import type { ChatMessage, StreamStatus, ReasoningStepUpdate, FastGPTEvent } from '@/types';
import type { ChatSession, AgentSessionsMap, Agent } from '@/types';

// ==================== Message Store Types ====================

/**
 * 消息 Store 状态类型
 */
export interface MessageState {
  // 消息数据
  messages: ChatMessage[];

  // 流式状态
  isStreaming: boolean;
  streamingStatus: StreamStatus | null;
  streamAbortController: AbortController | null;

  // 性能优化：消息缓冲区
  streamBuffer: string;
  flushScheduled: boolean;

  // Actions - 消息操作
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  updateMessageById: (messageId: string, updater: (message: ChatMessage) => ChatMessage) => void;
  setMessageFeedback: (messageId: string, feedback: 'good' | 'bad' | null) => void;
  removeLastInteractiveMessage: () => void;

  // Actions - 流式响应
  appendToBuffer: (content: string) => void;
  flushBuffer: () => void;
  updateLastMessage: (content: string) => void;

  // Actions - 推理和事件
  appendReasoningStep: (step: ReasoningStepUpdate) => void;
  finalizeReasoning: (totalSteps?: number) => void;
  appendAssistantEvent: (event: FastGPTEvent) => void;

  // Actions - 流式控制
  setIsStreaming: (streaming: boolean) => void;
  setStreamingStatus: (status: StreamStatus | null) => void;
  setStreamAbortController: (controller: AbortController | null) => void;
  stopStreaming: () => void;

  // 内部方法
  _scheduleFlush: () => void;

  // Zustand store methods
  getState: () => MessageState;
}

// ==================== Agent Store Types ====================

/**
 * 智能体 Store 状态类型
 */
export interface AgentState {
  // 智能体数据
  agents: Agent[];
  currentAgent: Agent | null;

  // 加载状态
  agentsLoading: boolean;
  agentsError: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;

  // 辅助方法
  getAgentById: (id: string) => Agent | undefined;
  getActiveAgents: () => Agent[];
  getAgentsByProvider: (provider: string) => Agent[];
  hasAgent: (id: string) => boolean;

  // Zustand store methods
  getState: () => AgentState;
}

// ==================== Session Store Types ====================

/**
 * 会话 Store 状态类型
 */
export interface SessionState {
  // 会话数据
  agentSessions: AgentSessionsMap;
  currentSession: ChatSession | null;

  // Actions - 会话管理
  createNewSession: (agentId: string) => ChatSession;
  deleteSession: (agentId: string, sessionId: string) => void;
  switchToSession: (agentId: string, sessionId: string) => void;
  renameSession: (agentId: string, sessionId: string, title: string) => void;
  clearCurrentAgentSessions: (agentId: string) => void;

  // Actions - 会话数据同步
  setAgentSessionsForAgent: (agentId: string, sessions: ChatSession[]) => void;
  bindSessionId: (agentId: string, oldId: string, newId: string) => void;
  setSessionMessages: (agentId: string, sessionId: string, messages: ChatMessage[]) => void;
  updateSession: (agentId: string, sessionId: string, updater: (session: ChatSession) => ChatSession) => void;
  updateSessionMessage: (agentId: string, sessionId: string, messageId: string, updater: (message: ChatMessage) => ChatMessage) => void;

  // Actions - 初始化
  initializeAgentSessions: () => void;

  // Actions - 智能标题
  updateSessionTitleIntelligently: (agentId: string, sessionId: string) => void;

  // 辅助方法
  getSessionById: (agentId: string, sessionId: string) => ChatSession | undefined;
  getAgentSessions: (agentId: string) => ChatSession[];
  getCurrentSession: () => ChatSession | null;
  getSessionCount: (agentId?: string) => number;
  getRecentSessions: (agentId: string, limit?: number) => ChatSession[];
  hasSession: (agentId: string, sessionId: string) => boolean;

  // Zustand store methods
  getState: () => SessionState;
}

// ==================== UI Store Types ====================

/**
 * UI Store 状态类型
 */
export interface UIState {
  // UI 状态
  sidebarOpen: boolean;
  agentSelectorOpen: boolean;
  theme: 'light' | 'dark' | 'auto';

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setAgentSelectorOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleAgentSelector: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;

  // Zustand store methods
  getState: () => UIState;
}

// ==================== Preference Store Types ====================

/**
 * 偏好设置 Store 状态类型
 */
export interface PreferenceState {
  preferences: {
    streamingEnabled: boolean;
    autoSaveEnabled: boolean;
    notificationsEnabled: boolean;
    language: string;
  };

  // Actions
  setPreference: <K extends keyof PreferenceState['preferences']>(
    key: K,
    value: PreferenceState['preferences'][K]
  ) => void;
  resetPreferences: () => void;

  // Zustand store methods
  getState: () => PreferenceState;
}

// ==================== Base Store Types ====================

/**
 * Store 错误类型
 */
export interface StoreError {
  code: string;
  message: string;
  details?: any;
  timestamp?: number;
}

/**
 * Store 状态类型
 */
export type StoreStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 基础 Store 状态类型
 */
export interface BaseStoreState {
  _status?: StoreStatus;
  _error?: StoreError | null;
  _lastUpdated?: number;
  _version?: string;
}

/**
 * 基础 Store Actions 类型
 */
export interface BaseStoreActions {
  _setStatus?: (status: StoreStatus) => void;
  _setError?: (error: StoreError | null) => void;
  _reset?: () => void;
}

// ==================== Store Selector 工具类型 ====================

/**
 * 通用 Store Selector 类型
 */
export type StoreSelector<TState, TResult> = (state: TState) => TResult;

/**
 * Message Store Selector 类型
 */
export type MessageSelector<TResult> = StoreSelector<MessageState, TResult>;

/**
 * Agent Store Selector 类型
 */
export type AgentSelector<TResult> = StoreSelector<AgentState, TResult>;

/**
 * Session Store Selector 类型
 */
export type SessionSelector<TResult> = StoreSelector<SessionState, TResult>;

/**
 * UI Store Selector 类型
 */
export type UISelector<TResult> = StoreSelector<UIState, TResult>;

/**
 * Preference Store Selector 类型
 */
export type PreferenceSelector<TResult> = StoreSelector<PreferenceState, TResult>;
