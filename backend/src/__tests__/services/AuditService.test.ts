import { AuditService } from '@/services/AuditService';
import { Pool } from 'pg';
import {
  AuditAction,
  AuditStatus,
  ResourceType,
  CreateAuditLogParams,
  AuditLogQuery,
} from '@/types/audit';
import { getPool } from '@/utils/db';

// Mock dependencies
jest.mock('@/utils/db', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(),
  })),
}));
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AuditService', () => {
  let auditService: AuditService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Pool mock
    mockPool = {
      query: jest.fn(),
    } as unknown as jest.Mocked<Pool>;

    (getPool as jest.Mock).mockReturnValue(mockPool);

    auditService = new AuditService();
  });

  describe('log', () => {
    it('应该成功记录审计日志', async () => {
      const params: CreateAuditLogParams = {
        userId: 'user-123',
        username: 'testuser',
        action: AuditAction.LOGIN,
        resourceType: ResourceType.USER,
        resourceId: 'user-123',
        details: { ip: '192.168.1.1' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: AuditStatus.SUCCESS,
      };

      const mockResult = {
        rows: [
          {
            id: 1,
            timestamp: new Date(),
            user_id: params.userId,
            username: params.username,
            action: params.action,
            resource_type: params.resourceType,
            resource_id: params.resourceId,
            details: params.details,
            ip_address: params.ipAddress,
            user_agent: params.userAgent,
            status: params.status,
            error_message: undefined,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValue(mockResult as never);

      const result = await auditService.log(params);

      expect(result).toBeDefined();
      expect(result.userId).toBe(params.userId);
      expect(result.action).toBe(params.action);
      expect(result.status).toBe(params.status);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          params.userId,
          params.username,
          params.action,
          params.resourceType,
          params.resourceId,
        ])
      );
    });

    it('应该默认使用 SUCCESS 状态', async () => {
      const params: CreateAuditLogParams = {
        action: AuditAction.LOGIN,
      };

      const mockResult = {
        rows: [
          {
            id: 1,
            timestamp: new Date(),
            user_id: undefined,
            username: undefined,
            action: params.action,
            resource_type: undefined,
            resource_id: undefined,
            details: undefined,
            ip_address: undefined,
            user_agent: undefined,
            status: AuditStatus.SUCCESS,
            error_message: undefined,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      };

      mockPool.query.mockResolvedValue(mockResult as never);

      const result = await auditService.log(params);

      expect(result.status).toBe(AuditStatus.SUCCESS);
    });

    it('应该在数据库错误时抛出 SystemError', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed') as never);

      await expect(
        auditService.log({ action: AuditAction.LOGIN })
      ).rejects.toThrow('Failed to create audit log');
    });
  });

  describe('query', () => {
    it('应该查询审计日志并返回分页结果', async () => {
      const query: AuditLogQuery = {
        userId: 'user-123',
        limit: 10,
        offset: 0,
      };

      const mockCountResult = {
        rows: [{ count: '25' }],
        rowCount: 1,
      };

      const mockDataResult = {
        rows: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          timestamp: new Date(),
          user_id: 'user-123',
          username: 'testuser',
          action: AuditAction.LOGIN,
          resource_type: ResourceType.USER,
          resource_id: 'user-123',
          details: {},
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          status: AuditStatus.SUCCESS,
          error_message: undefined,
          created_at: new Date(),
        })),
        rowCount: 10,
      };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      const result = await auditService.query(query);

      expect(result.logs).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(3);
    });

    it('应该支持多个 action 过滤', async () => {
      const query: AuditLogQuery = {
        action: [AuditAction.LOGIN, AuditAction.LOGOUT],
      };

      const mockCountResult = { rows: [{ count: '0' }], rowCount: 1 };
      const mockDataResult = { rows: [], rowCount: 0 };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      await auditService.query(query);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('action = ANY'),
        expect.any(Array)
      );
    });

    it('应该支持日期范围过滤', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      const query: AuditLogQuery = {
        startDate,
        endDate,
      };

      const mockCountResult = { rows: [{ count: '0' }], rowCount: 1 };
      const mockDataResult = { rows: [], rowCount: 0 };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      await auditService.query(query);

      const calls = mockPool.query.mock.calls;
      expect(calls[0]?.[1]).toContain(startDate);
      expect(calls[0]?.[1]).toContain(endDate);
    });
  });

  describe('getUserAuditLogs', () => {
    it('应该查询指定用户的审计日志', async () => {
      const mockCountResult = { rows: [{ count: '5' }], rowCount: 1 };
      const mockDataResult = { rows: [], rowCount: 0 };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      await auditService.getUserAuditLogs('user-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining(['user-123'])
      );
    });
  });

  describe('getResourceAuditLogs', () => {
    it('应该查询指定资源的审计日志', async () => {
      const mockCountResult = { rows: [{ count: '3' }], rowCount: 1 };
      const mockDataResult = { rows: [], rowCount: 0 };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      await auditService.getResourceAuditLogs(ResourceType.AGENT, 'agent-456');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $1'),
        expect.arrayContaining([ResourceType.AGENT, 'agent-456'])
      );
    });
  });

  describe('getRecentLogs', () => {
    it('应该返回最近的审计日志', async () => {
      const mockCountResult = { rows: [{ count: '100' }], rowCount: 1 };
      const mockDataResult = {
        rows: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          timestamp: new Date(),
          user_id: 'user-123',
          username: 'testuser',
          action: AuditAction.LOGIN,
          resource_type: ResourceType.USER,
          resource_id: 'user-123',
          details: {},
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          status: AuditStatus.SUCCESS,
          error_message: undefined,
          created_at: new Date(),
        })),
        rowCount: 100,
      };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      const result = await auditService.getRecentLogs(100);

      expect(result).toHaveLength(100);
    });
  });

  describe('getFailedLogs', () => {
    it('应该查询失败的审计日志', async () => {
      const mockCountResult = { rows: [{ count: '5' }], rowCount: 1 };
      const mockDataResult = { rows: [], rowCount: 0 };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      await auditService.getFailedLogs();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`status = $1`),
        expect.arrayContaining([AuditStatus.FAILURE])
      );
    });
  });

  describe('exportToCSV', () => {
    it('应该导出审计日志为 CSV 格式', async () => {
      const mockCountResult = { rows: [{ count: '2' }], rowCount: 1 };
      const mockDataResult = {
        rows: [
          {
            id: 1,
            timestamp: new Date('2025-01-01T10:00:00Z'),
            user_id: 'user-123',
            username: 'testuser',
            action: AuditAction.LOGIN,
            resource_type: ResourceType.USER,
            resource_id: 'user-123',
            details: {},
            ip_address: '192.168.1.1',
            user_agent: 'Mozilla/5.0',
            status: AuditStatus.SUCCESS,
            error_message: undefined,
            created_at: new Date(),
          },
          {
            id: 2,
            timestamp: new Date('2025-01-01T11:00:00Z'),
            user_id: 'user-456',
            username: 'admin',
            action: AuditAction.USER_CREATE,
            resource_type: ResourceType.USER,
            resource_id: 'new-user',
            details: {},
            ip_address: '192.168.1.2',
            user_agent: 'Chrome',
            status: AuditStatus.SUCCESS,
            error_message: undefined,
            created_at: new Date(),
          },
        ],
        rowCount: 2,
      };

      mockPool.query
        .mockResolvedValueOnce(mockCountResult as never)
        .mockResolvedValueOnce(mockDataResult as never);

      const csv = await auditService.exportToCSV({});

      expect(csv).toContain('"ID","Timestamp","User ID","Username","Action"');
      expect(csv).toContain('user-123');
      expect(csv).toContain('testuser');
      expect(csv).toContain('LOGIN');
    });
  });

  describe('cleanupOldLogs', () => {
    it('应该删除过期的审计日志', async () => {
      const mockResult = {
        rowCount: 150,
      };

      mockPool.query.mockResolvedValue(mockResult as never);

      const deletedCount = await auditService.cleanupOldLogs(90);

      expect(deletedCount).toBe(150);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM audit_logs'),
        expect.any(Array)
      );
    });

    it('应该使用默认保留天数（90天）', async () => {
      const mockResult = { rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult as never);

      await auditService.cleanupOldLogs();

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('应该返回审计统计信息', async () => {
      const mockTotalResult = { rows: [{ count: '100' }], rowCount: 1 };
      const mockStatusResult = {
        rows: [
          { status: AuditStatus.SUCCESS, count: '80' },
          { status: AuditStatus.FAILURE, count: '20' },
        ],
        rowCount: 2,
      };
      const mockActionResult = {
        rows: [
          { action: AuditAction.LOGIN, count: '50' },
          { action: AuditAction.LOGOUT, count: '30' },
        ],
        rowCount: 2,
      };
      const mockUserResult = {
        rows: [
          { user_id: 'user-1', username: 'alice', count: '25' },
          { user_id: 'user-2', username: 'bob', count: '20' },
        ],
        rowCount: 2,
      };

      mockPool.query
        .mockResolvedValueOnce(mockTotalResult as never)
        .mockResolvedValueOnce(mockStatusResult as never)
        .mockResolvedValueOnce(mockActionResult as never)
        .mockResolvedValueOnce(mockUserResult as never);

      const statistics = await auditService.getStatistics();

      expect(statistics.totalLogs).toBe(100);
      expect(statistics.successCount).toBe(80);
      expect(statistics.failureCount).toBe(20);
      expect(statistics.actionCounts[AuditAction.LOGIN]).toBe(50);
      expect(statistics.topUsers).toHaveLength(2);
      expect(statistics.topUsers[0]?.userId).toBe('user-1');
    });
  });
});

