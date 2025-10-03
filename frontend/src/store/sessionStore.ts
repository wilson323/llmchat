/**
 * 会话 Store - 专注于会话管理
 * 
 * 职责：
 * 1. 按智能体分组的会话字典管理
 * 2. 当前会话切换
 * 3. 会话CRUD操作
 * 4. 智能标题生成
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSession, AgentSessionsMap, ChatMessage } from '@/types';
import { generateSmartTitle, updateSessionTitleIfNeeded } from '@/utils/titleGeneration';
import { perfMonitor } from '@/utils/performanceMonitor';
import { debugLog } from '@/lib/debug';

interface SessionState {
  // 会话数据
  agentSessions: AgentSessionsMap;  // 按智能体分组的会话字典
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
  
  // Actions - 初始化
  initializeAgentSessions: () => void;
  
  // Actions - 智能标题
  updateSessionTitleIntelligently: (agentId: string, sessionId: string) => void;
  
  // 辅助方法
  getSessionById: (agentId: string, sessionId: string) => ChatSession | undefined;
  getAgentSessions: (agentId: string) => ChatSession[];
  getCurrentSession: () => ChatSession | null;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // 初始状态
      agentSessions: {},
      currentSession: null,

      // 创建新会话
      createNewSession: (agentId) => {
        return perfMonitor.measure('sessionStore.createNewSession', () => {
          const newSession: ChatSession = {
            id: `session_${Date.now()}`,
            title: '新对话',
            agentId,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          set((state) => {
            const existingSessions = state.agentSessions[agentId] || [];
            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: [newSession, ...existingSessions],
            };

            debugLog('📝 创建新会话:', newSession.id);

            return {
              agentSessions: updatedAgentSessions,
              currentSession: newSession,
            };
          });

          return newSession;
        });
      },

      // 删除会话
      deleteSession: (agentId, sessionId) => {
        perfMonitor.measure('sessionStore.deleteSession', () => {
          set((state) => {
            const existingSessions = state.agentSessions[agentId] || [];
            const updatedSessions = existingSessions.filter((s) => s.id !== sessionId);
            
            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            };

            // 如果删除的是当前会话，切换到第一个会话
            const newCurrentSession =
              state.currentSession?.id === sessionId
                ? (updatedSessions[0] || null)
                : state.currentSession;

            debugLog('🗑️ 删除会话:', sessionId);

            return {
              agentSessions: updatedAgentSessions,
              currentSession: newCurrentSession,
            };
          });
        });
      },

      // 切换到指定会话
      switchToSession: (agentId, sessionId) => {
        perfMonitor.measure('sessionStore.switchToSession', () => {
          const session = get().getSessionById(agentId, sessionId);
          if (session) {
            set({ currentSession: session });
            debugLog('🔄 切换会话:', sessionId);
          } else {
            console.warn('⚠️ 会话不存在:', sessionId);
          }
        });
      },

      // 重命名会话
      renameSession: (agentId, sessionId, title) => {
        perfMonitor.measure('sessionStore.renameSession', () => {
          set((state) => {
            const existingSessions = state.agentSessions[agentId] || [];
            const updatedSessions = existingSessions.map((session) =>
              session.id === sessionId
                ? { ...session, title, updatedAt: new Date() }
                : session
            );

            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            };

            // 同步更新当前会话
            const updatedCurrentSession =
              state.currentSession?.id === sessionId
                ? { ...state.currentSession, title, updatedAt: new Date() }
                : state.currentSession;

            debugLog('✏️ 重命名会话:', { sessionId, title });

            return {
              agentSessions: updatedAgentSessions,
              currentSession: updatedCurrentSession,
            };
          });
        });
      },

      // 清除指定智能体的所有会话
      clearCurrentAgentSessions: (agentId) => {
        set((state) => {
          const updatedAgentSessions = {
            ...state.agentSessions,
            [agentId]: [],
          };

          // 如果当前会话属于该智能体，清除当前会话
          const updatedCurrentSession =
            state.currentSession?.agentId === agentId ? null : state.currentSession;

          debugLog('🧹 清除智能体会话:', agentId);

          return {
            agentSessions: updatedAgentSessions,
            currentSession: updatedCurrentSession,
          };
        });
      },

      // 设置指定智能体的会话列表
      setAgentSessionsForAgent: (agentId, sessions) => {
        perfMonitor.measure('sessionStore.setAgentSessionsForAgent', () => {
          set((state) => ({
            agentSessions: {
              ...state.agentSessions,
              [agentId]: sessions,
            },
          }));
        });
      },

      // 绑定会话ID（将临时ID替换为服务器返回的ID）
      bindSessionId: (agentId, oldId, newId) => {
        perfMonitor.measure('sessionStore.bindSessionId', () => {
          set((state) => {
            const existingSessions = state.agentSessions[agentId] || [];
            const updatedSessions = existingSessions.map((session) =>
              session.id === oldId
                ? { ...session, id: newId, updatedAt: new Date() }
                : session
            );

            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            };

            // 同步更新当前会话
            const updatedCurrentSession =
              state.currentSession?.id === oldId
                ? { ...state.currentSession, id: newId, updatedAt: new Date() }
                : state.currentSession;

            debugLog('🔗 绑定会话ID:', { oldId, newId });

            return {
              agentSessions: updatedAgentSessions,
              currentSession: updatedCurrentSession,
            };
          });
        });
      },

      // 设置会话的消息列表
      setSessionMessages: (agentId, sessionId, messages) => {
        perfMonitor.measure('sessionStore.setSessionMessages', () => {
          set((state) => {
            const existingSessions = state.agentSessions[agentId] || [];
            const updatedSessions = existingSessions.map((session) =>
              session.id === sessionId
                ? { ...session, messages, updatedAt: new Date() }
                : session
            );

            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            };

            // 同步更新当前会话
            const updatedCurrentSession =
              state.currentSession?.id === sessionId
                ? { ...state.currentSession, messages, updatedAt: new Date() }
                : state.currentSession;

            return {
              agentSessions: updatedAgentSessions,
              currentSession: updatedCurrentSession,
            };
          });
        });
      },

      // 更新指定会话
      updateSession: (agentId, sessionId, updater) => {
        perfMonitor.measure('sessionStore.updateSession', () => {
          set((state) => {
            const existingSessions = state.agentSessions[agentId] || [];
            const updatedSessions = existingSessions.map((session) =>
              session.id === sessionId ? updater(session) : session
            );

            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            };

            // 同步更新当前会话
            const updatedCurrentSession =
              state.currentSession?.id === sessionId
                ? updater(state.currentSession)
                : state.currentSession;

            return {
              agentSessions: updatedAgentSessions,
              currentSession: updatedCurrentSession,
            };
          });
        });
      },

      // 初始化会话字典（确保每个智能体都有空数组）
      initializeAgentSessions: () => {
        set((state) => {
          // 如果已经初始化过，不做任何操作
          if (Object.keys(state.agentSessions).length > 0) {
            return state;
          }

          debugLog('🔧 初始化会话字典');
          return { agentSessions: {} };
        });
      },

      // 智能更新会话标题
      updateSessionTitleIntelligently: (agentId, sessionId) => {
        perfMonitor.measure('sessionStore.updateSessionTitleIntelligently', () => {
          const session = get().getSessionById(agentId, sessionId);
          if (!session) {
            return;
          }

          const newTitle = updateSessionTitleIfNeeded(
            session.title,
            session.messages,
            session.createdAt
          );

          if (newTitle && newTitle !== session.title) {
            get().renameSession(agentId, sessionId, newTitle);
          }
        });
      },

      // 辅助方法：根据ID获取会话
      getSessionById: (agentId, sessionId) => {
        const { agentSessions } = get();
        const sessions = agentSessions[agentId] || [];
        return sessions.find((s) => s.id === sessionId);
      },

      // 辅助方法：获取指定智能体的所有会话
      getAgentSessions: (agentId) => {
        const { agentSessions } = get();
        return agentSessions[agentId] || [];
      },

      // 辅助方法：获取当前会话
      getCurrentSession: () => {
        return get().currentSession;
      },
    }),
    {
      name: 'session-store',
      partialize: (state) => ({
        agentSessions: state.agentSessions,
        currentSession: state.currentSession,
      }),
    }
  )
);

export default useSessionStore;

