/**
 * Store 模块统一导出
 *
 * 提供所有Store的统一访问点和类型定义
 */

// ============================================================================
// Store 导出
// ============================================================================

export { default as useChatStore } from './chatStore';
export { default as useAgentStore } from './agentStore';
export { default as useAuthStore } from './authStore';
export { default as useSessionStore } from './sessionStore';
export { default as useUIStore } from './uiStore';

// ============================================================================
// 类型导出
// ============================================================================

export type { AuthUser, LoginPayload } from './authStore';

// ============================================================================
// 基础类型导出
// ============================================================================

export type {
  BaseStoreState,
  BaseStoreActions,
  StoreError,
  StoreStatus,
} from './types';

// ============================================================================
// Store组合Hook（可选）
// ============================================================================

/**
 * 组合多个Store的自定义Hook
 * 用于需要跨Store状态管理的场景
 */
import { useChatStore } from './chatStore';
import { useAgentStore } from './agentStore';
import { useAuthStore } from './authStore';
import { useSessionStore } from './sessionStore';
import { useUIStore } from './uiStore';

/**
 * 获取所有Store状态的自定义Hook
 */
export const useAllStores = () => {
  const chatStore = useChatStore();
  const agentStore = useAgentStore();
  const authStore = useAuthStore();
  const sessionStore = useSessionStore();
  const uiStore = useUIStore();

  return {
    chat: chatStore,
    agent: agentStore,
    auth: authStore,
    session: sessionStore,
    ui: uiStore,
  };
};

/**
 * 检查所有Store的初始化状态
 */
export const useStoresStatus = () => {
  const { auth } = useAllStores();

  return {
    isAuthenticated: auth.isAuthenticated(),
    isTokenExpired: auth.isTokenExpired(),
    tokenTimeUntilExpiry: auth.getTimeUntilExpiry(),
  };
};

// ============================================================================
// Store常量
// ============================================================================

/**
 * Store名称常量
 */
export const STORE_NAMES = {
  CHAT: 'llmchat-storage',
  AGENT: 'agent-store',
  SESSION: 'session-store',
} as const;

/**
 * Store版本常量
 */
export const STORE_VERSIONS = {
  CHAT: 2,
  AGENT: 1,
  SESSION: 1,
} as const;