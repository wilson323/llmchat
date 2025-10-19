#!/usr/bin/env node

/**
 * LLMChat CI/CD 流水线工具
 * 持续集成和持续部署自动化
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

// 项目根目录
const projectRoot = join(__dirname, '../..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n🔄 ${title}`, 'cyan');
  log('─'.repeat(60), 'blue');
}

function logStage(stage, status = 'running') {
  const icon = status === 'running' ? '⏳' : status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
  const color = status === 'success' ? 'green' : status === 'error' ? 'red' : 'yellow';
  log(`${icon} ${stage}`, color);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// CI/CD 配置
const ciConfig = {
  stages: [
    {
      name: '环境准备',
      description: '准备 CI/CD 环境',
      steps: [
        { name: '检查环境', command: 'node scripts/dev-tools/health-check.js', critical: true },
        { name: '安装依赖', command: 'pnpm install --frozen-lockfile', critical: true },
        { name: '缓存依赖', command: 'echo "缓存 node_modules"', critical: false }
      ]
    },
    {
      name: '代码质量检查',
      description: '检查代码质量和规范',
      steps: [
        { name: '类型检查', command: 'pnpm run type-check', critical: true, parallel: true },
        { name: '代码风格检查', command: 'pnpm run lint', critical: true, parallel: true },
        { name: '安全扫描', command: 'pnpm run security:audit', critical: true, parallel: true }
      ]
    },
    {
      name: '测试',
      description: '运行自动化测试',
      steps: [
        { name: '单元测试', command: 'pnpm test', critical: true },
        { name: '集成测试', command: 'pnpm run test:e2e', critical: false },
        { name: '性能测试', command: 'pnpm run test:perf:quick', critical: false }
      ]
    },
    {
      name: '构建',
      description: '构建应用程序',
      steps: [
        { name: '清理构建目录', command: 'rm -rf frontend/dist backend/dist', critical: false },
        { name: '前端构建', command: 'pnpm run frontend:build', critical: true },
        { name: '后端构建', command: 'pnpm run backend:build', critical: true },
        { name: '构建验证', command: 'ls -la frontend/dist backend/dist', critical: false }
      ]
    },
    {
      name: '部署准备',
      description: '准备部署包',
      steps: [
        { name: '生成构建信息', command: 'node scripts/dev-tools/build-info.js', critical: false },
        { name: '创建部署包', command: 'tar -czf deployment.tar.gz frontend/dist backend/dist', critical: false },
        { name: '生成部署清单', command: 'echo "生成部署清单"', critical: false }
      ]
    }
  ],

  // 环境配置
  environments: {
    development: {
      name: '开发环境',
      description: '开发环境部署',
      variables: {
        NODE_ENV: 'development',
        API_URL: 'http://localhost:3001'
      }
    },
    staging: {
      name: '测试环境',
      description: '测试环境部署',
      variables: {
        NODE_ENV: 'staging',
        API_URL: 'https://staging-api.llmchat.com'
      }
    },
    production: {
      name: '生产环境',
      description: '生产环境部署',
      variables: {
        NODE_ENV: 'production',
        API_URL: 'https://api.llmchat.com'
      }
    }
  }
};

// CI/CD 执行器
class CIPipeline {
  constructor(config = ciConfig) {
    this.config = config;
    this.results = [];
    this.startTime = performance.now();
    this.environment = process.env.CI_ENVIRONMENT || 'development';
  }

  async run() {
    log('🔄 LLMChat CI/CD 流水线', 'bright');
    log('========================', 'blue');
    log(`环境: ${this.environment}`, 'cyan');
    log(`分支: ${process.env.CI_BRANCH || 'unknown'}`, 'cyan');
    log(`提交: ${process.env.CI_COMMIT || 'unknown'}`, 'cyan');
    log('', 'reset');

    try {
      // 设置环境变量
      this.setupEnvironment();

      // 执行所有阶段
      for (const stage of this.config.stages) {
        await this.runStage(stage);
      }

      // 生成报告
      const report = this.generateReport();

      logSuccess('CI/CD 流水线执行成功');
      return report;

    } catch (error) {
      logError(`CI/CD 流水线失败: ${error.message}`);
      this.generateReport();
      throw error;
    }
  }

  setupEnvironment() {
    const env = this.config.environments[this.environment];
    if (env) {
      logSection(`设置环境: ${env.name}`);
      log(env.description, 'blue');

      Object.entries(env.variables).forEach(([key, value]) => {
        process.env[key] = value;
        log(`  ${key}=${value}`, 'white');
      });
    }
  }

  async runStage(stage) {
    logSection(stage.name);
    log(stage.description, 'blue');

    const stageResults = [];
    const parallelSteps = stage.steps.filter(step => step.parallel);
    const serialSteps = stage.steps.filter(step => !step.parallel);

    // 先执行并行步骤
    if (parallelSteps.length > 0) {
      log('执行并行步骤...', 'yellow');
      const parallelPromises = parallelSteps.map(step => this.runStep(step));
      const parallelResults = await Promise.allSettled(parallelPromises);

      parallelResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          stageResults.push(result.value);
        } else {
          const step = parallelSteps[index];
          stageResults.push({
            name: step.name,
            status: 'error',
            error: result.reason.message
          });
        }
      });
    }

    // 再执行串行步骤
    for (const step of serialSteps) {
      try {
        const result = await this.runStep(step);
        stageResults.push(result);
      } catch (error) {
        stageResults.push({
          name: step.name,
          status: 'error',
          error: error.message
        });

        if (step.critical) {
          throw new Error(`关键步骤失败: ${step.name}`);
        }
      }
    }

    // 检查阶段结果
    const hasErrors = stageResults.some(r => r.status === 'error');
    if (hasErrors) {
      logWarning(`阶段 "${stage.name}" 包含错误，但继续执行`);
    } else {
      logSuccess(`阶段 "${stage.name}" 完成`);
    }

    this.results.push({
      stage: stage.name,
      steps: stageResults
    });
  }

  async runStep(step) {
    logStage(step.name, 'running');
    const startTime = performance.now();

    try {
      const result = await this.executeCommand(step.command);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const stepResult = {
        name: step.name,
        command: step.command,
        status: 'success',
        duration: duration.toFixed(2),
        output: result.stdout,
        startTime: new Date(startTime).toISOString()
      };

      logStage(step.name, 'success');
      log(`  耗时: ${duration.toFixed(2)}ms`, 'blue');

      return stepResult;

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const stepResult = {
        name: step.name,
        command: step.command,
        status: 'error',
        duration: duration.toFixed(2),
        error: error.message,
        output: error.stdout,
        startTime: new Date(startTime).toISOString()
      };

      logStage(step.name, 'error');
      log(`  错误: ${error.message}`, 'red');

      if (step.critical) {
        throw error;
      }

      return stepResult;
    }
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          const error = new Error(`命令执行失败 (退出码: ${code}): ${command}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  generateReport() {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      branch: process.env.CI_BRANCH || 'unknown',
      commit: process.env.CI_COMMIT || 'unknown',
      totalDuration: totalDuration.toFixed(2),
      stages: this.results,
      summary: this.calculateSummary()
    };

    // 保存 JSON 报告
    const reportPath = join(projectRoot, 'ci-pipeline-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 显示摘要
    logSection('流水线执行摘要');
    log(`总耗时: ${totalDuration.toFixed(2)}ms`, 'cyan');
    log(`环境: ${report.environment}`, 'blue');
    log(`总阶段数: ${report.summary.totalStages}`, 'blue');
    log(`成功阶段: ${report.summary.successStages}`, 'green');
    log(`失败阶段: ${report.summary.errorStages}`, 'red');

    logSuccess(`详细报告已保存: ${reportPath}`);
    return report;
  }

  calculateSummary() {
    const totalSteps = this.results.reduce((sum, stage) => sum + stage.steps.length, 0);
    const successSteps = this.results.reduce((sum, stage) =>
      sum + stage.steps.filter(step => step.status === 'success').length, 0);
    const errorSteps = totalSteps - successSteps;

    return {
      totalStages: this.results.length,
      totalSteps,
      successSteps,
      errorSteps,
      successRate: ((successSteps / totalSteps) * 100).toFixed(2)
    };
  }
}

// GitHub Actions 工作流生成器
function generateGitHubActions() {
  logSection('生成 GitHub Actions 工作流');

  const workflows = {
    'ci.yml': `name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  PNPM_VERSION: '8.15.0'

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: \${{ env.PNPM_VERSION }}

    - name: Get pnpm store directory
      shell: bash
      run: |
        echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

    - name: Setup pnpm cache
      uses: actions/cache@v3
      with:
        path: \${{ env.STORE_PATH }}
        key: \${{ runner.os }}-pnpm-store-\${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: |
          \${{ runner.os }}-pnpm-store-

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Type check
      run: pnpm run type-check

    - name: Lint
      run: pnpm run lint

    - name: Run tests
      run: pnpm test

    - name: Build
      run: pnpm run build

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info`,

    'deploy.yml': `name: Deploy

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  NODE_VERSION: '18'

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: test

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8.15.0

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build
      run: pnpm run build

    - name: Deploy to staging
      if: github.ref == 'refs/heads/develop'
      run: |
        echo "Deploying to staging environment"
        # Add your deployment commands here

    - name: Deploy to production
      if: github.ref == 'refs/heads/main'
      run: |
        echo "Deploying to production environment"
        # Add your deployment commands here`,

    'security.yml': `name: Security Scan

on:
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8.15.0

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Run security audit
      run: pnpm audit --audit-level moderate

    - name: Run security check
      run: pnpm run security:check`
  };

  // 创建 .github/workflows 目录
  const workflowsDir = join(projectRoot, '.github/workflows');
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
  }

  // 写入工作流文件
  Object.entries(workflows).forEach(([filename, content]) => {
    const filePath = join(workflowsDir, filename);
    writeFileSync(filePath, content);
    logSuccess(`生成工作流文件: ${filename}`);
  });

  logInfo('GitHub Actions 工作流已生成');
  logInfo('请检查 .github/workflows/ 目录中的文件', 'blue');
}

// Docker 配置生成器
function generateDockerConfig() {
  logSection('生成 Docker 配置');

  const dockerfile = `# 多阶段构建 Dockerfile
FROM node:18-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm@8.15.0

# 设置工作目录
WORKDIR /app

# 复制 package.json 文件
COPY package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 生产阶段
FROM node:18-alpine AS production

# 安装 pnpm
RUN npm install -g pnpm@8.15.0

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package.json pnpm-lock.yaml ./

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3001/health || exit 1

# 启动应用
CMD ["node", "backend/dist/index.js"]`;

  const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@postgres:5432/llmchat
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=llmchat
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:`;

  // 写入 Dockerfile
  const dockerfilePath = join(projectRoot, 'Dockerfile');
  writeFileSync(dockerfilePath, dockerfile);
  logSuccess('生成 Dockerfile');

  // 写入 docker-compose.yml
  const dockerComposePath = join(projectRoot, 'docker-compose.yml');
  writeFileSync(dockerComposePath, dockerCompose);
  logSuccess('生成 docker-compose.yml');

  logInfo('Docker 配置已生成');
  logInfo('使用命令:', 'blue');
  log('  docker build -t llmchat .', 'white');
  log('  docker-compose up -d', 'white');
}

// 显示使用说明
function showUsage() {
  log('🔄 LLMChat CI/CD 流水线工具', 'bright');
  log('============================', 'blue');
  log('\n用法:', 'cyan');
  log('  node ci-pipeline.js [选项]', 'white');
  log('\n选项:', 'cyan');
  log('  --run           运行 CI/CD 流水线', 'white');
  log('  --env <环境>    指定环境 (development/staging/production)', 'white');
  log('  --github-actions 生成 GitHub Actions 工作流', 'white');
  log('  --docker        生成 Docker 配置', 'white');
  log('  --help          显示帮助信息', 'white');
  log('\n环境变量:', 'cyan');
  log('  CI_ENVIRONMENT 部署环境', 'white');
  log('  CI_BRANCH      Git 分支', 'white');
  log('  CI_COMMIT      Git 提交哈希', 'white');
  log('\n示例:', 'cyan');
  log('  CI_ENVIRONMENT=staging node ci-pipeline.js --run', 'white');
  log('  node ci-pipeline.js --github-actions', 'white');
  log('  node ci-pipeline.js --docker', 'white');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  try {
    if (args.includes('--github-actions')) {
      generateGitHubActions();
      return;
    }

    if (args.includes('--docker')) {
      generateDockerConfig();
      return;
    }

    if (args.includes('--run')) {
      const envIndex = args.indexOf('--env');
      const environment = envIndex !== -1 ? args[envIndex + 1] : 'development';

      process.env.CI_ENVIRONMENT = environment;
      process.env.CI_BRANCH = process.env.GITHUB_BRANCH || process.env.GIT_BRANCH || 'main';
      process.env.CI_COMMIT = process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'unknown';

      const pipeline = new CIPipeline();
      await pipeline.run();
      return;
    }

    logError('未知选项，请使用 --help 查看帮助信息');
    process.exit(1);

  } catch (error) {
    logError(`CI/CD 流水线执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runCIPipeline, CIPipeline, ciConfig };