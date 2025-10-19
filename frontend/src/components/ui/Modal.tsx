import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { useI18n } from '@/i18n';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type {
  ModalProps as IModalProps,
  ForwardRefComponent,
} from './ui.types';
import { createSubComponent, attachSubComponents } from './ui.types';

// Modal变体配置
const modalVariants = cva(
  'relative z-[60] w-full max-w-sm mx-4 rounded-2xl border bg-card shadow-2xl outline-none',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        full: 'max-w-full mx-4',
      },
      position: {
        center: 'flex items-center justify-center',
        top: 'flex items-start justify-center pt-[10vh]',
        bottom: 'flex items-end justify-center pb-[10vh]',
      },
    },
    defaultVariants: {
      size: 'md',
      position: 'center',
    },
  },
);

// 扩展ModalProps接口
export interface ModalProps
  extends IModalProps,
    VariantProps<typeof modalVariants> {
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 关闭图标 */
  closeIcon?: React.ReactNode;
  /** 确认按钮Props */
  confirmButtonProps?: React.ComponentProps<typeof Button>;
  /** 取消按钮Props */
  cancelButtonProps?: React.ComponentProps<typeof Button>;
  /** 自定义头部 */
  header?: React.ReactNode;
  /** 自定义底部 */
  footer?: React.ReactNode;
  /** 渲染函数 */
  renderFooter?: () => React.ReactNode;
  /** 确认前回调 */
  onBeforeConfirm?: () => boolean | Promise<boolean>;
  /** 关闭前回调 */
  onBeforeClose?: () => boolean | Promise<boolean>;
  /** 键盘事件处理 */
  onEscapeKey?: () => void;
  /** onEnterKey?: () => void; */
}

// ModalContext
interface ModalContextType {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

const ModalContext = React.createContext<ModalContextType | undefined>(undefined);

// ModalProvider组件
const ModalProvider: React.FC<{
  children: React.ReactNode;
  value: ModalContextType;
}> = ({ children, value }) => (
  <ModalContext.Provider value={value}>
    {children}
  </ModalContext.Provider>
);

// useContext hook
const useModalContext = () => {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error('Modal components must be used within a Modal component');
  }
  return context;
};

// Modal.Header组件
interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, children, ...props }, ref) => {
    const { onClose } = useModalContext();

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between p-4 sm:p-5 border-b border-border',
          className
        )}
        {...props}
      >
        <div className="flex-1">{children}</div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="shrink-0 ml-2"
          aria-label="关闭对话框"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>
    );
  }
);
ModalHeader.displayName = 'Modal.Header';

// Modal.Title组件
interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn(
        'text-lg font-semibold text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </h2>
  )
);
ModalTitle.displayName = 'Modal.Title';

// Modal.Content组件
interface ModalContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-4 sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  )
);
ModalContent.displayName = 'Modal.Content';

// Modal.Footer组件
interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ModalFooter.displayName = 'Modal.Footer';

