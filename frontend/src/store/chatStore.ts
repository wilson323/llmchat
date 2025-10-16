import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, ChatMessage, StreamStatus, ChatSession, UserPreferences, AgentSessionsMap, ReasoningStepUpdate, ReasoningStep, FastGPTEvent, JsonValue } from '@/types';
import { normalizeReasoningDisplay } from '@/lib/reasoning';
import { debugLog } from '@/lib/debug';
import { generateSmartTitle, updateSessionTitleIfNeeded } from '@/utils/titleGeneration';
import { logger } from '@/lib/logger';

// 类型安全的Store辅助类型
type SetState<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;

// 消息更新函数类型
type MessageUpdater = (message: ChatMessage) => ChatMessage;
type SessionUpdater = (session: ChatSession) => ChatSession;

// Store Action类型定义
interface ChatActions {
  // 智能体Actions
  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;

  // 消息Actions
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  appendReasoningStep: (step: ReasoningStepUpdate) => void;
  finalizeReasoning: (totalSteps?: number) => void;
  appendAssistantEvent: (event: FastGPTEvent) => void;
  setMessageFeedback: (messageId: string, feedback: 'good' | 'bad' | null) => void;
  clearMessages: () => void;
  updateMessageById: (messageId: string, updater: MessageUpdater) => void;
  removeLastInteractiveMessage: () => void;

  // 流式Actions
  setIsStreaming: (streaming: boolean) => void;
  setStreamingStatus: (status: StreamStatus | null) => void;
  setStreamAbortController: (controller: AbortController | null) => void;
  stopStreaming: () => void;

  // UI Actions
  setAgentSelectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;

  // 偏好设置Actions
  updatePreferences: (preferences: Partial<UserPreferences>) => void;

  // 会话Actions
  createNewSession: () => void;
  deleteSession: (sessionId: string) => void;
  switchToSession: (sessionId: string) => boolean | void;
  renameSession: (sessionId: string, title: string) => void;
  clearCurrentAgentSessions: () => void;
  initializeAgentSessions: () => void;
  setAgentSessionsForAgent: (agentId: string, sessions: ChatSession[]) => void;
  bindSessionId: (oldId: string, newId: string) => void;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  updateSession: (agentId: string, sessionId: string, updater: SessionUpdater) => void;
  updateSessionTitleIntelligently: (sessionId?: string) => void;

  // Store方法
  getState: () => ChatState;
}

const findLastAssistantMessageIndex = (messages: ChatMessage[]): number => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.AI !== undefined) {
      return i;
    }
  }
  return -1;
};

const mergeReasoningContent = (previous: string | undefined, incoming: string): string => {
  if (!previous) {
    return incoming;
  }
  if (!incoming) {
    return previous;
  }
  if (incoming === previous) {
    return previous;
  }
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  if (previous.endsWith(incoming)) {
    return previous;
  }
  if (incoming.endsWith(previous)) {
    return incoming;
  }
  return `${previous}${previous.endsWith('\n') ? '' : '\n'}${incoming}`;
};

const syncMessagesWithSession = (
  state: {
    currentSession: ChatSession | null;
    currentAgent: Agent | null;
    agentSessions: AgentSessionsMap;
  },
  messages: ChatMessage[],
) => {
  if (state.currentSession && state.currentAgent) {
    const agentId = state.currentAgent.id;
    const currentSessions = state.agentSessions[agentId] ?? [];
    const updatedAgentSessions = {
      ...state.agentSessions,
      [agentId]: currentSessions.map((session) =>
        session.id === state.currentSession!.id
          ? { ...session, messages, updatedAt: new Date() }
          : session,
      ),
    };

    return {
      messages,
      agentSessions: updatedAgentSessions,
      currentSession: {
        ...state.currentSession,
        messages,
        updatedAt: new Date(),
      },
    };
  }

  return { messages };
};

// 状态类型定义
interface ChatState {
  // 智能体状态
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // UI状态
  sidebarOpen: boolean;
  agentSelectorOpen: boolean;

  // 聊天状态（按 huihua.md 重构）
  agentSessions: AgentSessionsMap;     // 按智能体分组的会话字典
  currentSession: ChatSession | null;  // 当前会话
  messages: ChatMessage[];             // 当前会话的消息列表
  isStreaming: boolean;
  streamingStatus: StreamStatus | null;
  streamAbortController: AbortController | null;

  // 用户偏好
  preferences: UserPreferences;
}

