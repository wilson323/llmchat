# 快速行动清单

> 一页纸总览：最需要做的事情
> 生成时间：2025-10-04

---

## 🔥 本周必做（P0级，13-20小时）

### 1. 日志规范化 ⏱️ 4-6小时
**为什么**：692处console.log影响生产环境问题排查
**怎么做**：
```bash
# 1. 创建logger封装
# 2. 全局替换console → logger
# 3. 配置生产日志级别
```
**预期收益**：立即改善可观测性

---

### 2. 清理未使用代码 ⏱️ 1-2小时
**为什么**：代码冗余，维护成本高
**怎么做**：
```bash
# 1. 运行 npm run lint 找出未使用变量
# 2. 删除所有注释的导入
# 3. 清理 .legacy 文件

git rm frontend/src/hooks/useChat.legacy.ts
git rm frontend/src/components/chat/ChatContainer.legacy.tsx
```
**预期收益**：代码更清爽

---

### 3. TypeScript类型安全（第一批）⏱️ 4-6小时
**为什么**：293处any类型是技术债务根源
**怎么做**：
```typescript
// 优先修复API层
// frontend/src/services/api.ts

// ❌ 当前
const callback = (data: any) => { ... }

// ✅ 改为
interface SSEEvent {
  event: string;
  data: string | Record<string, unknown>;
}
const callback = (data: SSEEvent) => { ... }
```
**预期收益**：减少运行时错误

---

## 📅 下周计划（P1级，14-20小时）

### 4. 键盘快捷键实现 ⏱️ 6-8小时
**待实现**：10个快捷键（新建对话、发送消息、切换会话等）
**位置**：`frontend/src/hooks/useKeyboardManager.ts`

### 5. 前端性能优化 ⏱️ 4-6小时
**核心**：启用VirtualizedMessageList替代MessageList
**收益**：长列表渲染速度提升90%

### 6. 依赖包更新 ⏱️ 4-6小时
**目标**：修复deprecated警告（eslint、glob、rimraf）
**方法**：逐个更新并测试

---

## 🎯 长期改进（P2级，持续进行）

### 7. 测试覆盖率提升
**现状**：前端2个测试，后端10个
**目标**：补充核心模块单元测试
**工时**：12-16小时

### 8. 配置文件治理
**目标**：清理agents.json废弃配置，添加快照校验
**工时**：3-4小时

---

## ⚠️ 不建议做的事

- ❌ 完全重构Store架构（现有足够稳定）
- ❌ 引入GraphQL（REST API满足需求）
- ❌ 100%测试覆盖率（边际收益递减）
- ❌ 消息IndexedDB缓存（增加复杂度）

---

## 📊 执行顺序

```
Week 1 (P0)
├─ Day 1-2: 日志规范化 ✅
├─ Day 3:   清理未使用代码 ✅
└─ Day 4-5: TypeScript修复（API层）✅

Week 2 (P1)
├─ Day 1-2: 键盘快捷键 ✅
├─ Day 3-4: 性能优化 ✅
└─ Day 5:   依赖更新 ✅

Week 3-4 (持续)
├─ TypeScript修复（Store、组件层）
└─ 测试覆盖率提升
```

---

## 🚀 快速启动命令

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 创建功能分支
git checkout -b optimize/week1-p0-tasks

# 3. 运行测试确保通过
npm test

# 4. 开始优化
# ...

# 5. 提交前检查
npm run lint
npm run frontend:type-check
npm test

# 6. 提交
git add .
git commit -m "refactor: 日志规范化与代码清理"
git push
```

---

## 📈 成功指标（1个月目标）

- [ ] TypeScript `any`类型：293 → <50
- [ ] Console日志：692 → <10  
- [ ] 测试覆盖率：<20% → >40%
- [ ] 键盘快捷键：10个全部实现
- [ ] 长列表渲染：<100ms

---

## 📞 需要帮助？

查看详细文档：
- 完整待办事项：`CODE_REVIEW_TODOS.md`
- 优先级矩阵：`OPTIMIZATION_PRIORITY_MATRIX.md`
- 项目规范：`.cursor/rules/`

---

**关键原则**：不过度优化，聚焦高ROI任务，分批执行，持续改进。