// 主Modal组件
const ModalImpl = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      children,
      open,
      title,
      description,
      confirmText,
      cancelText,
      destructive = false,
      closable = true,
      closeIcon,
      mask = true,
      maskClosable = true,
      keyboard = true,
      centered = true,
      width,
      size,
      position,
      onConfirm,
      onClose,
      onBeforeConfirm,
      onBeforeClose,
      onEscapeKey,
      confirmButtonProps,
      cancelButtonProps,
      header,
      footer,
      renderFooter,
      initialFocus = 'confirm',
      className,
      ...props
    },
    ref
  ) => {
    const { t } = useI18n();
    const [loading, setLoading] = React.useState(false);

    // Refs
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
    const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
    const closeButtonRef = React.useRef<HTMLButtonElement>(null);

    // 合并ref
    React.useImperativeHandle(ref, () => dialogRef.current!);

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

    // 处理确认
    const handleConfirm = React.useCallback(async () => {
      if (loading) return;

      try {
        setLoading(true);

        // 执行确认前回调
        if (onBeforeConfirm) {
          const canProceed = await onBeforeConfirm();
          if (!canProceed) {
            setLoading(false);
            return;
          }
        }

        // 执行确认
        await onConfirm?.();
        handleClose();
      } catch (error) {
        console.error('Modal confirm error:', error);
      } finally {
        setLoading(false);
      }
    }, [loading, onBeforeConfirm, onConfirm]);

    // 处理关闭
    const handleClose = React.useCallback(async () => {
      if (loading) return;

      try {
        // 执行关闭前回调
        if (onBeforeClose) {
          const canProceed = await onBeforeClose();
          if (!canProceed) return;
        }

        onClose?.();
      } catch (error) {
        console.error('Modal close error:', error);
      }
    }, [loading, onBeforeClose, onClose]);

    // 处理遮罩点击
    const handleMaskClick = React.useCallback(
      (e: React.MouseEvent) => {
        if (maskClosable && e.target === e.currentTarget) {
          handleClose();
        }
      },
      [maskClosable, handleClose]
    );

    // 键盘事件处理
    React.useEffect(() => {
      if (!open || !keyboard) return;

      const handleKeyDown = async (event: KeyboardEvent) => {
        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            if (onEscapeKey) {
              onEscapeKey();
            } else {
              handleClose();
            }
            break;
          case 'Enter':
            if (!event.shiftKey) {
              const activeElement = document.activeElement as HTMLElement;
              if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                return;
              }
              event.preventDefault();
              handleConfirm();
            }
            break;
          case ' ':
            if (event.target instanceof HTMLElement) {
              const target = event.target;
              if (target.tagName === 'BUTTON' || target.role === 'button') {
                event.preventDefault();
                target.click();
              }
            }
            break;
        }
      };

      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [open, keyboard, handleConfirm, handleClose, onEscapeKey]);

    // 焦点捕获
    useFocusTrap({
      container: dialogRef.current,
      initialFocus: getInitialFocusElement(),
      onEscape: keyboard ? handleClose : undefined,
      enabled: open,
    });

    // 处理滚动锁定
    React.useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }

      return () => {
        document.body.style.overflow = '';
      };
    }, [open]);

    // Context值
    const contextValue = React.useMemo(
      () => ({
        isOpen: open,
        onClose: handleClose,
        onConfirm: handleConfirm,
        loading,
      }),
      [open, handleClose, handleConfirm, loading]
    );

    // 解析文本
    const resolvedTitle = title || t('确认操作');
    const resolvedConfirm = confirmText || t('确认');
    const resolvedCancel = cancelText || t('取消');

    // 自定义样式
    const customStyle = React.useMemo(() => {
      if (width) {
        return { width: typeof width === 'number' ? `${width}px` : width };
      }
      return {};
    }, [width]);

    // 计算位置类名
    const positionClassName = React.useMemo(() => {
      if (centered) return 'flex items-center justify-center';
      return modalVariants({ position }).split(' ')[1];
    }, [centered, position]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-[60]">
        {/* 遮罩层 */}
        {mask && (
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleMaskClick}
            aria-hidden="true"
          />
        )}

        {/* Modal容器 */}
        <div className={cn('flex min-h-full items-center', positionClassName)}>
          <div
            ref={dialogRef}
            className={cn(modalVariants({ size }), customStyle, className)}
            style={customStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby={description ? 'modal-description' : undefined}
            tabIndex={-1}
            {...props}
          >
            <ModalProvider value={contextValue}>
              {/* 自定义头部 */}
              {header ? (
                header
              ) : (
                title && (
                  <ModalHeader>
                    <ModalTitle id="modal-title">{resolvedTitle}</ModalTitle>
                    {closable && (
                      <Button
                        ref={closeButtonRef}
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleClose}
                        aria-label="关闭对话框"
                      >
                        {closeIcon || (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                      </Button>
                    )}
                  </ModalHeader>
                )
              )}

              {/* 描述内容 */}
              {description && (
                <ModalContent>
                  <div
                    id="modal-description"
                    className="text-sm text-muted-foreground whitespace-pre-wrap"
                  >
                    {description}
                  </div>
                </ModalContent>
              )}

              {/* 子内容 */}
              {children && <ModalContent>{children}</ModalContent>}

              {/* 自定义底部 */}
              {footer ? (
                footer
              ) : renderFooter ? (
                <ModalFooter>{renderFooter()}</ModalFooter>
              ) : (
                <ModalFooter>
                  <Button
                    ref={cancelButtonRef}
                    variant="secondary"
                    onClick={handleClose}
                    disabled={loading}
                    {...cancelButtonProps}
                  >
                    {resolvedCancel}
                  </Button>
                  <Button
                    ref={confirmButtonRef}
                    variant={destructive ? 'destructive' : 'primary'}
                    onClick={handleConfirm}
                    loading={loading}
                    {...confirmButtonProps}
                  >
                    {resolvedConfirm}
                  </Button>
                </ModalFooter>
              )}

              {/* 键盘提示 */}
              <div className="px-4 pb-2 text-xs text-muted-foreground text-center">
                按 Esc 关闭，Enter 确认
              </div>
            </ModalProvider>
          </div>
        </div>
      </div>
    );
  }
);

ModalImpl.displayName = 'Modal';

// 创建子组件
const ModalHeaderComponent = createSubComponent('Modal.Header', ModalHeader);
const ModalTitleComponent = createSubComponent('Modal.Title', ModalTitle);
const ModalContentComponent = createSubComponent('Modal.Content', ModalContent);
const ModalFooterComponent = createSubComponent('Modal.Footer', ModalFooter);

// 附加子组件

const Modal = attachSubComponents(ModalImpl, {
  Header: ModalHeaderComponent,
  Title: ModalTitleComponent,
  Content: ModalContentComponent,
  Footer: ModalFooterComponent,
});

// 创建Modal组件类型
export type ModalComponent = ForwardRefComponent<HTMLDivElement, ModalProps> & {
  Header: typeof ModalHeaderComponent;
  Title: typeof ModalTitleComponent;
  Content: typeof ModalContentComponent;
  Footer: typeof ModalFooterComponent;
};

// 导出
export default Modal as ModalComponent;
export { ModalHeader, ModalTitle, ModalContent, ModalFooter };