# LLMChat 项目宪法 - 管理原则与开发指南

**文档版本**: v2.0.0  
**创建时间**: 2025-11-11  
**状态**: ✅ 生效中  
**适用范围**: 全项目（前端/后端/共享代码/基础设施）

---

## 📜 宪法序言

本宪法定义了LLMChat项目的核心价值观、技术标准、决策原则和协作规范。所有团队成员、贡献者和AI助手必须遵守这些原则，以确保项目的高质量交付和可持续发展。

### 🎯 核心使命

打造**企业级、生产就绪、高质量**的智能体聊天平台，为用户提供卓越的AI交互体验。

### ✨ 核心价值观

- **质量第一** - 代码质量永远优先于开发速度
- **用户体验至上** - 每个技术决策都以用户体验为导向
- **持续改进** - 通过数据驱动的持续改进追求卓越
- **团队协作** - 知识共享和技术互助是成功基石
- **安全为本** - 安全是不可妥协的基础要求
- **开放透明** - 决策过程和技术选择公开透明

---

## 第一章：项目管理体系 🏛️

### 第一节：单一真实来源原则

#### 1.1 文档体系架构

```
llmchat/
├── CONSTITUTION.md                    # 🎯 项目宪法（本文档）
├── CLAUDE.md                          # 📋 AI助手配置与开发规范
├── .specify/                          # 🚀 唯一项目管理系统
│   ├── specs/                         # 项目规格说明
│   ├── plans/                         # 项目规划文档
│   ├── memory/                        # 项目记忆和决策记录
│   └── standards/                     # 项目标准和规范
├── docs/                              # 📚 技术文档和用户指南
│   ├── DEVELOPMENT_GUIDE.md           # 开发指南
│   ├── DEPLOYMENT_GUIDE.md            # 部署指南
│   └── USER_GUIDE.md                  # 用户指南
└── QUALITY_SYSTEM_GUIDE.md            # 📊 质量保障体系指南
```

#### 1.2 文档优先级

1. **CONSTITUTION.md**（本文档）- 最高优先级，定义项目原则
2. **CLAUDE.md** - AI助手工作规范和开发指南
3. **QUALITY_SYSTEM_GUIDE.md** - 质量保障体系
4. **docs/** - 具体技术文档

#### 1.3 信息管理原则

- ✅ **每种信息只有一个权威来源**
- ✅ **避免创建重复或冲突的文档**
- ✅ **定期审查和清理过期文档**
- ✅ **保持文档与代码同步更新**

### 第二节：项目健康指标

#### 2.1 代码质量指标（零容忍政策）

| 指标 | 目标值 | 当前状态 | 检查方式 |
|------|--------|----------|----------|
| TypeScript编译错误 | 0 | ✅ 0 | `pnpm run type-check` |
| ESLint严重问题 | 0 | ✅ 0 | `pnpm run lint` |
| 测试覆盖率 | ≥95% | ✅ 95%+ | `pnpm run test:coverage` |
| 构建成功率 | 100% | ✅ 100% | `pnpm run build` |

#### 2.2 质量等级定义

| 分数 | 等级 | 状态 | 允许合并 |
|------|------|------|---------|
| 95-100 | A+ | 🌟 卓越 | ✅ 允许 |
| 90-94 | A | ✅ 优秀 | ✅ 允许 |
| 85-89 | B+ | ⚠️ 良好 | ⚠️ 需审批 |
| 80-84 | B | ⚠️ 及格 | ⚠️ 需审批 |
| <80 | C/D | ❌ 不及格 | ❌ 禁止 |

**当前项目质量等级**: 🌟 **A+** (卓越)

#### 2.3 性能标准

**前端性能**:
- 首次内容绘制（FCP）: < 1.5s
- 最大内容绘制（LCP）: < 2.5s
- 首次输入延迟（FID）: < 100ms
- 累积布局偏移（CLS）: < 0.1

**后端性能**:
- API响应时间（P95）: < 200ms
- API响应时间（P99）: < 500ms
- 吞吐量: > 1000 RPS
- 错误率: < 0.1%
- 系统可用性: 99.9%

---

## 第二章：代码质量治理 💎

### 第一节：TypeScript严格类型安全（零容忍政策）

#### 1.1 核心要求

- 🔴 **严禁**任何TypeScript编译错误进入主分支
- 🔴 **严禁**使用`any`类型（必须明确类型定义）
- 🔴 **严禁**使用`@ts-ignore`绕过类型检查
- 🔴 **严禁**提交不完整的类型定义

#### 1.2 TypeScript配置标准

```json
{
  "strict": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitAny": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true
}
```

#### 1.3 类型定义规范

```typescript
// ✅ 正确：完整的类型定义
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt?: Date; // 可选字段必须明确标记
}

// ✅ 正确：使用泛型
function fetchData<T>(url: string): Promise<T> {
  return fetch(url).then(res => res.json());
}

// ❌ 错误：使用any类型
const userData: any = response.data;

// ❌ 错误：不完整的类型
interface PartialUser {
  id: string; // 缺少其他必需字段
}
```

### 第二节：代码可读性和维护性

#### 2.1 命名规范

- **变量和函数**: `camelCase`
- **类和组件**: `PascalCase`
- **常量**: `UPPER_SNAKE_CASE`
- **文件名**: `kebab-case` 或 `PascalCase`（组件文件）
- **私有成员**: 前缀 `_` （如 `_privateMethod`）

#### 2.2 函数设计原则

```typescript
// ✅ 正确：单一职责的纯函数
const calculateTotalPrice = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

// ✅ 正确：使用对象参数（参数>3个时）
interface CreateUserParams {
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

const createUser = (params: CreateUserParams): User => {
  // 实现
};

// ❌ 错误：参数过多
const createUser = (
  name: string,
  email: string,
  role: string,
  department: string,
  avatar?: string
): User => {
  // 实现
};
```

#### 2.3 注释和文档规范

```typescript
/**
 * 计算购物车总价，包含折扣和税费
 * @param items - 购物车商品列表
 * @param discountRate - 折扣率（0-1之间）
 * @returns 最终总价（包含税费）
 * @throws {Error} 当折扣率不在0-1范围时
 * @example
 * ```ts
 * const total = calculateCartTotal([...items], 0.1);
 * console.log(total); // 输出含税后的总价
 * ```
 */
