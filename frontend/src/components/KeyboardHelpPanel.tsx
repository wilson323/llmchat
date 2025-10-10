import React from 'react';
import { useKeyboardHelp, KeyboardShortcut } from '@/hooks/useKeyboardManager';
import { useI18n } from '@/i18n';

interface KeyboardHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: KeyboardShortcut[];
}

export const KeyboardHelpPanel: React.FC<KeyboardHelpPanelProps> = ({
  isOpen,
  onClose,
  shortcuts = [],
}) => {
  const { t } = useI18n();
  const { getHelpContent, formatShortcut } = useKeyboardHelp(shortcuts);

  const helpContent = getHelpContent();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">{t('键盘快捷键')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('关闭')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          <div className="p-4 space-y-6">
            {helpContent.map((section) => (
              <div key={section.category}>
                <h3 className="font-medium text-foreground mb-2">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 bg-muted rounded"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-semibold bg-background border border-border rounded">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {shortcuts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t('暂无快捷键')}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            {t('按下 Esc 键或点击遮罩层关闭此面板')}
          </p>
        </div>
      </div>
    </div>
  );
};
