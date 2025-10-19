/**
 * API 响应类型测试
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
  ApiResponsePayload,
  ListResponse,
  DetailResponse,
  CreateResponse,
  UpdateResponse,
  DeleteResponse,
  ValidationErrorResponse,
  RateLimitResponse,
  HealthCheckResponse
} from '../../src/api/responses.js';
import type { JsonValue } from '../../src/index.js';

describe('ApiSuccessResponse 成功响应', () => {
  describe('基础成功响应', () => {
    it('应该接受有效的成功响应', () => {
      const response: ApiSuccessResponse = {
        code: 'SUCCESS',
        message: 'Operation completed successfully',
        data: { id: '123', name: 'Test Item' },
        timestamp: '2023-01-01T12:00:00.000Z',
        requestId: 'req-123'
      };

      expect(response.code).toBe('SUCCESS');
      expect(response.message).toBe('Operation completed successfully');
      expect(response.data).toEqual({ id: '123', name: 'Test Item' });
      expect(response.timestamp).toBe('2023-01-01T12:00:00.000Z');
      expect(response.requestId).toBe('req-123');
    });

    it('应该支持复杂的元数据', () => {
      const response: ApiSuccessResponse = {
        code: 'SUCCESS',
        message: 'Data retrieved successfully',
        data: { items: [], total: 0 },
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          duration: 150,
          pagination: {
            page: 1,
            pageSize: 20,
            total: 100,
            totalPages: 5,
            hasNext: true,
            hasPrev: false
          },
          extra: {
            cacheHit: false,
            source: 'database'
          }
        }
      };

      expect(response.metadata?.version).toBe('1.0.0');
      expect(response.metadata?.duration).toBe(150);
      expect(response.metadata?.pagination?.page).toBe(1);
      expect(response.metadata?.pagination?.totalPages).toBe(5);
      expect(response.metadata?.extra?.cacheHit).toBe(false);
    });

    it('应该支持不同数据类型', () => {
      const stringResponse: ApiSuccessResponse<string> = {
        code: 'SUCCESS',
        message: 'String data',
        data: 'Simple string value',
        timestamp: new Date().toISOString()
      };

      const numberResponse: ApiSuccessResponse<number> = {
        code: 'SUCCESS',
        message: 'Number data',
        data: 42,
        timestamp: new Date().toISOString()
      };

      const arrayResponse: ApiSuccessResponse<string[]> = {
        code: 'SUCCESS',
        message: 'Array data',
        data: ['item1', 'item2', 'item3'],
        timestamp: new Date().toISOString()
      };

      const objectResponse: ApiSuccessResponse<{ key: string }> = {
        code: 'SUCCESS',
        message: 'Object data',
        data: { key: 'value' },
        timestamp: new Date().toISOString()
      };

      expect(typeof stringResponse.data).toBe('string');
      expect(typeof numberResponse.data).toBe('number');
      expect(Array.isArray(arrayResponse.data)).toBe(true);
      expect(typeof objectResponse.data).toBe('object');
    });
  });
});

describe('ApiErrorResponse 错误响应', () => {
  describe('基础错误响应', () => {
    it('应该接受有效的错误响应', () => {
      const response: ApiErrorResponse = {
        code: 'ERROR',
        message: 'An error occurred',
        success: false,
        error: 'Validation failed',
        details: {
          field: 'email',
          message: 'Invalid email format'
        },
        timestamp: new Date().toISOString(),
        requestId: 'req-error-123'
      };

      expect(response.success).toBe(false);
      expect(response.code).toBe('ERROR');
      expect(response.error).toBe('Validation failed');
      expect(response.details).toEqual({
        field: 'email',
        message: 'Invalid email format'
      });
    });

    it('应该支持不同错误类型', () => {
      const validationError: ApiErrorResponse = {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        success: false,
        error: 'Invalid input parameters',
        timestamp: new Date().toISOString()
      };

      const authError: ApiErrorResponse = {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        success: false,
        error: 'Invalid or missing authentication token',
        timestamp: new Date().toISOString()
      };

      const serverError: ApiErrorResponse = {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        success: false,
        error: 'Unexpected server error occurred',
        stack: 'Error: Unexpected error\n    at ...',
        timestamp: new Date().toISOString()
      };

      expect(validationError.code).toBe('VALIDATION_ERROR');
      expect(authError.code).toBe('UNAUTHORIZED');
      expect(serverError.code).toBe('INTERNAL_ERROR');
      expect(serverError.stack).toBeTruthy();
    });
  });
});

describe('PaginatedResponse 分页响应', () => {
  describe('分页数据结构', () => {
    it('应该接受有效的分页响应', () => {
      const response: PaginatedResponse<string> = {
        code: 'SUCCESS',
        message: 'Data retrieved successfully',
        data: ['item1', 'item2', 'item3', 'item4', 'item5'],
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          pagination: {
            page: 1,
            pageSize: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: false
          }
        }
      };

      expect(response.data).toHaveLength(5);
      expect(response.metadata?.pagination?.page).toBe(1);
      expect(response.metadata?.pagination?.pageSize).toBe(10);
      expect(response.metadata?.pagination?.total).toBe(25);
      expect(response.metadata?.pagination?.totalPages).toBe(3);
      expect(response.metadata?.pagination?.hasNext).toBe(true);
      expect(response.metadata?.pagination?.hasPrev).toBe(false);
    });

    it('应该支持空页', () => {
      const emptyResponse: PaginatedResponse<any> = {
        code: 'SUCCESS',
        message: 'No data found',
        data: [],
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      expect(emptyResponse.data).toHaveLength(0);
      expect(emptyResponse.metadata?.pagination?.total).toBe(0);
      expect(emptyResponse.metadata?.pagination?.totalPages).toBe(0);
    });

    it('应该支持最后一页', () => {
      const lastPageResponse: PaginatedResponse<string> = {
        code: 'SUCCESS',
        message: 'Last page',
        data: ['last-item'],
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          pagination: {
            page: 3,
            pageSize: 10,
            total: 21,
            totalPages: 3,
            hasNext: false,
            hasPrev: true
          }
        }
      };

      expect(lastPageResponse.metadata?.pagination?.page).toBe(3);
      expect(lastPageResponse.metadata?.pagination?.hasNext).toBe(false);
      expect(lastPageResponse.metadata?.pagination?.hasPrev).toBe(true);
    });
  });
});

describe('专门化响应类型', () => {
  describe('ListResponse 列表响应', () => {
    it('应该支持列表响应', () => {
      const listResponse: ListResponse<{ id: string; name: string }> = {
        code: 'SUCCESS',
        message: 'Items retrieved',
        data: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' }
        ],
        timestamp: new Date().toISOString(),
        count: 2,
        hasMore: false
      };

      expect(listResponse.data).toHaveLength(2);
      expect(listResponse.count).toBe(2);
      expect(listResponse.hasMore).toBe(false);
    });

    it('应该支持分页列表', () => {
      const paginatedListResponse: ListResponse<string> = {
        code: 'SUCCESS',
        message: 'Paginated items',
        data: ['page1-item1', 'page1-item2'],
        timestamp: new Date().toISOString(),
        count: 2,
        hasMore: true,
        page: 1,
        pageSize: 2,
        total: 5
      };

      expect(paginatedListResponse.hasMore).toBe(true);
      expect(paginatedListResponse.page).toBe(1);
      expect(paginatedListResponse.pageSize).toBe(2);
      expect(paginatedListResponse.total).toBe(5);
    });
  });

  describe('DetailResponse 详情响应', () => {
    it('应该支持详情响应', () => {
      const detailResponse: DetailResponse<{ id: string; name: string; description: string }> = {
        code: 'SUCCESS',
        message: 'Item details retrieved',
        data: {
          id: '123',
          name: 'Test Item',
          description: 'A detailed description'
        },
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          extra: {
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-02T00:00:00.000Z',
            author: 'John Doe'
          }
        }
      };

      expect(detailResponse.data.id).toBe('123');
      expect(detailResponse.data.name).toBe('Test Item');
      expect(detailResponse.metadata?.extra?.author).toBe('John Doe');
    });
  });

  describe('CreateResponse 创建响应', () => {
    it('应该支持创建响应', () => {
      const createResponse: CreateResponse<{ id: string; name: string }> = {
        code: 'CREATED',
        message: 'Item created successfully',
        data: {
          id: 'new-123',
          name: 'New Item'
        },
        timestamp: new Date().toISOString(),
        resourceId: 'new-123',
        resourceUrl: '/api/items/new-123',
        createdAt: '2023-01-01T12:00:00.000Z'
      };

      expect(createResponse.code).toBe('CREATED');
      expect(createResponse.resourceId).toBe('new-123');
      expect(createResponse.resourceUrl).toBe('/api/items/new-123');
      expect(createResponse.createdAt).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('UpdateResponse 更新响应', () => {
    it('应该支持更新响应', () => {
      const updateResponse: UpdateResponse<{ id: string; name: string }> = {
        code: 'UPDATED',
        message: 'Item updated successfully',
        data: {
          id: '123',
          name: 'Updated Item'
        },
        timestamp: new Date().toISOString(),
        resourceId: '123',
        updatedAt: '2023-01-01T12:30:00.000Z',
        changes: {
          name: { old: 'Old Name', new: 'Updated Item' }
        }
      };

      expect(updateResponse.code).toBe('UPDATED');
      expect(updateResponse.updatedAt).toBe('2023-01-01T12:30:00.000Z');
      expect(updateResponse.changes?.name.old).toBe('Old Name');
      expect(updateResponse.changes?.name.new).toBe('Updated Item');
    });
  });

  describe('DeleteResponse 删除响应', () => {
    it('应该支持删除响应', () => {
      const deleteResponse: DeleteResponse = {
        code: 'DELETED',
        message: 'Item deleted successfully',
        data: null,
        timestamp: new Date().toISOString(),
        resourceId: '123',
        deletedAt: '2023-01-01T13:00:00.000Z'
      };

      expect(deleteResponse.code).toBe('DELETED');
      expect(deleteResponse.data).toBeNull();
      expect(deleteResponse.resourceId).toBe('123');
      expect(deleteResponse.deletedAt).toBe('2023-01-01T13:00:00.000Z');
    });

    it('应该支持批量删除', () => {
      const batchDeleteResponse: DeleteResponse = {
        code: 'DELETED',
        message: 'Items deleted successfully',
        data: null,
        timestamp: new Date().toISOString(),
        resourceIds: ['123', '456', '789'],
        deletedCount: 3,
        deletedAt: '2023-01-01T13:00:00.000Z'
      };

      expect(batchDeleteResponse.resourceIds).toHaveLength(3);
      expect(batchDeleteResponse.deletedCount).toBe(3);
    });
  });
});

describe('错误专门化响应', () => {
  describe('ValidationErrorResponse 验证错误响应', () => {
    it('应该支持验证错误响应', () => {
      const validationError: ValidationErrorResponse = {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        success: false,
        error: 'Invalid input parameters',
        timestamp: new Date().toISOString(),
        requestId: 'req-validation-123',
        errors: [
          {
            field: 'email',
            message: 'Email is required',
            code: 'REQUIRED',
            value: ''
          },
          {
            field: 'age',
            message: 'Age must be between 0 and 120',
            code: 'RANGE',
            value: -5
          }
        ],
        details: {
          summary: '2 validation errors found',
          fields: ['email', 'age']
        }
      };

      expect(validationError.errors).toHaveLength(2);
      expect(validationError.errors[0].field).toBe('email');
      expect(validationError.errors[1].code).toBe('RANGE');
      expect(validationError.details?.summary).toBe('2 validation errors found');
    });
  });

  describe('RateLimitResponse 限流响应', () => {
    it('应该支持限流响应', () => {
      const rateLimitResponse: RateLimitResponse = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        success: false,
        error: 'Rate limit exceeded',
        timestamp: new Date().toISOString(),
        requestId: 'req-ratelimit-123',
        retryAfter: 60,
        limit: 100,
        remaining: 0,
        resetTime: '2023-01-01T12:01:00.000Z',
        window: '1m'
      };

      expect(rateLimitResponse.retryAfter).toBe(60);
      expect(rateLimitResponse.limit).toBe(100);
      expect(rateLimitResponse.remaining).toBe(0);
      expect(rateLimitResponse.window).toBe('1m');
    });
  });
});

describe('HealthCheckResponse 健康检查响应', () => {
  describe('系统健康状态', () => {
    it('应该支持健康状态响应', () => {
      const healthResponse: HealthCheckResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        environment: 'production',
        checks: {
          database: {
            status: 'healthy',
            latency: 15,
            details: { connections: 10, maxConnections: 100 }
          },
          redis: {
            status: 'healthy',
            latency: 5,
            details: { memory: '50MB', keys: 1000 }
          },
          external_api: {
            status: 'degraded',
            latency: 500,
            details: { endpoint: 'https://api.example.com', lastCheck: '2023-01-01T12:00:00.000Z' }
          }
        },
        summary: {
          total: 3,
          healthy: 2,
          degraded: 1,
          unhealthy: 0
        }
      };

      expect(healthResponse.status).toBe('healthy');
      expect(healthResponse.uptime).toBe(3600);
      expect(healthResponse.version).toBe('1.0.0');
      expect(healthResponse.checks.database.status).toBe('healthy');
      expect(healthResponse.checks.external_api.status).toBe('degraded');
      expect(healthResponse.summary?.healthy).toBe(2);
      expect(healthResponse.summary?.degraded).toBe(1);
    });

    it('应该支持不健康状态', () => {
      const unhealthyResponse: HealthCheckResponse = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 1800,
        version: '1.0.0',
        environment: 'production',
        checks: {
          database: {
            status: 'unhealthy',
            latency: null,
            error: 'Connection timeout',
            details: { retryCount: 3, lastError: '2023-01-01T11:55:00.000Z' }
          },
          cache: {
            status: 'healthy',
            latency: 2,
            details: { hitRate: 0.95 }
          }
        },
        summary: {
          total: 2,
          healthy: 1,
          degraded: 0,
          unhealthy: 1
        },
        errors: [
          'Database connection failed',
          'External service unreachable'
        ]
      };

      expect(unhealthyResponse.status).toBe('unhealthy');
      expect(unhealthyResponse.checks.database.error).toBe('Connection timeout');
      expect(unhealthyResponse.summary?.unhealthy).toBe(1);
      expect(unhealthyResponse.errors).toHaveLength(2);
    });
  });
});

describe('响应序列化测试', () => {
  describe('JSON序列化', () => {
    it('应该能够序列化复杂响应', () => {
      const complexResponse: ApiSuccessResponse = {
        code: 'SUCCESS',
        message: 'Complex response',
        data: {
          items: [1, 2, 3],
          metadata: { source: 'database', cached: false },
          nested: {
            deep: { value: 'found', timestamp: Date.now() }
          }
        },
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          duration: 250,
          pagination: {
            page: 2,
            pageSize: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: true
          }
        }
      };

      const serialized = JSON.stringify(complexResponse);
      const deserialized = JSON.parse(serialized) as ApiSuccessResponse;

      expect(deserialized.code).toBe(complexResponse.code);
      expect(deserialized.data.items).toEqual([1, 2, 3]);
      expect(deserialized.metadata?.pagination?.page).toBe(2);
    });

    it('应该处理循环引用', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      // 在实际应用中，应该处理循环引用或抛出适当的错误
      expect(() => {
        JSON.stringify(obj);
      }).toThrow();
    });
  });

  describe('响应验证', () => {
    it('应该验证必需字段', () => {
      const minimalValidResponse: ApiSuccessResponse = {
        code: 'SUCCESS',
        message: 'Success',
        data: null,
        timestamp: new Date().toISOString()
      };

      expect(minimalValidResponse.code).toBeTruthy();
      expect(minimalValidResponse.message).toBeTruthy();
      expect(minimalValidResponse.timestamp).toBeTruthy();
    });

    it('应该验证时间戳格式', () => {
      const validTimestamp = '2023-01-01T12:00:00.000Z';
      const response: ApiSuccessResponse = {
        code: 'SUCCESS',
        message: 'Test',
        data: null,
        timestamp: validTimestamp
      };

      const date = new Date(response.timestamp);
      expect(date.toISOString()).toBe(validTimestamp);
    });
  });
});

describe('响应性能测试', () => {
  describe('大量数据处理', () => {
    it('应该能够处理大型数据集', () => {
      const largeData = Array(10000).fill(null).map((_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        value: Math.random() * 1000
      }));

      const largeResponse: PaginatedResponse<any> = {
        code: 'SUCCESS',
        message: 'Large dataset',
        data: largeData,
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          pagination: {
            page: 1,
            pageSize: 10000,
            total: 10000,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      expect(largeResponse.data).toHaveLength(10000);
      expect(largeResponse.data[0].id).toBe('item-0');
      expect(largeResponse.data[9999].name).toBe('Item 9999');
    });
  });

  describe('内存优化', () => {
    it('应该优化响应内存使用', () => {
      const response: ApiSuccessResponse<string> = {
        code: 'SUCCESS',
        message: 'Memory test',
        data: 'A'.repeat(1000000), // 1MB string
        timestamp: new Date().toISOString()
      };

      const serialized = JSON.stringify(response);
      expect(serialized.length).toBeGreaterThan(1000000);

      const deserialized = JSON.parse(serialized) as ApiSuccessResponse<string>;
      expect(deserialized.data).toHaveLength(1000000);
    });
  });
});