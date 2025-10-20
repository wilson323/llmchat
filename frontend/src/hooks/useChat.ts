/**
 * useChat Hook - 优化版本
 *
 * 性能优化：
 * 1. 使用拆分后的Store，减少订阅粒度
 * 2. 使用消息缓冲机制（appendToBuffer），批量更新
 * 3. 精确的状态订阅
 *
 * @version 2.0 - 优化版（2025-10-03）
 */

import { useCallback } from 'react';
import { chatService } from '@/services/api';
import { logger } from '@/lib/logger';
import { enhancedLogger } from '@/lib/enhancedLogger';
import { convertFastGPTInteractiveData } from '@/utils/interactiveDataConverter';
import { useErrorHandler } from './useErrorHandler';

// 直接导入store实例以便在组件外部使用getState
import messageStore from '@/store/messageStore';
import agentStore from '@/store/agentStore';
import sessionStore from '@/store/sessionStore';
import preferenceStore from '@/store/preferenceStore';

import { ChatMessage, ChatOptions, OriginalChatMessage, ReasoningStepUpdate } from '@/types';
import type { JsonValue } from '@/types/dynamic';
import { useI18n } from '@/i18n';
import { parseReasoningPayload } from '@/lib/reasoning';
import { normalizeFastGPTEvent } from '@/lib/events';
import { debugLog } from '@/lib/debug';

