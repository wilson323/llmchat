import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, ChatMessage, StreamStatus, ChatSession, UserPreferences, AgentSessionsMap, ReasoningStepUpdate, FastGPTEvent } from '@/types';
import { normalizeReasoningDisplay } from '@/lib/reasoning';
import { debugLog } from '@/lib/debug';
import { generateSmartTitle, updateSessionTitleIfNeeded } from '@/utils/titleGeneration';
import { logger } from '@/lib/logger';

const findLastAssistantMessageIndex = (messages: ChatMessage[]): number => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.AI !== undefined) {
      return i;
    }
  }
  return -1;
};

const mergeReasoningContent = (previous: string | undefined, incoming: string): string => {
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (incoming === previous) return previous;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.endsWith(incoming)) return previous;
  if (incoming.endsWith(previous)) return incoming;
  return `${previous}${previous.endsWith('\n') ? '' : '\n'}${incoming}`;
};

const syncMessagesWithSession = (
  state: {
    currentSession: ChatSession | null;
    currentAgent: Agent | null;
    agentSessions: AgentSessionsMap;
  },
  messages: ChatMessage[]
) => {
  if (state.currentSession && state.currentAgent) {
    const updatedAgentSessions = {
      ...state.agentSessions,
      [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map((session) =>
        session.id === state.currentSession!.id
          ? { ...session, messages, updatedAt: new Date() }
          : session
      )
    };

    return {
      messages,
      agentSessions: updatedAgentSessions,
      currentSession: {
        ...state.currentSession,
        messages,
        updatedAt: new Date(),
      }
    };
  }

  return { messages };
};

interface ChatState {
  // 智能体状态
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // 聊天状态（按 huihua.md 重构）
  agentSessions: AgentSessionsMap;     // 按智能体分组的会话字典
  currentSession: ChatSession | null;  // 当前会话
  messages: ChatMessage[];             // 当前会话的消息列表
  isStreaming: boolean;
  streamingStatus: StreamStatus | null;
  streamAbortController: AbortController | null;

  // 用户偏好
  preferences: UserPreferences;

  // UI 状态
  agentSelectorOpen: boolean;
  sidebarOpen: boolean;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  appendReasoningStep: (step: ReasoningStepUpdate) => void;
  finalizeReasoning: (totalSteps?: number) => void;
  appendAssistantEvent: (event: FastGPTEvent) => void;
  setMessageFeedback: (messageId: string, feedback: 'good' | 'bad' | null) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingStatus: (status: StreamStatus | null) => void;
  setStreamAbortController: (controller: AbortController | null) => void;
  stopStreaming: () => void;
  setAgentSelectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  createNewSession: () => void;
  deleteSession: (sessionId: string) => void;
  switchToSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  clearCurrentAgentSessions: () => void;
  initializeAgentSessions: () => void;
  setAgentSessionsForAgent: (agentId: string, sessions: ChatSession[]) => void;
  bindSessionId: (oldId: string, newId: string) => void;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  updateSession: (agentId: string, sessionId: string, updater: (session: ChatSession) => ChatSession) => void;
  updateMessageById: (messageId: string, updater: (message: ChatMessage) => ChatMessage) => void;
  removeLastInteractiveMessage: () => void;
  updateSessionTitleIntelligently: (sessionId?: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // 初始状态
      agents: [],
      currentAgent: null,
      agentsLoading: false,
      agentsError: null,
      agentSessions: {},  // 新的按智能体分组的会话字典
      messages: [],
      currentSession: null,
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      preferences: {
        theme: {
          mode: 'auto',
          isAutoMode: true,
          userPreference: 'auto',
        },
        streamingEnabled: true,
        autoThemeSchedule: {
          enabled: true,
          lightModeStart: '06:00',
          darkModeStart: '18:00',
        },
        language: 'zh-CN',
      },
      agentSelectorOpen: false,
      sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,

      // Actions
      setAgents: (agents) => set({ agents }),
      
      // 智能体切换逻辑（按 huihua.md 要求）
      setCurrentAgent: (agent) => {
        if (!agent) {
          set({ currentAgent: null, currentSession: null, messages: [] });
          return;
        }

        set((state) => {
          const existingSessions = state.agentSessions[agent.id] || [];
          const hasSessionsEntry = !!state.agentSessions[agent.id];
          const agentSessions = hasSessionsEntry
            ? state.agentSessions
            : {
                ...state.agentSessions,
                [agent.id]: [],
              };

          const latestSession = existingSessions[0] || null;

          return {
            agentSessions,
            currentAgent: agent,
            currentSession: latestSession,
            messages: latestSession ? latestSession.messages : [],
          };
        });
      },
      
      setAgentsLoading: (loading) => set({ agentsLoading: loading }),
      setAgentsError: (error) => set({ agentsError: error }),

      // 添加消息（按 huihua.md 格式）
      addMessage: (message) =>
        set((state) => {
          // 确保消息有时间戳
          const messageWithTimestamp = {
            ...message,
            timestamp: message.timestamp || Date.now()
          };
          const updatedMessages = [...state.messages, messageWithTimestamp];
          
          // 同步更新当前会话的消息
          if (state.currentSession && state.currentAgent) {
            const updatedAgentSessions = {
              ...state.agentSessions,
              [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, messages: updatedMessages, updatedAt: new Date() }
                  : session
              )
            };
            
            // 智能更新会话标题（基于NLP关键词提取，替代简单字符串截断）
            if (message.HUMAN && !state.currentSession.messages.some((m) => m.HUMAN !== undefined)) {
              // 使用智能标题生成，传入当前会话的完整消息历史
              const allMessages = [...state.currentSession.messages, messageWithTimestamp];
              const smartTitle = generateSmartTitle(allMessages, 30);

              updatedAgentSessions[state.currentAgent.id] = updatedAgentSessions[state.currentAgent.id].map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, title: smartTitle }
                  : session
              );
            }
            
            return {
              messages: updatedMessages,
              agentSessions: updatedAgentSessions,
              currentSession: {
                ...state.currentSession,
                messages: updatedMessages,
                updatedAt: new Date()
              }
            };
          }
          
          return { messages: updatedMessages };
        }),

      // 移除最后一个交互气泡（提交后隐藏交互UI）
      removeLastInteractiveMessage: () =>
        set((state) => {
          let idx = -1;
          for (let i = state.messages.length - 1; i >= 0; i -= 1) {
            const msg = state.messages[i] as any;
            if (msg && msg.interactive !== undefined) {
              idx = i;
              break;
            }
          }

          if (idx === -1) return state;

          const messages = state.messages.filter((_, i) => i !== idx);
          return syncMessagesWithSession(state, messages);
        }),

      // 更新最后一条消息（流式响应）- 修复实时更新问题
      updateLastMessage: (content) =>
        set((state) => {
          debugLog('🔄 updateLastMessage 被调用:', content.substring(0, 50));
          debugLog('📊 当前消息数量:', state.messages.length);

          const targetIndex = findLastAssistantMessageIndex(state.messages);
          if (targetIndex === -1) {
            logger.warn('未找到可更新的助手消息');
            return state;
          }

          // 创建全新的messages数组，确保引用更新
          const messages = state.messages.map((msg, index) => {
            if (index === targetIndex && msg.AI !== undefined) {
              const updatedMessage = {
                ...msg,
                AI: (msg.AI || '') + content,
                _lastUpdate: Date.now() // 添加时间戳强制更新
              } as ChatMessage;
              debugLog('📝 消息更新:', {
                beforeLength: msg.AI?.length || 0,
                afterLength: (updatedMessage.AI || '').length,
                addedContent: content.length
              });
              return updatedMessage;
            }
            return msg;
          });

          debugLog('✅ 状态更新完成，最新消息长度:', (messages[messages.length - 1]?.AI || '').length);

          return syncMessagesWithSession(state, messages);
        }),

      appendReasoningStep: (step) =>
        set((state) => {
          const targetIndex = findLastAssistantMessageIndex(state.messages);
          if (targetIndex === -1) {
            return state;
          }

          const messages = state.messages.map((msg, index) => {
            if (index !== targetIndex || msg.AI === undefined) {
              return msg;
            }

            const existingSteps = msg.reasoning?.steps ?? [];
            const highestOrder = existingSteps.reduce((max, item) => {
              if (typeof item.order === 'number' && Number.isFinite(item.order)) {
                return Math.max(max, item.order);
              }
              return max;
            }, 0);
            const normalizedOrder = typeof step.order === 'number' && Number.isFinite(step.order)
              ? step.order
              : highestOrder + 1;

            const trimmedContent = (step.content || '').trim();
            if (!trimmedContent) {
              return msg;
            }

            const normalized = normalizeReasoningDisplay(trimmedContent);
            if (!normalized.body) {
              return msg;
            }

            const nextSteps = [...existingSteps];
            const existingIndex = nextSteps.findIndex((item) => item.order === normalizedOrder);

            if (existingIndex >= 0) {
              const previousStep = nextSteps[existingIndex];
              const mergedContent = mergeReasoningContent(previousStep.content, normalized.body);
              const merged = normalizeReasoningDisplay(mergedContent);
              nextSteps[existingIndex] = {
                ...previousStep,
                content: merged.body,
                title: step.title ?? normalized.title ?? previousStep.title ?? merged.title,
                raw: step.raw ?? previousStep.raw,
              };
            } else {
              const generatedId = `${msg.id || 'reasoning'}-${normalizedOrder}-${Date.now()}`;
              nextSteps.push({
                id: generatedId,
                index: normalizedOrder,
                order: normalizedOrder,
                content: normalized.body,
                text: normalized.body,
                title: step.title ?? normalized.title ?? `步骤 ${normalizedOrder}`,
                status: 'completed',
                raw: step.raw,
              });
            }

            nextSteps.sort((a, b) => {
              const orderA = typeof a.order === 'number' && Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
              const orderB = typeof b.order === 'number' && Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
            });

            const candidateTotal = typeof step.totalSteps === 'number' && Number.isFinite(step.totalSteps)
              ? step.totalSteps
              : msg.reasoning?.totalSteps;

            const computedTotal = candidateTotal ?? (nextSteps.length > 0
              ? nextSteps.reduce((max, item) => Math.max(max, item.order), 0)
              : undefined);

            return {
              ...msg,
              reasoning: {
                steps: nextSteps,
                totalSteps: computedTotal,
                finished: step.finished ? true : msg.reasoning?.finished ?? false,
                lastUpdatedAt: Date.now(),
              },
            } as ChatMessage;
          });

          return syncMessagesWithSession(state, messages);
        }),

      appendAssistantEvent: (event) =>
        set((state) => {
          const targetIndex = findLastAssistantMessageIndex(state.messages);
          if (targetIndex === -1) {
            return state;
          }

          const messages = state.messages.map((msg, index) => {
            if (index !== targetIndex || msg.AI === undefined) {
              return msg;
            }

            const existingEvents = msg.events ?? [];

            const mergePayload = (
              prev: Record<string, unknown> | null | undefined, 
              incoming: Record<string, unknown> | null | undefined
            ): Record<string, unknown> | null | undefined => {
              if (prev && incoming && typeof prev === 'object' && typeof incoming === 'object') {
                return { ...prev, ...incoming };
              }
              return incoming ?? prev;
            };

            const mergeEvent = (prevEvent: FastGPTEvent, incomingEvent: FastGPTEvent): FastGPTEvent => ({
              ...prevEvent,
              ...incomingEvent,
              summary: incomingEvent.summary ?? prevEvent.summary,
              detail: incomingEvent.detail ?? prevEvent.detail,
              level: incomingEvent.level ?? prevEvent.level,
              payload: mergePayload(prevEvent.payload, incomingEvent.payload),
              timestamp: incomingEvent.timestamp ?? prevEvent.timestamp,
              stage: incomingEvent.stage ?? prevEvent.stage,
            });

            const groupIndex = event.groupId
              ? existingEvents.findIndex((item) => item.groupId === event.groupId)
              : -1;
            const idIndex = existingEvents.findIndex((item) => item.id === event.id);

            let nextEvents = existingEvents;

            if (groupIndex !== -1) {
              const merged = mergeEvent(existingEvents[groupIndex], event);
              nextEvents = [...existingEvents];
              nextEvents[groupIndex] = merged;
            } else if (idIndex !== -1) {
              const merged = mergeEvent(existingEvents[idIndex], event);
              nextEvents = [...existingEvents];
              nextEvents[idIndex] = merged;
            } else if (event.stage === 'update' && event.groupId) {
              nextEvents = [...existingEvents, event];
            } else {
              const isDuplicate = existingEvents.some((item) => !item.groupId && !event.groupId && item.name === event.name && item.summary === event.summary);
              if (isDuplicate) {
                nextEvents = existingEvents;
              } else {
                nextEvents = [...existingEvents, event];
              }
            }

            nextEvents = nextEvents
              .sort((a, b) => a.timestamp - b.timestamp)
              .slice(-10);

            return {
              ...msg,
              events: nextEvents,
            } as ChatMessage;
          });

          return syncMessagesWithSession(state, messages);
        }),

      finalizeReasoning: (totalSteps) =>
        set((state) => {
          const targetIndex = findLastAssistantMessageIndex(state.messages);
          if (targetIndex === -1) {
            return state;
          }

          const messages = state.messages.map((msg, index) => {
            if (index !== targetIndex || msg.AI === undefined || !msg.reasoning) {
              return msg;
            }

            const computedTotal = typeof totalSteps === 'number' && Number.isFinite(totalSteps)
              ? totalSteps
              : msg.reasoning.totalSteps ?? (msg.reasoning.steps.length > 0
                ? msg.reasoning.steps.reduce((max, item) => Math.max(max, item.order), 0)
                : undefined);

            return {
              ...msg,
              reasoning: {
                ...msg.reasoning,
                totalSteps: computedTotal,
                finished: true,
                lastUpdatedAt: Date.now(),
              },
            } as ChatMessage;
          });

          return syncMessagesWithSession(state, messages);
        }),

      // 更新指定消息的点赞/点踩持久化状态
      setMessageFeedback: (messageId, feedback) =>
        set((state) => {
          // 更新当前消息列表
          const messages = state.messages.map((msg) =>
            msg.id === messageId ? ({ ...msg, feedback } as ChatMessage) : msg
          );

          // 同步更新当前会话
          if (state.currentSession && state.currentAgent) {
            const updatedAgentSessions = {
              ...state.agentSessions,
              [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, messages, updatedAt: new Date() }
                  : session
              )
            };

            return {
              messages,
              agentSessions: updatedAgentSessions,
              currentSession: {
                ...state.currentSession,
                messages,
                updatedAt: new Date()
              }
            };
          }

          return { messages };
        }),

      clearMessages: () => set({ messages: [] }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setStreamingStatus: (status) => set({ streamingStatus: status }),
      setStreamAbortController: (controller) => set({ streamAbortController: controller }),
      stopStreaming: () => {
        const controller = get().streamAbortController;
        if (controller) {
          try {
            controller.abort();
          } catch (error) {
            logger.warn('abort streaming 失败', { error });
          }
        }
        set({
          isStreaming: false,
          streamingStatus: null,
          streamAbortController: null,
        });
      },
      setAgentSelectorOpen: (open) => set({ agentSelectorOpen: open }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),

      // 新建对话（按 huihua.md 要求）
      createNewSession: () => {
        const currentAgent = get().currentAgent;
        if (!currentAgent) return;
        
        // huihua.md 要求：新建对话时添加空messages的会话到agentId数组中
        const newSession: ChatSession = {
          id: Date.now().toString(),        // 时间戳字符串作为会话id
          title: '新对话',                   // 默认标题
          agentId: currentAgent.id,         // 关联的智能体ID
          messages: [],                     // 空的消息列表（huihua.md要求）
          createdAt: new Date(),           // 创建时间
          updatedAt: new Date(),           // 更新时间
        };
        
        set((state) => {
          const currentAgentSessions = state.agentSessions[currentAgent.id] || [];
          return {
            agentSessions: {
              ...state.agentSessions,
              [currentAgent.id]: [newSession, ...currentAgentSessions]
            },
            currentSession: newSession,
            messages: []  // 当前消息列表为空
          };
        });
      },

      // 删除会话
      deleteSession: (sessionId) =>
        set((state) => {
          if (!state.currentAgent) return state;

          const updatedSessions = state.agentSessions[state.currentAgent.id].filter(s => s.id !== sessionId);
          const newCurrentSession = state.currentSession?.id === sessionId ? null : state.currentSession;

          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: updatedSessions
            },
            currentSession: newCurrentSession,
            messages: newCurrentSession ? newCurrentSession.messages : []
          };
        }),

      // 清空当前智能体的所有会话
      clearCurrentAgentSessions: () =>
        set((state) => {
          if (!state.currentAgent) return state;
          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: []
            },
            currentSession: null,
            messages: []
          };
        }),

      // 切换会话（优化版本：支持乐观更新和预加载）
      switchToSession: (sessionId) => {
        const state = get();
        const currentAgent = state.currentAgent;

        if (!currentAgent) return;

        // 从agentSessions中获取当前智能体的会话列表
        const agentSessions = state.agentSessions[currentAgent.id] || [];
        const targetSession = agentSessions.find(s => s.id === sessionId);

        if (targetSession) {
          // 立即更新状态（乐观更新）
          set({
            currentSession: targetSession,
            messages: targetSession.messages || []  // 确保messages总是数组
          });

          // 更新最后活动时间
          const updatedAgentSessions = {
            ...state.agentSessions,
            [currentAgent.id]: agentSessions.map(session =>
              session.id === sessionId
                ? { ...session, lastAccessedAt: Date.now() }
                : session
            )
          };

          // 更新store
          set({ agentSessions: updatedAgentSessions });

          // 异步优化：预加载相邻会话
          setTimeout(() => {
            const currentIndex = agentSessions.findIndex(s => s.id === sessionId);
            const adjacentIndices = [currentIndex - 1, currentIndex + 1]
              .filter(i => i >= 0 && i < agentSessions.length);

            adjacentIndices.forEach(index => {
              const adjacentSession = agentSessions[index];
              if (adjacentSession && adjacentSession.messages.length > 0) {
                // 预加载到内存（实际项目中可能从IndexedDB加载）
                console.log('预加载会话:', adjacentSession.id);
              }
            });
          }, 100);

          // 返回成功状态
          return true;
        }

        return false;
      },

      // 重命名会话
      renameSession: (sessionId, title) =>
        set((state) => {
          if (!state.currentAgent) return state;
          
          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map(s => 
                s.id === sessionId ? { ...s, title, updatedAt: new Date() } : s
              )
            }
          };
        }),
        
      // 初始化检查（huihua.md 要求 1）
      initializeAgentSessions: () => {
        const state = get();
        const currentAgent = state.currentAgent;

        // huihua.md 要求：页面初始加载后检查localStorage中是否有当前选中智能体的id
        if (currentAgent && !state.agentSessions[currentAgent.id]) {
          // 如没有则创建一个当前智能体的id的字典
          set((state) => ({
            agentSessions: {
              ...state.agentSessions,
              [currentAgent.id]: []  // agentId:[]
            }
          }));
        }
      },

      setAgentSessionsForAgent: (agentId, sessions) =>
        set((state) => {
          const updatedAgentSessions = {
            ...state.agentSessions,
            [agentId]: sessions,
          };

          if (state.currentAgent?.id !== agentId) {
            return { agentSessions: updatedAgentSessions };
          }

          const activeSession = sessions.find((session) => state.currentSession && session.id === state.currentSession.id);
          const fallbackSession = activeSession ?? sessions[0] ?? null;

          return {
            agentSessions: updatedAgentSessions,
            currentSession: fallbackSession,
            messages: fallbackSession ? fallbackSession.messages : [],
          };
        }),

      bindSessionId: (oldId, newId) =>
        set((state) => {
          if (!state.currentAgent) return state;
          const agentId = state.currentAgent.id;
          const sessions = state.agentSessions[agentId] || [];
          const targetIndex = sessions.findIndex((session) => session.id === oldId);
          if (targetIndex === -1) return state;

          const duplicate = sessions.find((session) => session.id === newId && session.id !== oldId);
          const mergedMessages = sessions[targetIndex].messages.length
            ? sessions[targetIndex].messages
            : duplicate?.messages || [];

          const filtered = sessions.filter((session) => session.id !== newId || session.id === oldId);
          const updatedSessions = filtered.map((session) =>
            session.id === oldId
              ? { ...session, id: newId, messages: mergedMessages, updatedAt: new Date() }
              : session
          );

          const updatedAgentSessions = {
            ...state.agentSessions,
            [agentId]: updatedSessions,
          };

          const isCurrent = state.currentSession && (state.currentSession.id === oldId || state.currentSession.id === newId);
          const newCurrentSession = isCurrent
            ? {
                ...(state.currentSession as ChatSession),
                id: newId,
                messages: mergedMessages,
                updatedAt: new Date(),
              }
            : state.currentSession;

          return {
            agentSessions: updatedAgentSessions,
            currentSession: newCurrentSession,
            messages: isCurrent ? mergedMessages : state.messages,
          };
        }),

      setSessionMessages: (sessionId, messages) =>
        set((state) => {
          if (!state.currentAgent) return state;
          const agentId = state.currentAgent.id;
          const sessions = state.agentSessions[agentId] || [];
          const updatedSessions = sessions.map((session) =>
            session.id === sessionId
              ? { ...session, messages, updatedAt: new Date() }
              : session
          );

          const isCurrent = state.currentSession?.id === sessionId;
          return {
            agentSessions: {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            },
            currentSession: isCurrent
              ? { ...(state.currentSession as ChatSession), messages, updatedAt: new Date() }
              : state.currentSession,
            messages: isCurrent ? messages : state.messages,
          };
        }),

      updateSession: (agentId, sessionId, updater) =>
        set((state) => {
          const sessions = state.agentSessions[agentId] || [];
          let updatedSession: ChatSession | null = null;
          const remainingSessions: ChatSession[] = [];

          sessions.forEach((session) => {
            if (session.id === sessionId) {
              updatedSession = updater(session);
            } else {
              remainingSessions.push(session);
            }
          });

          if (!updatedSession) {
            return state;
          }

          const orderedSessions = [updatedSession, ...remainingSessions];
          const isCurrent = state.currentSession?.id === sessionId;
          const sessionMessages = (updatedSession as ChatSession).messages || [];

          return {
            agentSessions: {
              ...state.agentSessions,
              [agentId]: orderedSessions,
            },
            currentSession: isCurrent ? updatedSession : state.currentSession,
            messages: isCurrent ? sessionMessages : state.messages,
          };
        }),

      updateMessageById: (messageId, updater) =>
        set((state) => {
          const updatedMessages = state.messages.map((message) =>
            message.id === messageId ? updater(message) : message
          );

          if (!state.currentAgent || !state.currentSession) {
            return { messages: updatedMessages };
          }

          const agentId = state.currentAgent.id;
          const updatedSessions = state.agentSessions[agentId].map((session) =>
            session.id === state.currentSession!.id
              ? { ...session, messages: updatedMessages, updatedAt: new Date() }
              : session
          );

          return {
            messages: updatedMessages,
            currentSession: {
              ...state.currentSession,
              messages: updatedMessages,
              updatedAt: new Date(),
            },
            agentSessions: {
              ...state.agentSessions,
              [agentId]: updatedSessions,
            },
          };
        }),

      // 智能标题更新函数
      updateSessionTitleIntelligently: (sessionId) =>
        set((state) => {
          const targetSessionId = sessionId || state.currentSession?.id;
          if (!targetSessionId || !state.currentAgent) return state;

          const agentSessions = state.agentSessions[state.currentAgent.id] || [];
          const targetSession = agentSessions.find(s => s.id === targetSessionId);

          if (!targetSession || targetSession.messages.length === 0) return state;

          // 使用智能标题更新检查
          const titleUpdateResult = updateSessionTitleIfNeeded(
            targetSession.messages,
            targetSession.title,
            30
          );

          if (titleUpdateResult.shouldUpdate) {
            const updatedSessions = agentSessions.map(session =>
              session.id === targetSessionId
                ? { ...session, title: titleUpdateResult.newTitle, updatedAt: new Date() }
                : session
            );

            return {
              agentSessions: {
                ...state.agentSessions,
                [state.currentAgent.id]: updatedSessions
              },
              currentSession: state.currentSession?.id === targetSessionId
                ? { ...state.currentSession, title: titleUpdateResult.newTitle, updatedAt: new Date() }
                : state.currentSession
            };
          }

          return state;
        }),
    }),
    {
      name: 'llmchat-storage',
      // 完全重构，不保留旧数据
      partialize: (state) => ({
        currentAgent: state.currentAgent,
        preferences: state.preferences,
        agentSessions: state.agentSessions,  // 保存新的数据结构
        currentSession: state.currentSession,
      }),
      version: 2,  // 新版本，不兼容旧数据
      onRehydrateStorage: () => (state) => {
        // huihua.md 要求：数据恢复后执行初始化检查
        if (state) {
          setTimeout(() => {
            state.initializeAgentSessions();
          }, 0);
        }
      }
    }
  )
);

/**
 * 获取当前智能体的会话列表（huihua.md 要求：只显示当前智能体的会话）
 */
export const getCurrentAgentSessions = (): ChatSession[] => {
  const { agentSessions, currentAgent } = useChatStore.getState();
  return currentAgent ? (agentSessions[currentAgent.id] || []) : [];
};
