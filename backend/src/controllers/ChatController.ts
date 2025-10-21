import type { Request, Response, NextFunction } from 'express';

/**
 * 扩展的 Express Response 接口，包含 flushHeaders 方法
 */
interface ExtendedResponse extends Omit<Response, 'flushHeaders'> {
  flushHeaders(): void;
}
import fs from 'fs/promises';
import path from 'path';
import Joi from 'joi';

// ===== 常量定义 =====
/** 最大Token数量限制 */
const MAX_TOKENS_LIMIT = 32768;
/** 最大页面大小限制 */
const MAX_PAGE_SIZE = 200;
/** 文件名最大长度 */
const MAX_FILENAME_LENGTH = 256;
/** MIME类型最大长度 */
const MAX_MIMETYPE_LENGTH = 128;
/** 附件最大大小 (MB) */
const MAX_ATTACHMENT_SIZE_MB = 20;
/** 附件最大大小 (字节) */
const MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
/** 会话标题最大长度 */
const MAX_TITLE_LENGTH = 30;
/** HTTP 成功状态码（保留用于未来使用） */
const _HTTP_STATUS_OK = 200;
/** HTTP 错误请求状态码 */
const HTTP_STATUS_BAD_REQUEST = 400;
/** HTTP 未授权状态码 */
const HTTP_STATUS_UNAUTHORIZED = 401;
/** HTTP 禁止访问状态码 */
const HTTP_STATUS_FORBIDDEN = 403;
/** HTTP 未找到状态码 */
const HTTP_STATUS_NOT_FOUND = 404;
/** HTTP 请求超时状态码 */
const HTTP_STATUS_TIMEOUT = 408;
/** HTTP 内部服务器错误状态码 */
const HTTP_STATUS_INTERNAL_ERROR = 500;
/** HTTP 服务器错误状态码 */
const HTTP_STATUS_SERVER_ERROR = 502;
/** HTTP 网关超时状态码 */
const HTTP_STATUS_GATEWAY_TIMEOUT = 504;
/** 默认重试延迟（毫秒，保留用于未来使用） */
const _DEFAULT_RETRY_DELAY_MS = 50;
/** 日志预览最大长度 */
const LOG_PREVIEW_MAX_LENGTH = 50;
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';

/**
 * Joi错误提取工具
 */
class ErrorExtractor {
  /**
   * 检查是否为已知错误类型
   */
  static isKnownError(err: unknown): err is { code: string; httpStatus?: number } {
    return typeof err === 'object' &&
           err !== null &&
           'code' in err &&
           typeof (err as Record<string, unknown>).code === 'string';
  }

  /**
   * 检查是否为Axios错误
   */
  static isAxiosError(err: unknown): err is { response?: { status?: number } } {
    return typeof err === 'object' &&
           err !== null &&
           'isAxiosError' in err;
  }

  /**
   * 从Joi验证错误中提取错误消息
   */
  static extractMessage(error: unknown): string | undefined {
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      if (Array.isArray(errorObj.details) && errorObj.details.length > 0) {
        const detail = errorObj.details[0] as Record<string, unknown>;
        if (typeof detail.message === 'string') {
          return detail.message;
        }
      }
      if (typeof errorObj.message === 'string') {
        return errorObj.message;
      }
    }
    return undefined;
  }

  /**
   * 从错误中提取错误代码
   */
  static extractCode(err: unknown): string | undefined {
    if (ErrorExtractor.isKnownError(err)) {
      return err.code;
    }

    if (err instanceof Error) {
      return err.name;
    }

    return undefined;
  }

  /**
   * 从错误中提取HTTP状态码
   */
  static extractStatus(err: unknown): number | undefined {
    if (ErrorExtractor.isKnownError(err)) {
      return err.httpStatus;
    }

    // 尝试从Axios错误中提取状态码
    if (ErrorExtractor.isAxiosError(err)) {
      return err.response?.status;
    }

    return undefined;
  }
}

import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatProxyService } from '@/services/ChatProxyService';
import { ChatInitService } from '@/services/ChatInitService';
import { ChatHistoryService, type ChatHistoryQueryOptions } from '@/services/ChatHistoryService';
import { FastGPTSessionService } from '@/services/FastGPTSessionService';
import { authService } from '@/services/authInstance';
import type { AuthUser } from '@/services/AuthService';
// import { analyticsService } from '@/services/analyticsInstance'; // 简化系统，暂时注释
// import type { ProtectedRequestContext } from '@/services/ProtectionService'; // 已移除保护服务
// import { getProtectionService } from '@/services/ProtectionService'; // 已移除保护服务
import type {
  ChatMessage,
  ChatOptions,
  ChatRequest,
  ApiError,
  StreamStatus,
  ChatAttachmentMetadata,
  VoiceNoteMetadata,
  FastGPTChatHistorySummary,
  FastGPTChatHistoryDetail,
  FeedbackRequest,
} from '@/types';
import { type JsonValue, SafeAccess, DynamicDataConverter } from '@/types/dynamic';
import type { SSEEventData } from '@/types/provider';
import { AuthenticationError, createErrorFromUnknown } from '@/types/errors';
import { generateId, formatFileSize } from '@/utils/helpers';

/**
 * 认证用户检查函数
 */
async function requireAuthenticatedUser(req: ExtendedRequest): Promise<AuthUser> {
  const authorization = req.headers['authorization'];
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new AuthenticationError({
      message: '未提供认证令牌',
      code: 'UNAUTHORIZED',
    });
  }
  try {
    return await authService.profile(token);
  } catch (unknownError: unknown) {
    if (unknownError instanceof Error && unknownError.message === 'TOKEN_EXPIRED') {
      throw new AuthenticationError({
        message: '认证令牌已过期',
        code: 'TOKEN_EXPIRED',
      });
    }
    throw new AuthenticationError({
      message: '认证失败',
      code: 'UNAUTHORIZED',
    });
  }
}

/**
 * 扩展的请求接口，包含可选的 requestId
 */
type ExtendedRequest = Request & {
  requestId?: string;
};

/**
 * 聊天控制器
 */
export class ChatController {
  private readonly agentService: AgentConfigService;
  private readonly chatService: ChatProxyService;
  private readonly initService: ChatInitService;
  private readonly historyService: ChatHistoryService;
  private readonly fastgptSessionService: FastGPTSessionService;
  // private readonly protectionService = getProtectionService(); // 已移除保护服务
  private readonly uploadDir: string;
  private static readonly supportedHistoryRoles = ['user', 'assistant', 'system'] as const;

  constructor() {
    this.agentService = new AgentConfigService();
    this.chatService = new ChatProxyService(this.agentService);
    this.initService = new ChatInitService(this.agentService);
    this.historyService = new ChatHistoryService();
    this.fastgptSessionService = new FastGPTSessionService(this.agentService);
    this.uploadDir = path.resolve(__dirname, '../../uploads');
  }

  /**
   * 聊天初始化请求验证Schema
   */
  private readonly chatInitSchema = Joi.object({
    appId: Joi.string().required().messages({
      'any.required': '应用ID不能为空',
      'string.empty': '应用ID不能为空',
    }),
    chatId: Joi.string().optional(),
    stream: Joi.boolean().optional().default(false),
  });

