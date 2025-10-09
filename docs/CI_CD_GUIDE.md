# CI/CD配置指南

## 概览

本项目使用GitHub Actions进行持续集成和持续部署。CI/CD流程包括代码质量检查、单元测试、E2E测试、构建验证和安全扫描。

## CI工作流

### 工作流文件
**位置**: `.github/workflows/ci.yml`

### 触发条件
- **Push**: 推送到`main`或`develop`分支
- **Pull Request**: 创建针对`main`或`develop`分支的PR

## CI阶段

### 1. Lint & Type Check (代码质量检查)

**作用**: 确保代码符合规范和类型安全

**步骤**:
1. Setup Node.js (v18)
2. Setup pnpm (v8)
3. 安装依赖（with cache）
4. 后端Lint检查
5. 后端类型检查（build）
6. 前端Lint检查
7. 前端类型检查

**本地运行**:
```bash
pnpm run lint
pnpm run type-check
```

### 2. Backend Tests (后端测试)

**作用**: 运行后端单元测试

**步骤**:
1. 启动PostgreSQL测试数据库
2. 安装依赖
3. 运行Jest测试
4. 上传覆盖率到Codecov

**本地运行**:
```bash
cd backend
pnpm test
```

**环境变量**:
- `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/llmchat_test`
- `NODE_ENV`: `test`

### 3. Frontend Tests (前端测试)

**作用**: 运行前端单元测试

**步骤**:
1. 安装依赖
2. 运行Vitest测试
3. 生成覆盖率报告
4. 上传覆盖率到Codecov

**本地运行**:
```bash
cd frontend
pnpm run test:run
pnpm run test:coverage
```

### 4. E2E Tests (端到端测试)

**作用**: 运行Playwright E2E测试

**条件**: 仅在push事件时运行（不在PR时运行）

**步骤**:
1. 安装Playwright浏览器
2. 运行E2E测试
3. 上传失败截图和报告

**本地运行**:
```bash
pnpm run test:e2e
pnpm run test:e2e:ui     # UI模式
pnpm run test:e2e:debug  # 调试模式
```

### 5. Build Verification (构建验证)

**作用**: 验证生产构建成功

**依赖**: lint, backend-test, frontend-test

**步骤**:
1. 构建后端（TypeScript → JavaScript）
2. 构建前端（Vite生产构建）
3. 上传构建产物为artifacts

**本地运行**:
```bash
pnpm run build
```

### 6. Security Scan (安全扫描)

**作用**: 检测依赖漏洞

**步骤**:
1. 运行`pnpm audit`
2. 运行Snyk安全扫描（需要SNYK_TOKEN）

**本地运行**:
```bash
pnpm audit
```

## 环境变量与Secrets

### GitHub Secrets配置

在GitHub仓库设置中配置以下secrets:

1. **SNYK_TOKEN** (可选)
   - 用于Snyk安全扫描
   - 获取: https://snyk.io/account
   - 设置路径: Settings → Secrets and variables → Actions → New repository secret

2. **CODECOV_TOKEN** (可选)
   - 用于Codecov覆盖率上传
   - 获取: https://codecov.io
   - 设置路径: 同上

## 本地开发测试

### 完整CI流程模拟

```bash
# 1. 代码质量检查
pnpm run lint
pnpm run type-check

# 2. 单元测试
pnpm run test:unit

# 3. E2E测试
pnpm run test:e2e

# 4. 构建验证
pnpm run build

# 5. 安全扫描
pnpm audit
```

### 推荐预提交检查

在提交代码前，至少运行：
```bash
pnpm run lint
pnpm run test:unit
```

或使用完整检查：
```bash
pnpm run test:all  # 运行所有测试
```

## CI失败处理

### 常见问题

#### 1. Lint错误

**症状**: `lint` job失败

**解决方案**:
```bash
pnpm run lint:fix  # 自动修复部分问题
pnpm run lint      # 验证修复
```

#### 2. 类型错误

**症状**: Type check失败

**解决方案**:
```bash
# 后端
cd backend && pnpm run build

# 前端
cd frontend && pnpm run type-check
```

修复TypeScript类型错误。

#### 3. 单元测试失败

**症状**: `backend-test`或`frontend-test` job失败