export const calculateCartTotal = (
  items: CartItem[],
  discountRate: number = 0
): number => {
  if (discountRate < 0 || discountRate > 1) {
    throw new Error('Discount rate must be between 0 and 1');
  }

  // 应用折扣后再计算税费，确保税务计算的准确性
  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const discountedTotal = subtotal * (1 - discountRate);
  return discountedTotal * (1 + TAX_RATE);
};
```

### 第三节：错误处理规范

#### 3.1 统一错误处理

```typescript
// ✅ 正确：完整的错误处理
const handleSendMessage = async (message: string) => {
  setMessages(prev => [...prev, { role: 'user', content: message }]);
  setIsLoading(true);

  try {
    const response = await chatService.sendMessage(message);
    setMessages(prev => [...prev, response]);
  } catch (error) {
    // 1. 友好的用户提示
    toast.error('发送失败，请重试');
    
    // 2. 详细的日志记录
    logger.error('Send message failed:', {
      error,
      message,
      userId: user?.id,
      timestamp: new Date().toISOString(),
    });
    
    // 3. 错误上报（生产环境）
    if (process.env.NODE_ENV === 'production') {
      errorReporter.report(error);
    }
  } finally {
    setIsLoading(false);
  }
};

// ❌ 错误：忽略错误
try {
  await somethingRisky();
} catch {
  // 静默失败
}
```

---

## 第三章：4层质量保障机制 🛡️

### 第一层：Pre-commit本地防护 🔒

**触发时机**: `git commit`

**检查项**:
1. ✅ TypeScript类型检查（零错误）
2. ✅ ESLint代码质量检查（零警告）
3. ✅ 重复导出检查
4. ✅ 文件大小检查
5. ✅ Prettier代码格式化

**配置文件**:
- `.husky/pre-commit`
- `.lintstagedrc.js`

```bash
# 正常提交，自动触发检查
git commit -m "feat: your feature"

# 紧急情况跳过（不推荐，需在PR中说明原因）
git commit -m "feat: your feature" --no-verify
```

### 第二层：CI/CD远程门禁 🤖

**GitHub Actions工作流**:

1. **quality-gates.yml** - 零容忍质量门禁
   - TypeScript零错误验证
   - ESLint零警告验证
   - 测试通过率检查
   - 阻止不合格代码合并

2. **ci.yml** - 主CI/CD流水线
   - 多环境构建测试
   - 集成测试运行
   - 部署准备和验证

3. **test-coverage.yml** - 测试覆盖率
   - 单元测试覆盖率≥95%
   - 集成测试覆盖率≥70%
   - 覆盖率报告生成

4. **code-quality-enhanced.yml** - 增强质量监控
   - 实时质量评分
   - PR自动评论改进建议
   - 质量报告上传

### 第三层：持续质量监控 📊

**自动化工具**:

```bash
# 质量仪表板（实时指标）
node scripts/quality-dashboard.js

