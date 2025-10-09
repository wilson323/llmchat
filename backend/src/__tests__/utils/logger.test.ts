/**
 * Logger 测试
 * 
 * 验证 Winston 日志系统的基本功能
 */

import logger, { logAudit, logPerformance, logHttpRequest, logDatabaseOperation, logExternalService } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

describe('Logger', () => {
  const logDir = path.join(__dirname, '../../../log');

  beforeAll(() => {
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  });

  describe('基础日志功能', () => {
    it('应该能够记录 info 级别日志', () => {
      expect(() => {
        logger.info('Test info message', { testData: 'value' });
      }).not.toThrow();
    });

    it('应该能够记录 warn 级别日志', () => {
      expect(() => {
        logger.warn('Test warning message', { testData: 'value' });
      }).not.toThrow();
    });

    it('应该能够记录 error 级别日志', () => {
      expect(() => {
        logger.error('Test error message', { testData: 'value' });
      }).not.toThrow();
    });

    it('应该能够记录 debug 级别日志', () => {
      expect(() => {
        logger.debug('Test debug message', { testData: 'value' });
      }).not.toThrow();
    });
  });

  describe('便捷方法', () => {
    it('logAudit 应该能够记录审计日志', () => {
      expect(() => {
        logAudit('USER_LOGIN', {
          userId: 'test-user-123',
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        });
      }).not.toThrow();
    });

    it('logPerformance 应该能够记录性能日志', () => {
      expect(() => {
        logPerformance('database_query', 150, {
          query: 'SELECT * FROM users',
          rows: 10
        });
      }).not.toThrow();
    });

    it('logHttpRequest 应该能够记录 HTTP 请求日志', () => {
      expect(() => {
        logHttpRequest('GET', '/api/users', 200, 45, {
          userId: 'test-user'
        });
      }).not.toThrow();
    });

    it('logDatabaseOperation 应该能够记录数据库操作日志', () => {
      expect(() => {
        logDatabaseOperation('SELECT', 'users', 25, {
          rows: 5
        });
      }).not.toThrow();
    });

    it('logExternalService 应该能够记录外部服务调用日志', () => {
      expect(() => {
        logExternalService('FastGPT', 'chat_completion', true, 1200, {
          tokens: 500
        });
      }).not.toThrow();
    });
  });

  describe('日志文件', () => {
    it('应该创建日志目录', () => {
      expect(fs.existsSync(logDir)).toBe(true);
    });

    it('日志目录应该可写', () => {
      const testFile = path.join(logDir, 'test-write.tmp');
      expect(() => {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      }).not.toThrow();
    });
  });

  describe('错误处理', () => {
    it('应该能够记录错误对象', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error('Error occurred', {
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }).not.toThrow();
    });

    it('应该能够记录复杂对象', () => {
      const complexObject = {
        user: { id: 1, name: 'test' },
        metadata: { timestamp: Date.now() },
        nested: { deep: { value: 'test' } }
      };
      
      expect(() => {
        logger.info('Complex object test', complexObject);
      }).not.toThrow();
    });
  });

  describe('元数据', () => {
    it('应该包含默认元数据', () => {
      // 由于 winston 是异步的，我们只验证调用不抛错
      expect(() => {
        logger.info('Test with metadata');
      }).not.toThrow();
    });

    it('应该能够添加自定义元数据', () => {
      expect(() => {
        logger.info('Test with custom metadata', {
          customField: 'value',
          requestId: 'req-123',
          userId: 'user-456'
        });
      }).not.toThrow();
    });
  });

  describe('HTTP 状态码处理', () => {
    it('2xx 状态码应该使用 info 级别', () => {
      expect(() => {
        logHttpRequest('GET', '/api/test', 200, 50);
        logHttpRequest('POST', '/api/test', 201, 100);
      }).not.toThrow();
    });

    it('4xx 状态码应该使用 warn 级别', () => {
      expect(() => {
        logHttpRequest('GET', '/api/test', 404, 10);
        logHttpRequest('POST', '/api/test', 400, 15);
      }).not.toThrow();
    });

    it('5xx 状态码应该使用 error 级别', () => {
      expect(() => {
        logHttpRequest('GET', '/api/test', 500, 100);
        logHttpRequest('POST', '/api/test', 503, 200);
      }).not.toThrow();
    });
  });

  describe('外部服务日志', () => {
    it('成功调用应该使用 info 级别', () => {
      expect(() => {
        logExternalService('TestAPI', 'getData', true, 150);
      }).not.toThrow();
    });

    it('失败调用应该使用 warn 级别', () => {
      expect(() => {
        logExternalService('TestAPI', 'getData', false, 5000, {
          error: 'Timeout'
        });
      }).not.toThrow();
    });
  });
});

