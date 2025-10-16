# LLMChat 开发规范和实施指南

## 📋 概述

本文档为 LLMChat 项目团队提供完整的开发规范和实施指南，确保项目的高质量交付和团队协作效率。

## 🎯 目标读者

- **开发团队**: 前端和后端开发工程师
- **测试团队**: 质量保证和测试工程师
- **运维团队**: DevOps和系统管理员
- **项目管理者**: 技术项目经理

## 🏗️ 开发环境配置

### 环境要求
- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **PostgreSQL**: >= 14.0
- **Redis**: >= 6.0
- **Git**: >= 2.30

### 开发工具
- **IDE**: VS Code + 相关插件
- **浏览器**: Chrome DevTools
- **API工具**: Postman 或 Insomnia
- **数据库工具**: pgAdmin 或 DBeaver

### 环境配置步骤

#### 1. 克隆项目
```bash
git clone https://github.com/wilson323/llmchat.git
cd llmchat
```

#### 2. 安装依赖
```bash
pnpm install
```

#### 3. 配置环境变量
```bash
# 复制环境变量模板
cp backend/.env.example backend/.env
cp config/agents.example.json config/agents.json

# 编辑环境变量
nano backend/.env
```

#### 4. 启动开发服务
```bash
# 并发启动前后端开发服务
pnpm run dev

# 或分别启动
pnpm run backend:dev  # 后端: http://localhost:3001
pnpm run frontend:dev # 前端: http://localhost:3000
```

## 📝 代码规范

### TypeScript 规范

#### 1. 类型定义
```typescript
// ✅ 正确：明确的接口定义
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt?: Date; // 可选字段必须明确标记
}

// ❌ 错误：使用 any 类型
const userData: any = response.data;
```

#### 2. 导入导出规范
```typescript
// ✅ 正确：组件使用 default export
const Button: React.FC<ButtonProps> = (props) => {
  return <button>{props.children}</button>;
};
export default Button;

// ✅ 正确：工具函数使用 named export
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

// ❌ 错误：混合导出方式
export const Button = ...; // 组件不应该用 named export
```

#### 3. 类型守卫
```typescript
// ✅ 正确：类型守卫
const isUser = (obj: unknown): obj is User => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj
  );
};
```

### React 组件规范

#### 1. 组件结构
```typescript
// ✅ 正确：组件结构
interface ComponentProps {
  title: string;
  onAction?: () => void;
}

const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
  const [state, setState] = useState<string>('');

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
};

export default Component;
```

#### 2. Hook 使用规范
```typescript
// ✅ 正确：Hook 在组件顶部使用
const Component: React.FC<Props> = (props) => {
  const [data, setData] = useState<Data | null>(null);
  const { user } = useAuthStore();

  // 业务逻辑

  return <div>{/* JSX */}</div>;
};

// ❌ 错误：Hook 在条件或循环中使用
const Component: React.FC<Props> = (props) => {
  if (props.condition) {
    const [state, setState] = useState(); // ❌ 错误
  }
};
```

#### 3. 性能优化
```typescript
// ✅ 正确：使用 React.memo
const MemoizedComponent = React.memo<ComponentProps>(({ data }) => {
  return <div>{data.value}</div>;
});

// ✅ 正确：使用 useMemo
const expensiveValue = useMemo(() => {
  return data.reduce((sum, item) => sum + item.value, 0);
}, [data]);
```

### API 设计规范

#### 1. 控制器结构
```typescript
// ✅ 正确：控制器结构
export class ChatController {
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      // 输入验证
      const validatedData = messageSchema.validate(req.body);

      // 业务逻辑处理
      const result = await this.chatService.sendMessage(validatedData);

      // 响应返回
      res.json(this.apiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }
}
```

#### 2. 错误处理
```typescript
// ✅ 正确：自定义错误类型
export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 统一错误处理
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        field: error.field
      }
    });
  }

  next(error);
}
```

#### 3. 中间件使用
```typescript
// ✅ 正确：中间件链
app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use(rateLimitMiddleware);
app.use('/api/chat', chatController.router);
```

## 🧪 测试规范

### 单元测试

#### 1. 测试文件命名
```
src/
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx
├── services/
│   └── chatService.ts
│       └── chatService.test.ts
```

#### 2. 测试结构
```typescript
// ✅ 正确：测试结构
describe('Button Component', () => {
  it('should render with correct title', () => {
    // Arrange
    const props = { title: 'Test Button' };

    // Act
    render(<Button {...props} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
  });

  it('should call onAction when clicked', () => {
    // Arrange
    const onAction = jest.fn();
    const props = { title: 'Test Button', onAction };

    // Act
    render(<Button {...props} />);
    fireEvent.click(screen.getByRole('button'));

    // Assert
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

#### 3. Mock 和 Spy
```typescript
// ✅ 正确：Mock 外部依赖
jest.mock('../../services/api', () => ({
  api: {
    post: jest.fn()
  }
}));

