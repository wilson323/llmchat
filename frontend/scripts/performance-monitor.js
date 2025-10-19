#!/usr/bin/env node

/**
 * 前端性能监控脚本
 * 监控构建时间、类型检查时间、包大小等关键指标
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      buildTime: 0,
      typeCheckTime: 0,
      bundleSize: 0,
      typeErrors: 0,
      lintErrors: 0,
      timestamp: new Date().toISOString()
    };
    
    this.reportPath = path.join(__dirname, '../reports/performance');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportPath)) {
      fs.mkdirSync(this.reportPath, { recursive: true });
    }
  }

  startTimer(name) {
    console.log(`🚀 开始测量: ${name}`);
    this.metrics[`${name}Start`] = Date.now();
  }

  endTimer(name) {
    const startTime = this.metrics[`${name}Start`];
    if (!startTime) {
      console.warn(`⚠️  未找到开始时间: ${name}`);
      return;
    }
    
    const duration = Date.now() - startTime;
    this.metrics[name] = duration;
    console.log(`✅ 完成测量: ${name} - ${duration}ms`);
    return duration;
  }

  async measureTypeCheck() {
    this.startTimer('typeCheckTime');
    try {
      execSync('pnpm run type-check', { stdio: 'pipe', cwd: path.join(__dirname, '..') });
      this.metrics.typeErrors = 0;
    } catch (error) {
      // 提取错误数量
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      const errorMatch = output.match(/Found (\d+) errors/);
      this.metrics.typeErrors = errorMatch ? parseInt(errorMatch[1]) : 1;
    }
    this.endTimer('typeCheckTime');
  }

  async measureBuild() {
    this.startTimer('buildTime');
    try {
      execSync('pnpm run build', { stdio: 'pipe', cwd: path.join(__dirname, '..') });
      
      // 计算构建产物大小
      const distPath = path.join(__dirname, '../dist');
      if (fs.existsSync(distPath)) {
        this.calculateBundleSize(distPath);
      }
    } catch (error) {
      console.error('构建失败:', error.message);
    }
    this.endTimer('buildTime');
  }

  calculateBundleSize(distPath) {
    let totalSize = 0;
    const files = this.getAllFiles(distPath);
    
    files.forEach(file => {
      const stats = fs.statSync(file);
      totalSize += stats.size;
    });
    
    this.metrics.bundleSize = totalSize;
    console.log(`📦 构建产物大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  }

  getAllFiles(dirPath) {
    const files = [];
    
    function traverse(currentPath) {
      const items = fs.readdirSync(currentPath);
      
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else {
          files.push(fullPath);
        }
      });
    }
    
    traverse(dirPath);
    return files;
  }

  async measureLint() {
    this.startTimer('lintTime');
    try {
      execSync('pnpm run lint', { stdio: 'pipe', cwd: path.join(__dirname, '..') });
      this.metrics.lintErrors = 0;
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      const errorMatch = output.match(/(\d+) problems/);
      this.metrics.lintErrors = errorMatch ? parseInt(errorMatch[1]) : 1;
    }
    this.endTimer('lintTime');
  }

  generateReport() {
    const report = {
      ...this.metrics,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = path.join(this.reportPath, `performance-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 性能报告已生成: ${reportPath}`);
    this.printSummary(report);
    
    return report;
  }

  generateSummary() {
    return {
      totalBuildTime: this.metrics.buildTime + this.metrics.typeCheckTime,
      hasErrors: this.metrics.typeErrors > 0 || this.metrics.lintErrors > 0,
      performanceGrade: this.calculatePerformanceGrade()
    };
  }

  calculatePerformanceGrade() {
    const totalTime = this.metrics.buildTime + this.metrics.typeCheckTime;
    const hasErrors = this.metrics.typeErrors > 0 || this.metrics.lintErrors > 0;
    
    if (hasErrors) return 'F';
    if (totalTime < 30000) return 'A';  // 30秒以下
    if (totalTime < 60000) return 'B';  // 60秒以下
    if (totalTime < 120000) return 'C'; // 120秒以下
    return 'D';
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.metrics.buildTime > 60000) {
      recommendations.push({
        type: 'build',
        message: '构建时间过长，建议启用增量编译和优化依赖',
        priority: 'high'
      });
    }
    
    if (this.metrics.typeCheckTime > 20000) {
      recommendations.push({
        type: 'typescript',
        message: '类型检查时间过长，建议优化tsconfig配置',
        priority: 'medium'
      });
    }
    
    if (this.metrics.bundleSize > 50 * 1024 * 1024) { // 50MB
      recommendations.push({
        type: 'bundle',
        message: '包体积过大，建议启用代码分割和Tree Shaking',
        priority: 'high'
      });
    }
    
    if (this.metrics.typeErrors > 0) {
      recommendations.push({
        type: 'errors',
        message: `存在${this.metrics.typeErrors}个类型错误，建议优先修复`,
        priority: 'critical'
      });
    }
    
    return recommendations;
  }

  printSummary(report) {
    console.log('\n📊 性能报告摘要:');
    console.log('==================');
    console.log(`⏱️  总构建时间: ${(report.summary.totalBuildTime / 1000).toFixed(2)}s`);
    console.log(`📦 构建产物大小: ${(report.bundleSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🔍 类型检查时间: ${(report.typeCheckTime / 1000).toFixed(2)}s`);
    console.log(`🔧 构建时间: ${(report.buildTime / 1000).toFixed(2)}s`);
    console.log(`❌ 类型错误: ${report.typeErrors}`);
    console.log(`⚠️  Lint错误: ${report.lintErrors}`);
    console.log(`🎯 性能等级: ${report.summary.performanceGrade}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 优化建议:');
      report.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'critical' ? '🚨' : 
                        rec.priority === 'high' ? '⚠️' : 
                        rec.priority === 'medium' ? '📝' : '💡';
        console.log(`${index + 1}. ${priority} ${rec.message}`);
      });
    }
  }

  async run() {
    console.log('🚀 开始性能监控...');
    
    await this.measureTypeCheck();
    await this.measureLint();
    await this.measureBuild();
    
    const report = this.generateReport();
    
    // 返回性能等级
    return report.summary.performanceGrade;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.run()
    .then(grade => {
      console.log(`\n✨ 性能监控完成，等级: ${grade}`);
      process.exit(grade === 'F' ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ 性能监控失败:', error);
      process.exit(1);
    });
}

module.exports = PerformanceMonitor;
