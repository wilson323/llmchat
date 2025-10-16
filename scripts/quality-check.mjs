#!/usr/bin/env node

/**
 * 项目质量检查脚本
 *
 * 在提交前或CI/CD中运行，确保代码质量符合项目标准
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n🔍 ${title}`, 'blue');
  log('='.repeat(50), 'blue');
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

// 执行命令并处理结果
function runCommand(command, description, allowFailure = false) {
  try {
    log(`\n📋 执行: ${description}`);
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    logSuccess(`${description} - 通过`);
    return { success: true, output: result };
  } catch (error) {
    if (allowFailure) {
      logWarning(`${description} - 警告`);
      return { success: false, error: error.message };
    } else {
      logError(`${description} - 失败`);
      logError(error.stdout || error.message);
      return { success: false, error: error.message };
    }
  }
}

// 检查TypeScript编译
function checkTypeScript() {
  logSection('TypeScript类型检查');

  const frontendResult = runCommand(
    'cd frontend && pnpm run type-check',
    '前端TypeScript检查'
  );

  const backendResult = runCommand(
    'cd backend && pnpm run type-check',
    '后端TypeScript检查'
  );

  return frontendResult.success && backendResult.success;
}

// 检查代码质量
function checkLinting() {
  logSection('代码质量检查');

  const frontendResult = runCommand(
    'cd frontend && pnpm run lint',
    '前端ESLint检查'
  );

  const backendResult = runCommand(
    'cd backend && pnpm run lint',
    '后端ESLint检查'
  );

  return frontendResult.success && backendResult.success;
}

// 检查测试
function checkTests() {
  logSection('测试检查');

  const frontendResult = runCommand(
    'cd frontend && pnpm run test:run',
    '前端单元测试'
  );

  const backendResult = runCommand(
    'cd backend && pnpm test',
    '后端单元测试'
  );

  return frontendResult.success && backendResult.success;
}

// 检查构建
function checkBuild() {
  logSection('构建检查');

  const frontendResult = runCommand(
    'cd frontend && pnpm run build',
    '前端构建'
  );

  const backendResult = runCommand(
    'cd backend && pnpm run build',
    '后端构建'
  );

  return frontendResult.success && backendResult.success;
}

// 检查安全性
function checkSecurity() {
  logSection('安全检查');

  // 检查依赖漏洞
  const auditResult = runCommand(
    'pnpm audit --audit-level high',
    '依赖安全审计',
    true // 允许失败，但会警告
  );

  if (!auditResult.success) {
    logWarning('发现高安全漏洞，请及时修复');
  }

  return true; // 安全检查不阻止构建
}

// 检查文件大小
function checkFileSize() {
  logSection('文件大小检查');

  const checkDirectory = (dirPath, maxSizeMB, description) => {
    try {
      const stats = fs.statSync(dirPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        let largeFiles = [];

        files.forEach(file => {
          if (file.isFile()) {
            const filePath = path.join(dirPath, file.name);
            const fileStats = fs.statSync(filePath);

            if (fileStats.size > maxSizeMB * 1024 * 1024) {
              largeFiles.push({
                name: file.name,
                size: (fileStats.size / 1024 / 1024).toFixed(2)
              });
            }
          }
        });

        if (largeFiles.length > 0) {
          logWarning(`${description} 发现大文件:`);
          largeFiles.forEach(file => {
            logWarning(`  - ${file.name}: ${file.size}MB`);
          });
        } else {
          logSuccess(`${description} 文件大小正常`);
        }
      }
    } catch (error) {
      logWarning(`无法检查 ${description}: ${error.message}`);
    }
  };

  // 检查构建产物大小
  try {
    checkDirectory('./frontend/dist', 10, '前端构建产物');
    checkDirectory('./backend/dist', 50, '后端构建产物');
  } catch (error) {
    logWarning('构建产物目录不存在，跳过文件大小检查');
  }

  return true;
}

// 检查Git状态
function checkGitStatus() {
  logSection('Git状态检查');

  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    const lines = status.trim().split('\n');

    if (lines.length === 0) {
      logSuccess('工作目录干净');
    } else {
      logWarning(`发现 ${lines.length} 个未提交的文件:`);
      lines.slice(0, 10).forEach(line => {
        logWarning(`  ${line}`);
      });
      if (lines.length > 10) {
        logWarning(`  ... 还有 ${lines.length - 10} 个文件`);
      }
    }
  } catch (error) {
    logWarning('无法获取Git状态');
  }

  return true;
}

// 生成质量报告
function generateReport(results) {
  logSection('质量检查报告');

  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    results,
    summary: {
      passed: Object.values(results).filter(Boolean).length,
      total: Object.keys(results).length,
      overall: Object.values(results).every(Boolean) ? 'PASS' : 'FAIL'
    }
  };

  // 保存报告
  const reportPath = './quality-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logSuccess(`质量报告已保存到: ${reportPath}`);

  // 输出摘要
  log(`\n📊 检查摘要:`, report.summary.overall === 'PASS' ? 'green' : 'red');
  log(`通过: ${report.summary.passed}/${report.summary.total}`);
  log(`状态: ${report.summary.overall}`);

  return report.summary.overall === 'PASS';
}

// 主函数
function main() {
  log('🚀 开始项目质量检查', 'blue');
  log('检查时间:', new Date().toLocaleString());

  const results = {};

  // 执行各项检查
  results.typeScript = checkTypeScript();
  results.linting = checkLinting();
  results.tests = checkTests();
  results.build = checkBuild();
  results.security = checkSecurity();
  results.fileSize = checkFileSize();
  results.gitStatus = checkGitStatus();

  // 生成报告
  const passed = generateReport(results);

  // 退出码
  if (passed) {
    log('\n🎉 所有质量检查通过！', 'green');
    process.exit(0);
  } else {
    log('\n💥 质量检查失败，请修复问题后重试', 'red');
    process.exit(1);
  }
}

// 处理命令行参数
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const skipTests = args.includes('--skip-tests');

if (skipBuild) {
  log('⚠️  跳过构建检查');
}
if (skipTests) {
  log('⚠️  跳过测试检查');
}

// 运行检查
main().catch(error => {
  logError(`质量检查脚本执行失败: ${error.message}`);
  process.exit(1);
});