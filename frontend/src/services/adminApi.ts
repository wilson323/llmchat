
import { api } from './api';
import type { ApiSuccessPayload } from '@/types/dynamic';
import type {
  ApiResult,
  PaginatedResponse,
  UserManagementParams,
  LogQueryParams,
  LogLevel,
  UserRole,
  CreateUserPayload
} from './types/api-common';
import type { ApiErrorType } from './types/api-errors';
import { ApiErrorFactory, ApiErrorHandler } from './types/api-errors';

// ============================================================================
// 管理后台相关类型定义
// ============================================================================

/**
 * 系统信息接口
 */
export interface SystemInfo {
  platform: string;
  release: string;
  arch: string;
  nodeVersion: string;
  uptimeSec: number;
  memory: {
    total: number;
    free: number;
    used: number;
    rss: number;
    usagePercentage: number;
  };
  cpu: {
    count: number;
    load1: number;
    load5: number;
    load15: number;
    usagePercentage: number;
  };
  disk?: {
    total: number;
    free: number;
    used: number;
    usagePercentage: number;
  };
  network?: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  };
  processes?: {
    running: number;
    sleeping: number;
    total: number;
  };
  lastUpdated: string;
}

/**
 * 日志项接口
 */
export interface LogItem {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  module?: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  stack?: string; // 错误日志的堆栈信息
}

/**
 * 日志查询参数
 */
export interface GetLogsParams extends LogQueryParams {
  module?: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  search?: string;
}

/**
 * 分页日志响应
 */
export interface LogsPage extends PaginatedResponse<LogItem> {
  summary: {
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
  };
}

/**
 * 管理员用户接口
 */
export interface AdminUser {
  id: number;
  username: string;
  email?: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  loginCount?: number;
  avatar?: string;
  preferences?: Record<string, unknown>;
}

/**
 * 用户统计信息
 */
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersByRole: Record<UserRole, number>;
  loginStats: {
    totalLogins: number;
    uniqueLogins: number;
    averageLoginsPerUser: number;
  };
}

/**
 * 系统统计信息
 */
