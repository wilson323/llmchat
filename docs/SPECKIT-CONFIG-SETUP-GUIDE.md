# SpecKit修复配置设置指南

本指南提供所有SpecKit修复所需的配置文件和设置步骤。

---

## 📦 前置依赖安装

```bash
# 安装husky（git钩子管理）
pnpm install husky -D

# 安装lint-staged（仅检查变更文件）
pnpm install lint-staged -D

# 初始化husky
pnpm husky install
```

---

## 🔧 配置文件

### 1. Husky Pre-commit钩子

**文件**: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Pre-commit质量检查开始..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 步骤1: TypeScript类型检查
echo ""
echo "📝 [1/3] TypeScript类型检查中..."
pnpm run type-check
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ TS类型检查失败！"
  echo "   请修复所有TypeScript类型错误后重试。"
  echo "   命令: pnpm run type-check"
  exit 1
fi
echo "✅ TypeScript类型检查通过"

# 步骤2: 代码质量检查（仅变更文件）
echo ""
echo "🔍 [2/3] ESLint代码质量检查中..."
npx lint-staged
if [ $? -ne 0 ]; then
  echo ""
  echo "⚠️  ESLint检查发现问题（已自动修复部分）"
  echo "   请检查修改后的文件并重新commit。"
  exit 1
fi
echo "✅ ESLint检查通过"

