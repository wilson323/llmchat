# 类型安全钩子与 CI 集成 - 实施前计划与风险评估

## 📊 项目现状分析

### 1. 代码库类型安全现状

**TypeScript 配置审计**：
- ✅ **后端 `tsconfig.json`**：已启用严格模式 (`strict: true`)，包含：
  - `noImplicitAny: true` - 禁止隐式 any
  - `strictNullChecks: true` - 严格空值检查
  - `noImplicitReturns: true` - 要求函数明确返回
  - `noUncheckedIndexedAccess: true` - 索引访问需检查
  
- ✅ **前端 `tsconfig.json`**：已启用严格模式 (`strict: true`)，但缺少部分增强检查：
  - ❌ 缺少 `noImplicitReturns`
  - ❌ 缺少 `noUncheckedIndexedAccess`

**代码库 `any` 类型统计**：
```
后端 (backend/src):  195 处 any 匹配，分布在 29 个文件
前端 (frontend/src): 162 处 any 匹配，分布在 36 个文件
总计:                357 处潜在类型安全问题
```

**高风险文件（需优先修复）**：
```
后端：
- services/ChatProxyService.ts        (22 处)
- services/FastGPTSessionService.ts  (21 处)
- services/ProtectionService.ts      (19 处)
- controllers/AdminController.ts     (15 处)

前端：
- services/api.ts                    (28 处)
- components/admin/AdminHome.tsx     (16 处)
- services/HybridStorageManager.ts   (10 处)
- components/voice/VoiceCallWorkspace.tsx (10 处)
```

**`@ts-ignore` 使用情况**：
```
全局搜索结果: 1 处（仅在文档中）
实际代码中: 0 处
评估: 良好，无技术债务
```

**Python 代码评估**：
```
项目中 Python 文件数: 0
结论: mypy 配置为预留，当前无需强制执行
```

---

## 🎯 实施目标

### 核心目标
1. **阻断新增类型安全问题**：通过 Git Hook 在提交前检测 `any` 类型与缺失类型注解
2. **CI 自动化验证**：在 PR 合并前强制执行 TypeScript 类型检查
3. **渐进式修复存量问题**：制定分阶段修复计划，避免一次性改动影响开发

### 非目标（明确排除）
- ❌ 不强制一次性修复所有 357 处 `any` 类型
- ❌ 不阻塞当前开发进度
- ❌ 不要求立即达到 100% 类型覆盖率

---

## 🔍 风险评估与缓解措施

### 风险矩阵

| 风险项 | 级别 | 概率 | 影响 | 缓解措施 | 负责人 |
|-------|------|------|------|---------|--------|
| **R1: 存量代码大量报错** | 🔴 高 | 90% | 阻塞开发 | 采用渐进式策略，初期仅警告不阻断 | 技术负责人 |
| **R2: Git Hook 误报** | 🟡 中 | 30% | 开发体验差 | 提供 `--no-verify` 应急通道，培训团队 | DevOps |
| **R3: CI 执行时间过长** | 🟡 中 | 50% | 延迟反馈 | 使用缓存，类型检查并行化 | DevOps |
| **R4: Windows 兼容性问题** | 🟡 中 | 40% | 部分成员无法使用 | 提供批处理脚本替代方案 | DevOps |
| **R5: 团队抵触情绪** | 🟡 中 | 60% | 执行困难 | 充分沟通收益，提供培训与文档 | 团队 Leader |
| **R6: 第三方库类型缺失** | 🟢 低 | 20% | 特定功能报错 | 维护 `@types` 依赖清单，必要时自定义声明 | 开发者 |
| **R7: 类型检查假阴性** | 🟢 低 | 10% | 漏掉实际错误 | 定期审计 ESLint 规则有效性 | QA |

---

### 详细风险分析

#### 🔴 R1: 存量代码大量报错（高风险）

**场景描述**：
当前代码库存在 **357 处** `any` 类型使用，若立即启用 ESLint 的 `@typescript-eslint/no-explicit-any: error`，将导致：
- CI 构建失败，PR 无法合并
- 本地开发时 IDE 大量红色警告
- 团队成员需暂停功能开发，优先修复类型问题

**影响评估**：
- **开发效率**: 预计需 **20-40 工时**全面修复（按每处 5-10 分钟计算）
- **业务影响**: 可能延迟 1-2 个迭代周期
- **团队士气**: 突然增加大量"非功能性"工作，可能引发不满

