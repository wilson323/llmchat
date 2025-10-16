/**
 * 文件上传API路由
 * 提供安全的文件上传功能
 * 
 * 端点：
 * - POST /api/upload/single - 单文件上传
 * - POST /api/upload/multiple - 多文件上传
 * - DELETE /api/upload/:filename - 删除文件
 * - GET /api/upload/:filename/info - 获取文件信息
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { uploadSingle, uploadMultiple, uploadDir } from '@/middleware/fileUpload';
import { jwtAuth } from '@/middleware/jwtAuth';
import logger from '@/utils/logger';

const router = express.Router();

/**
 * 单文件上传
 * POST /api/upload/single
 * 
 * 请求：multipart/form-data，字段名：file
 * 响应：{ code, data: { filename, originalName, size, mimetype, path } }
 */
router.post('/single', jwtAuth, uploadSingle, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 'NO_FILE',
        message: 'No file uploaded',
        timestamp: new Date().toISOString(),
      });
    }

    const userId = (req as any).user?.id;

    logger.info('File uploaded successfully', {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      userId,
    });

    res.json({
      code: 'OK',
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/${req.file.filename}`,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('File upload failed', {
      error: (err as Error).message,
      userId: (req as any).user?.id,
    });
    next(err);
  }
});

/**
 * 多文件上传
 * POST /api/upload/multiple
 * 
 * 请求：multipart/form-data，字段名：files
 * 响应：{ code, data: [{ filename, originalName, size, mimetype, path }] }
 */
router.post('/multiple', jwtAuth, uploadMultiple, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        code: 'NO_FILES',
        message: 'No files uploaded',
        timestamp: new Date().toISOString(),
      });
    }

    const files = req.files as Express.Multer.File[];
    const userId = (req as any).user?.id;

    logger.info('Multiple files uploaded successfully', {
      count: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      userId,
    });

    res.json({
      code: 'OK',
      message: `${files.length} files uploaded successfully`,
      data: files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: `/uploads/${file.filename}`,
      })),
      meta: {
        count: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Multiple files upload failed', {
      error: (err as Error).message,
      userId: (req as any).user?.id,
    });
    next(err);
  }
});

/**
 * 获取文件信息
 * GET /api/upload/:filename/info
 */
router.get('/:filename/info', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // 安全检查：防止路径遍历攻击
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(uploadDir)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        timestamp: new Date().toISOString(),
      });
    }

    // 获取文件信息
    const stats = fs.statSync(filePath);
    const ext = path.extname(filename);

    res.json({
      code: 'OK',
      data: {
        filename,
        size: stats.size,
        extension: ext,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        path: `/uploads/${filename}`,
      },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get file info', {
      error: (err as Error).message,
      filename: req.params.filename,
    });
    next(err);
  }
});

/**
 * 删除文件
 * DELETE /api/upload/:filename
 */
router.delete('/:filename', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    const userId = (req as any).user?.id;

    // 安全检查：防止路径遍历攻击
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(uploadDir)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        timestamp: new Date().toISOString(),
      });
    }

    // 删除文件
    fs.unlinkSync(filePath);

    logger.info('File deleted successfully', {
      filename,
      userId,
    });

    res.json({
      code: 'OK',
      message: 'File deleted successfully',
      data: {
        filename,
        deleted: true,
        deletedBy: userId,
        deletedAt: new Date().toISOString(),
      },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to delete file', {
      error: (err as Error).message,
      filename: req.params.filename,
      userId: (req as any).user?.id,
    });
    next(err);
  }
});

/**
 * 列出所有上传的文件
 * GET /api/upload/list
 */
router.get('/list', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const fileInfos = files.map(filename => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        size: stats.size,
        extension: path.extname(filename),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    });

    // 按创建时间倒序排序
    fileInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({
      code: 'OK',
      data: fileInfos,
      meta: {
        total: fileInfos.length,
        totalSize: fileInfos.reduce((sum, f) => sum + f.size, 0),
      },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to list files', {
      error: (err as Error).message,
    });
    next(err);
  }
});

export default router;