# 步骤3: 提交消息验证
echo ""
echo "✍️  [3/3] 验证提交消息格式..."
# 可选：验证commitlint（如果已配置）
# npx commitlint --edit "$1"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有检查通过！提交准备完成。"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
```

### 2. Lint-staged配置

**文件**: `package.json` 中的 `lint-staged` 字段

```json
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix --max-warnings=50",
      "tsc --noEmit --skipLibCheck"
    ],
    "*.tsx": [
      "eslint --fix --max-warnings=50",
      "tsc --noEmit --skipLibCheck"
    ],
    "*.js": [
      "eslint --fix --max-warnings=50"
    ],
    "*.json": [
      "prettier --write"
    ]
  }
}
```

### 3. Package.json脚本更新

在 `package.json` 的 `scripts` 字段添加：

```json
{
  "scripts": {
    "type-check": "tsc --noEmit --skipLibCheck",
    "type-check:watch": "tsc --noEmit --watch --skipLibCheck",
    "lint": "eslint . --ext .ts,.tsx --max-warnings=50",
    "lint:fix": "eslint . --ext .ts,.tsx --fix --max-warnings=50",
    "prepare": "husky install"
  }
}
```

### 4. TypeScript配置增强

**文件**: `backend/tsconfig.json` 和 `frontend/tsconfig.json`

确保包含以下严格设置：

```json
{
  "compilerOptions": {
    // 严格模式
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    
    // 额外严格检查
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    
    // 其他选项
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true,
    
    // 错误输出
    "pretty": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

### 5. ESLint配置增强

**文件**: `.eslintrc.json` 或 `.eslintrc.cjs`

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "project": ["./backend/tsconfig.json", "./frontend/tsconfig.json"]
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    // 禁止未使用的变量
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    
    // 禁止any类型
    "@typescript-eslint/no-explicit-any": "error",
    
    // 禁止非空断言
    "@typescript-eslint/no-non-null-assertion": "warn",
    
    // 要求函数返回类型
    "@typescript-eslint/explicit-function-return-types": [
      "warn",
      {
        "allowExpressions": true,
        "allowTypedFunctionExpressions": true
      }
    ],
    
    // 禁止浮动承诺
    "@typescript-eslint/no-floating-promises": "error",
    
    // 需要await的地方必须await
    "@typescript-eslint/await-thenable": "error"
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}
```

### 6. IDE配置（VS Code/Cursor）

**文件**: `.vscode/settings.json`

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.checkJs": true,
  "typescript.implicitProjectConfig": {
    "checkJs": true,
    "allowJs": true
  }
}
```

---

## 🚀 快速设置步骤

### 第1步：安装依赖

```bash
# 安装所有依赖（包括husky和lint-staged）
pnpm install
```

### 第2步：初始化Husky

```bash
# 初始化husky
pnpm prepare

# 创建pre-commit钩子
npx husky add .husky/pre-commit "pnpm pre-commit"
```

### 第3步：验证配置

```bash
# 检查TypeScript配置
pnpm run type-check

# 检查ESLint配置
pnpm run lint

# 尝试提交（会触发钩子）
git add .
git commit -m "test: verify SpecKit setup"
```

### 第4步：确认一切正常

```bash
✅ pre-commit钩子正常工作
✅ TypeScript类型检查通过
✅ ESLint检查通过
✅ 提交成功
```

---

## 🧪 测试配置

### 测试1：TypeScript类型检查

```bash
# 应该通过
$ pnpm run type-check
✅ Successfully compiled 150 files

# 测试失败情况：创建一个类型错误
$ echo "const x: string = 123;" >> src/test.ts
$ pnpm run type-check
❌ error TS2322: Type 'number' is not assignable to type 'string'
```

### 测试2：Pre-commit钩子

```bash
# 创建一个有问题的文件
$ echo "const unused = 42; const x = 1;" > src/test-bad.ts

# 尝试提交（应该被拒绝）
$ git add src/test-bad.ts
$ git commit -m "test: bad code"
❌ TS2322 and ESLint errors detected
✗ Commit rejected

# 修复文件
$ echo "const x = 1;" > src/test-bad.ts

# 重新提交（应该成功）
$ git add src/test-bad.ts
$ git commit -m "fix: remove unused var"
✅ All checks passed
✓ Commit successful
```

### 测试3：ESLint最大警告数

```bash
# 验证只允许<50个警告
$ pnpm run lint
✅ 45 warnings found (OK)  // 通过

# 如果超过限制
$ pnpm run lint
❌ 150 warnings found (FAIL)  // 失败
```

---

## ⚙️ 故障排除

### 问题1：Pre-commit钩子未执行

**症状**: 提交时没有看到类型检查

**解决方案**:
```bash
# 检查husky安装
ls -la .husky/pre-commit

# 确保文件可执行
chmod +x .husky/pre-commit

# 重新初始化husky
pnpm husky install
```

### 问题2：TypeScript检查超时

**症状**: `pnpm run type-check` 卡住或超时

**解决方案**:
```bash
# 清除TypeScript缓存
rm -rf node_modules/.cache
pnpm clean
pnpm install

# 重新运行检查
pnpm run type-check
```

### 问题3：ESLint规则冲突

**症状**: ESLint和Prettier格式冲突

**解决方案**:
```bash
# 安装prettier-eslint整合
pnpm add -D prettier-eslint eslint-config-prettier eslint-plugin-prettier

# 更新.eslintrc.json
# "extends": [..., "prettier"]
# "plugins": [..., "prettier"]
# "rules": {"prettier/prettier": "warn"}
```

### 问题4：git钩子权限被拒

**症状**: Permission denied: .husky/pre-commit

**解决方案**:
```bash
# 修复权限
chmod +x .husky/pre-commit
chmod +x .husky/_/husky.sh

# 在Windows上，如果仍有问题
git config core.hooksPath .husky
```

---

## 📊 检查清单

部署SpecKit配置时的检查清单：

- [ ] husky已安装且初始化
- [ ] .husky/pre-commit文件存在且可执行
- [ ] package.json中有lint-staged配置
- [ ] package.json中有type-check脚本
- [ ] tsconfig.json包含strict: true
- [ ] .eslintrc配置了最大警告数限制
- [ ] .vscode/settings.json配置了编辑器集成
- [ ] 本地运行`pnpm type-check`通过
- [ ] 本地运行`pnpm lint`通过
- [ ] 尝试提交测试通过
- [ ] CI/CD配置包含type-check步骤
- [ ] PR检查包含ESLint验证

---

## 🔄 CI/CD集成示例

### GitHub Actions配置

**文件**: `.github/workflows/type-check.yml`

```yaml
name: TypeScript检查

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: 安装依赖
        run: pnpm install
      
      - name: TypeScript类型检查
        run: pnpm run type-check
      
      - name: ESLint代码检查
        run: pnpm run lint
      
      - name: 测试覆盖率
        run: pnpm test --coverage
```

### 本地pre-push钩子（可选）

**文件**: `.husky/pre-push`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🚀 推送前最终检查..."

# 运行所有测试
pnpm test || exit 1

# 构建验证
pnpm build || exit 1

echo "✅ 所有检查通过，准备推送"
```

---

## 📚 相关文档

- 📄 SpecKit分析报告：`docs/SPECKIT-FIX-EXECUTION-REPORT.md`
- 📄 完整任务清单：`docs/tasks.md`（附录B包含冲突矩阵）
- 📄 宪章要求：`TEAM_TECHNICAL_CONSTITUTION.md`
- 📄 TypeScript最佳实践：`docs/TYPESCRIPT_DEVELOPMENT_STANDARDS.md`

---

## ✅ 完成标志

当以下条件全部满足时，配置完成：

```bash
✅ pnpm prepare 成功运行
✅ pnpm run type-check 无错误
✅ pnpm run lint 警告<50个
✅ git commit 触发pre-commit钩子
✅ npm run prepare 自动执行
✅ IDE显示实时类型错误
```

---

**更新日期**: 2025-01-17  
**版本**: 1.0.0  
**SpecKit框架**: v1.0  
**状态**: ✅ 完成
