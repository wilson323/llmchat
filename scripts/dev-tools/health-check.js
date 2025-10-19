#!/usr/bin/env node

/**
 * LLMChat 项目健康检查工具
 * 实时监控项目状态，快速诊断问题
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
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
  log(`\n🔍 ${title}`, 'cyan');
  log('─'.repeat(50), 'blue');
}

function logStatus(status, message) {
  const icon = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  const color = status === 'healthy' ? 'green' : status === 'warning' ? 'yellow' : 'red';
  log(`${icon} ${message}`, color);
}

// 检查进程是否运行
function checkProcess(processName, port) {
  try {
    const result = execSync(`lsof -i :${port}`, { encoding: 'utf8' });
    return result.includes('LISTEN');
  } catch {
    return false;
  }
}

// 检查端口占用
function checkPort(port) {
  try {
    execSync(`nc -z localhost ${port}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 检查文件系统状态
function checkFileSystem() {
  const issues = [];

  // 检查关键文件
  const criticalFiles = [
    'package.json',
    'pnpm-lock.yaml',
    'frontend/package.json',
    'backend/package.json',
    '.env.example'
  ];

  for (const file of criticalFiles) {
    const filePath = join(projectRoot, file);
    if (!existsSync(filePath)) {
      issues.push({ type: 'missing_file', file, severity: 'error' });
    } else {
      try {
        const stats = statSync(filePath);
        if (stats.size === 0) {
          issues.push({ type: 'empty_file', file, severity: 'warning' });
        }
      } catch {
        issues.push({ type: 'unreadable_file', file, severity: 'error' });
      }
    }
  }

  return issues;
}

// 检查依赖状态
function checkDependencies() {
  const issues = [];

  try {
    // 检查pnpm-lock.yaml一致性
    const lockFile = join(projectRoot, 'pnpm-lock.yaml');
    if (existsSync(lockFile)) {
      try {
        execSync('pnpm ls --depth=0', { stdio: 'pipe', cwd: projectRoot });
      } catch (error) {
        issues.push({
          type: 'dependency_mismatch',
          message: '依赖与锁文件不匹配',
          severity: 'warning'
        });
      }
    }
  } catch (error) {
    issues.push({
      type: 'dependency_check_failed',
      message: error.message,
      severity: 'error'
    });
  }

  return issues;
}

// 检查TypeScript编译状态
function checkTypeScript() {
  const issues = [];

  try {
    const result = execSync('pnpm run type-check', {
      stdio: 'pipe',
      cwd: projectRoot
    });

    logStatus('healthy', 'TypeScript 编译检查通过');
  } catch (error) {
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';

    if (errorOutput.includes('error')) {
      issues.push({
        type: 'typescript_error',
        message: 'TypeScript 编译错误',
        details: errorOutput.split('\n').slice(0, 3).join('\n'),
        severity: 'error'
      });
    } else {
      issues.push({
        type: 'typescript_warning',
        message: 'TypeScript 编译警告',
        severity: 'warning'
      });
    }
  }

  return issues;
}

// 检查代码质量
function checkCodeQuality() {
  const issues = [];

  try {
    execSync('pnpm run lint', { stdio: 'pipe', cwd: projectRoot });
    logStatus('healthy', 'ESLint 代码质量检查通过');
  } catch (error) {
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';
    issues.push({
      type: 'eslint_issues',
      message: 'ESLint 检查发现问题',
      details: errorOutput.split('\n').slice(0, 3).join('\n'),
      severity: 'warning'
    });
  }

  return issues;
}

// 检查测试状态
function checkTests() {
  const issues = [];

  try {
    // 检查前端测试
    execSync('cd frontend && pnpm run test:run', { stdio: 'pipe', cwd: projectRoot });
    logStatus('healthy', '前端测试通过');
  } catch (error) {
    issues.push({
      type: 'frontend_test_failure',
      message: '前端测试失败',
      severity: 'warning'
    });
  }

  try {
    // 检查后端测试
    execSync('cd backend && pnpm test', { stdio: 'pipe', cwd: projectRoot });
    logStatus('healthy', '后端测试通过');
  } catch (error) {
    issues.push({
      type: 'backend_test_failure',
      message: '后端测试失败',
      severity: 'warning'
    });
  }

  return issues;
}

// 检查构建状态
function checkBuild() {
  const issues = [];

  try {
    // 检查前端构建
    execSync('cd frontend && pnpm run build', { stdio: 'pipe', cwd: projectRoot });
    logStatus('healthy', '前端构建成功');
  } catch (error) {
    issues.push({
      type: 'frontend_build_failure',
      message: '前端构建失败',
      severity: 'error'
    });
  }

  try {
    // 检查后端构建
    execSync('cd backend && pnpm run build', { stdio: 'pipe', cwd: projectRoot });
    logStatus('healthy', '后端构建成功');
  } catch (error) {
    issues.push({
      type: 'backend_build_failure',
      message: '后端构建失败',
      severity: 'error'
    });
  }

  return issues;
}

// 检查开发服务器状态
function checkDevServers() {
  const servers = [
    { name: '前端开发服务器', port: 3000, process: 'vite' },
    { name: '后端开发服务器', port: 3001, process: 'node' }
  ];

  for (const server of servers) {
    const isRunning = checkPort(server.port);

    if (isRunning) {
      logStatus('healthy', `${server.name} 正在运行 (端口 ${server.port})`);
    } else {
      logStatus('warning', `${server.name} 未运行 (端口 ${server.port})`);
    }
  }
}

// 检查环境配置
function checkEnvironment() {
  const issues = [];

  // 检查环境变量文件
  const envFiles = [
    { path: '.env.example', required: true },
    { path: '.env', required: false },
    { path: 'backend/.env', required: false }
  ];

  for (const envFile of envFiles) {
    const filePath = join(projectRoot, envFile.path);
    if (existsSync(filePath)) {
      logStatus('healthy', `环境配置文件存在: ${envFile.path}`);
    } else if (envFile.required) {
      issues.push({
        type: 'missing_env_file',
        message: `缺少必需的环境配置文件: ${envFile.path}`,
        severity: 'error'
      });
    } else {
      logStatus('warning', `环境配置文件不存在: ${envFile.path}`);
    }
  }

  // 检查关键环境变量
  const backendEnvPath = join(projectRoot, 'backend/.env');
  if (existsSync(backendEnvPath)) {
    try {
      const envContent = readFileSync(backendEnvPath, 'utf8');
      const requiredVars = ['DATABASE_URL', 'TOKEN_SECRET'];

      for (const varName of requiredVars) {
        if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=`)) {
          logStatus('healthy', `环境变量已配置: ${varName}`);
        } else {
          issues.push({
            type: 'missing_env_var',
            message: `缺少必需的环境变量: ${varName}`,
            severity: 'error'
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'env_file_error',
        message: `无法读取环境配置文件: ${error.message}`,
        severity: 'error'
      });
    }
  }

  return issues;
}

// 性能检查
function checkPerformance() {
  const startTime = performance.now();

  try {
    // 检查TypeScript编译性能
    const tsStartTime = performance.now();
    execSync('pnpm run type-check', { stdio: 'pipe', cwd: projectRoot });
    const tsEndTime = performance.now();
    const tsDuration = tsEndTime - tsStartTime;

    if (tsDuration < 5000) {
      logStatus('healthy', `TypeScript 编译性能良好 (${tsDuration.toFixed(0)}ms)`);
    } else {
      logStatus('warning', `TypeScript 编译较慢 (${tsDuration.toFixed(0)}ms)`);
    }
  } catch {
    logStatus('error', 'TypeScript 编译失败，无法检查性能');
  }

  // 检查依赖安装时间
  const totalDuration = performance.now() - startTime;
  logStatus('healthy', `健康检查完成 (${totalDuration.toFixed(0)}ms)`);
}

// 生成健康报告
function generateHealthReport(allIssues) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: allIssues.length,
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      status: allIssues.some(i => i.severity === 'error') ? 'unhealthy' :
              allIssues.some(i => i.severity === 'warning') ? 'warning' : 'healthy'
    },
    issues: allIssues
  };

  const reportPath = join(projectRoot, 'health-report.json');
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`\n📊 健康报告已生成: ${reportPath}`, 'blue');

  // 显示摘要
  log('\n📈 健康状态摘要:', 'cyan');
  log(`总问题数: ${report.summary.totalIssues}`, 'blue');
  log(`错误: ${report.summary.errors}`, 'red');
  log(`警告: ${report.summary.warnings}`, 'yellow');
  log(`整体状态: ${report.summary.status}`,
    report.summary.status === 'healthy' ? 'green' :
    report.summary.status === 'warning' ? 'yellow' : 'red');

  return report;
}

// 提供修复建议
function provideFixSuggestions(issues) {
  if (issues.length === 0) return;

  log('\n🔧 修复建议:', 'cyan');
  log('─'.repeat(40), 'blue');

  const suggestions = {
    missing_file: '重新创建或恢复缺失的文件',
    empty_file: '检查文件内容，重新编写配置',
    dependency_mismatch: '运行 pnpm install 更新依赖',
    typescript_error: '检查代码类型错误，运行 pnpm run type-check 查看详情',
    eslint_issues: '运行 pnpm run lint:fix 自动修复代码风格问题',
    test_failure: '检查测试代码，确保所有测试通过',
    build_failure: '检查构建错误，修复代码问题',
    missing_env_file: '从 .env.example 复制并配置环境变量',
    missing_env_var: '在环境配置文件中设置必需的环境变量'
  };

  const uniqueIssueTypes = [...new Set(issues.map(i => i.type))];

  for (const issueType of uniqueIssueTypes) {
    const suggestion = suggestions[issueType];
    if (suggestion) {
      log(`• ${suggestion}`, 'white');
    }
  }

  log('\n🚀 快速修复命令:', 'cyan');
  log('pnpm install                    # 更新依赖', 'white');
  log('pnpm run lint:fix               # 修复代码风格', 'white');
  log('pnpm run type-check             # 检查类型错误', 'white');
  log('pnpm test                       # 运行测试', 'white');
  log('pnpm run build                  # 构建项目', 'white');
}

// 主函数
async function main() {
  log('🏥 LLMChat 项目健康检查工具', 'bright');
  log('================================', 'blue');
  log('正在检查项目健康状态...\n', 'blue');

  const allIssues = [];

  // 执行各项检查
  logSection('文件系统检查');
  const fsIssues = checkFileSystem();
  allIssues.push(...fsIssues);

  logSection('依赖状态检查');
  const depIssues = checkDependencies();
  allIssues.push(...depIssues);

  logSection('TypeScript 检查');
  const tsIssues = checkTypeScript();
  allIssues.push(...tsIssues);

  logSection('代码质量检查');
  const qualityIssues = checkCodeQuality();
  allIssues.push(...qualityIssues);

  logSection('测试状态检查');
  const testIssues = checkTests();
  allIssues.push(...testIssues);

  logSection('构建状态检查');
  const buildIssues = checkBuild();
  allIssues.push(...buildIssues);

  logSection('开发服务器状态');
  checkDevServers();

  logSection('环境配置检查');
  const envIssues = checkEnvironment();
  allIssues.push(...envIssues);

  logSection('性能检查');
  checkPerformance();

  // 生成报告
  const report = generateHealthReport(allIssues);

  // 提供修复建议
  if (allIssues.length > 0) {
    provideFixSuggestions(allIssues);
  }

  // 根据健康状态设置退出码
  if (report.summary.status === 'healthy') {
    log('\n🎉 项目状态健康!', 'green');
    process.exit(0);
  } else if (report.summary.status === 'warning') {
    log('\n⚠️ 项目状态良好，但有一些警告', 'yellow');
    process.exit(1);
  } else {
    log('\n❌ 项目存在问题，需要修复', 'red');
    process.exit(2);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runHealthCheck };