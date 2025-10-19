/**
 * 智能体 Store - 专注于智能体管理
 *
 * 职责：
 * 1. 智能体列表管理
 * 2. 当前智能体切换
 * 3. 加载状态和错误处理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent } from '@/types';

// 类型安全的Store辅助类型
type SetState<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;

// 状态类型定义
interface AgentState {
  // 智能体数据
  agents: Agent[];
  currentAgent: Agent | null;

  // 加载状态
  agentsLoading: boolean;
  agentsError: string | null;
}

// Action类型定义
interface AgentActions {
  // 基础Actions
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
  getState: () => AgentStore;
}

// 完整的Store类型
type AgentStore = AgentState & AgentActions;

export const useAgentStore = create<AgentStore>()(
  persist(
    (set: SetState<AgentStore>, get: GetState<AgentStore>): AgentStore => ({
      // 初始状态
      agents: [],
      currentAgent: null,
      agentsLoading: false,
      agentsError: null,

      // 设置智能体列表
      setAgents: (agents: Agent[]) => {
        set({ agents, agentsError: null });
      },

      // 切换当前智能体
      setCurrentAgent: (agent: Agent | null) => {
        set({ currentAgent: agent });
      },

      // 设置加载状态
      setAgentsLoading: (loading: boolean) => {
        set({ agentsLoading: loading });
      },

      // 设置错误信息
      setAgentsError: (error: string | null) => {
        set({ agentsError: error, agentsLoading: false });
      },

      // 根据ID获取智能体
      getAgentById: (id: string): Agent | undefined => {
        const { agents } = get();
        return agents.find((agent: Agent) => agent.id === id);
      },

      // 获取所有激活的智能体
      getActiveAgents: (): Agent[] => {
        const { agents } = get();
        return agents.filter((agent: Agent) => agent.isActive);
      },

      // 根据provider获取智能体
      getAgentsByProvider: (provider: string): Agent[] => {
        const { agents } = get();
        return agents.filter((agent: Agent) => agent.provider === provider);
      },

      // 检查智能体是否存在
      hasAgent: (id: string): boolean => {
        const { agents } = get();
        return agents.some((agent: Agent) => agent.id === id);
      },

      // Zustand store method
      getState: (): AgentStore => get(),
    }),
    {
      name: 'agent-store',
      partialize: (state: AgentStore) => ({
        currentAgent: state.currentAgent, // 持久化当前智能体
      }),
    },
  ),
);

export default useAgentStore;
