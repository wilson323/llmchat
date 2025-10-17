import type { Request, Response } from 'express';
import { auditService } from '@/services/AuditService';
import type { AuditAction, AuditStatus, ResourceType } from '@/types/audit';
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';
import type { AuditLogQueryValidation } from '@/types/validation';

/**
 * 审计日志控制器
 */
export class AuditController {
  /**
   * 查询审计日志
   * GET /api/audit/logs
   */
  async query(req: Request, res: Response) {
    try {
      const {
        userId,
        action,
        resourceType,
        resourceId,
        status,
        startDate,
        endDate,
        limit,
        offset,
        orderBy,
        orderDirection,
      } = req.query;

      const queryParams: Partial<AuditLogQueryValidation> = {};

      // 只添加非 undefined 的属性
      if (userId) {
        queryParams.userId = userId as string;
      }
      if (action) {
        queryParams.action = action as string;
      }
      if (resourceType) {
        queryParams.resourceType = resourceType as string;
      }
      if (resourceId) {
        queryParams.resourceId = resourceId as string;
      }
      if (status) {
        queryParams.status = status as string;
      }
      if (startDate) {
        queryParams.startDate = new Date(startDate as string);
      }
      if (endDate) {
        queryParams.endDate = new Date(endDate as string);
      }
      if (limit) {
        queryParams.limit = parseInt(limit as string, 10);
      }
      if (offset) {
        queryParams.offset = parseInt(offset as string, 10);
      }
      if (orderBy) {
        queryParams.orderBy = orderBy as string;
      }
      if (orderDirection) {
        queryParams.orderDirection = orderDirection as 'ASC' | 'DESC';
      }

      const result = await auditService.query(queryParams as any);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '查询审计日志成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error: any) {
      logger.error('Failed to query audit logs', {
        component: 'AuditController',
        error,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to query audit logs',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 获取用户审计日志
   * GET /api/audit/users/:userId
   */
  async getUserLogs(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USER_ID',
          message: '用户ID不能为空',
        });
      }

      const { limit, offset, startDate, endDate } = req.query;

      const options: {limit?: number; offset?: number; startDate?: Date; endDate?: Date} = {};
      if (limit) {
        options.limit = parseInt(limit as string, 10);
      }
      if (offset) {
        options.offset = parseInt(offset as string, 10);
      }
      if (startDate) {
        options.startDate = new Date(startDate as string);
      }
      if (endDate) {
        options.endDate = new Date(endDate as string);
      }

      const result = await auditService.getUserAuditLogs(userId, options);

      return ApiResponseHandler.sendSuccess(res, result, {
        message: '获取用户审计日志成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error: any) {
      logger.error('Failed to get user audit logs', {
        component: 'AuditController',
        error,
        userId: req.params.userId,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get user audit logs',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 获取资源审计日志
   * GET /api/audit/resources/:resourceType/:resourceId
   */
  async getResourceLogs(req: Request, res: Response) {
    try {
      const { resourceType, resourceId } = req.params;
      if (!resourceType || !resourceId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PARAMETERS',
          message: '资源类型和资源ID不能为空',
        });
      }

      const { limit, offset } = req.query;

      const options: {limit?: number; offset?: number; startDate?: Date; endDate?: Date} = {};
      if (limit) {
        options.limit = parseInt(limit as string, 10);
      }
      if (offset) {
        options.offset = parseInt(offset as string, 10);
      }

      const result = await auditService.getResourceAuditLogs(
        resourceType as ResourceType,
        resourceId,
        options,
      );

      return ApiResponseHandler.sendSuccess(res, result, {
        message: '获取资源审计日志成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error: any) {
      logger.error('Failed to get resource audit logs', {
        component: 'AuditController',
        error,
        resourceType: req.params.resourceType,
        resourceId: req.params.resourceId,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get resource audit logs',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 获取最近的审计日志
   * GET /api/audit/recent
   */
  async getRecentLogs(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const logs = await auditService.getRecentLogs(
        limit ? parseInt(limit as string, 10) : undefined,
      );

      ApiResponseHandler.sendSuccess(res, logs, {
        message: '获取最近审计日志成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error: any) {
      logger.error('Failed to get recent audit logs', {
        component: 'AuditController',
        error,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get recent audit logs',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 获取失败的审计日志
   * GET /api/audit/failures
   */
  async getFailedLogs(req: Request, res: Response) {
    try {
      const { limit, offset, startDate, endDate } = req.query;

      const options: {limit?: number; offset?: number; startDate?: Date; endDate?: Date} = {};
      if (limit) {
        options.limit = parseInt(limit as string, 10);
      }
      if (offset) {
        options.offset = parseInt(offset as string, 10);
      }
      if (startDate) {
        options.startDate = new Date(startDate as string);
      }
      if (endDate) {
        options.endDate = new Date(endDate as string);
      }

      const result = await auditService.getFailedLogs(options);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取失败审计日志成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error: any) {
      logger.error('Failed to get failed audit logs', {
        component: 'AuditController',
        error,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get failed audit logs',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 导出审计日志（CSV）
   * GET /api/audit/export
   */
  async exportLogs(req: Request, res: Response) {
    try {
      const {
        userId,
        action,
        resourceType,
        resourceId,
        status,
        startDate,
        endDate,
      } = req.query;

      const queryParams: Record<string, unknown> = {};
      if (userId) {
        queryParams.userId = userId as string;
      }
      if (action) {
        queryParams.action = Array.isArray(action)
          ? (action as AuditAction[])
          : (action as AuditAction);
      }
      if (resourceType) {
        queryParams.resourceType = resourceType as ResourceType;
      }
      if (resourceId) {
        queryParams.resourceId = resourceId as string;
      }
      if (status) {
        queryParams.status = status as AuditStatus;
      }
      if (startDate) {
        queryParams.startDate = new Date(startDate as string);
      }
      if (endDate) {
        queryParams.endDate = new Date(endDate as string);
      }

      const csv = await auditService.exportToCSV(queryParams);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      res.send(csv);
    } catch (error: any) {
      logger.error('Failed to export audit logs', {
        component: 'AuditController',
        error,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to export audit logs',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 获取审计统计信息
   * GET /api/audit/statistics
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const options: { startDate?: Date; endDate?: Date } = {};
      if (startDate) {
        options.startDate = new Date(startDate as string);
      }
      if (endDate) {
        options.endDate = new Date(endDate as string);
      }

      const statistics = await auditService.getStatistics(options);

      ApiResponseHandler.sendSuccess(res, statistics, {
        message: '获取审计统计成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error: any) {
      logger.error('Failed to get audit statistics', {
        component: 'AuditController',
        error,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get audit statistics',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }
}

export const auditController = new AuditController();