export interface SystemStats {
  uptime: number;
  totalRequests: number;
  requestsPerSecond: number;
  errorRate: number;
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  activeConnections: number;
  databaseConnections: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * 审计日志项
 */
export interface AuditLogItem {
  id: string;
  timestamp: string;
  userId?: string;
  username?: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  duration?: number;
}

/**
 * 审计日志查询参数
 */
export interface AuditLogParams extends QueryParams {
  userId?: string;
  action?: string;
  resource?: string;
  result?: 'success' | 'failure';
  startDate?: string;
  endDate?: string;
}

/**
 * 系统配置项
 */
export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  category: string;
  isPublic: boolean;
  isEditable: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * 备份信息
 */
export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  type: 'full' | 'incremental';
  status: 'creating' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  createdBy: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 系统维护任务
 */
export interface MaintenanceTask {
  id: string;
  name: string;
  description?: string;
  type: 'cleanup' | 'backup' | 'update' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  result?: unknown;
  error?: string;
  createdBy: string;
  isRecurring: boolean;
  recurrencePattern?: string;
}

// ============================================================================
// 管理后台API服务类
// ============================================================================

/**
 * 管理后台API服务 - 提供类型安全的管理功能
 */
export class AdminApiService {
  /**
   * 获取系统信息
   */
  static async getSystemInfo(): Promise<ApiResult<SystemInfo>> {
    try {
      const response = await api.get<ApiSuccessPayload<SystemInfo>>('/admin/system-info');

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/system-info',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取系统统计信息
   */
  static async getSystemStats(): Promise<ApiResult<SystemStats>> {
    try {
      const response = await api.get<ApiSuccessPayload<SystemStats>>('/admin/stats');

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/stats',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取日志列表（分页）
   */
  static async getLogsPage(params?: GetLogsParams): Promise<ApiResult<LogsPage>> {
    try {
      const response = await api.get<ApiSuccessPayload<LogsPage>>('/admin/logs', {
        params: {
          level: params?.level,
          start: params?.startDate,
          end: params?.endDate,
          page: params?.page || 1,
          pageSize: params?.pageSize || 50,
          module: params?.module,
          userId: params?.userId,
          agentId: params?.agentId,
          sessionId: params?.sessionId,
          search: params?.search,
          sortBy: params?.sortBy || 'timestamp',
          sortOrder: params?.sortOrder || 'desc'
        }
      });

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/logs',
        method: 'GET',
        additional: { params }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取所有日志（不分页，谨慎使用）
   */
  static async getLogs(params?: GetLogsParams): Promise<ApiResult<LogItem[]>> {
    try {
      const pageResult = await this.getLogsPage({
        ...params,
        pageSize: 10000 // 设置较大的页面大小
      });

      if (!pageResult.success) {
        return pageResult as ApiResult<LogItem[]>;
      }

      return {
        success: true,
        data: pageResult.data.items,
        metadata: pageResult.metadata
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/logs',
        method: 'GET',
        additional: { params }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 导出日志为CSV
   */
  static async exportLogsCsv(params?: GetLogsParams): Promise<ApiResult<string>> {
    try {
      const response = await api.get<string>('/admin/logs/export', {
        params: {
          level: params?.level,
          start: params?.startDate,
          end: params?.endDate,
          module: params?.module,
          userId: params?.userId,
          agentId: params?.agentId,
          search: params?.search
        },
        responseType: 'text'
      });

      return {
        success: true,
        data: response.data,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/logs/export',
        method: 'GET',
        additional: { params }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取用户列表（分页）
   */
  static async getUsers(params?: UserManagementParams): Promise<ApiResult<PaginatedResponse<AdminUser>>> {
    try {
      const response = await api.get<ApiSuccessPayload<PaginatedResponse<AdminUser>>>('/admin/users', {
        params: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          role: params?.role,
          status: params?.status,
          search: params?.search,
          sortBy: params?.sortBy || 'createdAt',
          sortOrder: params?.sortOrder || 'desc'
        }
      });

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/users',
        method: 'GET',
        additional: { params }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取用户统计信息
   */
  static async getUserStats(): Promise<ApiResult<UserStats>> {
    try {
      const response = await api.get<ApiSuccessPayload<UserStats>>('/admin/users/stats');

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/users/stats',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 创建用户
   */
  static async createUser(payload: CreateUserPayload): Promise<ApiResult<AdminUser>> {
    try {
      // 验证输入数据
      if (!payload.username || payload.username.length < 3) {
        throw ApiErrorFactory.validationError('用户名至少3个字符', {
          field: 'username',
          value: payload.username
        });
      }

      if (!payload.password || payload.password.length < 8) {
        throw ApiErrorFactory.validationError('密码至少8个字符', {
          field: 'password',
          value: '[PROTECTED]'
        });
      }

      const response = await api.post<ApiSuccessPayload<AdminUser>>('/admin/users/create', payload);

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/users/create',
        method: 'POST',
        additional: { username: payload.username }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 更新用户
   */
  static async updateUser(payload: {
    id: number;
    role?: UserRole;
    status?: string;
    email?: string;
  }): Promise<ApiResult<AdminUser>> {
    try {
      const response = await api.post<ApiSuccessPayload<AdminUser>>('/admin/users/update', payload);

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/users/update',
        method: 'POST',
        additional: { userId: payload.id }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 重置用户密码
   */
  static async resetUserPassword(payload: {
    id: number;
    newPassword?: string;
  }): Promise<ApiResult<{ ok: boolean; newPassword: string }>> {
    try {
      const response = await api.post<{ ok: boolean; newPassword: string }>(
        '/admin/users/reset-password',
        payload
      );

      return {
        success: true,
        data: response.data,
        metadata: {
          requestId: response.data.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/users/reset-password',
        method: 'POST',
        additional: { userId: payload.id }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 删除用户
   */
  static async deleteUser(id: number): Promise<ApiResult<void>> {
    try {
      await api.delete(`/admin/users/${id}`);

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/admin/users/${id}`,
        method: 'DELETE',
        additional: { userId: id }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取审计日志
   */
  static async getAuditLogs(params?: AuditLogParams): Promise<ApiResult<PaginatedResponse<AuditLogItem>>> {
    try {
      const response = await api.get<ApiSuccessPayload<PaginatedResponse<AuditLogItem>>>('/admin/audit-logs', {
        params: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 50,
          userId: params?.userId,
          action: params?.action,
          resource: params?.resource,
          result: params?.result,
          startDate: params?.startDate,
          endDate: params?.endDate,
          sortBy: params?.sortBy || 'timestamp',
          sortOrder: params?.sortOrder || 'desc'
        }
      });

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/audit-logs',
        method: 'GET',
        additional: { params }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取系统配置
   */
  static async getSystemConfig(category?: string): Promise<ApiResult<SystemConfig[]>> {
    try {
      const response = await api.get<ApiSuccessPayload<SystemConfig[]>>('/admin/config', {
        params: { category }
      });

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/config',
        method: 'GET',
        additional: { category }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 更新系统配置
   */
  static async updateSystemConfig(configId: string, value: string): Promise<ApiResult<SystemConfig>> {
    try {
      const response = await api.put<ApiSuccessPayload<SystemConfig>>(`/admin/config/${configId}`, {
        value
      });

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/admin/config/${configId}`,
        method: 'PUT',
        additional: { configId, value }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取备份列表
   */
  static async getBackups(): Promise<ApiResult<BackupInfo[]>> {
    try {
      const response = await api.get<ApiSuccessPayload<BackupInfo[]>>('/admin/backups');

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/backups',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 创建备份
   */
  static async createBackup(type: 'full' | 'incremental', description?: string): Promise<ApiResult<BackupInfo>> {
    try {
      const response = await api.post<ApiSuccessPayload<BackupInfo>>('/admin/backups', {
        type,
        description
      });

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/backups',
        method: 'POST',
        additional: { type, description }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取维护任务列表
   */
  static async getMaintenanceTasks(): Promise<ApiResult<MaintenanceTask[]>> {
    try {
      const response = await api.get<ApiSuccessPayload<MaintenanceTask[]>>('/admin/maintenance/tasks');

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/admin/maintenance/tasks',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 执行维护任务
   */
  static async executeMaintenanceTask(taskId: string): Promise<ApiResult<MaintenanceTask>> {
    try {
      const response = await api.post<ApiSuccessPayload<MaintenanceTask>>(`/admin/maintenance/tasks/${taskId}/execute`);

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/admin/maintenance/tasks/${taskId}/execute`,
        method: 'POST',
        additional: { taskId }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }
}

// ============================================================================
// 向后兼容的函数式API
// ============================================================================

/**
 * @deprecated 使用 AdminApiService.getSystemInfo 替代
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const result = await AdminApiService.getSystemInfo();

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AdminApiService.getLogsPage 替代
 */
export async function getLogsPage(params?: GetLogsParams): Promise<LogsPage> {
  const result = await AdminApiService.getLogsPage(params);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AdminApiService.getLogs 替代
 */
export async function getLogs(params?: GetLogsParams): Promise<LogItem[]> {
  const result = await AdminApiService.getLogs(params);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AdminApiService.getUsers 替代
 */
export async function getUsers(): Promise<AdminUser[]> {
  const result = await AdminApiService.getUsers();

  if (!result.success) {
    throw result.error;
  }

  return result.data.items;
}

/**
 * @deprecated 使用 AdminApiService.createUser 替代
 */
export async function createUser(payload: {
  username: string;
  password: string;
  role?: string;
  status?: string;
}): Promise<AdminUser> {
  const result = await AdminApiService.createUser({
    ...payload,
    confirmPassword: payload.password // 向后兼容
  });

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AdminApiService.updateUser 替代
 */
export async function updateUser(payload: {
  id: number;
  role?: string;
  status?: string;
}): Promise<AdminUser> {
  const result = await AdminApiService.updateUser(payload);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AdminApiService.resetUserPassword 替代
 */
export async function resetUserPassword(payload: {
  id: number;
  newPassword?: string;
}): Promise<{ ok: boolean; newPassword: string }> {
  const result = await AdminApiService.resetUserPassword(payload);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AdminApiService.exportLogsCsv 替代
 */
export async function exportLogsCsv(params?: GetLogsParams): Promise<string> {
  const result = await AdminApiService.exportLogsCsv(params);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
