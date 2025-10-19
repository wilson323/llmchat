
import * as React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type {
  ToastType as IToastType,
  ToastOptions as IToastOptions,
  ToastItem as IToastItem,
  ToastState as IToastState,
  BaseComponentProps,
} from './ui.types';

// Toast变体配置
const toastVariants = cva(
  'pointer-events-auto w-[320px] rounded-xl border shadow-lg bg-background/95 backdrop-blur-xl p-3',
  {
    variants: {
      variant: {
        success: 'border-emerald-200/40 dark:border-emerald-800/40',
        error: 'border-red-200/40 dark:border-red-800/40',
        warning: 'border-amber-200/40 dark:border-amber-800/40',
        info: 'border-blue-200/40 dark:border-blue-800/40',
        default: 'border-border/50',
      },
      position: {
        'top-right': 'fixed top-3 right-3 z-[100]',
        'top-left': 'fixed top-3 left-3 z-[100]',
        'bottom-right': 'fixed bottom-3 right-3 z-[100]',
        'bottom-left': 'fixed bottom-3 left-3 z-[100]',
        'top-center': 'fixed top-3 left-1/2 -translate-x-1/2 z-[100]',
        'bottom-center': 'fixed bottom-3 left-1/2 -translate-x-1/2 z-[100]',
      },
    },
    defaultVariants: {
      variant: 'default',
      position: 'top-right',
    },
  },
);

// Toast类型扩展
export type ToastType = IToastType;

// Toast选项扩展
export interface ToastOptions {
  /** Toast 类型 */
  type?: ToastType;
  /** Toast 标题 */
  title?: string;
  /** Toast 描述 */
  description?: string;
  /** Toast 位置 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Toast 持续时间（毫秒） */
  duration?: number;
  /** 是否可关闭 */
  closable?: boolean;
  /** Toast 操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  };
  /** Toast 图标 */
  icon?: React.ReactNode;
  /** 自定义渲染函数 */
  render?: (toast: ToastItem) => React.ReactNode;
  /** 是否在挂载时显示 */
  showWhenMounted?: boolean;
}

// Toast项接口（用于状态管理）
export interface ToastItem {
  /** Toast ID */
  id: string;
  /** Toast 类型 */
  type: ToastType;
  /** Toast 标题 */
  title?: string;
  /** Toast 描述 */
  description?: string;
  /** Toast 位置 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Toast 持续时间（毫秒） */
  duration?: number;
  /** 是否可关闭 */
  closable?: boolean;
  /** Toast 操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  };
  /** Toast 图标 */
  icon?: React.ReactNode;
  /** 自定义渲染函数 */
  render?: (toast: ToastItem) => React.ReactNode;
  /** 创建时间（时间戳） */
  createdAt: number;
  /** 是否正在悬停 */
  isPaused?: boolean;
}

// Toast状态接口
export interface ToastState {
  /** Toast列表 */
  toasts: ToastItem[];
  /** 添加Toast */
  add: (toast: ToastItem) => void;
  /** 移除Toast */
  remove: (id: string) => void;
  /** 暂停计时器 */
  pauseTimer: (id: string) => void;
  /** 恢复计时器 */
  resumeTimer: (id: string) => void;
  /** 清空所有 */
  clear: () => void;
  /** 设置位置 */
  setPosition: (position: string) => void;
  /** 获取指定位置的Toasts */
  getToastsByPosition: (position: string) => ToastItem[];
  /** 获取当前状态 */
  getState: () => ToastState;
}

// Toast组件Props
export interface ToastProps extends BaseComponentProps {
  /** Toast项 */
  toast: ToastItem;
  /** 关闭回调 */
  onClose?: (id: string) => void;
  /** 位置 */
  position?: string;
}

// ToastProviderProps
export interface ToastProviderProps extends BaseComponentProps {
  /** 位置 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** 最大显示数量 */
  maxToasts?: number;
  /** 是否可拖拽关闭 */
  swipeToClose?: boolean;
}

// 生成唯一ID
const genId = () => Math.random().toString(36).slice(2);

