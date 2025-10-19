#!/usr/bin/env node

/**
 * LLMChat 调试助手工具
 * 提供全面的调试和诊断功能
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
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
  log(`\n🐛 ${title}`, 'cyan');
  log('─'.repeat(60), 'blue');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
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

// 系统信息检查
function checkSystemInfo() {
  logSection('系统信息检查');

  const info = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    nodeVersionMajor: parseInt(process.version.slice(1).split('.')[0]),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    pid: process.pid
  };

  log(`平台: ${info.platform}`, 'white');
  log(`架构: ${info.arch}`, 'white');
  log(`Node.js 版本: ${info.nodeVersion}`, info.nodeVersionMajor >= 18 ? 'green' : 'yellow');
  log(`进程 ID: ${info.pid}`, 'white');
  log(`运行时间: ${(info.uptime / 60).toFixed(2)} 分钟`, 'white');
  log(`内存使用: ${(info.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`, 'white');

  // 检查系统资源
  try {
    const cpuUsage = process.cpuUsage();
    log(`CPU 使用 (用户): ${cpuUsage.user} 微秒`, 'white');
    log(`CPU 使用 (系统): ${cpuUsage.system} 微秒`, 'white');
  } catch (error) {
    logWarning('无法获取 CPU 使用信息');
  }

  return info;
}

// 端口检查工具
function checkPorts() {
  logSection('端口状态检查');

  const ports = [
    { name: '前端开发服务器', port: 3000, process: 'vite' },
    { name: '后端开发服务器', port: 3001, process: 'node' },
    { name: '数据库 (PostgreSQL)', port: 5432, process: 'postgres' },
    { name: 'Redis', port: 6379, process: 'redis' },
    { name: '测试服务器', port: 3100, process: 'vitest' }
  ];

  for (const portInfo of ports) {
    try {
      // 使用 netcat 检查端口
      execSync(`nc -z localhost ${portInfo.port} -w 1`, { stdio: 'ignore' });
      logSuccess(`${portInfo.name} (端口 ${portInfo.port}): 运行中`);

      // 获取进程信息
      try {
        const processInfo = execSync(`lsof -ti:${portInfo.port}`, { encoding: 'utf8' });
        const pid = processInfo.trim();
        const cmd = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' }).trim();
        log(`  进程: ${cmd} (PID: ${pid})`, 'white');
      } catch {
        logWarning(`  无法获取进程信息`);
      }
    } catch {
      logWarning(`${portInfo.name} (端口 ${portInfo.port}): 未运行`);
    }
  }
}

// 网络连接检查
function checkNetworkConnectivity() {
  logSection('网络连接检查');

  const endpoints = [
    { name: '本地后端 API', url: 'http://localhost:3001/health' },
    { name: '本地前端', url: 'http://localhost:3000' },
    { name: '外部网络', url: 'https://www.google.com' }
  ];

  for (const endpoint of endpoints) {
    try {
      const startTime = performance.now();
      execSync(`curl -s --max-time 5 "${endpoint.url}" > /dev/null`, { stdio: 'ignore' });
      const endTime = performance.now();
      const responseTime = (endTime - startTime).toFixed(0);

      logSuccess(`${endpoint.name}: 可连接 (${responseTime}ms)`);
    } catch (error) {
      logError(`${endpoint.name}: 连接失败`);
    }
  }
}

// 依赖分析工具
function analyzeDependencies() {
  logSection('依赖分析');

  try {
    // 检查 package.json
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      logInfo(`根目录依赖数: ${Object.keys(packageJson.dependencies || {}).length}`);
      logInfo(`根目录开发依赖数: ${Object.keys(packageJson.devDependencies || {}).length}`);
    }

    // 检查前端依赖
    const frontendPackagePath = join(projectRoot, 'frontend/package.json');
    if (existsSync(frontendPackagePath)) {
      const frontendPackageJson = JSON.parse(readFileSync(frontendPackagePath, 'utf8'));
      logInfo(`前端依赖数: ${Object.keys(frontendPackageJson.dependencies || {}).length}`);
      logInfo(`前端开发依赖数: ${Object.keys(frontendPackageJson.devDependencies || {}).length}`);
    }

    // 检查后端依赖
    const backendPackagePath = join(projectRoot, 'backend/package.json');
    if (existsSync(backendPackagePath)) {
      const backendPackageJson = JSON.parse(readFileSync(backendPackagePath, 'utf8'));
      logInfo(`后端依赖数: ${Object.keys(backendPackageJson.dependencies || {}).length}`);
      logInfo(`后端开发依赖数: ${Object.keys(backendPackageJson.devDependencies || {}).length}`);
    }

    // 检查 pnpm-lock.yaml 一致性
    const lockFilePath = join(projectRoot, 'pnpm-lock.yaml');
    if (existsSync(lockFilePath)) {
      try {
        execSync('pnpm ls --depth=0', { stdio: 'pipe', cwd: projectRoot });
        logSuccess('依赖与锁文件一致');
      } catch (error) {
        logWarning('依赖与锁文件不一致，建议运行 pnpm install');
      }
    }

  } catch (error) {
    logError(`依赖分析失败: ${error.message}`);
  }
}

// 错误日志分析
function analyzeErrorLogs() {
  logSection('错误日志分析');

  const logPaths = [
    { name: '后端日志', path: 'backend/logs' },
    { name: '前端构建日志', path: 'frontend/dist' },
    { name: '测试日志', path: 'coverage' }
  ];

  for (const logPath of logPaths) {
    const fullPath = join(projectRoot, logPath.path);
    if (existsSync(fullPath)) {
      try {
        const stats = require('fs').statSync(fullPath);
        if (stats.isDirectory()) {
          const files = require('fs').readdirSync(fullPath);
          const logFiles = files.filter(file =>
            file.includes('.log') || file.includes('error') || file.includes('debug')
          );

          if (logFiles.length > 0) {
            logInfo(`${logPath.name}: 找到 ${logFiles.length} 个日志文件`);
            logFiles.slice(0, 3).forEach(file => {
              log(`  - ${file}`, 'white');
            });
          }
        }
      } catch (error) {
        logWarning(`无法读取 ${logPath.name}`);
      }
    } else {
      logInfo(`${logPath.name}: 目录不存在`);
    }
  }
}

// 环境变量诊断
function diagnoseEnvironmentVariables() {
  logSection('环境变量诊断');

  const envFiles = [
    { path: '.env.example', required: true },
    { path: '.env', required: false },
    { path: 'backend/.env', required: false },
    { path: 'frontend/.env', required: false }
  ];

  for (const envFile of envFiles) {
    const filePath = join(projectRoot, envFile.path);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line =>
          line.trim() && !line.startsWith('#') && line.includes('=')
        );

        logSuccess(`${envFile.path}: ${lines.length} 个环境变量`);

        // 检查关键变量
        const criticalVars = ['DATABASE_URL', 'TOKEN_SECRET', 'FRONTEND_URL'];
        const missingVars = criticalVars.filter(varName =>
          !content.includes(`${varName}=`) || content.includes(`${varName}=`)
        );

        if (missingVars.length > 0) {
          logWarning(`  缺少关键变量: ${missingVars.join(', ')}`);
        }

      } catch (error) {
        logError(`${envFile.path}: 读取失败`);
      }
    } else if (envFile.required) {
      logError(`${envFile.path}: 必需文件不存在`);
    } else {
      logInfo(`${envFile.path}: 文件不存在`);
    }
  }
}

// TypeScript 编译诊断
function diagnoseTypeScript() {
  logSection('TypeScript 编译诊断');

  try {
    // 前端 TypeScript 检查
    logInfo('检查前端 TypeScript...');
    const frontendResult = execSync('cd frontend && pnpm run type-check', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (frontendResult) {
      logSuccess('前端 TypeScript 编译正常');
    }

  } catch (error) {
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';

    if (errorOutput) {
      logError('前端 TypeScript 编译错误:');
      const lines = errorOutput.split('\n').slice(0, 5);
      lines.forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, 'white');
        }
      });
    }
  }

  try {
    // 后端 TypeScript 检查
    logInfo('检查后端 TypeScript...');
    const backendResult = execSync('cd backend && pnpm run build', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    logSuccess('后端 TypeScript 编译正常');

  } catch (error) {
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';

    if (errorOutput) {
      logError('后端 TypeScript 编译错误:');
      const lines = errorOutput.split('\n').slice(0, 5);
      lines.forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, 'white');
        }
      });
    }
  }
}

// 测试诊断
function diagnoseTests() {
  logSection('测试诊断');

  try {
    // 前端测试
    logInfo('运行前端测试...');
    execSync('cd frontend && pnpm run test:run', { stdio: 'pipe', cwd: projectRoot });
    logSuccess('前端测试通过');

  } catch (error) {
    logError('前端测试失败');
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';
    if (errorOutput) {
      const lines = errorOutput.split('\n').slice(0, 3);
      lines.forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, 'white');
        }
      });
    }
  }

  try {
    // 后端测试
    logInfo('运行后端测试...');
    execSync('cd backend && pnpm test', { stdio: 'pipe', cwd: projectRoot });
    logSuccess('后端测试通过');

  } catch (error) {
    logError('后端测试失败');
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';
    if (errorOutput) {
      const lines = errorOutput.split('\n').slice(0, 3);
      lines.forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, 'white');
        }
      });
    }
  }
}

// 性能诊断
function diagnosePerformance() {
  logSection('性能诊断');

  // 测量 TypeScript 编译时间
  const startTsTime = performance.now();
  try {
    execSync('pnpm run type-check', { stdio: 'pipe', cwd: projectRoot });
    const endTsTime = performance.now();
    const tsDuration = endTsTime - startTsTime;

    if (tsDuration < 3000) {
      logSuccess(`TypeScript 编译性能良好 (${tsDuration.toFixed(0)}ms)`);
    } else if (tsDuration < 10000) {
      logWarning(`TypeScript 编译较慢 (${tsDuration.toFixed(0)}ms)`);
    } else {
      logError(`TypeScript 编译很慢 (${tsDuration.toFixed(0)}ms)`);
    }
  } catch {
    logError('TypeScript 编译失败，无法测量性能');
  }

  // 测量构建时间
  const startBuildTime = performance.now();
  try {
    execSync('cd frontend && pnpm run build', { stdio: 'pipe', cwd: projectRoot });
    const endBuildTime = performance.now();
    const buildDuration = endBuildTime - startBuildTime;

    if (buildDuration < 10000) {
      logSuccess(`前端构建性能良好 (${buildDuration.toFixed(0)}ms)`);
    } else if (buildDuration < 30000) {
      logWarning(`前端构建较慢 (${buildDuration.toFixed(0)}ms)`);
    } else {
      logError(`前端构建很慢 (${buildDuration.toFixed(0)}ms)`);
    }
  } catch {
    logError('前端构建失败，无法测量性能');
  }

  // 检查内存使用
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;

  log(`堆内存使用: ${heapUsedMB.toFixed(2)} MB / ${heapTotalMB.toFixed(2)} MB`, 'white');
  log(`外部内存: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`, 'white');

  if (heapUsedMB > 500) {
    logWarning('内存使用较高，建议优化');
  }
}

// 生成诊断报告
function generateDiagnosticReport(results) {
  logSection('生成诊断报告');

  const report = {
    timestamp: new Date().toISOString(),
    system: results.systemInfo,
    summary: {
      totalChecks: Object.keys(results).length,
      issues: [],
      warnings: [],
      performance: {
        tsCompileTime: results.performance?.tsCompileTime,
        buildTime: results.performance?.buildTime,
        memoryUsage: results.systemInfo?.memory
      }
    }
  };

  const reportPath = join(projectRoot, 'debug-diagnostic-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  logSuccess(`诊断报告已生成: ${reportPath}`);
}

// 提供修复建议
function provideFixSuggestions(results) {
  logSection('修复建议');

  const suggestions = [
    '🔧 常见问题解决方案:',
    '',
    '1. TypeScript 编译错误:',
    '   - 检查类型定义是否正确',
    '   - 运行 pnpm run type-check 查看详细错误',
    '   - 确保所有依赖都已正确安装',
    '',
    '2. 端口占用问题:',
    '   - 使用 lsof -i:端口号 查看占用进程',
    '   - 使用 kill -9 PID 强制结束进程',
    '   - 修改配置文件使用其他端口',
    '',
    '3. 依赖问题:',
    '   - 运行 pnpm install 更新依赖',
    '   - 删除 node_modules 和 pnpm-lock.yaml 后重新安装',
    '   - 检查依赖版本兼容性',
    '',
    '4. 性能问题:',
    '   - 检查是否有内存泄漏',
    '   - 优化 TypeScript 配置',
    '   - 减少不必要的依赖',
    '',
    '5. 环境变量问题:',
    '   - 从 .env.example 复制配置到 .env',
    '   - 检查必需的环境变量是否已设置',
    '   - 确保环境变量格式正确'
  ];

  suggestions.forEach(line => {
    log(line, line.startsWith('🔧') || line.match(/^\d+\./) ? 'cyan' : 'white');
  });

  log('\n🚀 快速修复命令:', 'cyan');
  log('pnpm install                    # 重新安装依赖', 'white');
  log('pnpm run type-check             # 检查类型错误', 'white');
  log('pnpm run lint:fix               # 修复代码风格', 'white');
  log('pnpm test                       # 运行测试', 'white');
  log('rm -rf node_modules pnpm-lock.yaml && pnpm install  # 完全重装依赖', 'white');
}

// 实时监控模式
function startRealTimeMonitoring() {
  logSection('启动实时监控');

  log('按 Ctrl+C 停止监控', 'yellow');
  log('监控间隔: 5 秒', 'blue');

  const monitor = setInterval(() => {
    console.clear();
    log('🐛 LLMChat 实时监控', 'bright');
    log('=================', 'blue');
    log(`时间: ${new Date().toLocaleString()}`, 'cyan');
    log('', 'reset');

    // 检查关键服务状态
    const criticalPorts = [3000, 3001];
    let allRunning = true;

    criticalPorts.forEach(port => {
      try {
        execSync(`nc -z localhost ${port}`, { stdio: 'ignore' });
        logSuccess(`端口 ${port}: 运行中`);
      } catch {
        logError(`端口 ${port}: 未运行`);
        allRunning = false;
      }
    });

    // 检查内存使用
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    log(`内存使用: ${heapUsedMB} MB`, 'white');

    if (allRunning) {
      logSuccess('所有关键服务运行正常');
    } else {
      logWarning('部分服务未运行');
    }

    log('\n监控中... (Ctrl+C 退出)', 'blue');
  }, 5000);

  // 监听退出信号
  process.on('SIGINT', () => {
    clearInterval(monitor);
    log('\n👋 监控已停止', 'green');
    process.exit(0);
  });
}

// 显示使用说明
function showUsage() {
  log('🐛 LLMChat 调试助手工具', 'bright');
  log('========================', 'blue');
  log('\n用法:', 'cyan');
  log('  node debug-helper.js [命令]', 'white');
  log('\n命令:', 'cyan');
  log('  full          - 运行完整诊断 (默认)', 'white');
  log('  monitor       - 启动实时监控', 'white');
  log('  system        - 仅检查系统信息', 'white');
  log('  ports         - 仅检查端口状态', 'white');
  log('  deps          - 仅分析依赖', 'white');
  log('  ts            - 仅诊断 TypeScript', 'white');
  log('  tests         - 仅诊断测试', 'white');
  log('  performance   - 仅诊断性能', 'white');
  log('\n示例:', 'cyan');
  log('  node debug-helper.js full', 'white');
  log('  node debug-helper.js monitor', 'white');
  log('  node debug-helper.js ts', 'white');
}

// 主函数
async function main() {
  const command = process.argv[2] || 'full';

  if (command === '--help' || command === '-h') {
    showUsage();
    return;
  }

  if (command === 'monitor') {
    startRealTimeMonitoring();
    return;
  }

  log('🐛 LLMChat 调试助手工具', 'bright');
  log('========================', 'blue');
  log(`诊断模式: ${command}`, 'cyan');
  log('', 'reset');

  const startTime = performance.now();
  const results = {};

  try {
    // 根据命令执行相应的诊断
    switch (command) {
      case 'full':
        results.systemInfo = checkSystemInfo();
        checkPorts();
        checkNetworkConnectivity();
        analyzeDependencies();
        analyzeErrorLogs();
        diagnoseEnvironmentVariables();
        diagnoseTypeScript();
        diagnoseTests();
        results.performance = diagnosePerformance();
        break;

      case 'system':
        results.systemInfo = checkSystemInfo();
        break;

      case 'ports':
        checkPorts();
        break;

      case 'network':
        checkNetworkConnectivity();
        break;

      case 'deps':
        analyzeDependencies();
        break;

      case 'logs':
        analyzeErrorLogs();
        break;

      case 'env':
        diagnoseEnvironmentVariables();
        break;

      case 'ts':
        diagnoseTypeScript();
        break;

      case 'tests':
        diagnoseTests();
        break;

      case 'performance':
        results.systemInfo = checkSystemInfo();
        results.performance = diagnosePerformance();
        break;

      default:
        logError(`未知命令: ${command}`);
        showUsage();
        process.exit(1);
    }

    const endTime = performance.now();
    const totalDuration = (endTime - startTime).toFixed(0);

    logSuccess(`\n诊断完成，耗时 ${totalDuration}ms`);
    generateDiagnosticReport(results);
    provideFixSuggestions(results);

  } catch (error) {
    logError(`诊断失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runDebugHelper };