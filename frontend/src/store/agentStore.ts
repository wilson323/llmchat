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
import { perfMonitor } from '@/utils/performanceMonitor';

interface AgentState {
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
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      // 初始状态
      agents: [],
      currentAgent: null,
      agentsLoading: false,
      agentsError: null,

      // 设置智能体列表
      setAgents: (agents) => {
        perfMonitor.measure('agentStore.setAgents', () => {
          set({ agents, agentsError: null });
        });
      },

      // 切换当前智能体
      setCurrentAgent: (agent) => {
        perfMonitor.measure('agentStore.setCurrentAgent', () => {
          set({ currentAgent: agent });
        });
      },

      // 设置加载状态
      setAgentsLoading: (loading) => {
        set({ agentsLoading: loading });
      },

      // 设置错误信息
      setAgentsError: (error) => {
        set({ agentsError: error, agentsLoading: false });
      },

      // 根据ID获取智能体
      getAgentById: (id) => {
        const { agents } = get();
        return agents.find((agent) => agent.id === id);
      },

      // 获取所有激活的智能体
      getActiveAgents: () => {
        const { agents } = get();
        return agents.filter((agent) => agent.isActive);
      },
    }),
    {
      name: 'agent-store',
      partialize: (state) => ({
        currentAgent: state.currentAgent, // 持久化当前智能体
      }),
    },
  ),
);

export default useAgentStore;