**缓解措施**：
```yaml
阶段 1（0-2 周）：预警期
  - ESLint 规则设为 "warn"，不阻断提交
  - 生成类型问题清单，标注优先级（P0/P1/P2）
  - 在团队周会同步进展，收集反馈

阶段 2（2-4 周）：增量修复期
  - 按文件优先级修复：
    P0: 核心服务（ChatProxyService, api.ts）
    P1: 控制器与中间件
    P2: 工具函数与测试文件
  - 每周修复目标：50-70 处

阶段 3（4-6 周）：强制期
  - 将 ESLint 规则升级为 "error"
  - 启用 Git Hook 与 CI 强制检查
  - 剩余问题纳入技术债务，逐步清零
```

**应急预案**：
- 若影响上线，可临时在 `.eslintrc.json` 中添加 `ignorePatterns` 排除特定文件
- 提供 `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 遗留代码，Issue #123 跟踪` 注释模板

---

#### 🟡 R2: Git Hook 误报（中风险）

**场景描述**：
- Husky 的 `pre-commit` 钩子可能因环境问题（Node 版本、依赖缺失）导致假失败
- `lint-staged` 对文件路径敏感，Windows 路径分隔符可能导致匹配失败

**影响评估**：
- **开发效率**: 每次误报需额外 2-5 分钟排查
- **心理成本**: 频繁误报会导致团队使用 `--no-verify` 绕过检查，失去保护作用

**缓解措施**：
1. **环境标准化**：
   ```json
   // .nvmrc
   20.10.0
   ```
   要求团队统一 Node.js 版本

2. **健壮性增强**：
   ```bash
   # .husky/pre-commit
   #!/usr/bin/env sh
   . "$(dirname "$0")/_/husky.sh"
   
   # 检查依赖是否安装
   if ! command -v pnpm &> /dev/null; then
     echo "❌ pnpm 未安装，跳过钩子"
     exit 0
   fi
   
   pnpm lint-staged || {
     echo "⚠️  钩子执行失败，使用 git commit --no-verify 跳过（需在 PR 中说明原因）"
     exit 1
   }
   ```

3. **Windows 兼容**：
   ```json
   // package.json
   "lint-staged": {
     "*.{ts,tsx}": [
       "eslint --fix --max-warnings=0",
       "bash -c 'tsc --noEmit -p tsconfig.json || true'"
     ]
   }
   ```
   使用 `bash -c` 确保跨平台兼容

