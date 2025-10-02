import { Request, Response } from 'express';
import { auditService } from '@/services/AuditService';
import { AuditAction, AuditStatus, ResourceType } from '@/types/audit';
import logger from '@/utils/logger';

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

      const result = await auditService.query({
        userId: userId as string | undefined,
        action: action
          ? Array.isArray(action)
            ? (action as AuditAction[])
            : (action as AuditAction)
          : undefined,
        resourceType: resourceType as ResourceType | undefined,
        resourceId: resourceId as string | undefined,
        status: status as AuditStatus | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        orderBy: (orderBy as 'timestamp' | 'action' | 'status') || undefined,
        orderDirection: (orderDirection as 'ASC' | 'DESC') || undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
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
      const { limit, offset, startDate, endDate } = req.query;

      const result = await auditService.getUserAuditLogs(userId, {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get user audit logs', {
        component: 'AuditController',
        error,
        userId: req.params.userId,
      });

      res.status(500).json({
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
      const { limit, offset } = req.query;

      const result = await auditService.getResourceAuditLogs(
        resourceType as ResourceType,
        resourceId,
        {
          limit: limit ? parseInt(limit as string, 10) : undefined,
          offset: offset ? parseInt(offset as string, 10) : undefined,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get resource audit logs', {
        component: 'AuditController',
        error,
        resourceType: req.params.resourceType,
        resourceId: req.params.resourceId,
      });

      res.status(500).json({
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
        limit ? parseInt(limit as string, 10) : undefined
      );

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
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

      const result = await auditService.getFailedLogs({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
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

      const csv = await auditService.exportToCSV({
        userId: userId as string | undefined,
        action: action
          ? Array.isArray(action)
            ? (action as AuditAction[])
            : (action as AuditAction)
          : undefined,
        resourceType: resourceType as ResourceType | undefined,
        resourceId: resourceId as string | undefined,
        status: status as AuditStatus | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      res.send(csv);
    } catch (error) {
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

      const statistics = await auditService.getStatistics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
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

