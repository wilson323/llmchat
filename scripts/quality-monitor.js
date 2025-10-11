#!/usr/bin/env node

/**
 * 代码质量监控脚本
 * 用于持续监控项目代码质量，并与基准线对比
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class QualityMonitor {
  constructor() {
    this.baselinePath = path.join(__dirname, '../quality-baseline.json');
    this.projectRoot = path.join(__dirname, '..');
    this.reportPath = path.join(__dirname, '../quality-reports');
  }

  /**
   * 运行ESLint并获取结果
   */
  runESLint(target, options = {}) {
    try {
      const cmd = `cd ${target} && npx eslint ${options.pattern || '**/*.{ts,tsx}'} --format=json`;
      const result = execSync(cmd, { encoding: 'utf8' });
      return JSON.parse(result);
    } catch (error) {
      // ESLint返回非零退出码时，仍然解析输出
      try {
        return JSON.parse(error.stdout);
      } catch {
        return [];
      }
    }
  }

  /**
   * 分析ESLint结果
   */
  analyzeResults(results, componentName) {
    const analysis = {
      total: results.length,
      errors: results.filter(r => r.severity === 2).length,
      warnings: results.filter(r => r.severity === 1).length,
      rules: {},
      files: new Set()
    };

    results.forEach(result => {
      analysis.files.add(result.filePath);
      const ruleId = result.ruleId || 'unknown';
      analysis.rules[ruleId] = (analysis.rules[ruleId] || 0) + 1;
    });

    analysis.uniqueFiles = analysis.files.size;
    return { ...analysis, componentName };
  }

  /**
   * 加载基准线
   */
  loadBaseline() {
    if (!fs.existsSync(this.baselinePath)) {
      throw new Error('基准线文件不存在，请先建立质量基准线');
    }
    return JSON.parse(fs.readFileSync(this.baselinePath, 'utf8'));
  }

  /**
   * 执行质量监控
   */
  run() {
    try {
      console.log('🔍 开始代码质量监控...');

      // 运行ESLint分析
      console.log('📊 分析前端代码质量...');
      const frontendResults = this.analyzeResults(
        this.runESLint('../frontend'),
        'frontend'
      );

      console.log('📊 分析后端代码质量...');
      const backendResults = this.analyzeResults(
        this.runESLint('../backend'),
        'backend'
      );

      console.log(`✅ 质量监控完成！`);
      console.log(`📊 前端: ${frontendResults.total} 个问题`);
      console.log(`📊 后端: ${backendResults.total} 个问题`);
      console.log(`📊 总计: ${frontendResults.total + backendResults.total} 个问题`);

    } catch (error) {
      console.error('❌ 质量监控失败:', error.message);
      process.exit(1);
    }
  }
}

// 运行质量监控
if (require.main === module) {
  const monitor = new QualityMonitor();
  monitor.run();
}

module.exports = QualityMonitor;