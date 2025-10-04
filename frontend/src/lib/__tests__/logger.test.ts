/**
 * Logger工具单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from '../logger';

describe('Logger', () => {
  // Mock console方法
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('基础日志方法', () => {
    it('应该输出debug日志', () => {
      logger.debug('测试debug', { key: 'value' });
      expect(console.debug).toHaveBeenCalled();
    });

    it('应该输出info日志', () => {
      logger.info('测试info', { key: 'value' });
      expect(console.info).toHaveBeenCalled();
    });

    it('应该输出warn日志', () => {
      logger.warn('测试warn', { key: 'value' });
      expect(console.warn).toHaveBeenCalled();
    });

    it('应该输出error日志', () => {
      const error = new Error('测试错误');
      logger.error('测试error', error, { key: 'value' });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('敏感信息过滤', () => {
    it('应该过滤password字段', () => {
      logger.info('用户登录', { username: 'test', password: '123456' });
      const call = (console.info as any).mock.calls[0];
      expect(call[0]).not.toContain('123456');
      expect(JSON.stringify(call)).toContain('[REDACTED]');
    });

    it('应该过滤token字段', () => {
      logger.info('API请求', { endpoint: '/api/test', token: 'secret-token' });
      const call = (console.info as any).mock.calls[0];
      expect(JSON.stringify(call)).toContain('[REDACTED]');
    });

    it('应该过滤apiKey字段', () => {
      logger.info('配置', { apiKey: 'sk-123456', endpoint: 'https://api.com' });
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as any).mock.calls[0];
      const callStr = JSON.stringify(call);
      // 验证敏感信息被过滤
      expect(callStr).toContain('[REDACTED]');
      expect(callStr).not.toContain('sk-123456');
    });
  });

  describe('专用日志方法', () => {
    it('performance日志应该包含duration', () => {
      logger.performance('renderMessage', 150, { messageId: '123' });
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as any).mock.calls[0];
      expect(JSON.stringify(call)).toContain('150');
      expect(JSON.stringify(call)).toContain('ms');
    });

    it('apiRequest日志应该根据状态码选择级别', () => {
      // 200 - info
      logger.apiRequest('GET', '/api/test', 200, 100);
      expect(console.info).toHaveBeenCalled();

      // 400 - warn
      logger.apiRequest('POST', '/api/test', 400, 100);
      expect(console.warn).toHaveBeenCalled();

      // 500 - error
      logger.apiRequest('GET', '/api/test', 500, 100);
      expect(console.error).toHaveBeenCalled();
    });

    it('userAction日志应该记录用户行为', () => {
      logger.userAction('发送消息', { agentId: 'fastgpt-1', messageLength: 100 });
      expect(console.info).toHaveBeenCalled();
      const call = (console.info as any).mock.calls[0];
      expect(JSON.stringify(call)).toContain('user_action');
    });
  });

  describe('配置管理', () => {
    it('应该能够获取配置', () => {
      const config = logger.getConfig();
      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('sentryEnabled');
      expect(config).toHaveProperty('consoleEnabled');
    });

    it('应该能够更新配置', () => {
      logger.setConfig({ level: LogLevel.ERROR });
      const config = logger.getConfig();
      expect(config.level).toBe(LogLevel.ERROR);

      // 恢复默认
      logger.setConfig({ level: LogLevel.DEBUG });
    });

    it('更新日志级别后应该过滤低级别日志', () => {
      logger.setConfig({ level: LogLevel.ERROR });
      
      logger.debug('debug消息');
      logger.info('info消息');
      logger.warn('warn消息');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // 恢复默认
      logger.setConfig({ level: LogLevel.DEBUG });
    });
  });

  describe('错误处理', () => {
    it('应该能够记录Error对象', () => {
      const error = new Error('测试错误');
      error.stack = 'Error stack trace';
      
      logger.error('发生错误', error, { context: '测试' });
      expect(console.error).toHaveBeenCalled();
    });

    it('error日志应该包含错误堆栈', () => {
      const error = new Error('测试错误');
      error.stack = 'Error stack trace';
      
      logger.error('发生错误', error);
      const call = (console.error as any).mock.calls[0];
      expect(JSON.stringify(call)).toContain('Error stack trace');
    });
  });
});
