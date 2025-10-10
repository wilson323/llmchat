import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface SessionSwitchingFeedbackProps {
  isLoading: boolean;
  success?: boolean;
  error?: boolean;
  message?: string;
  duration?: number;
}

/**
 * 会话切换反馈组件
 * 提供加载状态、成功和错误反馈
 */
export const SessionSwitchingFeedback: React.FC<SessionSwitchingFeedbackProps> = ({
  isLoading,
  success,
  error,
  message,
  duration = 2000,
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (success && !isLoading) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), duration);
      return () => clearTimeout(timer);
    }
  }, [success, isLoading, duration]);

  useEffect(() => {
    if (error && !isLoading) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), duration);
      return () => clearTimeout(timer);
    }
  }, [error, isLoading, duration]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-lg shadow-lg backdrop-blur-sm"
          >
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span className="text-sm text-foreground">切换会话中...</span>
          </motion.div>
        )}

        {showSuccess && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/30 rounded-lg shadow-lg backdrop-blur-sm"
          >
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-foreground">
              {message || '会话切换成功'}
            </span>
          </motion.div>
        )}

        {showError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="flex items-center gap-3 px-4 py-3 bg-error/10 border border-error/30 rounded-lg shadow-lg backdrop-blur-sm"
          >
            <AlertCircle className="w-4 h-4 text-error" />
            <span className="text-sm text-foreground">
              {message || '会话切换失败'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * 会话加载骨架屏组件
 */
export const SessionSkeleton: React.FC = () => {
  return (
    <div className="flex-1 space-y-4 animate-pulse">
      {/* 标题骨架 */}
      <div className="h-6 bg-muted rounded w-3/4" />

      {/* 消息骨架 */}
      <div className="space-y-3">
        {/* 用户消息骨架 */}
        <div className="flex justify-end">
          <div className="max-w-[80%] space-y-2">
            <div className="h-4 bg-muted rounded w-16 ml-auto" />
            <div className="bg-brand-500 rounded-2xl px-4 py-3">
              <div className="h-4 bg-brand-400 rounded w-32" />
              <div className="h-4 bg-brand-400 rounded w-24 mt-1" />
            </div>
          </div>
        </div>

        {/* AI回复骨架 */}
        <div className="flex justify-start">
          <div className="max-w-[80%] space-y-2">
            <div className="h-4 bg-muted rounded w-16" />
            <div className="bg-card rounded-2xl px-4 py-3 border border-border">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};