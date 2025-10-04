# CAD 编辑智能体安装指南

## 快速安装

### 1. 安装依赖

项目已经更新了必要的依赖配置，直接安装即可：

```bash
# 在项目根目录执行
npm install
```

这将自动安装：

**后端依赖**:
- `dxf-parser@^1.4.1` - DXF 文件解析
- `dxf-writer@^2.0.0` - DXF 文件生成
- `multer@^1.4.5-lts.1` - 文件上传
- `@types/multer@^1.4.11` - TypeScript 类型

**前端依赖**:
- `three@^0.160.0` - 3D 渲染引擎
- `@react-three/fiber@^8.15.0` - React Three.js
- `@react-three/drei@^9.92.0` - Three.js 辅助组件
- `dxf-viewer@^1.1.0` - DXF 查看器
- `react-dropzone@^14.2.3` - 文件上传
- `@types/three@^0.160.0` - TypeScript 类型

### 2. 配置环境变量

编辑 `backend/.env` 文件，添加阿里云 DashScope API Key：

```bash
# 阿里云 DashScope API Key（必需）
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here
```

**获取 API Key 步骤**:

1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 登录您的阿里云账号
3. 在控制台中创建应用
4. 复制 API Key 并替换上面的占位符
5. 确保账户余额充足（按 Token 计费）

### 3. 验证配置

智能体配置已自动添加到 `config/agents.json`：

```json
{
  "id": "cad-editor-agent",
  "name": "CAD 编辑智能体",
  "description": "基于阿里云通义千问的 CAD 图纸自然语言修改和解读助手...",
  "provider": "dashscope",
  "model": "qwen-max",
  "apiKey": "${DASHSCOPE_API_KEY}",
  "isActive": true
}
```

确认配置正确后，环境变量会自动注入。

### 4. 启动服务

```bash
# 开发模式（推荐）
npm run dev

# 或分别启动
npm run backend:dev    # 后端：http://localhost:3001
npm run frontend:dev   # 前端：http://localhost:3000
```

### 5. 验证安装

**检查后端**:
```bash
# 查看智能体列表
curl http://localhost:3001/api/agents

# 应该能看到 cad-editor-agent
```

**检查前端**:
1. 打开浏览器访问 http://localhost:3000
2. 在智能体选择器中应该能看到 **"CAD 编辑智能体"**
3. 选择后即可使用

## 目录结构

新增的文件和目录：

```
llmchat/
├── backend/src/
│   ├── controllers/
│   │   └── CadController.ts          # CAD 控制器
│   ├── services/
│   │   ├── DashScopeService.ts       # 阿里云 API 服务
│   │   ├── CadParserService.ts       # DXF 解析服务
│   │   └── CadOperationService.ts    # CAD 操作服务
│   ├── routes/
│   │   └── cad.ts                    # CAD 路由
│   └── utils/
│       └── cadFunctionTools.ts       # Function Calling 定义
│
├── frontend/src/
│   └── components/cad/
│       ├── CadUpload.tsx             # 文件上传组件
│       ├── CadViewer.tsx             # 3D 查看器
│       └── CadPanel.tsx              # 集成面板
│
├── shared-types/src/
│   └── cad.ts                        # CAD 类型定义
│
├── docs/
│   ├── cad-agent-solution.md         # 技术方案文档
│   ├── cad-agent-guide.md            # 使用指南
│   └── CAD_INSTALLATION.md           # 本文件
│
└── config/
    └── agents.json                   # 智能体配置（已更新）
```

## 核心功能验证

### 测试 DXF 上传

```bash
# 准备一个测试 DXF 文件
curl -X POST http://localhost:3001/api/cad/upload \
  -F "file=@test.dxf" \
  -H "Content-Type: multipart/form-data"
```

预期响应：
```json
{
  "code": "SUCCESS",
  "message": "DXF 文件上传成功",
  "data": {
    "fileInfo": {
      "id": "uuid...",
      "fileName": "test.dxf",
      "entityCount": 10,
      "layers": ["0", "WALLS"]
    },
    "summary": "图纸包含 10 个实体..."
  }
}
```

### 测试 CAD 操作

```bash
# 在图纸中添加圆形
curl -X POST http://localhost:3001/api/cad/{fileId}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "add_circle",
    "params": {
      "center": { "x": 50, "y": 50, "z": 0 },
      "radius": 25
    }
  }'
```

### 测试智能体对话

