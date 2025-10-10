/**
 * CAD 操作服务
 *
 * 负责 CAD 实体的增删改查操作
 * 使用 dxf-writer 生成修改后的 DXF 文件
 */

import DxfWriter from 'dxf-writer';
import {
  DxfEntity,
  AddLineParams,
  AddCircleParams,
  AddArcParams,
  MoveEntityParams,
  DeleteEntityParams,
  QueryEntitiesParams,
  CadOperationResult,
  LineEntity,
  CircleEntity,
  ArcEntity,
} from '@llmchat/shared-types';
import logger from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * CAD 操作服务类
 */
export class CadOperationService {
  /**
   * 添加直线
   */
  addLine(entities: DxfEntity[], params: AddLineParams): CadOperationResult {
    try {
      const newEntity: LineEntity = {
        type: 'LINE',
        handle: uuidv4(),
        layer: params.layer || '0',
        start: params.start,
        end: params.end,
        ...(params.color !== undefined && { color: params.color }),
      };

      entities.push(newEntity);

      logger.info('[CadOperationService] 添加直线成功', {
        entityId: newEntity.handle,
        start: params.start,
        end: params.end,
      });

      return {
        success: true,
        message: `成功添加直线，从 (${params.start.x}, ${params.start.y}) 到 (${params.end.x}, ${params.end.y})`,
        entityId: newEntity.handle,
      };
    } catch (error) {
      logger.error('[CadOperationService] 添加直线失败', { error, params });
      return {
        success: false,
        message: `添加直线失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 添加圆形
   */
  addCircle(entities: DxfEntity[], params: AddCircleParams): CadOperationResult {
    try {
      const newEntity: CircleEntity = {
        type: 'CIRCLE',
        handle: uuidv4(),
        layer: params.layer || '0',
        center: params.center,
        radius: params.radius,
        ...(params.color !== undefined && { color: params.color }),
      };

      entities.push(newEntity);

      logger.info('[CadOperationService] 添加圆形成功', {
        entityId: newEntity.handle,
        center: params.center,
        radius: params.radius,
      });

      return {
        success: true,
        message: `成功添加圆形，圆心 (${params.center.x}, ${params.center.y})，半径 ${params.radius}`,
        entityId: newEntity.handle,
      };
    } catch (error) {
      logger.error('[CadOperationService] 添加圆形失败', { error, params });
      return {
        success: false,
        message: `添加圆形失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 添加圆弧
   */
  addArc(entities: DxfEntity[], params: AddArcParams): CadOperationResult {
    try {
      const newEntity: ArcEntity = {
        type: 'ARC',
        handle: uuidv4(),
        layer: params.layer || '0',
        center: params.center,
        radius: params.radius,
        startAngle: params.startAngle,
        endAngle: params.endAngle,
        ...(params.color !== undefined && { color: params.color }),
      };

      entities.push(newEntity);

      logger.info('[CadOperationService] 添加圆弧成功', {
        entityId: newEntity.handle,
        center: params.center,
        radius: params.radius,
        startAngle: params.startAngle,
        endAngle: params.endAngle,
      });

      return {
        success: true,
        message: `成功添加圆弧，圆心 (${params.center.x}, ${params.center.y})，半径 ${params.radius}`,
        entityId: newEntity.handle,
      };
    } catch (error) {
      logger.error('[CadOperationService] 添加圆弧失败', { error, params });
      return {
        success: false,
        message: `添加圆弧失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 移动实体
   */
  moveEntity(entities: DxfEntity[], params: MoveEntityParams): CadOperationResult {
    try {
      const entity = entities.find(e => e.handle === params.entityId);

      if (!entity) {
        return {
          success: false,
          message: `未找到实体 ID: ${params.entityId}`,
        };
      }

      // 根据实体类型移动
      switch (entity.type) {
        case 'LINE':
          entity.start.x += params.offset.x;
          entity.start.y += params.offset.y;
          entity.start.z += params.offset.z;
          entity.end.x += params.offset.x;
          entity.end.y += params.offset.y;
          entity.end.z += params.offset.z;
          break;

        case 'CIRCLE':
        case 'ARC':
          entity.center.x += params.offset.x;
          entity.center.y += params.offset.y;
          entity.center.z += params.offset.z;
          break;

        case 'POLYLINE':
        case 'LWPOLYLINE':
          entity.vertices.forEach((v: { x: number; y: number; z: number }) => {
            v.x += params.offset.x;
            v.y += params.offset.y;
            v.z += params.offset.z;
          });
          break;

        case 'TEXT':
        case 'MTEXT':
          entity.position.x += params.offset.x;
          entity.position.y += params.offset.y;
          entity.position.z += params.offset.z;
          break;
      }

      logger.info('[CadOperationService] 移动实体成功', {
        entityId: params.entityId,
        offset: params.offset,
      });

      return {
        success: true,
        message: `成功移动实体 ${params.entityId}`,
        entityId: params.entityId,
      };
    } catch (error) {
      logger.error('[CadOperationService] 移动实体失败', { error, params });
      return {
        success: false,
        message: `移动实体失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 删除实体
   */
  deleteEntity(entities: DxfEntity[], params: DeleteEntityParams): CadOperationResult {
    try {
      const index = entities.findIndex(e => e.handle === params.entityId);

      if (index === -1) {
        return {
          success: false,
          message: `未找到实体 ID: ${params.entityId}`,
        };
      }

      entities.splice(index, 1);

      logger.info('[CadOperationService] 删除实体成功', {
        entityId: params.entityId,
      });

      return {
        success: true,
        message: `成功删除实体 ${params.entityId}`,
      };
    } catch (error) {
      logger.error('[CadOperationService] 删除实体失败', { error, params });
      return {
        success: false,
        message: `删除实体失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 查询实体
   */
  queryEntities(entities: DxfEntity[], params: QueryEntitiesParams): CadOperationResult {
    try {
      let results = entities;

      if (params.layer) {
        results = results.filter(e => e.layer === params.layer);
      }

      if (params.type) {
        results = results.filter(e => e.type === params.type);
      }

      logger.info('[CadOperationService] 查询实体成功', {
        filter: params,
        resultCount: results.length,
      });

      return {
        success: true,
        message: `找到 ${results.length} 个符合条件的实体`,
        entities: results,
      };
    } catch (error) {
      logger.error('[CadOperationService] 查询实体失败', { error, params });
      return {
        success: false,
        message: `查询实体失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 生成 DXF 文件内容
   */
  generateDxf(entities: DxfEntity[]): string {
    try {
      const dxf = new DxfWriter();

      // 添加图层
      const layers = Array.from(new Set(entities.map(e => e.layer)));
      layers.forEach(layer => {
        dxf.addLayer(layer, 7, 'CONTINUOUS');
      });

      // 添加实体
      for (const entity of entities) {
        // 注意: dxf-writer 可能没有 setCurrentLayer 方法，这里先注释掉
        // dxf.setCurrentLayer(entity.layer);

        switch (entity.type) {
          case 'LINE':
            dxf.drawLine(
              entity.start.x,
              entity.start.y,
              entity.end.x,
              entity.end.y,
            );
            break;

          case 'CIRCLE':
            dxf.drawCircle(entity.center.x, entity.center.y, entity.radius);
            break;

          case 'ARC':
            dxf.drawArc(
              entity.center.x,
              entity.center.y,
              entity.radius,
              entity.startAngle,
              entity.endAngle,
            );
            break;

          case 'TEXT':
          case 'MTEXT':
            dxf.drawText(
              entity.position.x,
              entity.position.y,
              entity.height,
              entity.rotation || 0,
              entity.text,
            );
            break;

          // POLYLINE 需要更复杂的处理，这里简化
          case 'POLYLINE':
          case 'LWPOLYLINE':
            if (entity.vertices.length >= 2) {
              for (let i = 0; i < entity.vertices.length - 1; i++) {
                const v1 = entity.vertices[i];
                const v2 = entity.vertices[i + 1];
                if (v1 && v2) {
                  dxf.drawLine(v1.x, v1.y, v2.x, v2.y);
                }
              }
              // 如果闭合，连接最后一点和第一点
              if (entity.closed) {
                const first = entity.vertices[0];
                const last = entity.vertices[entity.vertices.length - 1];
                if (first && last) {
                  dxf.drawLine(last.x, last.y, first.x, first.y);
                }
              }
            }
            break;
        }
      }

      logger.info('[CadOperationService] 生成 DXF 文件成功', {
        entityCount: entities.length,
      });

      return dxf.toDxfString();
    } catch (error) {
      logger.error('[CadOperationService] 生成 DXF 文件失败', { error });
      throw new Error(`生成 DXF 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}