# 持续质量监控（趋势分析）
node scripts/continuous-quality-monitor.js

# 统一质量门禁检查
node scripts/unified-quality-gates.js
```

**GitHub Actions**:
- `daily-quality-check.yml` - 每日自动审计
- 质量下降时自动创建Issue
- 质量报告保存至 `quality-reports/`

### 第四层：自动化代码审查 🔍

**机制**:

1. **CODEOWNERS自动分配**
   - 按模块分配审查者
   - 确保专业人员审查

2. **PR自动评分系统**
   - 评分范围: 0-100分
   - 自动评论改进建议
   - 显示质量趋势

3. **Dependabot安全扫描**
   - 每周自动检查依赖
   - 自动创建更新PR
   - 安全漏洞告警

---

## 第四章：测试标准 🧪

### 第一节：测试覆盖率要求

| 测试类型 | 覆盖率要求 | 当前状态 |
|---------|-----------|---------|
| 单元测试 | ≥80% | ✅ 95%+ |
| 集成测试 | ≥70% | ✅ 70%+ |
| 关键业务逻辑 | 100% | ✅ 100% |
| 核心API端点 | 100% | ✅ 100% |

### 第二节：测试金字塔

```
    E2E Tests (10%)           # 端到端测试，用户场景验证
   ┌─────────────────┐
  Integration Tests (20%)    # 集成测试，模块间交互
 ┌───────────────────────┐
Unit Tests (70%)            # 单元测试，函数和组件
└─────────────────────────┘
```

### 第三节：测试编写规范

```typescript
// ✅ 正确：清晰的测试结构（AAA模式）
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange - 准备测试数据
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.USER,
      };

      // Act - 执行测试操作
      const user = await userService.createUser(userData);

      // Assert - 验证结果
      expect(user).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const existingUser = await createTestUser();
      const userData = {
        name: 'Jane Doe',
        email: existingUser.email, // 重复邮箱
        role: UserRole.USER,
      };

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already exists');
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
      ];

      // Act & Assert
      for (const email of invalidEmails) {
        await expect(
          userService.createUser({ name: 'Test', email, role: UserRole.USER })
        ).rejects.toThrow('Invalid email format');
      }
    });
  });
});
```

---

## 第五章：用户体验规范 🎨

### 第一节：UI/UX设计原则

#### 1.1 设计系统一致性

- 使用统一的组件库（Radix UI + Tailwind CSS）
- 遵循统一的设计令牌（颜色、字体、间距）
- 保持交互模式一致性
- 响应式设计覆盖所有断点

#### 1.2 交互设计标准

- **即时反馈**: 用户操作后100ms内必须有视觉反馈
- **加载状态**: 所有异步操作必须显示加载状态
- **错误处理**: 友好的错误提示和恢复指导
- **无障碍性**: 符合WCAG 2.1 AA标准

### 第二节：前端性能标准

#### 2.1 性能优化策略

```typescript
// ✅ 正确：性能优化示例
const MessageList = React.memo(({ messages }: MessageListProps) => {
  // 使用useMemo避免重复计算
  const sortedMessages = useMemo(() => {
    return messages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [messages]);

  // 使用虚拟化处理长列表
  return (
    <VirtualizedList
      items={sortedMessages}
      itemHeight={80}
      renderItem={({ item }) => <MessageItem key={item.id} message={item} />}
    />
  );
});

MessageList.displayName = 'MessageList';

// 使用自定义Hook缓存计算结果
const useChatStats = (messages: Message[]) => {
  return useMemo(() => ({
    totalMessages: messages.length,
    lastMessage: messages[messages.length - 1],
    unreadCount: messages.filter(m => !m.read).length,
  }), [messages]);
};
```

#### 2.2 代码分割和懒加载

```typescript
// 路由级别的代码分割
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const CadViewer = lazy(() => import('./components/cad/CadViewer'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'chat', element: <ChatContainer /> },
      {
        path: 'admin',
        element: (
          <Suspense fallback={<Loading />}>
            <AdminDashboard />
          </Suspense>
        ),
      },
      {
        path: 'cad',
        element: (
          <Suspense fallback={<Loading />}>
            <CadViewer />
          </Suspense>
        ),
      },
    ],
  },
]);
```

---

## 第六章：技术决策治理 🏛️

### 第一节：技术选型原则

#### 1.1 评估标准

- **成熟度**: 技术是否经过生产环境验证（⭐⭐⭐⭐⭐）
- **社区活跃度**: 是否有活跃社区支持（GitHub Stars > 10k）
- **学习成本**: 团队掌握技术的时间成本
- **性能表现**: 是否满足项目性能要求
- **生态系统**: 是否有完善工具链和文档
- **License合规**: 开源协议是否符合项目要求

#### 1.2 技术栈标准

**前端**:
- React 18+ + TypeScript 5.0+
- Vite（构建工具）
- Tailwind CSS（样式框架）
- Zustand（状态管理）
- React Router（路由）

**后端**:
- Node.js 18+ + Express + TypeScript
- PostgreSQL（主数据库）
- Redis（缓存）
- Winston（日志）

**测试**:
- Jest（后端单元测试）
- Vitest（前端单元测试）
- Playwright（E2E测试）

### 第二节：架构决策记录（ADR）

#### 2.1 ADR格式规范

```markdown
# ADR-001: 选择Zustand作为状态管理解决方案

