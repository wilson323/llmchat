# CAD 自然语言修改智能体技术方案

## 1. 方案概述

构建一个基于自然语言交互的 CAD 文件修改和解读 Web 应用，用户可以通过对话方式查看、理解和修改 CAD 图纸。

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端层 (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CAD 可视化   │  │ 聊天界面     │  │ 文件管理     │  │
│  │ (Three.js)   │  │ (Chat UI)    │  │ (Upload)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓↑ HTTP/SSE
┌─────────────────────────────────────────────────────────┐
│                    后端层 (Express)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CAD Parser   │  │ AI Agent     │  │ DXF Writer   │  │
│  │ Service      │  │ Controller   │  │ Service      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓↑ API Call
┌─────────────────────────────────────────────────────────┐
│                   阿里云 DashScope API                   │
│              (Qwen-Max + Function Calling)               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心技术栈

**前端技术**:
- **React 18 + TypeScript**: UI 框架
- **Three.js / React Three Fiber**: 3D 渲染引擎
- **dxf-viewer** (npm): DXF 文件可视化（基于 Three.js）
- **Zustand**: 状态管理
- **Tailwind CSS**: 样式

**后端技术**:
- **Express + TypeScript**: Web 服务
- **dxf-parser** (npm): 解析 DXF 文件
- **dxf** (npm): 生成/修改 DXF 文件
- **@alicloud/openapi-client**: 阿里云 SDK
- **multer**: 文件上传处理

**AI 模型**:
- **通义千问 Qwen-Max**: 主对话模型（推理能力强）
- **Qwen-VL-Max**: 图像理解（可选，用于截图理解）
- **Function Calling**: 执行 CAD 操作指令

## 3. 核心功能设计

### 3.1 CAD 文件解析

使用 `dxf-parser` 库解析 DXF 格式（AutoCAD 标准交换格式）：

```typescript
// DXF 实体类型
type DxfEntity = 
  | { type: 'LINE', start: Point3D, end: Point3D }
  | { type: 'CIRCLE', center: Point3D, radius: number }
  | { type: 'ARC', center: Point3D, radius: number, startAngle: number, endAngle: number }
  | { type: 'POLYLINE', vertices: Point3D[] }
  | { type: 'TEXT', position: Point3D, text: string, height: number };
```

### 3.2 Function Calling 定义

定义标准 CAD 操作函数供 AI 调用：

```json
{
  "functions": [
    {
      "name": "add_line",
      "description": "在 CAD 图纸中添加一条直线",
      "parameters": {
        "start": { "type": "object", "description": "起点坐标 {x, y, z}" },
        "end": { "type": "object", "description": "终点坐标 {x, y, z}" },
        "layer": { "type": "string", "description": "图层名称" }
      }
    },
    {
      "name": "add_circle",
      "description": "添加圆形",
      "parameters": {
        "center": { "type": "object", "description": "圆心坐标" },
        "radius": { "type": "number", "description": "半径" }
      }
    },
    {
      "name": "move_entity",
      "description": "移动实体",
      "parameters": {
        "entityId": { "type": "string" },
        "offset": { "type": "object", "description": "偏移量 {x, y, z}" }
      }
    },
    {
      "name": "delete_entity",
      "description": "删除实体",
      "parameters": {
        "entityId": { "type": "string" }
      }
    },
    {
      "name": "query_entities",
      "description": "查询图纸中的实体信息",
      "parameters": {
        "filter": { "type": "string", "description": "筛选条件，如 'type=LINE' 或 'layer=0'" }
      }
    }
  ]
}
```

### 3.3 智能体工作流程

```
用户输入: "在图纸中心画一个半径为 50 的圆"
    ↓
AI 理解意图 (Qwen-Max)
    ↓
Function Calling: add_circle({ center: {x:0, y:0, z:0}, radius: 50 })
    ↓
后端执行 CAD 操作
    ↓
返回新的 DXF 文件
    ↓
前端实时渲染更新
```

## 4. 成熟技术方案对比

### 4.1 CAD 文件格式选择

| 格式 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **DXF** | ✅ 开源标准<br>✅ npm 库支持完善<br>✅ AutoCAD 官方交换格式 | ⚠️ 文件较大 | ⭐⭐⭐⭐⭐ |
| DWG | ⚠️ AutoCAD 原生格式 | ❌ 闭源<br>❌ JS 库缺乏 | ⭐⭐ |
| SVG | ✅ Web 标准 | ❌ 非 CAD 专业格式<br>❌ 缺少 3D 支持 | ⭐⭐⭐ |

**推荐**: 使用 **DXF** 作为主要格式

### 4.2 3D 渲染库选择

| 库 | 特点 | 推荐度 |
|---|------|--------|
| **dxf-viewer** | ✅ 专为 DXF 设计<br>✅ 基于 Three.js<br>✅ 开箱即用 | ⭐⭐⭐⭐⭐ |
| Three.js (原生) | ✅ 最灵活<br>⚠️ 需要手动解析 DXF | ⭐⭐⭐⭐ |
| Babylon.js | ✅ 功能强大 | ⚠️ 体积较大 | ⭐⭐⭐ |

**推荐**: 使用 **dxf-viewer** (开箱即用) 或 **Three.js + dxf-parser** (灵活定制)

### 4.3 阿里云 AI 模型选择

| 模型 | 能力 | 使用场景 | 推荐度 |
|------|------|----------|--------|
| **qwen-max** | 推理、Function Calling | 主对话智能体 | ⭐⭐⭐⭐⭐ |
| qwen-plus | 平衡性能和成本 | 通用对话 | ⭐⭐⭐⭐ |
| qwen-turbo | 快速响应 | 简单任务 | ⭐⭐⭐ |
| qwen-vl-max | 图像理解 | CAD 截图分析 | ⭐⭐⭐⭐ |

**推荐配置**:
- 主智能体: **qwen-max** (支持 Function Calling)
- 图像理解: **qwen-vl-max** (可选，用于上传 CAD 截图)

## 5. 依赖包清单

### 5.1 后端依赖

```json
{
  "dependencies": {
    "@alicloud/openapi-client": "^0.4.0",
    "@alicloud/openapi-util": "^0.3.0",
    "@alicloud/tea-util": "^1.4.0",
    "dxf-parser": "^1.4.1",
    "dxf": "^4.5.0",
    "dxf-writer": "^2.0.0",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11",
    "@types/uuid": "^9.0.7"
  }
}
```

### 5.2 前端依赖

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0",
    "dxf-viewer": "^1.1.0",
    "react-dropzone": "^14.2.3"
  },
  "devDependencies": {
    "@types/three": "^0.160.0"
  }
}
```

## 6. 实现步骤

### 步骤 1: 安装依赖
```bash
# 后端
cd backend
npm install @alicloud/openapi-client dxf-parser dxf multer uuid