**解决方案**:
```bash
# 查看详细错误
pnpm run test:unit

# 监听模式（开发时）
cd frontend && pnpm test  # Vitest watch mode
cd backend && pnpm test -- --watch  # Jest watch mode
```

#### 4. E2E测试失败

**症状**: `e2e-test` job失败

**解决方案**:
```bash
# 本地调试
pnpm run test:e2e:debug

# UI模式
pnpm run test:e2e:ui

# 查看失败截图
# GitHub: Actions → 失败的workflow → Artifacts → playwright-report
```

#### 5. 构建失败

**症状**: `build` job失败

**解决方案**:
```bash
# 清理并重新构建
rm -rf backend/dist frontend/dist
pnpm run build
```

#### 6. 依赖安全问题

**症状**: `security` job失败

**解决方案**:
```bash
# 查看漏洞详情
pnpm audit

# 自动修复（谨慎）
pnpm audit --fix

# 手动更新特定依赖
pnpm update <package-name>
```

## CI优化建议

### 1. 缓存优化

当前已配置pnpm store缓存，加速依赖安装。

**缓存键**: `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`

### 2. 并行执行

多个jobs并行执行，减少总时间：
- `lint`、`backend-test`、`frontend-test`、`security` 并行
- `build`依赖前三个，串行执行
- `e2e-test`依赖测试，串行执行

### 3. 条件执行

- E2E测试仅在`push`事件时运行，节省PR时间
- `continue-on-error`用于安全扫描，不阻塞其他流程

## 徽章配置

在README.md中添加CI状态徽章：

```markdown
![CI Status](https://github.com/<your-username>/<repo-name>/workflows/CI%2FCD%20Pipeline/badge.svg)

![Codecov](https://codecov.io/gh/<your-username>/<repo-name>/branch/main/graph/badge.svg)
```

## CD配置（生产部署）

### 部署工作流

**文件**: `.github/workflows/deploy.yml` (待创建)

**触发**: 
- Push到`main`分支且所有CI通过
- 手动触发（workflow_dispatch）

**步骤**:
1. 下载构建artifacts
2. 部署到生产服务器（Docker/K8s/云平台）
3. 运行smoke tests
4. 通知部署结果

**示例**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [build]  # 依赖CI的build job
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: backend-dist
      
      - uses: actions/download-artifact@v3
        with:
          name: frontend-dist
      
      # 部署步骤（根据实际部署方式配置）
      - name: Deploy to server
        run: |
          # SSH/Docker/K8s部署命令
          echo "Deploy to production"
```

## 监控与通知

### Slack/Discord通知

在workflow中添加通知步骤：

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Email通知

GitHub默认发送workflow失败邮件到仓库所有者。

## 最佳实践

1. ✅ **每次提交都运行CI** - 早发现问题
2. ✅ **保持测试快速** - 单元测试<5分钟，E2E<10分钟
3. ✅ **修复失败的测试** - 不要忽略间歇性失败
4. ✅ **定期更新依赖** - 每月review依赖漏洞
5. ✅ **监控CI性能** - 关注执行时间趋势
6. ✅ **使用并行执行** - 充分利用GitHub Actions并发
7. ✅ **保护主分支** - 要求CI通过才能合并
8. ✅ **使用缓存** - 减少依赖安装时间

## 分支保护规则

### 配置路径
Settings → Branches → Branch protection rules → Add rule

### 推荐设置（main分支）
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - `lint`
  - `backend-test`
  - `frontend-test`
  - `build`
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

## 故障排查

### CI运行慢

**原因**: 依赖安装慢

**解决**: 
- 检查缓存是否生效
- 减少不必要的依赖

### 测试不稳定

**原因**: 异步测试、网络依赖

**解决**:
- 增加超时时间
- Mock外部依赖
- 使用`waitFor`处理异步

### 构建失败但本地正常

**原因**: 环境差异、缓存问题

**解决**:
- 清理本地缓存重试
- 检查`.gitignore`，确保必要文件提交
- 检查环境变量配置

## 相关文档

- [GitHub Actions文档](https://docs.github.com/en/actions)
- [Playwright文档](https://playwright.dev/)
- [Codecov文档](https://docs.codecov.com/)
- [Snyk文档](https://docs.snyk.io/)

---

**最后更新**: 2025-10-03  
**维护者**: AI Developer

