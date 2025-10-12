import { Router } from 'express';
import multer from 'multer';
import { ChatAttachmentController } from '@/controllers/ChatAttachmentController';
import { authenticateJWT } from '@/middleware/jwtAuth';
import { SecureUpload } from '@/utils/secureUpload';
import { safeLogger } from '@/utils/logSanitizer';

const router: Router = Router();
const chatAttachmentController = new ChatAttachmentController();

// 安全配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for security
    files: 1, // Only allow one file at a time
  },
  fileFilter: async (req, file, cb) => {
    try {
      // Basic MIME type check
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'video/mp4',
        'video/webm',
        'video/ogg'
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error(`不支持的文件类型: ${file.mimetype}`));
      }

      // Perform security validation
      const uploadConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes,
        allowedExtensions: [], // Allow all extensions for now
        requireAuthentication: true,
        scanForMalware: true,
        generateHashes: true,
      };

      const validation = await SecureUpload.validateFile(file, uploadConfig);

      if (!validation.isValid) {
        const errorMessage = validation.errors && validation.errors.length > 0
          ? validation.errors.join('; ')
          : '文件验证失败';
        return cb(new Error(`文件安全验证失败: ${errorMessage}`));
      }

      if (validation.warnings && validation.warnings.length > 0) {
        safeLogger.warn('[Chat Attachments Route] File upload validation warnings', {
          filename: file.originalname,
          warnings: validation.warnings,
        });
      }

      cb(null, true);
    } catch (error) {
      safeLogger.error('[Chat Attachments Route] File validation error', {
        filename: file.originalname,
        error: error instanceof Error ? error.message : String(error),
      });
      cb(new Error('文件验证过程中发生错误'));
    }
  },
});

// 应用认证中间件
router.use(authenticateJWT());

/**
 * @route POST /api/chat/attachments/upload
 * @desc 上传聊天附件
 * @access Private
 */
router.post('/attachments/upload',
  upload.single('file'),
  chatAttachmentController.uploadAttachment
);

/**
 * @route GET /api/chat/attachments/:sessionId
 * @desc 获取附件列表
 * @access Private
 */
router.get('/attachments/:sessionId', chatAttachmentController.getAttachments);

/**
 * @route DELETE /api/chat/attachments/:sessionId/:attachmentId
 * @desc 删除附件
 * @access Private
 */
router.delete('/attachments/:sessionId/:attachmentId', chatAttachmentController.deleteAttachment);

export default router;