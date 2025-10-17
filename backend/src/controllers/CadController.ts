/**
 * CAD 控制器
 *
 * 处理 CAD 文件上传、解析和操作请求
 */

import type { Request, Response, NextFunction } from 'express';
import { CadParserService } from '@/services/CadParserService';
import { CadOperationService } from '@/services/CadOperationService';
import { CAD_FUNCTION_TOOLS } from '@/utils/cadFunctionTools';
import type {
  DxfEntity,
  CadFileInfo,
  AddLineParams,
  AddCircleParams,
  AddArcParams,
  MoveEntityParams,
  DeleteEntityParams,
  QueryEntitiesParams,
} from '@llmchat/shared-types';
import logger from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

// 内存存储（生产环境应使用数据库或文件系统）
const cadFiles: Map<string, { info: CadFileInfo; entities: DxfEntity[]; content: string }> = new Map();

/**
 * CAD 控制器类
 */
export class CadController {
  private readonly parserService: CadParserService;
  private readonly operationService: CadOperationService;

  constructor() {
    this.parserService = new CadParserService();
    this.operationService = new CadOperationService();
  }

  /**
   * 上传 DXF 文件
   */
  uploadDxf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          code: 'MISSING_FILE',
          message: '请上传 DXF 文件',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const dxfContent = req.file.buffer.toString('utf-8');
      const parseResult = this.parserService.parseDxf(dxfContent);

      const fileId = uuidv4();
      const fileInfo: CadFileInfo = {
        id: fileId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
        entityCount: parseResult.entities.length,
        layers: parseResult.layers,
        ...(parseResult.bounds && { bounds: parseResult.bounds }),
      };

      // 存储文件信息
      cadFiles.set(fileId, {
        info: fileInfo,
        entities: parseResult.entities,
        content: dxfContent,
      });

      const summary = this.parserService.generateSummary(parseResult.entities);

      logger.info('[CadController] DXF 文件上传成功', {
        fileId,
        fileName: fileInfo.fileName,
        entityCount: fileInfo.entityCount,
      });

      res.json({
        code: 'SUCCESS',
        message: 'DXF 文件上传成功',
        data: {
          fileInfo,
          summary,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[CadController] 上传 DXF 文件失败', { error });
      next(error);
    }
  };

  /**
   * 获取 CAD 文件信息
   */
  getCadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        res.status(400).json({
          code: 'INVALID_FILE_ID',
          message: '文件 ID 不能为空',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const cadFile = cadFiles.get(fileId);
      if (!cadFile) {
        res.status(404).json({
          code: 'FILE_NOT_FOUND',
          message: '未找到指定的 CAD 文件',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        code: 'SUCCESS',
        message: '获取 CAD 文件信息成功',
        data: {
          fileInfo: cadFile.info,
          entities: cadFile.entities,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[CadController] 获取 CAD 文件失败', { error });
      next(error);
    }
  };

  /**
   * 执行 CAD 操作
   */
  executeCadOperation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = req.params;
      const { operation, params } = req.body;

      if (!fileId) {
        res.status(400).json({
          code: 'INVALID_FILE_ID',
          message: '文件 ID 不能为空',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const cadFile = cadFiles.get(fileId);
      if (!cadFile) {
        res.status(404).json({
          code: 'FILE_NOT_FOUND',
          message: '未找到指定的 CAD 文件',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      let result;
      switch (operation) {
        case 'add_line':
          result = this.operationService.addLine(cadFile.entities, params as AddLineParams);
          break;
        case 'add_circle':
          result = this.operationService.addCircle(cadFile.entities, params as AddCircleParams);
          break;
        case 'add_arc':
          result = this.operationService.addArc(cadFile.entities, params as AddArcParams);
          break;
        case 'move_entity':
          result = this.operationService.moveEntity(cadFile.entities, params as MoveEntityParams);
          break;
        case 'delete_entity':
          result = this.operationService.deleteEntity(cadFile.entities, params as DeleteEntityParams);
          break;
        case 'query_entities':
          result = this.operationService.queryEntities(cadFile.entities, params as QueryEntitiesParams);
          break;
        default:
          res.status(400).json({
            code: 'INVALID_OPERATION',
            message: `不支持的操作: ${operation}`,
            data: null,
            timestamp: new Date().toISOString(),
          });
          return;
      }

      // 更新文件信息
      if (result.success && operation !== 'query_entities') {
        cadFile.info.entityCount = cadFile.entities.length;
        cadFile.info.layers = Array.from(new Set(cadFile.entities.map(e => e.layer)));
      }

      res.json({
        code: 'SUCCESS',
        message: '操作执行成功',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[CadController] 执行 CAD 操作失败', { error });
      next(error);
    }
  };

  /**
   * 导出 DXF 文件
   */
  exportDxf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        res.status(400).json({
          code: 'INVALID_FILE_ID',
          message: '文件 ID 不能为空',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const cadFile = cadFiles.get(fileId);
      if (!cadFile) {
        res.status(404).json({
          code: 'FILE_NOT_FOUND',
          message: '未找到指定的 CAD 文件',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const dxfContent = this.operationService.generateDxf(cadFile.entities);

      res.setHeader('Content-Type', 'application/dxf');
      res.setHeader('Content-Disposition', `attachment; filename="${cadFile.info.fileName}"`);
      res.send(dxfContent);
    } catch (error) {
      logger.error('[CadController] 导出 DXF 文件失败', { error });
      next(error);
    }
  };

  /**
   * 获取 Function Calling 工具定义
   */
  getFunctionTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.info('[CadController] 获取工具定义请求', { path: req.path, method: req.method });
      res.json({
        code: 'SUCCESS',
        message: '获取工具定义成功',
        data: {
          tools: CAD_FUNCTION_TOOLS,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[CadController] 获取工具定义失败', { error });
      next(error);
    }
  };
}
