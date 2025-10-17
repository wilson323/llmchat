import type { Pool } from 'pg';
import { getPool } from '@/utils/db';
import logger from '@/utils/logger';
import type {
  AuditLog,
  CreateAuditLogParams,
  AuditLogQuery,
  AuditLogQueryResult,
  AuditAction,
  ResourceType} from '@/types/audit';
import {
  AuditStatus
} from '@/types/audit';
import { SystemError } from '@/types/errors';

/**
 * 审计日志服务
 *
 * 职责：
 * - 记录所有关键安全操作
 * - 提供审计日志查询接口
 * - 确保审计日志不可篡改
 * - 支持审计日志导出
 */
export class AuditService {
  /**
   * 延迟获取数据库连接池
   * 避免在模块导入时调用 getPool()，确保 initDB() 已执行
   */
  private get pool(): Pool {
    return getPool();
  }

  // 构造函数不再需要，使用 getter 延迟获取连接池

  /**
   * 记录审计日志（使用优化的数据库连接）
   */
  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    const {
      userId,
      username,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent,
      status = AuditStatus.SUCCESS,
      errorMessage,
    } = params;

    try {
      const pool = getPool();
      const result = await pool.query(
        `INSERT INTO audit_logs (
          user_id, username, action, resource_type, resource_id,
          details, ip_address, user_agent, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          userId,
          username,
          action,
          resourceType,
          resourceId,
          details ? JSON.stringify(details) : null,
          ipAddress,
          userAgent,
          status,
          errorMessage,
        ],
      );

      const auditLog = this.mapRowToAuditLog((result as any).rows[0]);

      // 同时写入 Winston 日志
      logger.info('AUDIT_LOG', {
        component: 'AuditService',
        auditLog,
      });

      return auditLog;
    } catch (error: any) {
      logger.error('Failed to create audit log', {
        component: 'AuditService',
        error,
        params,
      });

      throw new SystemError({
        message: 'Failed to create audit log',
        code: 'AUDIT_LOG_CREATE_FAILED',
        originalError: error as Error,
      });
    }
  }

  /**
   * 查询审计日志（使用优化的数据库连接）
   */
  async query(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      orderBy = 'timestamp',
      orderDirection = 'DESC',
    } = query;

    const pool = getPool();

    try {
      // 构建查询条件
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        values.push(userId);
      }

      if (action) {
        if (Array.isArray(action)) {
          conditions.push(`action = ANY($${paramIndex++})`);
          values.push(action);
        } else {
          conditions.push(`action = $${paramIndex++}`);
          values.push(action);
        }
      }

      if (resourceType) {
        conditions.push(`resource_type = $${paramIndex++}`);
        values.push(resourceType);
      }

      if (resourceId) {
        conditions.push(`resource_id = $${paramIndex++}`);
        values.push(resourceId);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        values.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询总数（使用缓存）
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
        values,
      );
      const total = parseInt((countResult as any).rows[0]?.count || '0', 10);

      // 查询数据（使用缓存）
      const dataResult = await pool.query(
        `SELECT * FROM audit_logs ${whereClause}
         ORDER BY ${orderBy} ${orderDirection}
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset],
      );