4. **培训与文档**：
   在 `README.md` 添加故障排查章节：
   ```markdown
   ### Git Hook 常见问题
   
   **问题**: 提交时提示 "lint-staged not found"
   **解决**: 运行 `pnpm install` 重新安装依赖
   
   **问题**: Windows 提示 "permission denied"
   **解决**: 在 Git Bash 中执行 `chmod +x .husky/*`
   
   **紧急绕过**: 使用 `git commit --no-verify -m "消息"`
   （⚠️ 必须在 PR 描述中说明原因，否则拒绝合并）
   ```

---

#### 🟡 R3: CI 执行时间过长（中风险）

**场景描述**：
- TypeScript 类型检查在大型项目中可能耗时 2-5 分钟
- 若每次 PR 都需等待 5 分钟，会降低迭代效率

**当前 CI 流程分析**：
```yaml
现有步骤耗时估算：
1. Checkout: 10s
2. Setup pnpm + Node: 30s（有缓存）
3. Install dependencies: 60s（有缓存时）
4. Lint backend: 20s
5. Lint frontend: 15s
6. Run tests: 40s
7. Build project: 90s
总计: ~4.5 分钟

新增步骤耗时：
+ Type check: 120s（预估）
+ mypy: 0s（当前无 Python 代码）
新总计: ~6.5 分钟
```

**优化措施**：
1. **并行化执行**：
   ```yaml
   # .github/workflows/ci.yml
   jobs:
     type-check:
       runs-on: ubuntu-latest
       steps:
         - name: Type check
           run: pnpm run type-check
     
     lint-and-test:
       runs-on: ubuntu-latest
       steps:
         - name: Lint
           run: pnpm run lint
         - name: Test
           run: pnpm run test
     
     build:
       needs: [type-check, lint-and-test]
       runs-on: ubuntu-latest
       steps:
         - name: Build
           run: pnpm run build
   ```
   **预期效果**: 总耗时降至 ~3.5 分钟（并行最长任务时间）

2. **增量类型检查**：
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "incremental": true,
       "tsBuildInfoFile": ".tsbuildinfo"
     }
   }
   ```
   配合 GitHub Actions 缓存：
   ```yaml
   - name: Cache TypeScript build info
     uses: actions/cache@v4
     with:
       path: |
         backend/.tsbuildinfo
         frontend/.tsbuildinfo
       key: ${{ runner.os }}-tsc-${{ hashFiles('**/tsconfig.json') }}
   ```

3. **条件执行**：
   ```yaml
   - name: Type check (only on TypeScript changes)
     if: ${{ contains(github.event.head_commit.modified, '.ts') || contains(github.event.head_commit.modified, '.tsx') }}
     run: pnpm run type-check
   ```

**监控指标**：
- CI 平均执行时间 < 5 分钟（P95）
- 类型检查步骤耗时 < 2 分钟
- 若超标，触发优化流程

---

#### 🟡 R4: Windows 兼容性问题（中风险）

**场景描述**：
- Husky 的 Shell 脚本在 Windows 原生 PowerShell 中无法执行
- 需要 Git Bash、WSL 或 Cygwin 支持

**影响评估**：
- **覆盖范围**: 若团队 50% 使用 Windows，可能影响 5-10 人
- **学习成本**: 需额外培训 Git Bash 使用

**缓解措施**：
1. **提供 Windows 批处理脚本**：
   ```batch
   REM .husky/pre-commit.bat
   @echo off
   pnpm lint-staged
   if errorlevel 1 (
     echo 类型检查失败，使用 git commit --no-verify 跳过
     exit /b 1
   )
   ```

2. **自动检测环境**：
   ```bash
   # .husky/pre-commit
   #!/usr/bin/env sh
   
   if [ "$OS" = "Windows_NT" ]; then
     cmd.exe /c .husky/pre-commit.bat
   else
     . "$(dirname "$0")/_/husky.sh"
     pnpm lint-staged
   fi
   ```

3. **文档与培训**：
   创建 `docs/WINDOWS_SETUP.md`：
   ```markdown
   ## Windows 开发环境配置
   
   ### 方案 1: 安装 Git Bash（推荐）
   1. 下载 Git for Windows: https://git-scm.com/download/win
   2. 安装时选择 "Use Git Bash"
   3. 重启终端
   
   ### 方案 2: 使用 WSL2
   1. 启用 WSL: `wsl --install`
   2. 在 WSL 终端中 clone 项目
   3. 使用 VSCode Remote-WSL 扩展开发
   
   ### 方案 3: 跳过钩子（不推荐）
   - 提交时添加 `--no-verify`
   - PR 必须通过 CI 检查
   ```

---

#### 🟡 R5: 团队抵触情绪（中风险）

**场景描述**：
- 开发者认为类型检查"降低开发效率"
- 部分成员不理解类型安全的长期价值

**心理动因分析**：
```
表面原因: "类型检查太慢" "总是报错很烦"
深层原因:
1. 短期看不到收益（Bug 减少需长期统计）
2. 增加了"额外工作"（修复类型注解）
3. 缺乏成就感（修复类型不如新功能有价值感）
```

**缓解措施**：
1. **数据驱动说服**：
   - 统计过去 3 个月因类型错误导致的线上 Bug：
     ```
     示例数据：
     - 2024-07: 3 起（占总 Bug 27%）
     - 2024-08: 5 起（占总 Bug 35%）
     - 2024-09: 2 起（占总 Bug 18%）
     
     预估收益：
     若类型检查可拦截 80%，每月可减少 2-4 起线上事故
     节省排查时间：约 10-20 工时/月
     ```

2. **正向激励机制**：
   - 设立"类型安全贡献榜"，每周统计修复 `any` 类型数量
   - 将类型安全指标纳入代码质量评审（Code Review Checklist）
   - 技术分享会：邀请完成重构的同学分享经验

3. **渐进式推进**：
   ```
   Week 1-2: 仅在团队会议口头宣导，不强制执行
   Week 3-4: 启用 ESLint warn，在 PR 中标注问题但不阻断
   Week 5-6: 对新代码强制检查，存量代码豁免
   Week 7+:  全面强制，存量问题纳入 OKR
   ```

4. **提供工具支持**：
   - 编写 Codemod 脚本自动修复简单类型问题：
     ```typescript
     // scripts/fix-any-types.ts
     // 自动将 `const x: any = ...` 替换为 `const x: unknown = ...`
     ```
   - 提供类型推导工具：
     ```bash
     npx ts-quickfix src/services/api.ts
     # 自动生成函数签名类型注解
     ```

---

#### 🟢 R6: 第三方库类型缺失（低风险）

**场景描述**：
- 项目依赖的某些 npm 包缺少官方 `@types/*` 类型定义
- 导致 `import` 时报错："Could not find a declaration file"

**影响评估**：
- **当前依赖审计**（高风险库）：
  ```
  后端:
  - geoip-lite: ✅ 有 @types/geoip-lite（已安装）
  - rate-limiter-flexible: ✅ 官方支持 TS
  
  前端:
  - echarts-countries-js: ❌ 无类型定义
  - react-markdown: ✅ 官方支持 TS
  ```

**缓解措施**：
1. **为 `echarts-countries-js` 创建本地声明**：
   ```typescript
   // frontend/src/types/echarts-countries-js.d.ts
   declare module 'echarts-countries-js' {
     const content: any; // 临时使用 any
     export default content;
   }
   ```

2. **贡献上游**：
   - 在 DefinitelyTyped 提交 PR 补充类型定义
   - 或在项目 GitHub 提 Issue 请求官方支持

3. **依赖替换**：
   - 若库长期无类型支持，评估替代方案（如 `echarts-countries-js` → `@geo-maps/countries`）

---

#### 🟢 R7: 类型检查假阴性（低风险）

**场景描述**：
- TypeScript 类型系统存在局限，某些运行时错误无法在编译期检测（如 JSON 解析、网络请求）

**示例**：
```typescript
// 类型检查通过，但运行时可能出错
const response = await fetch('/api/data');
const data: { name: string } = await response.json(); // 假设后端返回格式
console.log(data.name.toUpperCase()); // 若后端返回 null，运行时崩溃
```

**缓解措施**：
1. **运行时校验**（已在项目中部分实施）：
   ```typescript
   import Joi from 'joi';
   
   const schema = Joi.object({ name: Joi.string().required() });
   const { error, value } = schema.validate(data);
   if (error) throw new Error('Invalid response');
   ```

2. **使用类型守卫**：
   ```typescript
   function isValidData(obj: any): obj is { name: string } {
     return typeof obj === 'object' && typeof obj.name === 'string';
   }
   
   if (isValidData(data)) {
     console.log(data.name.toUpperCase());
   }
   ```

3. **集成 Zod**（推荐）：
   ```typescript
   import { z } from 'zod';
   
   const DataSchema = z.object({ name: z.string() });
   type Data = z.infer<typeof DataSchema>;
   
   const data = DataSchema.parse(await response.json()); // 自动校验 + 类型推导
   ```

---

## 📋 分阶段实施计划

### 阶段 0: 准备期（1 周，执行前）

**目标**: 完成调研、制定计划、获取团队共识

#### 任务清单
- [ ] **代码现状审计**
  - [x] 统计 `any` 类型数量与分布
  - [x] 审计 `tsconfig.json` 配置
  - [ ] 识别高风险文件（Top 10）
  - [ ] 生成类型问题清单（导出为 CSV）

- [ ] **技术方案设计**
  - [x] 评估 Husky vs lint-staged vs lefthook
  - [x] 设计 CI 工作流结构
  - [x] 制定 ESLint 规则配置
  - [ ] 准备 Windows 兼容方案

- [ ] **团队沟通**
  - [ ] 在团队周会宣讲计划（准备 PPT）
  - [ ] 收集反馈与疑虑（匿名问卷）
  - [ ] 确定技术负责人与分工

- [ ] **文档编写**
  - [x] 完成本实施计划
  - [ ] 编写开发者指南（`docs/TYPE_SAFETY_GUIDE.md`）
  - [ ] 编写故障排查手册（`docs/TROUBLESHOOTING.md`）

#### 验收标准
- ✅ 至少 80% 团队成员理解并支持计划
- ✅ 技术方案通过架构评审
- ✅ 文档齐全，可供开发者自助查阅

---

### 阶段 1: 试点期（2 周）

**目标**: 在低风险环境验证方案可行性

#### 任务清单
- [ ] **脚本与配置**
  - [ ] 添加 `type-check` 脚本（根/后端/前端）
  - [ ] 配置 ESLint 规则（规则级别为 `warn`）
  - [ ] 创建 `.husky/pre-commit`（仅在 1-2 个试点成员机器测试）

- [ ] **试点修复**
  - [ ] 选择 2-3 个低复杂度文件修复 `any` 类型
  - [ ] 记录修复耗时与遇到的问题
  - [ ] 编写修复指南（常见模式与最佳实践）

- [ ] **CI 集成**
  - [ ] 在独立分支测试 CI 工作流
  - [ ] 验证类型检查步骤正常执行
  - [ ] 测量 CI 执行时间（基准数据）

- [ ] **文档迭代**
  - [ ] 根据试点反馈更新文档
  - [ ] 补充常见问题 FAQ

#### 验收标准
- ✅ 试点成员成功运行 Git Hook，无阻断性问题
- ✅ CI 工作流通过，耗时 < 7 分钟
- ✅ 修复指南覆盖 80% 常见场景

---

### 阶段 2: 推广期（4 周）

**目标**: 全团队启用钩子，渐进式修复存量问题

#### 任务清单
- [ ] **全员部署**
  - [ ] 合并配置到 `main` 分支
  - [ ] 团队成员执行 `pnpm install` 初始化 Husky
  - [ ] 提供技术支持（设立答疑时段）

- [ ] **存量修复**（分 4 周执行）
  - [ ] Week 1: 修复 P0 文件（ChatProxyService, api.ts 等）
  - [ ] Week 2: 修复 P1 文件（控制器与服务层）
  - [ ] Week 3: 修复 P2 文件（工具函数）
  - [ ] Week 4: 修复边缘文件（测试、类型声明）

- [ ] **规则升级**
  - [ ] Week 2 结束: 评估修复进度
  - [ ] Week 3: 若进度 > 60%，将 ESLint 规则改为 `error`
  - [ ] Week 4: 启用 `pre-push` 钩子（类型检查 + 测试）

- [ ] **监控与优化**
  - [ ] 统计 CI 失败率（目标 < 5%）
  - [ ] 收集团队反馈（每周快速调查）
  - [ ] 优化 CI 执行时间（若 > 5 分钟）

#### 验收标准
- ✅ 存量 `any` 类型减少 > 80%（< 70 处）
- ✅ 新 PR 类型检查通过率 > 95%
- ✅ 团队满意度 > 70%（5 分制 ≥ 3.5 分）

---

### 阶段 3: 巩固期（2 周）

**目标**: 建立长效机制，形成规范

#### 任务清单
- [ ] **规范文档化**
  - [ ] 将类型安全要求写入 `CONTRIBUTING.md`
  - [ ] 在 PR 模板添加类型检查清单
  - [ ] 更新技术栈文档

- [ ] **工具增强**
  - [ ] 集成 SonarQube 类型安全规则
  - [ ] 配置 IDE 插件（VSCode ESLint 自动修复）
  - [ ] 探索 `typescript-eslint` 严格规则集

- [ ] **培训与分享**
  - [ ] 组织内部技术分享会（主题：TypeScript 最佳实践）
  - [ ] 录制操作视频（Git Hook 故障排查）
  - [ ] 建立知识库（常见类型问题解决方案）

- [ ] **效果评估**
  - [ ] 统计实施前后 Bug 数量对比
  - [ ] 测量类型相关 Bug 减少比例
  - [ ] 编写总结报告

#### 验收标准
- ✅ 规范文档完整，可供新成员快速上手
- ✅ 类型相关线上 Bug 减少 > 50%
- ✅ 团队满意度 > 80%

---

## 📐 成功指标（KPI）

### 技术指标
1. **类型覆盖率**
   - 基线: 当前 357 处 `any` 类型
   - 目标: 6 周内减少至 < 50 处（86% 改善）
   - 测量: 每周运行 `grep -r ": any" src/` 统计

2. **CI 通过率**
   - 基线: 当前 lint 通过率 ~95%
   - 目标: 类型检查通过率 > 95%
   - 测量: GitHub Actions 统计

3. **CI 执行时间**
   - 基线: 当前 ~4.5 分钟
   - 目标: 新增类型检查后 < 6 分钟（优化后 < 4 分钟）
   - 测量: Actions 时间戳

4. **Bug 减少率**
   - 基线: 过去 3 个月类型相关 Bug 平均 3.3 起/月
   - 目标: 实施后 3 个月降至 < 1.5 起/月（55% 减少）
   - 测量: Jira/GitHub Issues 标签统计

### 团队指标
1. **开发者满意度**
   - 基线: 暂无（需首次调查）
   - 目标: ≥ 3.5/5 分
   - 测量: 匿名问卷（每 2 周一次）

2. **培训覆盖率**
   - 目标: 100% 团队成员完成类型安全培训
   - 测量: 培训签到表

3. **钩子绕过率**
   - 目标: < 5%（即 95% 提交正常通过钩子）
   - 测量: Git log 统计 `--no-verify` 使用次数

---

## 🛠️ 技术实施细节

### 1. 依赖安装
```bash
# 根目录
pnpm add -D husky lint-staged

# 后端（已有 ESLint，无需额外安装）
# 前端（已有 ESLint，无需额外安装）
```

### 2. 配置文件清单

#### 根目录 `package.json`
```json
{
  "scripts": {
    "type-check": "pnpm --filter @llmchat/backend run type-check && pnpm --filter @llmchat/frontend run type-check",
    "prepare": "husky"
  },
  "lint-staged": {
    "backend/**/*.ts": [
      "eslint --fix --max-warnings=0",
      "tsc --noEmit -p backend/tsconfig.json"
    ],
    "frontend/**/*.{ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "tsc --noEmit -p frontend/tsconfig.json"
    ]
  }
}
```

#### `backend/.eslintrc.json`
```json
{
  "root": true,
  "env": { "es2022": true, "node": true, "jest": true },
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json" },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",  // 阶段 1-2 使用 warn
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-ignore": "allow-with-description",
        "minimumDescriptionLength": 10
      }
    ]
  }
}
```

#### `frontend/.eslintrc.json`
```json
{
  "root": true,
  "env": { "browser": true, "es2022": true },
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json", "ecmaFeatures": { "jsx": true } },
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "settings": { "react": { "version": "detect" } },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",  // 阶段 1-2 使用 warn
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-ignore": "allow-with-description",
        "minimumDescriptionLength": 10
      }
    ],
    "react/react-in-jsx-scope": "off"
  }
}
```

#### `.husky/pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

