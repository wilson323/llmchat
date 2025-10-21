/**
 * CAD 文件解析服务
 *
 * 使用 dxf-parser 解析 DXF 文件
 */

import DxfParser from 'dxf-parser';
import { createErrorFromUnknown } from '@/types/errors';
import type {
  DxfEntity,
  CadFileInfo,
  Point3D,
  LineEntity,
  CircleEntity,
  ArcEntity,
  PolylineEntity,
  TextEntity,
  DxfEntityType,
} from '@llmchat/shared-types';
import logger from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * CAD 解析服务类
 */
export class CadParserService {
  private readonly parser: DxfParser;

  constructor() {
    this.parser = new DxfParser();
  }

  /**
   * 解析 DXF 文件内容
   */
  parseDxf(dxfContent: string): {
    entities: DxfEntity[];
    layers: string[];
    bounds?: CadFileInfo['bounds'];
  } {
    try {
      logger.debug('[CadParserService] 开始解析 DXF 文件');

      const dxf = this.parser.parseSync(dxfContent);

      if (!dxf?.entities) {
        throw new Error('DXF 文件解析失败：无法读取实体');
      }

      const entities: DxfEntity[] = [];
      const layersSet = new Set<string>();
      const minX = Infinity, minY = Infinity;
      const maxX = -Infinity, maxY = -Infinity;

      // 转换实体
      for (const entity of dxf.entities) {
        const converted = this.convertEntity(entity);
        if (converted) {
          entities.push(converted);
          layersSet.add(converted.layer);

          // 更新边界
          this.updateBounds(converted, { minX, minY, maxX, maxY });
        }
      }

      const bounds = {
        minX: isFinite(minX) ? minX : 0,
        minY: isFinite(minY) ? minY : 0,
        maxX: isFinite(maxX) ? maxX : 0,
        maxY: isFinite(maxY) ? maxY : 0,
      };

      logger.info('[CadParserService] DXF 解析完成', {
        entityCount: entities.length,
        layerCount: layersSet.size,
        bounds,
      });

      return {
        entities,
        layers: Array.from(layersSet),
        bounds,
      };
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'CadParserService',
        operation: 'parseDxf',
      });
      logger.error('[CadParserService] DXF 解析失败', error.toLogObject());
      throw new Error(`DXF 文件解析失败: ${error.message}`);
    }
  }

  /**
   * 转换实体为统一格式
   */
  private convertEntity(entity: any): DxfEntity | null {
    const baseEntity = {
      handle: entity.handle || uuidv4(),
      layer: entity.layer || '0',
      color: entity.color,
      lineType: entity.lineType,
    };

    switch (entity.type) {
      case 'LINE':
        return {
          ...baseEntity,
          type: 'LINE',
          start: this.toPoint3D(entity.vertices[0]),
          end: this.toPoint3D(entity.vertices[1]),
        } as LineEntity;

      case 'CIRCLE':
        return {
          ...baseEntity,
          type: 'CIRCLE',
          center: this.toPoint3D(entity.center),
          radius: entity.radius ?? 0,
        } as CircleEntity;

      case 'ARC':
        return {
          ...baseEntity,
          type: 'ARC',
          center: this.toPoint3D(entity.center),
          radius: entity.radius ?? 0,
          startAngle: entity.startAngle ?? 0,
          endAngle: entity.endAngle ?? 0,
        } as ArcEntity;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        return {
          ...baseEntity,
          type: entity.type as 'POLYLINE' | 'LWPOLYLINE',
          vertices: (entity.vertices ?? []).map((v: Record<string, unknown>) => this.toPoint3D(v)),
          closed: entity.shape || false,
        } as PolylineEntity;

      case 'TEXT':
      case 'MTEXT':
        return {
          ...baseEntity,
          type: entity.type as 'TEXT' | 'MTEXT',
          position: this.toPoint3D(entity.startPoint || entity.position),
          text: entity.text ?? 3500,
          height: (entity.textHeight || entity.height) ?? 1,
          rotation: entity.rotation ?? 0,
        } as TextEntity;

      default:
        logger.debug('[CadParserService] 跳过不支持的实体类型', { type: entity.type });
        return null;
    }
  }

  /**
   * 转换为 Point3D
   */
  private toPoint3D(point: any): Point3D {
    return {
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      z: point?.z ?? 0,
    };
  }

  /**
   * 更新边界
   */
  private updateBounds(
    entity: DxfEntity,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    const points: Point3D[] = [];

    switch (entity.type) {
      case 'LINE':
        points.push(entity.start, entity.end);
        break;
      case 'CIRCLE':
        points.push(
          { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius, z: 0 },
          { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius, z: 0 },
        );
        break;
      case 'ARC':
        points.push(
          { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius, z: 0 },
          { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius, z: 0 },
        );
        break;
      case 'POLYLINE':
      case 'LWPOLYLINE':
        points.push(...entity.vertices);
        break;
      case 'TEXT':
      case 'MTEXT':
        points.push(entity.position);
        break;
    }

    for (const point of points) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }

  /**
   * 生成 DXF 文件摘要
   */
  generateSummary(entities: DxfEntity[]): string {
    const typeCount: Record<string, number> = {};
    const layerCount: Record<string, number> = {};

    for (const entity of entities) {
      typeCount[entity.type] = (typeCount[entity.type] || 0) + 1;
      layerCount[entity.layer] = (layerCount[entity.layer] || 0) + 1;
    }

    const summary = [
      `图纸包含 ${entities.length} 个实体`,
      `实体类型分布: ${Object.entries(typeCount).map(([type, count]) => `${type}(${count})`).join(', ')}`,
      `图层分布: ${Object.entries(layerCount).map(([layer, count]) => `${layer}(${count})`).join(', ')}`,
    ];

    return summary.join('\n');
  }

  /**
   * 查询实体
   */
  queryEntities(
    entities: DxfEntity[],
    filter?: { type?: DxfEntityType; layer?: string },
  ): DxfEntity[] {
    let results = entities;

    if (filter?.type) {
      results = results.filter(e => e.type === filter.type);
    }

    if (filter?.layer) {
      results = results.filter(e => e.layer === filter.layer);
    }

    return results;
  }
}
