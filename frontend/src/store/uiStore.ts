/**
 * UI Store - 专注于界面状态
 *
 * 职责：
 * 1. 侧边栏开关
 * 2. 智能体选择器开关
 * 3. 其他UI状态
 */

import { create } from 'zustand';

interface UIState {
  // UI状态
  agentSelectorOpen: boolean;
  sidebarOpen: boolean;

  // Actions
  setAgentSelectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleAgentSelector: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // 初始状态
  agentSelectorOpen: false,
  sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,

  // 设置智能体选择器状态
  setAgentSelectorOpen: (open) => {
    set({ agentSelectorOpen: open });
  },

  // 设置侧边栏状态
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },

  // 切换智能体选择器
  toggleAgentSelector: () => {
    set((state) => ({ agentSelectorOpen: !state.agentSelectorOpen }));
  },

  // 切换侧边栏
  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },
}));

export default useUIStore;