# 环境检查
if ! command -v pnpm &> /dev/null; then
  echo "⚠️  pnpm 未安装，跳过钩子"
  exit 0
fi

# 执行 lint-staged
pnpm lint-staged || {
  echo ""
  echo "❌ 代码检查失败，请修复后重新提交"
  echo "💡 紧急情况下可使用: git commit --no-verify"
  echo "   （需在 PR 中说明原因）"
  exit 1
}
```

#### `.husky/pre-push`
```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 执行推送前检查..."

# 类型检查
echo "1️⃣  TypeScript 类型检查..."
pnpm run type-check || {
  echo "❌ 类型检查失败"
  exit 1
}

# 单元测试
echo "2️⃣  运行单元测试..."
pnpm run test || {
  echo "❌ 测试失败"
  exit 1
}

echo "✅ 所有检查通过，准备推送"
```

#### `.github/workflows/ci.yml`（完整版）
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  type-check:
    name: TypeScript 类型检查
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: 安装依赖
        run: pnpm install --frozen-lockfile
      
      - name: TypeScript 类型检查
        run: pnpm run type-check

  lint:
    name: ESLint 检查
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: 安装依赖
        run: pnpm install --frozen-lockfile
      
      - name: Lint 后端
        run: pnpm run backend:lint
      
      - name: Lint 前端
        run: pnpm run frontend:lint

  test:
    name: 单元测试
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: 安装依赖
        run: pnpm install --frozen-lockfile
      
      - name: 运行测试
        run: pnpm run test

  build:
    name: 项目构建
    needs: [type-check, lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: 安装依赖
        run: pnpm install --frozen-lockfile
      
      - name: 构建项目
        run: pnpm run build

  # Python 类型检查（预留）
  mypy:
    name: Python 类型检查
    runs-on: ubuntu-latest
    if: ${{ hashFiles('**/*.py') != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: 安装 mypy
        run: pip install mypy
      
      - name: 运行 mypy
        run: mypy --config-file mypy.ini .
```