      const logs = (dataResult as any).rows.map((row: any) => this.mapRowToAuditLog(row));

      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);

      return {
        logs,
        total,
        page,
        pageSize: limit,
        totalPages,
      };
    } catch (error: any) {
      logger.error('Failed to query audit logs', {
        component: 'AuditService',
        error,
        query,
      });

      throw new SystemError({
        message: 'Failed to query audit logs',
        code: 'AUDIT_LOG_QUERY_FAILED',
        originalError: error as Error,
      });
    }
  }

  /**
   * 获取用户审计日志
   */
  async getUserAuditLogs(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<AuditLogQueryResult> {
    return this.query({
      userId,
      ...options,
    });
  }

  /**
   * 获取资源审计日志
   */
  async getResourceAuditLogs(
    resourceType: ResourceType,
    resourceId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<AuditLogQueryResult> {
    return this.query({
      resourceType,
      resourceId,
      ...options,
    });
  }

  /**
   * 获取最近的审计日志
   */
  async getRecentLogs(limit = 100): Promise<AuditLog[]> {
    const result = await this.query({
      limit,
      offset: 0,
      orderBy: 'timestamp',
      orderDirection: 'DESC',
    });

    return result.logs;
  }

  /**
   * 获取失败的审计日志
   */
  async getFailedLogs(
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<AuditLogQueryResult> {
    return this.query({
      status: AuditStatus.FAILURE,
      ...options,
    });
  }

  /**
   * 导出审计日志（CSV格式）
   */
  async exportToCSV(query: AuditLogQuery): Promise<string> {
    const result = await this.query({
      ...query,
      limit: 10000, // 最多导出10000条
    });

    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Username',
      'Action',
      'Resource Type',
      'Resource ID',
      'Status',
      'IP Address',
      'User Agent',
      'Error Message',
    ];

    const rows = result.logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.userId || '',
      log.username || '',
      log.action,
      log.resourceType || '',
      log.resourceId || '',
      log.status,
      log.ipAddress || '',
      log.userAgent || '',
      log.errorMessage || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }

  /**
   * 清理过期审计日志
   *
   * @param retentionDays 保留天数，默认90天
   */
  async cleanupOldLogs(retentionDays = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.pool.query(
        'DELETE FROM audit_logs WHERE timestamp < $1',
        [cutoffDate],
      );

      const deletedCount = result.rowCount || 0;

      logger.info('Cleaned up old audit logs', {
        component: 'AuditService',
        retentionDays,
        cutoffDate,
        deletedCount,
      });

      return deletedCount;
    } catch (error: any) {
      logger.error('Failed to cleanup old audit logs', {
        component: 'AuditService',
        error,
        retentionDays,
      });

      throw new SystemError({
        message: 'Failed to cleanup old audit logs',
        code: 'AUDIT_LOG_CLEANUP_FAILED',
        originalError: error as Error,
      });
    }
  }

  /**
   * 获取审计统计信息
   */
  async getStatistics(
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{
    totalLogs: number;
    successCount: number;
    failureCount: number;
    actionCounts: Record<string, number>;
    topUsers: Array<{ userId: string; username: string; count: number }>;
  }> {
    const { startDate, endDate } = options;

    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        values.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 总数统计
      const totalResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
        values,
      );
      const totalLogs = parseInt(totalResult.rows[0]?.count || '0', 10);

      // 成功/失败统计
      const statusResult = await this.pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY status`,
        values,
      );

      let successCount = 0;
      let failureCount = 0;

      statusResult.rows.forEach((row) => {
        const count = parseInt(row.count, 10);
        if (row.status === AuditStatus.SUCCESS) {
          successCount = count;
        } else if (row.status === AuditStatus.FAILURE) {
          failureCount = count;
        }
      });

      // 操作类型统计
      const actionResult = await this.pool.query<{ action: string; count: string }>(
        `SELECT action, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY action ORDER BY count DESC`,
        values,
      );

      const actionCounts: Record<string, number> = {};
      actionResult.rows.forEach((row) => {
        actionCounts[row.action] = parseInt(row.count, 10);
      });

      // Top 用户统计
      const userResult = await this.pool.query<{ user_id: string; username: string; count: string }>(
        `SELECT user_id, username, COUNT(*) as count 
         FROM audit_logs 
         ${whereClause} AND user_id IS NOT NULL
         GROUP BY user_id, username 
         ORDER BY count DESC 
         LIMIT 10`,
        values,
      );

      const topUsers = userResult.rows.map((row) => ({
        userId: row.user_id,
        username: row.username || 'Unknown',
        count: parseInt(row.count, 10),
      }));

      return {
        totalLogs,
        successCount,
        failureCount,
        actionCounts,
        topUsers,
      };
    } catch (error: any) {
      logger.error('Failed to get audit statistics', {
        component: 'AuditService',
        error,
        options,
      });

      throw new SystemError({
        message: 'Failed to get audit statistics',
        code: 'AUDIT_STATS_FAILED',
        originalError: error as Error,
      });
    }
  }

  /**
   * 辅助方法：将数据库行映射为 AuditLog
   */
  private mapRowToAuditLog(row: unknown): AuditLog {
    const r = row as Record<string, unknown>;
    const log: AuditLog = {
      id: r.id as number,
      timestamp: new Date(r.timestamp as string),
      action: r.action as AuditAction,
      status: r.status as AuditStatus,
      createdAt: new Date(r.created_at as string),
    };

    // 只在有值时添加可选字段
    if (r.user_id) {
      log.userId = r.user_id as string;
    }
    if (r.username) {
      log.username = r.username as string;
    }
    if (r.resource_type) {
      log.resourceType = r.resource_type as ResourceType;
    }
    if (r.resource_id) {
      log.resourceId = r.resource_id as string;
    }
    if (r.details) {
      log.details = r.details as Record<string, unknown>;
    }
    if (r.ip_address) {
      log.ipAddress = r.ip_address as string;
    }
    if (r.user_agent) {
      log.userAgent = r.user_agent as string;
    }
    if (r.error_message) {
      log.errorMessage = r.error_message as string;
    }

    return log;
  }
}

// 导出单例
export const auditService = new AuditService();

