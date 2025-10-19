#!/usr/bin/env node

/**
 * 类型覆盖率监控工具
 * 提供详细的类型覆盖率分析和监控功能
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

class TypeCoverageMonitor {
  constructor(options = {}) {
    this.options = {
      threshold: 90,
      detailed: true,
      strict: false,
      outputFile: null,
      baseline: true,
      monitorMode: false,
      ...options
    };

    this.baselinePath = join(process.cwd(), '.type-coverage-baseline.json');
    this.reportPath = join(process.cwd(), '.type-coverage-report.json');
    this.trendPath = join(process.cwd(), '.type-coverage-trend.json');

    this.results = {
      coverage: {
        overall: 0,
        files: {},
        directories: {},
        types: {
          interfaces: 0,
          typeAliases: 0,
          enums: 0,
          classes: 0,
          functions: 0,
          variables: 0
        }
      },
      violations: [],
      trends: {},
      recommendations: [],
      score: 0
    };

    this.startTime = Date.now();
  }

  /**
   * 运行类型覆盖率监控
   */
  async run() {
    console.log('📊 开始类型覆盖率监控...\n');

    try {
      // 1. 检查工具依赖
      await this.checkDependencies();

      // 2. 执行类型覆盖率分析
      await this.analyzeTypeCoverage();

      // 3. 加载和比较基线
      if (this.options.baseline) {
        await this.loadBaseline();
      }

      // 4. 生成趋势分析
      await this.generateTrendAnalysis();

      // 5. 生成改进建议
      await this.generateRecommendations();

      // 6. 保存基线（如果需要）
      if (this.options.baseline) {
        await this.saveBaseline();
      }

      // 7. 生成报告
      await this.generateReport();

      // 8. 确定结果
      const success = this.determineSuccess();

      if (!success) {
        console.log('❌ 类型覆盖率检查未达标');
        process.exit(1);
      } else {
        console.log('✅ 类型覆盖率检查通过');
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ 类型覆盖率监控失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 检查工具依赖
   */
  async checkDependencies() {
    console.log('🔍 检查工具依赖...');

    try {
      // 检查 type-coverage
      execSync('pnpm exec type-coverage --version', { stdio: 'pipe' });
      console.log('✅ type-coverage 已安装');
    } catch (error) {
      console.log('⚠️ type-coverage 未安装，尝试安装...');
      try {
        execSync('pnpm add -D type-coverage @type-coverage/cli', { stdio: 'pipe' });
        console.log('✅ type-coverage 安装成功');
      } catch (installError) {
        throw new Error('无法安装 type-coverage，请手动安装');
      }
    }

    // 检查 TypeScript
    try {
      execSync('npx tsc --version', { stdio: 'pipe' });
      console.log('✅ TypeScript 已安装\n');
    } catch (error) {
      throw new Error('TypeScript 未安装或不可用');
    }
  }

  /**
   * 分析类型覆盖率
   */
  async analyzeTypeCoverage() {
    console.log('📈 分析类型覆盖率...');
    const startTime = Date.now();

    try {
      // 使用 type-coverage 获取详细覆盖率信息
      const coverageOutput = execSync('pnpm exec type-coverage --detail --strict', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.parseCoverageOutput(coverageOutput);

      // 获取按文件分组的覆盖率
      const fileCoverageOutput = execSync('pnpm exec type-coverage --detail --strict --files', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.parseFileCoverage(fileCoverageOutput);

      console.log(`📊 整体类型覆盖率: ${this.results.coverage.overall}%`);

      if (this.results.coverage.overall >= this.options.threshold) {
        console.log('✅ 类型覆盖率达标\n');
      } else {
        console.log(`⚠️ 类型覆盖率不足 (${this.options.threshold}%)\n`);
      }

    } catch (error) {
      const output = error.stdout || error.stderr || '';
      console.log('❌ 类型覆盖率分析失败');
      console.log('错误详情:', output);
      this.results.coverage.overall = 0;
    }

    this.results.coverage.analysisTime = Date.now() - startTime;
  }

  /**
   * 解析覆盖率输出
   */
  parseCoverageOutput(output) {
    const lines = output.split('\n');

    for (const line of lines) {
      // 提取总体覆盖率
      const overallMatch = line.match(/(\d+\.\d+)%\s+of\s+(\d+)/);
      if (overallMatch) {
        this.results.coverage.overall = parseFloat(overallMatch[1]);
        continue;
      }

      // 提取类型统计
      if (line.includes('interfaces:')) {
        this.results.coverage.types.interfaces = this.extractCount(line);
      } else if (line.includes('type aliases:')) {
        this.results.coverage.types.typeAliases = this.extractCount(line);
      } else if (line.includes('enums:')) {
        this.results.coverage.types.enums = this.extractCount(line);
      } else if (line.includes('classes:')) {
        this.results.coverage.types.classes = this.extractCount(line);
      }
    }
  }

  /**
   * 解析文件覆盖率
   */
  parseFileCoverage(output) {
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('src/') && line.includes('%')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const coverageStr = parts[parts.length - 1];
          const coverage = parseFloat(coverageStr.replace('%', ''));
          const filePath = parts.slice(0, -1).join(' ');

          this.results.coverage.files[filePath] = coverage;

          // 检查是否低于阈值
          if (coverage < this.options.threshold) {
            this.results.violations.push({
              type: 'low_coverage',
              file: filePath,
              coverage,
              threshold: this.options.threshold,
              gap: this.options.threshold - coverage
            });
          }

          // 更新目录统计
          const dir = dirname(filePath);
          if (!this.results.coverage.directories[dir]) {
            this.results.coverage.directories[dir] = {
              files: 0,
              totalCoverage: 0,
              averageCoverage: 0
            };
          }

          const dirStats = this.results.coverage.directories[dir];
          dirStats.files++;
          dirStats.totalCoverage += coverage;
          dirStats.averageCoverage = dirStats.totalCoverage / dirStats.files;
        }
      }
    }
  }

  /**
   * 从字符串中提取数字
   */
  extractCount(line) {
    const match = line.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * 加载基线数据
   */
  async loadBaseline() {
    console.log('📂 加载基线数据...');

    if (existsSync(this.baselinePath)) {
      try {
        const baseline = JSON.parse(readFileSync(this.baselinePath, 'utf8'));

        // 计算覆盖率变化
        const coverageChange = this.results.coverage.overall - baseline.coverage.overall;
        this.results.trends.coverageChange = coverageChange;

        if (coverageChange < 0) {
          console.log(`⚠️ 类型覆盖率下降: ${Math.abs(coverageChange).toFixed(2)}%`);
          this.results.violations.push({
            type: 'coverage_regression',
            current: this.results.coverage.overall,
            baseline: baseline.coverage.overall,
            change: coverageChange
          });
        } else if (coverageChange > 0) {
          console.log(`✅ 类型覆盖率提升: +${coverageChange.toFixed(2)}%`);
        } else {
          console.log('➡️ 类型覆盖率保持不变');
        }

        // 比较文件级别的变化
        for (const [file, currentCoverage] of Object.entries(this.results.coverage.files)) {
          if (baseline.coverage.files[file]) {
            const fileChange = currentCoverage - baseline.coverage.files[file];
            if (fileChange < -5) { // 显著下降
              this.results.violations.push({
                type: 'file_coverage_regression',
                file,
                current: currentCoverage,
                baseline: baseline.coverage.files[file],
                change: fileChange
              });
            }
          }
        }

        console.log('✅ 基线数据加载完成\n');
      } catch (error) {
        console.log('⚠️ 基线数据损坏，将创建新的基线');
      }
    } else {
      console.log('ℹ️ 未找到基线数据，将创建新的基线');
    }
  }

  /**
   * 生成趋势分析
   */
  async generateTrendAnalysis() {
    console.log('📈 生成趋势分析...');

    let trends = [];
    if (existsSync(this.trendPath)) {
      try {
        trends = JSON.parse(readFileSync(this.trendPath, 'utf8'));
      } catch (error) {
        console.log('⚠️ 趋势数据损坏，重新开始');
        trends = [];
      }
    }

    // 添加当前数据点
    const currentDataPoint = {
      timestamp: new Date().toISOString(),
      coverage: this.results.coverage.overall,
      violations: this.results.violations.length,
      score: this.calculateScore()
    };

    trends.push(currentDataPoint);

    // 保持最近30天的数据
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    trends = trends.filter(point => new Date(point.timestamp) > thirtyDaysAgo);

    // 保存趋势数据
    writeFileSync(this.trendPath, JSON.stringify(trends, null, 2));

    // 计算趋势
    if (trends.length >= 2) {
      const recent = trends.slice(-7); // 最近7天
      const previous = trends.slice(-14, -7); // 前7天

      if (recent.length > 0 && previous.length > 0) {
        const recentAvg = recent.reduce((sum, p) => sum + p.coverage, 0) / recent.length;
        const previousAvg = previous.reduce((sum, p) => sum + p.coverage, 0) / previous.length;

        this.results.trends.weeklyTrend = recentAvg - previousAvg;

        if (this.results.trends.weeklyTrend > 1) {
          console.log(`📈 类型覆盖率呈上升趋势 (+${this.results.trends.weeklyTrend.toFixed(2)}%)`);
        } else if (this.results.trends.weeklyTrend < -1) {
          console.log(`📉 类型覆盖率呈下降趋势 (${this.results.trends.weeklyTrend.toFixed(2)}%)`);
        } else {
          console.log('➡️ 类型覆盖率保持稳定');
        }
      }
    }

    console.log('✅ 趋势分析完成\n');
  }

  /**
   * 生成改进建议
   */
  async generateRecommendations() {
    console.log('💡 生成改进建议...');

    const recommendations = [];

    // 基于违规项生成建议
    for (const violation of this.results.violations) {
      switch (violation.type) {
        case 'low_coverage':
          recommendations.push({
            type: 'coverage',
            priority: 'high',
            file: violation.file,
            message: `文件 ${violation.file} 类型覆盖率仅 ${violation.coverage}%，建议添加类型定义`,
            action: 'review_and_add_types'
          });
          break;

        case 'coverage_regression':
          recommendations.push({
            type: 'regression',
            priority: 'critical',
            message: `类型覆盖率下降 ${Math.abs(violation.change).toFixed(2)}%，需要立即调查`,
            action: 'investigate_regression'
          });
          break;

        case 'file_coverage_regression':
          recommendations.push({
            type: 'file_regression',
            priority: 'high',
            file: violation.file,
            message: `文件 ${violation.file} 类型覆盖率下降 ${Math.abs(violation.change).toFixed(2)}%`,
            action: 'review_file_changes'
          });
          break;
      }
    }

    // 基于整体覆盖率生成建议
    if (this.results.coverage.overall < 70) {
      recommendations.push({
        type: 'general',
        priority: 'critical',
        message: '类型覆盖率严重不足，建议启用严格的TypeScript配置',
        action: 'enable_strict_typescript'
      });
    } else if (this.results.coverage.overall < 85) {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        message: '类型覆盖率有待提升，建议逐步添加类型定义',
        action: 'incremental_typing'
      });
    }

    // 基于类型分布生成建议
    const totalTypes = Object.values(this.results.coverage.types).reduce((sum, count) => sum + count, 0);
    if (totalTypes > 0) {
      const interfaceRatio = this.results.coverage.types.interfaces / totalTypes;
      if (interfaceRatio < 0.3) {
        recommendations.push({
          type: 'architecture',
          priority: 'medium',
          message: '建议增加接口定义以改善类型安全性',
          action: 'add_more_interfaces'
        });
      }
    }

    // 去重并按优先级排序
    this.results.recommendations = recommendations
      .filter((rec, index, arr) => arr.findIndex(r => r.message === rec.message) === index)
      .sort((a, b) => {
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    console.log(`✅ 生成了 ${this.results.recommendations.length} 条改进建议\n`);
  }

  /**
   * 保存基线
   */
  async saveBaseline() {
    console.log('💾 保存类型覆盖率基线...');

    const baseline = {
      timestamp: new Date().toISOString(),
      coverage: this.results.coverage,
      violations: this.results.violations,
      recommendations: this.results.recommendations,
      score: this.calculateScore()
    };

    writeFileSync(this.baselinePath, JSON.stringify(baseline, null, 2));
    console.log('✅ 基线保存完成\n');
  }

  /**
   * 生成报告
   */
  async generateReport() {
    console.log('📄 生成类型覆盖率报告...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        overall: this.results.coverage.overall,
        threshold: this.options.threshold,
        passed: this.results.coverage.overall >= this.options.threshold,
        score: this.calculateScore(),
        violations: this.results.violations.length,
        recommendations: this.results.recommendations.length
      },
      coverage: this.results.coverage,
      violations: this.results.violations,
      trends: this.results.trends,
      recommendations: this.results.recommendations,
      duration: Date.now() - this.startTime
    };

    // 保存完整报告
    writeFileSync(this.reportPath, JSON.stringify(report, null, 2));

    // 如果指定了输出文件，也保存一份
    if (this.options.outputFile) {
      writeFileSync(this.options.outputFile, JSON.stringify(report, null, 2));
    }

    // 显示摘要
    this.displaySummary(report);

    console.log('✅ 报告生成完成\n');
  }

  /**
   * 显示摘要
   */
  displaySummary(report) {
    console.log('📊 类型覆盖率监控摘要');
    console.log('='.repeat(50));
    console.log(`时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);
    console.log(`整体覆盖率: ${report.summary.overall}% (目标: ${report.summary.threshold}%)`);
    console.log(`状态: ${report.summary.passed ? '✅ 通过' : '❌ 未达标'}`);
    console.log(`质量评分: ${report.summary.score}/100`);
    console.log(`违规项: ${report.summary.violations}`);
    console.log(`改进建议: ${report.summary.recommendations}`);
    console.log(`分析耗时: ${(report.duration / 1000).toFixed(2)}s`);

    if (report.violations.length > 0) {
      console.log('\n🚨 主要问题:');
      report.violations.slice(0, 5).forEach((violation, index) => {
        console.log(`  ${index + 1}. ${violation.file || '项目级别'} - ${violation.type}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 优先改进建议:');
      report.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }

    console.log('='.repeat(50));
  }

  /**
   * 计算质量评分
   */
  calculateScore() {
    let score = 0;

    // 覆盖率得分 (60%)
    const coverageScore = (this.results.coverage.overall / 100) * 60;
    score += coverageScore;

    // 违规项扣分 (20%)
    const violationPenalty = Math.min(20, this.results.violations.length * 2);
    score += 20 - violationPenalty;

    // 趋势得分 (10%)
    let trendScore = 10;
    if (this.results.trends.weeklyTrend) {
      if (this.results.trends.weeklyTrend > 2) trendScore = 10;
      else if (this.results.trends.weeklyTrend > 0) trendScore = 8;
      else if (this.results.trends.weeklyTrend > -2) trendScore = 6;
      else trendScore = 2;
    }
    score += trendScore;

    // 文件分布得分 (10%)
    const fileCount = Object.keys(this.results.coverage.files).length;
    const avgFileCoverage = Object.values(this.results.coverage.files)
      .reduce((sum, cov) => sum + cov, 0) / fileCount;
    const distributionScore = (avgFileCoverage / 100) * 10;
    score += distributionScore;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * 确定成功状态
   */
  determineSuccess() {
    return this.results.coverage.overall >= this.options.threshold &&
           (!this.options.strict || this.results.violations.length === 0);
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--threshold':
        options.threshold = parseFloat(args[++i]);
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--no-baseline':
        options.baseline = false;
        break;
      case '--monitor':
        options.monitorMode = true;
        break;
      case '--help':
        console.log(`
类型覆盖率监控工具

用法: node type-coverage-monitor.js [选项]

选项:
  --threshold <number>   覆盖率阈值 (默认: 90)
  --strict              严格模式，任何违规都失败
  --output <file>       输出报告到文件
  --no-baseline         不使用基线比较
  --monitor             监控模式
  --help                显示帮助信息

示例:
  node type-coverage-monitor.js
  node type-coverage-monitor.js --threshold 85 --strict
  node type-coverage-monitor.js --output coverage-report.json
  node type-coverage-monitor.js --monitor --threshold 95
        `);
        process.exit(0);
    }
  }

  const monitor = new TypeCoverageMonitor(options);
  monitor.run();
}

module.exports = TypeCoverageMonitor;