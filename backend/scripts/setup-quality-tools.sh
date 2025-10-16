#!/bin/bash

# 代码质量工具快速设置脚本
# 用于快速配置项目的代码质量检查工具

set -e

echo "🚀 开始设置代码质量工具..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Node.js版本
check_node() {
    print_message "检查Node.js版本..."
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="16.0.0"

    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        print_message "Node.js版本: $NODE_VERSION ✓"
    else
        print_error "Node.js版本过低，需要 >= $REQUIRED_VERSION，当前版本: $NODE_VERSION"
        exit 1
    fi
}

# 安装必要的依赖
install_dependencies() {
    print_message "安装代码质量相关依赖..."

    # ESLint相关
    npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

    # Prettier
    npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier

    # Git Hooks
    npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional

    # 测试覆盖率
    npm install --save-dev @types/jest jest ts-jest

    print_message "依赖安装完成 ✓"
}

# 更新package.json脚本
update_package_scripts() {
    print_message "更新package.json脚本..."

    # 使用node脚本来更新package.json
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

        // 更新脚本
        pkg.scripts = {
            ...pkg.scripts,
            'quality:check': 'node scripts/quality-gate.js',
            'quality:fix': 'node scripts/fix-eslint-errors.js',
            'quality:report': 'node scripts/quality-report.js',
            'prepare': 'husky install',
            'lint:check': 'eslint src --ext .ts --max-warnings 0',
            'format:check': 'prettier --check src/**/*.ts',
            'format:fix': 'prettier --write src/**/*.ts',
            'test:coverage': 'jest --coverage',
            'pre-commit': 'lint-staged',
            'commitlint': 'commitlint --edit'
        };

        // 添加lint-staged配置
        pkg['lint-staged'] = {
            '*.{ts,tsx}': [
                'eslint --fix',
                'prettier --write'
            ]
        };

        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "

    print_message "package.json更新完成 ✓"
}

# 创建Prettier配置
setup_prettier() {
    print_message "设置Prettier配置..."

    cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
EOF

    cat > .prettierignore << 'EOF'
node_modules
dist
coverage
*.log
.env.*
EOF

    print_message "Prettier配置完成 ✓"
}

# 更新ESLint配置
update_eslint_config() {
    print_message "更新ESLint配置..."

    # 备份原配置
    if [ -f .eslintrc.cjs ]; then
        cp .eslintrc.cjs .eslintrc.cjs.backup
    fi

    cat > .eslintrc.cjs << 'EOF'
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/__tests__/**/*',
    'jest.config.ts'
  ],
  rules: {
    // Prettier
    'prettier/prettier': 'error',

    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',

    // 代码质量
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-duplicate-imports': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],

    // 最佳实践
    'no-magic-numbers': ['warn', { ignore: [-1, 0, 1, 2, 100, 1000] }],
    'max-params': ['warn', 4],
    'max-lines-per-function': ['warn', 50],
    'complexity': ['warn', 10]
  }
};
EOF

    print_message "ESLint配置更新完成 ✓"
}

# 设置Commitlint
setup_commitlint() {
    print_message "设置Commitlint..."

    cat > commitlint.config.js << 'EOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复
        'docs',     // 文档
        'style',    // 格式
        'refactor', // 重构
        'perf',     // 性能
        'test',     // 测试
        'chore',    // 构建过程或辅助工具的变动
        'revert',   // 回滚
        'build'     // 构建系统
      ]
    ],
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72]
  }
};
EOF

    print_message "Commitlint配置完成 ✓"
}

# 设置VS Code配置
setup_vscode() {
    print_message "设置VS Code配置..."

    mkdir -p .vscode

    cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "eslint.validate": ["typescript", "javascript"],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/.DS_Store": true
  }
}
EOF

    cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
EOF

    print_message "VS Code配置完成 ✓"
}

# 初始化Husky
setup_husky() {
    print_message "初始化Husky..."

    # 初始化husky
    npx husky install

    # 添加pre-commit hook
    npx husky add .husky/pre-commit "npm run pre-commit"

    # 添加commit-msg hook
    npx husky add .husky/commit-msg "npm run commitlint"

    print_message "Husky初始化完成 ✓"
}

# 创建GitHub Actions工作流
setup_github_actions() {
    print_message "创建GitHub Actions工作流..."

    mkdir -p .github/workflows

    cat > .github/workflows/quality-check.yml << 'EOF'
name: Quality Check

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  quality-check:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Quality check
        run: npm run quality:check

      - name: Upload coverage reports
        if: always()
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
EOF

    print_message "GitHub Actions工作流创建完成 ✓"
}

