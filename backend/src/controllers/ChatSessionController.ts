import { Request, Response } from 'express';
import Joi from 'joi';
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';

/**
 * 扩展的 Express Response 接口，包含 flushHeaders 方法
 */
interface ExtendedResponse extends Omit<Response, 'flushHeaders'> {
  flushHeaders(): void;
}

/**
 * 会话管理控制器
 * 专门处理聊天会话的创建、查询、删除等操作
 */
export class ChatSessionController {
  /**
   * 会话ID验证Schema
   */
  private sessionIdSchema = Joi.object({
    sessionId: Joi.string().uuid().required().messages({
      'string.uuid': '会话ID必须是有效的UUID格式',
      'any.required': '会话ID是必需的'
    })
  });

  /**
   * 分页参数验证Schema
   */
  private paginationSchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': 'limit必须是数字',
      'number.integer': 'limit必须是整数',
      'number.min': 'limit不能小于1',
      'number.max': 'limit不能大于100'
    }),
    offset: Joi.number().integer().min(0).default(0).messages({
      'number.base': 'offset必须是数字',
      'number.integer': 'offset必须是整数',
      'number.min': 'offset不能小于0'
    })
  });

  /**
   * 获取聊天历史列表
   */
  listChatHistories = async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证分页参数
      const { error, value: paginationParams } = this.paginationSchema.validate(req.query);
      if (error) {
        logger.warn('📝 [listChatHistories] 参数验证失败', {
          query: req.query,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      // TODO: 实现获取聊天历史列表的逻辑
      const histories = await this.getChatHistoriesFromService(
        paginationParams.limit,
        paginationParams.offset
      );

      logger.info('📝 [listChatHistories] 获取聊天历史列表成功', {
        limit: paginationParams.limit,
        offset: paginationParams.offset,
        count: histories.length
      });

      ApiResponseHandler.sendSuccess(res, {
        histories,
        pagination: {
          limit: paginationParams.limit,
          offset: paginationParams.offset,
          total: histories.length
        }
      }, { message: '获取聊天历史列表成功' });

    } catch (error) {
      logger.error('❌ [listChatHistories] 获取聊天历史列表失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 获取特定会话的聊天历史
   */
  getChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证会话ID
      const { error, value: params } = this.sessionIdSchema.validate(req.params);
      if (error) {
        logger.warn('💬 [getChatHistory] 会话ID验证失败', {
          sessionId: req.params.sessionId,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      const { sessionId } = params;

      // 验证分页参数
      const { error: paginationError, value: paginationParams } = this.paginationSchema.validate(req.query);
      if (paginationError) {
        logger.warn('💬 [getChatHistory] 分页参数验证失败', {
          sessionId,
          query: req.query,
          error: paginationError.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, paginationError.details[0]?.message || 'Pagination error');
        return;
      }

      // TODO: 实现获取特定会话聊天历史的逻辑
      const chatHistory = await this.getChatHistoryFromService(
        sessionId,
        paginationParams.limit,
        paginationParams.offset
      );

      if (!chatHistory) {
        logger.warn('💬 [getChatHistory] 会话不存在', { sessionId });
        ApiResponseHandler.sendNotFound(res, '会话不存在');
        return;
      }

      logger.info('💬 [getChatHistory] 获取聊天历史成功', {
        sessionId,
        limit: paginationParams.limit,
        offset: paginationParams.offset,
        messageCount: chatHistory.messages?.length || 0
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        chatHistory,
        pagination: {
          limit: paginationParams.limit,
          offset: paginationParams.offset,
          total: chatHistory.messages?.length || 0
        }
      }, { message: '获取聊天历史成功' });

    } catch (error) {
      logger.error('❌ [getChatHistory] 获取聊天历史失败', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 删除特定会话的聊天历史
   */
  deleteChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证会话ID
      const { error, value: params } = this.sessionIdSchema.validate(req.params);
      if (error) {
        logger.warn('🗑️ [deleteChatHistory] 会话ID验证失败', {
          sessionId: req.params.sessionId,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      const { sessionId } = params;

      // TODO: 实现删除会话聊天历史的逻辑
      const success = await this.deleteChatHistoryFromService(sessionId);

      if (!success) {
        logger.warn('🗑️ [deleteChatHistory] 会话不存在或删除失败', { sessionId });
        ApiResponseHandler.sendNotFound(res, '会话不存在');
        return;
      }

      logger.info('🗑️ [deleteChatHistory] 删除聊天历史成功', { sessionId });

      ApiResponseHandler.sendSuccess(res, { sessionId }, { message: '删除聊天历史成功' });

    } catch (error) {
      logger.error('❌ [deleteChatHistory] 删除聊天历史失败', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 清空所有聊天历史
   */
  clearChatHistories = async (req: Request, res: Response): Promise<void> => {
    try {
      // TODO: 实现清空所有聊天历史的逻辑
      const deletedCount = await this.clearAllChatHistoriesFromService();

      logger.info('🧹 [clearChatHistories] 清空所有聊天历史成功', {
        deletedCount
      });

      ApiResponseHandler.sendSuccess(res, {
        deletedCount,
        message: `成功删除 ${deletedCount} 个会话的聊天历史`
      }, { message: '清空所有聊天历史成功' });

    } catch (error) {
      logger.error('❌ [clearChatHistories] 清空所有聊天历史失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 获取会话消息
   */
  getSessionMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证会话ID
      const { error, value: params } = this.sessionIdSchema.validate(req.params);
      if (error) {
        logger.warn('📨 [getSessionMessages] 会话ID验证失败', {
          sessionId: req.params.sessionId,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      const { sessionId } = params;

      // 验证分页参数
      const { error: paginationError, value: paginationParams } = this.paginationSchema.validate(req.query);
      if (paginationError) {
        logger.warn('📨 [getSessionMessages] 分页参数验证失败', {
          sessionId,
          query: req.query,
          error: paginationError.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, paginationError.details[0]?.message || 'Pagination error');
        return;
      }

      // TODO: 实现获取会话消息的逻辑
      const messages = await this.getSessionMessagesFromService(
        sessionId,
        paginationParams.limit,
        paginationParams.offset
      );

      logger.info('📨 [getSessionMessages] 获取会话消息成功', {
        sessionId,
        limit: paginationParams.limit,
        offset: paginationParams.offset,
        messageCount: messages.length
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        messages,
        pagination: {
          limit: paginationParams.limit,
          offset: paginationParams.offset,
          total: messages.length
        }
      }, { message: '获取会话消息成功' });

    } catch (error) {
      logger.error('❌ [getSessionMessages] 获取会话消息失败', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  // TODO: 实现以下服务方法，这些方法需要调用相应的服务层
  private async getChatHistoriesFromService(limit: number, offset: number): Promise<any[]> {
    // 实现获取聊天历史列表的逻辑
    return [];
  }

  private async getChatHistoryFromService(sessionId: string, limit: number, offset: number): Promise<any> {
    // 实现获取特定会话聊天历史的逻辑
    return null;
  }

  private async deleteChatHistoryFromService(sessionId: string): Promise<boolean> {
    // 实现删除会话聊天历史的逻辑
    return true;
  }

  private async clearAllChatHistoriesFromService(): Promise<number> {
    // 实现清空所有聊天历史的逻辑
    return 0;
  }

  private async getSessionMessagesFromService(sessionId: string, limit: number, offset: number): Promise<any[]> {
    // 实现获取会话消息的逻辑
    return [];
  }
}