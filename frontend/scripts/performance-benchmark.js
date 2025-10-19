#!/usr/bin/env node

/**
 * 前端性能基准测试脚本
 * 用于测试TypeScript编译、Vite构建等关键性能指标
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: []
    };
    
    this.projectRoot = path.join(__dirname, '..');
    this.reportPath = path.join(__dirname, '../reports/benchmarks');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportPath)) {
      fs.mkdirSync(this.reportPath, { recursive: true });
    }
  }

  async runTest(name, testFn, iterations = 3) {
    console.log(`🧪 运行测试: ${name}`);
    
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await testFn();
        const endTime = Date.now();
        times.push(endTime - startTime);
        
        console.log(`  ✅ 第${i + 1}次: ${times[times.length - 1]}ms`);
      } catch (error) {
        console.log(`  ❌ 第${i + 1}次: 失败 - ${error.message}`);
        times.push(-1);
      }
      
      // 等待一下再进行下一次测试
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const validTimes = times.filter(t => t > 0);
    
    if (validTimes.length === 0) {
      console.log(`  ❌ 测试失败: ${name}`);
      this.results.tests.push({
        name,
        success: false,
        error: 'All iterations failed'
      });
      return;
    }
    
    const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const min = Math.min(...validTimes);
    const max = Math.max(...validTimes);
    
    console.log(`  📊 平均: ${avg.toFixed(2)}ms (最小: ${min}ms, 最大: ${max}ms)`);
    
    this.results.tests.push({
      name,
      success: true,
      iterations: validTimes.length,
      average: avg,
      min,
      max,
      times: validTimes
    });
  }

  // 清理构建产物和缓存
  async clean() {
    console.log('🧹 清理构建产物和缓存...');
    
    const cleanTasks = [
      'rm -rf dist',
      'rm -rf node_modules/.vite',
      'rm -f .tsbuildinfo*',
      'rm -rf node_modules/.cache'
    ];
    
    for (const task of cleanTasks) {
      try {
        execSync(task, { cwd: this.projectRoot, stdio: 'pipe' });
      } catch (error) {
        // 忽略清理错误
      }
    }
  }

  // 测试 TypeScript 类型检查
  async testTypeCheck() {
    await this.runTest('TypeScript 类型检查', async () => {
      execSync('pnpm run type-check', { 
        cwd: this.projectRoot, 
        stdio: 'pipe',
        timeout: 60000 // 60秒超时
      });
    });
  }

  // 测试 Vite 开发服务器启动
  async testDevServer() {
    await this.runTest('Vite 开发服务器启动', async () => {
      const server = execSync('pnpm run dev --port 3001', { 
        cwd: this.projectRoot, 
        stdio: 'pipe',
        timeout: 30000 // 30秒超时
      });
      
      // 等待服务器启动
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 清理服务器进程
      try {
        execSync('pkill -f "vite"', { stdio: 'pipe' });
      } catch (error) {
        // 忽略进程清理错误
      }
    });
  }

  // 测试生产构建
  async testProductionBuild() {
    await this.runTest('生产构建', async () => {
      execSync('pnpm run build', { 
        cwd: this.projectRoot, 
        stdio: 'pipe',
        timeout: 300000 // 5分钟超时
      });
    });
  }

  // 测试 ESLint 检查
  async testLint() {
    await this.runTest('ESLint 检查', async () => {
      execSync('pnpm run lint', { 
        cwd: this.projectRoot, 
        stdio: 'pipe',
        timeout: 120000 // 2分钟超时
      });
    });
  }

  // 测试单元测试运行
  async testUnitTests() {
    await this.runTest('单元测试运行', async () => {
      execSync('pnpm test:run', { 
        cwd: this.projectRoot, 
        stdio: 'pipe',
        timeout: 180000 // 3分钟超时
      });
    });
  }

  // 分析构建产物大小
  analyzeBundleSize() {
    console.log('📦 分析构建产物大小...');
    
    const distPath = path.join(this.projectRoot, 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.log('  ❌ 构建产物不存在，跳过分析');
      return;
    }
    
    const sizes = this.calculateDirectorySize(distPath);
    const mainBundleSize = this.getMainBundleSize(distPath);
    
    console.log(`  📊 总大小: ${(sizes.total / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  📊 主包大小: ${(mainBundleSize / 1024 / 1024).toFixed(2)}MB`);
    
    this.results.bundleSize = {
      total: sizes.total,
      mainBundle: mainBundleSize,
      files: sizes.files
    };
  }

  calculateDirectorySize(dirPath) {
    let total = 0;
    const files = [];
    
    function traverse(currentPath) {
      const items = fs.readdirSync(currentPath);
      
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else {
          const size = stat.size;
          total += size;
          files.push({
            path: path.relative(dirPath, fullPath),
            size,
            sizeKB: (size / 1024).toFixed(2)
          });
        }
      });
    }
    
    traverse(dirPath);
    
    return { total, files };
  }

  getMainBundleSize(distPath) {
    // 查找主要的 JavaScript 文件
    const jsFiles = fs.readdirSync(distPath)
      .filter(file => file.endsWith('.js'))
      .map(file => ({
        name: file,
        size: fs.statSync(path.join(distPath, file)).size
      }))
      .sort((a, b) => b.size - a.size);
    
    return jsFiles.length > 0 ? jsFiles[0].size : 0;
  }

  // 生成基准测试报告
  generateReport() {
    const report = {
      ...this.results,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = path.join(this.reportPath, `benchmark-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // 生成 HTML 报告
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(this.reportPath, `benchmark-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    
    console.log(`📊 基准测试报告已生成:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  HTML: ${htmlPath}`);
    
    this.printSummary(report);
    
    return report;
  }

  generateSummary() {
    const successfulTests = this.results.tests.filter(t => t.success);
    const totalTests = this.results.tests.length;
    
    if (successfulTests.length === 0) {
      return {
        successRate: 0,
        totalTests: 0,
        averageTimes: {}
      };
    }
    
    const averageTimes = {};
    successfulTests.forEach(test => {
      averageTimes[test.name] = test.average;
    });
    
    return {
      successRate: (successfulTests.length / totalTests) * 100,
      totalTests,
      successfulTests: successfulTests.length,
      averageTimes
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    this.results.tests.forEach(test => {
      if (!test.success) {
        recommendations.push({
          priority: 'high',
          category: 'error',
          message: `${test.name} 测试失败，需要修复相关配置或代码`
        });
        return;
      }
      
      if (test.name.includes('构建') && test.average > 60000) {
        recommendations.push({
          priority: 'medium',
          category: 'performance',
          message: `构建时间过长 (${(test.average / 1000).toFixed(2)}s)，建议启用增量编译`
        });
      }
      
      if (test.name.includes('类型检查') && test.average > 20000) {
        recommendations.push({
          priority: 'medium',
          category: 'performance',
          message: `类型检查时间过长，建议优化 tsconfig 配置`
        });
      }
    });
    
    if (this.results.bundleSize) {
      const { total, mainBundle } = this.results.bundleSize;
      
      if (total > 20 * 1024 * 1024) { // 20MB
        recommendations.push({
          priority: 'high',
          category: 'bundle',
          message: `构建产物过大 (${(total / 1024 / 1024).toFixed(2)}MB)，建议优化代码分割`
        });
      }
      
      if (mainBundle > 5 * 1024 * 1024) { // 5MB
        recommendations.push({
          priority: 'medium',
          category: 'bundle',
          message: `主包过大 (${(mainBundle / 1024 / 1024).toFixed(2)}MB)，建议进一步分割代码`
        });
      }
    }
    
    return recommendations;
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>性能基准测试报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .metric-label {
            color: #666;
            margin-top: 5px;
        }
        .test-results {
            margin-bottom: 30px;
        }
        .test-item {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
        }
        .test-header {
            background: #f8f9fa;
            padding: 15px;
            font-weight: bold;
        }
        .test-body {
            padding: 15px;
        }
        .success { border-left: 4px solid #28a745; }
        .failure { border-left: 4px solid #dc3545; }
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
        }
        .recommendation {
            margin-bottom: 10px;
            padding: 10px;
            background: white;
            border-radius: 4px;
        }
        .high { border-left: 4px solid #dc3545; }
        .medium { border-left: 4px solid #ffc107; }
        .low { border-left: 4px solid #28a745; }
        .chart {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 LLMChat 前端性能基准测试报告</h1>
        <p>测试时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">${report.summary.successRate.toFixed(1)}%</div>
            <div class="metric-label">测试成功率</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.summary.successfulTests}/${report.summary.totalTests}</div>
            <div class="metric-label">通过测试</div>
        </div>
        ${report.bundleSize ? `
        <div class="metric">
            <div class="metric-value">${(report.bundleSize.total / 1024 / 1024).toFixed(2)}MB</div>
            <div class="metric-label">构建产物大小</div>
        </div>
        ` : ''}
    </div>
    
    <div class="test-results">
        <h2>📊 测试结果</h2>
        ${report.tests.map(test => `
            <div class="test-item ${test.success ? 'success' : 'failure'}">
                <div class="test-header">
                    ${test.success ? '✅' : '❌'} ${test.name}
                </div>
                <div class="test-body">
                    ${test.success ? `
                        <p><strong>平均时间:</strong> ${test.average.toFixed(2)}ms</p>
                        <p><strong>最小时间:</strong> ${test.min}ms</p>
                        <p><strong>最大时间:</strong> ${test.max}ms</p>
                        <p><strong>测试次数:</strong> ${test.iterations}</p>
                    ` : `
                        <p><strong>错误:</strong> ${test.error}</p>
                    `}
                </div>
            </div>
        `).join('')}
    </div>
    
    ${report.recommendations.length > 0 ? `
    <div class="recommendations">
        <h2>💡 优化建议</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation ${rec.priority}">
                <strong>${rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡'} ${rec.category}</strong>: ${rec.message}
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    <footer style="text-align: center; margin-top: 50px; color: #666;">
        <p>Generated by LLMChat Performance Benchmark Tool</p>
    </footer>
</body>
</html>
    `;
  }

  printSummary(report) {
    console.log('\n📊 基准测试摘要:');
    console.log('==================');
    console.log(`✅ 测试成功率: ${report.summary.successRate.toFixed(1)}%`);
    console.log(`📈 通过测试: ${report.summary.successfulTests}/${report.summary.totalTests}`);
    
    if (report.bundleSize) {
      console.log(`📦 构建产物: ${(report.bundleSize.total / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📦 主包大小: ${(report.bundleSize.mainBundle / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.log('\n⏱️ 平均执行时间:');
    Object.entries(report.summary.averageTimes).forEach(([name, time]) => {
      console.log(`  ${name}: ${(time / 1000).toFixed(2)}s`);
    });
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 优化建议:');
      report.recommendations.forEach((rec, index) => {
        const icon = rec.priority === 'high' ? '🚨' : 
                   rec.priority === 'medium' ? '⚠️' : '💡';
        console.log(`  ${index + 1}. ${icon} ${rec.message}`);
      });
    }
  }

  // 运行完整的基准测试套件
  async runFullSuite() {
    console.log('🚀 开始前端性能基准测试...\n');
    
    try {
      // 清理环境
      await this.clean();
      
      // 运行各项测试
      await this.testTypeCheck();
      await this.testLint();
      await this.testProductionBuild();
      
      // 分析构建产物
      this.analyzeBundleSize();
      
      // 生成报告
      const report = this.generateReport();
      
      return report;
    } catch (error) {
      console.error('❌ 基准测试失败:', error);
      throw error;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  
  benchmark.runFullSuite()
    .then(() => {
      console.log('\n✨ 基准测试完成!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 基准测试失败:', error);
      process.exit(1);
    });
}

module.exports = PerformanceBenchmark;
