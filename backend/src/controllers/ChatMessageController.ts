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
 * 聊天消息控制器
 * 专门处理聊天消息的发送、重试、反馈等操作
 */
export class ChatMessageController {
  /**
   * 聊天完成请求验证Schema
   */
  private chatCompletionsSchema = Joi.object({
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant', 'system').required(),
        content: Joi.string().required(),
        name: Joi.string().optional(),
        function_call: Joi.object().optional(),
        // 可以根据需要添加更多字段
      })
    ).min(1).required().messages({
      'array.base': 'messages必须是数组',
      'array.min': 'messages至少包含一条消息',
      'any.required': 'messages是必需的'
    }),
    model: Joi.string().optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    max_tokens: Joi.number().integer().min(1).optional(),
    stream: Joi.boolean().default(false).optional(),
    // 可以根据需要添加更多参数
  });

  /**
   * 用户反馈验证Schema
   */
  private userFeedbackSchema = Joi.object({
    sessionId: Joi.string().uuid().required(),
    messageId: Joi.string().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    feedback: Joi.string().max(1000).optional(),
    category: Joi.string().valid('quality', 'accuracy', 'helpfulness', 'other').optional()
  });

  /**
   * 重试消息验证Schema
   */
  private retryMessageSchema = Joi.object({
    sessionId: Joi.string().uuid().required(),
    messageId: Joi.string().required(),
    prompt: Joi.string().optional(),
    options: Joi.object().optional()
  });

  /**
   * 处理聊天完成请求
   */
  chatCompletions = async (req: Request, res: Response): Promise<void> => {
    const extendedRes = res as ExtendedResponse;

    try {
      // 验证请求参数
      const { error, value } = this.chatCompletionsSchema.validate(req.body);
      if (error) {
        logger.warn('💬 [chatCompletions] 请求参数验证失败', {
          body: req.body,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      const { messages, stream, ...options } = value;

      // 发送头部以启用SSE
      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        if (typeof extendedRes.flushHeaders === 'function') {
          extendedRes.flushHeaders();
        }
      }

      logger.info('💬 [chatCompletions] 开始处理聊天请求', {
        messageCount: messages.length,
        stream,
        model: options.model
      });

      // TODO: 实现聊天完成的逻辑
      if (stream) {
        await this.handleStreamingChat(messages, options, res);
      } else {
        const result = await this.handleNonStreamingChat(messages, options);

        logger.info('💬 [chatCompletions] 聊天请求处理完成', {
          messageCount: messages.length,
          responseLength: result.content?.length || 0
        });

        ApiResponseHandler.sendSuccess(res, result, { message: '聊天完成' });
      }

    } catch (error) {
      logger.error('❌ [chatCompletions] 聊天请求处理失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      if (!res.headersSent) {
        ApiResponseHandler.sendError(res, error, { statusCode: 500 });
      }
    }
  };

  /**
   * 更新用户反馈
   */
  updateUserFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证反馈参数
      const { error, value } = this.userFeedbackSchema.validate(req.body);
      if (error) {
        logger.warn('👍 [updateUserFeedback] 反馈参数验证失败', {
          body: req.body,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      const { sessionId, messageId, rating, feedback, category } = value;

      // TODO: 实现更新用户反馈的逻辑
      await this.updateFeedbackInService({
        sessionId,
        messageId,
        rating,
        feedback,
        category,
        timestamp: new Date()
      });

      logger.info('👍 [updateUserFeedback] 用户反馈更新成功', {
        sessionId,
        messageId,
        rating,
        category
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        messageId,
        rating,
        feedback: '反馈已记录，感谢您的评价！'
      }, { message: '用户反馈更新成功' });

    } catch (error) {
      logger.error('❌ [updateUserFeedback] 用户反馈更新失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 重试聊天消息
   */
  retryChatMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证重试参数
      const { error, value } = this.retryMessageSchema.validate(req.body);
      if (error) {
        logger.warn('🔄 [retryChatMessage] 重试参数验证失败', {
          body: req.body,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.details[0]?.message || 'Validation error');
        return;
      }

      const { sessionId, messageId, prompt, options } = value;

      logger.info('🔄 [retryChatMessage] 开始重试消息', {
        sessionId,
        messageId,
        hasPrompt: !!prompt
      });

      // TODO: 实现重试消息的逻辑
      const result = await this.retryMessageInService({
        sessionId,
        messageId,
        prompt,
        options: options || {}
      });

      logger.info('🔄 [retryChatMessage] 消息重试成功', {
        sessionId,
        messageId,
        responseLength: result.content?.length || 0
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        messageId,
        originalMessageId: messageId,
        content: result.content,
        usage: result.usage
      }, { message: '消息重试成功' });

    } catch (error) {
      logger.error('❌ [retryChatMessage] 消息重试失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 处理流式聊天
   */
  private async handleStreamingChat(
    messages: any[],
    options: any,
    res: Response
  ): Promise<void> {
    // TODO: 实现流式聊天逻辑
    // 这里需要实现SSE流式响应
  }

  /**
   * 处理非流式聊天
   */
  private async handleNonStreamingChat(
    messages: any[],
    options: any
  ): Promise<any> {
    // TODO: 实现非流式聊天逻辑
    return {
      content: '这是一个模拟响应',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    };
  }

  /**
   * 更新反馈到服务层
   */
  private async updateFeedbackInService(feedbackData: any): Promise<void> {
    // TODO: 实现更新反馈的逻辑
    // 这里需要调用相应的服务层方法
  }

  /**
   * 重试消息到服务层
   */
  private async retryMessageInService(retryData: any): Promise<any> {
    // TODO: 实现重试消息的逻辑
    // 这里需要调用相应的服务层方法
    return {
      content: '这是重试后的模拟响应',
      usage: {
        prompt_tokens: 8,
        completion_tokens: 12,
        total_tokens: 20
      }
    };
  }
}