// 完整的Store类型（状态 + Actions）
type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  persist(
    (set: SetState<ChatStore>, get: GetState<ChatStore>): ChatStore => ({
      // 初始状态
      agents: [],
      currentAgent: null,
      agentsLoading: false,
      agentsError: null,
      sidebarOpen: true,
      agentSelectorOpen: false,
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

      // Actions
      setAgents: (agents: Agent[]) => set({ agents }),

      // 智能体切换逻辑（按 huihua.md 要求）
      setCurrentAgent: (agent: Agent | null) => {
        if (!agent) {
          set({ currentAgent: null, currentSession: null, messages: [] });
          return;
        }

        set((state: ChatState) => {
          const existingSessions = state.agentSessions[agent.id] ?? [];
          const latestSession = existingSessions[0] || null;

          return {
            agentSessions: {
              ...state.agentSessions,
              [agent.id]: existingSessions,
            },
            currentAgent: agent,
            currentSession: latestSession,
            messages: latestSession ? latestSession.messages : [],
          };
        });
      },

      setAgentsLoading: (loading: boolean) => set({ agentsLoading: loading }),
      setAgentsError: (error: string | null) => set({ agentsError: error }),

      // 添加消息（按 huihua.md 格式）
      addMessage: (message: ChatMessage) =>
        set((state: ChatState) => {
          // 确保消息有时间戳
          const messageWithTimestamp = {
            ...message,
            timestamp: message.timestamp || Date.now(),
          };
          const updatedMessages = [...state.messages, messageWithTimestamp];

          // 同步更新当前会话的消息
          if (state.currentSession && state.currentAgent) {
            const agentId = state.currentAgent.id;
            const currentSessions = state.agentSessions[agentId] ?? [];
            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: currentSessions.map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, messages: updatedMessages, updatedAt: new Date() }
                  : session,
              ),
            };

            // 智能更新会话标题（基于NLP关键词提取，替代简单字符串截断）
            if (message.HUMAN && !state.currentSession.messages.some((m) => m.HUMAN !== undefined)) {
              // 使用智能标题生成，传入当前会话的完整消息历史
              const allMessages = [...(state.currentSession.messages ?? []), messageWithTimestamp];
              const smartTitle = generateSmartTitle(allMessages, 30);

              updatedAgentSessions[agentId] = (updatedAgentSessions[agentId] ?? []).map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, title: smartTitle }
                  : session,
              );
            }

            return {
              messages: updatedMessages,
              agentSessions: updatedAgentSessions,
              currentSession: {
                ...state.currentSession,
                messages: updatedMessages,
                updatedAt: new Date(),
              },
            };
          }

          return { messages: updatedMessages };
        }),

      // 移除最后一个交互气泡（提交后隐藏交互UI）
      removeLastInteractiveMessage: () =>
        set((state: ChatState) => {
          let idx = -1;
          for (let i = state.messages.length - 1; i >= 0; i -= 1) {
            const msg = state.messages[i] as ChatMessage & { interactive?: unknown };
            if (msg && msg.interactive !== undefined) {
              idx = i;
              break;
            }
          }

          if (idx === -1) {
            return state;
          }

          const messages = state.messages.filter((_, i) => i !== idx);
          return syncMessagesWithSession(state, messages);
        }),

      // 更新最后一条消息（流式响应）- 修复实时更新问题
      updateLastMessage: (content: string) =>
        set((state: ChatState) => {
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
                _lastUpdate: Date.now(), // 添加时间戳强制更新
              } as ChatMessage;
              debugLog('📝 消息更新:', {
                beforeLength: msg.AI?.length || 0,
                afterLength: (updatedMessage.AI || '').length,
                addedContent: content.length,
              });
              return updatedMessage;
            }
            return msg;
          });

          debugLog('✅ 状态更新完成，最新消息长度:', (messages[messages.length - 1]?.AI || '').length);

          return syncMessagesWithSession(state, messages);
        }),

      appendReasoningStep: (step: ReasoningStepUpdate) =>
        set((state: ChatState) => {
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
              const mergedContent = mergeReasoningContent(previousStep?.content, normalized.body);
              const merged = normalizeReasoningDisplay(mergedContent);
              nextSteps[existingIndex] = {
                id: previousStep?.id ?? `reasoning-${normalizedOrder}-${Date.now()}`,
                index: normalizedOrder,
                order: normalizedOrder,
                content: merged.body,
                // 使用条件属性展开满足 exactOptionalPropertyTypes
                ...(step.title || normalized.title || previousStep?.title ? {
                  title: step.title ?? normalized.title ?? previousStep?.title ?? merged.title
                } : {}),
                text: merged.body,
                status: previousStep?.status ?? 'completed' as const,
                ...(step.raw !== undefined || previousStep?.raw !== undefined ? {
                  raw: step.raw ?? previousStep?.raw ?? null
                } : {}),
              };
            } else {
              const generatedId = `${msg.id || 'reasoning'}-${normalizedOrder}-${Date.now()}`;
              const newStep: ReasoningStep = {
                id: generatedId,
                index: normalizedOrder,
                order: normalizedOrder,
                content: normalized.body,
                text: normalized.body,
                status: 'completed',
                // 使用条件属性展开来满足 exactOptionalPropertyTypes
                ...(step.title || normalized.title ? {
                  title: step.title ?? normalized.title ?? `步骤 ${normalizedOrder}`
                } : {}),
                ...(step.raw ? { raw: step.raw } : {}),
              };

              nextSteps.push(newStep);
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
              ? nextSteps.reduce((max, item) => typeof item.order === 'number' && Number.isFinite(item.order) ? Math.max(max, item.order) : max, 0)
              : undefined);

            return {
              ...msg,
              reasoning: {
                steps: nextSteps,
                totalSteps: computedTotal,
                finished: msg.reasoning?.finished ?? false,
                lastUpdatedAt: Date.now(),
              },
            } as ChatMessage;
          });

          return syncMessagesWithSession(state, messages);
        }),

      appendAssistantEvent: (event: FastGPTEvent) =>
        set((state: ChatState) => {
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
              prev: JsonValue | undefined,
              incoming: JsonValue | undefined,
            ): JsonValue => {
              if (prev && incoming && typeof prev === 'object' && typeof incoming === 'object') {
                return { ...prev, ...incoming } as JsonValue;
              }
              return (incoming ?? prev) ?? null;
            };

            const mergeEvent = (prevEvent: FastGPTEvent, incomingEvent: FastGPTEvent): FastGPTEvent => {
              const baseEvent = {
                ...prevEvent,
                ...incomingEvent,
                level: incomingEvent.level ?? prevEvent.level,
                payload: mergePayload(prevEvent.payload, incomingEvent.payload),
                timestamp: incomingEvent.timestamp ?? prevEvent.timestamp,
              };

              // 使用条件属性展开来满足 exactOptionalPropertyTypes
              const merged: FastGPTEvent = {
                ...baseEvent,
                ...(incomingEvent.summary !== undefined ? { summary: incomingEvent.summary } : {}),
                ...(prevEvent.summary !== undefined && incomingEvent.summary === undefined ? { summary: prevEvent.summary } : {}),
                ...(incomingEvent.raw !== undefined ? { raw: incomingEvent.raw } : {}),
                ...(prevEvent.raw !== undefined && incomingEvent.raw === undefined ? { raw: prevEvent.raw } : {}),
              };

              return merged;
            };

            // 由于FastGPTEvent没有id和groupId字段，我们使用其他方式来匹配事件
            // 这里简化为总是添加新事件
            const groupIndex = -1;
            const idIndex = -1;

            let nextEvents = existingEvents;

            if (groupIndex !== -1) {
              const existingEvent = existingEvents[groupIndex];
              if (existingEvent) {
                const merged = mergeEvent(existingEvent, event);
                nextEvents = [...existingEvents];
                nextEvents[groupIndex] = merged;
              }
            } else if (idIndex !== -1) {
              const existingEvent = existingEvents[idIndex];
              if (existingEvent) {
                const merged = mergeEvent(existingEvent, event);
                nextEvents = [...existingEvents];
                nextEvents[idIndex] = merged;
              }
            } else {
              // 简化事件添加逻辑，总是添加新事件
              nextEvents = [...existingEvents, event];
            }

            nextEvents = nextEvents
              .sort((a, b) => {
                const aTime = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp ? Number(a.timestamp) : 0;
                const bTime = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp ? Number(b.timestamp) : 0;
                return aTime - bTime;
              })
              .slice(-10);

            return {
              ...msg,
              events: nextEvents,
            } as ChatMessage;
          });

          return syncMessagesWithSession(state, messages);
        }),

      finalizeReasoning: (totalSteps?: number) =>
        set((state: ChatState) => {
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
      setMessageFeedback: (messageId: string, feedback: 'good' | 'bad' | null) =>
        set((state: ChatState) => {
          // 更新当前消息列表
          const messages = state.messages.map((msg) =>
            msg.id === messageId ? ({ ...msg, feedback } as ChatMessage) : msg,
          );

          // 同步更新当前会话
          if (state.currentSession && state.currentAgent) {
            const agentId = state.currentAgent.id;
            const currentSessions = state.agentSessions[agentId] ?? [];
            const updatedAgentSessions = {
              ...state.agentSessions,
              [agentId]: currentSessions.map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, messages, updatedAt: new Date() }
                  : session,
              ),
            };

            return {
              messages,
              agentSessions: updatedAgentSessions,
              currentSession: {
                ...state.currentSession,
                messages,
                updatedAt: new Date(),
              },
            };
          }

          return { messages };
        }),

      clearMessages: () => set({ messages: [] }),
      setIsStreaming: (streaming: boolean) => set({ isStreaming: streaming }),
      setStreamingStatus: (status: StreamStatus | null) => set({ streamingStatus: status }),
      setStreamAbortController: (controller: AbortController | null) => set({ streamAbortController: controller }),
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setAgentSelectorOpen: (open: boolean) => set({ agentSelectorOpen: open }),
      stopStreaming: () => {
        const controller = get().streamAbortController;
        if (controller) {
          try {
            controller.abort();
          } catch (error) {
            logger.warn('abort streaming 失败', { error: error as Error });
          }
        }
        set({
          isStreaming: false,
          streamingStatus: null,
          streamAbortController: null,
        });
      },

      updatePreferences: (newPreferences: Partial<UserPreferences>) =>
        set((state: ChatState) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),

      // 新建对话（按 huihua.md 要求）
      createNewSession: () => {
        const currentAgent = get().currentAgent;
        if (!currentAgent) {
          return;
        }

        // huihua.md 要求：新建对话时添加空messages的会话到agentId数组中
        const newSession: ChatSession = {
          id: Date.now().toString(),        // 时间戳字符串作为会话id
          title: '新对话',                   // 默认标题
          agentId: currentAgent.id,         // 关联的智能体ID
          messages: [],                     // 空的消息列表（huihua.md要求）
          createdAt: new Date(),           // 创建时间
          updatedAt: new Date(),           // 更新时间
        };

        set((state: ChatState) => {
          const currentAgentSessions = state.agentSessions[currentAgent.id] ?? [];
          return {
            agentSessions: {
              ...state.agentSessions,
              [currentAgent.id]: [newSession, ...currentAgentSessions],
            },
            currentSession: newSession,
            messages: [],  // 当前消息列表为空
          };
        });
      },

      // 删除会话
      deleteSession: (sessionId: string) =>
        set((state: ChatState) => {
          if (!state.currentAgent) {
            return state;
          }

          const updatedSessions = (state.agentSessions[state.currentAgent.id] ?? []).filter(s => s.id !== sessionId);
          const newCurrentSession = state.currentSession?.id === sessionId ? null : state.currentSession;

          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: updatedSessions,
            },
            currentSession: newCurrentSession,
            messages: newCurrentSession ? newCurrentSession.messages : [],
          };
        }),

      // 清空当前智能体的所有会话
      clearCurrentAgentSessions: () =>
        set((state: ChatState) => {
          if (!state.currentAgent) {
            return state;
          }
          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: [],
            },
            currentSession: null,
            messages: [],
          };
        }),

      // 切换会话（优化版本：支持乐观更新和预加载）
      switchToSession: (sessionId: string): boolean => {
        const state = get();
        const currentAgent = state.currentAgent;

        if (!currentAgent) {
          return false;
        }

        // 从agentSessions中获取当前智能体的会话列表
        const agentSessions = state.agentSessions[currentAgent.id] ?? [];
        const targetSession = agentSessions.find((s: ChatSession) => s.id === sessionId);

        if (targetSession) {
          // 立即更新状态（乐观更新）
          set({
            currentSession: targetSession,
            messages: targetSession.messages || [],  // 确保messages总是数组
          });

          // 更新最后活动时间
          const updatedAgentSessions = {
            ...state.agentSessions,
            [currentAgent.id]: agentSessions.map((session: ChatSession) =>
              session.id === sessionId
                ? { ...session, lastAccessedAt: Date.now() }
                : session,
            ),
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
      renameSession: (sessionId: string, title: string): void => {
        const state = get();
        if (!state.currentAgent) {
          return;
        }

        const agentId = state.currentAgent.id;
        const currentSessions = state.agentSessions[agentId] ?? [];

        set({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: currentSessions.map(s =>
              s.id === sessionId ? { ...s, title, updatedAt: new Date() } : s,
            ),
          },
        });

        // 如果是当前会话，同时更新当前会话标题
        if (state.currentSession?.id === sessionId) {
          set({
            currentSession: { ...state.currentSession, title, updatedAt: new Date() }
          });
        }
      },

      // 初始化检查（huihua.md 要求 1）
      initializeAgentSessions: () => {
        const state = get();
        const currentAgent = state.currentAgent;

        // huihua.md 要求：页面初始加载后检查localStorage中是否有当前选中智能体的id
        if (currentAgent && !state.agentSessions[currentAgent.id]) {
          // 如没有则创建一个当前智能体的id的字典
          set((state: ChatState) => ({
            agentSessions: {
              ...state.agentSessions,
              [currentAgent.id]: [],  // agentId:[]
            },
          }));
        }
      },

      setAgentSessionsForAgent: (agentId: string, sessions: ChatSession[]) =>
        set((state: ChatState) => {
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

      bindSessionId: (oldId: string, newId: string) =>
        set((state: ChatState) => {
          if (!state.currentAgent) {
            return state;
          }
          const agentId = state.currentAgent.id;
          const sessions = state.agentSessions[agentId] ?? [];
          const targetIndex = sessions.findIndex((session) => session.id === oldId);
          if (targetIndex === -1) {
            return state;
          }

          const duplicate = sessions.find((session) => session.id === newId && session.id !== oldId);
          const targetSession = sessions[targetIndex];
          const mergedMessages = targetSession?.messages.length
            ? targetSession?.messages || []
            : duplicate?.messages || [];

          const filtered = sessions.filter((session) => session.id !== newId || session.id === oldId);
          const updatedSessions = filtered.map((session) =>
            session.id === oldId
              ? { ...session, id: newId, messages: mergedMessages, updatedAt: new Date() }
              : session,
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

      setSessionMessages: (sessionId: string, messages: ChatMessage[]) =>
        set((state: ChatState) => {
          if (!state.currentAgent) {
            return state;
          }
          const agentId = state.currentAgent.id;
          const sessions = state.agentSessions[agentId] ?? [];
          const updatedSessions = sessions.map((session) =>
            session.id === sessionId
              ? { ...session, messages, updatedAt: new Date() }
              : session,
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

      updateSession: (agentId: string, sessionId: string, updater: (session: ChatSession) => ChatSession) =>
        set((state: ChatState) => {
          const sessions = state.agentSessions[agentId] ?? [];
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

      updateMessageById: (messageId: string, updater: (message: ChatMessage) => ChatMessage) =>
        set((state: ChatState) => {
          const updatedMessages = state.messages.map((message) =>
            message.id === messageId ? updater(message) : message,
          );

          if (!state.currentAgent || !state.currentSession) {
            return { messages: updatedMessages };
          }

          const agentId = state.currentAgent.id;
          const updatedSessions = (state.agentSessions[agentId] ?? []).map((session) =>
            session.id === state.currentSession!.id
              ? { ...session, messages: updatedMessages, updatedAt: new Date() }
              : session,
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
      updateSessionTitleIntelligently: (sessionId?: string) =>
        set((state: ChatState) => {
          const targetSessionId = sessionId || state.currentSession?.id;
          if (!targetSessionId || !state.currentAgent) {
            return state;
          }

          const agentSessions = state.agentSessions[state.currentAgent.id] || [];
          const targetSession = agentSessions.find(s => s.id === targetSessionId);

          if (!targetSession || targetSession.messages.length === 0) {
            return state;
          }

          // 使用智能标题更新检查
          const titleUpdateResult = updateSessionTitleIfNeeded(
            targetSession.messages,
            targetSession.title,
            30,
          );

          if (titleUpdateResult.shouldUpdate) {
            const updatedSessions = agentSessions.map(session =>
              session.id === targetSessionId
                ? { ...session, title: titleUpdateResult.newTitle, updatedAt: new Date() }
                : session,
            );

            return {
              agentSessions: {
                ...state.agentSessions,
                [state.currentAgent.id]: updatedSessions,
              },
              currentSession: state.currentSession?.id === targetSessionId
                ? { ...state.currentSession, title: titleUpdateResult.newTitle, updatedAt: new Date() }
                : state.currentSession,
            };
          }

          return state;
        }),

      // Zustand store method
      getState: () => get(),
    }),
    {
      name: 'llmchat-storage',
      // 完全重构，不保留旧数据
      partialize: (state: ChatStore) => ({
        currentAgent: state.currentAgent,
        preferences: state.preferences,
        agentSessions: state.agentSessions,  // 保存新的数据结构
        currentSession: state.currentSession,
      }),
      version: 2,  // 新版本，不兼容旧数据
      onRehydrateStorage: () => (state: ChatStore | undefined) => {
        // huihua.md 要求：数据恢复后执行初始化检查
        if (state) {
          setTimeout(() => {
            state.initializeAgentSessions();
          }, 0);
        }
      },
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

export default useChatStore;