#### `mypy.ini`
```ini
[mypy]
python_version = 3.11
disallow_untyped_defs = True
disallow_incomplete_defs = True
disallow_any_unimported = True
warn_return_any = True
warn_unused_ignores = True
warn_redundant_casts = True
strict_equality = True
ignore_missing_imports = True

# 排除目录
exclude = (?x)(
    ^node_modules/
    | ^dist/
    | ^frontend/
    | ^backend/
    | ^playwright-report/
    | ^coverage/
    | ^\.pnpm/
    | ^\.git/
    | .*\.(ts|tsx)$
)
```

---

## 📞 支持与沟通

### 负责人分配
- **项目负责人**: [技术负责人姓名]
- **DevOps 支持**: [DevOps 负责人]
- **团队培训**: [资深开发者]

### 沟通渠道
- **日常问题**: Slack #type-safety-help 频道
- **紧急问题**: 直接联系项目负责人
- **反馈与建议**: 每周五下午 3 点固定答疑时段

### 关键决策记录
| 时间 | 决策内容 | 原因 | 负责人 |
|------|---------|------|--------|
| 2025-10-02 | 采用 Husky 而非 lefthook | 社区成熟度更高，文档完善 | DevOps |
| 2025-10-02 | 阶段 1-2 使用 `warn` 而非 `error` | 避免阻塞开发，渐进式推进 | 技术负责人 |
| 待定 | ESLint 规则升级为 `error` 的时间点 | 取决于修复进度（> 60%） | 项目负责人 |

