# 工作计划B：业务功能开发与测试

**负责范围**: 业务功能、API开发、测试套件
**预估总时间**: 24.5小时
**优先级**: P0 + P1 + P2
**可并行执行**: ✅ 与工作计划A无冲突

---

## 📋 任务总览

| 阶段 | 任务数 | 预估时间 | 优先级 |
|------|--------|----------|--------|
| 阶段1 | 2个 | 32分钟 | P0 |
| 阶段2 | 4个 | 10小时 | P1 |
| 阶段3 | 8个 | 14小时 | P2 |

---

## 🔴 阶段1：P0安全和错误处理（32分钟）

### 任务B1.1: 启用CSRF保护 ⏱️ 2分钟

**目标**: 恢复CSRF中间件，确保安全

**文件**: `backend/src/index.ts`

**当前代码**（第202-208行）:
```typescript
// CSRF 保护（排除 GET/健康检查/登录）
// app.use(
//   csrfProtection({
//     ignoreMethods: ["GET", "HEAD", "OPTIONS"],
//     ignorePaths: ["/health", "/api/auth/login", "/api/csrf-token"],
//   })
// );
```

**修复代码**:
```typescript
// CSRF 保护（排除 GET/健康检查/登录）
app.use(
  csrfProtection({
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
    ignorePaths: ["/health", "/api/auth/login", "/api/csrf-token"],
  })
);
```

**验证步骤**:
```bash
# 1. 取消注释
# 2. 重启服务
pnpm run backend:build
cd backend && pnpm run dev

# 3. 测试CSRF保护
# 获取token
curl http://localhost:3001/api/csrf-token

# POST不带token（应该失败）
curl -X POST http://localhost:3001/api/test

# POST带token（应该成功）
curl -X POST http://localhost:3001/api/test \
  -H "X-CSRF-Token: <token>"
```

**预期效果**:
- ✅ CSRF保护正常工作
- ✅ 安全风险消除
- ✅ 响应时间无影响

---

### 任务B1.2: 统一API错误响应格式 ⏱️ 30分钟

**目标**: 所有API返回统一的错误格式

**文件**: `backend/src/middleware/errorHandler.ts`

**定义错误接口**:
```typescript
/**
 * 统一API错误响应格式
 */
export interface ApiErrorResponse {
  success: false;
  code: string;        // 错误代码（如'AUTH_FAILED', 'VALIDATION_ERROR'）
  message: string;     // 用户友好消息
  details?: unknown;   // 详细错误信息（仅开发环境）
  requestId?: string;  // 请求追踪ID
  timestamp: string;   // 错误时间
  path?: string;       // 请求路径
  method?: string;     // 请求方法
}

/**
 * 统一API成功响应格式
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  requestId?: string;
  timestamp: string;
}

/**
 * 自定义错误类
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

**更新errorHandler**:
```typescript
import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { ApiErrorResponse, ApiError } from '@/types/api';

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 获取请求ID
  const requestId = (req as any).requestId || 'unknown';
  
  // 确定状态码和错误代码
  const statusCode = (err as ApiError).statusCode || 500;
  const code = (err as ApiError).code || 'INTERNAL_ERROR';
  
  // 构建统一错误响应
  const response: ApiErrorResponse = {
    success: false,
    code,
    message: err.message || 'Internal server error',
    requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };
  
  // 开发环境添加详细信息
  if (process.env.NODE_ENV !== 'production') {
    response.details = {
      stack: err.stack,
      ...(err as ApiError).details,
    };
  }
  
  // 记录错误（异步，不阻塞响应）
  setImmediate(() => {
    logger.error('API Error', {
      requestId,
      code,
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      statusCode,
    });
  });
  
  // 返回错误响应
  res.status(statusCode).json(response);
}