# 创建质量报告脚本
create_quality_report_script() {
    print_message "创建质量报告脚本..."

    cat > scripts/quality-report.js << 'EOF'
#!/usr/bin/env node

/**
 * 生成代码质量报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class QualityReporter {
  constructor() {
    this.projectRoot = process.cwd();
    this.report = {
      timestamp: new Date().toISOString(),
      metrics: {}
    };
  }

  async generateReport() {
    console.log('📊 生成代码质量报告...');

    // 收集各项指标
    await this.collectMetrics();

    // 生成报告文件
    this.saveReport();

    console.log('✅ 报告生成完成: quality-report.json');
  }

  async collectMetrics() {
    // 文件统计
    const stats = this.analyzeCodebase();
    this.report.metrics = { ...this.report.metrics, ...stats };

    // 依赖统计
    const deps = this.analyzeDependencies();
    this.report.metrics = { ...this.report.metrics, ...deps };
  }

  analyzeCodebase() {
    const srcDir = path.join(this.projectRoot, 'src');
    let totalFiles = 0;
    let totalLines = 0;
    let tsFiles = 0;
    let testFiles = 0;

    function analyze(dir) {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.')) {
          analyze(fullPath);
        } else if (stat.isFile()) {
          totalFiles++;
          if (item.endsWith('.ts')) {
            tsFiles++;
            if (item.includes('.test.') || item.includes('.spec.')) {
              testFiles++;
            }
            const content = fs.readFileSync(fullPath, 'utf8');
            totalLines += content.split('\n').length;
          }
        }
      }
    }

    if (fs.existsSync(srcDir)) {
      analyze(srcDir);
    }

    return {
      totalFiles,
      tsFiles,
      testFiles,
      totalLines,
      avgLinesPerFile: tsFiles > 0 ? Math.round(totalLines / tsFiles) : 0,
      testRatio: tsFiles > 0 ? Math.round((testFiles / tsFiles) * 100) : 0
    };
  }

  analyzeDependencies() {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    return {
      dependencies: deps.length,
      devDependencies: devDeps.length,
      totalDependencies: deps.length + devDeps.length
    };
  }

  saveReport() {
    const reportPath = path.join(this.projectRoot, 'quality-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));

    // 生成Markdown报告
    this.generateMarkdownReport();
  }

  generateMarkdownReport() {
    const { metrics } = this.report;

    const markdown = `# 代码质量报告

生成时间: ${this.report.timestamp}

## 📊 项目统计

- **总文件数**: ${metrics.totalFiles}
- **TypeScript文件**: ${metrics.tsFiles}
- **测试文件**: ${metrics.testFiles}
- **测试覆盖率**: ${metrics.testRatio}%
- **总代码行数**: ${metrics.totalLines}
- **平均文件大小**: ${metrics.avgLinesPerFile} 行

## 📦 依赖统计

- **生产依赖**: ${metrics.dependencies}
- **开发依赖**: ${metrics.devDependencies}
- **总依赖数**: ${metrics.totalDependencies}

## 💡 建议

1. 测试覆盖率目标: 80%+
2. 平均文件大小建议: < 300行
3. 定期更新依赖版本
4. 移除未使用的依赖
`;

    fs.writeFileSync('quality-report.md', markdown);
  }
}

// 运行报告生成器
if (require.main === module) {
  new QualityReporter().generateReport();
}

module.exports = QualityReporter;
EOF

    chmod +x scripts/quality-report.js

    print_message "质量报告脚本创建完成 ✓"
}

# 运行初始检查
run_initial_check() {
    print_message "运行初始质量检查..."

    echo "执行格式化检查..."
    npm run format:check || print_warning "存在格式问题，运行 npm run format:fix 修复"

    echo "执行ESLint检查..."
    npm run lint:check || print_warning "存在ESLint问题，运行 npm run quality:fix 修复"

    echo "执行TypeScript检查..."
    npm run type-check || print_warning "存在TypeScript错误，请修复"

    print_message "初始检查完成 ✓"
}

# 主函数
main() {
    print_message "开始设置代码质量工具..."

    check_node
    install_dependencies
    update_package_scripts
    setup_prettier
    update_eslint_config
    setup_commitlint
    setup_vscode
    setup_husky
    setup_github_actions
    create_quality_report_script
    run_initial_check

    echo ""
    print_message "🎉 代码质量工具设置完成！"
    echo ""
    echo "下一步："
    echo "1. 运行 'npm run quality:fix' 修复现有问题"
    echo "2. 运行 'npm run quality:check' 检查代码质量"
    echo "3. 运行 'npm run quality:report' 生成质量报告"
    echo ""
    echo "提交代码时会自动执行质量检查。"
    echo ""
}

# 运行主函数
main "$@"