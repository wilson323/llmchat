import { Request, Response } from 'express';
import * as Joi from 'joi';
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';

/**
 * 扩展的 Express Request 接口，包含文件信息
 */
interface FileUploadRequest extends Request {
  file?: any; // Use any for now to avoid stream type issues
}

/**
 * 扩展的 Express Response 接口，包含 flushHeaders 方法
 */
interface ExtendedResponse extends Omit<Response, 'flushHeaders'> {
  flushHeaders(): void;
}

/**
 * 聊天附件控制器
 * 专门处理聊天中的文件上传、下载和管理
 */
export class ChatAttachmentController {
  /**
   * 文件上传参数验证Schema
   */
  private uploadAttachmentSchema = Joi.object({
    sessionId: Joi.string().uuid().required().messages({
      'any.required': 'sessionId是必需的'
    }),
    agentId: Joi.string().required().messages({
      'any.required': 'agentId是必需的'
    }),
    fileType: Joi.string().valid('image', 'document', 'audio', 'video', 'other').default('other').messages({
      'any.only': 'fileType必须是有效的文件类型'
    }),
    description: Joi.string().max(500).optional().messages({
      'string.max': 'description不能超过500个字符'
    })
  });

  /**
   * 允许的文件类型
   */
  private readonly ALLOWED_MIME_TYPES = [
    // 图片
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // 文档
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    // 音频
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    // 视频
    'video/mp4',
    'video/webm',
    'video/ogg'
  ];

