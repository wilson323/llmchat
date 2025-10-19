import { useCallback } from 'react';
import { logger } from '@/lib/logger';

/**
 * 统一的错误处理Hook
 * 提供一致的错误处理机制，包括日志记录和用户反馈
 */
export function useErrorHandler() {
  /**
   * 处理API错误
   */
  const handleApiError = useCallback((error: unknown, context?: Record<string, unknown>) => {
    // 记录错误日志
    logger.error('API请求失败', error instanceof Error ? error : new Error(String(error)), context);
    
    // 可以在这里添加用户反馈逻辑
    // 例如显示Toast通知等
  }, []);

  /**
   * 处理表单验证错误
   */
  const handleValidationError = useCallback((error: unknown, context?: Record<string, unknown>) => {
    // 记录验证错误日志
    logger.warn('表单验证失败', error instanceof Error ? error : new Error(String(error)), context);
    
    // 可以在这里添加用户反馈逻辑
    // 例如显示表单错误信息等
  }, []);

  /**
   * 处理通用错误
   */
  const handleGenericError = useCallback((error: unknown, context?: Record<string, unknown>) => {
    // 记录通用错误日志
    logger.error('操作失败', error instanceof Error ? error : new Error(String(error)), context);
    
    // 可以在这里添加用户反馈逻辑
  }, []);

  /**
   * 处理异步操作错误
   */
  const handleAsyncError = useCallback((error: unknown, context?: Record<string, unknown>) => {
    // 检查是否为取消错误（如AbortError）
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('操作已取消', context);
      return;
    }
    
    // 记录异步操作错误日志
    logger.error('异步操作失败', error instanceof Error ? error : new Error(String(error)), context);
  }, []);

  return {
    handleApiError,
    handleValidationError,
    handleGenericError,
    handleAsyncError,
  };
}