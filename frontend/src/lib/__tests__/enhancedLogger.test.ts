/**
 * 增强版Logger工具单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhancedLogger } from '../enhancedLogger';
import { logger } from '../logger';

// Mock基础logger
vi.mock('../logger', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    performance: vi.fn(),
    apiRequest: vi.fn(),
    userAction: vi.fn(),
  };
  
  return {
    logger: mockLogger,
    LogLevel: {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
    },
  };
});

describe('EnhancedLogger', () => {
  beforeEach(() => {
    // 清空所有mock调用
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复所有mock
    vi.restoreAllMocks();
  });

  describe('用户行为日志', () => {
    it('应该记录用户行为并包含用户代理信息', () => {
      enhancedLogger.userAction('点击按钮', { component: 'TestButton' });
      
      expect(logger.userAction).toHaveBeenCalledWith(
        '点击按钮',
        expect.objectContaining({
          component: 'TestButton',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('性能日志', () => {
    it('应该记录性能日志并包含用户代理信息', () => {
      enhancedLogger.performance('渲染组件', 150, { component: 'TestComponent' });
      
      expect(logger.performance).toHaveBeenCalledWith(
        '渲染组件',
        150,
        expect.objectContaining({
          component: 'TestComponent',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('API请求日志', () => {
    it('应该记录API请求日志并包含用户代理信息', () => {
      enhancedLogger.apiRequest('GET', '/api/test', 200, 100, { method: 'GET' });
      
      expect(logger.apiRequest).toHaveBeenCalledWith(
        'GET',
        '/api/test',
        200,
        100,
        expect.objectContaining({
          method: 'GET',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('组件渲染日志', () => {
    it('应该记录组件渲染性能', () => {
      enhancedLogger.componentRender('TestComponent', 150, { props: { id: '123' } });
      
      expect(logger.performance).toHaveBeenCalledWith(
        'Component Render: TestComponent',
        150,
        expect.objectContaining({
          component: 'TestComponent',
          props: { id: '123' },
          type: 'component_render',
        })
      );
    });
  });

  describe('状态更新日志', () => {
    it('应该记录状态更新', () => {
      enhancedLogger.stateUpdate('chatStore', 'addMessage', { messageType: 'user' });
      
      expect(logger.info).toHaveBeenCalledWith(
        'State Update: chatStore',
        expect.objectContaining({
          store: 'chatStore',
          action: 'addMessage',
          messageType: 'user',
          type: 'state_update',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Hook执行日志', () => {
    it('应该记录Hook执行', () => {
      enhancedLogger.hookExecution('useChat', 'sendMessage', { agentId: 'test-agent' });
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Hook Execution: useChat',
        expect.objectContaining({
          hook: 'useChat',
          operation: 'sendMessage',
          agentId: 'test-agent',
          type: 'hook_execution',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('服务调用日志', () => {
    it('应该记录服务调用', () => {
      enhancedLogger.serviceCall('chatService', 'sendMessage', { agentId: 'test-agent' });
      
      expect(logger.info).toHaveBeenCalledWith(
        'Service Call: chatService.sendMessage',
        expect.objectContaining({
          service: 'chatService',
          method: 'sendMessage',
          agentId: 'test-agent',
          type: 'service_call',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('错误日志', () => {
    it('应该记录错误并包含增强信息', () => {
      const error = new Error('测试错误');
      error.name = 'TestError';
      error.stack = 'Error stack trace';
      
      enhancedLogger.error('发生错误', error, { context: '测试' });
      
      expect(logger.error).toHaveBeenCalledWith(
        '发生错误',
        error,
        expect.objectContaining({
          context: '测试',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
          errorId: expect.any(String),
          errorCode: 'TestError',
          errorStack: 'Error stack trace',
        })
      );
    });

    it('应该处理没有错误对象的情况', () => {
      enhancedLogger.error('发生错误', undefined, { context: '测试' });
      
      expect(logger.error).toHaveBeenCalledWith(
        '发生错误',
        undefined,
        expect.objectContaining({
          context: '测试',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('警告日志', () => {
    it('应该记录警告并包含用户代理信息', () => {
      enhancedLogger.warn('警告信息', { component: 'TestComponent' });
      
      expect(logger.warn).toHaveBeenCalledWith(
        '警告信息',
        expect.objectContaining({
          component: 'TestComponent',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('信息日志', () => {
    it('应该记录信息并包含用户代理信息', () => {
      enhancedLogger.info('信息日志', { component: 'TestComponent' });
      
      expect(logger.info).toHaveBeenCalledWith(
        '信息日志',
        expect.objectContaining({
          component: 'TestComponent',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('调试日志', () => {
    it('应该记录调试信息并包含用户代理信息', () => {
      enhancedLogger.debug('调试信息', { component: 'TestComponent' });
      
      expect(logger.debug).toHaveBeenCalledWith(
        '调试信息',
        expect.objectContaining({
          component: 'TestComponent',
          userAgent: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('性能计时', () => {
    it('应该能够开始和结束计时', () => {
      const startTime = enhancedLogger.startTimer('test-label');
      const duration = enhancedLogger.endTimer('test-label', startTime, '测试操作', { component: 'TestComponent' });
      
      expect(typeof startTime).toBe('number');
      expect(typeof duration).toBe('number');
      expect(logger.performance).toHaveBeenCalledWith(
        '测试操作',
        expect.any(Number),
        expect.objectContaining({
          label: 'test-label',
          component: 'TestComponent',
        })
      );
    });
  });

  describe('异步操作计时', () => {
    it('应该能够包装异步操作并记录性能', async () => {
      const asyncFn = vi.fn().mockResolvedValue('result');
      
      const result = await enhancedLogger.timeAsync(
        'test-async',
        '测试异步操作',
        asyncFn,
        { component: 'TestComponent' }
      );
      
      expect(result).toBe('result');
      expect(asyncFn).toHaveBeenCalled();
      expect(logger.performance).toHaveBeenCalledWith(
        '测试异步操作',
        expect.any(Number),
        expect.objectContaining({
          label: 'test-async',
          component: 'TestComponent',
        })
      );
    });

    it('应该在异步操作失败时仍然记录性能', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('测试错误'));
      
      await expect(
        enhancedLogger.timeAsync(
          'test-async',
          '测试异步操作',
          asyncFn,
          { component: 'TestComponent' }
        )
      ).rejects.toThrow('测试错误');
      
      expect(asyncFn).toHaveBeenCalled();
      expect(logger.performance).toHaveBeenCalledWith(
        '测试异步操作',
        expect.any(Number),
        expect.objectContaining({
          label: 'test-async',
          component: 'TestComponent',
        })
      );
    });
  });

  describe('同步操作计时', () => {
    it('应该能够包装同步操作并记录性能', () => {
      const syncFn = vi.fn().mockReturnValue('result');
      
      const result = enhancedLogger.timeSync(
        'test-sync',
        '测试同步操作',
        syncFn,
        { component: 'TestComponent' }
      );
      
      expect(result).toBe('result');
      expect(syncFn).toHaveBeenCalled();
      expect(logger.performance).toHaveBeenCalledWith(
        '测试同步操作',
        expect.any(Number),
        expect.objectContaining({
          label: 'test-sync',
          component: 'TestComponent',
        })
      );
    });

    it('应该在同步操作失败时仍然记录性能', () => {
      const syncFn = vi.fn().mockImplementation(() => {
        throw new Error('测试错误');
      });
      
      expect(() => {
        enhancedLogger.timeSync(
          'test-sync',
          '测试同步操作',
          syncFn,
          { component: 'TestComponent' }
        );
      }).toThrow('测试错误');
      
      expect(syncFn).toHaveBeenCalled();
      expect(logger.performance).toHaveBeenCalledWith(
        '测试同步操作',
        expect.any(Number),
        expect.objectContaining({
          label: 'test-sync',
          component: 'TestComponent',
        })
      );
    });
  });
});