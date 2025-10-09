import React, { useEffect, useRef } from 'react';

interface A11yAnnouncerProps {
  message?: string;
  politeness?: 'polite' | 'assertive';
  timeout?: number;
}

/**
 * 无障碍通知组件 - 为屏幕阅读器提供实时内容更新通知
 * 支持aria-live区域，确保动态内容变化能被辅助技术用户感知
 */
export const A11yAnnouncer: React.FC<A11yAnnouncerProps> = ({
  message = '',
  politeness = 'polite',
  timeout = 0
}) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (message) {
      // 清除之前的定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 如果设置了超时，在指定时间后清空消息
      if (timeout > 0) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = undefined;
        }, timeout);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, timeout]);

  return (
    <>
      {/* 主要通知区域 - 用于重要状态变化 */}
      <div
        aria-live={politeness}
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {message}
      </div>

      {/* 专门的流式响应状态通知 */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
        role="status"
        id="streaming-status-announcer"
      />

      {/* 错误和警告通知 */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
        id="error-announcer"
      />

      {/* 页面导航状态通知 */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
        id="navigation-announcer"
      />
    </>
  );
};

/**
 * 使用示例hook - 简化可访问性通知的使用
 */
export const useA11yAnnouncer = () => {
  const announceMessage = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById(
      politeness === 'assertive' ? 'error-announcer' : 'navigation-announcer'
    );

    if (announcer) {
      announcer.textContent = message;

      // 清空消息，避免重复播报
      setTimeout(() => {
        announcer.textContent = '';
      }, 100);
    }
  };

  const announceStreamingStatus = (moduleName: string, status: string) => {
    const announcer = document.getElementById('streaming-status-announcer');
    if (announcer) {
      const statusText = status === 'running'
        ? `正在执行${moduleName}`
        : status === 'completed'
        ? `${moduleName}执行完成`
        : `${moduleName}执行出错`;

      announcer.textContent = statusText;
    }
  };

  const announceNavigation = (action: string, target: string) => {
    announceMessage(`${action}${target}`);
  };

  const announceError = (error: string) => {
    announceMessage(`错误：${error}`, 'assertive');
  };

  return {
    announceMessage,
    announceStreamingStatus,
    announceNavigation,
    announceError
  };
};