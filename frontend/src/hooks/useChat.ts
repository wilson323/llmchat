/**
 * useChat Hook - 优化版本
 * 
 * 性能优化：
 * 1. 使用拆分后的Store，减少订阅粒度
 * 2. 使用消息缓冲机制（appendToBuffer），批量更新
 * 3. 精确的状态订阅
 * 
 * @version 2.0 - 优化版（2025-10-03）
 * @legacy 原版备份在 useChat.legacy.ts
 */

import { useCallback } from 'react';
import { chatService } from '@/services/api';

// 新的拆分Store
import { useMessageStore } from '@/store/messageStore';
import { useAgentStore } from '@/store/agentStore';
import { useSessionStore } from '@/store/sessionStore';
import { usePreferenceStore } from '@/store/preferenceStore';

import { ChatMessage, ChatOptions, OriginalChatMessage, ReasoningStepUpdate } from '@/types';
import { useI18n } from '@/i18n';
import { parseReasoningPayload } from '@/lib/reasoning';
import { normalizeFastGPTEvent } from '@/lib/events';
import { debugLog } from '@/lib/debug';
import { perfMonitor } from '@/utils/performanceMonitor';

export const useChat = () => {
  const { t } = useI18n();

  const sendMessage = useCallback(async (
    content: string,
    options?: ChatOptions
  ) => {
    return perfMonitor.measureAsync('useChat.sendMessage', async () => {
      // 从各个Store获取状态
      const currentAgent = useAgentStore.getState().currentAgent;
      const currentSession = useSessionStore.getState().currentSession;
      const preferences = usePreferenceStore.getState().preferences;

      if (!currentAgent) {
        throw new Error(t('没有选择智能体'));
      }

      // 如果没有当前会话，创建一个
      if (!currentSession && currentAgent.id) {
        useSessionStore.getState().createNewSession(currentAgent.id);
      }

      const activeSession = useSessionStore.getState().currentSession;

      // 添加用户消息
      const userMessage: ChatMessage = {
        HUMAN: content,
        timestamp: Date.now(),
        ...(options?.attachments ? { attachments: options.attachments } : {}),
        ...(options?.voiceNote ? { voiceNote: options.voiceNote } : {}),
      };
      useMessageStore.getState().addMessage(userMessage);

      // 生成响应ID
      const responseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // 创建助手消息占位符
      const assistantMessage: ChatMessage = {
        AI: '',
        id: responseId,
        timestamp: Date.now(),
      };
      useMessageStore.getState().addMessage(assistantMessage);

      // 读取会话ID
      let sessionIdForChat: string | undefined;
      sessionIdForChat = activeSession?.id;

      // 构建聊天消息
      const chatMessages: OriginalChatMessage[] = [
        {
          id: `${Date.now()}-user`,
          role: 'user',
          content,
          timestamp: Date.now(),
          metadata: {
            ...(options?.attachments ? { attachments: options.attachments } : {}),
            ...(options?.voiceNote ? { voiceNote: options.voiceNote } : {}),
          },
        },
      ];

      // 透传 chatId 到后端
      const mergedOptions: ChatOptions | undefined = sessionIdForChat
        ? { ...options, chatId: sessionIdForChat, responseChatItemId: responseId }
        : { ...options, responseChatItemId: responseId };

      try {
        useMessageStore.getState().setIsStreaming(true);

        if (preferences.streamingEnabled) {
          const controller = new AbortController();
          useMessageStore.getState().setStreamAbortController(controller);

          // 🚀 性能优化：使用缓冲机制
          await chatService.sendStreamMessage(
            currentAgent.id,
            chatMessages,
            {
              onChunk: (chunk) => {
                // 关键优化：使用 appendToBuffer 而非 updateLastMessage
                // 不会立即触发渲染，而是批量更新（约16ms一次）
                useMessageStore.getState().appendToBuffer(chunk);
              },
              onStatus: (status) => {
                useMessageStore.getState().setStreamingStatus(status);
              },
              onInteractive: (interactiveData) => {
                try {
                  useMessageStore.getState().addMessage({ interactive: interactiveData });
                } catch (e) {
                  console.warn(t('处理 interactive 事件失败'), e, interactiveData);
                }
              },
              onChatId: () => {},
              signal: controller.signal,
            },
            mergedOptions
          );
        } else {
          // 非流式响应
          const response = await chatService.sendMessage(
            currentAgent.id,
            chatMessages,
            mergedOptions
          );

          const assistantContent = response.choices[0]?.message?.content || '';
          useMessageStore.getState().updateLastMessage(assistantContent);
        }

      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          useMessageStore.getState().updateLastMessage(t('（生成已停止）'));
        } else {
          console.error(t('发送消息失败'), error);
          useMessageStore.getState().updateLastMessage(t('抱歉，发送消息时出现错误。请稍后重试。'));
        }
      } finally {
        useMessageStore.getState().setStreamAbortController(null);
        useMessageStore.getState().setIsStreaming(false);
        useMessageStore.getState().setStreamingStatus(null);
      }
    });
  }, [t]);

  // 继续运行：交互节点-用户选择
  const continueInteractiveSelect = useCallback(async (value: string) => {
    await sendMessage(value);
  }, [sendMessage]);

  // 继续运行：交互节点-表单输入
  const continueInteractiveForm = useCallback(async (values: Record<string, any>) => {
    const content = JSON.stringify(values);
    await sendMessage(content);
  }, [sendMessage]);

  const retryMessage = useCallback(async (messageId: string) => {
    return perfMonitor.measureAsync('useChat.retryMessage', async () => {
      const currentAgent = useAgentStore.getState().currentAgent;
      const currentSession = useSessionStore.getState().currentSession;
      const preferences = usePreferenceStore.getState().preferences;
      const messages = useMessageStore.getState().messages;

      if (!currentAgent || !currentSession) {
        throw new Error(t('没有选择智能体或会话'));
      }

      const targetMessage = messages.find((msg) => msg.id === messageId);
      if (!targetMessage) {
        throw new Error(t('未找到需要重新生成的消息'));
      }

      useMessageStore.getState().updateMessageById(messageId, (prev) => ({
        ...prev,
        AI: '',
        reasoning: undefined
      }));

      try {
        useMessageStore.getState().setIsStreaming(true);

        if (preferences.streamingEnabled) {
          await chatService.retryStreamMessage(
            currentAgent.id,
            currentSession.id,
            messageId,
            (chunk) => {
              // 对于retry消息，使用updateMessageById
              useMessageStore.getState().updateMessageById(messageId, (prev) => ({
                ...prev,
                AI: `${prev.AI || ''}${chunk}`
              }));
            },
            (status) => {
              useMessageStore.getState().setStreamingStatus(status);
              if (status?.type === 'complete' || status?.type === 'error') {
                useMessageStore.getState().finalizeReasoning();
              }
            },
            { detail: true },
            (interactiveData) => {
              try {
                useMessageStore.getState().addMessage({ interactive: interactiveData });
              } catch (e) {
                console.warn(t('处理 retry interactive 事件失败'), e, interactiveData);
              }
            },
            (cid) => {
              debugLog('重新生成消息使用 chatId:', cid);
            },
            (reasoningEvent) => {
              const parsed = parseReasoningPayload(reasoningEvent);
              if (!parsed) return;

              parsed.steps.forEach((step: ReasoningStepUpdate) => {
                useMessageStore.getState().appendReasoningStep(step);
              });

              if (parsed.finished) {
                useMessageStore.getState().finalizeReasoning(parsed.totalSteps);
              }
            },
            (eventName, payload) => {
              const normalized = normalizeFastGPTEvent(eventName, payload);
              if (!normalized) return;
              useMessageStore.getState().appendAssistantEvent(normalized);
            }
          );
        } else {
          const response = await chatService.retryMessage(currentAgent.id, currentSession.id, messageId, { detail: true });
          const assistantContent = response.choices[0]?.message?.content || '';
          useMessageStore.getState().updateMessageById(messageId, (prev) => ({
            ...prev,
            AI: assistantContent
          }));
        }
      } catch (error) {
        console.error('重新生成消息失败:', error);
        useMessageStore.getState().updateMessageById(messageId, (prev) => ({
          ...prev,
          AI: t('抱歉，重新生成时出现错误。请稍后重试。')
        }));
      } finally {
        useMessageStore.getState().setIsStreaming(false);
        useMessageStore.getState().setStreamingStatus(null);
      }
    });
  }, [t]);

  return {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
    retryMessage,
  };
};


