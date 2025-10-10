import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface DialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  initialFocus?: 'confirm' | 'cancel' | 'close';
  children?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  onConfirm,
  onClose,
  initialFocus = 'confirm',
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const resolvedTitle = title ?? t('确认操作');
  const resolvedConfirm = confirmText ?? t('确认');
  const resolvedCancel = cancelText ?? t('取消');

  // 确定初始焦点元素
  const getInitialFocusElement = (): HTMLElement | null => {
    switch (initialFocus) {
      case 'confirm':
        return confirmButtonRef.current;
      case 'cancel':
        return cancelButtonRef.current;
      case 'close':
        return closeButtonRef.current;
      default:
        return confirmButtonRef.current;
    }
  };

  // 使用焦点捕获
  useFocusTrap({
    container: dialogRef.current,
    initialFocus: getInitialFocusElement(),
    onEscape: onClose,
    enabled: open,
  });

  // 处理键盘事件
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Enter键确认
      if (event.key === 'Enter' && !event.shiftKey) {
        const activeElement = document.activeElement as HTMLElement;

        // 如果焦点在输入框内，不处理Enter键
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
          return;
        }

        onConfirm?.();
      }

      // 空格键激活当前焦点按钮
      if (event.key === ' ' && event.target instanceof HTMLElement) {
        const target = event.target;
        if (target.tagName === 'BUTTON' || target.role === 'button') {
          event.preventDefault();
          target.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onConfirm]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 cursor-pointer"
        onClick={onClose}
        aria-label="关闭对话框"
        role="button"
        tabIndex={-1}
      />

      {/* 对话框主体 */}
      <div
        ref={dialogRef}
        className="relative z-[61] w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        tabIndex={-1}
      >
        {/* 关闭按钮 */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
          aria-label="关闭对话框"
          type="button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-4 sm:p-5">
          {/* 标题 */}
          <div
            id="dialog-title"
            className="text-base font-semibold text-foreground pr-8"
          >
            {resolvedTitle}
          </div>

          {/* 描述 */}
          {description && (
            <div
              id="dialog-description"
              className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap"
            >
              {description}
            </div>
          )}

          {/* 按钮组 */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              ref={cancelButtonRef}
              variant="secondary"
              size="md"
              radius="md"
              onClick={onClose}
              className="min-w-[84px]"
              type="button"
            >
              {resolvedCancel}
            </Button>
            <Button
              ref={confirmButtonRef}
              variant={destructive ? 'destructive' : 'brand'}
              size="md"
              radius="md"
              onClick={() => onConfirm?.()}
              className="min-w-[84px]"
              type="button"
            >
              {resolvedConfirm}
            </Button>
          </div>

          {/* 键盘提示 */}
          <div className="mt-3 text-xs text-muted-foreground text-center">
            按 Esc 关闭，Enter 确认
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