/**
 * 404处理中间件
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    success: false,
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
    requestId: (req as any).requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };
  
  res.status(404).json(response);
}
```

**更新index.ts**:
```typescript
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';

// 替换原404处理
app.use(notFoundHandler);

// 替换原全局错误处理
app.use(errorHandler);
```

**验证步骤**:
```bash
# 1. 测试404
curl http://localhost:3001/api/nonexistent
# 预期: {"success":false,"code":"NOT_FOUND",...}

# 2. 测试错误
curl http://localhost:3001/api/agents/invalid-id
# 预期: {"success":false,"code":"...",message:"..."}

# 3. 所有错误格式一致
```

**预期效果**:
- ✅ 所有API错误格式统一
- ✅ 前端可统一处理错误
- ✅ 错误追踪更容易（requestId）

---

## 🟡 阶段2：核心功能开发（10小时）

### 任务B2.1: 数据库连接池优化 ⏱️ 1.5小时

**文件**: `backend/src/utils/db.ts`

**优化配置**:
```typescript
import { Pool, PoolConfig } from 'pg';
import logger from './logger';

/**
 * 数据库连接池配置（动态优化）
 */
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  
  // ✅ 动态连接池配置
  min: parseInt(process.env.DB_POOL_MIN || '10'),
  max: parseInt(process.env.DB_POOL_MAX || '50'),
  
  // ✅ 超时配置
  idleTimeoutMillis: 30000,           // 30秒空闲超时
  connectionTimeoutMillis: 5000,      // 5秒连接超时
  
  // ✅ 查询超时
  statement_timeout: 30000,           // 30秒查询超时
  query_timeout: 30000,
  
  // ✅ 应用标识
  application_name: 'llmchat-backend',
  
  // ✅ SSL配置（生产环境）
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
  } : false,
};

// 创建连接池
export const pool = new Pool(poolConfig);

// ✅ 连接池事件监听
pool.on('connect', (client) => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
  logger.info('DB Pool: New connection', stats);
});

pool.on('acquire', (client) => {
  // 仅在debug模式记录
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('DB Pool: Connection acquired');
  }
});

pool.on('remove', (client) => {
  logger.info('DB Pool: Connection removed', {
    total: pool.totalCount,
    idle: pool.idleCount,
  });
});

pool.on('error', (err, client) => {
  logger.error('DB Pool: Unexpected error', {
    error: err.message,
    stack: err.stack,
  });
});

