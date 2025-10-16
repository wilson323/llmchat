# 测试覆盖率提升快速启动指南

**目标**: 30分钟内启动测试覆盖率提升项目  
**适用人员**: 开发团队成员  
**前置要求**: Node.js 18+, PostgreSQL 14+, pnpm

---

## 🚀 快速开始（5分钟）

### Step 1: 环境检查

```bash
# 验证工具版本
node --version    # 应该 ≥18
pnpm --version    # 应该 ≥8
psql --version    # 应该 ≥14

# 进入项目目录
cd F:\ss\aa\sssss\llmchat
```

### Step 2: 安装依赖

```bash
# 安装测试相关依赖（如果未安装）
pnpm add -D c8 @types/jest

# 验证Jest已安装
pnpm list jest
```

### Step 3: 创建测试数据库

```powershell
# Windows PowerShell
# 创建测试数据库
createdb -U postgres llmchat_test

# 验证数据库创建
psql -U postgres -l | findstr llmchat_test
```

### Step 4: 配置环境变量

```powershell
# 创建测试环境配置
Copy-Item backend\.env backend\.env.test

# 编辑.env.test，修改数据库连接
# DATABASE_URL=postgresql://postgres:123456@localhost:5432/llmchat_test
```

### Step 5: 运行基础测试

```bash
# 进入后端目录
cd backend

# 运行现有测试
pnpm test

# 查看覆盖率
pnpm run test:coverage
```

**预期输出**:
```
Test Suites: 37 passed, 24 failed, 61 total
Tests:       469 passed, 90 failed, 559 total
Coverage:    ~65%
```

---

## 📊 验证当前状态（10分钟）

### 检查1: 测试套件状态

```bash
# 查看详细测试结果
pnpm test -- --verbose

# 导出测试报告
pnpm test -- --json --outputFile=test-results.json
```

### 检查2: 覆盖率分析

```bash
# 生成HTML覆盖率报告
pnpm run test:coverage

# 打开报告（Windows）
start coverage/index.html
```

### 检查3: 识别问题

```bash
# 查看失败的测试
pnpm test -- --onlyFailures

# 分析失败原因
cat test-results.json | findstr "FAIL"
```

---

## 🔧 修复环境问题（10分钟）

### 问题1: 数据库连接失败

**症状**: `Error: connect ECONNREFUSED`

**解决方案**:
```bash
# 1. 检查PostgreSQL服务
sc query postgresql-x64-14

# 2. 启动服务（如果未运行）
sc start postgresql-x64-14

# 3. 验证连接
psql -U postgres -d llmchat_test -c "SELECT 1"
```

### 问题2: TypeScript编译错误

**症状**: `error TS2305: Module has no exported member`

**解决方案**:
```bash
# 1. 清理构建缓存
Remove-Item -Recurse -Force dist, node_modules\.cache

# 2. 重新编译
pnpm run build

# 3. 运行类型检查
pnpm run type-check
```

### 问题3: Jest配置问题

**症状**: `Cannot find module '@/...'`

**解决方案**:
```bash
# 验证jest.config.ts配置
cat backend/jest.config.ts | findstr "moduleNameMapper"

# 应该包含:
# moduleNameMapper: {
#   '^@/(.*)$': '<rootDir>/src/$1'
# }
```

---

## 📝 配置覆盖率工具（5分钟）

### 安装c8

```bash
# 安装c8
pnpm add -D c8

# 创建配置文件
```

创建 `backend/.c8rc.json`:
```json
{
  "all": true,
  "include": ["src/**/*.ts"],
  "exclude": [
    "**/*.test.ts",
    "**/__tests__/**",
    "**/node_modules/**",
    "**/*.d.ts"
  ],
  "reporter": ["html", "text", "lcov"],
  "check-coverage": true,
  "lines": 95,
  "functions": 95,
  "branches": 90,
  "statements": 95,
  "report-dir": "./coverage",
  "temp-directory": "./.nyc_output"
}
```

### 更新package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "c8 npm test",
    "test:watch": "jest --watch",
    "test:ci": "c8 --check-coverage npm test",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:report": "c8 report --reporter=html"
  }
}
```

### 测试配置

```bash
# 运行带覆盖率的测试
pnpm run test:coverage

