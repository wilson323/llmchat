# 测试覆盖率95%+ 快速指南

**快速启动**: 5分钟开始测试  
**目标**: 达到95%+测试覆盖率

---

## 🚀 立即开始（5分钟）

### 1. 运行现有测试

```bash
cd backend
pnpm test
```

### 2. 生成覆盖率报告

```bash
pnpm run test:coverage
```

### 3. 查看覆盖率报告

```bash
# Windows
start coverage/index.html

# 或手动打开
backend/coverage/index.html
```

---

## 📊 当前状态

### 已完成工作

✅ **Phase 0-2: 完成**
- 175个测试用例已创建
- Mock基础设施完整
- Auth/Chat/Agent模块测试完成
- 预期核心模块覆盖率≥90%

### 测试文件位置

**单元测试**:
```
backend/src/__tests__/unit/
├── controllers/
│   ├── authController.test.ts (23用例)
│   ├── chatController.test.ts (15用例)
│   └── agentController.test.ts (10用例)
├── services/
│   ├── authService.test.ts (43用例)
│   ├── chatService.test.ts (28用例)
│   └── agentService.test.ts (13用例)
└── middleware/
    └── jwtAuth.test.ts (14用例)
```

**集成测试**:
```
backend/src/__tests__/integration/
├── auth.integration.test.ts (14用例)
├── chat.integration.test.ts (8用例)
└── agent.integration.test.ts (7用例)
```

---

## 🎯 下一步（待执行）

### Phase 3: E2E测试 (4小时)

```bash
# 1. 添加前端测试ID
cd frontend/src/components

# 在关键组件添加 data-testid
<button data-testid="login-button">登录</button>

# 2. 运行E2E测试
cd ../../..
pnpm run test:e2e
```

### Phase 4: 边界测试 (4小时)

```bash
# 运行特定测试
pnpm test -- --testPathPattern=error
pnpm test -- --testPathPattern=security
```

### Phase 5: CI/CD (2小时)

```bash
# 配置GitHub Actions
# 查看: .github/workflows/test-coverage.yml

# 本地验证CI流程
pnpm run test:ci
```

---

## 📈 覆盖率目标

| 当前 | 目标 | 差距 |
|------|------|------|
| ~65% | ≥95% | 30% |

**路径**:
1. Phase 2完成 → 80%
2. Phase 3-4完成 → 90%
3. Phase 5+冲刺 → 95%+

---

## 🆘 常见问题

### Q1: 测试运行失败？

```bash
# 检查数据库
psql -U postgres -d llmchat_test -c "SELECT 1"

# 检查Redis
redis-cli ping

# 清理并重试
rm -rf coverage .nyc_output
pnpm test
```

### Q2: 覆盖率不准确？

```bash
# 清理缓存
rm -rf coverage .nyc_output node_modules/.cache

# 重新运行
pnpm run test:coverage
```

### Q3: TypeScript错误？

```bash
# 类型检查
pnpm run type-check

# 修复后重新测试
pnpm test
```

---

## 📚 相关文档

- **完整计划**: `.specify/plans/p3-test-coverage-95-plan.md`
- **研究报告**: `.specify/plans/research.md`
- **快速启动**: `.specify/plans/quickstart.md`
- **执行报告**: `docs/TEST-COVERAGE-95-EXECUTION-REPORT.md`

---

## ✅ 检查清单

### 今天必做

- [ ] 运行测试验证
- [ ] 查看覆盖率报告
- [ ] 修复失败测试（如有）

### 本周必做

- [ ] 完成E2E测试增强
- [ ] 完成边界和安全测试
- [ ] 配置CI/CD
- [ ] 达到95%+覆盖率

---

**更新时间**: 2025-10-17 00:15  
**状态**: ✅ Phase 0-2完成，Phase 3-5待执行


