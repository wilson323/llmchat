# 团队技术宪法 - LLMChat 项目

> 本宪法定义了我们团队在 LLMChat 项目中的技术价值观、质量标准、决策原则和协作规范。所有团队成员必须遵守这些原则，以确保项目的高质量交付和可持续发展。

## 📋 宪法总则

### 核心价值观
- **质量优先** - 代码质量永远优先于开发速度
- **用户体验至上** - 每一个技术决策都应以用户体验为导向
- **持续改进** - 通过数据驱动的持续改进追求卓越
- **团队协作** - 知识共享和技术互助是团队成功的基石
- **安全第一** - 在所有技术决策中，安全是不可妥协的基础要求

### 适用范围
- 所有前端、后端、共享类型和基础设施代码
- 所有技术决策、架构设计和实现方案
- 所有团队成员的技术行为和协作方式
- 所有与项目相关的技术文档和规范

---

## 🏗️ 第一章：代码质量治理原则

### 第一节：TypeScript 严格类型安全

**1.1 零容忍类型错误政策**
- 🔴 **严禁**任何 TypeScript 编译错误进入主分支
- 🔴 **严禁**使用 `any` 类型，必须使用明确的类型定义
- 🔴 **严禁**绕过 TypeScript 类型检查（如 `@ts-ignore`）

**1.2 类型定义规范**
```typescript
// ✅ 正确：完整的接口定义
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt?: Date; // 可选字段必须明确标记
}

// ❌ 错误：使用 any 类型
const userData: any = response.data;

// ❌ 错误：不完整的类型定义
interface PartialUser {
  id: string;
  name: string;
  // 缺少必需字段
}
```

**1.3 严格的 TypeScript 配置**
```json
{
  "strict": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitAny": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### 第二节：代码可读性和维护性

**2.1 命名规范**
- 变量和函数使用 `camelCase`
- 类和组件使用 `PascalCase`
- 常量使用 `UPPER_SNAKE_CASE`
- 文件名使用 `kebab-case` 或 `PascalCase`（组件文件）

**2.2 函数设计原则**
- 单一职责：每个函数只做一件事
- 纯函数优先：避免副作用，提高可测试性
- 参数限制：函数参数不超过 5 个，超过时使用对象参数
- 返回值明确：函数必须有明确的返回值类型

```typescript
// ✅ 正确：单一职责的纯函数
const calculateTotalPrice = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

// ✅ 正确：使用对象参数
const createUser = ({ name, email, role }: CreateUserParams): User => {
  // 实现
};

// ❌ 错误：参数过多
const createUser = (name: string, email: string, role: string, department: string, avatar?: string): User => {
  // 实现
};
```

**2.3 注释和文档规范**
- 所有公共 API 必须有 JSDoc 注释
- 复杂业务逻辑必须有行内注释说明
- 注释应该解释"为什么"而不是"做什么"

```typescript
/**
 * 计算购物车总价，包含折扣和税费计算
 * @param items - 购物车商品列表
 * @param discountRate - 折扣率（0-1之间）
 * @returns 最终总价（包含税费）
 */
export const calculateCartTotal = (
  items: CartItem[],
  discountRate: number = 0
): number => {
  // 应用折扣后再计算税费，确保税务计算的准确性
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const discountedTotal = subtotal * (1 - discountRate);
  return discountedTotal * (1 + TAX_RATE);
};
```

### 第三节：代码组织和架构

**3.1 模块化原则**
- 每个文件只导出一个主要功能
- 使用 barrel exports（index.ts）统一导出
- 避免循环依赖，保持清晰的依赖关系

**3.2 目录结构规范**
```
src/
├── components/          # React 组件
│   ├── ui/             # 基础 UI 组件
│   ├── chat/           # 聊天相关组件
│   └── admin/          # 管理后台组件
├── hooks/              # 自定义 React Hooks
├── services/           # API 服务层
├── store/              # 状态管理
├── utils/              # 工具函数
├── types/              # TypeScript 类型定义
└── constants/          # 常量定义
```

**3.3 依赖管理原则**
- 优先使用项目内已有的依赖
- 新增依赖必须经过团队评审
- 定期清理未使用的依赖
- 保持依赖版本的合理性更新

---

## 🧪 第二章：测试标准和质量门禁

### 第一节：测试覆盖率要求

**1.1 覆盖率标准**
- **单元测试覆盖率**：≥ 80%
- **集成测试覆盖率**：≥ 70%
- **关键业务逻辑**：100% 覆盖
- **核心 API 端点**：100% 覆盖

**1.2 测试分层策略**
```
测试金字塔：
    E2E Tests (10%)     # 端到端测试，用户场景验证
   ┌─────────────────┐
  Integration Tests (20%)  # 集成测试，模块间交互验证
 ┌───────────────────────┐
