import React, { useState, useEffect } from 'react';
import { useKeyboardManager, useKeyboardHelp, appShortcuts } from '@/hooks/useKeyboardManager';
import { Dialog } from './Dialog';

/**
 * 键盘快捷键帮助组件
 */
export const KeyboardShortcutsHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { formatShortcut, getHelpContent } = useKeyboardHelp();

  // 注册快捷键
  useKeyboardManager({
    shortcuts: [
      {
        key: 'h',
        altKey: true,
        action: () => setIsOpen(true),
        description: '显示快捷键帮助',
        category: 'accessibility',
      },
    ],
  });

  return (
    <>
      {/* 快捷键帮助按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-2 bg-muted/80 backdrop-blur-sm rounded-full border border-border/50 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
        aria-label="显示键盘快捷键帮助"
        title="键盘快捷键 (Alt+H)"
        >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* 帮助对话框 */}
      <Dialog
        open={isOpen}
        title="键盘快捷键"
        onClose={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
        confirmText="关闭"
        initialFocus="close"
        >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {getHelpContent().map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h3 className="font-medium text-foreground mb-2">{section.category}</h3>
              <div className="space-y-1">
                {section.shortcuts.map((shortcut, shortcutIndex) => (
                  <div
                    key={shortcutIndex}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-2 py-1 text-xs bg-background border border-border rounded">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 使用提示 */}
          <div className="pt-4 border-t border-border/50">
            <h3 className="font-medium text-foreground mb-2">使用提示</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 快捷键在输入框中通常被禁用</li>
              <li>• 按 Alt+H 可随时显示此帮助</li>
              <li>• Tab 键用于界面导航</li>
              <li>• Enter 和空格键用于激活按钮</li>
            </ul>
          </div>
        </div>
      </Dialog>
    </>
  );
};

/**
 * 全局键盘管理器组件
 */
export const GlobalKeyboardManager: React.FC = () => {
  const { registerShortcuts } = useKeyboardManager();

  useEffect(() => {
    // 注册全局应用快捷键
    const unregister = registerShortcuts(appShortcuts);

    return unregister;
  }, [registerShortcuts]);

  return <KeyboardShortcutsHelp />;
};