## 状态
已接受 | 2025-10-01

## 背景
项目需要选择一个状态管理解决方案来管理复杂的聊天状态和用户会话。

## 决策
选择Zustand作为主要的状态管理库。

## 理由
1. **简单性**: 相比Redux更简洁，学习成本低
2. **TypeScript支持**: 原生支持TypeScript，类型安全性好
3. **性能**: 不需要Provider包装，性能更好
4. **Bundle大小**: 库体积小（~1KB），对打包大小影响小
5. **社区认可**: GitHub Stars 40k+，活跃维护

## 后果
- ✅ 正面：开发效率提高，代码更简洁
- ⚠️ 负面：生态系统相对较小
- 🔍 风险：需要制定迁移计划预案

## 评审
- 提出者: @developer
- 审批者: @tech-lead
- 日期: 2025-10-01
```

### 第三节：代码审查流程

#### 3.1 审查检查清单

```markdown
## 代码审查检查清单

### 功能性 ✅
- [ ] 功能实现符合需求规格
- [ ] 边界条件处理正确
- [ ] 错误处理完善
- [ ] 输入验证到位

### 代码质量 ✅
- [ ] 代码可读性良好
- [ ] 遵循项目编码规范
- [ ] 无代码异味（Code Smells）
- [ ] 适当的注释和文档

### 性能 ✅
- [ ] 无明显性能问题
- [ ] 数据库查询已优化
- [ ] 缓存策略合理
- [ ] 资源使用合理

### 安全性 ✅
- [ ] 输入验证和清理
- [ ] 权限检查正确
- [ ] 无安全漏洞（XSS/SQL注入等）
- [ ] 敏感信息保护

### 测试 ✅
- [ ] 测试覆盖率达标（≥80%）
- [ ] 测试用例合理全面
- [ ] 测试可维护性好
- [ ] E2E测试通过
```

#### 3.2 审查标准

- 每个PR必须至少2人审查（CODEOWNERS自动分配）
- 审查者必须具备相关技术背景
- 审查意见必须具体和可操作
- 作者必须及时响应审查意见（24小时内）
- 严重问题必须修复后才能合并

---

## 第七章：团队协作规范 🤝

### 第一节：Git工作流

#### 1.1 分支策略

```
main (生产分支)
  ├── develop (开发分支)
  │   ├── feature/user-auth (功能分支)
  │   ├── feature/chat-ui (功能分支)
  │   └── bugfix/login-issue (修复分支)
  └── hotfix/security-patch (热修复分支)
```

#### 1.2 提交规范（Conventional Commits）

```bash
# 格式
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# Type类型
feat:     新功能
fix:      Bug修复
docs:     文档更新
style:    代码格式（不影响功能）
refactor: 代码重构
perf:     性能优化
test:     测试相关
build:    构建系统
ci:       CI/CD配置
chore:    其他杂项

# 示例
feat(chat): 添加文件上传功能

- 支持PDF、DOCX、TXT格式
- 添加文件大小限制（10MB）
- 实现文件预览功能

