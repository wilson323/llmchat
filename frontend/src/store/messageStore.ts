/**
 * 消息 Store - 专注于消息管理和流式响应
 * 
 * 性能优化：
 * 1. 独立Store，减少订阅粒度
 * 2. 消息缓冲机制（requestAnimationFrame批量更新）
 * 3. 精确的消息索引查找
 */

import { create } from 'zustand';
import { ChatMessage, StreamStatus, ReasoningStepUpdate, ReasoningStep, FastGPTEvent } from '@/types';
// import { normalizeReasoningDisplay } from '@/lib/reasoning';
import { debugLog } from '@/lib/debug';
import { perfMonitor } from '@/utils/performanceMonitor';

// 辅助函数：查找最后一个助手消息的索引
const findLastAssistantMessageIndex = (messages: ChatMessage[]): number => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.AI !== undefined) {
      return i;
    }
  }
  return -1;
};

// 辅助函数：合并推理内容
const mergeReasoningContent = (previous: string | undefined, incoming: string): string => {
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (incoming === previous) return previous;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.endsWith(incoming)) return previous;
  if (incoming.endsWith(previous)) return incoming;
  return `${previous}${previous.endsWith('\n') ? '' : '\n'}${incoming}`;
};

interface MessageState {
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
  
  // Actions - 流式响应（优化后）
  appendToBuffer: (content: string) => void;
  flushBuffer: () => void;
  updateLastMessage: (content: string) => void;  // 保留兼容性
  
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
}

