#!/usr/bin/env node

/**
 * 质量监控脚本
 * 生成代码质量报告并跟踪趋势
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  dim: chalk.dim
};

class QualityMonitor {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'quality');
    this.timestamp = new Date().toISOString().split('T')[0];
    this.reportPath = path.join(this.reportsDir, `quality-${this.timestamp}.json`);
    this.trendPath = path.join(this.reportsDir, 'quality-trend.json');
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  runCommand(command, options = {}) {
    const { silent = false, timeout = 30000 } = options;

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit',
        timeout
      });
      return { success: true, output: result };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message
      };
    }
  }

  analyzeDependencies() {
    console.log(colors.info('📦 Analyzing dependencies...'));

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});

      // 检查依赖更新
      const outdatedCheck = this.runCommand('pnpm outdated --json', { silent: true });

      return {
        total: dependencies.length + devDependencies.length,
        production: dependencies.length,
        development: devDependencies.length,
        outdated: outdatedCheck.success ? Object.keys(JSON.parse(outdatedCheck.output)).length : 0,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  analyzeLint() {
    console.log(colors.info('🔍 Analyzing code quality...'));

    const result = this.runCommand('pnpm run lint --format=json', { silent: true });

    if (!result.success) {
      return {
        errors: 0,
        warnings: 0,
        issues: [],
        error: result.error
      };
    }

    try {
      const eslintReport = JSON.parse(result.output);
      const issues = eslintReport || [];

      const errors = issues.filter(issue => issue.severity === 2).length;
      const warnings = issues.filter(issue => issue.severity === 1).length;

      return {
        errors,
        warnings,
        total: issues.length,
        issues: issues.slice(0, 10), // 保存前10个问题作为样本
        analyzedAt: new Date().toISOString()
      };
    } catch (parseError) {
      return {
        errors: 0,
        warnings: 0,
        issues: [],
        error: 'Failed to parse ESLint output'
      };
    }
  }

  analyzeTestCoverage() {
    console.log(colors.info('🧪 Analyzing test coverage...'));

    // 尝试运行测试覆盖率
    const coverageResult = this.runCommand('pnpm run test:coverage', { silent: true });

    if (!coverageResult.success) {
      // 如果覆盖率失败，尝试运行普通测试
      const testResult = this.runCommand('pnpm test', { silent: true });
      return {
        coverageAvailable: false,
        testsPassed: testResult.success,
        error: testResult.success ? null : testResult.error
      };
    }

    // 解析覆盖率报告（如果存在）
    const coverageDir = path.join(process.cwd(), 'coverage');
    const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');

    let coverage = {};
    if (fs.existsSync(coverageSummaryPath)) {
      try {
        coverage = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
      } catch (error) {
        console.log(colors.warning('⚠️  Could not parse coverage summary'));
      }
    }

    return {
      coverageAvailable: true,
      testsPassed: true,
      ...coverage,
      analyzedAt: new Date().toISOString()
    };
  }

  analyzeBuild() {
    console.log(colors.info('🏗️  Analyzing build...'));

    const buildResult = this.runCommand('pnpm run build', { silent: true });

    if (!buildResult.success) {
      return {
        success: false,
        error: buildResult.error,
        buildTime: 0,
        buildSize: 0
      };
    }

    // 分析构建产物大小
    let buildSize = 0;
    const buildDirs = ['backend/dist', 'frontend/dist'];

    buildDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        try {
          const stats = this.runCommand(`du -sb ${dir}`, { silent: true });
          if (stats.success) {
            const size = parseInt(stats.output.split('\t')[0]);
            buildSize += size;
          }
        } catch (error) {
          // 忽略大小计算错误
        }
      }
    });

    return {
      success: true,
      buildTime: 0, // TODO: 实现构建时间测量
      buildSize,
      analyzedAt: new Date().toISOString()
    };
  }

  analyzeSecurity() {
    console.log(colors.info('🔒 Analyzing security...'));

    const auditResult = this.runCommand('pnpm audit --json', { silent: true });

    if (!auditResult.success) {
      return {
        vulnerabilities: 0,
        highVulnerabilities: 0,
        criticalVulnerabilities: 0,
        error: auditResult.error
      };
    }

    try {
      const audit = JSON.parse(auditResult);
      const vulnerabilities = audit.vulnerabilities || {};

      const counts = Object.values(vulnerabilities).reduce((acc, vuln) => {
        const severity = vuln.severity;
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {});

      return {
        total: Object.keys(vulnerabilities).length,
        low: counts.low || 0,
        moderate: counts.moderate || 0,
        high: counts.high || 0,
        critical: counts.critical || 0,
        analyzedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        vulnerabilities: 0,
        highVulnerabilities: 0,
        criticalVulnerabilities: 0,
        error: 'Failed to parse audit results'
      };
    }
  }

  generateReport() {
    console.log(colors.info('📊 Generating quality report...'));

    const report = {
      timestamp: this.timestamp,
      repository: this.getRepoInfo(),
      metrics: {
        dependencies: this.analyzeDependencies(),
        lint: this.analyzeLint(),
        tests: this.analyzeTestCoverage(),
        build: this.analyzeBuild(),
        security: this.analyzeSecurity()
      },
      summary: this.generateSummary()
    };

    return report;
  }

  generateSummary() {
    // 这个方法将在所有分析完成后调用
    return {
      status: 'pending', // 将在最终报告中更新
      score: 0,         // 将在最终报告中计算
      recommendations: []
    };
  }

  getRepoInfo() {
    try {
      const gitRemote = this.runCommand('git remote get-url origin', { silent: true });
      const gitBranch = this.runCommand('git branch --show-current', { silent: true });
      const gitCommit = this.runCommand('git rev-parse HEAD', { silent: true });

      return {
        remote: gitRemote.success ? gitRemote.output.trim() : 'unknown',
        branch: gitBranch.success ? gitBranch.output.trim() : 'unknown',
        commit: gitCommit.success ? gitCommit.output.trim() : 'unknown'
      };
    } catch (error) {
      return {
        remote: 'unknown',
        branch: 'unknown',
        commit: 'unknown'
      };
    }
  }

  calculateScore(report) {
    let score = 100;

    // ESLint问题扣分
    if (report.metrics.lint.errors > 0) {
      score -= report.metrics.lint.errors * 10;
    }
    if (report.metrics.lint.warnings > 0) {
      score -= report.metrics.lint.warnings * 2;
    }

    // 安全漏洞扣分
    if (report.metrics.security.high > 0) {
      score -= report.metrics.security.high * 20;
    }
    if (report.metrics.security.critical > 0) {
      score -= report.metrics.security.critical * 50;
    }
    if (report.metrics.security.moderate > 0) {
      score -= report.metrics.security.moderate * 5;
    }

    // 构建失败扣分
    if (!report.metrics.build.success) {
      score -= 30;
    }

    // 测试失败扣分
    if (!report.metrics.tests.testsPassed) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  generateRecommendations(report) {
    const recommendations = [];

    if (report.metrics.lint.errors > 0) {
      recommendations.push(`修复 ${report.metrics.lint.errors} 个ESLint错误`);
    }

    if (report.metrics.lint.warnings > 5) {
      recommendations.push(`处理 ${report.metrics.lint.warnings} 个ESLint警告`);
    }

    if (report.metrics.security.high > 0) {
      recommendations.push(`紧急处理 ${report.metrics.security.high} 个高危安全漏洞`);
    }

    if (report.metrics.security.critical > 0) {
      recommendations.push(`立即处理 ${report.metrics.security.critical} 个严重安全漏洞`);
    }

    if (!report.metrics.build.success) {
      recommendations.push('修复构建问题');
    }

    if (!report.metrics.tests.testsPassed) {
      recommendations.push('修复测试失败问题');
    }

    if (report.metrics.dependencies.outdated > 10) {
      recommendations.push('更新过时的依赖包');
    }

    if (recommendations.length === 0) {
      recommendations.push('代码质量良好，继续保持！');
    }

    return recommendations;
  }

  updateTrend(report) {
    let trend = [];

    if (fs.existsSync(this.trendPath)) {
      try {
        trend = JSON.parse(fs.readFileSync(this.trendPath, 'utf8'));
      } catch (error) {
        console.log(colors.warning('⚠️  Could not read existing trend data'));
      }
    }

    trend.push({
      timestamp: report.timestamp,
      score: report.summary.score,
      lintErrors: report.metrics.lint.errors,
      lintWarnings: report.metrics.lint.warnings,
      securityHigh: report.metrics.security.high,
      securityCritical: report.metrics.security.critical,
      buildSuccess: report.metrics.build.success,
      testsPassed: report.metrics.tests.testsPassed
    });

    // 只保留最近30天的数据
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    trend = trend.filter(entry => new Date(entry.timestamp) >= thirtyDaysAgo);

    fs.writeFileSync(this.trendPath, JSON.stringify(trend, null, 2));
    return trend;
  }

  saveReport(report) {
    this.ensureReportsDir();

    // 计算最终评分和建议
    report.summary.score = this.calculateScore(report);
    report.summary.recommendations = this.generateRecommendations(report);
    report.summary.status = report.summary.score >= 80 ? 'excellent' :
                          report.summary.score >= 60 ? 'good' :
                          report.summary.score >= 40 ? 'fair' : 'poor';

    // 保存当前报告
    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));

    // 更新趋势数据
    const trend = this.updateTrend(report);

    console.log(colors.success(`✅ Quality report saved to: ${this.reportPath}`));
    console.log(colors.success(`✅ Trend data updated with ${trend.length} data points`));

    return { report, trend };
  }

  displaySummary(report) {
    console.log('\n' + colors.info('📊 Quality Report Summary'));
    console.log('=' .repeat(50));

    console.log(`\n🎯 Overall Score: ${report.summary.score}/100`);
    console.log(`📈 Status: ${report.summary.status.toUpperCase()}`);

    console.log('\n🔍 Code Quality:');
    console.log(`  Errors: ${report.metrics.lint.errors}`);
    console.log(`  Warnings: ${report.metrics.lint.warnings}`);

    console.log('\n🔒 Security:');
    console.log(`  High: ${report.metrics.security.high}`);
    console.log(`  Critical: ${report.metrics.security.critical}`);
    console.log(`  Moderate: ${report.metrics.security.moderate}`);

    console.log('\n🏗️  Build & Tests:');
    console.log(`  Build: ${report.metrics.build.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Tests: ${report.metrics.tests.testsPassed ? '✅ Passed' : '❌ Failed'}`);

    console.log('\n💡 Recommendations:');
    report.summary.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });

    console.log('\n' + '=' .repeat(50));
  }
}

function main() {
  const monitor = new QualityMonitor();

  try {
    console.log(colors.info('🚀 Starting quality monitoring...\n'));

    const report = monitor.generateReport();
    const { report: finalReport, trend } = monitor.saveReport(report);

    monitor.displaySummary(finalReport);

    // 根据质量评分设置退出码
    if (finalReport.summary.score < 60) {
      console.log(colors.error('\n❌ Quality score below acceptable threshold (60)'));
      process.exit(1);
    }

    console.log(colors.success('\n🎉 Quality monitoring completed successfully!'));
  } catch (error) {
    console.log(colors.error(`❌ Quality monitoring failed: ${error.message}`));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = QualityMonitor;