Closes #123
```

### 第二节：协作最佳实践

#### 2.1 PR创建规范

**PR标题**:
```
feat(module): Brief description of changes

Example:
feat(chat): Add real-time typing indicators
fix(auth): Resolve JWT token refresh issue
docs(api): Update API documentation for v2
```

**PR描述模板**:
```markdown
## 📝 变更描述
简要说明本次PR的目的和主要变更内容。

## 🎯 相关Issue
Closes #123
Related to #456

## 🧪 测试
- [ ] 单元测试已添加/更新
- [ ] 集成测试已添加/更新
- [ ] E2E测试已添加/更新
- [ ] 手动测试已完成

## 📷 截图（如适用）
[添加UI变更的截图]

## ⚠️ 注意事项
[需要特别注意的地方，如配置变更、数据库迁移等]

## ✅ 检查清单
- [ ] 代码符合项目规范
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 无TypeScript错误
- [ ] 无ESLint警告
```

#### 2.2 沟通规范

- **代码评论**: 专业、建设性、具体
- **Issue讨论**: 清晰、完整、及时
- **文档更新**: 同步、准确、详细
- **知识分享**: 主动、开放、系统

---

## 第八章：持续改进机制 📈

### 第一节：质量监控

#### 1.1 实时监控

```bash
# 查看实时质量指标
node scripts/quality-dashboard.js

# 持续质量监控
node scripts/continuous-quality-monitor.js
```

#### 1.2 质量报告

- **位置**: `quality-reports/`
- **保留期**: 90天
- **格式**: JSON
- **频率**: 每次CI运行 + 每日自动

### 第二节：改进流程

#### 2.1 定期回顾

- **Sprint回顾**: 每个迭代结束（2周）
- **月度回顾**: 评估技术方向和团队表现
- **季度回顾**: 制定技术规划和能力提升
- **年度回顾**: 长期技术规划和架构演进

#### 2.2 改进措施跟踪

```markdown
## 改进措施清单

| ID | 改进内容 | 负责人 | 计划完成 | 状态 | 效果评估 |
|----|---------|--------|---------|------|---------|
| IMP-001 | 优化API响应时间 | @dev | 2025-11-20 | ✅ 完成 | P95从300ms降至150ms |
| IMP-002 | 提升测试覆盖率 | @qa | 2025-11-25 | 🔄 进行中 | 从85%提升至95% |
```

### 第三节：技术创新

#### 3.1 创新评估流程

1. **提出想法** - 任何团队成员可提出创新建议
2. **可行性评估** - 技术负责人评估可行性
3. **原型开发** - 开发概念验证原型
4. **价值评估** - 评估业务价值和影响
5. **生产实施** - 通过后纳入生产环境

#### 3.2 技术前瞻

- 关注行业技术趋势
- 定期评估技术栈更新
- 参与开源社区
- 内部技术分享会

---

## 第九章：安全规范 🔐

### 第一节：安全原则

#### 1.1 核心安全要求

- ✅ **输入验证**: 所有用户输入必须验证和清理
- ✅ **输出编码**: 防止XSS攻击
- ✅ **认证授权**: JWT + RBAC权限控制
- ✅ **安全传输**: HTTPS + 加密存储
- ✅ **依赖安全**: 定期扫描和更新
- ✅ **日志脱敏**: 不记录敏感信息

#### 1.2 安全检查

```bash
# 依赖安全扫描
pnpm audit

# 代码安全扫描
npm run security:audit

# 定期更新（Dependabot自动）
# 查看 .github/dependabot.yml
```

### 第二节：敏感信息管理

#### 2.1 环境变量管理

```bash
# ✅ 正确：使用环境变量
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your-super-secret-key
API_KEY=your-api-key

