/**
 * 错误处理中间件增强测试
 * 
 * 验证错误处理的完整性和一致性：
 * - HTTP状态码映射
 * - 错误响应格式
 * - 日志记录
 * - 安全性
 */

import { Request, Response } from 'express';
import { errorHandler, notFoundHandler, asyncErrorHandler, createErrorResponse } from '@/middleware/errorHandler';
import { BaseError, ValidationError, AuthenticationError, ResourceError, ExternalServiceError } from '@/types/errors';
import logger from '@/utils/logger';

// Mock logger
jest.mock('@/utils/logger');

describe('ErrorHandler Middleware Enhanced Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    setHeaderMock = jest.fn();

    mockReq = {
      originalUrl: '/api/test',
      method: 'GET',
      headers: {},
      get: jest.fn().mockReturnValue('test-user-agent'),
      ip: '127.0.0.1',
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
      headersSent: false,
      on: jest.fn(),
    };

    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('HTTP Status Code Mapping', () => {
    it('should return 400 for validation errors', () => {
      const error = new ValidationError('Invalid input', {
        field: 'email',
        value: 'invalid',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 401 for authentication errors', () => {
      const error = new AuthenticationError('Invalid credentials');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 403 for authorization errors', () => {
      const error = new BaseError({
        message: 'Forbidden',
        code: 'FORBIDDEN',
        category: 'authorization',
        severity: 'medium',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should return 404 for resource not found errors', () => {
      const error = new ResourceError('User not found', {
        resourceType: 'user',
        resourceId: '123',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should return 408 for timeout errors', () => {
      const error = new BaseError({
        message: 'Request timeout',
        code: 'TIMEOUT_ERROR',
        category: 'network',
        severity: 'high',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(408);
    });

    it('should return 422 for validation failed errors', () => {
      const error = new BaseError({
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        category: 'validation',
        severity: 'medium',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(422);
    });

    it('should return 429 for rate limit errors', () => {
      const error = new BaseError({
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        category: 'validation',
        severity: 'low',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(429);
    });

    it('should return 500 for internal server errors', () => {
      const error = new BaseError({
        message: 'Internal error',
        code: 'INTERNAL_SERVER_ERROR',
        category: 'system',
        severity: 'critical',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should return 503 for service unavailable errors', () => {
      const error = new ExternalServiceError('Service unavailable', {
        service: 'database',
        operation: 'query',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
    });

    it('should return 503 for circuit breaker open errors', () => {
      const error = new BaseError({
        message: 'Circuit breaker open',
        code: 'CIRCUIT_BREAKER_OPEN',
        category: 'network',
        severity: 'high',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', () => {
      const error = new ValidationError('Test error', { field: 'test' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonMock.mock.calls[0]?.[0];
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('timestamp');
    });

    it('should include details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new ValidationError('Test error', { field: 'test' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const response = jsonMock.mock.calls[0]?.[0];
      expect(response).toHaveProperty('details');
      expect(response.details).toHaveProperty('errorId');
      expect(response.details).toHaveProperty('component');

      process.env.NODE_ENV = originalEnv;
    });

    it('should set X-Error-ID header in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new ValidationError('Test error', { field: 'test' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(setHeaderMock).toHaveBeenCalledWith('X-Error-ID', expect.any(String));

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Logging Behavior', () => {
    it('should log error with structured data', () => {
      const error = new ValidationError('Test error', { field: 'test' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        '统一错误处理',
        expect.objectContaining({
          errorId: expect.any(String),
          code: expect.any(String),
          message: expect.any(String),
          url: '/api/test',
          method: 'GET',
        })
      );
    });

    it('should include requestId if available', () => {
      (mockReq as any).requestId = 'req-123';
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          requestId: 'req-123',
        })
      );
    });

    it('should include userId if user is authenticated', () => {
      (mockReq as any).user = { id: 'user-456' };
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-456',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle headers already sent', () => {
      mockRes.headersSent = true;
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle unknown error types', () => {
      const error = new Error('Unknown error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should handle string errors', () => {
      const error = 'String error';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should handle null/undefined errors', () => {
      const error = null;

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('Async Error Handler', () => {
    it('should catch async errors', async () => {
      const asyncFn = async () => {
        throw new ValidationError('Async error');
      };

      const wrapped = asyncErrorHandler(asyncFn);
      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should handle successful async operations', async () => {
      const asyncFn = async (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      };

      const wrapped = asyncErrorHandler(asyncFn);
      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('404 Not Found Handler', () => {
    it('should return 404 for non-existent routes', () => {
      notFoundHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.any(String),
          message: expect.stringContaining('not found'),
        })
      );
    });
  });

  describe('Error Response Creation', () => {
    it('should create error response without details', () => {
      const error = new ValidationError('Test error', { field: 'test' });
      const response = createErrorResponse(error, false);

      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('message');
      expect(response).not.toHaveProperty('details');
    });

    it('should create error response with details', () => {
      const error = new ValidationError('Test error', { field: 'test' });
      const response = createErrorResponse(error, true);

      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('details');
      expect(response.details).toHaveProperty('errorId');
    });
  });
});