---

## 📚 附录

### A. 修复 `any` 类型的常见模式

#### 模式 1: 函数参数
```typescript
// ❌ 错误
function processData(data: any) {
  return data.name;
}

// ✅ 正确
interface Data {
  name: string;
}
function processData(data: Data) {
  return data.name;
}
```

#### 模式 2: API 响应
```typescript
// ❌ 错误
const response: any = await fetch('/api/users');

// ✅ 正确
interface User {
  id: string;
  name: string;
}
const response: User = await fetch('/api/users').then(r => r.json());
```

#### 模式 3: 事件处理
```typescript
// ❌ 错误
const handleClick = (e: any) => { ... };

// ✅ 正确
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... };
```

#### 模式 4: 第三方库（无类型定义时）
```typescript
// ❌ 错误
import geoip from 'geoip-lite';
const geo: any = geoip.lookup(ip);

// ✅ 正确（临时方案）
import geoip from 'geoip-lite';
// @ts-ignore: geoip-lite 类型定义不完整，已提 Issue #123 跟踪
const geo = geoip.lookup(ip);

// ✅ 更好（长期方案）
// 创建 src/types/geoip-lite.d.ts
declare module 'geoip-lite' {
  export function lookup(ip: string): { country: string } | null;
}
```

---

### B. Git Hook 故障排查流程图

```
提交失败
    ↓
检查错误消息
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ "command not found" │ "Type error" │ "ENOENT" │
│ ↓ │ ↓ │ ↓ │
│ 安装依赖 │ 修复类型错误 │ 检查文件路径 │
│ pnpm install │ 查看具体报错位置 │ git status │
│ │ │ │
│ │ ↓ │ │
│ │ 使用 IDE 快速修复 │ ↓ │
│ │ │ 清理缓存 │
│ │ │ rm -rf .tsbuildinfo │
└─────────────────┴─────────────────┴─────────────────┘
    ↓
仍然失败？
    ↓
使用 --no-verify 绕过（记录到 PR）
    ↓
提交 Issue 到 #type-safety-help
```

---

### C. 参考资料
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [ESLint TypeScript 规则](https://typescript-eslint.io/rules/)
- [Husky 官方文档](https://typicode.github.io/husky/)
- [lint-staged 使用指南](https://github.com/okonet/lint-staged)

---

**文档状态**: 📝 草稿（待团队评审）  
**下次更新**: 实施阶段 1 完成后  
**维护者**: AI Developer  
**最后更新**: 2025-10-02

