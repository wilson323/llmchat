import type { Request, Response } from 'express';
import { createErrorFromUnknown } from '@/types/errors';
import { difySessionService } from '@/services/DifySessionService';
import { AgentConfigService } from '@/services/AgentConfigService';
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';

// HTTP 状态码常量
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// API 错误代码常量
const ERROR_CODES = {
  INVALID_AGENT_ID: 'INVALID_AGENT_ID',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  INVALID_PROVIDER: 'INVALID_PROVIDER',
  INVALID_CONVERSATION_ID: 'INVALID_CONVERSATION_ID',
  INVALID_MESSAGE_ID: 'INVALID_MESSAGE_ID',
  INVALID_RATING: 'INVALID_RATING',
} as const;

// 支持的反馈类型
const VALID_RATINGS = ['like', 'dislike'] as const;

// 参数接口定义
interface ConversationQueryParams {
  agentId?: string;
  user?: string;
  limit?: string;
  last_id?: string;
}

interface MessagesQueryParams extends ConversationQueryParams {
  conversation_id?: string;
  first_id?: string;
}

interface MessageDetailQueryParams {
  agentId?: string;
  user?: string;
}

interface FeedbackRequestBody {
  agentId: string;
  rating: string;
  user?: string;
}

interface DifyServiceParams {
  conversation_id: string;
  user?: string;
  limit?: number;
  first_id?: string;
  last_id?: string;
}

interface FeedbackParams {
  message_id: string;
  rating: 'like' | 'dislike' | null;
  user?: string;
}

const agentService = new AgentConfigService();

/**
 * Dify 会话管理控制器
 */
export class DifySessionController {
  /**
   * 获取会话列表
   * GET /api/dify/conversations
   */
  static async getConversations(
    req: Request<unknown, unknown, unknown, ConversationQueryParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { agentId, user, limit, last_id } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_AGENT_ID,
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          code: ERROR_CODES.AGENT_NOT_FOUND,
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_PROVIDER,
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params: Partial<DifyServiceParams> = {};
      if (user) {
        params.user = user;
      }
      if (limit) {
        const parsedLimit = parseInt(limit, 10);
        if (!isNaN(parsedLimit)) {
          params.limit = parsedLimit;
        }
      }
      if (last_id) {
        params.last_id = last_id;
      }

      const result = await difySessionService.getConversations(agent, params);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取 Dify 会话列表成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DifySessionController',
        operation: 'getConversations',
      });
      logger.error('获取 Dify 会话列表失败', error.toLogObject());

      const apiError = error.toApiError();
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
    }
  }

  /**
   * 获取会话消息
   * GET /api/dify/messages
   */
  static async getMessages(
    req: Request<unknown, unknown, unknown, MessagesQueryParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { agentId, conversation_id, user, limit, first_id } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_AGENT_ID,
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!conversation_id || typeof conversation_id !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_CONVERSATION_ID,
          message: '缺少 conversation_id 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          code: ERROR_CODES.AGENT_NOT_FOUND,
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_PROVIDER,
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params: DifyServiceParams = { conversation_id };
      if (user) {
        params.user = user;
      }
      if (limit) {
        const parsedLimit = parseInt(limit, 10);
        if (!isNaN(parsedLimit)) {
          params.limit = parsedLimit;
        }
      }
      if (first_id) {
        params.first_id = first_id;
      }

      const result = await difySessionService.getConversationMessages(agent, params);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取 Dify 会话消息成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DifySessionController',
        operation: 'getMessages',
      });
      logger.error('获取 Dify 会话消息失败', error.toLogObject());

      const apiError = error.toApiError();
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
    }
  }

  /**
   * 获取消息详情
   * GET /api/dify/messages/:messageId
   */
  static async getMessageDetail(
    req: Request<{ messageId: string }, unknown, unknown, MessageDetailQueryParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { messageId } = req.params;
      const { agentId, user } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_AGENT_ID,
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          code: ERROR_CODES.AGENT_NOT_FOUND,
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_PROVIDER,
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!messageId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_MESSAGE_ID,
          message: '消息ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await difySessionService.getMessageDetail(
        agent,
        messageId,
        user ?? undefined,
      );

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取 Dify 消息详情成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DifySessionController',
        operation: 'getMessageDetail',
      });
      logger.error('获取 Dify 消息详情失败', error.toLogObject());

      const apiError = error.toApiError();
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
    }
  }

  /**
   * 删除会话
   * DELETE /api/dify/conversations/:conversationId
   */
  static async deleteConversation(
    req: Request<{ conversationId: string }, unknown, unknown, MessageDetailQueryParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { agentId, user } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_AGENT_ID,
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          code: ERROR_CODES.AGENT_NOT_FOUND,
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_PROVIDER,
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!conversationId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_CONVERSATION_ID,
          message: '对话ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await difySessionService.deleteConversation(
        agent,
        conversationId,
        user ?? undefined,
      );

      ApiResponseHandler.sendSuccess(res, null, {
        message: '会话删除成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DifySessionController',
        operation: 'deleteConversation',
      });
      logger.error('删除 Dify 会话失败', error.toLogObject());

      const apiError = error.toApiError();
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
    }
  }

  /**
   * 提交消息反馈
   * POST /api/dify/messages/:messageId/feedback
   */
  static async submitFeedback(
    req: Request<{ messageId: string }, unknown, FeedbackRequestBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { messageId } = req.params;
      const { agentId, rating, user } = req.body;

      if (!agentId || typeof agentId !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_AGENT_ID,
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!rating || !VALID_RATINGS.includes(rating as typeof VALID_RATINGS[number])) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_RATING,
          message: 'rating 必须为 like 或 dislike',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          code: ERROR_CODES.AGENT_NOT_FOUND,
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_PROVIDER,
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params: FeedbackParams = {
        message_id: messageId,
        rating: rating as 'like' | 'dislike' | null,
      };
      if (user) {
        params.user = user;
      }

      const result = await difySessionService.submitFeedback(agent, params);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '反馈提交成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DifySessionController',
        operation: 'submitFeedback',
      });
      logger.error('提交 Dify 消息反馈失败', error.toLogObject());

      const apiError = error.toApiError();
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
    }
  }

  /**
   * 获取建议问题
   * GET /api/dify/messages/:messageId/suggested
   */
  static async getSuggestedQuestions(
    req: Request<{ messageId: string }, unknown, unknown, MessageDetailQueryParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { messageId } = req.params;
      const { agentId, user } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_AGENT_ID,
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          code: ERROR_CODES.AGENT_NOT_FOUND,
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_PROVIDER,
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!messageId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.INVALID_MESSAGE_ID,
          message: '消息ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await difySessionService.getSuggestedQuestions(
        agent,
        messageId,
        user ?? undefined,
      );

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取建议问题成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'DifySessionController',
        operation: 'getSuggestedQuestions',
      });
      logger.error('获取 Dify 建议问题失败', error.toLogObject());

      const apiError = error.toApiError();
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
    }
  }
}