export const useChat = () => {
  const { t } = useI18n();
  const { handleAsyncError } = useErrorHandler();
  
  // 记录Hook初始化
  enhancedLogger.hookExecution('useChat', 'init');

  const sendMessage = useCallback(async (
    content: string,
    options?: ChatOptions,
  ) => {
    // 记录消息发送开始
    enhancedLogger.userAction('sendMessage', {
      contentLength: content.length,
      hasAttachments: !!options?.attachments,
      hasVoiceNote: !!options?.voiceNote,
    });
    // 从各个Store获取状态
    const currentAgent = agentStore.getState().currentAgent;
    const currentSession = sessionStore.getState().currentSession;
    const preferences = preferenceStore.getState().preferences;

    if (!currentAgent) {
      throw new Error(t('没有选择智能体'));
    }

    // 如果没有当前会话，创建一个
    if (!currentSession && currentAgent.id) {
      sessionStore.getState().createNewSession(currentAgent.id);
    }

    const activeSession = sessionStore.getState().currentSession;

    // 添加用户消息
    const userMessage: ChatMessage = {
      HUMAN: content,
      timestamp: Date.now(),
      ...(options?.attachments ? { attachments: options.attachments } : {}),
      ...(options?.voiceNote ? { voiceNote: options.voiceNote } : {}),
    };
    messageStore.getState().addMessage(userMessage);
    
    // 记录消息添加
    enhancedLogger.stateUpdate('messageStore', 'addMessage', {
      messageType: 'user',
      messageLength: content.length,
    });

    // 生成响应ID
    const responseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 创建助手消息占位符
    const assistantMessage: ChatMessage = {
      AI: '',
      id: responseId,
      timestamp: Date.now(),
    };
    messageStore.getState().addMessage(assistantMessage);

    // 读取会话ID
    const sessionIdForChat = activeSession?.id;

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
      messageStore.getState().setIsStreaming(true);

      if (preferences.streamingEnabled) {
        const controller = new AbortController();
        messageStore.getState().setStreamAbortController(controller);

        // 🚀 性能优化：使用缓冲机制
        // 记录流式请求开始
        enhancedLogger.serviceCall('chatService', 'sendStreamMessage', {
          agentId: currentAgent.id,
          messageCount: chatMessages.length,
        });
        
        const startTime = enhancedLogger.startTimer('sendStreamMessage');
        await chatService.sendStreamMessage(
            currentAgent.id,
            chatMessages,
            {
            onChunk: (chunk) => {
              // 关键优化：使用 appendToBuffer 而非 updateLastMessage
              // 不会立即触发渲染，而是批量更新（约16ms一次）
              messageStore.getState().appendToBuffer(chunk);
            },
            onStatus: (status) => {
              messageStore.getState().setStreamingStatus(status);
            },
            onInteractive: (interactiveData) => {
              try {
                // 转换 FastGPT 交互数据为前端格式
                const convertedData = convertFastGPTInteractiveData(interactiveData);
                if (convertedData) {
                  messageStore.getState().addMessage({ interactive: convertedData as any });  // 修复：类型兼容
                  enhancedLogger.stateUpdate('messageStore', 'addInteractiveMessage');
                } else {
                  logger.warn(t('无法转换 interactive 数据'), { interactiveData });
                }
              } catch (unknownError: unknown) {
                const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
                logger.warn(t('处理 interactive 事件失败'), { error: error.message, interactiveData });
              }
            },
            onChatId: () => {},
            signal: controller.signal,
          },
          mergedOptions,
        );
        enhancedLogger.endTimer('sendStreamMessage', startTime, 'Send Stream Message', {
          agentId: currentAgent.id,
        });
      } else {
        // 非流式响应
        // 记录非流式请求开始
        enhancedLogger.serviceCall('chatService', 'sendMessage', {
          agentId: currentAgent.id,
          messageCount: chatMessages.length,
        });
        
        const startTime = enhancedLogger.startTimer('sendMessage');
        const response = await chatService.sendMessage(
          currentAgent.id,
          chatMessages,
          mergedOptions,
        );
        enhancedLogger.endTimer('sendMessage', startTime, 'Send Message', {
          agentId: currentAgent.id,
        });

        const assistantContent = response.choices[0]?.message?.content || '';
        messageStore.getState().updateLastMessage(assistantContent);
        
        // 记录响应更新
        enhancedLogger.stateUpdate('messageStore', 'updateLastMessage', {
          contentLength: assistantContent.length,
        });
      }

    } catch (unknownError: unknown) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      if (error instanceof DOMException && error.name === 'AbortError') {
        messageStore.getState().updateLastMessage(t('（生成已停止）'));
        enhancedLogger.info('Message generation stopped by user', {
          agentId: currentAgent?.id,
          sessionId: currentSession?.id,
        });
      } else {
        handleAsyncError(error, {
          agentId: currentAgent?.id,
          sessionId: currentSession?.id,
        });
        messageStore.getState().updateLastMessage(t('抱歉，发送消息时出现错误。请稍后重试。'));
        
        // 记录错误
        enhancedLogger.error('Failed to send message', error, {
          agentId: currentAgent?.id,
          sessionId: currentSession?.id,
        });
      }
    } finally {
      messageStore.getState().setStreamAbortController(null);
      messageStore.getState().setIsStreaming(false);
      messageStore.getState().setStreamingStatus(null);
    }
  }, [t]);

  // 继续运行：交互节点-用户选择
  const continueInteractiveSelect = useCallback(async (value: string) => {
    await sendMessage(value);
  }, [sendMessage]);

  // 继续运行：交互节点-表单输入
  const continueInteractiveForm = useCallback(async (values: Record<string, unknown>) => {
    const content = JSON.stringify(values);
    await sendMessage(content);
  }, [sendMessage]);

  const retryMessage = useCallback(async (messageId: string) => {
      const currentAgent = agentStore.getState().currentAgent;
      const currentSession = sessionStore.getState().currentSession;
      const preferences = preferenceStore.getState().preferences;
      const messages = messageStore.getState().messages;

      if (!currentAgent || !currentSession) {
        throw new Error(t('没有选择智能体或会话'));
      }

      const targetMessage = messages.find((msg: ChatMessage) => msg.id === messageId);
      if (!targetMessage) {
        throw new Error(t('未找到需要重新生成的消息'));
      }

      messageStore.getState().updateMessageById(messageId, (prev: ChatMessage) => {
        const { reasoning, ...rest } = prev;
        return {
          ...rest,
          AI: '',
        };
      });

      try {
        // 记录重试操作
        enhancedLogger.userAction('retryMessage', {
          messageId,
          agentId: currentAgent.id,
          sessionId: currentSession.id,
        });
        
        messageStore.getState().setIsStreaming(true);

        if (preferences.streamingEnabled) {
          // 记录流式重试请求开始
          enhancedLogger.serviceCall('chatService', 'retryStreamMessage', {
            agentId: currentAgent.id,
            sessionId: currentSession.id,
            messageId,
          });
          
          const startTime = enhancedLogger.startTimer('retryStreamMessage');
          await chatService.retryStreamMessage(
            currentAgent.id,
            currentSession.id,
            messageId,
            {
              onChunk: (chunk: string) => {
                // 对于retry消息，使用updateMessageById
                messageStore.getState().updateMessageById(messageId, (prev: ChatMessage) => ({
                  ...prev,
                  AI: `${prev.AI || ''}${chunk}`,
                }));
                
                // 记录消息更新
                enhancedLogger.stateUpdate('messageStore', 'updateMessageById', {
                  messageId,
                  chunkLength: chunk.length,
                });
              },
              onStatus: (status) => {
                messageStore.getState().setStreamingStatus(status);
                enhancedLogger.stateUpdate('messageStore', 'setStreamingStatus');
              },
              onInteractive: (interactiveData) => {
                try {
                  // 转换 FastGPT 交互数据为前端格式
                  const convertedData = convertFastGPTInteractiveData(interactiveData);
                  if (convertedData) {
                    messageStore.getState().addMessage({ interactive: convertedData as any });  // 修复：类型兼容
                    enhancedLogger.stateUpdate('messageStore', 'addInteractiveMessage');
                  } else {
                    logger.warn(t('无法转换 retry interactive 数据'), { interactiveData });
                  }
                } catch (unknownError: unknown) {
                  const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
                  logger.warn(t('处理 retry interactive 事件失败'), { error: error.message, interactiveData });
                }
              },
              onChatId: (cid: string) => {
                debugLog('重新生成消息使用 chatId:', cid);
                enhancedLogger.debug('Chat ID received in retry', { chatId: cid });
              },
              onReasoning: (reasoningEvent) => {
                const parsed = parseReasoningPayload(reasoningEvent);
                if (!parsed) {
                  return;
                }

                parsed.steps.forEach((step: ReasoningStepUpdate) => {
                  messageStore.getState().appendReasoningStep(step);
                });

                if (parsed.finished) {
                  messageStore.getState().finalizeReasoning(parsed.totalSteps);
                  enhancedLogger.stateUpdate('messageStore', 'finalizeReasoning');
                }
                
                enhancedLogger.stateUpdate('messageStore', 'appendReasoningStep');
              },
              onEvent: (eventName, payload) => {
                // 将SSEEventData转换为JsonValue
                const jsonPayload = payload === null || payload === undefined ? null :
                  typeof payload === 'string' ? payload :
                    typeof payload === 'object' ? payload as Record<string, unknown> :
                      null;
                const normalized = normalizeFastGPTEvent(eventName, jsonPayload as JsonValue);
                if (!normalized) {
                  return;
                }
                messageStore.getState().appendAssistantEvent(normalized);
                enhancedLogger.stateUpdate('messageStore', 'appendAssistantEvent', {
                  eventName,
                });
              },
            },
            { detail: true },
          );
          enhancedLogger.endTimer('retryStreamMessage', startTime, 'Retry Stream Message', {
            agentId: currentAgent.id,
            messageId,
          });
        } else {
          // 记录非流式重试请求开始
          enhancedLogger.serviceCall('chatService', 'retryMessage', {
            agentId: currentAgent.id,
            sessionId: currentSession.id,
            messageId,
          });
          
          const startTime = enhancedLogger.startTimer('retryMessage');
          const response = await chatService.retryMessage(currentAgent.id, currentSession.id, messageId, { detail: true });
          enhancedLogger.endTimer('retryMessage', startTime, 'Retry Message', {
            agentId: currentAgent.id,
            messageId,
          });
          
          const assistantContent = response.choices[0]?.message?.content || '';
          messageStore.getState().updateMessageById(messageId, (prev: ChatMessage) => ({
            ...prev,
            AI: assistantContent,
          }));
          
          // 记录消息更新
          enhancedLogger.stateUpdate('messageStore', 'updateMessageById', {
            messageId,
            contentLength: assistantContent.length,
          });
        }
      } catch (unknownError: unknown) {
        const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
        handleAsyncError(error, {
          messageId,
          agentId: currentAgent.id,
          sessionId: currentSession.id,
        });
        
        // 记录错误
        enhancedLogger.error('Failed to retry message', error, {
          messageId,
          agentId: currentAgent.id,
          sessionId: currentSession.id,
        });
        
        messageStore.getState().updateMessageById(messageId, (prev: ChatMessage) => ({
          ...prev,
          AI: t('抱歉，重新生成时出现错误。请稍后重试。'),
        }));
      } finally {
        messageStore.getState().setIsStreaming(false);
        messageStore.getState().setStreamingStatus(null);
      }
  }, [t]);

  return {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
    retryMessage,
  };
};