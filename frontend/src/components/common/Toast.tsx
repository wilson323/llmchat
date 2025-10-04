/**
 * Toast 通知组件
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
};

const iconColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  const Icon = icons[type];

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 min-w-[300px] max-w-md
        transform transition-all duration-300 ease-out
        ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div
        className={`
          flex items-start gap-3 p-4 rounded-lg border shadow-lg
          ${colors[type]}
        `}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[type]}`} />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={handleClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Toast 容器管理
class ToastManager {
  private toasts: Map<string, ToastProps> = new Map();
  private listeners: Set<(toasts: ToastProps[]) => void> = new Set();

  show(toast: Omit<ToastProps, 'onClose'>) {
    const id = Date.now().toString();
    this.toasts.set(id, {
      ...toast,
      onClose: () => this.remove(id),
    });
    this.notify();

    return id;
  }

  remove(id: string) {
    this.toasts.delete(id);
    this.notify();
  }

  subscribe(listener: (toasts: ToastProps[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const toasts = Array.from(this.toasts.values());
    this.listeners.forEach(listener => listener(toasts));
  }
}

export const toastManager = new ToastManager();

// Hook for using toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts);
    return () => unsubscribe();
  }, []);

  return {
    toasts,
    showToast: (toast: Omit<ToastProps, 'onClose'>) => toastManager.show(toast),
    success: (message: string) => toastManager.show({ message, type: 'success' }),
    error: (message: string) => toastManager.show({ message, type: 'error' }),
    warning: (message: string) => toastManager.show({ message, type: 'warning' }),
    info: (message: string) => toastManager.show({ message, type: 'info' }),
  };
};

// Toast Container Component
export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <Toast key={index} {...toast} />
      ))}
    </div>
  );
};
