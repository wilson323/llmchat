#!/usr/bin/env node

/**
 * LLMChat 开发环境快速设置工具
 * 自动检测和配置开发环境，确保所有依赖和工具正确安装
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 颜色输出工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n🔧 步骤 ${step}: ${message}`, 'cyan');
  log('─'.repeat(60), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// 检查命令是否存在
function checkCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 获取命令版本
function getCommandVersion(command, versionFlag = '--version') {
  try {
    const version = execSync(`${command} ${versionFlag}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    return version;
  } catch {
    return '未知版本';
  }
}

// 检查Node.js环境
function checkNodeEnvironment() {
  logStep(1, '检查 Node.js 环境');

  const nodeVersion = process.version;
  const nodeMajorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  log(`Node.js 版本: ${nodeVersion}`, nodeMajorVersion >= 18 ? 'green' : 'yellow');

  if (nodeMajorVersion < 18) {
    logError('Node.js 版本过低，需要 >= 18.0.0');
    log('建议安装最新的 LTS 版本: https://nodejs.org/', 'blue');
    return false;
  }

  logSuccess('Node.js 版本检查通过');
  return true;
}

// 检查包管理器
function checkPackageManager() {
  logStep(2, '检查包管理器');

  const managers = [
    { name: 'pnpm', command: 'pnpm', required: true },
    { name: 'npm', command: 'npm', required: false },
    { name: 'yarn', command: 'yarn', required: false }
  ];

  let pnpmInstalled = false;

  for (const manager of managers) {
    if (checkCommand(manager.command)) {
      const version = getCommandVersion(manager.command);
      log(`${manager.name} 版本: ${version}`, 'green');

      if (manager.name === 'pnpm') {
        pnpmInstalled = true;
        logSuccess('pnpm 包管理器已安装');
      }
    } else if (manager.required) {
      logError(`${manager.name} 未安装，这是必需的包管理器`);
      log('安装命令: npm install -g pnpm', 'blue');
      return false;
    }
  }

  return pnpmInstalled;
}

// 检查Git环境
function checkGitEnvironment() {
  logStep(3, '检查 Git 环境');

  if (!checkCommand('git')) {
    logError('Git 未安装');
    log('安装指南: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git', 'blue');
    return false;
  }

  const gitVersion = getCommandVersion('git');
  log(`Git 版本: ${gitVersion}`, 'green');

  // 检查Git配置
  try {
    const userName = execSync('git config user.name', { encoding: 'utf8' }).trim();
    const userEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();

    log(`Git 用户名: ${userName}`, 'green');
    log(`Git 邮箱: ${userEmail}`, 'green');

    if (!userName || !userEmail) {
      logWarning('Git 用户配置不完整');
      log('设置命令:', 'blue');
      log('  git config --global user.name "您的姓名"', 'blue');
      log('  git config --global user.email "您的邮箱"', 'blue');
    }
  } catch {
    logWarning('无法获取Git配置，建议设置用户信息');
  }

  logSuccess('Git 环境检查通过');
  return true;
}

// 检查环境变量
function checkEnvironmentVariables() {
  logStep(4, '检查环境变量');

  const envFiles = [
    '.env.example',
    '.env'
  ];

  let envExampleExists = false;
  let envExists = false;

  for (const envFile of envFiles) {
    const filePath = join(projectRoot, envFile);
    if (existsSync(filePath)) {
      log(`找到环境文件: ${envFile}`, 'green');
      if (envFile === '.env.example') envExampleExists = true;
      if (envFile === '.env') envExists = true;
    }
  }

  if (!envExampleExists) {
    logWarning('未找到 .env.example 文件');
  }

  if (!envExists) {
    logWarning('未找到 .env 文件');
    if (envExampleExists) {
      log('建议复制示例文件: cp .env.example .env', 'blue');
    }
  }

  // 检查后端环境变量
  const backendEnvPath = join(projectRoot, 'backend', '.env');
  if (existsSync(backendEnvPath)) {
    log('找到后端环境配置文件', 'green');

    // 检查关键环境变量（不显示实际值）
    try {
      const envContent = readFileSync(backendEnvPath, 'utf8');
      const requiredVars = ['DATABASE_URL', 'TOKEN_SECRET'];

      for (const varName of requiredVars) {
        if (envContent.includes(`${varName}=`)) {
          log(`环境变量 ${varName}: 已配置`, 'green');
        } else {
          logWarning(`环境变量 ${varName}: 未配置`);
        }
      }
    } catch (error) {
      logWarning('无法读取后端环境配置');
    }
  } else {
    logWarning('未找到后端环境配置文件 (backend/.env)');
  }

  logSuccess('环境变量检查完成');
  return true;
}

// 安装项目依赖
function installDependencies() {
  logStep(5, '安装项目依赖');

  try {
    log('正在安装根目录依赖...', 'blue');
    execSync('pnpm install', { stdio: 'inherit', cwd: projectRoot });
    logSuccess('根目录依赖安装完成');

    // 检查workspace依赖
    const workspaces = ['frontend', 'backend', 'shared-types'];
    for (const workspace of workspaces) {
      const workspacePath = join(projectRoot, workspace);
      if (existsSync(workspacePath)) {
        log(`检查 ${workspace} 工作区依赖...`, 'blue');
        // workspace 依赖会通过根目录安装自动处理
      }
    }

    logSuccess('所有依赖安装完成');
    return true;
  } catch (error) {
    logError(`依赖安装失败: ${error.message}`);
    return false;
  }
}

// 检查开发工具
function checkDevelopmentTools() {
  logStep(6, '检查开发工具');

  const tools = [
    { name: 'TypeScript', command: 'tsc', check: () => checkCommand('npx tsc') },
    { name: 'Vite', command: 'vite', check: () => checkCommand('npx vite') },
    { name: 'ESLint', command: 'eslint', check: () => checkCommand('npx eslint') },
    { name: 'Vitest', command: 'vitest', check: () => checkCommand('npx vitest') },
    { name: 'Playwright', command: 'playwright', check: () => checkCommand('npx playwright') }
  ];

  let allToolsAvailable = true;

  for (const tool of tools) {
    if (tool.check()) {
      log(`${tool.name}: 已安装`, 'green');
    } else {
      logWarning(`${tool.name}: 可能未安装或不可用`);
      allToolsAvailable = false;
    }
  }

  // 检查浏览器（用于Playwright）
  if (checkCommand('npx playwright')) {
    try {
      execSync('npx playwright install --dry-run', { stdio: 'ignore' });
      log('Playwright 浏览器: 已安装', 'green');
    } catch {
      logWarning('Playwright 浏览器: 未安装');
      log('安装命令: npx playwright install', 'blue');
    }
  }

  if (allToolsAvailable) {
    logSuccess('开发工具检查通过');
  } else {
    logWarning('部分开发工具可能需要安装');
  }

  return true;
}

// 验证项目结构
function validateProjectStructure() {
  logStep(7, '验证项目结构');

  const requiredDirs = [
    'frontend/src',
    'frontend/public',
    'backend/src',
    'shared-types/src',
    'tests',
    'docs'
  ];

  let structureValid = true;

  for (const dir of requiredDirs) {
    const dirPath = join(projectRoot, dir);
    if (existsSync(dirPath)) {
      log(`目录 ${dir}: 存在`, 'green');
    } else {
      logWarning(`目录 ${dir}: 不存在`);
      structureValid = false;
    }
  }

  // 检查关键配置文件
  const requiredFiles = [
    'package.json',
    'pnpm-lock.yaml',
    'frontend/package.json',
    'backend/package.json',
    'shared-types/package.json',
    'frontend/vite.config.ts',
    'frontend/tsconfig.json',
    'backend/tsconfig.json'
  ];

  for (const file of requiredFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      log(`配置文件 ${file}: 存在`, 'green');
    } else {
      logWarning(`配置文件 ${file}: 不存在`);
      structureValid = false;
    }
  }

  if (structureValid) {
    logSuccess('项目结构验证通过');
  } else {
    logWarning('项目结构可能不完整');
  }

  return true;
}

// 运行基础测试
function runBasicTests() {
  logStep(8, '运行基础测试');

  const tests = [
    { name: 'TypeScript 类型检查', command: 'pnpm run type-check', optional: false },
    { name: 'ESLint 代码检查', command: 'pnpm run lint', optional: true },
    { name: '前端构建测试', command: 'pnpm run frontend:build', optional: true }
  ];

  let allTestsPassed = true;

  for (const test of tests) {
    try {
      log(`运行 ${test.name}...`, 'blue');
      execSync(test.command, { stdio: 'pipe', cwd: projectRoot });
      logSuccess(`${test.name} 通过`);
    } catch (error) {
      if (test.optional) {
        logWarning(`${test.name} 失败（可选测试）`);
      } else {
        logError(`${test.name} 失败`);
        allTestsPassed = false;
      }
    }
  }

  if (allTestsPassed) {
    logSuccess('基础测试通过');
  } else {
    logWarning('部分测试失败，请检查代码');
  }

  return true;
}

// 生成开发环境报告
function generateDevReport(results) {
  logStep(9, '生成开发环境报告');

  const report = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results: results,
    summary: {
      totalChecks: Object.keys(results).length,
      passedChecks: Object.values(results).filter(r => r.status === 'success').length,
      warnings: Object.values(results).filter(r => r.status === 'warning').length,
      errors: Object.values(results).filter(r => r.status === 'error').length
    }
  };

  const reportPath = join(projectRoot, 'dev-setup-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`开发环境报告已生成: ${reportPath}`, 'green');

  // 显示摘要
  log('\n📊 环境设置摘要:', 'cyan');
  log(`总检查项: ${report.summary.totalChecks}`, 'blue');
  log(`通过: ${report.summary.passedChecks}`, 'green');
  log(`警告: ${report.summary.warnings}`, 'yellow');
  log(`错误: ${report.summary.errors}`, 'red');

  const successRate = (report.summary.passedChecks / report.summary.totalChecks * 100).toFixed(1);
  log(`成功率: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

  return true;
}

// 提供下一步建议
function provideNextSteps() {
  log('\n🚀 下一步建议:', 'cyan');
  log('─'.repeat(40), 'blue');

  log('1. 启动开发服务器:', 'blue');
  log('   pnpm run dev', 'white');

  log('\n2. 运行测试:', 'blue');
  log('   pnpm test', 'white');

  log('\n3. 构建项目:', 'blue');
  log('   pnpm run build', 'white');

  log('\n4. 查看可用脚本:', 'blue');
  log('   pnpm run', 'white');

  log('\n5. 阅读开发指南:', 'blue');
  log('   cat CLAUDE.md', 'white');

  log('\n📚 更多工具:', 'cyan');
  log('- 代码生成器: node scripts/dev-tools/code-generator.js', 'blue');
  log('- 调试工具: node scripts/dev-tools/debug-helper.js', 'blue');
  log('- 性能分析: node scripts/dev-tools/performance-profiler.js', 'blue');
}

// 主函数
async function main() {
  log('🚀 LLMChat 开发环境快速设置工具', 'bright');
  log('=====================================', 'blue');
  log('正在检查和配置您的开发环境...\n', 'blue');

  const results = {};

  try {
    // 执行所有检查步骤
    results.nodeEnvironment = await checkNodeEnvironment();
    results.packageManager = await checkPackageManager();
    results.gitEnvironment = await checkGitEnvironment();
    results.environmentVariables = await checkEnvironmentVariables();

    if (results.packageManager) {
      results.dependencies = await installDependencies();
    }

    results.developmentTools = await checkDevelopmentTools();
    results.projectStructure = await validateProjectStructure();
    results.basicTests = await runBasicTests();
    results.reportGeneration = await generateDevReport(results);

    log('\n🎉 开发环境设置完成!', 'green');
    provideNextSteps();

    process.exit(0);

  } catch (error) {
    logError(`设置过程中出现错误: ${error.message}`);
    log('\n🔧 故障排除建议:', 'yellow');
    log('1. 确保网络连接正常', 'white');
    log('2. 检查是否有足够的磁盘空间', 'white');
    log('3. 尝试以管理员权限运行', 'white');
    log('4. 查看详细错误日志', 'white');

    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as setupDevEnvironment };