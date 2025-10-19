/**
 * useErrorHandler Hook单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';
import { logger } from '@/lib/logger';

// Mock logger
vi.mock('@/lib/logger', () => {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  
  return {
    logger: mockLogger,
  };
});

describe('useErrorHandler', () => {
  beforeEach(() => {
    // 清空所有mock调用
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复所有mock
    vi.restoreAllMocks();
  });

  describe('handleApiError', () => {
    it('应该记录API错误日志', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('API请求失败');
      
      act(() => {
        result.current.handleApiError(error, { url: '/api/test', method: 'GET' });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        'API请求失败',
        error,
        { url: '/api/test', method: 'GET' }
      );
    });

    it('应该处理非Error对象的错误', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = '字符串错误';
      
      act(() => {
        result.current.handleApiError(error, { url: '/api/test' });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        'API请求失败',
        expect.any(Error),
        { url: '/api/test' }
      );
    });
  });

  describe('handleValidationError', () => {
    it('应该记录验证错误日志', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('表单验证失败');
      
      act(() => {
        result.current.handleValidationError(error, { field: 'username' });
      });
      
      expect(logger.warn).toHaveBeenCalledWith(
        '表单验证失败',
        error,
        { field: 'username' }
      );
    });

    it('应该处理非Error对象的验证错误', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = { message: '验证错误' };
      
      act(() => {
        result.current.handleValidationError(error, { field: 'username' });
      });
      
      expect(logger.warn).toHaveBeenCalledWith(
        '表单验证失败',
        expect.any(Error),
        { field: 'username' }
      );
    });
  });

  describe('handleGenericError', () => {
    it('应该记录通用错误日志', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('通用错误');
      
      act(() => {
        result.current.handleGenericError(error, { operation: 'test-operation' });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '操作失败',
        error,
        { operation: 'test-operation' }
      );
    });

    it('应该处理非Error对象的通用错误', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = '未知错误';
      
      act(() => {
        result.current.handleGenericError(error, { operation: 'test-operation' });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '操作失败',
        expect.any(Error),
        { operation: 'test-operation' }
      );
    });
  });

  describe('handleAsyncError', () => {
    it('应该忽略AbortError错误', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('操作已取消');
      error.name = 'AbortError';
      
      act(() => {
        result.current.handleAsyncError(error, { operation: 'test-operation' });
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '操作已取消',
        { operation: 'test-operation' }
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('应该记录非AbortError的异步错误', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('异步操作失败');
      
      act(() => {
        result.current.handleAsyncError(error, { operation: 'test-operation' });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '异步操作失败',
        error,
        { operation: 'test-operation' }
      );
    });

    it('应该处理非Error对象的异步错误', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = '异步错误';
      
      act(() => {
        result.current.handleAsyncError(error, { operation: 'test-operation' });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '异步操作失败',
        expect.any(Error),
        { operation: 'test-operation' }
      );
    });
  });
});