Unit Tests (70%)          # 单元测试，函数和组件验证
└─────────────────────────┘
```

### 第二节：测试编写规范

**2.1 单元测试规范**
```typescript
// ✅ 正确：清晰的测试结构和描述
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = { name: 'John', email: 'john@example.com' };

      // Act
      const user = await userService.createUser(userData);

      // Assert
      expect(user).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = { name: 'John', email: 'existing@example.com' };

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already exists');
    });
  });
});
```

**2.2 集成测试规范**
```typescript
// ✅ 正确：测试完整的 API 流程
describe('Chat API Integration', () => {
  it('should handle complete chat flow', async () => {
    // 1. 用户登录
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200);

    const token = loginResponse.body.token;

    // 2. 发送聊天消息
    const chatResponse = await request(app)
      .post('/api/chat/completions')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello, AI!' })
      .expect(200);

    expect(chatResponse.body.response).toBeDefined();
    expect(chatResponse.body.response).toContain('Hello');
  });
});
```

### 第三节：质量门禁标准

**3.1 代码质量检查**
```bash
# 所有提交必须通过的质量检查
pnpm run type-check      # TypeScript 编译，0 错误
pnpm run lint           # ESLint 检查，0 错误
pnpm run test           # 测试套件，100% 通过
pnpm run build          # 构建验证，成功构建
pnpm run security:audit # 安全审计，无高危漏洞
```

**3.2 性能基准测试**
- API 响应时间 < 200ms（P95）
- 首屏加载时间 < 3s
- 代码分割后单个 chunk < 500KB
- 内存使用量 < 100MB（生产环境）

**3.3 安全检查清单**
- ✅ 无硬编码的敏感信息
- ✅ 输入验证和清理完整
- ✅ 认证和授权正确实施
- ✅ SQL 注入防护到位
- ✅ XSS 防护措施完善

---

## 🎨 第三章：用户体验一致性规范

### 第一节：UI/UX 设计原则

**1.1 设计系统一致性**
- 使用统一的组件库（Radix UI + Tailwind CSS）
- 遵循统一的设计令牌（颜色、字体、间距）
- 保持交互模式的一致性
- 响应式设计必须覆盖所有断点

**1.2 交互设计原则**
- **即时反馈**：用户操作后 100ms 内必须有视觉反馈
- **加载状态**：所有异步操作必须显示加载状态
- **错误处理**：友好的错误提示和恢复指导
- **无障碍性**：符合 WCAG 2.1 AA 标准

```typescript
// ✅ 正确：完整的用户交互处理
const handleSendMessage = async (message: string) => {
  // 1. 立即反馈：添加到本地状态
  setMessages(prev => [...prev, { role: 'user', content: message }]);
  setIsLoading(true);

  try {
    // 2. 发送请求
    const response = await chatService.sendMessage(message);

    // 3. 更新状态
    setMessages(prev => [...prev, response]);
  } catch (error) {
    // 4. 错误处理
    toast.error('发送失败，请重试');
    logger.error('Send message failed:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### 第二节：前端性能标准

**2.1 加载性能优化**
- 实施代码分割和懒加载
- 使用 React.memo 和 useMemo 优化重渲染
- 图片懒加载和 WebP 格式支持
- 关键资源预加载

**2.2 运行时性能优化**
```typescript
// ✅ 正确：性能优化示例
const MessageList = React.memo(({ messages }: MessageListProps) => {
  // 使用 useMemo 避免重复计算
  const sortedMessages = useMemo(() => {
    return messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [messages]);

  // 使用虚拟化处理长列表
  return (
    <VirtualizedList
      items={sortedMessages}
      itemHeight={80}
      renderItem={({ item }) => <MessageItem message={item} />}
    />
  );
});

// 使用自定义 Hook 缓存计算结果
const useChatStats = (messages: Message[]) => {
  return useMemo(() => ({
    totalMessages: messages.length,
    lastMessage: messages[messages.length - 1],
    unreadCount: messages.filter(m => !m.read).length
  }), [messages]);
};
```

### 第三节：状态管理规范

**3.1 Zustand 状态管理原则**
- 状态结构扁平化，避免深层嵌套
- 使用 immer 进行不可变更新
- 分离业务状态和 UI 状态
- 实现状态持久化和恢复机制

```typescript
// ✅ 正确：状态管理结构
interface ChatStore {
  // 业务状态
  conversations: Record<string, Conversation>;
  currentConversationId: string | null;

  // UI 状态
  isLoading: boolean;
  error: string | null;

  // 操作
  setCurrentConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  clearError: () => void;
}

const useChatStore = create<ChatStore>()(
  devtools(
    immer((set, get) => ({
      conversations: {},
      currentConversationId: null,
      isLoading: false,
      error: null,

      setCurrentConversation: (id) => {
        set((state) => {
          state.currentConversationId = id;
        });
      },

      addMessage: (conversationId, message) => {
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (conversation) {
            conversation.messages.push(message);
            conversation.updatedAt = new Date();
          }
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
    { name: 'chat-store' }
  )
);
```

---

## ⚡ 第四章：性能要求和监控指标

### 第一节：性能基准要求

**1.1 API 性能标准**
- **响应时间**：P95 < 200ms，P99 < 500ms
- **吞吐量**：> 1000 RPS
- **错误率**：< 0.1%
- **可用性**：99.9%

**1.2 前端性能标准**
- **首次内容绘制（FCP）**：< 1.5s
- **最大内容绘制（LCP）**：< 2.5s
- **首次输入延迟（FID）**：< 100ms
- **累积布局偏移（CLS）**：< 0.1

**1.3 数据库性能标准**
- **查询响应时间**：< 50ms（简单查询）
- **连接池利用率**：< 80%
- **查询缓存命中率**：> 90%
- **慢查询数量**：0（> 1s 的查询）

### 第二节：监控和告警体系

**2.1 应用性能监控（APM）**
```typescript
// 性能监控装饰器示例
export function performanceMonitor(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = performance.now();
    const operationName = `${target.constructor.name}.${propertyName}`;

    try {
      // 记录操作开始
      logger.info(`Operation started: ${operationName}`, { args });

      const result = await method.apply(this, args);

      // 记录成功操作
      const duration = performance.now() - startTime;
      logger.info(`Operation completed: ${operationName}`, { duration, result });

      // 发送性能指标
      metricsClient.recordMetric('operation_duration', duration, { operation: operationName });

      return result;
    } catch (error) {
      // 记录错误
      const duration = performance.now() - startTime;
      logger.error(`Operation failed: ${operationName}`, { error, duration });

      // 发送错误指标
      metricsClient.recordMetric('operation_error', 1, { operation: operationName });

      throw error;
    }
  };
}

// 使用示例
class ChatService {
  @performanceMonitor
  async sendMessage(message: string): Promise<ChatResponse> {
    // 实现
  }
}
```

**2.2 关键业务指标监控**
- 用户活跃度（DAU/MAU）
- 聊天会话成功率
- AI 响应时间分布
- 系统资源使用率

**2.3 告警级别定义**
- **P0 - 紧急**：系统完全不可用，15分钟内响应
- **P1 - 高**：核心功能异常，1小时内响应
- **P2 - 中**：非核心功能异常，4小时内响应
- **P3 - 低**：性能下降或警告，24小时内响应

### 第三节：性能优化最佳实践

**3.1 后端性能优化**
```typescript
// 数据库查询优化
class MessageRepository {
  // ✅ 正确：使用索引和分页
  async getConversationMessages(conversationId: string, page: number = 1, limit: number = 50) {
    return this.db.query(`
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, (page - 1) * limit]);
  }

  // ✅ 正确：使用连接池和事务
  async createMessage(message: CreateMessageDto): Promise<Message> {
    return this.db.transaction(async (trx) => {
      const [newMessage] = await trx('messages')
        .insert(message)
        .returning('*');

      // 更新会话统计
      await trx('conversations')
        .where('id', message.conversation_id)
        .update({
          last_message_at: new Date(),
          message_count: trx.raw('message_count + 1')
        });

      return newMessage;
    });
  }
}
```

**3.2 前端性能优化**
```typescript
// 组件懒加载
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const CadViewer = lazy(() => import('./components/cad/CadViewer'));

