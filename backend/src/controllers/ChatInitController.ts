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
 * 聊天初始化控制器
 * 专门处理聊天会话的初始化和配置
 */
export class ChatInitController {
  /**
   * 聊天初始化参数验证Schema
   */
  private chatInitSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': 'agentId是必需的'
    }),
    sessionId: Joi.string().uuid().optional(),
    context: Joi.object().optional(),
    preferences: Joi.object({
      temperature: Joi.number().min(0).max(2).optional(),
      maxTokens: Joi.number().integer().min(1).optional(),
      stream: Joi.boolean().optional(),
      language: Joi.string().optional()
    }).optional()
  });

  /**
   * 初始化聊天会话
   */
  chatInit = async (req: Request, res: Response): Promise<void> => {
    const extendedRes = res as ExtendedResponse;

    try {
      // 验证初始化参数
      const { error, value } = this.chatInitSchema.validate(req.query);
      if (error) {
        logger.warn('🚀 [chatInit] 初始化参数验证失败', {
          query: req.query,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.message);
        return;
      }

      const { agentId, sessionId, context, preferences } = value;

      logger.info('🚀 [chatInit] 开始初始化聊天会话', {
        agentId,
        sessionId: sessionId || 'new',
        hasContext: !!context,
        hasPreferences: !!preferences
      });

      // TODO: 实现聊天初始化的逻辑
      const initResult = await this.initializeChatSession({
        agentId,
        sessionId,
        context: context || {},
        preferences: preferences || {},
        timestamp: new Date()
      });

      logger.info('🚀 [chatInit] 聊天会话初始化成功', {
        sessionId: initResult.sessionId,
        agentId: initResult.agentId,
        agentName: initResult.agentName
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId: initResult.sessionId,
        agentId: initResult.agentId,
        agentName: initResult.agentName,
        agentConfig: initResult.agentConfig,
        sessionConfig: initResult.sessionConfig,
        capabilities: initResult.capabilities,
        initializedAt: initResult.initializedAt
      }, { message: '聊天会话初始化成功' });

    } catch (error) {
      logger.error('❌ [chatInit] 聊天会话初始化失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 获取聊天会话状态
   */
  getChatSessionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.sessionId;

      if (!sessionId) {
        ApiResponseHandler.sendValidationError(res, 'sessionId是必需的');
        return;
      }

      logger.info('📊 [getChatSessionStatus] 获取聊天会话状态', {
        sessionId
      });

      // TODO: 实现获取会话状态的逻辑
      const sessionStatus = await this.getChatSessionStatusFromService(sessionId);

      if (!sessionStatus) {
        logger.warn('📊 [getChatSessionStatus] 会话不存在', {
          sessionId
        });
        ApiResponseHandler.sendNotFound(res, '会话不存在');
        return;
      }

      logger.info('📊 [getChatSessionStatus] 获取聊天会话状态成功', {
        sessionId,
        messageCount: sessionStatus.messageCount,
        isActive: sessionStatus.isActive
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId: sessionStatus.sessionId,
        agentId: sessionStatus.agentId,
        isActive: sessionStatus.isActive,
        messageCount: sessionStatus.messageCount,
        lastActivity: sessionStatus.lastActivity,
        createdAt: sessionStatus.createdAt,
        expiresAt: sessionStatus.expiresAt
      }, { message: '获取聊天会话状态成功' });

    } catch (error) {
      logger.error('❌ [getChatSessionStatus] 获取聊天会话状态失败', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 更新聊天会话配置
   */
  updateChatSessionConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.sessionId;

      if (!sessionId) {
        ApiResponseHandler.sendValidationError(res, 'sessionId是必需的');
        return;
      }

      const configUpdateSchema = Joi.object({
        preferences: Joi.object({
          temperature: Joi.number().min(0).max(2).optional(),
          maxTokens: Joi.number().integer().min(1).optional(),
          stream: Joi.boolean().optional(),
          language: Joi.string().optional()
        }).optional(),
        context: Joi.object().optional()
      });

      const { error, value } = configUpdateSchema.validate(req.body);
      if (error) {
        logger.warn('⚙️ [updateChatSessionConfig] 配置更新参数验证失败', {
          sessionId,
          body: req.body,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.message);
        return;
      }

      const { preferences, context } = value;

      logger.info('⚙️ [updateChatSessionConfig] 更新聊天会话配置', {
        sessionId,
        hasPreferences: !!preferences,
        hasContext: !!context
      });

      // TODO: 实现更新会话配置的逻辑
      const updatedConfig = await this.updateChatSessionConfigInService(sessionId, {
        preferences,
        context,
        updatedAt: new Date()
      });

      logger.info('⚙️ [updateChatSessionConfig] 聊天会话配置更新成功', {
        sessionId,
        updatedFields: Object.keys(updatedConfig)
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        updatedConfig,
        updatedAt: updatedConfig.updatedAt
      }, { message: '聊天会话配置更新成功' });

    } catch (error) {
      logger.error('❌ [updateChatSessionConfig] 聊天会话配置更新失败', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 初始化聊天会话（服务层）
   */
  private async initializeChatSession(initData: {
    agentId: string;
    sessionId?: string;
    context: any;
    preferences: any;
    timestamp: Date;
  }): Promise<any> {
    // TODO: 实现聊天会话初始化逻辑
    // 这里需要调用相应的服务层方法
    return {
      sessionId: initData.sessionId || this.generateSessionId(),
      agentId: initData.agentId,
      agentName: 'Default Agent',
      agentConfig: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000
      },
      sessionConfig: {
        preferences: initData.preferences,
        context: initData.context
      },
      capabilities: [
        'text_generation',
        'conversation_memory',
        'context_awareness'
      ],
      initializedAt: initData.timestamp
    };
  }

  /**
   * 获取聊天会话状态（服务层）
   */
  private async getChatSessionStatusFromService(sessionId: string): Promise<any> {
    // TODO: 实现获取会话状态逻辑
    // 这里需要调用相应的服务层方法
    return {
      sessionId,
      agentId: 'default-agent',
      isActive: true,
      messageCount: 5,
      lastActivity: new Date(),
      createdAt: new Date(Date.now() - 3600000), // 1小时前
      expiresAt: new Date(Date.now() + 86400000) // 24小时后
    };
  }

  /**
   * 更新聊天会话配置（服务层）
   */
  private async updateChatSessionConfigInService(
    sessionId: string,
    configData: {
      preferences?: any;
      context?: any;
      updatedAt: Date;
    }
  ): Promise<any> {
    // TODO: 实现更新会话配置逻辑
    // 这里需要调用相应的服务层方法
    return {
      ...configData,
      sessionId,
      updatedFields: Object.keys(configData).filter(key => key !== 'updatedAt')
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9);
  }
}