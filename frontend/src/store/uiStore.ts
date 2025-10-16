/**
 * UI Store - 专注于界面状态
 *
 * 职责：
 * 1. 侧边栏开关
 * 2. 智能体选择器开关
 * 3. 其他UI状态
 */

import { create } from 'zustand';

// 类型安全的Store辅助类型
type SetState<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;

// 状态类型定义
interface UIState {
  // UI状态
  agentSelectorOpen: boolean;
  sidebarOpen: boolean;

  // 扩展UI状态
  themePanelOpen?: boolean;
  settingsOpen?: boolean;
  isFullscreen?: boolean;
  loading?: boolean;
}

// Action类型定义
interface UIActions {
  // 基础Actions
  setAgentSelectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleAgentSelector: () => void;
  toggleSidebar: () => void;

  // 扩展Actions
  setThemePanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  setLoading: (loading: boolean) => void;

  // 组合Actions
  resetUI: () => void;
  toggleTheme: () => void;

  // Store方法
  getState: () => UIStore;
}

// 完整的Store类型
type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set: SetState<UIStore>, get: GetState<UIStore>): UIStore => ({
  // 初始状态
  agentSelectorOpen: false,
  sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
  themePanelOpen: false,
  settingsOpen: false,
  isFullscreen: false,
  loading: false,

  // 设置智能体选择器状态
  setAgentSelectorOpen: (open: boolean): void => {
    set({ agentSelectorOpen: open });
  },

  // 设置侧边栏状态
  setSidebarOpen: (open: boolean): void => {
    set({ sidebarOpen: open });
  },

  // 切换智能体选择器
  toggleAgentSelector: (): void => {
    set((state) => ({ agentSelectorOpen: !state.agentSelectorOpen }));
  },

  // 切换侧边栏
  toggleSidebar: (): void => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  // 扩展Actions
  setThemePanelOpen: (open: boolean): void => {
    set({ themePanelOpen: open });
  },

  setSettingsOpen: (open: boolean): void => {
    set({ settingsOpen: open });
  },

  setFullscreen: (isFullscreen: boolean): void => {
    set({ isFullscreen });
  },

  setLoading: (loading: boolean): void => {
    set({ loading });
  },

  // 组合Actions
  resetUI: (): void => {
    set({
      agentSelectorOpen: false,
      sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
      themePanelOpen: false,
      settingsOpen: false,
      isFullscreen: false,
      loading: false,
    });
  },

  toggleTheme: (): void => {
    set((state) => ({ themePanelOpen: !state.themePanelOpen }));
  },

  getState: (): UIStore => get(),
}));

export default useUIStore;
