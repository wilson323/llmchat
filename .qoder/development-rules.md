# Qoder开发规则 - Speckit集成版

## 📋 核心开发原则

### 1. TypeScript架构规范

**单一真理源原则**：

- ✅ `ui.types.ts` - UI组件类型的唯一权威源
- ✅ `types.unified.ts` - 仅作转发层，不定义新类型
- ❌ 禁止创建冗余types.ts、\*.backup文件
- ❌ 禁止组件内部重复定义接口

**类型/值严格分离**：

```typescript
// ✅ 正确
export type { ButtonProps, CardProps } from './ui.types';
export { Button, Card } from './components';

// ❌ 错误
export { ButtonProps } from './ui.types'; // Interface用export type
export type { Button } from './components'; // Class用export
```

**零容忍类型错误政策**：

- 🔴 **严禁**任何 TypeScript 编译错误进入主分支
- 🔴 **严禁**使用 `any` 类型，必须使用明确的类型定义
- 🔴 **严禁**绕过 TypeScript 类型检查（如 `@ts-ignore`）

### 2. P0错误零容忍政策

**立即修复的错误类型**：

- TS2484 - 重复导出冲突
- TS2323 - 重复声明
- TS1361 - 类型/值混用
- TS1205 - isolatedModules错误

**修复流程**：

1. 识别P0错误 → 立即停止其他工作
2. 根本原因分析 → 查看TYPESCRIPT_ARCHITECTURE_STANDARDS.md
3. 架构层面修复 → 不是表面修复
4. 验证编译通过 → 确保零错误

### 3. UI组件开发规范

**复合组件模式**：

```typescript
// ✅ 正确：子组件附加模式
const Card = attachSubComponents(CardImpl, {
  Header: createSubComponent('Card.Header', CardHeader),
  Title: createSubComponent('Card.Title', CardTitle),
  Content: createSubComponent('Card.Content', CardContent),
});

export default Card;

// ✅ 正确：使用方式
import Card from '@/components/ui/Card';
<Card>
  <Card.Header>
    <Card.Title>标题</Card.Title>
  </Card.Header>
  <Card.Content>内容</Card.Content>
</Card>

// ❌ 错误：Named import
import { CardHeader, CardTitle } from '@/components/ui/Card';
```

### 4. 事件处理器统一规范

**权威类型定义**：

```typescript
// 从权威文件导入
import {
  ChangeEventHandler,
  ClickEventHandler,
  adaptEventHandler,
} from '@/types/event-handlers';

interface MyComponentProps {
  onChange?: ChangeEventHandler<string>;
  onClick?: ClickEventHandler<void>;
}
```

### 5. 生产环境优化原则 (YAGNI)

**You Aren't Gonna Need It**：

- ❌ 删除开发专用功能：复杂图表、性能基准测试、演示代码
- ❌ 移除过度工程化：复杂验证器工厂、类型系统抽象
- ✅ 保留核心功能：基础监控、核心UI组件、业务逻辑

### 6. 企业级代码安全准则

**严格禁止的危险操作**：

- ❌ 使用正则表达式替换代码 - 绝对禁止使用 `.replace(/regex/, replacement)`
  修改源代码
- ❌ 动态构造正则表达式 - 绝对禁止 `new RegExp(userInput)` 用于代码处理
- ❌ 使用sed/awk进行代码修改 - 绝对禁止使用命令行工具修改代码文件
- ❌ 使用字符串替换修改结构化数据 - 必须使用专门的解析器
- ❌ 企业级自动修复 - 所有修复必须经过影响分析和人工确认
- ❌ 脚本批量修改代码 - 绝对禁止通过任何脚本工具批量修改源代码，所有代码修改必须手动进行

**企业级安全替代方案**：

- ✅ AST优先修复: 使用TypeScript编译器API进行精确的AST操作
- ✅ 类型安全修复: 使用专门的类型检查和修复工具
- ✅ 配置文件: 使用专门的配置解析库（如dotenv、config等）
- ✅ 代码重构: 使用企业级AST解析器进行代码变换
- ✅ 文本处理: 仅限用于日志处理和数据清理，不用于代码修改
- ✅ 手动代码修改原则: 所有源代码修改必须通过手动编辑进行，确保每次修改都经过充分的人工审查和验证

## 🧪 Speckit规范集成

### 1. 文档职责边界 (遵循.specify/standards/document-structure.md)

**需求文档 (requirements.md)**:

- 职责: WHAT（做什么）
- 内容: 功能需求(FR-xxx)、非功能需求(NFR-xxx)、用户故事(US-xxx)
- 禁止: 实现细节、工具选择、任务分解

**设计文档 (design.md)**:

- 职责: HOW（怎么做）
- 内容: 系统架构图、模块设计、接口定义、技术选型理由
- 禁止: 需求描述、任务清单