// 路由级别的代码分割
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'chat', element: <ChatContainer /> },
      { path: 'admin', element: <Suspense fallback={<Loading />}><AdminDashboard /></Suspense> },
      { path: 'cad', element: <Suspense fallback={<Loading />}><CadViewer /></Suspense> },
    ],
  },
]);

// 图片优化组件
const OptimizedImage: React.FC<ImageProps> = ({ src, alt, ...props }) => {
  return (
    <picture>
      <source srcSet={`${src}.webp`} type="image/webp" />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        {...props}
      />
    </picture>
  );
};
```

---

## 🏛️ 第五章：技术决策治理框架

### 第一节：技术选型原则

**1.1 技术选型评估标准**
- **成熟度**：技术是否经过生产环境验证
- **社区活跃度**：是否有活跃的社区支持和维护
- **学习成本**：团队掌握技术的时间成本
- **性能表现**：是否满足项目性能要求
- **生态系统**：是否有完善的工具链和文档

**1.2 技术债务管理**
- 建立技术债务登记册
- 每个迭代分配 20% 时间处理技术债务
- 重大技术债务需要制定详细的偿还计划
- 定期评估技术债务对业务的影响

### 第二节：架构决策记录（ADR）

**2.1 ADR 格式规范**
```markdown
# ADR-001: 选择 Zustand 作为状态管理解决方案

