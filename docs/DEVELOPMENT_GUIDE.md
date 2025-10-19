# 项目开发规范与最佳实践

## 📋 目录
- [1. 协作流程与分支策略](#1-协作流程与分支策略)
- [2. 项目架构规范](#2-项目架构规范)
- [3. TypeScript 使用规范](#3-typescript-使用规范)
- [4. 代码质量标准](#4-代码质量标准)
- [5. 前端开发规范](#5-前端开发规范)
- [6. 后端开发规范](#6-后端开发规范)
- [7. 测试策略](#7-测试策略)
- [8. 安全与配置](#8-安全与配置)
- [9. 性能优化](#9-性能优化)
- [10. 文档规范](#10-文档规范)
- [11. 已知问题与修复优先级](#11-已知问题与修复优先级)

## 1. 协作流程与分支策略

### 分支模型
- **主分支**: `main` 为稳定生产分支
- **开发分支**: 从 `work` 或 `feature/*` 切出
- **禁止**: 直接向 `main` 推送代码

### 提交规范
- 遵循 **Conventional Commits** 格式
- 使用动词开头的小写英文短句
- 示例：
  ```
  feat: add user authentication
  fix: handle sidebar retry flow
  docs: update API documentation
  refactor: extract common utilities
  ```

### 代码评审
- 所有合并请求必须至少一名核心成员审查
- 提交前附带测试记录与截图（UI修改时）
- PR内容包含：背景、主要变更、影响范围、测试结论
- 配置或依赖调整需提供迁移步骤

### 环境搭建指南

#### 系统要求
- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **PostgreSQL**: >= 13.0
- **Redis**: >= 6.0
- **Git**: >= 2.30.0

#### 快速开始

1. **克隆项目**
```bash
git clone https://github.com/your-org/llmchat.git
cd llmchat
```

2. **安装依赖**
```bash
# 安装pnpm（如果未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

3. **环境变量配置**

后端配置 (`backend/.env`):
```bash
# 复制模板
cp backend/.env.example backend/.env

# 必需配置
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://username:password@localhost:5432/llmchat
REDIS_HOST=localhost
REDIS_PORT=6379
TOKEN_SECRET=your-super-secure-jwt-secret-min-32-chars-long
FRONTEND_URL=http://localhost:3000

# AI提供商API密钥
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-your-anthropic-key
FASTGPT_API_KEY=your-fastgpt-key
```

前端配置 (`frontend/.env`):
```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_ENABLE_DEBUG=true
```

4. **数据库初始化**
```bash
# 创建数据库
createdb llmchat

# 运行迁移
pnpm run migrate:up

# 检查状态
pnpm run migrate:status
```

5. **启动开发服务**
```bash
# 并发启动前后端
pnpm run dev

# 或分别启动
pnpm run backend:dev    # http://localhost:3001
pnpm run frontend:dev   # http://localhost:3000
```

#### 开发工具配置

VS Code调试配置 (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

ESLint配置 (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## 2. 项目架构规范

### 技术栈标准化
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **后端**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **状态管理**: Zustand (前端) + 本地存储持久化
- **测试**: Jest (后端) + Vitest (前端) + Playwright (E2E)
- **包管理**: pnpm with workspaces

### 目录结构标准化
```
llmchat/
├── backend/                 # 后端服务
│   └── src/
│       ├── controllers/     # 控制器层（精简）
│       ├── services/        # 业务逻辑层
│       ├── routes/          # 路由定义
│       ├── middleware/      # 中间件
│       ├── models/          # 数据模型
│       ├── utils/           # 工具函数
│       └── types/           # 类型定义
├── frontend/                # 前端应用
│   └── src/
│       ├── components/      # React组件
│       │   ├── ui/          # 基础UI组件
│       │   ├── features/    # 功能组件
│       │   └── layouts/     # 布局组件
│       ├── store/           # Zustand状态管理
│       ├── services/        # API服务
│       ├── hooks/           # 自定义Hooks
│       ├── utils/           # 工具函数
│       └── types/           # 类型定义
├── shared-types/            # 共享类型定义
├── docs/                    # 项目文档
└── tests/                   # 测试文件
```

### 文件命名规范
- **组件文件**: PascalCase (`UserProfile.tsx`, `Button.tsx`)
- **工具文件**: camelCase (`apiClient.ts`, `formatUtils.ts`)
- **类型文件**: camelCase (`types.ts`, `interfaces.ts`)
- **常量文件**: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)
- **配置文件**: kebab-case (`eslint.config.js`, `vite.config.ts`)

### 模块职责划分
- **Controller**: 仅负责请求/响应编排，禁止直接访问数据库
- **Service**: 封装业务逻辑和外部API调用
- **Utils**: 跨模块通用工具函数
- **Middleware**: 认证、授权、日志、错误处理等横切关注点

## 3. TypeScript 使用规范

### 类型定义规范
```typescript
// ✅ 正确：使用interface定义对象类型
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string; // 可选属性明确标记
  createdAt: Date;
}

// ✅ 正确：使用type定义联合类型、交叉类型
type Status = 'pending' | 'approved' | 'rejected';
type ApiResponse<T> = {
  data: T;
  status: Status;
  message?: string;
};

// ✅ 正确：使用泛型提高类型复用性
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 组件类型规范
```typescript
// ✅ 正确：React组件使用函数声明和泛型
interface ButtonProps {
  children: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant,
  size = 'medium',
  disabled = false,
  onClick
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### 类型安全要求
- ❌ **禁止**: 使用 `any` 类型
- ✅ **推荐**: 使用 `unknown` 并进行类型守卫
- ✅ **必须**: 所有公共函数有明确返回类型
- ✅ **必须**: 接口定义完整且准确
- ✅ **必须**: 可选属性正确使用 `?` 标记

## 4. 代码质量标准

### 命名约定
- **React组件、类**: PascalCase
- **函数、常量**: camelCase
- **枚举、常量对象**: UPPER_SNAKE_CASE
- **命名要求**: 具有描述性和一致性，避免缩写

### 代码风格
- **缩进**: 两个空格
- **引号**: 单引号
- **分号**: 一致使用或不使用
- **行长度**: 建议不超过100字符
- **导入顺序**: 第三方库 → 本地模块 → 样式文件

### 错误处理
```typescript
// ✅ 正确：完善的错误处理
async function fetchUserData(userId: string): Promise<UserProfile> {
  try {
    const response = await api.get<ApiResponse<UserProfile>>(`/users/${userId}`);
    return response.data.data;
    } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Failed to fetch user data', {
        userId,
        statusCode: error.statusCode,
        message: error.message
      });
      throw new UserDataError('无法获取用户信息', { cause: error });
    }
    throw error;
  }
}
```

### 日志规范
- 使用结构化日志库（winston/pino）
- 输出JSON格式日志
- 包含上下文信息（requestId、userId等）
- 敏感信息脱敏处理

## 5. 前端开发规范

### React组件规范
- **组件职责**: 单一明确，避免超大组件（>300行）
- **Props接口**: 定义完整，包含注释
- **性能优化**: 适当使用 `React.memo`、`useCallback`、`useMemo`
- **Hooks规则**: 遵循 React Hooks 规则

### Zustand状态管理
```typescript
// ✅ 正确：拆分store为多个slice
interface UserSlice {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
}

interface ChatSlice {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

// 组合多个slice
type Store = UserSlice & ChatSlice;

const useStore = create<Store>()(
  persist(
    (set) => ({
      // User slice
      user: null,
      setUser: (user) => set({ user }),
      
      // Chat slice
      messages: [],
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      clearMessages: () => set({ messages: [] })
    }),
    { name: 'app-store' }
  )
);
```

### API服务层
- 所有API调用集中在 `services/` 目录
- 统一处理身份认证、超时、错误
- 使用类型化的响应接口

### UI/UX现代化要求
- **组件一致性**: 使用共享的弹窗、Toast、按钮组件
- **响应式布局**: 保证桌面端、移动端样式一致
- **可访问性**: 提供 `aria` 标签、键盘操作支持
- **流式交互**: 防抖与并发保护

## 6. 后端开发规范

### API设计规范
- **RESTful原则**: 遵循REST设计规范
- **HTTP状态码**: 正确使用2xx/3xx/4xx/5xx
- **请求/响应格式**: 统一JSON格式
- **API版本控制**: 使用URL版本（/api/v1）

### 数据库操作规范
```typescript
// ✅ 正确：使用参数化查询防止SQL注入
async function getUserById(userId: string): Promise<User | null> {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

// ✅ 正确：使用事务处理多步操作
async function createUserWithProfile(userData: UserData): Promise<User> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const userResult = await client.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [userData.name, userData.email]
    );
    
    await client.query(
      'INSERT INTO profiles (user_id, bio) VALUES ($1, $2)',
      [userResult.rows[0].id, userData.bio]
    );
    
    await client.query('COMMIT');
    return userResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 错误处理中间件
```typescript
// ✅ 正确：统一错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path
  });
  
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }
  
  // 不暴露内部错误细节
  res.status(500).json({
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR'
  });
});
```

## 7. 测试策略

### 最小要求
- 每次提交前运行 `npm run frontend:lint` 和 `npm run backend:lint`
- 命令失败需在PR中说明原因并排期修复

### 单元测试
```typescript
// ✅ 正确：后端服务测试
describe('UserService', () => {
  let userService: UserService;
  let mockDb: jest.Mocked<Database>;
  
  beforeEach(() => {
    mockDb = createMockDatabase();
    userService = new UserService(mockDb);
  });
  
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '123', name: 'Test User' };
      mockDb.query.mockResolvedValue({ rows: [mockUser] });
      
      const result = await userService.getUserById('123');
      
      expect(result).toEqual(mockUser);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['123']
      );
    });
    
    it('should return null when user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const result = await userService.getUserById('999');
      
      expect(result).toBeNull();
    });
  });
});
```

### 测试覆盖率要求
- **单元测试**: 覆盖率 ≥ 80%
- **关键业务逻辑**: 必须有测试
- **边界条件**: 必须测试
- **错误场景**: 必须覆盖

### 端到端测试
- 关键功能使用Playwright或Cypress
- 覆盖核心用户流程
- 冒烟测试：登录、发消息、历史记录检索

## 8. 安全与配置

### 敏感信息管理
- ❌ **禁止**: 在仓库提交真实API Key、数据库凭证
- ✅ **必须**: 敏感值迁移到 `.env` 文件
- ✅ **必须**: 提供 `.env.example` 示例文件
- ✅ **必须**: `.env` 添加到 `.gitignore`

### 认证与授权
```typescript
// ✅ 正确：密码加密存储
import bcrypt from 'bcrypt';

async function createUser(email: string, password: string): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  return await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    [email, hashedPassword]
  );
}

// ❌ 禁止：明文存储密码
// password_plain字段必须删除
```

### Token存储
- ❌ **禁止**: 在内存Map中存储token（不支持多实例）
- ✅ **推荐**: 使用Redis存储session
- ✅ **推荐**: 使用JWT无状态认证

### 速率限制
- 单实例：使用 `rate-limiter-flexible`
- 多实例：使用Redis作为共享存储

## 9. 性能优化

### 前端性能
- **代码分割**: 使用动态导入 `React.lazy`
- **图片优化**: 使用WebP格式，懒加载
- **虚拟化**: 长列表使用虚拟滚动
- **缓存策略**: 合理使用浏览器缓存

### 后端性能
- **数据库查询**: 使用索引，避免N+1查询
- **缓存策略**: Redis缓存热点数据
- **并发控制**: 使用连接池
- **异步处理**: 长耗时操作使用队列

## 10. 文档规范

### 代码注释
```typescript
/**
 * 获取用户信息
 * 
 * @param userId - 用户ID
 * @returns 用户信息，不存在时返回null
 * @throws {UserDataError} 当网络请求失败时抛出
 * 
 * @example
 * ```typescript
 * const user = await getUserData('123');
 * if (user) {
 *   console.log(user.name);
 * }
 * ```
 */
async function getUserData(userId: string): Promise<UserProfile | null> {
  // 实现...
}
```

### 文档维护
- 代码改动同步更新 `docs/` 目录文档
- 包含：架构图、状态机序列图、API文档
- 新增API提供Swagger/OpenAPI描述
- 配置变更更新 `config/README.md`

## 11. 已知问题与修复优先级

### TypeScript解析错误
- `frontend/src/services/api.ts`: 语法解析失败
- `frontend/src/store/chatStore.ts`: 语法解析失败
- `backend/src/controllers/ChatController.ts`: 语法错误

### 依赖兼容性
- TypeScript 5.9.2 超出 `@typescript-eslint` 支持范围
- 需同步升级eslint生态或锁定TS版本至 `<5.4`

### 构建产物
- 清理 `backend/dist` 目录
- 更新 `.gitignore` 忽略构建产物

## 日志、监控与可观测性

### 日志规范
- 采用 `winston`、`pino` 结构化日志库
- 输出JSON格式日志
- 接入集中式平台（Loki/Grafana）

### 健康检查
```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    externalApi: await checkExternalApi()
  };
  
  const isHealthy = Object.values(checks).every(check => check.ok);
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks
  });
});
```

### 性能监控
- 关键接口添加埋点
- 记录请求耗时、错误率
- 为容量规划提供数据支持

---

## 质量门槛

### 提交前检查清单
- [ ] TypeScript编译无错误
- [ ] ESLint检查通过
- [ ] 单元测试通过
- [ ] 测试覆盖率达标
- [ ] 文档已更新
- [ ] 无安全漏洞
- [ ] 性能无明显退化

### CI/CD门槛
- Lint检查必须通过
- 单元测试必须通过
- 构建必须成功
- 安全扫描无高危漏洞

---

**注意**: 本规范会随着项目迭代持续更新。所有开发者在提交代码前需对照本手册自检，并在PR模板中勾选相应检查项。

*最后更新: 2025年10月*
*维护者: 技术团队*
