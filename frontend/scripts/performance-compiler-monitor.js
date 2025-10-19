#!/usr/bin/env node

/**
 * TypeScript编译性能监控脚本
 * 用于监控编译时间、内存使用和性能指标
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: 0,
      endTime: 0,
      duration: 0,
      memoryUsage: {
        initial: 0,
        peak: 0,
        final: 0
      },
      compilationStats: {
        filesCount: 0,
        errorsCount: 0,
        warningsCount: 0,
        linesCount: 0
      }
    };
    this.process = null;
  }

  // 开始监控
  startMonitoring() {
    console.log('🚀 开始TypeScript编译性能监控...');
    this.metrics.startTime = performance.now();
    this.metrics.memoryUsage.initial = process.memoryUsage();

    // 定期记录内存使用
    this.memoryInterval = setInterval(() => {
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed > this.metrics.memoryUsage.peak) {
        this.metrics.memoryUsage.peak = currentMemory.heapUsed;
      }
    }, 100);

    return this;
  }

  // 监控TypeScript编译
  monitorTypeScriptCompilation(command, config = 'tsconfig.json') {
    return new Promise((resolve, reject) => {
      console.log(`📝 执行编译命令: tsc --noEmit -p ${config}`);

      const startTime = performance.now();

      try {
        const result = execSync(command, {
          encoding: 'utf8',
          stdio: 'pipe',
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        const endTime = performance.now();
        this.metrics.endTime = endTime;
        this.metrics.duration = endTime - startTime;
        this.metrics.memoryUsage.final = process.memoryUsage();

        // 解析输出获取统计信息
        this.parseCompilationOutput(result);

        clearInterval(this.memoryInterval);
        resolve(result);
      } catch (error) {
        const endTime = performance.now();
        this.metrics.endTime = endTime;
        this.metrics.duration = endTime - startTime;
        this.metrics.memoryUsage.final = process.memoryUsage();

        clearInterval(this.memoryInterval);
        this.parseCompilationOutput(error.stdout || '');
        reject(error);
      }
    });
  }

  // 解析编译输出
  parseCompilationOutput(output) {
    const lines = output.split('\n');

    for (const line of lines) {
      // 统计文件数量
      if (line.includes('Found') && line.includes('error')) {
        const matches = line.match(/Found (\d+) error/);
        if (matches) {
          this.metrics.compilationStats.errorsCount = parseInt(matches[1]);
        }
      }

      // 统计警告
      if (line.includes('warning')) {
        this.metrics.compilationStats.warningsCount++;
      }

      // 统计编译文件（如果可用）
      if (line.includes('Starting compilation')) {
        this.metrics.compilationStats.filesCount++;
      }
    }

    // 计算项目文件统计
    this.calculateProjectStats();
  }

  // 计算项目统计信息
  calculateProjectStats() {
    try {
      const srcPath = path.resolve(__dirname, '../src');
      let linesCount = 0;
      let filesCount = 0;

      const countLines = (dir) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            countLines(fullPath);
          } else if (file.match(/\.(ts|tsx)$/)) {
            filesCount++;
            const content = fs.readFileSync(fullPath, 'utf8');
            linesCount += content.split('\n').length;
          }
        }
      };

      countLines(srcPath);

      this.metrics.compilationStats.filesCount = filesCount;
      this.metrics.compilationStats.linesCount = linesCount;
    } catch (error) {
      console.warn('⚠️  无法计算项目统计信息:', error.message);
    }
  }

  // 生成性能报告
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        duration: `${this.metrics.duration.toFixed(2)}ms`,
        memoryUsage: {
          initial: `${(this.metrics.memoryUsage.initial / 1024 / 1024).toFixed(2)}MB`,
          peak: `${(this.metrics.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`,
          final: `${(this.metrics.memoryUsage.final / 1024 / 1024).toFixed(2)}MB`,
          peakIncrease: `${((this.metrics.memoryUsage.peak - this.metrics.memoryUsage.initial) / 1024 / 1024).toFixed(2)}MB`
        },
        throughput: {
          filesPerSecond: Math.round((this.metrics.compilationStats.filesCount / this.metrics.duration) * 1000),
          linesPerSecond: Math.round((this.metrics.compilationStats.linesCount / this.metrics.duration) * 1000)
        }
      },
      details: {
        ...this.metrics,
        memoryUsage: {
          ...this.metrics.memoryUsage,
          initial: Math.round(this.metrics.memoryUsage.initial / 1024 / 1024),
          peak: Math.round(this.metrics.memoryUsage.peak / 1024 / 1024),
          final: Math.round(this.metrics.memoryUsage.final / 1024 / 1024)
        }
      }
    };

    return report;
  }

  // 输出报告到控制台
  printReport() {
    const report = this.generateReport();

    console.log('\n📊 TypeScript编译性能报告');
    console.log('='.repeat(50));
    console.log(`⏱️  编译时间: ${report.summary.duration}`);
    console.log(`📁 处理文件: ${this.metrics.compilationStats.filesCount} 个`);
    console.log(`📄 代码行数: ${this.metrics.compilationStats.linesCount} 行`);
    console.log(`❌ 错误数量: ${this.metrics.compilationStats.errorsCount}`);
    console.log(`⚠️  警告数量: ${this.metrics.compilationStats.warningsCount}`);
    console.log('\n💾 内存使用:');
    console.log(`   初始: ${report.summary.memoryUsage.initial}`);
    console.log(`   峰值: ${report.summary.memoryUsage.peak}`);
    console.log(`   最终: ${report.summary.memoryUsage.final}`);
    console.log(`   峰值增长: ${report.summary.memoryUsage.peakIncrease}`);
    console.log('\n⚡ 处理性能:');
    console.log(`   文件/秒: ${report.summary.throughput.filesPerSecond}`);
    console.log(`   行数/秒: ${report.summary.throughput.linesPerSecond}`);
    console.log('='.repeat(50));

    return report;
  }

  // 保存报告到文件
  saveReport(filePath) {
    const report = this.generateReport();
    const reportPath = filePath || path.resolve(__dirname, '../reports/performance-report.json');

    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 性能报告已保存到: ${reportPath}`);
    } catch (error) {
      console.error('❌ 保存报告失败:', error.message);
    }

    return reportPath;
  }

  // 清理缓存
  cleanupCache() {
    const cacheFiles = [
      '.tsbuildinfo',
      '.tsbuildinfo-performance',
      '.tsbuildinfo-dev',
      '.tsbuildinfo-fast'
    ];

    for (const file of cacheFiles) {
      try {
        const filePath = path.resolve(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  已清理缓存文件: ${file}`);
        }
      } catch (error) {
        console.warn(`⚠️  清理缓存文件失败 ${file}:`, error.message);
      }
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const config = args.find(arg => arg.startsWith('--config='))?.split('=')[1] || 'tsconfig.json';
  const cleanup = args.includes('--cleanup');
  const save = args.includes('--save');

  const monitor = new PerformanceMonitor();

  // 清理缓存
  if (cleanup) {
    monitor.cleanupCache();
    console.log('🧹 缓存清理完成\n');
  }

  // 开始监控
  monitor.startMonitoring();

  try {
    // 监控编译
    await monitor.monitorTypeScriptCompilation(`npx tsc --noEmit -p ${config}`, config);

    // 输出报告
    const report = monitor.printReport();

    // 保存报告
    if (save) {
      monitor.saveReport();
    }

    // 性能建议
    generateRecommendations(report);

  } catch (error) {
    console.error('\n❌ TypeScript编译失败');
    console.error('错误输出:', error.stdout || error.message);

    // 即使失败也输出性能报告
    const report = monitor.printReport();
    if (save) {
      monitor.saveReport();
    }

    process.exit(1);
  }
}

// 生成性能建议
function generateRecommendations(report) {
  console.log('\n💡 性能优化建议:');

  if (report.summary.duration > 5000) {
    console.log('⚠️  编译时间较长，建议:');
    console.log('   - 使用 tsconfig.performance.json 配置');
    console.log('   - 启用增量编译和跳过库检查');
    console.log('   - 考虑减少严格的类型检查选项');
  }

  const peakMemoryMB = parseFloat(report.summary.memoryUsage.peak);
  if (peakMemoryMB > 500) {
    console.log('⚠️  内存使用较高，建议:');
    console.log('   - 增加 Node.js 内存限制: --max-old-space-size=4096');
    console.log('   - 使用 tsconfig.fast.json 进行快速开发');
    console.log('   - 排除不必要的文件和依赖');
  }

  if (report.details.compilationStats.errorsCount > 0) {
    console.log('⚠️  存在类型错误，建议:');
    console.log('   - 优先修复类型错误以提升编译性能');
    console.log('   - 使用 --noEmit 标志进行类型检查');
  }

  if (report.summary.throughput.filesPerSecond < 50) {
    console.log('⚠️  编译吞吐量较低，建议:');
    console.log('   - 优化 tsconfig.json 的 include/exclude 配置');
    console.log('   - 使用路径映射缓存');
    console.log('   - 考虑升级到最新版本的 TypeScript');
  }

  console.log('\n📚 优化命令:');
  console.log('   开发模式: npm run type-check:dev');
  console.log('   性能模式: npm run type-check:perf');
  console.log('   快速模式: npm run type-check:fast');
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = PerformanceMonitor;