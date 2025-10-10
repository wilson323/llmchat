#!/usr/bin/env node

/**
 * 临时构建脚本，用于生成 shared-types 的类型声明文件
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// 确保dist目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 简单的类型声明文件
const typesContent = `// Auto-generated types
export * from './cad';
export * from './sse-events';

export type JsonArray = JsonValue[];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonArray
  | { readonly [key: string]: JsonValue };

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type UnknownValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonObject
  | JsonArray
  | Function
  | Symbol
  | bigint;

export interface DataPayload<T extends JsonValue = JsonValue> {
  data: T;
  type?: string;
  timestamp?: string;
  metadata?: JsonObject;
}

export interface ApiRequestPayload {
  [key: string]: UnknownValue;
}

export interface ApiSuccessResponse<T extends JsonValue = JsonValue> {
  code: string;
  message: string;
  data: T;
  timestamp: string;
  requestId?: string;
  metadata?: {
    version: string;
    duration?: number;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    extra?: JsonObject;
  };
}

export type ApiResponsePayload<T extends JsonValue = JsonValue> = ApiSuccessResponse<T>;

export interface ExternalServiceResponse {
  status: number;
  statusText: string;
  data: JsonValue;
  headers: Record<string, string>;
  config: {
    url: string;
    method: string;
    timeout?: number;
  };
}

export interface FastGPTEventPayload {
  id?: string;
  event?: string;
  data: JsonValue;
  timestamp?: string;
  source?: string;
  appId?: string;
  chatId?: string;
  flowId?: string;
  nodeId?: string;
}

export interface FastGPTReasoningData {
  text?: string;
  content?: string;
  message?: string;
  analysis?: string;
  reasoning?: string;
  reasoning_content?: JsonValue;
  details?: string;
  title?: string;
  order?: number;
  step?: number;
  stepIndex?: number;
  stepNumber?: number;
  index?: number;
  thoughtNumber?: number;
  totalThoughts?: number;
  totalSteps?: number;
  total_steps?: number;
  nextThoughtNeeded?: boolean;
  need_next_thought?: boolean;
  hasMore?: boolean;
  has_more?: boolean;
  finished?: boolean;
  is_final?: boolean;
  isFinal?: boolean;
  done?: boolean;
  completed?: boolean;
  output?: {
    reasoning_content?: JsonValue;
  };
  delta?: {
    reasoning_content?: JsonValue;
  };
  steps?: JsonValue;
  data?: JsonValue;
  payload?: JsonValue;
  raw?: JsonValue;
  thought?: JsonValue;
}

export interface ReasoningStepUpdate {
  content: string;
  order?: number;
  totalSteps?: number;
  title?: string;
  raw?: JsonValue;
  timestamp?: string;
}

export interface ParsedReasoningUpdate {
  steps: ReasoningStepUpdate[];
  finished?: boolean;
  totalSteps?: number;
}

export type FastGPTStreamEventType =
  | 'status'
  | 'interactive'
  | 'flowNodeStatus'
  | 'progress'
  | 'error'
  | 'complete'
  | 'start'
  | 'end'
  | 'workflowDuration'
  | 'reasoning'
  | 'step'
  | 'chunk';

export interface FastGPTEventMetadata {
  label: string;
  level: 'info' | 'success' | 'warning' | 'error';
  summary?: (payload: JsonValue) => string | undefined;
}

export interface FastGPTEvent {
  type: FastGPTStreamEventType;
  label: string;
  level: 'info' | 'success' | 'warning' | 'error';
  summary?: string;
  payload?: JsonValue;
  timestamp: string;
  raw?: JsonValue;
}

export class DynamicTypeGuard {
  static isJsonValue(value: unknown): value is JsonValue {
    const isPrimitive = (v: unknown): v is string | number | boolean | null => {
      return typeof v === 'string' ||
             typeof v === 'number' ||
             typeof v === 'boolean' ||
             v === null;
    };

    const isArray = (v: unknown): v is JsonArray => {
      return Array.isArray(v) && v.every((item) => DynamicTypeGuard.isJsonValue(item));
    };

    const isObject = (v: unknown): v is JsonObject => {
      return typeof v === 'object' &&
             v !== null &&
             !Array.isArray(v) &&
             Object.entries(v).every(
               ([_, val]) => DynamicTypeGuard.isJsonValue(val)
             );
    };

    return isPrimitive(value) || isArray(value) || isObject(value);
  }

  static isApiRequestPayload(value: unknown): value is ApiRequestPayload {
    return typeof value === 'object' &&
           value !== null &&
           !Array.isArray(value);
  }

  static isFastGPTEventPayload(value: unknown): value is FastGPTEventPayload {
    if (!this.isApiRequestPayload(value)) return false;

    const payload = value as Record<string, unknown>;
    return this.isJsonValue(payload.data);
  }

  static isReasoningData(value: unknown): value is FastGPTReasoningData {
    return this.isApiRequestPayload(value);
  }
}

export class DynamicDataConverter {
  static toJsonValue(value: unknown, defaultValue: JsonValue = null): JsonValue {
    if (DynamicTypeGuard.isJsonValue(value)) return value;

    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (value === undefined) return null;

    return defaultValue;
  }

  static toSafeJsonValue(obj: unknown): JsonValue {
    if (obj === null || obj === undefined) return null;

    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.toSafeJsonValue(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, JsonValue> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.toSafeJsonValue(value);
      }
      return result;
    }

    return String(obj);
  }
}

export class SafeAccess {
  static getProperty<T extends JsonValue>(
    obj: JsonValue | undefined,
    key: string,
    guard: (value: JsonValue) => value is T,
    defaultValue: T
  ): T {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return defaultValue;
    }

    const value = (obj as Record<string, JsonValue>)[key];
    if (value !== undefined && guard(value)) {
      return value;
    }

    return defaultValue;
  }

  static getString(obj: JsonValue | undefined, key: string, defaultValue: string = ''): string {
    return this.getProperty(obj, key, (value: JsonValue): value is string =>
      typeof value === 'string', defaultValue);
  }

  static getNumber(obj: JsonValue | undefined, key: string, defaultValue: number = 0): number {
    return this.getProperty(obj, key, (value: JsonValue): value is number =>
      typeof value === 'number' && !isNaN(value), defaultValue);
  }

  static getBoolean(obj: JsonValue | undefined, key: string, defaultValue: boolean = false): boolean {
    return this.getProperty(obj, key, (value: JsonValue): value is boolean =>
      typeof value === 'boolean', defaultValue);
  }

  static getObject(obj: JsonValue | undefined, key: string): JsonValue | undefined {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return undefined;
    }

    const value = (obj as Record<string, JsonValue>)[key];
    if (value !== undefined &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)) {
      return value;
    }

    return undefined;
  }
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface SearchFilterParams {
  search?: string;
  filters?: JsonObject;
  tags?: string[];
}

export interface QueryParams extends PaginationParams, DateRangeParams, SearchFilterParams {
  [key: string]: UnknownValue;
}
`;

// 创建CAD类型定义文件
const cadTypes = `/**
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
`;

fs.writeFileSync(path.join(distDir, 'cad.d.ts'), cadTypes);
fs.writeFileSync(path.join(distDir, 'sse-events.d.ts'), 'export {};');

// 创建主要的类型声明文件
fs.writeFileSync(path.join(distDir, 'index.d.ts'), typesContent);

// 创建package.json的main文件
fs.writeFileSync(path.join(distDir, 'index.js'), '// Placeholder for CommonJS build');

console.log('Shared types built successfully!');