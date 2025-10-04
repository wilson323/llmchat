# CAD 编辑智能体使用指南

## 概述

CAD 编辑智能体是一个基于阿里云通义千问 (Qwen-Max) 的自然语言 CAD 图纸修改助手。它可以：

- 📂 上传和解析 DXF 格式的 CAD 文件
- 👁️ 3D 可视化查看 CAD 图纸
- 🤖 通过自然语言对话修改图纸
- 📥 导出修改后的 DXF 文件

## 快速开始

### 1. 环境配置

在 `backend/.env` 文件中添加阿里云 DashScope API Key：

```bash
# 阿里云 DashScope API Key（必需）
DASHSCOPE_API_KEY=sk-your-api-key-here
```

**获取 API Key**:
1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 创建应用并获取 API Key
3. 确保账户有足够的余额（按 Token 计费）

### 2. 更新智能体配置

编辑 `config/agents.json`，确保 CAD 智能体已启用：

```json
{
  "id": "cad-editor-agent",
  "name": "CAD 编辑智能体",
  "provider": "dashscope",
  "model": "qwen-max",
  "apiKey": "${DASHSCOPE_API_KEY}",
  "isActive": true,
  ...
}
```

### 3. 安装依赖

```bash
# 在根目录安装所有依赖
npm install

# 或分别安装
cd backend && npm install
cd frontend && npm install
```

### 4. 启动服务

```bash
# 开发模式（同时启动前后端）
npm run dev

# 或分别启动
npm run backend:dev
npm run frontend:dev
```

## 使用流程

### 步骤 1: 选择 CAD 智能体

在前端界面的智能体选择器中选择 **"CAD 编辑智能体"**。

### 步骤 2: 上传 DXF 文件

1. 将 DXF 文件拖拽到上传区域
2. 或点击选择文件上传
3. 等待文件解析完成

支持的文件格式：
- ✅ DXF (AutoCAD Drawing Exchange Format)
- ✅ 最大文件大小：50MB

### 步骤 3: 查看图纸

上传成功后可以：
- 在 **查看器** 标签页 3D 查看图纸
- 在 **信息** 标签页查看文件详情
- 在 **图层** 标签页浏览图层列表

查看器控制：
- 🖱️ 左键拖拽：旋转视图
- 🖱️ 右键拖拽：平移视图
- 🖱️ 滚轮：缩放视图
- 🔘 工具栏按钮：放大、缩小、适应视图、切换网格

### 步骤 4: 自然语言修改

在聊天框中输入修改指令，例如：

**示例对话**：

```
用户：这个图纸里有什么内容？

AI：根据解析结果，这个图纸包含 45 个实体：
- LINE (直线): 28 个
- CIRCLE (圆形): 10 个
- ARC (圆弧): 5 个
- TEXT (文本): 2 个

图层分布：
- 0 层：30 个实体
- WALLS 层：15 个实体

---

用户：在坐标 (50, 50) 处画一个半径为 20 的圆

AI：好的，我将在坐标 (50, 50) 处添加一个半径为 20 的圆形。

[Function Call: add_circle]
{
  "center": { "x": 50, "y": 50, "z": 0 },
  "radius": 20,
  "layer": "0"
}

✅ 成功添加圆形，圆心 (50, 50)，半径 20

---

用户：从 (0, 0) 到 (100, 100) 画一条直线

AI：我将添加一条从 (0, 0) 到 (100, 100) 的直线。

[Function Call: add_line]
{
  "start": { "x": 0, "y": 0, "z": 0 },
  "end": { "x": 100, "y": 100, "z": 0 },
  "layer": "0"
}

✅ 成功添加直线，从 (0, 0) 到 (100, 100)
```

### 步骤 5: 导出修改后的文件

点击 **导出** 按钮下载修改后的 DXF 文件。

## 支持的操作

### 添加实体

**添加直线**:
```
在 (10, 20) 和 (30, 40) 之间画一条线
从原点到 (100, 100) 画一条直线
```

**添加圆形**:
```
在 (50, 50) 处画一个半径为 25 的圆
在中心位置添加一个大圆
```

**添加圆弧**:
```
在 (0, 0) 处画一个半径为 30 的 90 度圆弧
```

### 查询实体

**查询所有实体**:
```
这个图纸有哪些实体？
图纸里有多少个圆形？
```

**按类型查询**:
```
显示所有直线
列出所有圆形的信息
```

**按图层查询**:
```
WALLS 图层有哪些实体？
0 层有多少个实体？
```

### 移动实体

```
将实体 abc123 向右移动 10 个单位
把那个圆向上移动 20
```

### 删除实体

