import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { FastGPTSessionService } from '@/services/FastGPTSessionService';
import { AgentConfigService } from '@/services/AgentConfigService';
import logger from '@/utils/logger';
import type {
  SessionListParams,
  BatchOperationOptions,
  ExportOptions,
  EventQueryParams,
  ApiError,
} from '@/types';
import { ApiResponseHandler } from '@/utils/apiResponse';
import { createErrorFromUnknown, AuthenticationError } from '@/types/errors';
import type { JsonValue } from '@/types/dynamic';

async function ensureAdminAuth(req: Request) {
  const auth = req.headers['authorization'];
  const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new AuthenticationError({
      message: '未提供认证令牌',
      code: 'UNAUTHORIZED',
    });
  }

  // 这里应该调用认证服务验证token
  // const user = await authService.profile(token);
  // if (!user || user.role !== 'admin') {
  //   throw new AuthorizationError({
  //     message: '需要管理员权限',
  //     code: 'FORBIDDEN'
  //   });
  // }

  // 暂时跳过认证，实际生产环境需要实现
  return { userId: 'admin' };
}

function handleAdminAuthError(error: unknown, res: Response): boolean {
  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    res.status(403).json({
      code: 'UNAUTHORIZED',
      message: '需要管理员权限',
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

/**
 * 会话管理控制器
 */
export class SessionController {
  private readonly sessionService: FastGPTSessionService;
  private readonly agentService: AgentConfigService;

  // 验证schemas
  private readonly sessionListSchema = Joi.object({
    page: Joi.number().min(1).default(1),
    pageSize: Joi.number().min(1).max(100).default(20),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    minMessageCount: Joi.number().min(0).optional(),
    maxMessageCount: Joi.number().min(0).optional(),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'messageCount', 'title').default('updatedAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    searchKeyword: Joi.string().max(500).optional(),
  });

  private readonly batchOperationSchema = Joi.object({
    sessionIds: Joi.array().items(Joi.string()).min(1).required(),
    operation: Joi.string().valid('delete', 'archive', 'addTags', 'removeTags').required(),
    tags: Joi.array().items(Joi.string()).when('operation', {
      is: Joi.string().valid('addTags', 'removeTags'),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  });

  private readonly exportOptionsSchema = Joi.object({
    format: Joi.string().valid('json', 'csv', 'excel').required(),
    includeMessages: Joi.boolean().default(false),
    includeMetadata: Joi.boolean().default(false),
    filters: this.sessionListSchema.optional(),
    dateRange: Joi.object({
      start: Joi.date().iso().required(),
      end: Joi.date().iso().required(),
    }).optional(),
  });

  private readonly eventQuerySchema = Joi.object({
    sessionIds: Joi.array().items(Joi.string()).optional(),
    eventTypes: Joi.array().items(Joi.string()).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    userId: Joi.string().optional(),
    page: Joi.number().min(1).default(1),
    pageSize: Joi.number().min(1).max(100).default(20),
    sortBy: Joi.string().valid('timestamp').default('timestamp'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  });

  constructor() {
    this.agentService = new AgentConfigService();
    this.sessionService = new FastGPTSessionService(this.agentService);
  }

  /**
   * 获取增强版会话列表
   * GET /api/sessions/:agentId/enhanced
   */
  listSessionsEnhanced = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { agentId } = req.params;
    try {
      const { error, value } = this.sessionListSchema.validate(req.query, { abortEarly: false });

      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!agentId) {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await this.sessionService.listHistoriesEnhanced(agentId, value as SessionListParams);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取会话列表成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'listSessionsEnhanced',
        url: req.originalUrl,
        method: req.method,
        context: { agentId },
      });
      logger.error('获取增强版会话列表失败', { error: typedError.message });
      const apiError: ApiError = {
        code: 'LIST_SESSIONS_FAILED',
        message: '获取会话列表失败',
        timestamp: new Date().toISOString(),
      };

      if (process.env.NODE_ENV === 'development') {
        apiError.details = {
          originalError: typedError.message,
          stack: typedError.stack,
        } as JsonValue;
      }

      res.status(500).json(apiError);
    }
  };

  /**
   * 批量操作会话
   * POST /api/sessions/:agentId/batch
   */
  batchOperation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { agentId } = req.params;
      const { error, value } = this.batchOperationSchema.validate(req.body, { abortEarly: false });

      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!agentId) {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await ensureAdminAuth(req);
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;
      const context = {
        userId: user.userId,
        ...(userAgent && { userAgent }),
        ...(ipAddress && { ipAddress }),
      };

      // 为每个会话记录操作开始事件
      for (const sessionId of value.sessionIds) {
        await this.sessionService.recordEvent(
          agentId,
          sessionId,
          value.operation,
          { operation: value.operation, tags: value.tags } as JsonValue,
          context,
        );
      }

      const result = await this.sessionService.batchOperation(agentId, value as BatchOperationOptions);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '批量操作完成',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      if (handleAdminAuthError(unknownError, res)) {
        return;
      }
      const { agentId } = req.params;
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'batchOperation',
        url: req.originalUrl,
        method: req.method,
        context: { agentId, operation: req.body.operation },
      });
      logger.error('批量操作失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(500).json(apiError);
    }
  };

  /**
   * 导出会话数据
   * POST /api/sessions/:agentId/export
   */
  exportSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { agentId } = req.params;
      const { error, value } = this.exportOptionsSchema.validate(req.body, { abortEarly: false });

      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!agentId) {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await ensureAdminAuth(req);
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;
      const context = {
        userId: user.userId,
        ...(userAgent && { userAgent }),
        ...(ipAddress && { ipAddress }),
      };

      const result = await this.sessionService.exportSessions(agentId, value as ExportOptions);

      // 设置响应头
      const contentType = value.format === 'json' ? 'application/json' :
        value.format === 'csv' ? 'text/csv' :
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);

      // 记录导出事件
      await this.sessionService.recordEvent(
        agentId,
        'export_operation',
        'exported',
        {
          format: value.format,
          sessionCount: 'unknown', // 从result中获取
          includeMessages: value.includeMessages,
          includeMetadata: value.includeMetadata,
          filters: value.filters,
        } as JsonValue,
        context,
      );
    } catch (unknownError) {
      if (handleAdminAuthError(unknownError, res)) {
        return;
      }
      const { agentId } = req.params;
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'exportSessions',
        url: req.originalUrl,
        method: req.method,
        context: { agentId, format: req.body.format },
      });
      logger.error('导出会话失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(500).json(apiError);
    }
  };

  /**
   * 获取会话统计信息
   * GET /api/sessions/:agentId/stats
   */
  getSessionStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId } = req.params;
      const { startDate, endDate } = req.query;

      if (!agentId) {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: startDate as string,
          end: endDate as string,
        };
      }

      const stats = await this.sessionService.getSessionStats(agentId, dateRange);

      ApiResponseHandler.sendSuccess(res, stats, {
        message: '获取会话统计成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const { agentId } = req.params;
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'getSessionStats',
        url: req.originalUrl,
        method: req.method,
        context: { agentId, dateRange: req.query },
      });
      logger.error('获取会话统计失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(500).json(apiError);
    }
  };

  /**
   * 查询会话事件
   * GET /api/sessions/:agentId/events
   */
  queryEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId } = req.params;
      const { error, value } = this.eventQuerySchema.validate(req.query, { abortEarly: false });

      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!agentId) {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await this.sessionService.queryEvents(agentId, {
        ...value,
        agentId,
      } as EventQueryParams);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '查询会话事件成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const { agentId } = req.params;
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'queryEvents',
        url: req.originalUrl,
        method: req.method,
        context: { agentId, queryParams: req.query },
      });
      logger.error('查询会话事件失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(500).json(apiError);
    }
  };

  /**
   * 获取会话详情（原有功能的增强版）
   * GET /api/sessions/:agentId/:sessionId
   */
  getSessionDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId, sessionId } = req.params;

      if (!agentId || !sessionId) {
        res.status(400).json({
          code: 'INVALID_PARAMS',
          message: '智能体ID和会话ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const detail = await this.sessionService.getHistoryDetail(agentId, sessionId);

      // 记录访问事件
      const user = await ensureAdminAuth(req).catch(() => ({ userId: undefined }));
      const eventData = {
        action: 'view_detail',
      } as JsonValue;
      const requestContext = {} as Record<string, unknown>;

      if (user.userId) {
        requestContext.userId = user.userId;
      }
      if (req.headers['user-agent']) {
        requestContext.userAgent = req.headers['user-agent'];
      }
      if (req.ip) {
        requestContext.ipAddress = req.ip;
      } else if (req.connection?.remoteAddress) {
        requestContext.ipAddress = req.connection.remoteAddress;
      }

      await this.sessionService.recordEvent(
        agentId,
        sessionId,
        'updated',
        eventData,
        requestContext,
      );

      ApiResponseHandler.sendSuccess(res, detail, {
        message: '获取会话详情成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const { agentId, sessionId } = req.params;
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'getSessionDetail',
        url: req.originalUrl,
        method: req.method,
        context: { agentId, sessionId },
      });
      logger.error('获取会话详情失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(500).json(apiError);
    }
  };

  /**
   * 删除单个会话
   * DELETE /api/sessions/:agentId/:sessionId
   */
  deleteSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { agentId, sessionId } = req.params;

      if (!agentId || !sessionId) {
        res.status(400).json({
          code: 'INVALID_PARAMS',
          message: '智能体ID和会话ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await ensureAdminAuth(req);
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;
      const context = {
        userId: user.userId,
        ...(userAgent && { userAgent }),
        ...(ipAddress && { ipAddress }),
      };

      // 记录删除前的事件
      await this.sessionService.recordEvent(
        agentId,
        sessionId,
        'deleted',
        { reason: 'manual_delete' } as JsonValue,
        context,
      );

      await this.sessionService.deleteHistory(agentId, sessionId);

      ApiResponseHandler.sendSuccess(res, null, {
        message: '会话删除成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      if (handleAdminAuthError(unknownError, res)) {
        return;
      }
      const { agentId, sessionId } = req.params;
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'SessionController',
        operation: 'deleteSession',
        url: req.originalUrl,
        method: req.method,
        context: { agentId, sessionId },
      });
      logger.error('删除会话失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(500).json(apiError);
    }
  };
}