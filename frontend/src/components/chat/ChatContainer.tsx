/**
 * ChatContainer - 优化版本
 *
 * 性能优化：
 * 1. 使用拆分后的Store，精确订阅需要的状态
 * 2. 减少不必要的重渲染
 * 3. 优化消息列表渲染
 *
 * @version 2.0 - 优化版（2025-10-03）
 */

;
;
;
import {Bot, Sparkles} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { chatService } from '@/services/api';
// 使用拆分的store架构
import messageStore from '@/store/messageStore';
import agentStore from '@/store/agentStore';
import sessionStore from '@/store/sessionStore';
import type { InteractiveData, InteractiveFormItem, ChatOptions } from '@/types';
import { useChat } from '@/hooks/useChat';
import { useI18n } from '@/i18n';
import { perfMonitor } from '@/utils/performanceMonitor';
import {
  memoryMonitor,
  resourceManager,
  usePerformanceMonitor,
} from '@/utils/performanceOptimizer';
export const ChatContainer: React.FC = () => {
  // 🚀 性能监控和资源管理
  usePerformanceMonitor('ChatContainer');
  // 🚀 性能优化：使用拆分的store，精确订阅需要的状态
  const messages = messageStore((state: any) => state.messages);
  const isStreaming = messageStore((state: any) => state.isStreaming);
  const stopStreaming = messageStore((state: any) => state.stopStreaming);
  const addMessage = messageStore((state: any) => state.addMessage);
  const removeLastInteractiveMessage = messageStore((state: any) => state.removeLastInteractiveMessage);

  const currentAgent = agentStore((state: any) => state.currentAgent);
  const currentSession = sessionStore((state: any) => state.currentSession);
  const bindSessionId = sessionStore((state: any) => state.bindSessionId);
  const {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
    retryMessage,
  } = useChat();
  const { t } = useI18n();
  // 避免重复触发同一会话/智能体的开场白
  const welcomeTriggeredKeyRef = useRef<string | null>(null);
  // init 变量流程：隐藏输入框、收集初始变量
  const [hideComposer, setHideComposer] = useState(false);
  const [pendingInitVars, setPendingInitVars] = useState<Record<string, any> | null>(null);
  // 将 FastGPT init 返回的 variables 转为交互气泡
  const renderVariablesAsInteractive = (initData: Record<string, unknown>) => {
    return perfMonitor.measure('ChatContainer.renderVariablesAsInteractive', () => {
      try {
        const app = initData.app as Record<string, unknown> | undefined;
        const chatConfig = app?.chatConfig as Record<string, unknown> | undefined;
        const vars = (chatConfig?.variables as Array<Record<string, unknown>>) || [];
        if (vars.length === 0) {
          return;
        }

        const fields = vars.map((v: Record<string, unknown>) => {
          const base = {
            id: v.id,
            label: v.label || v.key,
            required: v.required,
            description: v.description,
          };
          switch (v.type) {
            case 'input':
              return { ...base, type: 'text' as const };
            case 'textarea':
              return { ...base, type: 'textarea' as const };
            case 'select':
              return {
                ...base,
                type: 'select' as const,
                options: ((v.enums as Array<{label?: string; value: string}> | undefined) || []).map((opt) => ({
                  label: opt.label || opt.value,
                  value: opt.value,
                })),
              };
            default:
              return { ...base, type: 'text' as const };
          }
        });
        const interactive: InteractiveData = {
          type: 'userInput',
          origin: 'init',
          params: {
            description: t('请填写以下信息'),
            inputForm: fields as unknown as InteractiveFormItem[],
          },
        };
        addMessage({ interactive });
        setHideComposer(true);
      } catch (e) {
        console.warn(t('渲染 variables 失败'), e);
      }
    });
  };
  // 交互回调：区分 init 起源与普通交互
  const handleInteractiveSelect = (payload: string | Record<string, unknown>): void => {
    if (typeof payload === 'string') {
      // 普通交互（非 init）：先移除交互气泡，再继续运行
      try {
        removeLastInteractiveMessage();
      } catch {}
      continueInteractiveSelect(payload);
      return;
    }
    if (payload && typeof payload === 'object' && payload.origin === 'init') {
      // init 交互：仅收集变量，显示输入框，不请求后端
      const payloadObj = payload;
      const key = String(payloadObj.key || '');
      const value = payloadObj.value;
      setPendingInitVars((prev: Record<string, any> | null) => ({ ...(prev || {}), [key]: value }));
      setHideComposer(false);
      try {
        removeLastInteractiveMessage();
      } catch {}
    }
  };
  const handleInteractiveFormSubmit = (payload: Record<string, unknown> | null | undefined): void => {
    // 非 init 表单：直接继续运行
    if (!payload || payload.origin !== 'init') {
      try {
        removeLastInteractiveMessage();
      } catch {}
      continueInteractiveForm(payload as Record<string, string>);
      return;
    }
    // init 表单：仅收集变量，显示输入框
    const values = payload.values || {};
    setPendingInitVars((prev: Record<string, any> | null) => ({ ...(prev || {}), ...values }));
    setHideComposer(false);
    try {
      removeLastInteractiveMessage();
    } catch {}
  };
  // 发送消息：若存在 init 变量，则在首次发送时一并携带
  const handleSendMessage = async (content: string, extraOptions?: ChatOptions) => {
    return perfMonitor.measureAsync('ChatContainer.handleSendMessage', async () => {
      const vars = pendingInitVars || undefined;
      const mergedOptions: ChatOptions = {
        ...(extraOptions || {}),
        ...(vars ? { variables: vars } : {}),
        detail: true,
      };
      await sendMessage(content, mergedOptions);
      if (vars) {
        setPendingInitVars(null);
      }
    });
  };
  useEffect(() => {
    return perfMonitor.measure('ChatContainer.welcomeMessage', () => {
      // 注意：特殊工作区由 AgentWorkspace 处理，这里只处理标准聊天界面
      if (!currentAgent || !currentSession) {
        return;
      }

      const welcomeKey = `${currentAgent.id}-${currentSession.id}`;
      if (welcomeTriggeredKeyRef.current === welcomeKey) {
        return;
      }

      if (messages.length === 0 && currentAgent.provider === 'fastgpt') {
        perfMonitor.measureAsync('ChatContainer.fetchWelcome', async () => {
          try {
            const response = await chatService.init(currentAgent.id);
            const chatId = response.chatId;
            if (chatId && currentSession.id !== chatId) {
              if (!currentAgent?.id) {
                return;
              }
              bindSessionId(currentSession.id, chatId);
            }

            const hasVariables = response.app?.chatConfig?.variables?.length > 0;
            if (hasVariables) {
              renderVariablesAsInteractive(response);
            }

            welcomeTriggeredKeyRef.current = welcomeKey;
          } catch (error) {
            console.error(t('获取开场白失败'), error);
          }
        });
      }
    });
  }, [currentAgent, currentSession, messages.length, bindSessionId, t]);
  // 内存监控
  useEffect(() => {
    const memoryCleanup = memoryMonitor.addMemoryObserver((): void => {
      // 注意：实际使用时需要正确的类型定义
      if (window.gc) {
        window.gc();
      }
    });
    return () => {
      if (typeof memoryCleanup === 'function') {
        memoryCleanup();
      }
    };
  }, []);
  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      resourceManager.cleanup();
    };
  }, []);
  // 注意：特殊工作区的渲染逻辑已移至 AgentWorkspace 路由组件
  // 此组件现在只负责渲染标准聊天界面

  // 常规智能体聊天界面
  return (
    <div className="flex flex-col h-full bg-background" data-testid="chat-container">
      {/* 空状态 */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-2xl w-full text-center space-y-6">
            {currentAgent ? (
              <>
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
                      <Bot className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-background flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-bold mb-2">{currentAgent.name}</h2>
                  {currentAgent.description && (
                    <p className="text-muted-foreground text-lg">{currentAgent.description}</p>
                  )}
                </div>

                <div className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('开始对话，我会尽力帮助你。')}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-2">{t('请选择一个智能体')}</h2>
                <p className="text-muted-foreground">{t('从侧边栏选择一个智能体开始对话')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 消息列表 */}
      {messages.length > 0 && (
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onInteractiveSelect={handleInteractiveSelect}
          onInteractiveFormSubmit={handleInteractiveFormSubmit}
          onRetryMessage={retryMessage}
        />
      )}

      {/* 输入框 */}
      {!hideComposer && currentAgent && (
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={!currentAgent || isStreaming}
          placeholder={currentAgent ? t('输入消息...') : t('请先选择智能体')}
          isStreaming={isStreaming}
          onStopStreaming={stopStreaming}
        />
      )}
    </div>
  );
};
export default ChatContainer;
