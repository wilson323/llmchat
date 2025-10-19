/**
 * API服务集成测试用例
 *
 * 测试所有API服务的类型安全性、错误处理和响应验证
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentsApiService } from '../agentsApi';
import { AuthApiService } from '../authApi';
import { AdminApiService } from '../adminApi';
import { ApiErrorFactory, ApiErrorHandler } from '../types/api-errors';
import type { ApiResult } from '../types/api-common';

// Mock API客户端
vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../api';

describe('API服务集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 设置默认的mock响应
    vi.mocked(api.get).mockResolvedValue({
      data: {
        code: 'SUCCESS',
        message: '操作成功',
        data: null,
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id',
        metadata: { duration: 100 }
      }
    });

    vi.mocked(api.post).mockResolvedValue({
      data: {
        code: 'SUCCESS',
        message: '操作成功',
        data: null,
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id',
        metadata: { duration: 100 }
      }
    });

    vi.mocked(api.put).mockResolvedValue({
      data: {
        code: 'SUCCESS',
        message: '操作成功',
        data: null,
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id',
        metadata: { duration: 100 }
      }
    });

    vi.mocked(api.delete).mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AgentsApiService', () => {
    it('应该成功获取智能体列表', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: '测试智能体',
          description: '这是一个测试智能体',
          status: 'active' as const,
          provider: 'fastgpt',
          capabilities: ['chat'],
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '获取成功',
          data: mockAgents,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 150 }
        }
      });

      const result = await AgentsApiService.listAgents();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAgents);
      expect(result.metadata?.requestId).toBe('test-request-id');
      expect(api.get).toHaveBeenCalledWith('/agents', {
        params: {}
      });
    });

    it('应该正确处理智能体列表查询参数', async () => {
      await AgentsApiService.listAgents({
        includeInactive: true,
        provider: 'fastgpt',
        status: 'active',
        search: 'test',
        page: 1,
        pageSize: 20
      });

      expect(api.get).toHaveBeenCalledWith('/agents', {
        params: {
          includeInactive: 'true',
          provider: 'fastgpt',
          status: 'active',
          search: 'test',
          page: 1,
          pageSize: 20
        }
      });
    });

    it('应该成功创建智能体', async () => {
      const payload = {
        name: '新智能体',
        provider: 'fastgpt' as const,
        endpoint: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo'
      };

      const createdAgent = {
        ...payload,
        id: 'agent-2',
        status: 'active' as const,
        createdAt: '2023-01-01T00:00:00Z'
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '创建成功',
          data: createdAgent,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 200 }
        }
      });

      const result = await AgentsApiService.createAgent(payload);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdAgent);
      expect(api.post).toHaveBeenCalledWith('/agents', payload);
    });

    it('应该正确处理API错误', async () => {
      const error = new Error('Network error');
      vi.mocked(api.get).mockRejectedValueOnce(error);

      const result = await AgentsApiService.listAgents();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toBe('Network error');
    });

    it('应该成功验证智能体', async () => {
      const validationData = {
        agentId: 'agent-1',
        isValid: true,
        exists: true,
        isActive: true
      };

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '验证成功',
          data: validationData,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 100 }
        }
      });

      const result = await AgentsApiService.validateAgent('agent-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validationData);
      expect(api.get).toHaveBeenCalledWith('/agents/agent-1/validate');
    });
  });

  describe('AuthApiService', () => {
    it('应该成功登录', async () => {
      const credentials = {
        username: 'testuser',
        password: 'testpass'
      };

      const loginResponse = {
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          username: 'testuser',
          role: 'user' as const,
          email: 'test@example.com',
          createdAt: '2023-01-01T00:00:00Z'
        },
        expiresIn: 3600,
        tokenType: 'Bearer' as const
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '登录成功',
          data: loginResponse,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 300 }
        }
      });

      const result = await AuthApiService.login(credentials);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(loginResponse);
      expect(api.post).toHaveBeenCalledWith('/auth/login', credentials);
    });

    it('应该正确处理登录响应数据验证', async () => {
      // 模拟无效响应
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '登录成功',
          data: {
            // 缺少必要字段
            token: '',
            user: null
          },
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id'
        }
      });

      const result = await AuthApiService.login({
        username: 'testuser',
        password: 'testpass'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.message).toBe('登录响应数据不完整');
    });

    it('应该正确处理认证错误', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      vi.mocked(api.post).mockRejectedValueOnce(authError);

      const result = await AuthApiService.login({
        username: 'testuser',
        password: 'wrongpass'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_TOKEN');
      expect(result.error?.requiresReauth).toBe(true);
    });

    it('应该成功修改密码', async () => {
      const payload = {
        oldPassword: 'oldpass',
        newPassword: 'newpass',
        confirmPassword: 'newpass'
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '密码修改成功',
          data: { success: true },
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 250 }
        }
      });

      const result = await AuthApiService.changePassword(payload);

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        oldPassword: payload.oldPassword,
        newPassword: payload.newPassword
      });
    });

    it('应该验证密码复杂性', async () => {
      const result = await AuthApiService.changePassword({
        oldPassword: 'oldpass',
        newPassword: 'short', // 太短
        confirmPassword: 'short'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toBe('新密码长度至少8位');
      expect(result.error?.field).toBe('newPassword');
    });
  });

  describe('AdminApiService', () => {
    it('应该成功获取系统信息', async () => {
      const systemInfo = {
        platform: 'linux',
        release: '5.4.0',
        arch: 'x64',
        nodeVersion: '18.0.0',
        uptimeSec: 3600,
        memory: {
          total: 8000000000,
          free: 4000000000,
          used: 4000000000,
          rss: 2000000000,
          usagePercentage: 50
        },
        cpu: {
          count: 4,
          load1: 1.5,
          load5: 1.2,
          load15: 1.0,
          usagePercentage: 25
        },
        lastUpdated: new Date().toISOString()
      };

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '获取成功',
          data: systemInfo,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 100 }
        }
      });

      const result = await AdminApiService.getSystemInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(systemInfo);
      expect(api.get).toHaveBeenCalledWith('/admin/system-info');
    });

    it('应该成功获取分页日志', async () => {
      const logsPage = {
        items: [
          {
            id: 'log-1',
            timestamp: '2023-01-01T00:00:00Z',
            level: 'INFO' as const,
            message: '测试日志消息',
            module: 'test'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        summary: {
          totalLogs: 1,
          errorCount: 0,
          warnCount: 0,
          infoCount: 1,
          debugCount: 0
        }
      };

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '获取成功',
          data: logsPage,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 120 }
        }
      });

      const result = await AdminApiService.getLogsPage({
        level: 'INFO',
        page: 1,
        pageSize: 50
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(logsPage);
      expect(api.get).toHaveBeenCalledWith('/admin/logs', {
        params: {
          level: 'INFO',
          start: undefined,
          end: undefined,
          page: 1,
          pageSize: 50,
          module: undefined,
          userId: undefined,
          agentId: undefined,
          sessionId: undefined,
          search: undefined,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        }
      });
    });

    it('应该成功创建用户', async () => {
      const payload = {
        username: 'newuser',
        password: 'password123',
        confirmPassword: 'password123',
        role: 'user' as const
      };

      const createdUser = {
        id: 2,
        username: 'newuser',
        role: 'user' as const,
        status: 'active' as const,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: '创建成功',
          data: createdUser,
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id',
          metadata: { duration: 200 }
        }
      });

      const result = await AdminApiService.createUser(payload);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdUser);
      expect(api.post).toHaveBeenCalledWith('/admin/users/create', payload);
    });

    it('应该验证用户创建参数', async () => {
      const result = await AdminApiService.createUser({
        username: 'ab', // 太短
        password: 'short', // 太短
        confirmPassword: 'short'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toBe('用户名至少3个字符');
    });
  });

  describe('错误处理', () => {
    it('应该正确处理网络错误', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'TimeoutError';
      vi.mocked(api.get).mockRejectedValueOnce(networkError);

      const result = await AgentsApiService.listAgents();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT_ERROR');
      expect(result.error?.message).toBe('Network timeout');
    });

    it('应该正确处理服务器错误', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).response = { status: 500 };
      vi.mocked(api.get).mockRejectedValueOnce(serverError);

      const result = await AgentsApiService.listAgents();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.statusCode).toBe(500);
    });

    it('应该正确处理401认证错误', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      vi.mocked(api.get).mockRejectedValueOnce(authError);

      const result = await AdminApiService.getSystemInfo();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_TOKEN');
    });

    it('应该正确处理429限流错误', async () => {
      const rateLimitError = new Error('Too Many Requests');
      (rateLimitError as any).response = {
        status: 429,
        headers: {
          'retry-after': '60'
        }
      };
      vi.mocked(api.get).mockRejectedValueOnce(rateLimitError);

      const result = await AgentsApiService.listAgents();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      expect((result.error as any)?.retryAfter).toBe(60);
    });
  });

  describe('类型安全验证', () => {
    it('应该确保返回类型符合接口定义', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        status: 'active' as const,
        provider: 'fastgpt',
        capabilities: ['chat']
      };

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          code: 'SUCCESS',
          message: 'Success',
          data: [mockAgent],
          timestamp: new Date().toISOString(),
          requestId: 'test-id'
        }
      });

      const result = await AgentsApiService.listAgents();

      // TypeScript编译时类型检查
      if (result.success) {
        // 这些访问应该是类型安全的
        expect(result.data[0].id).toBe('agent-1');
        expect(result.data[0].status).toBe('active');

        // 以下代码应该在TypeScript编译时报错
        // expect(result.data[0].invalidField).toBeDefined();
      }
    });

    it('应该正确处理泛型类型', async () => {
      const result: ApiResult<string[]> = await AgentsApiService.listAgents() as ApiResult<string[]>;

      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        // 类型系统应该知道result.data是string[]
      }
    });
  });

  describe('并发处理', () => {
    it('应该能正确处理并发请求', async () => {
      const mockAgents = Array.from({ length: 5 }, (_, i) => ({
        id: `agent-${i}`,
        name: `Agent ${i}`,
        status: 'active' as const,
        provider: 'fastgpt',
        capabilities: ['chat']
      }));

      vi.mocked(api.get).mockResolvedValue({
        data: {
          code: 'SUCCESS',
          message: 'Success',
          data: mockAgents,
          timestamp: new Date().toISOString(),
          requestId: 'test-id',
          metadata: { duration: 100 }
        }
      });

      // 并发执行多个请求
      const promises = Array.from({ length: 3 }, () => AgentsApiService.listAgents());
      const results = await Promise.all(promises);

      // 所有请求都应该成功
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockAgents);
      });
    });
  });
});