// ✅ 正确：Spy 函数调用
const mockApi = api as jest.MockedFunction<typeof api>;
expect(mockApi.post).toHaveBeenCalledWith('/api/test', expectedData);
```

### 集成测试

#### 1. API 测试
```typescript
// ✅ 正确：API集成测试
describe('Chat API', () => {
  it('should send message successfully', async () => {
    const response = await request(app)
      .post('/api/chat/completions')
      .send({ message: 'Hello' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.response).toContain('Hello');
  });
});
```

#### 2. 数据库测试
```typescript
// ✅ 正确：数据库测试
describe('User Repository', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('should create user successfully', async () => {
    const userData = { name: 'Test User', email: 'test@example.com' };
    const user = await userRepository.create(userData);

    expect(user.id).toBeDefined();
    expect(user.name).toBe(userData.name);
  });
});
```

### E2E 测试

#### 1. 页面测试
```typescript
// ✅ 正确：页面交互测试
test('user can send message', async ({ page }) => {
  await page.goto('/chat/test-agent');

  // 发送消息
  await page.fill('[data-testid="message-input"]', 'Hello AI');
  await page.click('[data-testid="send-button"]');

  // 验证响应
  await expect(page.locator('[data-testid="message-content"]')).toContain('Hello');
});
```

## 🔄 Git 工作流

### 分支策略

#### 1. 分支命名
```
main                    # 主分支，生产环境代码
develop                 # 开发分支
feature/user-auth       # 功能分支
bugfix/login-error      # 修复分支
hotfix/security-patch  # 紧急修复分支
```

#### 2. 分支保护
- `main` 分支：受保护，需要 PR 和审查
- `develop` 分支：自动部署到测试环境
- 功能分支：需要关联 Issue 和 PR

### 提交规范

#### 1. 提交信息格式
```bash
# 格式：<type>[optional scope]: <description>

feat(chat): 添加文件上传功能支持

- 支持 PDF、DOCX、TXT 格式
- 添加文件大小限制（10MB）
- 实现文件预览功能

Closes #123
```

#### 2. 提交类型
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建或辅助工具变动

#### 3. 提交检查清单
```bash
# 提交前检查清单
pnpm run type-check  # TypeScript 类型检查
pnpm run lint         # 代码质量检查
pnpm test              # 运行测试
pnpm run build         # 构建验证
```

### Pull Request 流程

#### 1. PR 创建
```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 开发和测试
# ... 开发工作 ...

# 3. 提交代码
git add .
git commit -m "feat: 实现新功能"

# 4. 推送分支
git push origin feature/new-feature

# 5. 创建 PR
gh pr create --title "feat: 实现新功能" --body "功能描述和实现细节"
```

#### 2. PR 审查清单
- [ ] 代码质量检查通过
- [ ] 测试覆盖率达标
- [ ] 文档已更新
- [ ] 性能影响评估
- [ ] 安全性评估
- [ ] 向后兼容性检查

## 📊 质量保证

### 代码质量检查

#### 1. 自动化检查
```bash
# 完整质量检查
pnpm run quality-check

# 快速检查
pnpm run quality-check:quick
```

#### 2. 质量指标
| 指标 | 目标值 | 检查命令 |
|------|--------|----------|
| TypeScript 错误 | 0 | `pnpm run type-check` |
| ESLint 错误 | 0 | `pnpm run lint` |
| 测试覆盖率 | > 80% | `pnpm run test:coverage` |
| 构建成功率 | 100% | `pnpm run build` |
| 安全漏洞 | 0 (高危) | `pnpm audit --audit-level high` |

#### 3. CI/CD 集成
```yaml
# .github/workflows/quality-check.yml
name: Quality Check

on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run quality-check
```

### 性能监控

#### 1. 性能指标
- **API 响应时间**: < 200ms (P95)
- **页面加载时间**: < 3s
- **内存使用**: < 100MB
- **CPU 使用率**: < 70%

#### 2. 性能监控工具
- **Lighthouse**: 前端性能测试
- **Web Vitals**: 核心性能指标
- **APM**: 应用性能监控
- **Profiling**: 性能分析

## 🔒 安全规范

### 编码安全

#### 1. 输入验证
```typescript
// ✅ 正确：输入验证
import Joi from 'joi';

const messageSchema = Joi.object({
  message: Joi.string().required().max(1000),
  agentId: Joi.string().required(),
  sessionId: Joi.string().optional()
});

