import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ChatContainer } from './chat/ChatContainer';
import { KeyboardHelpPanel } from './KeyboardHelpPanel';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useChatStore } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';
import { useKeyboardManager, KeyboardShortcut } from '@/hooks/useKeyboardManager';

const ChatApp: React.FC = () => {
  const { initializeAgentSessions } = useChatStore();
  const { setAgentSelectorOpen } = useUIStore();
  const { registerShortcuts } = useKeyboardManager();
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [registeredShortcuts, setRegisteredShortcuts] = useState<KeyboardShortcut[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // huihua.md 要求 1：页面初始加载后检查
  useEffect(() => {
    initializeAgentSessions();
  }, [initializeAgentSessions]);

  // 注册快捷键 - 使用自定义的增强版本快捷键
  useEffect(() => {
    // 创建增强的快捷键列表，修复原有问题
    const enhancedShortcuts = [
      // 新建对话 (Ctrl+N)
      {
        key: 'n',
        ctrlKey: true,
        action: () => {
          const { createNewSession } = useChatStore.getState();
          createNewSession();
        },
        description: '新建对话',
        category: 'conversation' as const,
      },

      // 聚焦搜索框 (/)
      {
        key: '/',
        action: () => {
          // 聚焦到聊天输入框（作为搜索框的替代）
          const chatInput = document.querySelector(
            '#message-input-textarea',
          ) as HTMLTextAreaElement;
          if (chatInput) {
            chatInput.focus();
          }
        },
        description: '聚焦输入框',
        category: 'navigation' as const,
      },

      // 关闭模态 (Esc)
      {
        key: 'Escape',
        action: () => {
          // 关闭所有可能的模态状态
          setAgentSelectorOpen(false);
          setHelpPanelOpen(false);
          // 还可以关闭其他模态框
        },
        description: '关闭当前对话框',
        category: 'accessibility' as const,
      },

      // 发送消息 (Ctrl+Enter)
      {
        key: 'Enter',
        ctrlKey: true,
        action: () => {
          const sendButton = document.querySelector(
            '#send-message-button',
          ) as HTMLButtonElement;
          if (sendButton && !sendButton.disabled) {
            sendButton.click();
          }
        },
        description: '发送消息',
        category: 'conversation' as const,
      },

      // 上一个对话 (Ctrl+↑)
      {
        key: 'ArrowUp',
        ctrlKey: true,
        action: () => {
          const { agentSessions, currentAgent, currentSession } = useChatStore.getState();
          if (currentAgent && currentSession) {
            const sessions = agentSessions[currentAgent.id] ?? [];
            const currentIndex = sessions.findIndex(s => s.id === currentSession.id);
            if (currentIndex > 0) {
              const { switchToSession } = useChatStore.getState();
              const previousSession = sessions[currentIndex - 1];
              if (previousSession) {
                switchToSession(previousSession.id);
              }
            }
          }
        },
        description: '上一个对话',
        category: 'navigation' as const,
      },

      // 下一个对话 (Ctrl+↓)
      {
        key: 'ArrowDown',
        ctrlKey: true,
        action: () => {
          const { agentSessions, currentAgent, currentSession } = useChatStore.getState();
          if (currentAgent && currentSession) {
            const sessions = agentSessions[currentAgent.id] ?? [];
            const currentIndex = sessions.findIndex(s => s.id === currentSession.id);
            if (currentIndex < sessions.length - 1) {
              const { switchToSession } = useChatStore.getState();
              const nextSession = sessions[currentIndex + 1];
              if (nextSession) {
                switchToSession(nextSession.id);
              }
            }
          }
        },
        description: '下一个对话',
        category: 'navigation' as const,
      },

      // 编辑模式 (Ctrl+E) - 编辑最后一条用户消息
      {
        key: 'e',
        ctrlKey: true,
        action: () => {
          const { messages } = useChatStore.getState();
          // 找到最后一条用户消息
          let targetMessageIndex = -1;

          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.HUMAN !== undefined) {
              targetMessageIndex = i;
              break;
            }
          }

          if (targetMessageIndex !== -1) {
            const targetMessage = messages[targetMessageIndex];
            if (!targetMessage) return;

            const chatInput = document.querySelector(
              '#message-input-textarea',
            ) as HTMLTextAreaElement;

            if (chatInput) {
              // 将消息内容填充到输入框
              chatInput.value = targetMessage.HUMAN ?? '';
              chatInput.focus();

              // 触发 React 的 onChange 事件
              const event = new Event('input', { bubbles: true });
              chatInput.dispatchEvent(event);

              // 显示提示
              // eslint-disable-next-line no-console
              console.log('已加载最后一条消息到输入框进行编辑');
            }
          } else {
            // eslint-disable-next-line no-console
            console.log('没有找到可编辑的消息');
          }
        },
        description: '编辑最后消息',
        category: 'editing' as const,
      },

      // 删除当前对话 (Ctrl+Delete)
      {
        key: 'Delete',
        ctrlKey: true,
        action: () => {
          const { currentSession } = useChatStore.getState();
          if (currentSession) {
            setSessionToDelete(currentSession.id);
            setConfirmDialogOpen(true);
          }
        },
        description: '删除当前对话',
        category: 'editing' as const,
      },

      // 显示快捷键帮助 (Alt+H)
      {
        key: 'h',
        altKey: true,
        action: () => {
          setHelpPanelOpen(true);
        },
        description: '显示快捷键帮助',
        category: 'accessibility' as const,
      },

      // 切换侧边栏 (Alt+K)
      {
        key: 'k',
        altKey: true,
        action: () => {
          const { sidebarOpen, setSidebarOpen } = useUIStore.getState();
          setSidebarOpen(!sidebarOpen);
        },
        description: '切换侧边栏',
        category: 'accessibility' as const,
      },
    ];

    const unregister = registerShortcuts(enhancedShortcuts);
    setRegisteredShortcuts(enhancedShortcuts);
    return () => {
      unregister();
    };
  }, [registerShortcuts, setAgentSelectorOpen, setHelpPanelOpen]);

  const handleConfirmDelete = () => {
    if (sessionToDelete) {
      const { deleteSession } = useChatStore.getState();
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
    setConfirmDialogOpen(false);
  };

  const handleCancelDelete = () => {
    setSessionToDelete(null);
    setConfirmDialogOpen(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区域 */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:ml-0"
      >
        <Header />
        <main className="flex-1 overflow-hidden">
          <ChatContainer />
        </main>
      </div>

      {/* 键盘快捷键帮助面板 */}
      <KeyboardHelpPanel
        isOpen={helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        shortcuts={registeredShortcuts}
      />

      {/* 确认删除对话框 */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        title="删除对话"
        message="确定要删除当前对话吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default ChatApp;