```
删除实体 abc123
移除最后添加的圆形
```

## Function Calling 工具

智能体可以调用以下工具函数：

| 函数名 | 说明 | 参数 |
|--------|------|------|
| `add_line` | 添加直线 | start, end, layer?, color? |
| `add_circle` | 添加圆形 | center, radius, layer?, color? |
| `add_arc` | 添加圆弧 | center, radius, startAngle, endAngle, layer?, color? |
| `query_entities` | 查询实体 | type?, layer? |
| `move_entity` | 移动实体 | entityId, offset |
| `delete_entity` | 删除实体 | entityId |

## API 端点

### CAD 文件管理

**上传文件**:
```http
POST /api/cad/upload
Content-Type: multipart/form-data

file: <DXF文件>
```

**获取文件信息**:
```http
GET /api/cad/:fileId
```

**执行操作**:
```http
POST /api/cad/:fileId/execute
Content-Type: application/json

{
  "operation": "add_circle",
  "params": {
    "center": { "x": 0, "y": 0, "z": 0 },
    "radius": 50
  }
}
```

**导出文件**:
```http
GET /api/cad/:fileId/export
```

### 工具定义

**获取 Function Calling 工具**:
```http
GET /api/cad/tools
```

## 技术架构

```
┌─────────────────────────────────────────┐
│          前端 (React + Three.js)         │
│  ┌────────────┐  ┌──────────────────┐  │
│  │ CadUpload  │  │   CadViewer      │  │
│  └────────────┘  └──────────────────┘  │
└─────────────────────────────────────────┘
              ↓↑ HTTP/SSE
┌─────────────────────────────────────────┐
│       后端 (Express + TypeScript)        │
│  ┌──────────────────────────────────┐  │
│  │       CadController              │  │
│  ├──────────────────────────────────┤  │
│  │  CadParserService (dxf-parser)   │  │
│  │  CadOperationService (dxf-writer)│  │
│  │  DashScopeService (阿里云 API)   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↓↑ API Call
┌─────────────────────────────────────────┐
│     阿里云 DashScope (Qwen-Max)         │
│       Function Calling 支持             │
└─────────────────────────────────────────┘
```

## 依赖库

### 后端
- `dxf-parser`: 解析 DXF 文件
- `dxf-writer`: 生成 DXF 文件
- `multer`: 文件上传处理
- `axios`: HTTP 客户端

### 前端
- `three`: 3D 渲染引擎
- `@react-three/fiber`: React Three.js 集成
- `@react-three/drei`: Three.js 辅助组件
- `react-dropzone`: 文件拖拽上传

## 常见问题

### Q: 为什么上传后看不到 3D 模型？

A: 可能原因：
1. DXF 文件格式不兼容（仅支持 ASCII 格式 DXF）
2. 实体类型不支持（目前支持 LINE、CIRCLE、ARC、POLYLINE、TEXT）
3. 浏览器 WebGL 未启用

### Q: AI 无法理解我的指令怎么办？

A: 建议：
1. 使用更明确的坐标描述（如 "在 (50, 50) 处"）
2. 分步骤进行复杂操作
3. 先查询现有实体再进行修改

### Q: 修改后如何保存？

A: 点击 **导出** 按钮下载修改后的 DXF 文件，或通过 API 调用 `/api/cad/:fileId/export`。

### Q: 支持哪些 DXF 版本？

A: 目前支持 R12 及以上版本的 ASCII 格式 DXF 文件。不支持二进制 DXF。

### Q: 如何处理大型图纸？

A: 建议：
1. 限制文件大小在 50MB 以内
2. 复杂图纸可能渲染较慢，请耐心等待
3. 考虑简化图纸或分批处理

## 费用说明

使用 CAD 编辑智能体需要阿里云 DashScope API 费用：

**Qwen-Max 定价** (截至 2025-10):
- 输入：¥0.04/1K tokens
- 输出：¥0.12/1K tokens

**典型操作费用估算**:
- 上传并分析文件：¥0.05 - ¥0.20
- 单次修改操作：¥0.02 - ¥0.10
- 复杂对话（10 轮）：¥0.50 - ¥2.00

建议为账户充值并设置费用告警。

## 下一步

- 📚 查看 [技术方案文档](./cad-agent-solution.md)
- 🔧 了解 [DXF 格式规范](http://help.autodesk.com/view/OARX/2023/CHS/)
- 🤖 探索 [通义千问 Function Calling](https://help.aliyun.com/zh/dashscope/developer-reference/function-call)

## 支持

如有问题，请：
1. 查看后端日志：`backend/log/`
2. 查看浏览器控制台错误
3. 提交 Issue 到项目仓库
