import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title?: string;
  description?: string;
  duration?: number; // ms
}

interface ToastItem extends Required<Omit<ToastOptions, 'duration'>> {
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  add: (t: ToastItem) => void;
  remove: (id: string) => void;
}

const genId = () => Math.random().toString(36).slice(2);

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(opts: ToastOptions | string) {
  const id = genId();
  const o = typeof opts === 'string' ? { title: opts } : opts || {};
  const item: ToastItem = {
    id,
    type: (o.type ?? 'info') as ToastType,
    title: o.title ?? '',
    description: o.description ?? '',
    duration: typeof o.duration === 'number' ? o.duration : 3000,
  };
  useToastStore.getState().add(item);
  // auto dismiss
  window.setTimeout(() => useToastStore.getState().remove(id), item.duration + 100);
  return id;
}

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <>
      {/* 可访问性通知区域 - 屏幕阅读器专用 */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {toasts.map(t => (
          <div key={`a11y-${t.id}`}>
            {t.type === 'error' ? '错误：' : t.type === 'warning' ? '警告：' : t.type === 'success' ? '成功：' : '信息：'}
            {t.title}
            {t.description && `，${t.description}`}
          </div>
        ))}
      </div>

      {/* 错误通知 - 使用 assertive 确保立即通知 */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {toasts.filter(t => t.type === 'error').map(t => (
          <div key={`error-${t.id}`}>
            错误：{t.title}
            {t.description && `，${t.description}`}
          </div>
        ))}
      </div>

      {/* 视觉Toast显示区域 */}
      <div className="pointer-events-none fixed top-3 right-3 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`pointer-events-auto w-[320px] rounded-xl border shadow-lg bg-background/95 backdrop-blur-xl ${
                t.type === 'success' ? 'border-emerald-200/40' : t.type === 'error' ? 'border-red-200/40' : t.type === 'warning' ? 'border-amber-200/40' : 'border-border/50'
              }`}
              role={t.type === 'error' ? 'alert' : 'status'}
              aria-labelledby={`toast-title-${t.id}`}
              aria-describedby={t.description ? `toast-desc-${t.id}` : undefined}
            >
              <div className="p-3 flex items-start gap-3">
                <div className="mt-0.5" aria-hidden="true">
                  {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {t.type === 'info' && <Info className="w-5 h-5 text-[var(--brand)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <div
                      id={`toast-title-${t.id}`}
                      className="text-sm font-medium text-foreground truncate"
                    >
                      {t.title}
                    </div>
                  )}
                  {t.description && (
                    <div
                      id={`toast-desc-${t.id}`}
                      className="mt-0.5 text-xs text-muted-foreground line-clamp-3"
                    >
                      {t.description}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="shrink-0 rounded-md p-1 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
                  aria-label={`关闭通知：${t.title}`}
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