在前端界面：
1. 选择 **CAD 编辑智能体**
2. 上传一个 DXF 文件
3. 输入：`这个图纸里有什么？`
4. 应该能看到 AI 分析图纸内容
5. 输入：`在 (0, 0) 处画一个半径为 50 的圆`
6. AI 应该调用 `add_circle` 函数并返回结果

## 故障排查

### 问题 1: 依赖安装失败

**错误信息**:
```
npm ERR! peer dependency error
```

**解决方案**:
```bash
# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 问题 2: DashScope API 调用失败

**错误信息**:
```
DashScope API Key 无效或已过期
```

**解决方案**:
1. 检查 `backend/.env` 中的 `DASHSCOPE_API_KEY` 是否正确
2. 登录 [DashScope 控制台](https://dashscope.console.aliyun.com/) 验证 Key
3. 确认账户余额充足
4. 重启后端服务

### 问题 3: DXF 文件解析失败

**错误信息**:
```
DXF 文件解析失败: 无法读取实体
```

**可能原因**:
- DXF 文件格式不兼容（仅支持 ASCII 格式）
- 文件损坏或不完整
- 包含不支持的实体类型

**解决方案**:
1. 使用 AutoCAD 或其他工具将 DXF 转换为 R12+ ASCII 格式
2. 检查文件完整性
3. 查看后端日志获取详细错误信息

### 问题 4: 3D 查看器无法渲染

**可能原因**:
- 浏览器不支持 WebGL
- Three.js 未正确加载

**解决方案**:
1. 使用 Chrome、Firefox 或 Edge 最新版本
2. 检查浏览器控制台错误
3. 启用浏览器硬件加速
4. 访问 https://get.webgl.org/ 测试 WebGL 支持

### 问题 5: 智能体不在列表中

**解决方案**:
```bash
# 重新加载智能体配置
curl -X POST http://localhost:3001/api/agents/reload

# 检查智能体状态
curl http://localhost:3001/api/agents/cad-editor-agent
```

## 开发调试

### 启用详细日志

编辑 `backend/.env`：
```bash
LOG_LEVEL=debug
```

日志位置：`backend/log/`

### 测试单个服务

```typescript
// 测试 DashScopeService
import { DashScopeService } from '@/services/DashScopeService';

const service = new DashScopeService({
  apiKey: process.env.DASHSCOPE_API_KEY!,
  model: 'qwen-max',
});

const response = await service.chatCompletion([
  { role: 'user', content: 'Hello' },
]);
console.log(response);
```

### 前端开发模式

```bash
# 启用 React DevTools
npm run frontend:dev

# 类型检查
npm run frontend:type-check

# Lint 检查
npm run frontend:lint
```

## 生产部署

### 1. 构建

```bash
npm run build
```

### 2. 环境变量

确保生产环境配置：
```bash
NODE_ENV=production
DASHSCOPE_API_KEY=sk-production-key
PORT=3001
FRONTEND_URL=https://your-domain.com
```

### 3. 启动

```bash
npm start
```

### 4. 反向代理（Nginx）

```nginx
# Nginx 配置示例
server {
  listen 80;
  server_name your-domain.com;

  # 前端静态文件
  location / {
    root /path/to/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # 后端 API
  location /api {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  # CAD 文件上传（增加大小限制）
  location /api/cad/upload {
    proxy_pass http://localhost:3001;
    client_max_body_size 50M;
  }
}
```

## 性能优化

### 后端优化

1. **使用 Redis 缓存 CAD 文件**:
```typescript
// 将解析后的实体缓存到 Redis
await redis.set(`cad:${fileId}`, JSON.stringify(entities), 'EX', 3600);
```

2. **启用压缩**（已配置）:
```typescript
app.use(compression());
```

3. **设置请求限流**（已配置）:
```typescript
app.use('/api/cad/upload', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
}));
```

### 前端优化

1. **懒加载 Three.js**:
```typescript
const CadViewer = lazy(() => import('@/components/cad/CadViewer'));
```

2. **虚拟化大型实体列表**:
使用 `react-window` 或 `react-virtualized`

3. **WebWorker 处理 DXF 解析**:
将解析逻辑移到 WebWorker

## 下一步

- 📖 阅读 [使用指南](./cad-agent-guide.md)
- 🔧 查看 [技术方案](./cad-agent-solution.md)
- 🚀 开始使用 CAD 编辑智能体

## 支持

遇到问题？

1. 查看日志：`backend/log/combined.log`
2. 检查浏览器控制台
3. 参考 [常见问题](./cad-agent-guide.md#常见问题)
4. 提交 Issue 到项目仓库

---

**版本**: 1.0.0  
**最后更新**: 2025-10-04  
**维护者**: LLMChat Team
