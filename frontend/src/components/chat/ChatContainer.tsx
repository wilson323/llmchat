/**
 * ChatContainer - 优化版本
 * 
 * 性能优化：
 * 1. 使用拆分后的Store，精确订阅需要的状态
 * 2. 减少不必要的重渲染
 * 3. 优化消息列表渲染
 * 
 * @version 2.0 - 优化版（2025-10-03）
 * @legacy 原版备份在 ChatContainer.legacy.tsx
 */

import React, { useEffect, useRef, useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Bot, Sparkles } from 'lucide-react';
import { chatService } from '@/services/api';

// 新的拆分Store
import { useMessageStore } from '@/store/messageStore';
import { useAgentStore } from '@/store/agentStore';
import { useSessionStore } from '@/store/sessionStore';
import { usePreferenceStore } from '@/store/preferenceStore';

import { useChat } from '@/hooks/useChat';
import { useI18n } from '@/i18n';
import { ProductPreviewWorkspace } from '@/components/product/ProductPreviewWorkspace';
import { VoiceCallWorkspace } from '@/components/voice/VoiceCallWorkspace';
import { PRODUCT_PREVIEW_AGENT_ID, VOICE_CALL_AGENT_ID } from '@/constants/agents';
import { useResponsive } from '@/hooks/useResponsive';
import { perfMonitor } from '@/utils/performanceMonitor';

export const ChatContainer: React.FC = () => {
  // 🚀 性能优化：精确订阅，只订阅需要的状态
  const messages = useMessageStore((state) => state.messages);
  const isStreaming = useMessageStore((state) => state.isStreaming);
  const stopStreaming = useMessageStore((state) => state.stopStreaming);
  const addMessage = useMessageStore((state) => state.addMessage);
  const removeLastInteractiveMessage = useMessageStore((state) => state.removeLastInteractiveMessage);
  
  const currentAgent = useAgentStore((state) => state.currentAgent);
  
  const currentSession = useSessionStore((state) => state.currentSession);
  const createNewSession = useSessionStore((state) => state.createNewSession);
  const bindSessionId = useSessionStore((state) => state.bindSessionId);
  
  const preferences = usePreferenceStore((state) => state.preferences);

  const {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
    retryMessage
  } = useChat();

  const { t } = useI18n();
  const { isMobile, isTablet } = useResponsive();

  // 避免重复触发同一会话/智能体的开场白
  const welcomeTriggeredKeyRef = useRef<string | null>(null);

  // init 变量流程：隐藏输入框、收集初始变量
  const [hideComposer, setHideComposer] = useState(false);
  const [pendingInitVars, setPendingInitVars] = useState<Record<string, any> | null>(null);

  // 将 FastGPT init 返回的 variables 转为交互气泡
  const renderVariablesAsInteractive = (initData: any) => {
    return perfMonitor.measure('ChatContainer.renderVariablesAsInteractive', () => {
      try {
        const vars = initData?.app?.chatConfig?.variables || [];
        if (vars.length === 0) return;

        const fields = vars.map((v: any) => {
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
                options: (v.enums || []).map((opt: any) => ({
                  label: opt.label || opt.value,
                  value: opt.value,
                })),
              };
            default:
              return { ...base, type: 'text' as const };
          }
        });

        const interactive = {
          type: 'form' as const,
          content: {
            title: t('请填写以下信息'),
            fields,
            submitText: t('继续'),
            origin: 'init',
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
  const handleInteractiveSelect = (payload: any) => {
    if (typeof payload === 'string') {
      // 普通交互（非 init）：先移除交互气泡，再继续运行
      try { removeLastInteractiveMessage(); } catch {}
      return continueInteractiveSelect(payload);
    }
    if (payload && payload.origin === 'init') {
      // init 交互：仅收集变量，显示输入框，不请求后端
      setPendingInitVars((prev) => ({ ...(prev || {}), [payload.key]: payload.value }));
      setHideComposer(false);
      try { removeLastInteractiveMessage(); } catch {}
    }
  };

  const handleInteractiveFormSubmit = (payload: any) => {
    // 非 init 表单：直接继续运行
    if (!payload || payload.origin !== 'init') {
      try { removeLastInteractiveMessage(); } catch {}
      return continueInteractiveForm(payload);
    }
    // init 表单：仅收集变量，显示输入框
    const values = payload.values || {};
    setPendingInitVars((prev) => ({ ...(prev || {}), ...values }));
    setHideComposer(false);
    try { removeLastInteractiveMessage(); } catch {}
  };

  // 发送消息：若存在 init 变量，则在首次发送时一并携带
  const handleSendMessage = async (content: string, extraOptions?: any) => {
    return perfMonitor.measureAsync('ChatContainer.handleSendMessage', async () => {
      const vars = pendingInitVars || undefined;
      const mergedOptions = {
        ...(extraOptions || {}),
        ...(vars ? { variables: vars } : {}),
        detail: true,
      };
      await sendMessage(content, mergedOptions);
      if (vars) setPendingInitVars(null);
    });
  };

  useEffect(() => {
    return perfMonitor.measure('ChatContainer.specialAgentCheck', () => {
      if (currentAgent?.id === PRODUCT_PREVIEW_AGENT_ID ||
          currentAgent?.id === VOICE_CALL_AGENT_ID) {
        return;
      }

      // 其他智能体的开场白逻辑
      if (!currentAgent || !currentSession) return;

      const welcomeKey = `${currentAgent.id}-${currentSession.id}`;
      if (welcomeTriggeredKeyRef.current === welcomeKey) return;

      if (messages.length === 0 && currentAgent.provider === 'fastgpt') {
        perfMonitor.measureAsync('ChatContainer.fetchWelcome', async () => {
          try {
            const response = await chatService.initChatSession(currentAgent.id, { detail: true });
            const chatId = response.chatId;

            if (chatId && currentSession.id !== chatId) {
              if (!currentAgent?.id) return;
              bindSessionId(currentAgent.id, currentSession.id, chatId);
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

  // 特殊智能体的专用工作区
  if (currentAgent?.id === PRODUCT_PREVIEW_AGENT_ID) {
    return <ProductPreviewWorkspace />;
  }

  if (currentAgent?.id === VOICE_CALL_AGENT_ID) {
    return <VoiceCallWorkspace />;
  }

  // 常规智能体聊天界面
  return (
    <div className="flex flex-col h-full bg-background">
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

