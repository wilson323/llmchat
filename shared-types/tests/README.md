# 类型系统测试套件

本目录包含了 LLMChat 统一类型系统的完整测试套件，确保类型定义的正确性和可靠性。

## 📋 测试结构

```
tests/
├── utils/                   # 工具函数测试
│   └── guards.test.ts      # 类型守卫测试
├── entities/                # 实体类型测试
│   ├── agent.test.ts       # Agent 实体测试
│   ├── message.test.ts     # Message 实体测试
│   ├── session.test.ts     # Session 实体测试
│   └── user.test.ts        # User 实体测试
├── components/              # 组件类型测试
│   └── ui.test.ts          # UI 组件类型测试
├── api/                     # API 类型测试
│   ├── requests.test.ts    # 请求类型测试
│   └── responses.test.ts   # 响应类型测试
├── providers/               # 提供商类型测试
│   └── base.test.ts        # 基础提供商测试
├── setup.ts                 # 测试环境设置
└── README.md               # 测试文档
```

## 🚀 运行测试

### 安装依赖
```bash
npm install
```

### 运行所有测试
```bash
npm test
```

### 运行特定测试文件
```bash
npm test -- tests/utils/guards.test.ts
```

### 监视模式
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

### CI 环境测试
```bash
npm run test:ci
```

## 📊 测试覆盖范围

### 类型守卫测试 (`utils/guards.test.ts`)
- ✅ 基础类型守卫（字符串、数字、布尔值、对象、数组、日期、函数）
- ✅ JSON 类型守卫（JsonValue、UnknownValue）
- ✅ 实体类型守卫（Agent、AgentConfig、StandardMessage、SimpleMessage、ChatSession、User）
- ✅ 枚举类型守卫（AgentStatus、ProviderType、MessageRole、UserRole、UserStatus、AuthProvider）
- ✅ 边界情况和错误处理（null/undefined、类型转换、循环引用）
- ✅ 性能测试（大量数据处理）

### 类型转换器测试 (`utils/converters.test.ts`)
- ✅ MessageConverter（标准消息 ↔ 简化消息转换）
- ✅ TypeSafeConverter（安全类型转换）
- ✅ DynamicConverter（动态数据转换）
- ✅ DateConverter（日期格式转换）
- ✅ AgentConverter（Agent 实体转换）
- ✅ SessionConverter（会话数据转换）
- ✅ 双向转换测试和边界情况处理

### 实体类型测试 (`entities/`)
- ✅ Agent 类型测试（agent.test.ts）
  - 基础 Agent 接口验证
  - AgentConfig 配置管理
  - 类型约束和验证
  - 元数据处理和时间戳处理
  - 类型转换和序列化
  - 边界情况测试

- ✅ Message 类型测试（message.test.ts）
  - StandardMessage 和 SimpleMessage 验证
  - MessageMetadata 处理
  - MessageAttachment 支持
  - StreamChunk 流式数据处理
  - 消息转换和验证
  - 性能测试

### UI 组件测试 (`components/ui.test.ts`)
- ✅ BaseComponentProps 基础属性
- ✅ ButtonProps 按钮组件属性
- ✅ InputProps 输入框组件属性
- ✅ ModalProps 模态框组件属性
- ✅ CardProps 卡片组件属性
- ✅ AgentSelectorProps 智能体选择器属性
- ✅ MessageInputProps 消息输入框属性
- ✅ 主题和样式支持
- ✅ 可访问性属性
- ✅ 响应式设计和性能优化

### API 响应测试 (`api/responses.test.ts`)
- ✅ ApiSuccessResponse 成功响应
- ✅ ApiErrorResponse 错误响应
- ✅ PaginatedResponse 分页响应
- ✅ 专门化响应类型（ListResponse、DetailResponse、CreateResponse 等）
- ✅ 错误专门化响应（ValidationErrorResponse、RateLimitResponse）
- ✅ HealthCheckResponse 健康检查响应
- ✅ 响应序列化和性能测试