# ❌ 错误：硬编码
const apiKey = 'sk-1234567890abcdef';
```

#### 2.2 密钥管理

- **开发环境**: `.env.local`（不提交到Git）
- **生产环境**: 环境变量或密钥管理服务
- **轮换策略**: 定期更换密钥
- **最小权限**: 每个服务只获取必需的密钥

---

## 第十章：宪法执行与监督 ⚖️

### 第一节：执行机制

#### 1.1 自动化执行

**Pre-commit Hooks**:
- 自动运行质量检查
- 阻止不合格代码提交

**CI/CD Pipeline**:
- 自动运行完整测试套件
- 质量门禁强制执行
- 不合格代码无法合并

**定期审计**:
- 每日质量检查
- 每周安全扫描
- 每月技术债务评估

#### 1.2 质量监督

**监督委员会**:
- 技术负责人
- 质量保证工程师
- 资深开发工程师

**职责**:
- 定期审查项目质量
- 处理质量违规
- 提出改进建议
- 更新质量标准

### 第二节：问责与奖励

#### 2.1 违规处理

**轻微违规** (如偶尔跳过pre-commit):
- 记录并提醒
- 团队内部分享经验教训

**重复违规**:
- 强制参加代码质量培训
- 限制代码合并权限

**严重违规** (如绕过CI直接合并):
- 影响绩效评估
- 可能撤销代码提交权限

#### 2.2 优秀表现奖励

- 代码质量标兵
- 月度最佳PR
- 技术创新贡献
- 知识分享贡献

### 第三节：宪法修订

#### 3.1 修订提案流程

1. **提出**: 任何团队成员可提出修订建议
2. **讨论**: 团队内部充分讨论
3. **投票**: 根据修订级别决定表决规则
4. **实施**: 通过后立即生效
5. **培训**: 更新培训材料和文档

#### 3.2 表决规则

| 修订级别 | 示例 | 表决要求 |
|---------|------|---------|
| 一般修订 | 调整代码规范细节 | 2/3团队成员同意 |
| 重大修订 | 更换技术栈 | 3/4团队成员同意 |
| 核心原则 | 修改核心价值观 | 全体一致同意 |

---

## 附录A：快速参考 📚

### 常用命令

```bash
# 质量检查
pnpm run type-check        # TypeScript检查
pnpm run lint              # ESLint检查
pnpm test                  # 运行测试
pnpm run build             # 构建项目

# 质量监控
node scripts/quality-dashboard.js           # 质量仪表板
node scripts/continuous-quality-monitor.js  # 持续监控

# 开发
pnpm run dev              # 启动开发服务器
pnpm run backend:dev      # 仅后端
pnpm run frontend:dev     # 仅前端
```

### 关键文档索引

- [CLAUDE.md](./CLAUDE.md) - AI助手配置与开发规范
- [QUALITY_SYSTEM_GUIDE.md](./QUALITY_SYSTEM_GUIDE.md) - 质量保障体系
- [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) - 开发指南
- [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) - 部署指南

### 质量指标快速查看

```bash
# 当前项目状态
TypeScript错误: 0个 ✅
ESLint问题: 0个 ✅
测试覆盖率: 95%+ ✅
质量等级: A+ (卓越) 🌟
```

---

## 附录B：联系方式 📞

### 技术负责人

- **姓名**: [待填写]
- **邮箱**: [待填写]
- **职责**: 技术决策、架构设计

### 质量负责人

- **姓名**: [待填写]
- **邮箱**: [待填写]
- **职责**: 质量标准制定和监督

### 运维负责人

- **姓名**: [待填写]
- **邮箱**: [待填写]
- **职责**: 部署运维、性能监控

### 安全负责人

- **姓名**: [待填写]
- **邮箱**: [待填写]
- **职责**: 安全审计、漏洞修复

---

## 🎯 结语

本宪法是LLMChat项目对高质量软件工程的承诺。通过严格遵循这些原则和标准，我们能够：

1. **交付卓越产品** - 满足用户需求和期望
2. **提升技术能力** - 团队持续学习和成长
3. **建立技术品牌** - 赢得用户和市场认可
4. **实现可持续发展** - 技术和团队双重提升

每一位团队成员、贡献者和AI助手都有责任和义务遵守本宪法，并在实践中不断完善和优化。

**让我们共同努力，打造世界级的AI聊天平台！** 🚀

---

**制定日期**: 2025-11-11  
**版本**: v2.0.0  
**下次评审日期**: 2026-02-11  
**维护者**: LLMChat开发团队

---

*本宪法由LLMChat项目团队共同制定并维护。*  
*如有疑问或建议，请通过Issue或PR提出。*

---

## 变更日志 📝

### v2.0.0 (2025-11-11)
- ✅ 整合三个核心文档内容
- ✅ 建立统一的项目宪法
- ✅ 更新质量标准和流程
- ✅ 完善安全规范
- ✅ 优化文档结构和可读性

### v1.0.0 (2025-10-13)
- ✅ 初始版本发布
- ✅ 建立基础技术宪法

