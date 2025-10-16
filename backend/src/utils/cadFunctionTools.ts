/**
 * CAD Function Calling 工具定义
 *
 * 为阿里云通义千问提供的工具函数定义
 */

import type { CadFunctionTool } from '@llmchat/shared-types';

/**
 * CAD 操作工具集
 */
export const CAD_FUNCTION_TOOLS: CadFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_line',
      description: '在 CAD 图纸中添加一条直线',
      parameters: {
        type: 'object',
        properties: {
          start: {
            type: 'object',
            description: '起点坐标',
            properties: {
              x: { type: 'number', description: 'X 坐标' },
              y: { type: 'number', description: 'Y 坐标' },
              z: { type: 'number', description: 'Z 坐标，默认 0' },
            },
            required: ['x', 'y'],
          },
          end: {
            type: 'object',
            description: '终点坐标',
            properties: {
              x: { type: 'number', description: 'X 坐标' },
              y: { type: 'number', description: 'Y 坐标' },
              z: { type: 'number', description: 'Z 坐标，默认 0' },
            },
            required: ['x', 'y'],
          },
          layer: {
            type: 'string',
            description: '图层名称，默认为 "0"',
          },
          color: {
            type: 'integer',
            description: 'AutoCAD 颜色索引（1-255）',
          },
        },
        required: ['start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_circle',
      description: '在 CAD 图纸中添加一个圆形',
      parameters: {
        type: 'object',
        properties: {
          center: {
            type: 'object',
            description: '圆心坐标',
            properties: {
              x: { type: 'number', description: 'X 坐标' },
              y: { type: 'number', description: 'Y 坐标' },
              z: { type: 'number', description: 'Z 坐标，默认 0' },
            },
            required: ['x', 'y'],
          },
          radius: {
            type: 'number',
            description: '圆的半径',
          },
          layer: {
            type: 'string',
            description: '图层名称，默认为 "0"',
          },
          color: {
            type: 'integer',
            description: 'AutoCAD 颜色索引（1-255）',
          },
        },
        required: ['center', 'radius'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_arc',
      description: '在 CAD 图纸中添加一个圆弧',
      parameters: {
        type: 'object',
        properties: {
          center: {
            type: 'object',
            description: '圆心坐标',
            properties: {
              x: { type: 'number', description: 'X 坐标' },
              y: { type: 'number', description: 'Y 坐标' },
              z: { type: 'number', description: 'Z 坐标，默认 0' },
            },
            required: ['x', 'y'],
          },
          radius: {
            type: 'number',
            description: '圆弧半径',
          },
          startAngle: {
            type: 'number',
            description: '起始角度（度数，0-360）',
          },
          endAngle: {
            type: 'number',
            description: '结束角度（度数，0-360）',
          },
          layer: {
            type: 'string',
            description: '图层名称，默认为 "0"',
          },
          color: {
            type: 'integer',
            description: 'AutoCAD 颜色索引（1-255）',
          },
        },
        required: ['center', 'radius', 'startAngle', 'endAngle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_entities',
      description: '查询 CAD 图纸中的实体信息',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '实体类型筛选，如 "LINE"、"CIRCLE"、"ARC" 等',
            enum: ['LINE', 'CIRCLE', 'ARC', 'POLYLINE', 'LWPOLYLINE', 'TEXT', 'MTEXT'],
          },
          layer: {
            type: 'string',
            description: '图层名称筛选',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_entity',
      description: '移动 CAD 图纸中的实体',
      parameters: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: '实体的唯一标识符（handle）',
          },
          offset: {
            type: 'object',
            description: '移动的偏移量',
            properties: {
              x: { type: 'number', description: 'X 方向偏移' },
              y: { type: 'number', description: 'Y 方向偏移' },
              z: { type: 'number', description: 'Z 方向偏移，默认 0' },
            },
            required: ['x', 'y'],
          },
        },
        required: ['entityId', 'offset'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_entity',
      description: '删除 CAD 图纸中的实体',
      parameters: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: '实体的唯一标识符（handle）',
          },
        },
        required: ['entityId'],
      },
    },
  },
];