### 提供商基础测试 (`providers/base.test.ts`)
- ✅ BaseProvider 基础提供商接口
- ✅ ProviderConfig 配置管理
- ✅ ProviderValidationResult 验证结果
- ✅ ChatRequest 和 ChatResponse 聊天请求响应
- ✅ ProviderMetrics 指标收集
- ✅ ProviderCapabilities 能力定义
- ✅ ProviderStatus 状态管理
- ✅ ModelConfig 模型配置
- ✅ 提供商工厂模式和集成测试

## 🎯 测试策略

### 单元测试原则
1. **隔离性**：每个测试独立运行，不依赖其他测试的状态
2. **可重复性**：测试结果应该是一致的和可重复的
3. **快速执行**：单元测试应该快速执行，适合频繁运行
4. **清晰断言**：使用明确的断言信息，便于理解测试意图

### 测试覆盖目标
- **语句覆盖**：100%（所有代码行都被执行）
- **分支覆盖**：>90%（所有条件分支都被测试）
- **函数覆盖**：100%（所有函数都被调用）
- **行覆盖**：>80%（与 TypeScript 配置对齐）

### 模拟策略
1. **最小化模拟**：只模拟必要的依赖
2. **真实数据**：使用真实的数据结构进行测试
3. **边界条件**：重点测试边界情况和异常情况
4. **性能考虑**：包含性能相关的测试用例

## 🔧 测试工具

### Jest 配置
- 使用 ts-jest 进行 TypeScript 支持
- 配置模块路径映射（@/ 别名）
- 设置覆盖率阈值和报告格式
- 支持 CI/CD 集成

### 测试工具函数
- `createMockAgent()`：创建模拟 Agent 对象
- `createMockMessage()`：创建模拟消息对象
- `createMockUser()`：创建模拟用户对象
- `createMockApiResponse()`：创建模拟 API 响应
- `flushPromises()`：等待所有 Promise 完成
- `delay()`：模拟延迟

### 模拟环境
- 模拟浏览器 API（localStorage、sessionStorage、fetch 等）
- 模拟 Node.js 环境（crypto、performance 等）
- 模拟 React 环境（ResizeObserver、IntersectionObserver 等）

## 📈 质量保证

### 代码覆盖率
```bash
npm run test:coverage
```
覆盖率报告将生成在 `coverage/` 目录中，包含：
- HTML 格式的详细报告
- 文本格式的摘要报告
- LCov 格式的报告文件
- JSON 格式的原始数据

### 类型检查
```bash
npm run type-check
```
确保所有 TypeScript 类型定义正确无误。

### 代码质量检查
```bash
npm run lint
```
确保代码符合项目的 ESLint 规则。

## 🐛 调试测试

### 调试单个测试
```bash
npm test -- --testNamePattern="should accept valid Agent object"
```

### 详细输出
```bash
npm test -- --verbose
```

### 调试模式
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📝 最佳实践

### 测试命名
- 使用描述性的测试名称
- 遵循 "should/when" 模式
- 包含测试的上下文和期望结果

### 测试结构
```typescript
describe('功能模块', () => {
  describe('子功能', () => {
    it('应该执行特定行为', () => {
      // 准备
      // 执行
      // 断言
    });
  });
});
```

### 断言策略
- 使用具体的期望值
- 测试边界条件
- 验证错误情况
- 检查副作用

## 🚀 持续集成

测试套件设计为与 CI/CD 流水线无缝集成：

### GitHub Actions
```yaml
- name: Run Tests
  run: npm run test:ci
- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

### 测试报告
- JUnit XML 格式：`coverage/junit.xml`
- 覆盖率报告：`coverage/lcov.info`
- HTML 报告：`coverage/lcov-report/index.html`

## 🔄 维护指南

### 添加新测试
1. 在适当的目录中创建测试文件
2. 遵循现有的测试结构和命名约定
3. 确保测试覆盖所有边界情况
4. 更新相关文档

### 更新现有测试
1. 保持测试的独立性
2. 确保模拟数据的一致性
3. 验证所有相关的测试用例
4. 更新覆盖率目标

### 性能优化
1. 定期检查测试执行时间
2. 优化慢速测试用例
3. 使用适当的模拟策略
4. 并行化独立的测试

---

**注意**：此测试套件是 LLMChat 统一类型系统质量保证的重要组成部分。请定期运行测试并保持高覆盖率标准。