# 验证覆盖率检查
pnpm run test:ci
```

**预期输出**:
```
=============================== Coverage summary ===============================
Statements   : 65% ( 450/692 )
Branches     : 60% ( 120/200 )
Functions    : 70% ( 140/200 )
Lines        : 65% ( 430/660 )
================================================================================
ERROR: Coverage for lines (65%) does not meet global threshold (95%)
```

---

## 🎯 执行第一个修复（5分钟）

### 修复示例: TypeScript编译错误

**目标**: 修复jwtAuth导入问题

```bash
# 1. 查看问题文件
code backend/src/routes/chatSessions.ts

# 2. 修复导入语句
# 从: import { jwtAuth } from '@/middleware/jwtAuth';
# 改为: import jwtAuth from '@/middleware/jwtAuth';

# 3. 验证修复
pnpm run type-check

# 4. 运行相关测试
pnpm test -- chatSessions.test.ts
```

---

## 📋 下一步行动

### 立即行动（今天）

1. **修复所有TypeScript错误** (1小时)
   ```bash
   # 运行类型检查
   pnpm run type-check
   
   # 逐个修复错误
   # 修复后重新检查
   ```

2. **修复数据库连接问题** (1小时)
   ```bash
   # 更新db.ts中的null检查
   # 运行数据库测试
   pnpm test -- database
   ```

3. **完善Mock对象** (30分钟)
   ```bash
   # 更新Mock接口
   # 运行相关测试
   ```

### 本周行动

1. **Auth模块测试** (Day 1-2)
   - 阅读计划: `.specify/plans/p3-test-coverage-95-plan.md`
   - 执行: Phase 2.1
   - 目标: 90%+ 覆盖率

2. **Chat模块测试** (Day 3-4)
   - 执行: Phase 2.2
   - 目标: 90%+ 覆盖率

3. **E2E测试修复** (Day 5)
   - 添加测试ID
   - 修复选择器
   - 目标: 80%+ 通过率

---

## 🔍 监控进度

### 每日检查

```bash
# 运行完整测试套件
pnpm test

# 检查覆盖率
pnpm run test:coverage

# 查看趋势
git log --oneline --graph
```

### 每周报告

```bash
# 生成测试报告
pnpm run test:ci > weekly-report.txt

# 分析覆盖率变化
git diff HEAD~7 coverage/coverage-summary.json
```

---

## 🆘 故障排除

### 常见问题

**Q1: 测试运行很慢**
```bash
# A: 并行执行
pnpm test -- --maxWorkers=4

# 或仅运行特定测试
pnpm test -- --testPathPattern=auth
```

**Q2: 覆盖率不准确**
```bash
# A: 清理缓存
Remove-Item -Recurse -Force coverage, .nyc_output
pnpm run test:coverage
```

**Q3: Mock不生效**
```bash
# A: 检查Mock配置
# 确保在测试文件顶部
jest.mock('@/clients/FastGPTClient');
```

### 获取帮助

- **文档**: `.specify/plans/`
- **问题**: 创建GitHub Issue
- **讨论**: 团队Slack #testing频道

---

## 📚 相关资源

### 内部文档
- 完整计划: `.specify/plans/p3-test-coverage-95-plan.md`
- 研究报告: `.specify/plans/research.md`
- 数据模型: `.specify/plans/data-model.md`
- 宪章: `.specify/memory/constitution.md`

### 外部资源
- [Jest文档](https://jestjs.io/docs/getting-started)
- [Playwright文档](https://playwright.dev/docs/intro)
- [c8文档](https://github.com/bcoe/c8)
- [测试最佳实践](https://testingjavascript.com/)

---

## ✅ 验收标准

### 环境就绪
- [ ] 测试数据库已创建
- [ ] 环境变量已配置
- [ ] 依赖已安装
- [ ] 覆盖率工具已配置

### 基础测试通过
- [ ] 现有测试可运行
- [ ] 覆盖率报告可生成
- [ ] CI配置已更新

### 首次修复完成
- [ ] TypeScript错误已修复
- [ ] 数据库连接正常
- [ ] 至少1个模块覆盖率提升

---

**创建时间**: 2025-10-16  
**维护者**: 开发团队  
**版本**: 1.0


