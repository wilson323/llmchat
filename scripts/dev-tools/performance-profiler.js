#!/usr/bin/env node

/**
 * LLMChat 性能分析工具
 * 深度分析应用性能，识别瓶颈和优化机会
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
  log(`\n⚡ ${title}`, 'cyan');
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

// 系统性能基准测试
function runSystemBenchmark() {
  logSection('系统性能基准测试');

  const benchmarks = [];

  // CPU 性能测试
  const cpuStart = performance.now();
  const iterations = 1000000;
  let result = 0;

  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }

  const cpuEnd = performance.now();
  const cpuTime = cpuEnd - cpuStart;

  benchmarks.push({
    name: 'CPU 计算',
    value: cpuTime.toFixed(2),
    unit: 'ms',
    type: 'lower-is-better',
    score: cpuTime < 100 ? 'excellent' : cpuTime < 300 ? 'good' : 'poor'
  });

  // 内存分配测试
  const memStart = performance.now();
  const arrays = [];

  for (let i = 0; i < 1000; i++) {
    arrays.push(new Array(1000).fill(Math.random()));
  }

  const memEnd = performance.now();
  const memTime = memEnd - memStart;

  benchmarks.push({
    name: '内存分配',
    value: memTime.toFixed(2),
    unit: 'ms',
    type: 'lower-is-better',
    score: memTime < 50 ? 'excellent' : memTime < 150 ? 'good' : 'poor'
  });

  // 字符串操作测试
  const strStart = performance.now();
  let testString = '';

  for (let i = 0; i < 10000; i++) {
    testString += `item-${i}-`;
  }

  const strEnd = performance.now();
  const strTime = strEnd - strStart;

  benchmarks.push({
    name: '字符串操作',
    value: strTime.toFixed(2),
    unit: 'ms',
    type: 'lower-is-better',
    score: strTime < 20 ? 'excellent' : strTime < 100 ? 'good' : 'poor'
  });

  // 显示结果
  benchmarks.forEach(benchmark => {
    const color = benchmark.score === 'excellent' ? 'green' :
                  benchmark.score === 'good' ? 'yellow' : 'red';
    log(`${benchmark.name}: ${benchmark.value} ${benchmark.unit}`, color);
    log(`  评分: ${benchmark.score}`, color);
  });

  return benchmarks;
}

// TypeScript 编译性能分析
function analyzeTypeScriptPerformance() {
  logSection('TypeScript 编译性能分析');

  const results = {};

  try {
    // 清理缓存
    logInfo('清理编译缓存...');
    try {
      execSync('rm -rf frontend/dist frontend/.vite', { stdio: 'ignore' });
    } catch {}

    // 前端编译测试
    logInfo('测试前端 TypeScript 编译...');
    const frontendStart = performance.now();

    try {
      execSync('cd frontend && pnpm run type-check', { stdio: 'pipe' });
      const frontendEnd = performance.now();
      const frontendTime = frontendEnd - frontendStart;

      results.frontend = {
        typeCheck: frontendTime.toFixed(2),
        status: 'success'
      };

      logSuccess(`前端类型检查: ${frontendTime.toFixed(2)}ms`);
    } catch (error) {
      results.frontend = {
        typeCheck: 'failed',
        status: 'error',
        error: error.message
      };
      logError('前端类型检查失败');
    }

    // 前端构建测试
    logInfo('测试前端构建...');
    const buildStart = performance.now();

    try {
      execSync('cd frontend && pnpm run build', { stdio: 'pipe' });
      const buildEnd = performance.now();
      const buildTime = buildEnd - buildStart;

      results.frontend.build = buildTime.toFixed(2);
      logSuccess(`前端构建: ${buildTime.toFixed(2)}ms`);
    } catch (error) {
      results.frontend.build = 'failed';
      logError('前端构建失败');
    }

    // 后端编译测试
    logInfo('测试后端 TypeScript 编译...');
    const backendStart = performance.now();

    try {
      execSync('cd backend && pnpm run build', { stdio: 'pipe' });
      const backendEnd = performance.now();
      const backendTime = backendEnd - backendStart;

      results.backend = {
        build: backendTime.toFixed(2),
        status: 'success'
      };

      logSuccess(`后端构建: ${backendTime.toFixed(2)}ms`);
    } catch (error) {
      results.backend = {
        build: 'failed',
        status: 'error',
        error: error.message
      };
      logError('后端构建失败');
    }

  } catch (error) {
    logError(`TypeScript 性能分析失败: ${error.message}`);
  }

  return results;
}

// 包大小分析
function analyzeBundleSize() {
  logSection('包大小分析');

  const results = {};

  try {
    // 确保前端已构建
    if (!existsSync(join(projectRoot, 'frontend/dist'))) {
      logWarning('前端未构建，正在构建...');
      execSync('cd frontend && pnpm run build', { stdio: 'pipe' });
    }

    // 分析构建产物
    const distPath = join(projectRoot, 'frontend/dist');
    const buildFiles = execSync(`find ${distPath} -name "*.js" -o -name "*.css"`, {
      encoding: 'utf8'
    }).split('\n').filter(Boolean);

    let totalSize = 0;
    const fileAnalysis = [];

    for (const file of buildFiles) {
      try {
        const stats = require('fs').statSync(file);
        const sizeKB = (stats.size / 1024).toFixed(2);
        totalSize += stats.size;

        fileAnalysis.push({
          path: file.replace(projectRoot, ''),
          size: stats.size,
          sizeKB: parseFloat(sizeKB),
          type: file.endsWith('.js') ? 'javascript' : 'css'
        });
      } catch (error) {
        logWarning(`无法分析文件: ${file}`);
      }
    }

    // 按大小排序
    fileAnalysis.sort((a, b) => b.size - a.size);

    results.total = {
      size: totalSize,
      sizeKB: (totalSize / 1024).toFixed(2),
      sizeMB: (totalSize / 1024 / 1024).toFixed(2)
    };

    results.files = fileAnalysis.slice(0, 10); // 只保留前10个最大的文件

    logSuccess(`总包大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    logInfo('最大文件 (前5个):');
    results.files.slice(0, 5).forEach((file, index) => {
      log(`  ${index + 1}. ${file.path}: ${file.sizeKB} KB`, 'white');
    });

    // 包大小评估
    const totalMB = totalSize / 1024 / 1024;
    if (totalMB < 1) {
      logSuccess('包大小: 优秀 (< 1MB)');
    } else if (totalMB < 3) {
      logWarning('包大小: 良好 (1-3MB)');
    } else {
      logError('包大小: 需要优化 (> 3MB)');
    }

  } catch (error) {
    logError(`包大小分析失败: ${error.message}`);
  }

  return results;
}

// 运行时性能测试
async function runRuntimePerformanceTest() {
  logSection('运行时性能测试');

  return new Promise((resolve) => {
    const results = {};

    // 启动前端服务器
    logInfo('启动前端服务器...');
    const frontendServer = spawn('pnpm', ['run', 'dev'], {
      cwd: join(projectRoot, 'frontend'),
      stdio: 'pipe'
    });

    // 等待服务器启动
    setTimeout(async () => {
      try {
        // 使用 Playwright 进行性能测试
        logInfo('运行浏览器性能测试...');

        const perfResults = await runBrowserPerformanceTest();
        results.browser = perfResults;

        // 关闭服务器
        frontendServer.kill();
        resolve(results);

      } catch (error) {
        logError(`运行时性能测试失败: ${error.message}`);
        frontendServer.kill();
        resolve(results);
      }
    }, 5000);
  });
}

// 浏览器性能测试
async function runBrowserPerformanceTest() {
  const results = {};

  try {
    // 简单的性能指标收集（使用 curl 模拟）
    const testUrl = 'http://localhost:3000';

    // 测试页面加载时间
    const startLoad = performance.now();
    try {
      execSync(`curl -s -w "%{time_total}" "${testUrl}" > /dev/null`, { stdio: 'pipe' });
      const endLoad = performance.now();
      const loadTime = endLoad - startLoad;

      results.pageLoad = {
        time: loadTime.toFixed(2),
        unit: 'ms',
        status: 'success'
      };

      logSuccess(`页面加载时间: ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      results.pageLoad = {
        time: 'failed',
        status: 'error'
      };
      logWarning('无法测试页面加载时间');
    }

    // 测试并发请求
    logInfo('测试并发请求性能...');
    const concurrentResults = [];
    const concurrentCount = 10;

    for (let i = 0; i < concurrentCount; i++) {
      const start = performance.now();
      try {
        execSync(`curl -s "${testUrl}" > /dev/null`, { stdio: 'pipe' });
        const end = performance.now();
        concurrentResults.push(end - start);
      } catch {
        concurrentResults.push(-1);
      }
    }

    const validResults = concurrentResults.filter(r => r > 0);
    if (validResults.length > 0) {
      const avgTime = validResults.reduce((a, b) => a + b, 0) / validResults.length;
      const maxTime = Math.max(...validResults);
      const minTime = Math.min(...validResults);

      results.concurrent = {
        count: validResults.length,
        average: avgTime.toFixed(2),
        max: maxTime.toFixed(2),
        min: minTime.toFixed(2),
        unit: 'ms'
      };

      logInfo(`并发请求 (${validResults.length}/${concurrentCount}):`);
      logInfo(`  平均响应时间: ${avgTime.toFixed(2)}ms`);
      logInfo(`  最大响应时间: ${maxTime.toFixed(2)}ms`);
      logInfo(`  最小响应时间: ${minTime.toFixed(2)}ms`);
    }

  } catch (error) {
    logError(`浏览器性能测试失败: ${error.message}`);
  }

  return results;
}

// 内存使用分析
function analyzeMemoryUsage() {
  logSection('内存使用分析');

  const results = {
    process: process.memoryUsage(),
    nodeLimit: require('v8').getHeapStatistics()
  };

  // 格式化内存使用信息
  const formatMemory = (bytes) => (bytes / 1024 / 1024).toFixed(2);

  logInfo('当前进程内存使用:');
  log(`  堆内存使用: ${formatMemory(results.process.heapUsed)} MB`, 'white');
  log(`  堆内存总量: ${formatMemory(results.process.heapTotal)} MB`, 'white');
  log(`  外部内存: ${formatMemory(results.process.external)} MB`, 'white');
  log(`  RSS 内存: ${formatMemory(results.process.rss)} MB`, 'white');

  logInfo('Node.js 堆限制:');
  log(`  堆大小限制: ${formatMemory(results.nodeLimit.heap_size_limit)} MB`, 'white');
  log(`  已分配堆大小: ${formatMemory(results.nodeLimit.total_heap_size)} MB`, 'white');
  log(`  已使用堆大小: ${formatMemory(results.nodeLimit.used_heap_size)} MB`, 'white');

  // 内存使用率计算
  const heapUsagePercent = (results.nodeLimit.used_heap_size / results.nodeLimit.heap_size_limit * 100).toFixed(2);
  log(`堆内存使用率: ${heapUsagePercent}%`,
    parseFloat(heapUsagePercent) < 50 ? 'green' :
    parseFloat(heapUsagePercent) < 80 ? 'yellow' : 'red');

  // 内存泄漏检测（简单版本）
  logInfo('执行内存泄漏检测...');
  const initialMemory = results.process.heapUsed;

  // 创建一些对象
  const testObjects = [];
  for (let i = 0; i < 10000; i++) {
    testObjects.push({ id: i, data: new Array(100).fill(Math.random()) });
  }

  const afterAllocationMemory = process.memoryUsage().heapUsed;
  const allocationIncrease = afterAllocationMemory - initialMemory;

  // 清理对象
  testObjects.length = 0;

  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
  }

  const afterCleanupMemory = process.memoryUsage().heapUsed;
  const cleanupReduction = afterAllocationMemory - afterCleanupMemory;

  logInfo('内存泄漏检测结果:');
  log(`  分配增加: ${(allocationIncrease / 1024 / 1024).toFixed(2)} MB`, 'white');
  log(`  清理减少: ${(cleanupReduction / 1024 / 1024).toFixed(2)} MB`, 'white');

  if (cleanupReduction > allocationIncrease * 0.8) {
    logSuccess('内存清理效果良好');
  } else {
    logWarning('可能存在内存泄漏或垃圾回收不彻底');
  }

  return results;
}

// 依赖性能分析
function analyzeDependencyPerformance() {
  logSection('依赖性能分析');

  const results = {};

  try {
    // 分析依赖数量
    const packageJsonPath = join(projectRoot, 'frontend/package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});

      results.frontend = {
        dependencies: dependencies.length,
        devDependencies: devDependencies.length,
        total: dependencies.length + devDependencies.length
      };

      logInfo(`前端依赖统计:`);
      log(`  生产依赖: ${dependencies.length}`, 'white');
      log(`  开发依赖: ${devDependencies.length}`, 'white');
      log(`  总依赖数: ${results.frontend.total}`, 'white');

      // 分析大型的依赖包
      const nodeModulesPath = join(projectRoot, 'frontend/node_modules');
      if (existsSync(nodeModulesPath)) {
        const largePackages = execSync(`du -sh ${nodeModulesPath}/*/package.json 2>/dev/null | sort -hr | head -10`, {
          encoding: 'utf8',
          cwd: projectRoot
        }).split('\n').filter(Boolean);

        if (largePackages.length > 0) {
          logInfo('最大的依赖包 (前5个):');
          largePackages.slice(0, 5).forEach((line, index) => {
            const [size, path] = line.split('\t');
            const packageName = path.split('/')[3];
            log(`  ${index + 1}. ${packageName}: ${size}`, 'white');
          });
        }
      }
    }

    // 依赖数量评估
    if (results.frontend) {
      if (results.frontend.total < 100) {
        logSuccess('依赖数量: 优秀 (< 100)');
      } else if (results.frontend.total < 300) {
        logWarning('依赖数量: 良好 (100-300)');
      } else {
        logError('依赖数量: 需要优化 (> 300)');
      }
    }

  } catch (error) {
    logError(`依赖性能分析失败: ${error.message}`);
  }

  return results;
}

// 生成性能报告
function generatePerformanceReport(allResults) {
  logSection('生成性能报告');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      systemPerformance: allResults.systemBenchmark,
      typescriptPerformance: allResults.typescriptPerformance,
      bundleSize: allResults.bundleSize,
      runtimePerformance: allResults.runtimePerformance,
      memoryUsage: allResults.memoryUsage,
      dependencyPerformance: allResults.dependencyPerformance
    },
    recommendations: generateRecommendations(allResults)
  };

  const reportPath = join(projectRoot, 'performance-analysis-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  logSuccess(`性能报告已生成: ${reportPath}`);

  // 生成 HTML 报告
  const htmlReport = generateHTMLReport(report);
  const htmlReportPath = join(projectRoot, 'performance-analysis-report.html');
  writeFileSync(htmlReportPath, htmlReport);

  logSuccess(`HTML 报告已生成: ${htmlReportPath}`);

  return report;
}

// 生成优化建议
function generateRecommendations(results) {
  const recommendations = [];

  // TypeScript 性能建议
  if (results.typescriptPerformance?.frontend?.typeCheck > 5000) {
    recommendations.push({
      category: 'TypeScript 编译',
      priority: 'high',
      description: 'TypeScript 类型检查较慢，建议优化 tsconfig.json 配置',
      action: '考虑使用增量编译、跳过库检查或优化项目结构'
    });
  }

  // 包大小建议
  if (results.bundleSize?.total && results.bundleTotal.sizeMB > 3) {
    recommendations.push({
      category: '包大小',
      priority: 'high',
      description: '前端包大小较大，建议进行优化',
      action: '考虑代码分割、Tree Shaking、移除未使用的依赖或使用 CDN'
    });
  }

  // 内存使用建议
  if (results.memoryUsage?.process) {
    const heapUsagePercent = (results.memoryUsage.process.heapUsed /
                            results.memoryUsage.nodeLimit.heap_size_limit * 100);

    if (heapUsagePercent > 80) {
      recommendations.push({
        category: '内存使用',
        priority: 'medium',
        description: '内存使用率较高，建议检查内存泄漏',
        action: '使用内存分析工具检查对象引用，确保及时清理资源'
      });
    }
  }

  // 依赖数量建议
  if (results.dependencyPerformance?.frontend?.total > 300) {
    recommendations.push({
      category: '依赖管理',
      priority: 'medium',
      description: '依赖数量较多，建议进行清理',
      action: '移除未使用的依赖，考虑使用更轻量的替代方案'
    });
  }

  return recommendations;
}

// 生成 HTML 报告
function generateHTMLReport(report) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLMChat 性能分析报告</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .metric h3 { margin-top: 0; color: #333; }
        .excellent { color: #28a745; }
        .good { color: #ffc107; }
        .poor { color: #dc3545; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; }
        .recommendation.high { border-left: 4px solid #dc3545; }
        .recommendation.medium { border-left: 4px solid #ffc107; }
        .recommendation.low { border-left: 4px solid #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 LLMChat 性能分析报告</h1>
        <p>生成时间: ${report.timestamp}</p>
    </div>

    <div class="section">
        <h2>📊 性能摘要</h2>
        <div class="metric">
            <h3>系统性能</h3>
            ${report.summary.systemPerformance ?
              report.summary.systemPerformance.map(benchmark =>
                `<p><strong>${benchmark.name}:</strong> <span class="${benchmark.score}">${benchmark.value} ${benchmark.unit}</span> (${benchmark.score})</p>`
              ).join('') : '无数据'}
        </div>
    </div>

    <div class="section">
        <h2>💡 优化建议</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation ${rec.priority}">
                <h3>${rec.category}</h3>
                <p><strong>问题:</strong> ${rec.description}</p>
                <p><strong>建议:</strong> ${rec.action}</p>
                <p><strong>优先级:</strong> ${rec.priority}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
}

// 显示使用说明
function showUsage() {
  log('⚡ LLMChat 性能分析工具', 'bright');
  log('==========================', 'blue');
  log('\n用法:', 'cyan');
  log('  node performance-profiler.js [选项]', 'white');
  log('\n选项:', 'cyan');
  log('  --full         运行完整性能分析 (默认)', 'white');
  log('  --system       仅分析系统性能', 'white');
  log('  --typescript   仅分析 TypeScript 编译性能', 'white');
  log('  --bundle       仅分析包大小', 'white');
  log('  --runtime      仅分析运行时性能', 'white');
  log('  --memory       仅分析内存使用', 'white');
  log('  --deps         仅分析依赖性能', 'white');
  log('  --report       仅生成报告 (需要先运行分析)', 'white');
  log('\n示例:', 'cyan');
  log('  node performance-profiler.js', 'white');
  log('  node performance-profiler.js --full', 'white');
  log('  node performance-profiler.js --typescript', 'white');
}

// 主函数
async function main() {
  const option = process.argv[2] || '--full';

  if (option === '--help' || option === '-h') {
    showUsage();
    return;
  }

  log('⚡ LLMChat 性能分析工具', 'bright');
  log('==========================', 'blue');
  log(`分析模式: ${option}`, 'cyan');
  log('', 'reset');

  const startTime = performance.now();
  const results = {};

  try {
    switch (option) {
      case '--full':
      case 'full':
        results.systemBenchmark = runSystemBenchmark();
        results.typescriptPerformance = analyzeTypeScriptPerformance();
        results.bundleSize = analyzeBundleSize();
        results.runtimePerformance = await runRuntimePerformanceTest();
        results.memoryUsage = analyzeMemoryUsage();
        results.dependencyPerformance = analyzeDependencyPerformance();
        break;

      case '--system':
      case 'system':
        results.systemBenchmark = runSystemBenchmark();
        break;

      case '--typescript':
      case 'typescript':
        results.typescriptPerformance = analyzeTypeScriptPerformance();
        break;

      case '--bundle':
      case 'bundle':
        results.bundleSize = analyzeBundleSize();
        break;

      case '--runtime':
      case 'runtime':
        results.runtimePerformance = await runRuntimePerformanceTest();
        break;

      case '--memory':
      case 'memory':
        results.memoryUsage = analyzeMemoryUsage();
        break;

      case '--deps':
      case 'deps':
        results.dependencyPerformance = analyzeDependencyPerformance();
        break;

      default:
        logError(`未知选项: ${option}`);
        showUsage();
        process.exit(1);
    }

    const endTime = performance.now();
    const totalDuration = (endTime - startTime).toFixed(0);

    logSuccess(`\n性能分析完成，耗时 ${totalDuration}ms`);

    if (Object.keys(results).length > 0) {
      const report = generatePerformanceReport(results);

      // 显示建议摘要
      if (report.recommendations.length > 0) {
        logSection('关键优化建议');
        report.recommendations.slice(0, 3).forEach(rec => {
          const color = rec.priority === 'high' ? 'red' :
                       rec.priority === 'medium' ? 'yellow' : 'green';
          log(`• ${rec.description}`, color);
        });
      }
    }

  } catch (error) {
    logError(`性能分析失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runPerformanceProfiler };