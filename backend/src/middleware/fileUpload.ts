/**
 * 文件上传中间件
 * 使用Multer实现安全的文件上传功能
 * 
 * 功能：
 * - 文件类型白名单验证
 * - 文件大小限制
 * - 随机文件名生成
 * - 安全的文件存储
 */

import multer from 'multer';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import logger from '@/utils/logger';

/**
 * 确保上传目录存在
 */
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info('Upload directory created', { path: uploadDir });
}

/**
 * 允许的文件类型（MIME类型白名单）
 */
const ALLOWED_MIME_TYPES = [
  // 图片
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // 文档
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/csv',
  // CAD文件
  'application/dxf',
  'application/acad',
];

/**
 * 允许的文件扩展名（白名单）
 */
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv',
  '.dxf', '.dwg',
];

/**
 * 文件大小限制（字节）
 */
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 图片：10MB
  document: 20 * 1024 * 1024,    // 文档：20MB
  cad: 50 * 1024 * 1024,         // CAD文件：50MB
  default: 10 * 1024 * 1024,     // 默认：10MB
};

/**
 * 生成安全的文件名
 * 格式：timestamp-randomhash.ext
 */
function generateSafeFilename(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomHash}${ext}`;
}

/**
 * 获取文件大小限制
 */
function getFileSizeLimit(mimetype: string, ext: string): number {
  if (mimetype.startsWith('image/')) {
    return FILE_SIZE_LIMITS.image;
  }
  if (ext === '.dxf' || ext === '.dwg') {
    return FILE_SIZE_LIMITS.cad;
  }
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('sheet')) {
    return FILE_SIZE_LIMITS.document;
  }
  return FILE_SIZE_LIMITS.default;
}

/**
 * Multer存储配置
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeFilename = generateSafeFilename(file.originalname);
    cb(null, safeFilename);
  },
});

/**
 * 文件过滤器（安全验证）
 */
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();

  // 检查文件扩展名
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error(`File type not allowed: ${ext}`) as any;
    error.code = 'INVALID_FILE_TYPE';
    logger.warn('File upload rejected - invalid extension', {
      filename: file.originalname,
      extension: ext,
      mimetype: file.mimetype,
    });
    return cb(error);
  }

  // 检查MIME类型
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(`MIME type not allowed: ${file.mimetype}`) as any;
    error.code = 'INVALID_MIME_TYPE';
    logger.warn('File upload rejected - invalid MIME type', {
      filename: file.originalname,
      extension: ext,
      mimetype: file.mimetype,
    });
    return cb(error);
  }

  // 通过验证
  cb(null, true);
};

/**
 * Multer基础配置
 */
const uploadConfig: multer.Options = {
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_SIZE_LIMITS.cad,  // 使用最大限制（动态检查）
    files: 10,                        // 最多10个文件
    fields: 20,                       // 最多20个字段
    fieldSize: 1024 * 1024,          // 字段大小1MB
  },
};

/**
 * 导出Multer实例
 */
export const upload = multer(uploadConfig);

/**
 * 单文件上传中间件
 * 使用方式: router.post('/upload', uploadSingle, handler)
 */
export const uploadSingle: express.RequestHandler = upload.single('file');

/**
 * 多文件上传中间件（同一字段）
 * 使用方式: router.post('/upload', uploadMultiple, handler)
 */
export const uploadMultiple: express.RequestHandler = upload.array('files', 10);

/**
 * 多字段文件上传中间件
 * 使用方式: router.post('/upload', uploadFields, handler)
 */
export const uploadFields: express.RequestHandler = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'images', maxCount: 5 },
  { name: 'documents', maxCount: 5 },
]);

/**
 * 任意文件上传中间件
 * 使用方式: router.post('/upload', uploadAny, handler)
 */
export const uploadAny: express.RequestHandler = upload.any();

/**
 * CAD文件专用上传中间件
 */
const cadUploader = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.dxf' || ext === '.dwg') {
      cb(null, true);
    } else {
      const error = new Error('Only CAD files (.dxf, .dwg) are allowed') as any;
      error.code = 'INVALID_CAD_FILE';
      cb(error);
    }
  },
  limits: {
    fileSize: FILE_SIZE_LIMITS.cad,
    files: 1,
  },
}).single('cadFile');

export const uploadCad: express.RequestHandler = cadUploader;

/**
 * 导出常量
 */
export {
  uploadDir,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  FILE_SIZE_LIMITS,
};