## 状态
已接受

## 背景
项目需要选择一个状态管理解决方案来管理复杂的聊天状态和用户会话。

## 决策
选择 Zustand 作为主要的状态管理库。

## 理由
1. **简单性**：相比 Redux，Zustand 更加简洁，学习成本低
2. **TypeScript 支持**：原生支持 TypeScript，类型安全性好
3. **性能**：不需要 Provider 包装，性能更好
4. **Bundle 大小**：库体积小，对项目打包大小影响小

## 后果
- 正面：开发效率提高，代码更简洁
- 负面：生态系统相对较小，社区资源有限
- 风险：如果 Zustand 停止维护，需要迁移到其他解决方案
```

**2.2 架构决策流程**
1. 提出技术问题和备选方案
2. 评估各方案的优缺点
3. 团队讨论和决策
4. 记录决策过程和理由
5. 定期回顾和调整决策

### 第三节：代码审查流程

**3.1 代码审查检查清单**
```markdown
## 代码审查检查清单

### 功能性
- [ ] 功能实现符合需求
- [ ] 边界条件处理正确
- [ ] 错误处理完善

### 代码质量
- [ ] 代码可读性良好
- [ ] 遵循项目编码规范
- [ ] 无明显的代码异味

### 性能
- [ ] 无明显的性能问题
- [ ] 数据库查询优化
- [ ] 缓存策略合理

### 安全性
- [ ] 输入验证和清理
- [ ] 权限检查正确
- [ ] 无安全漏洞

### 测试
- [ ] 测试覆盖率达标
- [ ] 测试用例合理
- [ ] 测试可维护性
```

**3.2 代码审查规范**
- 每个 PR 必须至少有 2 人审查
- 审查者必须具备相关技术背景
- 审查意见必须具体和可操作
- 作者必须及时响应审查意见

---

## 🤝 第六章：团队协作和知识管理

### 第一节：协作规范

**1.1 Git 工作流**
- 使用 Git Flow 分支模型
- 主分支（main）保持稳定状态
- 功能分支（feature/*）用于新功能开发
- 提交信息遵循 Conventional Commits 规范

```bash
# 提交信息格式
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# 示例
feat(chat): 添加文件上传功能支持

- 支持 PDF、DOCX、TXT 格式
- 添加文件大小限制（10MB）
- 实现文件预览功能