// Toast store
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  add: (toast) => set((state) => {
    const newToasts = [...state.toasts, toast];
    return { toasts: newToasts };
  }),
  remove: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
  pauseTimer: (id) => set((state) => ({
    toasts: state.toasts.map((t) => (t.id === id ? { ...t, isPaused: true } : t)),
  })),
  resumeTimer: (id) => set((state) => ({
    toasts: state.toasts.map((t) => (t.id === id ? { ...t, isPaused: false } : t)),
  })),
  clear: () => set({ toasts: [] }),
  setPosition: (position) => set((state) => ({
    toasts: state.toasts.map((t) => ({ ...t, position: position as ToastItem['position'] })),
  })),
  getToastsByPosition: (position) => get().toasts.filter((t) => t.position === position),
  getState: () => get(),
}));

// Toast hook
export const useToast = () => {
  const store = useToastStore();

  const toast = React.useCallback((options: ToastOptions | string) => {
    const id = genId();
    const opts = typeof options === 'string' ? { title: options } : options;

    const item: ToastItem = {
      id,
      type: opts.type || 'info',
      title: opts.title || '',
      description: opts.description || '',
      duration: opts.duration || 3000,
      icon: opts.icon,
      closable: opts.closable !== false,
      action: opts.action,
      render: opts.render,
      position: opts.position || 'top-right',
      createdAt: Date.now(),
      isPaused: false,
    };

    store.add(item);

    // 自动关闭
    if ((item.duration ?? 3000) > 0) {
      const timer = setTimeout(() => {
        store.remove(id);
      }, item.duration || 3000);

      return () => clearTimeout(timer);
    }

    return id;
  }, [store]);

  const dismiss = React.useCallback((id: string) => {
    store.remove(id);
  }, [store]);

  const success = React.useCallback((options: Omit<ToastOptions, 'type'> | string) => {
    return toast({ ...(typeof options === 'string' ? { title: options } : options), type: 'success' });
  }, [toast]);

  const error = React.useCallback((options: Omit<ToastOptions, 'type'> | string) => {
    return toast({ ...(typeof options === 'string' ? { title: options } : options), type: 'error' });
  }, [toast]);

  const warning = React.useCallback((options: Omit<ToastOptions, 'type'> | string) => {
    return toast({ ...(typeof options === 'string' ? { title: options } : options), type: 'warning' });
  }, [toast]);

  const info = React.useCallback((options: Omit<ToastOptions, 'type'> | string) => {
    return toast({ ...(typeof options === 'string' ? { title: options } : options), type: 'info' });
  }, [toast]);

  return {
    toast,
    dismiss,
    success,
    error,
    warning,
    info,
    clear: store.clear,
  };
};

// Toast组件
const ToastComponent = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ toast, onClose, position, className, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout>();
    const remainingTimeRef = React.useRef(toast.duration);

    React.useEffect(() => {
      if ((toast.duration ?? 3000) <= 0) return;

      const startTime = Date.now();
        remainingTimeRef.current = toast.duration || 3000;

      timeoutRef.current = setTimeout(() => {
        if (!isHovered) {
          onClose?.(toast.id);
        }
      }, remainingTimeRef.current);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [toast.duration, onClose, isHovered]);

    const handleMouseEnter = React.useCallback(() => {
      setIsHovered(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        remainingTimeRef.current = Math.max(0, (remainingTimeRef.current ?? 0) - (Date.now() - toast.createdAt));
      }
    }, [toast.createdAt]);

    const handleMouseLeave = React.useCallback(() => {
      setIsHovered(false);
      if ((remainingTimeRef.current ?? 0) > 0) {
        timeoutRef.current = setTimeout(() => {
          onClose?.(toast.id);
        }, remainingTimeRef.current);
      }
    }, [onClose]);

    const handleClose = React.useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onClose?.(toast.id);
    }, [onClose, toast.id]);

    // 使用自定义渲染函数
    if (toast.render) {
      return (
        <div
          ref={ref}
          className={className}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...props}
        >
          {toast.render(toast)}
        </div>
      );
    }

    // 默认图标
    const defaultIcon = React.useMemo(() => {
      switch (toast.type) {
        case 'success':
          return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        case 'error':
          return <AlertTriangle className="w-5 h-5 text-red-500" />;
        case 'warning':
          return <AlertTriangle className="w-5 h-5 text-amber-500" />;
        case 'info':
          return <Info className="w-5 h-5 text-blue-500" />;
        default:
          return <Info className="w-5 h-5 text-blue-500" />;
      }
    }, [toast.type]);

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          toastVariants({ variant: toast.type, position: (position || toast.position) as ToastItem['position'] }),
          className
        )}
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-labelledby={`toast-title-${toast.id}`}
        aria-describedby={toast.description ? `toast-desc-${toast.id}` : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="mt-0.5 shrink-0" aria-hidden="true">
            {toast.icon || defaultIcon}
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <div
                id={`toast-title-${toast.id}`}
                className="text-sm font-medium text-foreground truncate"
              >
                {toast.title}
              </div>
            )}
            {toast.description && (
              <div
                id={`toast-desc-${toast.id}`}
                className="mt-0.5 text-xs text-muted-foreground line-clamp-3"
              >
                {toast.description}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleClose();
              }}
              className={cn(
                'shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                toast.action.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {toast.action.label}
            </button>
          )}

          {/* 关闭按钮 */}
          {toast.closable !== false && (
            <button
              onClick={handleClose}
              className="shrink-0 rounded-md p-1 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
              aria-label={`关闭通知：${toast.title}`}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }
);
ToastComponent.displayName = 'Toast';