**任务文档 (tasks.md)**:

- 职责: WHO + WHEN（谁做、何时做）
- 内容: 任务分解、依赖关系、时间估算、优先级
- 禁止: 需求定义、技术实现细节

### 2. 单一真实来源原则 (遵循.specify/standards/ssot-index.md)

**技术细节文档 (technical-details.md)**:

- 职责: 技术参数的权威定义
- 内容: JWT配置、密码哈希参数、数据库连接参数、缓存TTL配置
- 引用方式: 其他文档使用`[详见技术规范](technical-details.md#section)`

**术语表文档 (terminology.md)**:

- 职责: 术语的权威定义
- 内容: 中英术语对照表、代码命名规范、状态术语定义
- 引用方式: 文档首次使用术语时引用此表

**错误代码文档 (api-error-codes.md)**:

- 职责: 错误代码的权威定义
- 内容: 错误响应格式、HTTP状态码映射、错误代码清单
- 引用方式: 代码中使用错误代码时参考此文档

### 3. 文档同步规则

**变更影响矩阵**: | 修改文档 | 必须检查 | 原因 | |---------|---------|------| |
requirements.md | design.md, tasks.md | 需求变更影响设计和任务 | | design.md |
tasks.md | 设计调整可能改变任务分解 | | technical-details.md
| 所有引用它的文档 | 技术参数是单一来源 | | terminology.md
| 所有文档 | 术语变更影响全局 |

**同步检查点**:

1. 需求确认后: requirements.md完成, design.md设计对齐, tasks.md覆盖100%需求
2. 设计评审后: design.md锁定,
   tasks.md依赖关系明确, 技术选型写入technical-details.md
3. 开发开始前: 所有文档版本号同步, 所有引用链接有效, 运行自动化验证工具

## 🚀 开发工作流

### 代码提交前检查清单

#### 类型安全检查

- [ ] TypeScript编译无错误 (`pnpm run type-check`)
- [ ] ESLint检查通过 (`pnpm run lint`)
- [ ] 无P0架构错误

#### 架构合规检查

- [ ] 无冗余类型文件
- [ ] 类型/值正确分离
- [ ] 复合组件使用default export
- [ ] 事件处理器从权威定义导入

#### Speckit文档合规检查

- [ ] 需求、设计、任务文档职责分离清晰
- [ ] 技术细节在technical-details.md中定义
- [ ] 术语在terminology.md中定义
- [ ] 错误代码在api-error-codes.md中定义
- [ ] 所有引用链接有效

#### 企业级安全检查

- [ ] 无正则表达式代码替换
- [ ] 无动态构造正则表达式
- [ ] 无sed/awk代码修改
- [ ] 无脚本批量修改代码
- [ ] 所有代码修改均为手动进行

#### 功能完整性检查

- [ ] 核心业务功能正常
- [ ] UI组件渲染正确
- [ ] 无开发专用代码泄露

### 自动化检查命令

```bash
# 每日开发必运行
pnpm run type-check     # TypeScript编译检查
pnpm run lint          # 代码质量检查
pnpm run build         # 构建验证

# Speckit文档验证
npm run validate:docs:consistency   # 一致性检查
npm run validate:docs:coverage      # 覆盖率检查
npm run validate:docs:references    # 引用完整性检查
npm run validate:docs:ambiguity     # 模糊术语检查

# 企业级安全检查
pnpm run security:audit    # 安全审计
pnpm run security:check    # 提交前安全检查
pnpm run enterprise:fix    # 企业级安全代码修复工具

# 架构合规检查
find frontend/src -name "*.backup" -o -name "types.ts" | grep -v "ui.types.ts\|types.unified.ts"

# P0错误检查
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(TS2484|TS2323|TS1361|TS1205)"
```

## 📚 参考文档

- **架构标准**: `frontend/TYPESCRIPT_ARCHITECTURE_STANDARDS.md`
- **项目配置**: `CLAUDE.md`
- **动态端口**: `scripts/find-backend-port.js`
- **Speckit规范**: `.specify/standards/`
- **Speckit验证工具**: `scripts/spec-validation/`

## ⚠️ 重要提醒

1. **禁止治标不治本** - 必须从架构层面解决问题
2. **严格遵循规范** - 不允许偏离TYPESCRIPT_ARCHITECTURE_STANDARDS.md
3. **零错误政策** - P0错误必须立即修复
4. **YAGNI原则** - 避免过度工程化，专注核心功能
5. **Speckit合规** - 严格遵循文档职责边界和单一真实来源原则
6. **企业级安全** - 严格遵守企业级代码安全准则，禁止危险操作

---

**版本**: v1.0.0 **创建日期**: 2025-10-19 **维护者**: LLMChat开发团队
