/**
 * CAD 路由
 */

import { Router } from 'express';
import multer from 'multer';
import { CadController } from '@/controllers/CadController';

const router = Router();
const cadController = new CadController();

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/dxf' ||
      file.originalname.toLowerCase().endsWith('.dxf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('只支持 DXF 文件格式'));
    }
  },
});

/**
 * @route POST /api/cad/upload
 * @desc 上传 DXF 文件
 * @access Public
 */
router.post('/upload', upload.single('file'), cadController.uploadDxf);

/**
 * @route GET /api/cad/:fileId
 * @desc 获取 CAD 文件信息
 * @access Public
 */
router.get('/:fileId', cadController.getCadFile);

/**
 * @route POST /api/cad/:fileId/execute
 * @desc 执行 CAD 操作
 * @access Public
 */
router.post('/:fileId/execute', cadController.executeCadOperation);

/**
 * @route GET /api/cad/:fileId/export
 * @desc 导出 DXF 文件
 * @access Public
 */
router.get('/:fileId/export', cadController.exportDxf);

/**
 * @route GET /api/cad/tools
 * @desc 获取 Function Calling 工具定义
 * @access Public
 */
router.get('/tools', cadController.getFunctionTools);

export default router;
