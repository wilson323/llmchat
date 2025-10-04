/**
 * CAD 键盘快捷键处理
 */

import { useEffect } from 'react';

interface CadKeyboardShortcutsProps {
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onEscape?: () => void;
  onSave?: () => void;
  enabled?: boolean;
}

export const useCadKeyboardShortcuts = ({
  onUndo,
  onRedo,
  onDelete,
  onCopy,
  onPaste,
  onSelectAll,
  onEscape,
  onSave,
  enabled = true,
}: CadKeyboardShortcutsProps) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z - 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z - 重做
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Delete/Backspace - 删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 只在不是输入框时触发
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          onDelete?.();
          return;
        }
      }

      // Ctrl/Cmd + C - 复制
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = window.getSelection()?.toString();
        if (!selection || selection.length === 0) {
          e.preventDefault();
          onCopy?.();
          return;
        }
      }

      // Ctrl/Cmd + V - 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          onPaste?.();
          return;
        }
      }

      // Ctrl/Cmd + A - 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          onSelectAll?.();
          return;
        }
      }

      // Escape - 取消选择
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      // Ctrl/Cmd + S - 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onUndo,
    onRedo,
    onDelete,
    onCopy,
    onPaste,
    onSelectAll,
    onEscape,
    onSave,
  ]);
};

// 快捷键提示组件
export const KeyboardShortcutsHint: React.FC = () => {
  const shortcuts = [
    { keys: ['Ctrl', 'Z'], action: '撤销' },
    { keys: ['Ctrl', 'Y'], action: '重做' },
    { keys: ['Del'], action: '删除' },
    { keys: ['Ctrl', 'C'], action: '复制' },
    { keys: ['Ctrl', 'V'], action: '粘贴' },
    { keys: ['Ctrl', 'A'], action: '全选' },
    { keys: ['Ctrl', 'S'], action: '保存' },
    { keys: ['Esc'], action: '取消' },
  ];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
        键盘快捷键
      </h4>
      <div className="space-y-2">
        {shortcuts.map(({ keys, action }) => (
          <div
            key={action}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-1">
              {keys.map((key, index) => (
                <React.Fragment key={key}>
                  {index > 0 && <span className="text-gray-400">+</span>}
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                    {key}
                  </kbd>
                </React.Fragment>
              ))}
            </div>
            <span className="text-gray-600 dark:text-gray-400">{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
