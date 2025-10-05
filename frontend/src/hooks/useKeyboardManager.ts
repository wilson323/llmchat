import { useEffect, useCallback, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category: "navigation" | "editing" | "conversation" | "accessibility";
  preventDefault?: boolean;
  enabled?: boolean;
}

interface UseKeyboardManagerOptions {
  shortcuts?: KeyboardShortcut[];
  enabled?: boolean;
  onConflict?: (shortcut: KeyboardShortcut, existing: KeyboardShortcut) => void;
}

/**
 * 全局键盘快捷键管理Hook
 * 支持快捷键注册、冲突检测和上下文感知
 */
export const useKeyboardManager = ({
  shortcuts: initialShortcuts = [],
  enabled = true,
  onConflict,
}: UseKeyboardManagerOptions = {}) => {
  const shortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());
  const isDisabledRef = useRef(false);

  // 生成快捷键的唯一标识
  const getShortcutKey = (shortcut: KeyboardShortcut): string => {
    const parts = [];
    if (shortcut.ctrlKey) parts.push("ctrl");
    if (shortcut.shiftKey) parts.push("shift");
    if (shortcut.altKey) parts.push("alt");
    if (shortcut.metaKey) parts.push("meta");
    parts.push(shortcut.key.toLowerCase());
    return parts.join("+");
  };

  // 检查快捷键冲突
  const checkConflict = (
    shortcut: KeyboardShortcut
  ): KeyboardShortcut | null => {
    const key = getShortcutKey(shortcut);
    return shortcutsRef.current.get(key) || null;
  };

  // 注册快捷键
  const registerShortcut = useCallback(
    (shortcut: KeyboardShortcut) => {
      if (!enabled) return () => {};

      const key = getShortcutKey(shortcut);
      const existing = checkConflict(shortcut);

      if (existing && onConflict) {
        onConflict(shortcut, existing);
      }

      shortcutsRef.current.set(key, shortcut);

      // 返回取消注册函数
      return () => {
        shortcutsRef.current.delete(key);
      };
    },
    [enabled, onConflict]
  );

  // 批量注册快捷键
  const registerShortcuts = useCallback(
    (shortcuts: KeyboardShortcut[]) => {
      const unregisterFunctions: (() => void)[] = [];

      shortcuts.forEach((shortcut) => {
        const unregister = registerShortcut(shortcut);
        unregisterFunctions.push(unregister);
      });

      // 返回批量取消注册函数
      return () => {
        unregisterFunctions.forEach((unregister) => unregister());
      };
    },
    [registerShortcut]
  );

  // 移除快捷键
  const unregisterShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const key = getShortcutKey(shortcut);
    shortcutsRef.current.delete(key);
  }, []);

  // 禁用/启用快捷键系统
  const setDisabled = useCallback((disabled: boolean) => {
    isDisabledRef.current = disabled;
  }, []);

  // 检查快捷键是否匹配
  const matchesShortcut = (
    event: KeyboardEvent,
    shortcut: KeyboardShortcut
  ): boolean => {
    if (shortcut.key.toLowerCase() !== event.key.toLowerCase()) return false;
    if (shortcut.ctrlKey !== event.ctrlKey) return false;
    if (shortcut.shiftKey !== event.shiftKey) return false;
    if (shortcut.altKey !== event.altKey) return false;
    if (shortcut.metaKey !== event.metaKey) return false;

    // 检查快捷键是否启用
    if (shortcut.enabled === false) return false;

    return true;
  };

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || isDisabledRef.current) return;

      // 忽略在输入框中的事件（除非是全局快捷键）
      const target = event.target as HTMLElement;
      const isInInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      for (const shortcut of shortcutsRef.current.values()) {
        if (matchesShortcut(event, shortcut)) {
          // 某些快捷键在输入框中也应该工作
          const allowInInput =
            shortcut.category === "accessibility" ||
            shortcut.category === "navigation" ||
            shortcut.key === "Escape";

          if (isInInputElement && !allowInInput) continue;

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          try {
            shortcut.action();
          } catch (error) {
            console.error("快捷键执行错误:", error);
          }

          break;
        }
      }
    },
    [enabled]
  );

  // 获取已注册的快捷键列表
  const getRegisteredShortcuts = useCallback((): KeyboardShortcut[] => {
    return Array.from(shortcutsRef.current.values());
  }, []);

  // 按类别获取快捷键
  const getShortcutsByCategory = useCallback(
    (category: KeyboardShortcut["category"]): KeyboardShortcut[] => {
      return getRegisteredShortcuts().filter(
        (shortcut) => shortcut.category === category
      );
    },
    [getRegisteredShortcuts]
  );

  // 初始化默认快捷键
  useEffect(() => {
    if (initialShortcuts.length > 0) {
      registerShortcuts(initialShortcuts);
    }

    return () => {
      shortcutsRef.current.clear();
    };
  }, [initialShortcuts, registerShortcuts]);

  // 全局键盘事件监听
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);

  return {
    registerShortcut,
    registerShortcuts,
    unregisterShortcut,
    setDisabled,
    getRegisteredShortcuts,
    getShortcutsByCategory,
    checkConflict,
  };
};