Closes #123
```

**1.2 代码提交规范**
- 提交前必须通过所有本地检查
- 每个 PR 必须包含完整的测试
- 重要变更需要更新相关文档
- 避免大规模的 PR，建议拆分为小批次

### 第二节：知识管理和文档

**2.1 技术文档分类**
- **架构文档**：系统整体架构和设计决策
- **API 文档**：接口规范和使用示例
- **开发指南**：环境搭建和开发流程
- **部署文档**：部署流程和运维指南

**2.2 知识分享机制**
- 每周技术分享会
- 代码审查中的知识传递
- 重要技术决策的团队讨论
- 外部技术会议和培训的内部分享

### 第三节：培训和能力提升

**3.1 新人培训计划**
- 第一周：环境搭建和项目熟悉
- 第二周：代码贡献和团队协作
- 第三周：独立承担小功能开发
- 第四周：参与架构讨论和设计

**3.2 技能提升计划**
- 每个季度制定个人技能提升计划
- 团队定期组织技术培训
- 鼓励参与开源项目和技术社区
- 支持技术认证和继续教育

---

## 📊 第七章：质量度量和持续改进

### 第一节：质量指标体系

**1.1 代码质量指标**
- **代码复杂度**：圈复杂度 < 10
- **代码重复率**：< 3%
- **测试覆盖率**：> 80%
- **技术债务指数**：< 5%

**1.2 开发效率指标**
- **代码交付周期**：< 3 天
- **PR 平均审查时间**：< 24 小时
- **构建成功率**：> 95%
- **部署频率**：每周至少 1 次

**1.3 产品质量指标**
- **Bug 密度**：< 1 bug/KLOC
- **生产事故数量**：< 1 次/月
- **用户满意度**：> 4.5/5
- **系统可用性**：> 99.9%

### 第二节：持续改进机制

**2.1 定期回顾会议**
- **Sprint 回顾**：每个迭代结束时进行
- **季度回顾**：评估整体技术方向和团队表现
- **年度回顾**：制定长期技术规划

**2.2 改进措施跟踪**
- 建立改进措施清单
- 指定负责人和完成时间
- 定期检查改进效果
- 成功经验标准化推广

### 第三节：技术创新管理

**3.1 创新评估流程**
1. 提出技术创新想法
2. 技术可行性评估
3. 原型开发和验证
4. 业务价值评估
5. 生产环境实施

**3.2 技术前瞻性规划**
- 关注行业技术趋势
- 定期评估技术栈更新
- 参与开源社区贡献
- 建立技术创新基金

---

## ⚖️ 第八章：宪法执行和监督

### 第一节：执行机制

**1.1 质量门禁自动化**
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm run type-check

      - name: Lint
        run: pnpm run lint

      - name: Test
        run: pnpm run test

      - name: Build
        run: pnpm run build

      - name: Security audit
        run: pnpm run security:audit
```

**1.2 质量监控仪表板**
- 实时显示项目质量指标
- 质量趋势分析和预警
- 团队成员质量贡献排名
- 自动化质量报告生成

### 第二节：监督和问责

**2.1 质量监督委员会**
- 由技术负责人组成质量监督委员会
- 定期审查项目质量状况
- 对质量问题进行调查和处理
- 向团队反馈质量改进建议

**2.2 问责机制**
- 违反宪法原则的行为需要记录和反思
- 重复违反者需要接受额外培训
- 严重违反者可能影响绩效考核
- 优秀遵守者给予表彰和奖励

### 第三节：宪法修订流程

**3.1 修订提案**
- 任何团队成员都可以提出修订提案
- 提案需要说明修订理由和预期影响
- 重大修订需要征求全体团队意见

**3.2 修订表决**
- 一般修订需要 2/3 团队成员同意
- 重大修订需要 3/4 团队成员同意
- 核心原则修订需要全体一致同意

**3.3 修订生效**
- 修订通过后立即生效
- 需要更新相关文档和培训材料
- 设定过渡期和适应期支持

---

## 📝 附录

### 附录A：技术栈清单

**前端技术栈**
- React 18 + TypeScript
- Vite + Tailwind CSS
- Zustand（状态管理）
- React Router（路由）
- Vitest（测试框架）
- Playwright（E2E测试）

**后端技术栈**
- Node.js + Express + TypeScript
- PostgreSQL（主数据库）
- Redis（缓存）
- Jest（测试框架）
- Winston（日志）

**开发工具链**
- pnpm（包管理器）
- ESLint + Prettier（代码格式化）
- Husky + lint-staged（Git hooks）
- GitHub Actions（CI/CD）

### 附录B：质量检查命令

```bash
# 完整质量检查
pnpm run validate:quality

# 类型检查
pnpm run type-check

# 代码质量检查
pnpm run lint

# 测试
pnpm run test

# 构建验证
pnpm run build

# 安全审计
pnpm run security:audit

# 性能测试
pnpm run test:performance
```

### 附录C：紧急联系方式

**技术负责人**：[姓名] - [联系方式]
**运维负责人**：[姓名] - [联系方式]
**安全负责人**：[姓名] - [联系方式]

**外部支持**
- 云服务提供商技术支持
- 安全厂商应急响应
- 开源社区技术支持

---

## 🎯 结语

本技术宪法是我们团队对高质量软件开发的承诺。通过严格遵循这些原则和标准，我们能够：

1. **交付高质量的产品**：满足用户需求和期望
2. **提升团队技术能力**：持续学习和成长
3. **建立可信赖的技术品牌**：赢得用户和市场的认可
4. **实现可持续发展**：技术架构和团队能力的双重提升

每一位团队成员都有责任和义务遵守本宪法，并在实践中不断完善和优化。让我们共同努力，打造卓越的技术产品和团队文化！

---

**制定日期**：2025年10月13日
**版本**：v1.0
**下次评审日期**：2026年1月13日