# 前端
cd frontend
npm install three @react-three/fiber @react-three/drei dxf-viewer react-dropzone
```

### 步骤 2: 配置阿里云 DashScope

在 `backend/.env` 添加：
```env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxx
DASHSCOPE_MODEL=qwen-max
```

在 `config/agents.json` 添加智能体配置：
```json
{
  "id": "cad-agent",
  "name": "CAD 修改助手",
  "provider": "dashscope",
  "model": "qwen-max",
  "description": "通过自然语言修改和解读 CAD 图纸",
  "capabilities": ["function_calling", "cad_operations"],
  "temperature": 0.7
}
```

### 步骤 3: 实现核心服务

创建以下服务模块：
- `backend/src/services/DashScopeService.ts` - 阿里云 API 封装
- `backend/src/services/CadParserService.ts` - DXF 解析
- `backend/src/services/CadOperationService.ts` - CAD 操作执行
- `backend/src/controllers/CadAgentController.ts` - 智能体控制器

### 步骤 4: 实现前端可视化

创建前端组件：
- `frontend/src/components/cad/CadViewer.tsx` - 3D 查看器
- `frontend/src/components/cad/CadUpload.tsx` - 文件上传
- `frontend/src/components/cad/CadChat.tsx` - 对话界面

### 步骤 5: 连接智能体

实现 Function Calling 执行器，将 AI 的函数调用映射到实际 CAD 操作。

## 7. API 端点设计

```typescript
// CAD 文件管理
POST   /api/cad/upload          // 上传 DXF 文件
GET    /api/cad/:fileId         // 获取 CAD 文件内容
GET    /api/cad/:fileId/preview // 获取预览数据

// 智能体交互
POST   /api/cad/chat            // 发送自然语言指令（SSE 流式）
POST   /api/cad/execute         // 执行 CAD 操作
GET    /api/cad/:fileId/export  // 导出修改后的 DXF

// 实体操作
GET    /api/cad/:fileId/entities       // 查询实体列表
POST   /api/cad/:fileId/entities       // 添加实体
PATCH  /api/cad/:fileId/entities/:id   // 修改实体
DELETE /api/cad/:fileId/entities/:id   // 删除实体
```

## 8. 安全和性能考虑

### 8.1 文件大小限制
```typescript
// 限制上传文件大小（如 50MB）
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/dxf' || file.originalname.endsWith('.dxf')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 DXF 文件'));
    }
  }
});
```

### 8.2 缓存策略
- 解析后的 CAD 数据缓存到 Redis（可选）
- 前端使用 IndexedDB 缓存大型 DXF 文件

### 8.3 并发控制
- 使用文件锁防止并发修改
- 版本控制（操作历史记录）

## 9. 扩展功能建议

1. **版本控制**: 记录每次修改历史，支持撤销/重做
2. **协作编辑**: 多用户实时协作（WebSocket）
3. **模板库**: 预设常用 CAD 模板（如建筑平面图、机械零件）
4. **导出多格式**: 支持导出为 PDF、PNG、SVG
5. **语音输入**: 集成阿里云语音识别 API

## 10. 参考资源

- **DXF 规范**: [AutoCAD DXF Reference](http://help.autodesk.com/view/OARX/2023/CHS/)
- **dxf-parser**: [GitHub](https://github.com/gdsestimating/dxf-parser)
- **dxf-viewer**: [npm](https://www.npmjs.com/package/dxf-viewer)
- **阿里云 DashScope**: [文档](https://help.aliyun.com/zh/dashscope/)
- **Qwen Function Calling**: [示例](https://help.aliyun.com/zh/dashscope/developer-reference/function-call)
- **Three.js 文档**: [threejs.org](https://threejs.org/docs/)

## 11. 成本估算

**阿里云 DashScope 定价** (截至 2024):
- qwen-max: ¥0.12/1K tokens (输入) + ¥0.12/1K tokens (输出)
- qwen-plus: ¥0.004/1K tokens (输入) + ¥0.004/1K tokens (输出)

**典型对话成本**:
- 单次 CAD 操作对话（约 500 tokens）: ¥0.06 - ¥0.12
- 月活 1000 用户（平均 100 次操作）: ¥6000 - ¥12000
