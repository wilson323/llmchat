#!/usr/bin/env node

/**
 * LLMChat 任务自动化工具
 * 提供构建、测试、部署等自动化任务流水线
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
  log(`\n🔧 ${title}`, 'cyan');
  log('─'.repeat(60), 'blue');
}

function logTask(task, status = 'running') {
  const icon = status === 'running' ? '⏳' : status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
  const color = status === 'success' ? 'green' : status === 'error' ? 'red' : 'yellow';
  log(`${icon} ${task}`, color);
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

// 任务执行器
class TaskRunner {
  constructor() {
    this.tasks = [];
    this.results = [];
    this.startTime = performance.now();
  }

  addTask(name, command, options = {}) {
    this.tasks.push({
      name,
      command,
      cwd: options.cwd || projectRoot,
      timeout: options.timeout || 300000, // 5分钟默认超时
      retries: options.retries || 0,
      critical: options.critical !== false,
      parallel: options.parallel || false,
      dependencies: options.dependencies || []
    });
  }

  async runTasks() {
    logSection('开始执行任务流水线');

    // 构建依赖图
    const dependencyGraph = this.buildDependencyGraph();
    const executionOrder = this.topologicalSort(dependencyGraph);

    // 按依赖顺序执行任务
    for (const level of executionOrder) {
      if (level.length === 1) {
        await this.executeTask(level[0]);
      } else {
        // 并行执行
        await Promise.all(level.map(task => this.executeTask(task)));
      }
    }

    this.generateReport();
    return this.results;
  }

  buildDependencyGraph() {
    const graph = {};

    this.tasks.forEach(task => {
      graph[task.name] = task.dependencies;
    });

    return graph;
  }

  topologicalSort(graph) {
    const visited = new Set();
    const result = [];

    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const dependencies = graph[node] || [];
      dependencies.forEach(dep => visit(dep));

      if (!result.some(level => level.includes(node))) {
        result.push([node]);
      }
    };

    // 处理并行任务
    const processed = new Set();
    const levels = [];

    const processLevel = () => {
      const currentLevel = [];

      this.tasks.forEach(task => {
        if (processed.has(task.name)) return;

        const depsMet = task.dependencies.every(dep => processed.has(dep));
        if (depsMet) {
          currentLevel.push(task);
        }
      });

      if (currentLevel.length > 0) {
        // 找出可以并行的任务
        const parallelTasks = currentLevel.filter(task => task.parallel);
        const serialTasks = currentLevel.filter(task => !task.parallel);

        if (parallelTasks.length > 0) {
          levels.push(parallelTasks);
        }

        serialTasks.forEach(task => {
          levels.push([task]);
        });

        currentLevel.forEach(task => processed.add(task.name));
        processLevel(); // 递归处理下一层
      }
    };

    processLevel();
    return levels.length > 0 ? levels : Object.keys(graph).map(name => [name]);
  }

  async executeTask(taskName) {
    const task = this.tasks.find(t => t.name === taskName);
    if (!task) {
      throw new Error(`任务不存在: ${taskName}`);
    }

    logTask(task.name, 'running');
    const startTime = performance.now();

    try {
      const result = await this.runCommand(task.command, task);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const taskResult = {
        name: task.name,
        status: 'success',
        duration: duration.toFixed(2),
        output: result.stdout,
        startTime: new Date(startTime).toISOString()
      };

      this.results.push(taskResult);
      logTask(task.name, 'success');
      log(`  耗时: ${duration.toFixed(2)}ms`, 'blue');

      return taskResult;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const taskResult = {
        name: task.name,
        status: 'error',
        duration: duration.toFixed(2),
        error: error.message,
        output: error.stdout,
        startTime: new Date(startTime).toISOString()
      };

      this.results.push(taskResult);
      logTask(task.name, 'error');
      log(`  错误: ${error.message}`, 'red');

      if (task.critical) {
        throw new Error(`关键任务失败: ${task.name}`);
      }

      return taskResult;
    }
  }

  runCommand(command, task) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        reject(new Error(`任务超时 (${task.timeout}ms): ${task.name}`));
      }, task.timeout);

      const child = spawn(command, {
        shell: true,
        cwd: task.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
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
        clearTimeout(timeout);

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
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  generateReport() {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: totalDuration.toFixed(2),
      tasks: this.results,
      summary: {
        total: this.results.length,
        success: this.results.filter(r => r.status === 'success').length,
        error: this.results.filter(r => r.status === 'error').length
      }
    };

    // 保存 JSON 报告
    const reportPath = join(projectRoot, 'task-automation-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 显示摘要
    logSection('任务执行摘要');
    log(`总耗时: ${totalDuration.toFixed(2)}ms`, 'cyan');
    log(`总任务数: ${report.summary.total}`, 'blue');
    log(`成功: ${report.summary.success}`, 'green');
    log(`失败: ${report.summary.error}`, 'red');

    if (report.summary.error > 0) {
      log('\n失败的任务:', 'yellow');
      this.results
        .filter(r => r.status === 'error')
        .forEach(task => {
          log(`  • ${task.name}: ${task.error}`, 'white');
        });
    }

    logSuccess(`详细报告已保存: ${reportPath}`);
    return report;
  }
}

// 预定义任务流水线
const pipelines = {
  // 开发流水线
  development: {
    name: '开发环境流水线',
    description: '检查开发环境状态和依赖',
    tasks: [
      { name: '环境检查', command: 'node scripts/dev-tools/health-check.js', critical: true },
      { name: '依赖安装', command: 'pnpm install', critical: true },
      { name: '类型检查', command: 'pnpm run type-check', critical: true },
      { name: '代码风格检查', command: 'pnpm run lint', critical: false },
      { name: '运行测试', command: 'pnpm test', critical: false }
    ]
  },

  // 构建流水线
  build: {
    name: '项目构建流水线',
    description: '完整的项目构建过程',
    tasks: [
      { name: '清理构建缓存', command: 'rm -rf frontend/dist backend/dist', critical: false },
      { name: '类型检查', command: 'pnpm run type-check', critical: true },
      { name: '前端构建', command: 'pnpm run frontend:build', critical: true },
      { name: '后端构建', command: 'pnpm run backend:build', critical: true },
      { name: '构建验证', command: 'node scripts/dev-tools/health-check.js', critical: false }
    ]
  },

  // 测试流水线
  test: {
    name: '测试流水线',
    description: '运行完整的测试套件',
    tasks: [
      { name: '前端单元测试', command: 'cd frontend && pnpm run test:run', critical: true },
      { name: '后端单元测试', command: 'cd backend && pnpm test', critical: true },
      { name: '集成测试', command: 'pnpm run test:e2e', critical: false },
      { name: '性能测试', command: 'pnpm run test:perf:quick', critical: false }
    ]
  },

  // 部署流水线
  deploy: {
    name: '部署流水线',
    description: '生产环境部署流程',
    tasks: [
      { name: '环境检查', command: 'node scripts/dev-tools/health-check.js', critical: true },
      { name: '运行测试', command: 'pnpm test', critical: true },
      { name: '构建项目', command: 'pnpm run build', critical: true },
      { name: '安全扫描', command: 'pnpm run security:audit', critical: true },
      { name: '部署应用', command: 'echo "部署到生产环境"', critical: true }
    ]
  },

  // 质量检查流水线
  quality: {
    name: '代码质量流水线',
    description: '全面的代码质量检查',
    tasks: [
      { name: '类型检查', command: 'pnpm run type-check', critical: true, parallel: true },
      { name: '代码风格检查', command: 'pnpm run lint', critical: true, parallel: true },
      { name: '安全扫描', command: 'pnpm run security:audit', critical: true, parallel: true },
      { name: '运行测试', command: 'pnpm test', critical: true, dependencies: ['类型检查', '代码风格检查'] },
      { name: '性能分析', command: 'node scripts/dev-tools/performance-profiler.js', critical: false }
    ]
  },

  // 发布流水线
  release: {
    name: '发布流水线',
    description: '版本发布流程',
    tasks: [
      { name: '环境检查', command: 'node scripts/dev-tools/health-check.js', critical: true },
      { name: '运行测试', command: 'pnpm test', critical: true },
      { name: '构建项目', command: 'pnpm run build', critical: true },
      { name: '版本检查', command: 'node scripts/dev-tools/version-check.js', critical: true },
      { name: '生成变更日志', command: 'node scripts/dev-tools/changelog-generator.js', critical: false },
      { name: '创建发布标签', command: 'echo "创建 Git 标签"', critical: true }
    ]
  }
};

// 自定义任务配置
const customTasks = {
  'clean-cache': {
    name: '清理缓存',
    command: 'rm -rf node_modules/.cache frontend/dist backend/dist .vite',
    description: '清理所有缓存和构建文件'
  },

  'setup-dev': {
    name: '开发环境设置',
    command: 'node scripts/dev-tools/dev-setup.js',
    description: '自动设置开发环境'
  },

  'quick-test': {
    name: '快速测试',
    command: 'pnpm run type-check && pnpm run lint',
    description: '只运行类型检查和代码风格检查'
  },

  'full-test': {
    name: '完整测试',
    command: 'pnpm test && pnpm run test:e2e',
    description: '运行所有测试包括 E2E 测试'
  },

  'perf-test': {
    name: '性能测试',
    command: 'node scripts/dev-tools/performance-profiler.js',
    description: '运行性能分析测试'
  },

  'security-check': {
    name: '安全检查',
    command: 'pnpm run security:audit && pnpm run security:check',
    description: '运行完整的安全检查'
  },

  'docs-build': {
    name: '构建文档',
    command: 'echo "构建项目文档"',
    description: '生成项目文档'
  }
};

// 执行预定义流水线
async function runPipeline(pipelineName) {
  const pipeline = pipelines[pipelineName];
  if (!pipeline) {
    throw new Error(`未知流水线: ${pipelineName}`);
  }

  logSection(`执行流水线: ${pipeline.name}`);
  log(pipeline.description, 'blue');

  const runner = new TaskRunner();

  // 添加任务到流水线
  pipeline.tasks.forEach(taskConfig => {
    runner.addTask(taskConfig.name, taskConfig.command, {
      critical: taskConfig.critical,
      parallel: taskConfig.parallel,
      dependencies: taskConfig.dependencies || []
    });
  });

  return await runner.runTasks();
}

// 执行自定义任务
async function runCustomTask(taskName) {
  const task = customTasks[taskName];
  if (!task) {
    throw new Error(`未知任务: ${taskName}`);
  }

  logSection(`执行任务: ${task.name}`);
  log(task.description, 'blue');

  const runner = new TaskRunner();
  runner.addTask(task.name, task.command, { critical: true });

  return await runner.runTasks();
}

// 交互式任务选择
async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    log('🚀 LLMChat 任务自动化工具 - 交互模式', 'bright');
    log('======================================', 'blue');

    // 显示可用流水线
    log('\n可用的流水线:', 'cyan');
    Object.entries(pipelines).forEach(([key, pipeline]) => {
      log(`  ${key}: ${pipeline.name}`, 'blue');
      log(`    ${pipeline.description}`, 'white');
    });

    // 显示可用任务
    log('\n可用的独立任务:', 'cyan');
    Object.entries(customTasks).forEach(([key, task]) => {
      log(`  ${key}: ${task.name}`, 'blue');
      log(`    ${task.description}`, 'white');
    });

    const choice = await question('\n请选择流水线或任务名称: ');
    rl.close();

    if (pipelines[choice]) {
      return await runPipeline(choice);
    } else if (customTasks[choice]) {
      return await runCustomTask(choice);
    } else {
      throw new Error(`无效的选择: ${choice}`);
    }

  } catch (error) {
    rl.close();
    throw error;
  }
}

// 显示使用说明
function showUsage() {
  log('🔧 LLMChat 任务自动化工具', 'bright');
  log('============================', 'blue');
  log('\n用法:', 'cyan');
  log('  node task-automation.js <流水线|任务|选项>', 'white');
  log('\n流水线:', 'cyan');

  Object.entries(pipelines).forEach(([key, pipeline]) => {
    log(`  ${key}: ${pipeline.name}`, 'blue');
    log(`    ${pipeline.description}`, 'white');
  });

  log('\n独立任务:', 'cyan');
  Object.entries(customTasks).forEach(([key, task]) => {
    log(`  ${key}: ${task.name}`, 'blue');
    log(`    ${task.description}`, 'white');
  });

  log('\n选项:', 'cyan');
  log('  --interactive    交互模式', 'white');
  log('  --list          列出所有可用流水线和任务', 'white');
  log('  --help          显示帮助信息', 'white');

  log('\n示例:', 'cyan');
  log('  node task-automation.js development', 'white');
  log('  node task-automation.js build', 'white');
  log('  node task-automation.js test', 'white');
  log('  node task-automation.js clean-cache', 'white');
  log('  node task-automation.js --interactive', 'white');
}

// 创建自定义流水线
function createCustomPipeline(args) {
  const pipelineName = args[0];
  const taskNames = args.slice(1);

  if (!pipelineName || taskNames.length === 0) {
    throw new Error('用法: node task-automation.js --create <流水线名> <任务1> <任务2> ...');
  }

  // 验证任务存在
  const invalidTasks = taskNames.filter(name => !customTasks[name]);
  if (invalidTasks.length > 0) {
    throw new Error(`无效的任务: ${invalidTasks.join(', ')}`);
  }

  // 创建自定义流水线
  const customPipeline = {
    name: `自定义流水线: ${pipelineName}`,
    description: `用户定义的流水线，包含任务: ${taskNames.join(', ')}`,
    tasks: taskNames.map(taskName => ({
      name: customTasks[taskName].name,
      command: customTasks[taskName].command,
      critical: true
    }))
  };

  // 保存自定义流水线
  const customPipelinesPath = join(projectRoot, '.custom-pipelines.json');
  let customPipelines = {};

  if (existsSync(customPipelinesPath)) {
    customPipelines = JSON.parse(readFileSync(customPipelinesPath, 'utf8'));
  }

  customPipelines[pipelineName] = customPipeline;
  writeFileSync(customPipelinesPath, JSON.stringify(customPipelines, null, 2));

  logSuccess(`自定义流水线 "${pipelineName}" 已创建`);
  logInfo(`运行命令: node task-automation.js ${pipelineName}`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  if (args.includes('--interactive')) {
    await interactiveMode();
    return;
  }

  if (args.includes('--list')) {
    logSection('可用的流水线和任务');

    log('流水线:', 'cyan');
    Object.entries(pipelines).forEach(([key, pipeline]) => {
      log(`  ${key}: ${pipeline.name}`, 'blue');
    });

    log('\n独立任务:', 'cyan');
    Object.entries(customTasks).forEach(([key, task]) => {
      log(`  ${key}: ${task.name}`, 'blue');
    });
    return;
  }

  if (args.includes('--create')) {
    const createIndex = args.indexOf('--create');
    createCustomPipeline(args.slice(createIndex + 1));
    return;
  }

  const command = args[0];

  try {
    let result;

    if (pipelines[command]) {
      result = await runPipeline(command);
    } else if (customTasks[command]) {
      result = await runCustomTask(command);
    } else {
      throw new Error(`未知流水线或任务: ${command}`);
    }

    // 根据结果设置退出码
    const hasErrors = result.some(r => r.status === 'error');
    if (hasErrors) {
      process.exit(1);
    } else {
      logSuccess('所有任务执行成功');
      process.exit(0);
    }

  } catch (error) {
    logError(`执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runTaskAutomation, TaskRunner, pipelines, customTasks };