// ✅ 定期报告连接池状态
setInterval(() => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
  
  // 只在有连接时记录
  if (stats.total > 0) {
    logger.info('DB Pool Status', stats);
  }
}, 60000); // 每分钟一次
```

**环境变量**:
```env
# backend/.env
DB_POOL_MIN=10
DB_POOL_MAX=50
```

---

### 任务B2.2: 会话持久化存储 ⏱️ 3小时

**目标**: 将聊天会话从内存存储迁移到PostgreSQL

**Step 1: 创建数据库Schema（30分钟）**

**新文件**: `backend/src/migrations/002_chat_sessions_enhanced.sql`

```sql
-- 增强版聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '新对话',
  
  -- 会话数据（JSONB格式）
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- 统计信息
  message_count INT DEFAULT 0,
  token_usage INT DEFAULT 0,
  avg_response_time FLOAT DEFAULT 0,
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP,
  
  -- 搜索支持
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(messages::text, ''))
  ) STORED
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions_enhanced(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON chat_sessions_enhanced(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON chat_sessions_enhanced(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON chat_sessions_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_sessions_search USING GIN (search_vector);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_sessions_timestamp
BEFORE UPDATE ON chat_sessions_enhanced
FOR EACH ROW
EXECUTE FUNCTION update_chat_sessions_updated_at();
```

**Step 2: 实现ChatSessionService（1.5小时）**

**新文件**: `backend/src/services/ChatSessionService.ts`

```typescript
import { pool } from '@/utils/db';
import { ApiError } from '@/middleware/errorHandler';
import logger from '@/utils/logger';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  context?: Record<string, any>;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

export class ChatSessionService {
  /**
   * 创建新会话
   */
  async createSession(
    userId: string,
    agentId: string,
    title?: string
  ): Promise<ChatSession> {
    try {
      const result = await pool.query(
        `INSERT INTO chat_sessions_enhanced 
         (user_id, agent_id, title) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [userId, agentId, title || '新对话']
      );
      
      return this.mapRowToSession(result.rows[0]);
    } catch (err) {
      logger.error('Failed to create chat session', { error: (err as Error).message });
      throw new ApiError(500, 'SESSION_CREATE_FAILED', 'Failed to create chat session');
    }
  }

  /**
   * 获取用户的所有会话
   */
  async getUserSessions(
    userId: string,
    agentId?: string
  ): Promise<ChatSession[]> {
    try {
      const query = agentId
        ? `SELECT * FROM chat_sessions_enhanced 
           WHERE user_id = $1 AND agent_id = $2 AND status = 'active'
           ORDER BY updated_at DESC`
        : `SELECT * FROM chat_sessions_enhanced 
           WHERE user_id = $1 AND status = 'active'
           ORDER BY updated_at DESC`;
      
      const params = agentId ? [userId, agentId] : [userId];
      const result = await pool.query(query, params);
      
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (err) {
      logger.error('Failed to get user sessions', { error: (err as Error).message });
      throw new ApiError(500, 'SESSION_FETCH_FAILED', 'Failed to fetch sessions');
    }
  }

  /**
   * 添加消息到会话
   */
  async addMessage(
    sessionId: string,
    message: ChatMessage
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE chat_sessions_enhanced 
         SET messages = messages || $1::jsonb,
             message_count = message_count + 1,
             last_message_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(message), sessionId]
      );
    } catch (err) {
      logger.error('Failed to add message', { error: (err as Error).message });
      throw new ApiError(500, 'MESSAGE_ADD_FAILED', 'Failed to add message');
    }
  }

  /**
   * 更新会话标题
   */
  async updateSessionTitle(
    sessionId: string,
    title: string
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE chat_sessions_enhanced SET title = $1 WHERE id = $2`,
        [title, sessionId]
      );
    } catch (err) {
      logger.error('Failed to update session title', { error: (err as Error).message });
      throw new ApiError(500, 'SESSION_UPDATE_FAILED', 'Failed to update session');
    }
  }

  /**
   * 删除会话（软删除）
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE chat_sessions_enhanced 
         SET status = 'deleted' 
         WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      );
    } catch (err) {
      logger.error('Failed to delete session', { error: (err as Error).message });
      throw new ApiError(500, 'SESSION_DELETE_FAILED', 'Failed to delete session');
    }
  }

  /**
   * 归档会话
   */
  async archiveSession(sessionId: string, userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE chat_sessions_enhanced 
         SET status = 'archived' 
         WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      );
    } catch (err) {
      logger.error('Failed to archive session', { error: (err as Error).message });
      throw new ApiError(500, 'SESSION_ARCHIVE_FAILED', 'Failed to archive session');
    }
  }

  /**
   * 搜索会话
   */
  async searchSessions(
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<ChatSession[]> {
    try {
      const result = await pool.query(
        `SELECT *, 
         ts_rank(search_vector, plainto_tsquery('english', $2)) as rank
         FROM chat_sessions_enhanced
         WHERE user_id = $1
           AND status = 'active'
           AND search_vector @@ plainto_tsquery('english', $2)
         ORDER BY rank DESC, updated_at DESC
         LIMIT $3`,
        [userId, query, limit]
      );
      
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (err) {
      logger.error('Failed to search sessions', { error: (err as Error).message });
      throw new ApiError(500, 'SESSION_SEARCH_FAILED', 'Failed to search sessions');
    }
  }

  /**
   * 映射数据库行到ChatSession对象
   */
  private mapRowToSession(row: any): ChatSession {
    return {
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      title: row.title,
      messages: row.messages || [],
      context: row.context,
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
    };
  }
}

// 导出单例
export const chatSessionService = new ChatSessionService();
export default chatSessionService;
```

**Step 3: 创建API路由（1小时）**

**新文件**: `backend/src/routes/chatSessions.ts`

```typescript
import express from 'express';
import { chatSessionService } from '@/services/ChatSessionService';
import { jwtAuth } from '@/middleware/jwtAuth';

const router = express.Router();

/**
 * 获取用户的所有会话
 * GET /api/chat-sessions?agentId=xxx
 */
router.get('/', jwtAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const agentId = req.query.agentId as string | undefined;
    
    const sessions = await chatSessionService.getUserSessions(userId, agentId);
    
    res.json({
      success: true,
      data: sessions,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 创建新会话
 * POST /api/chat-sessions
 */
router.post('/', jwtAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { agentId, title } = req.body;
    
    const session = await chatSessionService.createSession(userId, agentId, title);
    
    res.status(201).json({
      success: true,
      data: session,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 更新会话标题
 * PATCH /api/chat-sessions/:id/title
 */
router.patch('/:id/title', jwtAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { title } = req.body;
    
    await chatSessionService.updateSessionTitle(sessionId, title);
    
    res.json({
      success: true,
      data: { sessionId, title },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 删除会话
 * DELETE /api/chat-sessions/:id
 */
router.delete('/:id', jwtAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;
    
    await chatSessionService.deleteSession(sessionId, userId);
    
    res.json({
      success: true,
      data: { sessionId, deleted: true },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 搜索会话
 * GET /api/chat-sessions/search?q=keyword
 */
router.get('/search', jwtAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!query) {
      throw new ApiError(400, 'INVALID_QUERY', 'Search query is required');
    }
    
    const sessions = await chatSessionService.searchSessions(userId, query, limit);
    
    res.json({
      success: true,
      data: sessions,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

**集成到index.ts**:
```typescript
import chatSessionsRouter from '@/routes/chatSessions';

app.use('/api/chat-sessions', chatSessionsRouter);
```

---

### 任务B2.3: 文件上传服务 ⏱️ 2小时

**新文件**: `backend/src/middleware/fileUpload.ts`

```typescript
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ApiError } from './errorHandler';

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Multer存储配置
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

/**
 * 文件过滤器（白名单）
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 允许的文件类型
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.docx', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'INVALID_FILE_TYPE', `File type not allowed: ${ext}`));
  }
};

/**
 * Multer配置
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB
    files: 5,                      // 最多5个文件
  },
});

/**
 * 单文件上传中间件
 */
export const uploadSingle = upload.single('file');

/**
 * 多文件上传中间件
 */
export const uploadMultiple = upload.array('files', 5);
```

**新文件**: `backend/src/routes/upload.ts`

```typescript
import express from 'express';
import { uploadSingle, uploadMultiple } from '@/middleware/fileUpload';
import { jwtAuth } from '@/middleware/jwtAuth';
import logger from '@/utils/logger';

const router = express.Router();

/**
 * 单文件上传
 * POST /api/upload/single
 */
router.post('/single', jwtAuth, uploadSingle, async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'NO_FILE', 'No file uploaded');
    }
    
    logger.info('File uploaded', {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      userId: req.user!.id,
    });
    
    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/${req.file.filename}`,
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 多文件上传
 * POST /api/upload/multiple
 */
router.post('/multiple', jwtAuth, uploadMultiple, async (req, res, next) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      throw new ApiError(400, 'NO_FILES', 'No files uploaded');
    }
    
    const files = req.files as Express.Multer.File[];
    
    logger.info('Multiple files uploaded', {
      count: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      userId: req.user!.id,
    });
    
    res.json({
      success: true,
      data: files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: `/uploads/${file.filename}`,
      })),
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

**集成**:
```typescript
// backend/src/index.ts
import uploadRouter from '@/routes/upload';

app.use('/api/upload', uploadRouter);
```

---

### 任务B2.4: 消息搜索功能 ⏱️ 1.5小时

**目标**: 使用PostgreSQL全文检索实现消息搜索

**已在ChatSessionService中实现**（见B2.2）

**API端点**:
- `GET /api/chat-sessions/search?q=keyword&limit=20`

**使用示例**:
```bash
# 搜索包含"认证"的会话
curl "http://localhost:3001/api/chat-sessions/search?q=认证" \
  -H "Authorization: Bearer <token>"

# 响应:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "用户认证系统",
      "messages": [...],
      "rank": 0.95
    }
  ]
}
```

**验证步骤**:
```bash
# 1. 创建几个包含关键词的会话
# 2. 搜索关键词
# 3. 验证结果相关性
# 4. 测试中文搜索
```

---

### 任务B2.5: CAD文件处理优化 ⏱️ 2小时

**目标**: 优化CAD文件上传和处理逻辑

**文件**: `backend/src/routes/cad.ts`

**优化要点**:
1. 使用Multer替代自定义上传
2. 添加文件验证（.dxf格式）
3. 异步处理CAD文件
4. 添加进度反馈

**修改示例**:
```typescript
import { upload } from '@/middleware/fileUpload';

// CAD文件上传（仅允许.dxf）
const cadUpload = multer({
  ...upload,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.dxf') {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'INVALID_CAD_FILE', 'Only .dxf files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024,  // CAD文件50MB限制
  },
});

router.post('/upload', jwtAuth, cadUpload.single('cadFile'), async (req, res, next) => {
  // ... 处理逻辑
});
```

---

## 🟢 阶段3：完整测试套件（14小时）

### 任务B3.1: 认证系统测试 ⏱️ 2小时

**新文件**: `backend/src/__tests__/auth.test.ts`

**测试用例**:
```typescript
import request from 'supertest';
import app from '../index';

describe('认证系统测试', () => {
  describe('POST /api/auth/login', () => {
    it('应该成功登录并返回token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });
    
    it('应该拒绝错误密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_FAILED');
    });
  });
  
  describe('Token验证', () => {
    let token: string;
    
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      token = res.body.data.token;
    });
    
    it('应该接受有效token', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    it('应该拒绝无效token', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });
});
```

---

### 任务B3.2-B3.8: 其他测试（12小时）

**测试清单**:
- **B3.2**: 智能体管理测试（2小时）
- **B3.3**: 聊天服务测试（3小时）
- **B3.4**: 管理后台测试（2小时）
- **B3.5**: E2E用户旅程（4小时）
- **B3.6**: E2E管理员旅程（2小时）
- **B3.7**: 数据一致性测试（2小时）
- **B3.8**: 故障恢复测试（1小时）

**测试框架**:
- 单元测试: Jest + Supertest
- E2E测试: Playwright
- 性能测试: Artillery

---

## 📊 进度追踪

### 完成度计算

```
总任务: 10个
阶段1（P0）: 2个 × 32分钟 = 32分钟
阶段2（P1）: 4个 × 10小时 = 10小时
阶段3（P2）: 8个 × 14小时 = 14小时

总时间: 24.5小时
```

### 里程碑

| 里程碑 | 完成标准 | 预计时间 |
|--------|---------|----------|
| M1: P0修复完成 | CSRF启用+错误统一 | Day 1 09:30 |
| M2: 会话持久化 | 数据库存储正常 | Day 2 18:00 |
| M3: 文件上传 | 上传功能正常 | Day 3 12:00 |
| M4: 测试覆盖 | 覆盖率>80% | Day 7 18:00 |

---

## ✅ 质量检查清单

### 代码质量
- [ ] 所有新代码TypeScript类型完整
- [ ] ESLint检查无错误
- [ ] 代码复用性良好
- [ ] 错误处理完善

### 功能完整性
- [ ] CSRF保护正常
- [ ] 错误格式统一
- [ ] 数据库连接池稳定
- [ ] 会话CRUD全部实现
- [ ] 文件上传安全可靠
- [ ] 搜索功能准确

### 测试覆盖
- [ ] 单元测试覆盖率>80%
- [ ] 集成测试完整
- [ ] E2E测试覆盖主流程
- [ ] 性能测试建立基准

### 文档更新
- [ ] API文档更新
- [ ] 使用说明完整
- [ ] 测试报告生成

---

## 🚀 执行时间线

### Day 1（今天）
- [x] 服务恢复 ✅
- [ ] 启用CSRF保护（2分钟）
- [ ] 统一错误格式（30分钟）
- **今日目标**: P0修复完成

### Day 2-3（本周前期）
- [ ] 数据库连接池优化（1.5小时）
- [ ] 会话持久化存储（3小时）
- [ ] 消息搜索功能（1.5小时）
- **目标**: 核心功能完成

### Day 4-5（本周后期）
- [ ] 文件上传服务（2小时）
- [ ] CAD处理优化（2小时）
- **目标**: 所有P1功能完成

### Day 6-10（下周）
- [ ] 完整测试套件（14小时）
- [ ] 文档更新（2小时）
- **目标**: 测试覆盖率>80%

---

## 🔄 与计划A的协作

### 无冲突保证
- **计划A**: 专注日志和监控文件
- **计划B**: 专注业务功能文件
- **共同文件**: `backend/src/index.ts`（需要协调修改）

### 协调机制
1. **index.ts修改**: 由计划A负责中间件注册，计划B负责路由注册
2. **定期同步**: 每天同步一次代码
3. **Git策略**: 使用分支开发，main分支保持稳定

---

**计划创建时间**: 2025-10-16 17:30  
**负责人**: 开发团队B（功能和测试）  
**执行开始**: Day 1 09:30  
**预计完成**: 2025-10-25

