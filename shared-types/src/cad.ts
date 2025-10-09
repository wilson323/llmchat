/**
 * CAD 相关类型定义
 */

/**
 * 3D 点坐标
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * DXF 实体类型
 */
export type DxfEntityType = 
  | 'LINE'
  | 'CIRCLE'
  | 'ARC'
  | 'POLYLINE'
  | 'LWPOLYLINE'
  | 'TEXT'
  | 'MTEXT'
  | 'POINT'
  | 'ELLIPSE'
  | 'SPLINE'
  | 'INSERT'
  | 'DIMENSION';

/**
 * 基础实体接口
 */
export interface BaseDxfEntity {
  type: DxfEntityType;
  handle: string;
  layer: string;
  color?: number;
  lineType?: string;
}

/**
 * 直线实体
 */
export interface LineEntity extends BaseDxfEntity {
  type: 'LINE';
  start: Point3D;
  end: Point3D;
}

/**
 * 圆形实体
 */
export interface CircleEntity extends BaseDxfEntity {
  type: 'CIRCLE';
  center: Point3D;
  radius: number;
}

/**
 * 圆弧实体
 */
export interface ArcEntity extends BaseDxfEntity {
  type: 'ARC';
  center: Point3D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/**
 * 多段线实体
 */
export interface PolylineEntity extends BaseDxfEntity {
  type: 'POLYLINE' | 'LWPOLYLINE';
  vertices: Point3D[];
  closed?: boolean;
}

/**
 * 文本实体
 */
export interface TextEntity extends BaseDxfEntity {
  type: 'TEXT' | 'MTEXT';
  position: Point3D;
  text: string;
  height: number;
  rotation?: number;
}

/**
 * DXF 实体联合类型
 */
export type DxfEntity = 
  | LineEntity 
  | CircleEntity 
  | ArcEntity 
  | PolylineEntity 
  | TextEntity;

/**
 * CAD 文件信息
 */
export interface CadFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  entityCount: number;
  layers: string[];
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * CAD 操作函数参数
 */
export interface AddLineParams {
  start: Point3D;
  end: Point3D;
  layer?: string;
  color?: number;
}

export interface AddCircleParams {
  center: Point3D;
  radius: number;
  layer?: string;
  color?: number;
}

export interface AddArcParams {
  center: Point3D;
  radius: number;
  startAngle: number;
  endAngle: number;
  layer?: string;
  color?: number;
}

export interface MoveEntityParams {
  entityId: string;
  offset: Point3D;
}

export interface DeleteEntityParams {
  entityId: string;
}

export interface QueryEntitiesParams {
  filter?: string;
  layer?: string;
  type?: DxfEntityType;
}

/**
 * CAD 操作结果
 */
export interface CadOperationResult {
  success: boolean;
  message: string;
  entityId?: string;
  entities?: DxfEntity[];
}

/**
 * Function Calling 工具定义
 */
export interface CadFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}