  /**
   * 文件大小限制（10MB）
   */
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * 上传聊天附件
   */
  uploadAttachment = async (req: FileUploadRequest, res: Response): Promise<void> => {
    const extendedRes = res as ExtendedResponse;

    try {
      // 检查是否有文件上传
      if (!req.file) {
        logger.warn('📎 [uploadAttachment] 没有检测到上传的文件');
        ApiResponseHandler.sendError(res, { message: '没有检测到上传的文件' }, { statusCode: 400 });
        return;
      }

      // 验证上传参数
      const { error, value } = this.uploadAttachmentSchema.validate(req.body);
      if (error) {
        logger.warn('📎 [uploadAttachment] 上传参数验证失败', {
          body: req.body,
          error: error.details[0]?.message
        });
        ApiResponseHandler.sendValidationError(res, error.message);
        return;
      }

      const { sessionId, agentId, fileType, description } = value;
      const file = req.file;

      // 验证文件大小
      if (file.size > this.MAX_FILE_SIZE) {
        logger.warn('📎 [uploadAttachment] 文件大小超出限制', {
          sessionId,
          agentId,
          fileSize: file.size,
          maxSize: this.MAX_FILE_SIZE
        });
        ApiResponseHandler.sendError(res, { message: `文件大小不能超过 ${this.MAX_FILE_SIZE / 1024 / 1024}MB` }, { statusCode: 400 });
        return;
      }

      // 验证文件类型
      if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        logger.warn('📎 [uploadAttachment] 不支持的文件类型', {
          sessionId,
          agentId,
          mimetype: file.mimetype,
          originalname: file.originalname
        });
        ApiResponseHandler.sendError(res, { message: `不支持的文件类型: ${file.mimetype}` }, { statusCode: 400 });
        return;
      }

      logger.info('📎 [uploadAttachment] 开始处理文件上传', {
        sessionId,
        agentId,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fileType
      });

      // TODO: 实现文件上传处理逻辑
      const uploadResult = await this.processFileUpload({
        sessionId,
        agentId,
        file,
        fileType,
        description,
        uploadedAt: new Date()
      });

      logger.info('📎 [uploadAttachment] 文件上传成功', {
        sessionId,
        agentId,
        attachmentId: uploadResult.attachmentId,
        originalname: file.originalname,
        url: uploadResult.url
      });

      ApiResponseHandler.sendSuccess(res, {
        attachmentId: uploadResult.attachmentId,
        sessionId,
        agentId,
        originalname: file.originalname,
        filename: uploadResult.filename,
        mimetype: file.mimetype,
        size: file.size,
        fileType: uploadResult.fileType,
        url: uploadResult.url,
        description: uploadResult.description,
        uploadedAt: uploadResult.uploadedAt,
        expiresAt: uploadResult.expiresAt
      }, { message: '文件上传成功' });

    } catch (error) {
      logger.error('❌ [uploadAttachment] 文件上传失败', {
        sessionId: req.body?.sessionId,
        agentId: req.body?.agentId,
        originalname: req.file?.originalname,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 获取附件列表
   */
  getAttachments = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.sessionId;

      if (!sessionId) {
        ApiResponseHandler.sendError(res, { message: 'sessionId是必需的' }, { statusCode: 400 });
        return;
      }

      logger.info('📎 [getAttachments] 获取附件列表', {
        sessionId
      });

      // TODO: 实现获取附件列表的逻辑
      const attachments = await this.getAttachmentsFromService(sessionId);

      logger.info('📎 [getAttachments] 获取附件列表成功', {
        sessionId,
        attachmentCount: attachments.length
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        attachments,
        count: attachments.length
      }, { message: '获取附件列表成功' });

    } catch (error) {
      logger.error('❌ [getAttachments] 获取附件列表失败', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 删除附件
   */
  deleteAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, attachmentId } = req.params;

      if (!sessionId || !attachmentId) {
        ApiResponseHandler.sendError(res, { message: 'sessionId和attachmentId都是必需的' }, { statusCode: 400 });
        return;
      }

      logger.info('📎 [deleteAttachment] 删除附件', {
        sessionId,
        attachmentId
      });

      // TODO: 实现删除附件的逻辑
      const success = await this.deleteAttachmentFromService(sessionId, attachmentId);

      if (!success) {
        logger.warn('📎 [deleteAttachment] 附件不存在或删除失败', {
          sessionId,
          attachmentId
        });
        ApiResponseHandler.sendNotFound(res, '附件不存在');
        return;
      }

      logger.info('📎 [deleteAttachment] 附件删除成功', {
        sessionId,
        attachmentId
      });

      ApiResponseHandler.sendSuccess(res, {
        sessionId,
        attachmentId,
        deletedAt: new Date()
      }, { message: '附件删除成功' });

    } catch (error) {
      logger.error('❌ [deleteAttachment] 附件删除失败', {
        sessionId: req.params.sessionId,
        attachmentId: req.params.attachmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      ApiResponseHandler.sendError(res, error, { statusCode: 500 });
    }
  };

  /**
   * 处理文件上传（服务层）
   */
  private async processFileUpload(uploadData: {
    sessionId: string;
    agentId: string;
    file: any;
    fileType: string;
    description?: string;
    uploadedAt: Date;
  }): Promise<any> {
    // TODO: 实现文件上传处理逻辑
    // 这里需要调用相应的服务层方法，如文件存储、数据库记录等

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 9);
    const fileExtension = uploadData.file.originalname.split('.').pop();
    const filename = `${timestamp}_${randomString}.${fileExtension}`;

    return {
      attachmentId: this.generateAttachmentId(),
      filename,
      fileType: uploadData.fileType,
      url: `/api/attachments/${uploadData.sessionId}/${filename}`,
      description: uploadData.description,
      uploadedAt: uploadData.uploadedAt,
      expiresAt: new Date(uploadData.uploadedAt.getTime() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
    };
  }

  /**
   * 获取附件列表（服务层）
   */
  private async getAttachmentsFromService(sessionId: string): Promise<any[]> {
    // TODO: 实现获取附件列表逻辑
    // 这里需要调用相应的服务层方法
    return [];
  }

  /**
   * 删除附件（服务层）
   */
  private async deleteAttachmentFromService(sessionId: string, attachmentId: string): Promise<boolean> {
    // TODO: 实现删除附件逻辑
    // 这里需要调用相应的服务层方法
    return true;
  }

  /**
   * 生成附件ID
   */
  private generateAttachmentId(): string {
    return 'attachment_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
}