// 验证输入
const { error, value } = messageSchema.validate(req.body);
if (error) {
  return res.status(400).json({ error: error.details[0].message });
}
```

#### 2. SQL 注入防护
```typescript
// ✅ 正确：参数化查询
async function getUserById(id: string): Promise<User | null> {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// ❌ 错误：字符串拼接（SQL注入风险）
async function getUserById(id: string): Promise<User | null> {
  const query = `SELECT * FROM users WHERE id = '${id}'`; // ❌ 危险
  const result = await db.query(query);
  return result.rows[0] || null;
}
```

#### 3. XSS 防护
```typescript
// ✅ 正确：输出编码
const sanitizeHtml = (html: string): string => {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
```

### 数据保护

#### 1. 敏感数据处理
```typescript
// ✅ 正确：敏感信息脱敏
const logSanitizer = {
  sanitize: (data: any): any => {
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };

      // 移除敏感字段
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.apiKey;

      // 脱敏邮箱
      if (sanitized.email) {
        sanitized.email = sanitized.email.replace(/(.{2}).*(.)/, '$1***$2');
      }

      return sanitized;
    }
    return data;
  }
};
```

#### 2. 环境变量管理
```bash
# ✅ 正确：环境变量存储
TOKEN_SECRET="your-super-secure-jwt-secret"
DATABASE_URL="postgresql://user:password@localhost:5432/db"

# ❌ 错误：硬编码敏感信息
const API_KEY = "sk-1234567890"; // ❌ 不要在代码中硬编码
```

## 📚 文档规范

### 代码注释

#### 1. 函数注释
```typescript
/**
 * 发送聊天消息
 * @param message - 聊天消息内容
 * @param agentId - 智能体ID
 * @param sessionId - 会话ID（可选）
 * @returns Promise<ChatResponse> 聊天响应
 * @throws {ValidationError} 当输入参数无效时
 */
export async function sendMessage(
  message: string,
  agentId: string,
  sessionId?: string
): Promise<ChatResponse> {
  // 实现代码
}
```

#### 2. 类注释
```typescript
/**
 * 聊天控制器
 * 处理所有聊天相关的API请求
 */
export class ChatController {
  /**
   * 发送消息
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    // 实现代码
  }
}
```

#### 3. 复杂逻辑注释
```typescript
// 这里使用 requestAnimationFrame 来优化性能
// 避免频繁的 DOM 更新造成的性能问题
_scheduleFlush: () => {
  if (state.flushScheduled) return;
  set({ flushScheduled: true });
  requestAnimationFrame(() => {
    get().flushBuffer();
  });
};
```

### 文档编写

#### 1. README 模板
```markdown
# 项目名称

## 功能描述
简要描述项目的主要功能和特性

## 技术栈
列出项目使用的主要技术栈

## 安装和配置
详细的安装和配置步骤

## 使用方法
基本的使用方法和示例

## API 文档
API 接口的详细说明

## 贡献指南
贡献代码的流程和规范
```

#### 2. API 文档
```markdown
# API 文档

## 认证
说明 API 的认证方式

## 端点列表
### 聊天接口
#### POST /api/chat/completions
发送聊天消息

**请求体**:
```json
{
  "message": "Hello AI",
  "agentId": "gpt-4",
  "sessionId": "session-123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "response": "Hello! How can I help you?",
    "sessionId": "session-123"
  }
}
```
```

## 🚀 实施计划

### 第一阶段：环境搭建 (1周)
- [ ] 配置开发环境
- [ ] 安装开发工具
- [ ] 搭建 CI/CD 流水线
- [ ] 配置代码质量检查

### 第二阶段：规范培训 (1周)
- [ ] 代码规范培训
- [ ] Git 工作流培训
- [ ] 测试规范培训
- [ ] 安全规范培训

### 第三阶段：工具集成 (1周)
- [ ] 集成质量检查工具
- [ ] 配置自动化测试
- [ ] 部署监控系统
- [ ] 建立文档体系

### 第四阶段：全面执行 (持续)
- [ ] 严格执行代码规范
- [ ] 持续改进工具链
- [ ] 定期回顾和优化
- [ ] 知识分享和培训

## 📞 支持和资源

### 常见问题
[常见问题解答文档](TROUBLESHOOTING.md)

### 技术支持
- **GitHub Issues**: [项目Issues](https://github.com/wilson323/llmchat/issues)
- **技术讨论**: [项目Discussions](https://github.com/wilson323/llmchat/discussions)

### 学习资源
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [React 官方文档](https://react.dev/)
- [Node.js 官方文档](https://nodejs.org/)

---

*最后更新: 2025-10-13*