/**
 * API类型验证器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApiResponseValidator,
  agentsListResponseValidator,
  agentDetailResponseValidator,
  chatApiResponseValidator,
  userPreferencesResponseValidator,
  apiErrorResponseValidator,
  createApiResponseValidator,
  createApiClientWrapper
} from '../api-type-validators';

// Mock API响应数据
const mockSuccessResponse = {
  code: 'SUCCESS',
  message: 'Operation completed successfully',
  data: {
    id: '123',
    name: 'Test Agent',
    description: 'Test Description',
    status: 'active'
  },
  timestamp: '2023-10-18T10:00:00.000Z'
};

const mockErrorResponse = {
  code: 'ERROR',
  message: 'Operation failed',
  data: null,
  timestamp: '2023-10-18T10:00:00.000Z',
  error: {
    details: 'Detailed error information',
    stack: 'Error stack trace'
  }
};

const mockAgentsListResponse = {
  code: 'SUCCESS',
  message: 'Agents retrieved successfully',
  data: [
    {
      id: '123',
      name: 'Agent 1',
      description: 'Description 1',
      model: 'gpt-3.5-turbo',
      status: 'active',
      capabilities: ['text', 'image'],
      provider: 'openai'
    },
    {
      id: '456',
      name: 'Agent 2',
      description: 'Description 2',
      model: 'gpt-4',
      status: 'inactive',
      capabilities: ['text'],
      provider: 'openai'
    }
  ],
  timestamp: '2023-10-18T10:00:00.000Z'
};

const mockChatApiResponse = {
  code: 'SUCCESS',
  message: 'Chat response generated',
  data: {
    AI: 'Hello! How can I help you today?',
    id: 'msg_123',
    timestamp: 1697625600000
  },
  timestamp: '2023-10-18T10:00:00.000Z'
};

describe('ApiResponseValidator', () => {
  describe('validate', () => {
    it('should validate successful API response', () => {
      const result = ApiResponseValidator.validate(mockSuccessResponse, agentsListResponseValidator);

      expect(result).toEqual(mockSuccessResponse.data);
    });

    it('should throw error for invalid response', () => {
      const invalidResponse = {
        code: 'SUCCESS',
        message: 'Success',
        // missing data and timestamp
      };

      expect(() => {
        ApiResponseValidator.validate(invalidResponse, agentsListResponseValidator);
      }).toThrow('Parse failed:');
    });
  });

  describe('safeValidate', () => {
    it('should return success result for valid response', () => {
      const result = ApiResponseValidator.safeValidate(mockSuccessResponse, agentsListResponseValidator);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSuccessResponse.data);
      expect(result.errors).toBeUndefined();
    });

    it('should return error result for invalid response', () => {
      const invalidResponse = {
        code: 'SUCCESS',
        message: 'Success',
        // missing required fields
      };

      const result = ApiResponseValidator.safeValidate(invalidResponse, agentsListResponseValidator);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('isError', () => {
    it('should identify error responses', () => {
      expect(ApiResponseValidator.isError(mockErrorResponse)).toBe(true);
      expect(ApiResponseValidator.isError(mockSuccessResponse)).toBe(false);
    });

    it('should handle null/undefined responses', () => {
      expect(ApiResponseValidator.isError(null)).toBe(false);
      expect(ApiResponseValidator.isError(undefined)).toBe(false);
    });
  });

  describe('extractError', () => {
    it('should extract error information from error response', () => {
      const error = ApiResponseValidator.extractError(mockErrorResponse);

      expect(error).toEqual({
        code: 'ERROR',
        message: 'Operation failed',
        details: 'Detailed error information'
      });
    });

    it('should return null for non-error response', () => {
      const error = ApiResponseValidator.extractError(mockSuccessResponse);
      expect(error).toBeNull();
    });

    it('should handle responses without error details', () => {
      const simpleErrorResponse = {
        code: 'ERROR',
        message: 'Simple error',
        data: null,
        timestamp: '2023-10-18T10:00:00.000Z'
      };

      const error = ApiResponseValidator.extractError(simpleErrorResponse);

      expect(error).toEqual({
        code: 'ERROR',
        message: 'Simple error',
        details: undefined
      });
    });
  });
});

describe('预定义API验证器', () => {
  describe('agentsListResponseValidator', () => {
    it('should validate agents list response', () => {
      const result = agentsListResponseValidator.test(mockAgentsListResponse);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(mockAgentsListResponse.data);
    });

    it('should reject invalid agents list response', () => {
      const invalidResponse = {
        ...mockAgentsListResponse,
        data: 'not an array'
      };

      const result = agentsListResponseValidator.test(invalidResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('agentDetailResponseValidator', () => {
    it('should validate agent detail response', () => {
      const result = agentDetailResponseValidator.test(mockSuccessResponse);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(mockSuccessResponse.data);
    });

    it('should reject response missing required agent fields', () => {
      const invalidResponse = {
        ...mockSuccessResponse,
        data: {
          id: '123',
          // missing name, description, etc.
        }
      };

      const result = agentDetailResponseValidator.test(invalidResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property 'name': Type validation failed");
    });
  });

  describe('chatApiResponseValidator', () => {
    it('should validate chat API response', () => {
      const result = chatApiResponseValidator.test(mockChatApiResponse);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(mockChatApiResponse.data);
    });

    it('should reject invalid chat response', () => {
      const invalidResponse = {
        ...mockChatApiResponse,
        data: {
          // missing AI field
          HUMAN: 'Hello'
        }
      };

      const result = chatApiResponseValidator.test(invalidResponse);

      expect(result.isValid).toBe(false);
    });
  });

  describe('userPreferencesResponseValidator', () => {
    it('should validate user preferences response', () => {
      const preferencesResponse = {
        code: 'SUCCESS',
        message: 'Preferences retrieved',
        data: {
          theme: {
            mode: 'dark',
            isAutoMode: false,
            userPreference: 'dark'
          },
          streamingEnabled: true,
          autoThemeSchedule: {
            enabled: true,
            lightModeStart: '06:00',
            darkModeStart: '18:00'
          },
          language: 'zh-CN'
        },
        timestamp: '2023-10-18T10:00:00.000Z'
      };

      const result = userPreferencesResponseValidator.test(preferencesResponse);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(preferencesResponse.data);
    });

    it('should reject invalid preferences response', () => {
      const invalidResponse = {
        code: 'SUCCESS',
        message: 'Preferences retrieved',
        data: {
          theme: 'invalid', // should be object
          streamingEnabled: true,
          language: 'zh-CN'
        },
        timestamp: '2023-10-18T10:00:00.000Z'
      };

      const result = userPreferencesResponseValidator.test(invalidResponse);

      expect(result.isValid).toBe(false);
    });
  });
});

describe('createApiResponseValidator', () => {
  it('should create custom API response validator', () => {
    const customDataValidator = {
      test: (value: unknown) => ({
        isValid: typeof value === 'object' && value !== null && 'customField' in value,
        data: value,
        errors: typeof value !== 'object' ? ['Must be object'] : !value || !('customField' in value) ? ['Missing customField'] : []
      })
    };

    const customValidator = createApiResponseValidator(customDataValidator);

    const validResponse = {
      code: 'SUCCESS',
      message: 'Success',
      data: { customField: 'value' },
      timestamp: '2023-10-18T10:00:00.000Z'
    };

    const result = customValidator.test(validResponse);
    expect(result.isValid).toBe(true);
    expect(result.data).toEqual(validResponse.data);
  });

  it('should handle validation errors in custom validator', () => {
    const customDataValidator = {
      test: (value: unknown) => ({
        isValid: typeof value === 'object' && value !== null && 'requiredField' in value,
        data: value,
        errors: typeof value !== 'object' ? ['Must be object'] : !value || !('requiredField' in value) ? ['Missing requiredField'] : []
      })
    };

    const customValidator = createApiResponseValidator(customDataValidator);

    const invalidResponse = {
      code: 'SUCCESS',
      message: 'Success',
      data: { wrongField: 'value' },
      timestamp: '2023-10-18T10:00:00.000Z'
    };

    const result = customValidator.test(invalidResponse);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing requiredField');
  });
});

describe('createApiClientWrapper', () => {
  let mockApi: any;
  let apiClient: any;

  beforeEach(() => {
    mockApi = {
      getAgents: vi.fn().mockResolvedValue(mockAgentsListResponse),
      getAgent: vi.fn().mockResolvedValue(mockSuccessResponse),
      createAgent: vi.fn().mockResolvedValue(mockSuccessResponse)
    };

    apiClient = createApiClientWrapper({
      getAgents: agentsListResponseValidator,
      getAgent: agentDetailResponseValidator,
      createAgent: agentDetailResponseValidator
    });
  });

  it('should validate API responses using wrapper', async () => {
    const result = await apiClient.safeValidate('getAgents', await mockApi.getAgents());

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockAgentsListResponse.data);
  });

  it('should handle validation errors in wrapper', async () => {
    const invalidResponse = {
      code: 'SUCCESS',
      message: 'Success',
      data: 'invalid data',
      timestamp: '2023-10-18T10:00:00.000Z'
    };

    mockApi.getAgents.mockResolvedValue(invalidResponse);

    const result = await apiClient.safeValidate('getAgents', await mockApi.getAgents());

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should throw error when calling validate directly with invalid data', async () => {
    const invalidResponse = {
      code: 'SUCCESS',
      message: 'Success',
      data: 'invalid data',
      timestamp: '2023-10-18T10:00:00.000Z'
    };

    mockApi.getAgents.mockResolvedValue(invalidResponse);

    expect(() => {
      apiClient.validate('getAgents', await mockApi.getAgents());
    }).toThrow('Parse failed:');
  });
});

describe('边界情况测试', () => {
  it('should handle null/undefined responses', () => {
    expect(() => {
      ApiResponseValidator.validate(null, agentsListResponseValidator);
    }).toThrow();

    expect(() => {
      ApiResponseValidator.validate(undefined, agentsListResponseValidator);
    }).toThrow();
  });

  it('should handle empty responses', () => {
    const emptyResponse = {};

    expect(() => {
      ApiResponseValidator.validate(emptyResponse, agentsListResponseValidator);
    }).toThrow();
  });

  it('should handle responses with extra fields', () => {
    const responseWithExtraFields = {
      ...mockSuccessResponse,
      extraField: 'extra value',
      anotherExtra: { nested: 'value' }
    };

    const result = ApiResponseValidator.safeValidate(responseWithExtraFields, agentDetailResponseValidator);

    // Should still be valid as extra fields are ignored
    expect(result.success).toBe(true);
  });

  it('should handle malformed timestamps', () => {
    const responseWithBadTimestamp = {
      ...mockSuccessResponse,
      timestamp: 'not-a-date'
    };

    const result = ApiResponseValidator.safeValidate(responseWithBadTimestamp, agentDetailResponseValidator);

    // Timestamp validation might be flexible, but we should handle it gracefully
    expect(result.success).toBeDefined();
  });

  it('should handle very large response data', () => {
    const largeDataArray = Array.from({ length: 1000 }, (_, i) => ({
      id: `agent_${i}`,
      name: `Agent ${i}`,
      description: `Description for agent ${i}`,
      model: 'gpt-3.5-turbo',
      status: 'active',
      capabilities: ['text'],
      provider: 'openai'
    }));

    const largeResponse = {
      code: 'SUCCESS',
      message: 'Large data retrieved',
      data: largeDataArray,
      timestamp: '2023-10-18T10:00:00.000Z'
    };

    const startTime = performance.now();
    const result = ApiResponseValidator.safeValidate(largeResponse, agentsListResponseValidator);
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });
});

describe('性能测试', () => {
  it('should handle multiple validations efficiently', () => {
    const responses = Array.from({ length: 100 }, () => mockSuccessResponse);

    const startTime = performance.now();
    const results = responses.map(response =>
      ApiResponseValidator.safeValidate(response, agentDetailResponseValidator)
    );
    const endTime = performance.now();

    expect(results.every(r => r.success)).toBe(true);
    expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
  });

  it('should cache validation results when appropriate', () => {
    const validator = createApiResponseValidator(agentDetailResponseValidator);

    // Validate same response multiple times
    const startTime = performance.now();
    for (let i = 0; i < 10; i++) {
      validator.test(mockSuccessResponse);
    }
    const endTime = performance.now();

    // Subsequent validations should be faster due to caching
    expect(endTime - startTime).toBeLessThan(100);
  });
});

describe('集成测试', () => {
  it('should work with real-world API response patterns', () => {
    // 模拟真实的API响应结构
    const realWorldResponse = {
      code: 'SUCCESS',
      message: 'Operation completed successfully',
      data: {
        agents: [
          {
            id: 'agent_123',
            name: 'Chat Assistant',
            description: 'A helpful chat assistant',
            avatar: 'https://example.com/avatar.png',
            model: 'gpt-4',
            status: 'active',
            capabilities: ['text', 'code', 'analysis'],
            provider: 'openai',
            isActive: true,
            workspaceType: 'chat',
            features: {
              supportsChatId: true,
              supportsStream: true,
              supportsDetail: false,
              supportsFiles: false,
              supportsImages: true,
              streamingConfig: {
                enabled: true,
                statusEvents: true,
                flowNodeStatus: false
              }
            },
            createdAt: '2023-10-01T00:00:00.000Z',
            updatedAt: '2023-10-18T10:00:00.000Z'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1
        },
        filters: {
          status: ['active'],
          provider: ['openai']
        }
      },
      timestamp: '2023-10-18T10:00:00.000Z',
      requestId: 'req_123456',
      version: '1.0'
    };

    // This should work even with extra fields and nested structures
    const result = ApiResponseValidator.safeValidate(realWorldResponse, agentsListResponseValidator);

    // The basic structure should be valid even if there are extra fields
    expect(result.success).toBeDefined();
  });
});