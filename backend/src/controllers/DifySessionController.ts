import { Request, Response } from 'express';
import { difySessionService } from '@/services/DifySessionService';
import { AgentConfigService } from '@/services/AgentConfigService';
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';

const agentService = new AgentConfigService();

/**
 * Dify 会话管理控制器
 */
export class DifySessionController {
  /**
   * 获取会话列表
   * GET /api/dify/conversations
   */
  static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, user, limit, last_id } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params: any = {};
      if (user) params.user = user as string;
      if (limit) params.limit = parseInt(limit as string, 10);
      if (last_id) params.last_id = last_id as string;

      const result = await difySessionService.getConversations(agent, params);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取 Dify 会话列表成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error) {
      logger.error('获取 Dify 会话列表失败', {
        component: 'DifySessionController',
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '获取会话列表失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取会话消息
   * GET /api/dify/messages
   */
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, conversation_id, user, limit, first_id } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!conversation_id || typeof conversation_id !== 'string') {
        res.status(400).json({
          code: 'INVALID_CONVERSATION_ID',
          message: '缺少 conversation_id 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params: any = { conversation_id };
      if (user) params.user = user as string;
      if (limit) params.limit = parseInt(limit as string, 10);
      if (first_id) params.first_id = first_id as string;

      const result = await difySessionService.getConversationMessages(agent, params);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取 Dify 会话消息成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error) {
      logger.error('获取 Dify 会话消息失败', {
        component: 'DifySessionController',
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '获取会话消息失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取消息详情
   * GET /api/dify/messages/:messageId
   */
  static async getMessageDetail(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { agentId, user } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!messageId) {
        res.status(400).json({
          success: false,
          code: 'INVALID_MESSAGE_ID',
          message: '消息ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await difySessionService.getMessageDetail(
        agent,
        messageId,
        user ? (user as string) : undefined
      );

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取 Dify 消息详情成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error) {
      logger.error('获取 Dify 消息详情失败', {
        component: 'DifySessionController',
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '获取消息详情失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 删除会话
   * DELETE /api/dify/conversations/:conversationId
   */
  static async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { agentId, user } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          success: false,
          code: 'INVALID_CONVERSATION_ID',
          message: '对话ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await difySessionService.deleteConversation(
        agent,
        conversationId,
        user ? (user as string) : undefined
      );

      ApiResponseHandler.sendSuccess(res, null, {
        message: '会话删除成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error) {
      logger.error('删除 Dify 会话失败', {
        component: 'DifySessionController',
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '删除会话失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 提交消息反馈
   * POST /api/dify/messages/:messageId/feedback
   */
  static async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { agentId, rating, user } = req.body;

      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!rating || !['like', 'dislike'].includes(rating)) {
        res.status(400).json({
          code: 'INVALID_RATING',
          message: 'rating 必须为 like 或 dislike',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params: any = {
        message_id: messageId,
        rating,
      };
      if (user) params.user = user;

      const result = await difySessionService.submitFeedback(agent, params);

      ApiResponseHandler.sendSuccess(res, result, {
        message: '反馈提交成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error) {
      logger.error('提交 Dify 消息反馈失败', {
        component: 'DifySessionController',
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '提交反馈失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取建议问题
   * GET /api/dify/messages/:messageId/suggested
   */
  static async getSuggestedQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { agentId, user } = req.query;

      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '缺少 agentId 参数',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        res.status(404).json({
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (agent.provider !== 'dify') {
        res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: '仅 Dify 智能体支持此接口',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!messageId) {
        res.status(400).json({
          success: false,
          code: 'INVALID_MESSAGE_ID',
          message: '消息ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await difySessionService.getSuggestedQuestions(
        agent,
        messageId,
        user ? (user as string) : undefined
      );

      ApiResponseHandler.sendSuccess(res, result, {
        message: '获取建议问题成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (error) {
      logger.error('获取 Dify 建议问题失败', {
        component: 'DifySessionController',
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '获取建议问题失败',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