// 为ToastProvider添加Toast子组件（在组件定义之前添加）
const ToastProviderWithSubComponent: React.FC<ToastProviderProps> & {
  Toast: typeof ToastComponent;
} = Object.assign(
  ({ position = 'top-right', maxToasts = 5, swipeToClose = false, className, ...props }: ToastProviderProps) => {
    const { getToastsByPosition } = useToastStore();
    const toasts = getToastsByPosition(position);

    // 限制显示数量
    const visibleToasts = React.useMemo(
      () => toasts.slice(-maxToasts),
      [toasts, maxToasts]
    );

    const handleDismiss = React.useCallback((id: string) => {
      useToastStore.getState().remove(id);
    }, []);

    return (
      <div
        className={cn(
          'fixed z-[100] flex flex-col gap-2 p-4 pointer-events-none',
          position.includes('top') ? 'top-0' : 'bottom-0',
          position.includes('right') ? 'right-0' : position.includes('left') ? 'left-0' : 'left-1/2 -translate-x-1/2',
          position.includes('center') && !position.includes('left') && !position.includes('right') && '-translate-x-1/2',
          className
        )}
        {...props}
      >
        <AnimatePresence>
          {visibleToasts.map((toast) => (
            <ToastProviderWithSubComponent.Toast
              key={toast.id}
              toast={toast}
              onClose={handleDismiss}
              position={position}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  },
  {
    Toast: ToastComponent,
  }
);

// ToastProvider组件
export const ToastProvider = ToastProviderWithSubComponent;

// 创建toast实例
const createToast = (options: ToastOptions | string): string => {
  const id = genId();
  const opts = typeof options === 'string' ? { title: options } : options;

  const item: ToastItem = {
    id,
    type: opts.type || 'info',
    title: opts.title || '',
    description: opts.description || '',
    duration: opts.duration || 3000,
    icon: opts.icon,
    closable: opts.closable !== false,
    action: opts.action,
    render: opts.render,
    position: opts.position || 'top-right',
    createdAt: Date.now(),
    isPaused: false,
  };

  // 直接使用store的add方法
  useToastStore.getState().add(item);

  // 自动关闭
  if ((item.duration || 3000) > 0) {
    const timer = setTimeout(() => {
      useToastStore.getState().remove(id);
    }, item.duration || 3000);

    return () => clearTimeout(timer);
  }

  return id;
};

// 全局toast函数
export const toast = createToast;

// 便捷函数
export const toastSuccess = (options: Omit<ToastOptions, 'type'> | string) => {
  return createToast({ ...(typeof options === 'string' ? { title: options } : options), type: 'success' });
};

export const toastError = (options: Omit<ToastOptions, 'type'> | string) => {
  return createToast({ ...(typeof options === 'string' ? { title: options } : options), type: 'error' });
};

export const toastWarning = (options: Omit<ToastOptions, 'type'> | string) => {
  return createToast({ ...(typeof options === 'string' ? { title: options } : options), type: 'warning' });
};

export const toastInfo = (options: Omit<ToastOptions, 'type'> | string) => {
  return createToast({ ...(typeof options === 'string' ? { title: options } : options), type: 'info' });
};

// Toaster组件导出 - 提供统一导出接口
export const Toaster = ToastProvider;

// 导出（所有类型已在定义处使用 export 关键字导出）
export default ToastProvider;
// 已在定义处 export，无需重复导出