export const useMessageStore = create<MessageState>((set, get) => ({
  // 初始状态
  messages: [],
  isStreaming: false,
  streamingStatus: null,
  streamAbortController: null,
  streamBuffer: '',
  flushScheduled: false,

  // 添加消息
  addMessage: (message) => {
    perfMonitor.measure('messageStore.addMessage', () => {
      set((state) => {
        // 确保消息有时间戳
        const messageWithTimestamp = {
          ...message,
          timestamp: message.timestamp || Date.now()
        };
        
        debugLog('📝 添加新消息:', messageWithTimestamp.id || 'no-id');
        
        return {
          messages: [...state.messages, messageWithTimestamp],
        };
      });
    });
  },

  // 清除所有消息
  clearMessages: () => {
    set({
      messages: [],
      streamBuffer: '',
      flushScheduled: false,
    });
  },

  // 根据ID更新消息
  updateMessageById: (messageId, updater) => {
    perfMonitor.measure('messageStore.updateMessageById', () => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? updater(msg) : msg
        ),
      }));
    });
  },

  // 设置消息反馈
  setMessageFeedback: (messageId, feedback) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ),
    }));
  },

  // 移除最后一个交互气泡
  removeLastInteractiveMessage: () => {
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

      return {
        messages: state.messages.filter((_, i) => i !== idx),
      };
    });
  },

  // 性能优化：追加到缓冲区（不触发渲染）
  appendToBuffer: (content) => {
    perfMonitor.measure('messageStore.appendToBuffer', () => {
      set((state) => ({
        streamBuffer: state.streamBuffer + content,
      }));
      
      // 自动调度flush
      get()._scheduleFlush();
    });
  },

  // 性能优化：批量flush缓冲区（通过requestAnimationFrame调用）
  flushBuffer: () => {
    perfMonitor.measure('messageStore.flushBuffer', () => {
      set((state) => {
        if (!state.streamBuffer) {
          return { flushScheduled: false };
        }

        const targetIndex = findLastAssistantMessageIndex(state.messages);
        if (targetIndex === -1) {
          debugLog('⚠️ flushBuffer: 未找到助手消息');
          return { streamBuffer: '', flushScheduled: false };
        }

        const messages = state.messages.map((msg, index) => {
          if (index === targetIndex && msg.AI !== undefined) {
            const updatedMessage = {
              ...msg,
              AI: (msg.AI || '') + state.streamBuffer,
              _lastUpdate: Date.now(), // 强制更新
            } as ChatMessage;
            
            debugLog('📝 flush缓冲区:', {
              bufferedLength: state.streamBuffer.length,
              totalLength: updatedMessage.AI?.length,
            });
            
            return updatedMessage;
          }
          return msg;
        });

        return {
          messages,
          streamBuffer: '',
          flushScheduled: false,
        };
      });
    });
  },

  // 兼容性：直接更新最后一条消息（不推荐，使用appendToBuffer代替）
  updateLastMessage: (content) => {
    perfMonitor.measure('messageStore.updateLastMessage', () => {
      set((state) => {
        debugLog('🔄 updateLastMessage 被调用:', content.substring(0, 50));

        const targetIndex = findLastAssistantMessageIndex(state.messages);
        if (targetIndex === -1) {
          console.warn('⚠️ 未找到可更新的助手消息');
          return state;
        }

        const messages = state.messages.map((msg, index) => {
          if (index === targetIndex && msg.AI !== undefined) {
            return {
              ...msg,
              AI: (msg.AI || '') + content,
              _lastUpdate: Date.now(),
            } as ChatMessage;
          }
          return msg;
        });

        return { messages };
      });
    });
  },

  // 添加推理步骤
  appendReasoningStep: (step) => {
    set((state) => {
      const targetIndex = findLastAssistantMessageIndex(state.messages);
      if (targetIndex === -1) return state;

      const messages = state.messages.map((msg, index) => {
        if (index === targetIndex && msg.AI !== undefined) {
          const reasoning = msg.reasoning || { steps: [], isComplete: false };
          const existingStep = reasoning.steps.find((s) => s.index === step.index);

          if (existingStep) {
            existingStep.text = mergeReasoningContent(existingStep.text, step.text || step.content);
            if (step.title) existingStep.title = step.title;
            if (step.status) existingStep.status = step.status;
          } else {
            const newStep: ReasoningStep = {
              id: `step-${Date.now()}-${reasoning.steps.length}`,
              index: step.index || reasoning.steps.length,
              order: step.order || reasoning.steps.length,
              content: step.content,
              text: step.text || step.content,
              title: step.title || '',
              status: step.status || 'pending',
              raw: step.raw,
            };
            reasoning.steps = [...reasoning.steps, newStep];
            reasoning.steps.sort((a, b) => a.index - b.index);
          }

          return { ...msg, reasoning } as ChatMessage;
        }
        return msg;
      });

      return { messages };
    });
  },

  // 完成推理
  finalizeReasoning: (totalSteps) => {
    set((state) => {
      const targetIndex = findLastAssistantMessageIndex(state.messages);
      if (targetIndex === -1) return state;

      const messages = state.messages.map((msg, index) => {
        if (index === targetIndex && msg.AI !== undefined && msg.reasoning) {
          return {
            ...msg,
            reasoning: {
              ...msg.reasoning,
              isComplete: true,
              totalSteps: totalSteps ?? msg.reasoning.steps.length,
              renderable: msg.reasoning.steps.map(s => s.text || s.content).join('\n\n') || '',
            },
          } as ChatMessage;
        }
        return msg;
      });

      return { messages };
    });
  },

  // 添加助手事件
  appendAssistantEvent: (event) => {
    set((state) => {
      const targetIndex = findLastAssistantMessageIndex(state.messages);
      if (targetIndex === -1) return state;

      const messages = state.messages.map((msg, index) => {
        if (index === targetIndex && msg.AI !== undefined) {
          const events = msg.events || [];
          events.push(event);
          return { ...msg, events } as ChatMessage;
        }
        return msg;
      });

      return { messages };
    });
  },

  // 流式控制
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setStreamingStatus: (status) => set({ streamingStatus: status }),

  setStreamAbortController: (controller) => set({ streamAbortController: controller }),

  stopStreaming: () => {
    const { streamAbortController } = get();
    if (streamAbortController) {
      streamAbortController.abort();
    }
    set({
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
    });
  },

  // 内部方法：调度flush（使用requestAnimationFrame）
  _scheduleFlush: () => {
    const state = get();
    
    if (state.flushScheduled) {
      return; // 已经调度过了
    }

    set({ flushScheduled: true });

    // 使用requestAnimationFrame批量更新（约16ms一次）
    requestAnimationFrame(() => {
      get().flushBuffer();
    });
  },
}));

// 性能监控：定期输出messageStore的性能数据
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = perfMonitor.getStats('messageStore.flushBuffer');
    if (stats && stats.count > 0) {
      console.log('📊 MessageStore Performance:', {
        flushCount: stats.count,
        avgFlushTime: `${stats.avg.toFixed(2)}ms`,
        p95: `${stats.p95.toFixed(2)}ms`,
      });
    }
  }, 30000); // 每30秒
}

export default useMessageStore;

