/**
 * CAD 路由
 */

import { Router, type Router as RouterType } from 'express';
import multer from 'multer';
import { CadController } from '@/controllers/CadController';
import { SecureUpload } from '@/utils/secureUpload';
import { safeLogger } from '@/utils/logSanitizer';
import { authenticateJWT } from '@/middleware/jwtAuth';
import { createErrorFromUnknown } from '@/types/errors';

const router: RouterType = Router();
const cadController = new CadController();

// 安全配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for security
    files: 1, // Only allow one file at a time
  },
  fileFilter: (req, file, cb) => {
    try {
      // Basic MIME type check first
      if (!file.originalname.toLowerCase().endsWith('.dxf')) {
        return cb(new Error('只支持 DXF 文件格式'));
      }

      // Set appropriate MIME type for DXF files
      file.mimetype = 'application/dxf';

      // Perform security validation
      const uploadConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['application/dxf', 'text/plain'],
        allowedExtensions: ['.dxf'],
        requireAuthentication: false, // DXF upload doesn't require auth for now
        scanForMalware: true,
        generateHashes: true,
      };

      const validation = SecureUpload.validateFile(file, uploadConfig);

      if (!validation.isValid) {
        const errorMessage = validation.errors && validation.errors.length > 0
          ? validation.errors.join('; ')
          : '文件验证失败';
        return cb(new Error(`文件安全验证失败: ${errorMessage}`));
      }

      if (validation.warnings && validation.warnings.length > 0) {
        safeLogger.warn('[CAD Route] File upload validation warnings', {
          filename: file.originalname,
          warnings: validation.warnings,
        });
      }

      cb(null, true);
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'cadRoutes',
        operation: 'fileFilter',
      });
      safeLogger.error('[CAD Route] File validation error', error.toLogObject());
      cb(new Error('文件验证过程中发生错误'));
    }
  },
});

/**
 * @route POST /api/cad/upload
 * @desc 上传 DXF 文件
 * @access Private
 */
router.post('/upload', authenticateJWT(), upload.single('file'), cadController.uploadDxf);

/**
 * @route GET /api/cad/tools
 * @desc 获取 Function Calling 工具定义
 * @access Private
 */
router.get('/tools', authenticateJWT(), cadController.getFunctionTools);

/**
 * @route GET /api/cad/:fileId
 * @desc 获取 CAD 文件信息
 * @access Private
 */
router.get('/:fileId', authenticateJWT(), cadController.getCadFile);

/**
 * @route POST /api/cad/:fileId/execute
 * @desc 执行 CAD 操作
 * @access Private
 */
router.post('/:fileId/execute', authenticateJWT(), cadController.executeCadOperation);

/**
 * @route GET /api/cad/:fileId/export
 * @desc 导出 DXF 文件
 * @access Private
 */
router.get('/:fileId/export', authenticateJWT(), cadController.exportDxf);

export default router;