/**
 * 预定义的应用快捷键
 */
export const appShortcuts: KeyboardShortcut[] = [
  // 导航快捷键
  {
    key: "n",
    ctrlKey: true,
    action: () => {
      // 实现新对话功能
      const { createNewSession } = useChatStore.getState();
      createNewSession();
    },
    description: "新建对话",
    category: "conversation",
  },
  {
    key: "/",
    action: () => {
      // 聚焦搜索框
      const searchInput = document.querySelector(
        "#search-input"
      ) as HTMLInputElement | null;
      if (searchInput) {
        searchInput.focus();
      }
    },
    description: "聚焦搜索框",
    category: "navigation",
  },
  {
    key: "Escape",
    action: () => {
      // 关闭当前模态
      const { setAgentSelectorOpen } = useChatStore.getState();
      setAgentSelectorOpen(false);
    },
    description: "关闭当前模态对话框",
    category: "accessibility",
  },

  // 对话快捷键
  {
    key: "Enter",
    ctrlKey: true,
    action: () => {
      // 发送消息
      const sendButton = document.querySelector(
        '[data-testid="send-button"]'
      ) as HTMLButtonElement | null;
      if (sendButton) {
        sendButton.click();
      }
    },
    description: "发送消息",
    category: "conversation",
  },
  {
    key: "ArrowUp",
    ctrlKey: true,
    action: () => {
      // 上一个对话
      const { agentSessions, currentAgent, currentSession } =
        useChatStore.getState();
      if (currentAgent && currentSession) {
        const sessions = agentSessions[currentAgent.id] || [];
        const currentIndex = sessions.findIndex(
          (s) => s.id === currentSession.id
        );
        if (currentIndex > 0) {
          const { switchToSession } = useChatStore.getState();
          switchToSession(sessions[currentIndex - 1].id);
        }
      }
    },
    description: "切换到上一个对话",
    category: "navigation",
  },
  {
    key: "ArrowDown",
    ctrlKey: true,
    action: () => {
      // 下一个对话
      const { agentSessions, currentAgent, currentSession } =
        useChatStore.getState();
      if (currentAgent && currentSession) {
        const sessions = agentSessions[currentAgent.id] || [];
        const currentIndex = sessions.findIndex(
          (s) => s.id === currentSession.id
        );
        if (currentIndex < sessions.length - 1) {
          const { switchToSession } = useChatStore.getState();
          switchToSession(sessions[currentIndex + 1].id);
        }
      }
    },
    description: "切换到下一个对话",
    category: "navigation",
  },

  // 编辑快捷键
  {
    key: "e",
    ctrlKey: true,
    action: () => {
      // 编辑模式 - 这里可以实现具体的编辑功能
      console.log("编辑模式激活");
    },
    description: "编辑当前消息",
    category: "editing",
  },
  {
    key: "Delete",
    ctrlKey: true,
    action: () => {
      // 删除对话
      const { currentSession, deleteSession } = useChatStore.getState();
      if (currentSession) {
        deleteSession(currentSession.id);
      }
    },
    description: "删除当前对话",
    category: "editing",
  },

  // 可访问性快捷键
  {
    key: "h",
    altKey: true,
    action: () => {
      // 显示快捷键帮助
      const { setSidebarOpen } = useUIStore.getState();
      setSidebarOpen(true);
    },
    description: "显示快捷键帮助",
    category: "accessibility",
  },
  {
    key: "k",
    altKey: true,
    action: () => {
      // 切换侧边栏
      const { sidebarOpen, setSidebarOpen } = useUIStore.getState();
      setSidebarOpen(!sidebarOpen);
    },
    description: "切换侧边栏显示",
    category: "accessibility",
  },
];

/**
 * 快捷键帮助组件Hook - 独立版本，避免循环依赖
 */
export const useKeyboardHelp = (shortcuts: KeyboardShortcut[] = []) => {
  const getShortcutsByCategory = useCallback(
    (category: KeyboardShortcut["category"]): KeyboardShortcut[] => {
      return shortcuts.filter((shortcut) => shortcut.category === category);
    },
    [shortcuts]
  );

  const getHelpContent = useCallback(() => {
    const categories = [
      { key: "navigation", name: "导航" },
      { key: "conversation", name: "对话" },
      { key: "editing", name: "编辑" },
      { key: "accessibility", name: "可访问性" },
    ] as const;

    return categories
      .map((category) => ({
        category: category.name,
        shortcuts: getShortcutsByCategory(category.key),
      }))
      .filter((section) => section.shortcuts.length > 0);
  }, [getShortcutsByCategory]);

  const formatShortcut = (shortcut: KeyboardShortcut): string => {
    const parts = [];
    if (shortcut.ctrlKey) parts.push("Ctrl");
    if (shortcut.shiftKey) parts.push("Shift");
    if (shortcut.altKey) parts.push("Alt");
    if (shortcut.metaKey) parts.push("Meta");
    parts.push(shortcut.key.toUpperCase());
    return parts.join(" + ");
  };

  return {
    getHelpContent,
    formatShortcut,
    getShortcutsByCategory,
  };
};