  /**
   * 聊天请求验证Schema
   */
  private readonly chatRequestSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant', 'system').required(),
        content: Joi.string().required().messages({
          'any.required': '消息内容不能为空',
          'string.empty': '消息内容不能为空',
        }),
        id: Joi.string().optional(),
        timestamp: Joi.number().optional(),
        attachments: Joi.array().items(
          Joi.object({
            id: Joi.string().optional(),
            url: Joi.string().uri().optional(),
            name: Joi.string().required(),
            mimeType: Joi.string().required(),
            size: Joi.number().min(0).required(),
            source: Joi.string().valid('upload', 'voice', 'external').optional(),
          }),
        ).optional(),
        voiceNote: Joi.object({
          id: Joi.string().optional(),
          url: Joi.string().uri().optional(),
          duration: Joi.number().min(0).required(),
          mimeType: Joi.string().required(),
          size: Joi.number().min(0).optional(),
        }).optional(),
        metadata: Joi.object().optional(),
      }),
    ).min(1).required().messages({
      'array.min': '至少需要一条消息',
      'any.required': '消息列表不能为空',
    }),
    stream: Joi.boolean().optional().default(false),
    // 兼容顶层直传（标准FastGPT格式）
    chatId: Joi.string().optional(),
    detail: Joi.boolean().optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    maxTokens: Joi.number().min(1).max(MAX_TOKENS_LIMIT).optional(),
    variables: Joi.object().optional(),
    responseChatItemId: Joi.string().optional(),
    retainDatasetCite: Joi.boolean().optional(),
    appId: Joi.string().optional(),
    // 兼容原有 options 格式
    options: Joi.object({
      chatId: Joi.string().optional(),
      detail: Joi.boolean().optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      maxTokens: Joi.number().min(1).max(MAX_TOKENS_LIMIT).optional(),
      // 允许旧用法把 variables 放到 options 里
      variables: Joi.object().optional(),
      responseChatItemId: Joi.string().optional(),
    }).optional(),
    attachments: Joi.array().items(
      Joi.object({
        id: Joi.string().optional(),
        url: Joi.string().uri().optional(),
        name: Joi.string().required(),
        mimeType: Joi.string().required(),
        size: Joi.number().min(0).required(),
        source: Joi.string().valid('upload', 'voice', 'external').optional(),
      }),
    ).optional(),
    voiceNote: Joi.object({
      id: Joi.string().optional(),
      url: Joi.string().uri().optional(),
      duration: Joi.number().min(0).required(),
      mimeType: Joi.string().required(),
      size: Joi.number().min(0).optional(),
    }).optional(),
  });

  private readonly historyListSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    page: Joi.number().min(1).optional(),
    pageSize: Joi.number().min(1).max(MAX_PAGE_SIZE).optional(),
  });

  private readonly historyDetailSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
  });

  private readonly historyMessagesSchema = Joi.object({
    limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE).optional(),
    offset: Joi.number().integer().min(0).optional(),
    role: Joi.alternatives()
      .try(
        Joi.string(),
        Joi.array().items(Joi.string()),
      )
      .optional(),
  });

  private readonly historyDeleteSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
  });

  private readonly historyRetrySchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    dataId: Joi.string().required().messages({
      'any.required': '消息ID不能为空',
      'string.empty': '消息ID不能为空',
    }),
    stream: Joi.boolean().optional().default(false),
    detail: Joi.boolean().optional(),
  });
  /**
   * 点赞/点踩反馈请求验证Schema
   */
  private readonly feedbackSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    chatId: Joi.string().required().messages({
      'any.required': 'chatId不能为空',
      'string.empty': 'chatId不能为空',
    }),
    dataId: Joi.string().required().messages({
      'any.required': 'dataId不能为空',
      'string.empty': 'dataId不能为空',
    }),
    userGoodFeedback: Joi.string().optional(),
    userBadFeedback: Joi.string().optional(),
  });
  private readonly attachmentUploadSchema = Joi.object({
    filename: Joi.string().max(MAX_FILENAME_LENGTH).required(),
    mimeType: Joi.string().max(MAX_MIMETYPE_LENGTH).required(),
    size: Joi.number().min(1).max(MAX_ATTACHMENT_SIZE).required(),
    data: Joi.string().required(),
    source: Joi.string().valid('upload', 'voice', 'external').optional(),
  });

  private decorateMessages(
    messages: ChatMessage[],
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null,
  ): ChatMessage[] {
    const list = this.cloneMessages(messages);

    // 如果没有附件和语音笔记，直接返回
    if ((!attachments || attachments.length === 0) && !voiceNote) {
      return list;
    }

    const index = this.findLastUserMessageIndex(list);
    if (index === -1) {
      return list;
    }

    const target = list[index];
    if (!target) {
      return list;
    }

    this.mergeAttachments(target, attachments);
    this.mergeVoiceNote(target, voiceNote);
    this.updateTargetContent(target, attachments, voiceNote);
    this.updateTargetMetadata(target, attachments, voiceNote);

    return list;
  }

  /**
   * 克隆消息数组，避免修改原始数据
   */
  private cloneMessages(messages: ChatMessage[]): ChatMessage[] {
    return (messages ?? []).map((msg) => {
      const result: ChatMessage = {
        ...msg,
        ...(msg.metadata && { metadata: { ...msg.metadata } }),
        ...(msg.attachments && { attachments: [...msg.attachments] }),
      };

      if (msg.voiceNote !== undefined) {
        result.voiceNote = msg.voiceNote;
      }

      return result;
    });
  }

  /**
   * 合并附件到目标消息
   */
  private mergeAttachments(
    target: ChatMessage,
    attachments?: ChatAttachmentMetadata[] | null,
  ): void {
    if (!attachments || attachments.length === 0) {
      return;
    }

    const mergedAttachments: ChatAttachmentMetadata[] = target.attachments
      ? [...target.attachments]
      : [];

    attachments.forEach((att) => {
      mergedAttachments.push(att);
    });

    if (mergedAttachments.length > 0) {
      target.attachments = mergedAttachments;
    }
  }

  /**
   * 合并语音笔记到目标消息
   */
  private mergeVoiceNote(
    target: ChatMessage,
    voiceNote?: VoiceNoteMetadata | null,
  ): void {
    if (!voiceNote) {
      return;
    }

    target.voiceNote = voiceNote;
  }

  /**
   * 更新目标消息的内容
   */
  private updateTargetContent(
    target: ChatMessage,
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null,
  ): void {
    const summary: string[] = [];

    if (attachments && attachments.length > 0) {
      attachments.forEach((att, idx) => {
        summary.push(
          `附件${idx + 1}: ${att.name} (${formatFileSize(att.size)}) -> ${att.url}`,
        );
      });
    }

    if (voiceNote) {
      summary.push(
        `语音: ${voiceNote.duration.toFixed(1)} 秒 (${voiceNote.mimeType}) -> ${voiceNote.url}`,
      );
    }

    if (summary.length > 0) {
      target.content = `${target.content}\n\n${summary.join('\n')}`.trim();
    }
  }

  /**
   * 更新目标消息的元数据
   */
  private updateTargetMetadata(
    target: ChatMessage,
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null,
  ): void {
    const mergedAttachments = target.attachments ?? [];
    const finalVoice = voiceNote ?? target.voiceNote;

    const newMetadata: ChatMessage['metadata'] = {
      ...(target.metadata ?? {}),
      ...(mergedAttachments.length ? { attachments: mergedAttachments } : {}),
      ...(finalVoice ? { voiceNote: finalVoice } : {}),
    };

    if (Object.keys(newMetadata).length > 0) {
      target.metadata = newMetadata;
    }
  }

  private findLastUserMessageIndex(messages: ChatMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') {
        return i;
      }
    }
    return -1;
  }

  private findLastUserMessage(messages: ChatMessage[]): ChatMessage | null {
    const index = this.findLastUserMessageIndex(messages);
    return index >= 0 && messages[index] ? messages[index] : null;
  }

  private resolveClientIp(req: ExtendedRequest): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0] ?? null;
    }
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded;
    }

    const realIp = req.headers['x-real-ip'];
    if (Array.isArray(realIp) && realIp.length > 0) {
      return realIp[0] ?? null;
    }
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp;
    }

    if (typeof req.ip === 'string' && req.ip.trim()) {
      return req.ip;
    }

    const socketAddress = req.socket && typeof req.socket.remoteAddress === 'string'
      ? req.socket.remoteAddress
      : null;
    return socketAddress;
  }

  private async recordGeoSnapshot(
    req: ExtendedRequest,
    agentId: string,
    _sessionId?: string | null,
  ): Promise<void> {
    try {
      const ip = this.resolveClientIp(req);
      // 简化系统，暂时移除分析服务
      logger.info('[ChatController] 记录代理请求', { agentId, ip });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'recordGeoSnapshot',
        agentId,
      });
      logger.warn('[ChatController] 记录地域分析失败', { error: typedError.message });
    }
  }

  private buildSessionTitle(messages: ChatMessage[]): string {
    const lastUser = this.findLastUserMessage(messages);
    if (!lastUser) {
      return '新对话';
    }
    const content = (lastUser.content ?? '').replace(/\s+/g, ' ').trim();
    if (!content) {
      return '新对话';
    }
    return content.length > MAX_TITLE_LENGTH ? `${content.slice(0, MAX_TITLE_LENGTH)}...` : content;
  }

  private async recordUserHistory(
    sessionId: string,
    agentId: string,
    messages: ChatMessage[],
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null,
  ): Promise<void> {
    const lastUser = this.findLastUserMessage(messages);
    if (!lastUser) {
      return;
    }
    try {
      await this.historyService.appendMessage({
        sessionId,
        agentId,
        role: 'user',
        content: lastUser.content,
        ...((attachments?.length ?? 0) > 0 || voiceNote ? {
          metadata: {
            attachments: attachments?.length ? attachments : undefined,
            voiceNote: voiceNote ?? null,
          },
        } : {}),
        ...(lastUser.id ? { messageId: lastUser.id } : {}),
        titleHint: this.buildSessionTitle(messages),
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'recordUserHistory',
        sessionId,
        agentId,
      });
      logger.warn('[ChatController] 记录用户消息失败', { error: typedError.message });
    }
  }

  /**
   * 发送聊天请求
   * POST /api/chat/completions
   */
  chatCompletions = async (
    req: ExtendedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    try {
      // 验证请求数据
      const validation = this.chatRequestSchema.validate(req.body);
    const { error: validationError, value } = validation;
      if (validationError) {
        this.sendValidationError(res, validationError);
        return;
      }

      const { agentId, messages, stream } = value as ChatRequest;
      const { attachments, voiceNote } = value;

      // 归一化选项
      const normalizedOptions = this.normalizeChatOptions(value);
      const sessionId = this.generateSessionId(normalizedOptions, value);
      normalizedOptions.chatId = sessionId;

      const decoratedMessages = this.decorateMessages(
        Array.isArray(messages) ? messages : [],
        attachments,
        voiceNote,
      );

      // 验证智能体
      const { error: agentError } = await this.validateAgent(agentId, res);
      if (agentError) {
        return; // 错误已在 validateAgent 中处理
      }

      // 初始化会话和历史
      await this.initializeChatSession(sessionId, agentId, decoratedMessages);
      await this.recordChatActivity(
        req,
        agentId,
        sessionId,
        decoratedMessages,
        attachments,
        voiceNote,
      );

      this.logChatRequest(agentId, stream ?? false, normalizedOptions, decoratedMessages);

      // 处理请求
      await this.processChatRequest(
        res,
        stream ?? false,
        agentId,
        decoratedMessages,
        normalizedOptions,
        sessionId,
        attachments,
        voiceNote,
      );
    } catch (unknownError) {
      this.handleChatRequestError(res, unknownError, req);
    }
  };

  /**
   * 发送验证错误响应
   */
  private sendValidationError(res: Response, error: unknown): void {
    const apiError: ApiError = {
      code: 'VALIDATION_ERROR',
      message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
      timestamp: new Date().toISOString(),
    };
    res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
  }

  /**
   * 归一化聊天选项
   */
  private normalizeChatOptions(value: ChatRequest): ChatOptions {
    const { attachments, voiceNote, options } = value;

    return {
      ...(options ?? {}),
      ...(value.chatId ? { chatId: value.chatId } : {}),
      ...(typeof value.detail === 'boolean' ? { detail: value.detail } : {}),
      ...(typeof value.temperature === 'number' ? { temperature: value.temperature } : {}),
      ...(typeof value.maxTokens === 'number' ? { maxTokens: value.maxTokens } : {}),
      ...(value.variables ? { variables: value.variables } : {}),
      ...(value.responseChatItemId ? { responseChatItemId: value.responseChatItemId } : {}),
      ...(attachments ? { attachments } : {}),
      ...(voiceNote ? { voiceNote } : {}),
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(normalizedOptions: ChatOptions, value: ChatRequest): string {
    return normalizedOptions.chatId ?? value.chatId ?? generateId();
  }

  /**
   * 验证智能体并返回验证结果
   */
  private async validateAgent(
    agentId: string,
    res?: Response,
  ): Promise<{ error: boolean }> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      if (res) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_NOT_FOUND).json(apiError);
      }
      return { error: true };
    }

    if (!agent.isActive) {
      if (res) {
        const apiError: ApiError = {
          code: 'AGENT_INACTIVE',
          message: `智能体未激活: ${agentId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      }
      return { error: true };
    }

    return { error: false };
  }

  /**
   * 初始化聊天会话
   */
  private async initializeChatSession(
    sessionId: string,
    agentId: string,
    decoratedMessages: ChatMessage[],
  ): Promise<void> {
    await this.historyService.ensureSession(
      sessionId,
      agentId,
      this.buildSessionTitle(decoratedMessages),
    );
  }

  /**
   * 记录聊天活动
   */
  private async recordChatActivity(
    req: ExtendedRequest,
    agentId: string,
    sessionId: string,
    decoratedMessages: ChatMessage[],
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null,
  ): Promise<void> {
    await this.recordGeoSnapshot(req, agentId, sessionId);
    await this.recordUserHistory(sessionId, agentId, decoratedMessages, attachments, voiceNote);
  }

  /**
   * 记录聊天请求日志
   */
  private logChatRequest(
    agentId: string,
    stream: boolean,
    normalizedOptions: ChatOptions,
    decoratedMessages: ChatMessage[],
  ): void {
    logger.debug('🧪 [chatCompletions] 入参(归一化)', {
      agentId,
      stream,
      options: normalizedOptions,
      messagesCount: decoratedMessages.length,
    });
  }

  /**
   * 处理聊天请求
   */
  private async processChatRequest(
    res: Response,
    stream: boolean,
    agentId: string,
    decoratedMessages: ChatMessage[],
    normalizedOptions: ChatOptions,
    sessionId: string,
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null,
  ): Promise<void> {
    // 简化版本 - 移除保护上下文
    const protectionContext = undefined;

    if (stream) {
      await this.handleStreamRequest(
        res,
        agentId,
        decoratedMessages,
        normalizedOptions,
        sessionId,
        attachments,
        voiceNote ?? null,
        protectionContext,
      );
    } else {
      await this.handleNormalRequest(
        res,
        agentId,
        decoratedMessages,
        normalizedOptions,
        sessionId,
        attachments,
        voiceNote ?? null,
        protectionContext,
      );
    }
  }

  /**
   * 处理聊天请求错误
   */
  private handleChatRequestError(res: Response, unknownError: unknown, req: ExtendedRequest): void {
    const typedError = createErrorFromUnknown(unknownError, {
      component: 'ChatController',
      operation: 'chatCompletions',
      url: req.originalUrl,
      method: req.method,
    });

    logger.error('聊天请求处理失败', { error: typedError });

    // 如果响应头已发送（流式响应中），不能再发送JSON响应
    if (res.headersSent) {
      return;
    }

    const apiError: ApiError = {
      code: typedError.code,
      message: typedError.getUserMessage(),
      timestamp: typedError.timestamp,
      ...(process.env.NODE_ENV === 'development' && typedError.context && {
        details: typedError.context as JsonValue,
      }),
    };

    const statusCode = this.getErrorStatusCode(typedError);
    res.status(statusCode).json(apiError);
  }

  /**
   * 处理普通（非流式）聊天请求
   */
  private async handleNormalRequest(
    res: Response,
    agentId: string,
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    sessionId: string,
    _attachments?: ChatAttachmentMetadata[] | null,
    _voiceNote?: VoiceNoteMetadata | null,
    _protectionContext?: unknown,
  ): Promise<void> {
    try {
      const response = await this.chatService.sendMessage(
        agentId,
        messages,
        options,
      );
      const assistantContent = response?.choices?.[0]?.message?.content ?? '';

      try {
        await this.historyService.appendMessage({
          sessionId,
          agentId,
          role: 'assistant',
          content: assistantContent,
          ...(options?.responseChatItemId ? {
            metadata: { responseChatItemId: options.responseChatItemId },
          } : {}),
        });
      } catch (unknownError) {
        const typedError = createErrorFromUnknown(unknownError, {
          component: 'ChatController',
          operation: 'recordAssistantMessage',
          sessionId,
          agentId,
        });
        logger.warn('[ChatController] 记录助手消息失败', { error: typedError.message });
      }

      // ✅ 统一响应格式，确保包含content字段
      ApiResponseHandler.sendSuccess(res, {
        content: assistantContent,
        chatId: sessionId,
        ...response,
      }, {
        message: '聊天请求成功',
        code: 'SUCCESS', // ✅ 使用测试期望的code
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'handleNormalRequest',
        sessionId,
        agentId,
      });

      logger.error('普通聊天请求失败', { error: typedError.message });

      // 检查是否是降级响应
      if (typeof unknownError === 'object' && unknownError !== null && 'fallbackUsed' in unknownError) {
        const fallbackError = unknownError as { fallbackUsed?: boolean; data?: JsonValue };
        if (fallbackError.fallbackUsed) {
          ApiResponseHandler.sendSuccess(res, fallbackError.data ?? null, {
            message: '已返回降级响应',
          });
          return;
        }
      }

      const apiError = typedError.toApiError();
      const statusCode = this.getErrorStatusCode(typedError);
      res.status(statusCode).json(apiError);
    }
  }

  /**
   * 处理流式聊天请求 - 修复 FastGPT 流式响应
   */
  private async handleStreamRequest(
    res: Response,
    agentId: string,
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    sessionId: string,
    _attachments?: ChatAttachmentMetadata[] | null,
    _voiceNote?: VoiceNoteMetadata | null,
    _protectionContext?: unknown,
  ): Promise<void> {
    try {
      // 标准 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // 兼容反向代理
      // 立即刷新头部，避免缓冲
      const extendedRes = res as ExtendedResponse;
      if (typeof extendedRes.flushHeaders === 'function') {
        extendedRes.flushHeaders();
      }

      logger.debug('🚀 开始处理流式请求', { agentId });

      // 发送初始化事件
      this.sendSSEEvent(res, 'chatId', { chatId: sessionId } as JsonValue);
      this.sendSSEEvent(res, 'start', {
        id: generateId(),
        timestamp: new Date().toISOString(),
        agentId,
      } as JsonValue);

      let assistantContent = '';

      // 发送流式消息
      await this.chatService.sendStreamMessage(
        agentId,
        messages,
        // 内容回调 - 确保正确调用
        (chunk: string) => {
          logger.debug('📨 收到内容块', { preview: chunk.substring(0, LOG_PREVIEW_MAX_LENGTH) });
          assistantContent += chunk;
          this.sendSSEEvent(res, 'chunk', { content: chunk } as JsonValue);
        },
        // 状态回调 - 确保正确调用
        (status: StreamStatus) => {
          logger.debug('📊 收到状态更新', { status });
          this.sendSSEEvent(res, 'status', DynamicDataConverter.toSafeJsonValue(status));

          // 如果是完成或错误状态，结束响应
          if (status.type === 'complete' || status.type === 'error') {
            logger.debug('✅ 流式响应完成');
            this.sendSSEEvent(res, 'end', {
              timestamp: new Date().toISOString(),
            } as JsonValue);
            res.end();
          }
        },
        options,
        // 事件透传回调：关注 FastGPT 的 interactive 以及 chatId 事件
        (eventName: string, data: SSEEventData) => {
          if (!eventName) {
            return;
          }

          if (eventName === 'interactive') {
            let payloadPreview = '[Unserializable]';
            try {
              payloadPreview = JSON.stringify(data).slice(0, 300);
            } catch {
          // 忽略序列化错误
        }
            logger.debug('🧩 收到交互节点事件 interactive', { payloadPreview });
            this.sendSSEEvent(res, 'interactive', DynamicDataConverter.toSafeJsonValue(data));
            return;
          }

          if (eventName === 'chatId') {
            const dataObj = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {};
            const chatId = (dataObj.chatId ?? dataObj.id ?? data) as string | JsonValue;
            logger.debug('🆔 透传本次使用的 chatId', { chatId });
            this.sendSSEEvent(res, 'chatId', DynamicDataConverter.toSafeJsonValue(data));
            return;
          }

          logger.debug('📎 透传 FastGPT 事件', { eventName });
          this.sendSSEEvent(res, eventName, DynamicDataConverter.toSafeJsonValue(data));
        },
      );

      if (assistantContent) {
        try {
          await this.historyService.appendMessage({
            sessionId,
            agentId,
            role: 'assistant',
            content: assistantContent,
            ...(options?.responseChatItemId ? {
              metadata: { responseChatItemId: options.responseChatItemId },
            } : {}),
          });
        } catch (unknownError) {
          const typedError = createErrorFromUnknown(unknownError, {
            component: 'ChatController',
            operation: 'recordStreamAssistantMessage',
            sessionId,
            agentId,
          });
          logger.warn('[ChatController] 记录流式助手消息失败', { error: typedError.message });
        }
      }
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'handleStreamRequest',
        sessionId,
        agentId,
      });

      logger.error('❌ 流式聊天请求失败', { error: typedError.message });

      // 检查是否是降级响应
      if (typeof unknownError === 'object' && unknownError !== null && 'fallbackUsed' in unknownError) {
        const fallbackError = unknownError as { fallbackUsed?: boolean; data?: JsonValue };
        if (fallbackError.fallbackUsed) {
          this.sendSSEEvent(res, 'fallback', (fallbackError.data ?? null) as JsonValue);
          res.end();
          return;
        }
      }

      // 发送错误事件
      this.sendSSEEvent(res, 'error', {
        code: typedError.code,
        message: typedError.message,
        timestamp: typedError.timestamp,
      } as JsonValue);

      res.end();
    }
  }

  /**
   * 发送SSE事件
   */
  private sendSSEEvent(res: Response, event: string, data: unknown): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'sendSSEEvent',
        context: { event, dataType: typeof data },
      });
      logger.error('发送SSE事件失败', { error: typedError.message });
    }
  }

  /**
   * 聊天初始化接口
   * GET /api/chat/init?appId=xxx&chatId=xxx&stream=true
   */
  chatInit = async (req: ExtendedRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      // 参数验证
      const { error, value } = this.chatInitSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const { appId, chatId, stream } = value;

      logger.debug('🚀 处理聊天初始化请求', { appId, chatId, stream });

      // 检查智能体是否存在且激活
      const agent = await this.agentService.getAgent(appId);
      if (!agent) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${appId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_NOT_FOUND).json(apiError);
        return;
      }

      if (!agent.isActive) {
        const apiError: ApiError = {
          code: 'AGENT_INACTIVE',
          message: `智能体未激活: ${appId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      await this.recordGeoSnapshot(req, agent.id, typeof chatId === 'string' ? chatId : null);

      // 根据stream参数决定处理方式
      if (stream) {
        await this.handleInitStreamRequest(res, appId, chatId);
      } else {
        await this.handleInitNormalRequest(res, appId, chatId);
      }

    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'chatInit',
        url: req.originalUrl,
        method: req.method,
      });

      logger.error('聊天初始化请求处理失败', { error: typedError.message });

      // 如果响应头已发送（流式响应中），不能再发送JSON响应
      if (res.headersSent) {
        return;
      }

      const apiError = typedError.toApiError();

      if (process.env.NODE_ENV === 'development') {
        apiError.details = {
          originalError: typedError.message,
          ...(typedError.stack && { stack: typedError.stack }),
        } as JsonValue;
      }

      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  };

  /**
   * 处理普通（非流式）初始化请求
   */
  private async handleInitNormalRequest(
    res: Response,
    appId: string,
    chatId?: string,
  ): Promise<void> {
    try {
      const initData = await this.initService.getInitData(appId, chatId);

      ApiResponseHandler.sendSuccess(res, initData, {
        message: '初始化数据获取成功',
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'handleInitNormalRequest',
        url: res.req?.originalUrl,
        method: res.req?.method,
        context: { appId, chatId },
      });

      const apiError = typedError.toApiError();
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 处理流式初始化请求
   */
  private async handleInitStreamRequest(
    res: Response,
    appId: string,
    chatId?: string,
  ): Promise<void> {
    try {
      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 立即刷新头部
      const extendedRes = res as ExtendedResponse;
      if (typeof extendedRes.flushHeaders === 'function') {
        extendedRes.flushHeaders();
      }

      logger.debug('🚀 开始处理流式初始化请求', { appId });
      logger.debug('ℹ️ 初始化流仅包含 start/chunk/complete/end 事件，不包含 interactive 事件');

      // 发送初始化事件
      this.sendSSEEvent(res, 'start', {
        id: generateId(),
        timestamp: new Date().toISOString(),
        appId,
        type: 'init',
      } as JsonValue);

      // 调用流式初始化服务
      await this.initService.getInitDataStream(
        appId,
        chatId,
        // 内容回调 - 流式输出开场白
        (chunk: string) => {
          this.sendSSEEvent(res, 'chunk', { content: chunk } as JsonValue);
        },
        // 完成回调 - 返回完整初始化数据
        (initData) => {
          logger.debug('✅ 初始化数据获取完成');
          this.sendSSEEvent(res, 'complete', DynamicDataConverter.toSafeJsonValue({
            data: initData,
            timestamp: new Date().toISOString(),
          }));
          this.sendSSEEvent(res, 'end', {
            timestamp: new Date().toISOString(),
          } as JsonValue);
          res.end();
        },
        // 错误回调
        (unknownError) => {
          const typedError = createErrorFromUnknown(unknownError, {
            component: 'ChatController',
            operation: 'initDataStream',
            context: { appId, chatId },
          });
          logger.error('❌ 初始化流式处理失败', { error: typedError.message });
          this.sendSSEEvent(res, 'error', {
            code: typedError.code,
            message: typedError.message,
            timestamp: typedError.timestamp,
          } as JsonValue);
          this.sendSSEEvent(res, 'end', {
            timestamp: new Date().toISOString(),
          } as JsonValue);
          res.end();
        },
      );

    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'handleInitStreamRequest',
        url: res.req?.originalUrl,
        method: res.req?.method,
        context: { appId, chatId },
      });
      logger.error('❌ 流式初始化请求处理失败', { error: typedError.message });

      if (!res.headersSent) {
        const apiError = typedError.toApiError();
        res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
      } else {
        this.sendSSEEvent(res, 'error', {
          code: typedError.code,
          message: typedError.message,
          timestamp: typedError.timestamp,
        } as JsonValue);
        res.end();
      }
    }
  }
  /**
   * 点赞/点踩反馈
   * POST: /api/chat/feedback
   */
  updateUserFeedback = async (req: ExtendedRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { error, value } = this.feedbackSchema.validate(req.body);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const { agentId, chatId, dataId, userGoodFeedback, userBadFeedback } = value as {
        agentId: string;
        chatId: string;
        dataId: string;
        userGoodFeedback?: boolean;
        userBadFeedback?: boolean;
      };

      const feedbackData: {
        chatId: string;
        dataId: string;
        userGoodFeedback?: string;
        userBadFeedback?: string;
      } = {
        chatId,
        dataId,
      };
      if (userGoodFeedback !== undefined) {
        feedbackData.userGoodFeedback = userGoodFeedback ? 'true' : 'false';
      }
      if (userBadFeedback !== undefined) {
        feedbackData.userBadFeedback = userBadFeedback ? 'true' : 'false';
      }

      await this.fastgptSessionService.updateUserFeedback(agentId, feedbackData);

      ApiResponseHandler.sendSuccess(res, null, {
        message: '反馈提交成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'updateUserFeedback',
        url: req.originalUrl,
        method: req.method,
      });
      logger.error('提交点赞/点踩反馈失败', { error: typedError.message });

      const apiError = typedError.toApiError();
      let status = this.getErrorStatusCode(typedError);

      // 特殊处理某些错误代码
      const originalErrorObj = SafeAccess.getObject(typedError.context, 'originalError');
      const originalError = originalErrorObj instanceof Error ? originalErrorObj : undefined;
      if (originalError) {
        const errCode = ErrorExtractor.extractCode(originalError);
        const axiosStatus = ErrorExtractor.extractStatus(originalError);
        if (errCode === 'NOT_FOUND') {
          status = HTTP_STATUS_NOT_FOUND;
          apiError.code = 'AGENT_NOT_FOUND';
        } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
          status = HTTP_STATUS_BAD_REQUEST;
          apiError.code = errCode;
        } else if (axiosStatus === HTTP_STATUS_NOT_FOUND) {
          status = HTTP_STATUS_SERVER_ERROR;
          apiError.code = 'UPSTREAM_NOT_FOUND';
        } else if (axiosStatus === HTTP_STATUS_UNAUTHORIZED) {
          status = HTTP_STATUS_UNAUTHORIZED;
          apiError.code = 'UPSTREAM_UNAUTHORIZED';
        } else if (axiosStatus === HTTP_STATUS_TIMEOUT) {
          status = HTTP_STATUS_GATEWAY_TIMEOUT;
          apiError.code = 'UPSTREAM_TIMEOUT';
        }
      }

      res.status(status).json(apiError);
    }
  };

  /**
   * 获取会话历史列表
   * GET /api/chat/history?agentId=xxx
   */
  listChatHistories = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      const { error, value } = this.historyListSchema.validate(req.query);
      if (error) {
        this.sendValidationError(res, error);
        return;
      }

      const { agentId, page, pageSize } = value as { agentId: string; page?: number; pageSize?: number };

      // 验证智能体
      const agentValidation = await this.validateAgentForHistory(agentId);
      if (!agentValidation.success) {
        this.sendAgentValidationError(res, agentValidation);
        return;
      }

      // 构建分页参数
      const pagination = this.buildPaginationParams(page, pageSize);

      // 获取历史记录
      const histories: FastGPTChatHistorySummary[] = await this.fastgptSessionService.listHistories(
        agentId,
        pagination,
      );

      // 构建额外元数据
      const extraMetadata = this.buildHistoryMetadata(pagination);

      // 发送成功响应
      ApiResponseHandler.sendSuccess(res, histories, {
        message: '获取聊天历史成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
        ...(Object.keys(extraMetadata).length
          ? { metadata: { extra: extraMetadata } }
          : {}),
      });
    } catch (unknownError) {
      this.handleHistoryListError(res, unknownError, req);
    }
  };

  /**
   * 验证智能体是否支持历史记录查询
   */
  private async validateAgentForHistory(agentId: string): Promise<{ success: boolean; reason?: string; status?: number }> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      return { success: false, reason: 'AGENT_NOT_FOUND', status: HTTP_STATUS_NOT_FOUND };
    }

    if (agent.provider !== 'fastgpt') {
      return { success: false, reason: 'INVALID_PROVIDER', status: HTTP_STATUS_BAD_REQUEST };
    }

    return { success: true };
  }

  /**
   * 发送智能体验证错误响应
   */
  private sendAgentValidationError(res: Response, validation: { reason?: string; status?: number }): void {
    const messages = {
      'AGENT_NOT_FOUND': '智能体不存在',
      'INVALID_PROVIDER': '智能体不支持远程会话历史查询',
    };

    const apiError: ApiError = {
      code: validation.reason ?? 'VALIDATION_ERROR',
      message: validation.reason ? messages[validation.reason as keyof typeof messages] ?? '参数验证失败' : '参数验证失败',
      timestamp: new Date().toISOString(),
    };

    const statusCode = validation.status ?? HTTP_STATUS_BAD_REQUEST;
    res.status(statusCode).json(apiError);
  }

  /**
   * 构建分页参数
   */
  private buildPaginationParams(page?: number, pageSize?: number): { page?: number; pageSize?: number } {
    const pagination: { page?: number; pageSize?: number } = {};
    if (typeof page === 'number') {
      pagination.page = page;
    }
    if (typeof pageSize === 'number') {
      pagination.pageSize = pageSize;
    }
    return pagination;
  }

  /**
   * 构建历史记录元数据
   */
  private buildHistoryMetadata(pagination: { page?: number; pageSize?: number }): Record<string, JsonValue> {
    const extraMetadata: Record<string, JsonValue> = {};
    if (typeof pagination.page === 'number') {
      extraMetadata.page = pagination.page;
    }
    if (typeof pagination.pageSize === 'number') {
      extraMetadata.pageSize = pagination.pageSize;
    }
    return extraMetadata;
  }

  /**
   * 处理历史列表错误
   */
  private handleHistoryListError(res: Response, unknownError: unknown, req: ExtendedRequest): void {
    const typedError = createErrorFromUnknown(unknownError, {
      component: 'ChatController',
      operation: 'listChatHistories',
      url: req.originalUrl,
      method: req.method,
    });
    logger.error('获取聊天历史列表失败', { error: typedError.message });

    const apiError = typedError.toApiError();
    let status = this.getErrorStatusCode(typedError);

    // 错误语义映射
    const originalErrorObj = SafeAccess.getObject(typedError.context, 'originalError');
    const originalError = originalErrorObj instanceof Error ? originalErrorObj : undefined;
    if (originalError) {
      status = this.mapErrorToHttpStatus(originalError, apiError, status);
    }

    res.status(status).json(apiError);
  }

  /**
   * 将错误映射到HTTP状态码和错误代码
   */
  private mapErrorToHttpStatus(
    originalError: Error,
    apiError: ApiError,
    defaultStatus: number,
  ): number {
    let status = defaultStatus;
    const errCode = ErrorExtractor.extractCode(originalError);
    const axiosStatus = ErrorExtractor.extractStatus(originalError);

    if (errCode === 'NOT_FOUND') {
      status = HTTP_STATUS_NOT_FOUND;
      apiError.code = 'AGENT_NOT_FOUND';
    } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
      status = HTTP_STATUS_BAD_REQUEST;
      apiError.code = errCode;
    } else if (axiosStatus === HTTP_STATUS_NOT_FOUND) {
      status = HTTP_STATUS_SERVER_ERROR;
      apiError.code = 'UPSTREAM_NOT_FOUND';
    } else if (axiosStatus === HTTP_STATUS_UNAUTHORIZED) {
      status = HTTP_STATUS_UNAUTHORIZED;
      apiError.code = 'UPSTREAM_UNAUTHORIZED';
    } else if (axiosStatus === HTTP_STATUS_TIMEOUT) {
      status = HTTP_STATUS_GATEWAY_TIMEOUT;
      apiError.code = 'UPSTREAM_TIMEOUT';
    }

    return status;
  }

  /**
   * 获取指定会话历史详情
   * GET /api/chat/history/:chatId?agentId=xxx
   */
  getChatHistory = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      // 验证用户认证
      const authResult = await this.authenticateUser(req);
      if (!authResult.success) {
        this.sendAuthError(res, authResult.error || '未授权访问');
        return;
      }

      // 提取和验证会话ID
      const chatId = this.extractChatId(req.params);
      if (!chatId) {
        this.sendChatIdRequiredError(res);
        return;
      }

      // 验证查询参数
      const { error: validationError, value } = this.historyDetailSchema.validate(req.query);
      if (validationError) {
        this.sendValidationError(res, validationError);
        return;
      }

      const { agentId } = value as { agentId: string };

      // 验证智能体
      const agentValidation = await this.validateAgentForHistory(agentId);
      if (!agentValidation.success) {
        this.sendAgentValidationError(res, agentValidation);
        return;
      }

      // 获取历史详情
      const detail = await this.fetchChatHistoryDetail(agentId, chatId);

      // 验证访问权限
      if (!this.validateAccessPermission(detail, authResult.user!)) {
        this.sendForbiddenError(res);
        return;
      }

      // 发送成功响应
      ApiResponseHandler.sendSuccess(res, detail, {
        message: '获取聊天历史详情成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (err: unknown) {
      this.handleGetHistoryError(res, err);
    }
  };

  /**
   * 验证用户认证
   */
  private async authenticateUser(
    req: ExtendedRequest,
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const authUser = await requireAuthenticatedUser(req);
      return { success: true, user: authUser };
    } catch (authError) {
      const error = authError instanceof Error && authError.message === 'TOKEN_EXPIRED'
        ? '登录已过期，请重新登录'
        : '未授权访问';
      return { success: false, error };
    }
  }

  /**
   * 发送认证错误响应
   */
  private sendAuthError(res: Response, errorMessage: string): void {
    const apiError: ApiError = {
      code: 'UNAUTHORIZED',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    };
    res.status(HTTP_STATUS_UNAUTHORIZED).json(apiError);
  }

  /**
   * 提取会话ID
   */
  private extractChatId(params: any): string | null {
    const { chatId: pathChatId, sessionId } = params as { chatId?: string; sessionId?: string };
    return pathChatId ?? sessionId ?? null;
  }

  /**
   * 发送chatId缺失错误
   */
  private sendChatIdRequiredError(res: Response): void {
    const apiError: ApiError = {
      code: 'CHAT_ID_REQUIRED',
      message: 'chatId 不能为空',
      timestamp: new Date().toISOString(),
    };
    res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
  }

  /**
   * 发送禁止访问错误
   */
  private sendForbiddenError(res: Response): void {
    const apiError: ApiError = {
      code: 'FORBIDDEN',
      message: '无权访问该会话记录',
      timestamp: new Date().toISOString(),
    };
    res.status(HTTP_STATUS_FORBIDDEN).json(apiError);
  }

  /**
   * 获取聊天历史详情
   */
  private async fetchChatHistoryDetail(agentId: string, chatId: string): Promise<FastGPTChatHistoryDetail> {
    return await this.fastgptSessionService.getHistoryDetail(agentId, chatId);
  }

  /**
   * 验证访问权限
   */
  private validateAccessPermission(detail: FastGPTChatHistoryDetail, user: AuthUser): boolean {
    if (
      detail.sessionInfo?.userId &&
      detail.sessionInfo.userId !== user.id &&
      user.role !== 'admin'
    ) {
      return false;
    }
    return true;
  }

  /**
   * 处理获取历史详情错误
   */
  private handleGetHistoryError(res: Response, err: unknown): void {
    logger.error('获取聊天历史失败', { error: err });
    const apiError: ApiError = {
      code: 'GET_HISTORY_FAILED',
      message: err instanceof Error ? err.message : '获取聊天历史失败',
      timestamp: new Date().toISOString(),
    };

    let status = 500;
    const errCode = ErrorExtractor.extractCode(err);
    const axiosStatus = ErrorExtractor.extractStatus(err);

    if (errCode === 'NOT_FOUND') {
      status = HTTP_STATUS_NOT_FOUND;
      apiError.code = 'AGENT_NOT_FOUND';
    } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
      status = HTTP_STATUS_BAD_REQUEST;
      apiError.code = errCode;
    } else if (axiosStatus === HTTP_STATUS_NOT_FOUND) {
      status = HTTP_STATUS_SERVER_ERROR;
      apiError.code = 'UPSTREAM_NOT_FOUND';
    } else if (axiosStatus === HTTP_STATUS_UNAUTHORIZED) {
      status = HTTP_STATUS_UNAUTHORIZED;
      apiError.code = 'UPSTREAM_UNAUTHORIZED';
    } else if (axiosStatus === HTTP_STATUS_TIMEOUT) {
      status = HTTP_STATUS_GATEWAY_TIMEOUT;
      apiError.code = 'UPSTREAM_TIMEOUT';
    }

    res.status(status).json(apiError);
  }

  /**
   * 删除指定会话历史
   * DELETE /api/chat/history/:chatId?agentId=xxx
   */
  deleteChatHistory = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      const chatIdParam = req.params.chatId;
      if (!chatIdParam) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: '缺少 chatId 参数',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const chatId = chatIdParam;
      const { error, value } = this.historyDeleteSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const { agentId } = value as { agentId: string };
      await this.fastgptSessionService.deleteHistory(agentId, chatId);

      ApiResponseHandler.sendSuccess(res, null, {
        message: '聊天历史删除成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (err: unknown) {
      logger.error('删除聊天历史失败', { error: err });
      const apiError: ApiError = {
        code: 'DELETE_HISTORY_FAILED',
        message: err instanceof Error ? err.message : '删除聊天历史失败',
        timestamp: new Date().toISOString(),
      };
      let status = 500;
      const errCode = ErrorExtractor.extractCode(err);
      const axiosStatus = ErrorExtractor.extractStatus(err);
      if (errCode === 'NOT_FOUND') {
        status = HTTP_STATUS_NOT_FOUND;
        apiError.code = 'AGENT_NOT_FOUND';
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = HTTP_STATUS_BAD_REQUEST;
        apiError.code = errCode;
      } else if (axiosStatus === HTTP_STATUS_NOT_FOUND) {
        status = HTTP_STATUS_SERVER_ERROR;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === HTTP_STATUS_UNAUTHORIZED) {
        status = HTTP_STATUS_UNAUTHORIZED;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === HTTP_STATUS_TIMEOUT) {
        status = HTTP_STATUS_GATEWAY_TIMEOUT;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }
      res.status(status).json(apiError);
    }
  };

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'ensureUploadDirectory',
        context: { uploadDir: this.uploadDir },
      });
      logger.warn('[ChatController] 创建上传目录失败', { error: typedError.message });
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  uploadAttachment = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      const { error, value } = this.attachmentUploadSchema.validate(req.body);
      if (error) {
        res.status(HTTP_STATUS_BAD_REQUEST).json({
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message ?? '附件参数校验失败',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const buffer = Buffer.from(value.data, 'base64');
      if (!buffer || buffer.length === 0) {
        res.status(HTTP_STATUS_BAD_REQUEST).json({
          code: 'INVALID_ATTACHMENT',
          message: '附件内容不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (buffer.length > value.size * 1.2) {
        res.status(HTTP_STATUS_BAD_REQUEST).json({
          code: 'INVALID_ATTACHMENT',
          message: '附件大小与声明不符',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.ensureUploadDirectory();

      const fileId = generateId();
      const safeName = this.sanitizeFilename(value.filename);
      const finalName = `${fileId}-${safeName}`;
      const filePath = path.join(this.uploadDir, finalName);

      await fs.writeFile(filePath, buffer);

      const metadata: ChatAttachmentMetadata = {
        id: fileId,
        name: value.filename,
        mimeType: value.mimeType,
        size: buffer.length,
        url: `/uploads/${finalName}`,
        source: value.source ?? 'upload',
      };

      ApiResponseHandler.sendSuccess(res, metadata, {
        message: '附件上传成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'uploadAttachment',
        url: req.originalUrl,
        method: req.method,
      });
      logger.error('[ChatController] 上传附件失败', { error: typedError.message });
      const apiError = typedError.toApiError();
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  };

  /**
   * 获取会话消息列表
   * GET /api/chat/sessions/:sessionId/messages
   */
  getSessionMessages = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params as { sessionId?: string };

      if (!sessionId) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'sessionId 不能为空',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const { error, value } = this.historyMessagesSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const { limit, offset, role: roleRaw } = value as {
        limit?: number;
        offset?: number;
        role?: unknown;
      };

      const queryOptions: ChatHistoryQueryOptions = {};
      if (typeof limit === 'number') {
        queryOptions.limit = limit;
      }
      if (typeof offset === 'number') {
        queryOptions.offset = offset;
      }

      const normalizedRoles = this.parseHistoryRoleFilter(roleRaw);
      if (normalizedRoles.length > 0) {
        queryOptions.roles = normalizedRoles;
      }

      const history = await this.historyService.getHistory(sessionId, queryOptions);

      if (!history.session) {
        const apiError: ApiError = {
          code: 'SESSION_NOT_FOUND',
          message: `未找到会话: ${sessionId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_NOT_FOUND).json(apiError);
        return;
      }

      ApiResponseHandler.sendSuccess(res, history, {
        message: '获取会话消息成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'getSessionMessages',
        url: req.originalUrl,
        method: req.method,
      });
      logger.error('获取会话消息失败', { error: typedError.message });

      const apiError = typedError.toApiError();
      let status = this.getErrorStatusCode(typedError);

      const originalErrorObj = SafeAccess.getObject(typedError.context, 'originalError');
      const originalError = originalErrorObj instanceof Error ? originalErrorObj : undefined;
      if (originalError) {
        const errCode = ErrorExtractor.extractCode(originalError);
        const axiosStatus = ErrorExtractor.extractStatus(originalError);
        if (errCode === 'NOT_FOUND') {
          status = HTTP_STATUS_NOT_FOUND;
          apiError.code = 'SESSION_NOT_FOUND';
        } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
          status = HTTP_STATUS_BAD_REQUEST;
          apiError.code = errCode;
        } else if (axiosStatus === HTTP_STATUS_NOT_FOUND) {
          status = HTTP_STATUS_SERVER_ERROR;
          apiError.code = 'UPSTREAM_NOT_FOUND';
        } else if (axiosStatus === HTTP_STATUS_UNAUTHORIZED) {
          status = HTTP_STATUS_UNAUTHORIZED;
          apiError.code = 'UPSTREAM_UNAUTHORIZED';
        } else if (axiosStatus === HTTP_STATUS_TIMEOUT) {
          status = HTTP_STATUS_GATEWAY_TIMEOUT;
          apiError.code = 'UPSTREAM_TIMEOUT';
        }
      }

      res.status(status).json(apiError);
    }
  };

  /**
   * 清空指定智能体的历史
   * DELETE /api/chat/history?agentId=xxx
   */
  clearChatHistories = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      const { error, value } = this.historyDeleteSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
        return;
      }

      const { agentId } = value as { agentId: string };
      await this.fastgptSessionService.clearHistories(agentId);

      ApiResponseHandler.sendSuccess(res, null, {
        message: '聊天历史已清空',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (err: unknown) {
      logger.error('清空聊天历史失败', { error: err });
      const apiError: ApiError = {
        code: 'CLEAR_HISTORY_FAILED',
        message: err instanceof Error ? err.message : '清空聊天历史失败',
        timestamp: new Date().toISOString(),
      };
      let status = 500;
      const errCode = ErrorExtractor.extractCode(err);
      const axiosStatus = ErrorExtractor.extractStatus(err);
      if (errCode === 'NOT_FOUND') {
        status = HTTP_STATUS_NOT_FOUND;
        apiError.code = 'AGENT_NOT_FOUND';
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = HTTP_STATUS_BAD_REQUEST;
        apiError.code = errCode;
      } else if (axiosStatus === HTTP_STATUS_NOT_FOUND) {
        status = HTTP_STATUS_SERVER_ERROR;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === HTTP_STATUS_UNAUTHORIZED) {
        status = HTTP_STATUS_UNAUTHORIZED;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === HTTP_STATUS_TIMEOUT) {
        status = HTTP_STATUS_GATEWAY_TIMEOUT;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }
      res.status(status).json(apiError);
    }
  };

  /**
   * 重新生成指定消息
   * POST /api/chat/history/:chatId/retry
   */
  retryChatMessage = async (req: ExtendedRequest, res: Response): Promise<void> => {
    const { chatId: chatIdParam } = req.params as { chatId?: string };
    if (!chatIdParam) {
      const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '缺少 chatId 参数',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
    }

    const chatId = chatIdParam;
    const { error, value } = this.historyRetrySchema.validate(req.body);
    if (error) {
      const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: ErrorExtractor.extractMessage(error) ?? '请求参数校验失败',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
    }

    const { agentId, dataId, stream, detail } = value as { agentId: string; dataId: string; stream?: boolean; detail?: boolean };

    try {
      const historyDetail = await this.fastgptSessionService.getHistoryDetail(agentId, chatId);
      const prepared = this.fastgptSessionService.prepareRetryPayload(historyDetail, dataId);

      if (!prepared?.messages || prepared.messages.length === 0) {
        const apiError: ApiError = {
          code: 'RETRY_TARGET_NOT_FOUND',
          message: '未找到可重新生成的用户消息',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_NOT_FOUND).json(apiError);
        return;
      }

      const options: ChatOptions = {
        chatId,
        ...(typeof detail === 'boolean' ? { detail } : {}),
        ...(prepared.responseChatItemId ? { responseChatItemId: prepared.responseChatItemId } : {}),
      };

      if (stream) {
        await this.handleStreamRequest(res, agentId, prepared.messages, options, chatId);
        return;
      }

      await this.handleNormalRequest(res, agentId, prepared.messages, options, chatId);
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ChatController',
        operation: 'retryChatMessage',
        url: req.originalUrl,
        method: req.method,
        context: { stream, sessionId: chatId, agentId },
      });
      logger.error('重新生成聊天消息失败', { error: typedError.message });

      if (stream && res.headersSent) {
        this.sendSSEEvent(res, 'error', {
          code: typedError.code,
          message: typedError.message,
          timestamp: typedError.timestamp,
        } as JsonValue);
        res.end();
        return;
      }

      const apiError = typedError.toApiError();
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  };

  /**
   * 解析请求中的角色过滤参数，兼容多种格式避免运行时异常
   */
  private parseHistoryRoleFilter(roleValue: unknown): Array<(typeof ChatController.supportedHistoryRoles)[number]> {
    type HistoryRole = (typeof ChatController.supportedHistoryRoles)[number];
    if (roleValue === undefined || roleValue === null) {
      return [];
    }

    const allowed = new Set<HistoryRole>(ChatController.supportedHistoryRoles);
    const result = new Set<HistoryRole>();

    const collect = (raw: unknown) => {
      if (typeof raw !== 'string') {
        return;
      }
      const normalized = raw.trim().toLowerCase() as HistoryRole;
      if (allowed.has(normalized)) {
        result.add(normalized);
      }
    };

    if (Array.isArray(roleValue)) {
      roleValue.forEach(collect);
    } else if (typeof roleValue === 'string') {
      const trimmed = roleValue.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parsed.forEach(collect);
          } else {
            collect(parsed);
          }
        } catch (parseError) {
          logger.warn('角色过滤参数解析失败，回退到逗号分隔解析', {
            raw: roleValue,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
          trimmed.split(',').forEach(collect);
        }
      } else {
        trimmed.split(',').forEach(collect);
      }
    } else if (typeof roleValue === 'object' && roleValue !== null) {
      Object.values(roleValue as Record<string, unknown>).forEach(collect);
    }

    return Array.from(result);
  }

  /**
   * 获取错误状态码
   */
  private getErrorStatusCode(error: Error): number {
    const message = error.message.toLowerCase();

    if (message.includes('熔断器')) {
      return 503;
    }
    if (message.includes('限流')) {
      return 429;
    }
    if (message.includes('超时')) {
      return 408;
    }
    if (message.includes('网络')) {
      return 502;
    }
    if (message.includes('不可用')) {
      return 503;
    }

    return 500;
  }

  /**
   * 获取错误代码
   */
  private getErrorCode(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('熔断器')) {
      return 'CIRCUIT_BREAKER_OPEN';
    }
    if (message.includes('限流')) {
      return 'RATE_LIMIT_EXCEEDED';
    }
    if (message.includes('超时')) {
      return 'REQUEST_TIMEOUT';
    }
    if (message.includes('网络')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('不可用')) {
      return 'SERVICE_UNAVAILABLE';
    }

    return 'INTERNAL_ERROR';
  }
}
