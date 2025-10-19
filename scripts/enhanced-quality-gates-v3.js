#!/usr/bin/env node

/**
 * 增强质量门禁系统 - 修复版本 v3
 *
 * 主要修复：
 * 1. 修复质量分数计算逻辑，确保低分正确失败
 * 2. 改进错误分类和权重分配
 * 3. 增强TypeScript检查集成
 * 4. 优化阈值管理和告警机制
 * 5. 提供更详细的诊断信息
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜要安装 chalk包以支持颜色输出
let colors;
try {
  colors = require('chalk');
} catch (error) {
  // 如果没有chalk，使用简单的颜色替换
  colors = {
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    magenta: (text) => `\x1b[35m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`
  };
}

class EnhancedQualityGateSystem {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'quality-gates');
    this.configPath = path.join(process.cwd(), 'config', 'quality-gates.json');
    this.thresholds = this.loadThresholds();
    this.ensureReportsDir();
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  loadThresholds() {
    const defaultThresholds = {
      eslint: {
        maxErrors: 0,
        maxWarnings: 5,  // 降低警告容忍度
        errorWeight: 15,    // 增加错误权重
        warningWeight: 3
      },
      security: {
        maxCritical: 0,
        maxHigh: 0,
        maxModerate: 2,  // 降低中危漏洞容忍度
        criticalWeight: 50,
        highWeight: 25,
        moderateWeight: 10,
        lowWeight: 5
      },
      testCoverage: {
        minCoverage: 75,    // 降低最低覆盖率要求
        minStatements: 75,
        minBranches: 65,
        minFunctions: 75,
        minLines: 75
      },
      build: {
        maxSizeMB: 100,    // 增加构建大小限制
        maxTimeSeconds: 180
      },
      dependencies: {
        maxOutdated: 5,     // 严格控制过时依赖
        maxHighVulns: 0,
        requireLicenseCheck: true
      },
      typescript: {
        maxErrors: 0,        // TypeScript错误零容忍
        errorWeight: 20
      }
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return { ...defaultThresholds, ...config };
      }
    } catch (error) {
      console.warn(colors.yellow('⚠️  Could not load quality gates config, using defaults'));
    }

    return defaultThresholds;
  }

  runCommand(command, options = {}) {
    const { silent = false, timeout = 120000, allowFailure = false, cwd = process.cwd() } = options;

    const startTime = Date.now();
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit',
        timeout,
        cwd
      });
      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result,
        duration,
        executionTime: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      if (allowFailure) {
        return {
          success: false,
          output: error.stdout || '',
          error: error.message,
          duration,
          executionTime: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  checkESLint() {
    console.log(colors.blue('🔍 Running ESLint analysis...'));

    const result = this.runCommand('pnpm run lint --format=json', { silent: true, allowFailure: true });

    if (!result.success) {
      const isToolError = result.error && (
        result.error.includes('ENOENT') ||
        result.error.includes('command not found') ||
        result.error.includes('Cannot find module') ||
        result.error.includes('eslint: command not found')
      );

      return {
        status: isToolError ? 'ERROR' : 'FAILED',
        errors: 0,
        warnings: 0,
        score: isToolError ? 25 : 0, // 工具错误给低分
        issues: [],
        error: result.error,
        errorType: isToolError ? 'TOOL_ERROR' : 'CODE_ERROR',
        suggestion: isToolError
          ? 'Install ESLint: npm install -g eslint'
          : 'Fix ESLint errors: pnpm run lint:fix'
      };
    }

    try {
      const eslintReport = JSON.parse(result.output);
      const issues = eslintReport || [];

      const errors = issues.filter(issue => issue.severity === 2).length;
      const warnings = issues.filter(issue => issue.severity === 1).length;

      const threshold = this.thresholds.eslint;
      let passed = errors <= threshold.maxErrors && warnings <= threshold.maxWarnings;

      // 严格的质量分数计算
      let score = 100;
      score -= errors * threshold.errorWeight;
      score -= warnings * threshold.warningWeight;
      score = Math.max(0, score);

      return {
        status: passed && score >= 70 ? 'PASSED' : 'FAILED',
        errors,
        warnings,
        score,
        totalIssues: issues.length,
        threshold,
        issues: issues.slice(0, 10), // 只显示前10个问题
        analyzedAt: new Date().toISOString(),
        suggestion: score < 100 ? `Fix ${errors} errors and ${warnings} warnings` : 'ESLint checks passed'
      };
    } catch (parseError) {
      return {
        status: 'ERROR',
        errors: 0,
        warnings: 0,
        score: 0, // 解析错误给0分
        issues: [],
        error: 'Failed to parse ESLint output',
        errorType: 'PARSE_ERROR',
        suggestion: 'Check ESLint configuration: npx eslint --init'
      };
    }
  }

  checkSecurity() {
    console.log(colors.blue('🔒 Running security audit...'));

    const result = this.runCommand('pnpm audit --json', { silent: true, allowFailure: true });

    if (!result.success) {
      const isToolError = result.error && (
        result.error.includes('ENOENT') ||
        result.error.includes('command not found') ||
        result.error.includes('pnpm: command not found')
      );

      return {
        status: isToolError ? 'ERROR' : 'FAILED',
        vulnerabilities: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        score: isToolError ? 25 : 0,
        error: result.error,
        errorType: isToolError ? 'TOOL_ERROR' : 'AUDIT_ERROR',
        suggestion: isToolError
          ? 'Install pnpm: npm install -g pnpm'
          : 'Run security audit manually: pnpm audit'
      };
    }

    try {
      const audit = JSON.parse(result.output);
      const vulnerabilities = audit.vulnerabilities || {};

      const severityCounts = Object.values(vulnerabilities).reduce((acc, vuln) => {
        const severity = vuln.severity;
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {});

      const critical = severityCounts.critical || 0;
      const high = severityCounts.high || 0;
      const moderate = severityCounts.moderate || 0;
      const low = severityCounts.low || 0;
      const total = Object.keys(vulnerabilities).length;

      const threshold = this.thresholds.security;
      let passed = critical <= threshold.maxCritical &&
                   high <= threshold.maxHigh &&
                   moderate <= threshold.maxModerate;

      // 严格的安全分数计算
      let score = 100;
      score -= critical * threshold.criticalWeight;
      score -= high * threshold.highWeight;
      score -= moderate * threshold.moderateWeight;
      score -= low * threshold.lowWeight;
      score = Math.max(0, score);

      return {
        status: passed && score >= 70 ? 'PASSED' : 'FAILED',
        total,
        critical,
        high,
        moderate,
        low,
        score,
        threshold,
        analyzedAt: new Date().toISOString(),
        suggestion: score < 100 ? `Address ${critical} critical, ${high} high, and ${moderate} moderate vulnerabilities` : 'Security audit passed'
      };
    } catch (parseError) {
      return {
        status: 'ERROR',
        vulnerabilities: 0,
        score: 0,
        error: 'Failed to parse audit results',
        errorType: 'PARSE_ERROR',
        suggestion: 'Check audit output format: pnpm audit --json'
      };
    }
  }

  checkTypeScript() {
    console.log(colors.blue('📝 Running TypeScript type checking...'));

    // 检查前端TypeScript
    const frontendResult = this.runCommand('pnpm run type-check', { silent: true, allowFailure: true });
    const backendResult = this.runCommand('cd backend && pnpm run type-check', { silent: true, allowFailure: true });

    const results = { frontend: frontendResult, backend: backendResult };
    const errors = [];
    const warnings = [];

    for (const [component, result] of Object.entries(results)) {
      if (!result.success) {
        // 解析TypeScript错误
        const errorLines = result.error.split('\n').filter(line => line.includes('error TS'));
        errors.push(...errorLines.map(line => ({
          component,
          error: line.trim()
        })));
      }
    }

    const totalErrors = errors.length;
    const threshold = this.thresholds.typescript;
    let passed = totalErrors <= threshold.maxErrors;
    let score = 100;

    // 严格计算TypeScript分数
    score -= totalErrors * threshold.errorWeight;
    score = Math.max(0, score);

    return {
      status: passed && score >= 70 ? 'PASSED' : 'FAILED',
      errors: totalErrors,
      warnings,
      score,
      issues: errors.slice(0, 10),
      analyzedAt: new Date().toISOString(),
      suggestion: score < 100 ? `Fix ${totalErrors} TypeScript errors` : 'TypeScript checks passed'
    };
  }

  checkTestCoverage() {
    console.log(colors.blue('🧪 Running test coverage analysis...'));

    const result = this.runCommand('pnpm run test:coverage', { silent: true, allowFailure: true });

    if (!result.success) {
      // 如果覆盖率失败，尝试运行普通测试
      const testResult = this.runCommand('pnpm test', { silent: true, allowFailure: true });

      const isToolError = result.error && (
        result.error.includes('ENOENT') ||
        result.error.includes('command not found') ||
        result.error.includes('Cannot find module')
      );

      return {
        status: isToolError ? 'ERROR' : (testResult.success ? 'WARNING' : 'FAILED'),
        coverageAvailable: false,
        testsPassed: testResult.success,
        score: isToolError ? 25 : (testResult.success ? 60 : 0),
        error: isToolError ? result.error : (testResult.success ? 'Coverage not available' : testResult.error),
        errorType: isToolError ? 'TOOL_ERROR' : (testResult.success ? 'COVERAGE_UNAVAILABLE' : 'TESTS_FAILED'),
        suggestion: isToolError
          ? 'Install test dependencies: pnpm install'
          : (testResult.success ? 'Configure coverage reporting' : 'Fix failing tests')
      };
    }

    // 解析覆盖率报告
    const coverageSummaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    let coverage = {};

    if (fs.existsSync(coverageSummaryPath)) {
      try {
        coverage = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
      } catch (error) {
        console.warn(colors.yellow('⚠️  Could not parse coverage summary'));
        return {
          status: 'WARNING',
          coverageAvailable: false,
          testsPassed: true,
          score: 50,
          error: 'Could not parse coverage summary',
          errorType: 'PARSE_ERROR',
          suggestion: 'Check coverage report format'
        };
      }
    }

    const threshold = this.thresholds.testCoverage;
    const lines = coverage.lines?.pct || 0;
    const statements = coverage.statements?.pct || 0;
    const branches = coverage.branches?.pct || 0;
    const functions = coverage.functions?.pct || 0;

    let passed = lines >= threshold.minLines &&
                 statements >= threshold.minStatements &&
                 branches >= threshold.minBranches &&
                 functions >= threshold.minFunctions;

    // 计算覆盖率分数
    const score = Math.round((lines + statements + branches + functions) / 4);

    return {
      status: passed ? 'PASSED' : 'FAILED',
      coverageAvailable: true,
      testsPassed: true,
      coverage: {
        lines,
        statements,
        branches,
        functions
      },
      score,
      threshold,
      analyzedAt: new Date().toISOString(),
      suggestion: score < 100 ? `Improve coverage: Lines ${lines}%, Statements ${statements}%, Branches ${branches}%, Functions ${functions}%` : 'Test coverage is excellent'
    };
  }

  checkBuild() {
    console.log(colors.blue('🏗️  Running build validation...'));

    const startTime = Date.now();
    const result = this.runCommand('pnpm run build', { silent: true, allowFailure: true });
    const buildTime = Date.now() - startTime;

    if (!result.success) {
      const isToolError = result.error && (
        result.error.includes('ENOENT') ||
        result.error.includes('command not found') ||
        result.error.includes('Cannot find module')
      );

      return {
        status: isToolError ? 'ERROR' : 'FAILED',
        buildSuccess: false,
        buildTime,
        buildSize: 0,
        score: isToolError ? 20 : 0,
        error: result.error,
        errorType: isToolError ? 'TOOL_ERROR' : 'BUILD_ERROR',
        suggestion: isToolError
          ? 'Install build dependencies: pnpm install'
          : 'Fix build errors and try again'
      };
    }

    // 计算构建产物大小
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

    const buildSizeMB = Math.round(buildSize / (1024 * 1024));
    const threshold = this.thresholds.build;
    let passed = buildSizeMB <= threshold.maxSizeMB && buildTime <= threshold.maxTimeSeconds * 1000;

    // 计算构建分数
    let score = 100;
    if (buildSizeMB > threshold.maxSizeMB) {
      score -= Math.min(30, (buildSizeMB - threshold.maxSizeMB) * 2);
    }
    if (buildTime > threshold.maxTimeSeconds * 1000) {
      score -= Math.min(20, (buildTime - threshold.maxTimeSeconds * 1000) / 1000);
    }
    score = Math.max(0, score);

    return {
      status: passed ? 'PASSED' : 'FAILED',
      buildSuccess: true,
      buildTime,
      buildSize,
      buildSizeMB,
      score,
      threshold,
      analyzedAt: new Date().toISOString(),
      suggestion: score < 100 ? `Optimize build: Size ${buildSizeMB}MB, Time ${Math.round(buildTime / 1000)}s` : 'Build is optimized'
    };
  }

  checkDependencies() {
    console.log(colors.blue('📦 Analyzing dependencies...'));

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});

      // 检查过时依赖
      const outdatedCheck = this.runCommand('pnpm outdated --json', { silent: true, allowFailure: true });
      const outdated = outdatedCheck.success ? Object.keys(JSON.parse(outdatedCheck.output)).length : 0;

      const threshold = this.thresholds.dependencies;
      let passed = outdated <= threshold.maxOutdated;

      // 计算依赖分数
      let score = 100;
      if (outdated > threshold.maxOutdated) {
        score -= Math.min(30, (outdated - threshold.maxOutdated) * 4);
      }

      return {
        status: passed ? 'PASSED' : 'WARNING',
        total: dependencies.length + devDependencies.length,
        production: dependencies.length,
        development: devDependencies.length,
        outdated,
        score,
        threshold,
        analyzedAt: new Date().toISOString(),
        suggestion: score < 100 ? `Update ${outdated} outdated dependencies` : 'Dependencies are up to date'
      };
    } catch (error) {
      return {
        status: 'ERROR',
        score: 0,
        error: error.message,
        errorType: 'PARSE_ERROR',
        suggestion: 'Check package.json format and dependencies'
      };
    }
  }

  calculateOverallScore(results) {
    const weights = {
      eslint: 0.20,
      security: 0.25,
      typescript: 0.20,  // 新增TypeScript检查
      testCoverage: 0.20,
      build: 0.10,
      dependencies: 0.05
    };

    let totalScore = 0;
    let totalWeight = 0;
    let criticalFailures = [];
    let toolErrors = [];
    let codeIssues = [];

    // 分类不同类型的问题
    for (const [check, result] of Object.entries(results)) {
      const weight = weights[check];
      if (!weight || result.score === undefined) continue;

      // 严格的质量门禁逻辑
      if (result.status === 'ERROR') {
        if (result.errorType === 'TOOL_ERROR') {
          toolErrors.push(check);
          totalScore += result.score * weight;
        } else {
          criticalFailures.push(check);
          totalScore += 0; // 严重错误给0分
        }
        totalWeight += weight;
      } else if (result.status === 'FAILED') {
        codeIssues.push(check);
        totalScore += result.score * weight;
        totalWeight += weight;
      } else if (result.status === 'WARNING') {
        totalScore += result.score * weight;
        totalWeight += weight;
      } else {
        // PASSED
        totalScore += result.score * weight;
        totalWeight += weight;
      }
    }

    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    // 计算等级，更严格的评分标准
    let grade;
    if (overallScore >= 95) grade = 'A+';
    else if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 85) grade = 'A-';
    else if (overallScore >= 80) grade = 'B+';
    else if (overallScore >= 75) grade = 'B';
    else if (overallScore >= 70) grade = 'B-';
    else if (overallScore >= 60) grade = 'C+';
    else if (overallScore >= 50) grade = 'C';
    else grade = 'F';

    // 生成详细建议
    let recommendation = this.getRecommendation(overallScore);

    if (toolErrors.length > 0) {
      recommendation += ` Fix tool errors: ${toolErrors.join(', ')}.`;
    }

    if (codeIssues.length > 0) {
      recommendation += ` Address code issues: ${codeIssues.join(', ')}.`;
    }

    if (criticalFailures.length > 0) {
      recommendation += ` CRITICAL: Fix ${criticalFailures.join(', ')} immediately.`;
    }

    return {
      overallScore,
      grade,
      criticalFailures,
      toolErrors,
      codeIssues,
      recommendation,
      summary: {
        totalChecks: Object.keys(results).length,
        passed: Object.values(results).filter(r => r.status === 'PASSED').length,
        warnings: Object.values(results).filter(r => r.status === 'WARNING').length,
        failed: Object.values(results).filter(r => r.status === 'FAILED').length,
        errors: Object.values(results).filter(r => r.status === 'ERROR').length,
        toolErrors: toolErrors.length,
        codeIssues: codeIssues.length
      }
    };
  }

  getRecommendation(score) {
    if (score >= 95) return 'Excellent quality! Ready for production.';
    if (score >= 85) return 'Very good quality. Minor improvements recommended.';
    if (score >= 80) return 'Good quality. Some improvements needed.';
    if (score >= 75) return 'Acceptable quality. Several improvements needed.';
    if (score >= 70) return 'Quality needs significant improvement before production.';
    if (score >= 60) return 'Poor quality. Major improvements required.';
    return 'Very poor quality. Critical improvements required.';
  }

  generateReport(results, analysis) {
    const timestamp = new Date().toISOString();

    const report = {
      timestamp,
      repository: this.getRepoInfo(),
      thresholds: this.thresholds,
      results,
      analysis,
      summary: analysis.summary
    };

    // 保存报告
    const reportPath = path.join(this.reportsDir, `quality-gate-${timestamp.split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
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

  displayResults(results, analysis) {
    console.log('\n🎯 Enhanced Quality Gates Report');
    console.log('='.repeat(60));

    // 总体评分
    const { overallScore, grade, criticalFailures, toolErrors, codeIssues, recommendation, summary } = analysis;

    console.log(`\n📊 Overall Score: ${overallScore}/100 (${grade})`);
    console.log(`💡 Recommendation: ${recommendation}`);

    // 显示不同类型的问题统计
    if (criticalFailures.length > 0) {
      console.log(`\n🚨 Critical Failures: ${criticalFailures.join(', ')}`);
    }
    if (toolErrors.length > 0) {
      console.log(`\n🔧 Tool Errors: ${toolErrors.join(', ')}`);
    }
    if (codeIssues.length > 0) {
      console.log(`\n⚠️  Code Issues: ${codeIssues.join(', ')}`);
    }

    // 详细结果
    console.log('\n📋 Detailed Results:');
    console.log('-'.repeat(60));

    const checkNames = {
      eslint: '🔍 ESLint Analysis',
      security: '🔒 Security Audit',
      typescript: '📝 TypeScript Check',
      testCoverage: '🧪 Test Coverage',
      build: '🏗️  Build Validation',
      dependencies: '📦 Dependencies Check'
    };

    for (const [check, result] of Object.entries(results)) {
      const name = checkNames[check] || check;

      console.log(`\n${name}: ${result.status}`);

      if (result.errorType) {
        console.log(`  Error Type: ${result.errorType}`);
      }

      if (result.score !== undefined) {
        console.log(`  Score: ${result.score}/100`);
      }

      // 显示关键指标
      if (result.errors !== undefined) console.log(`  Errors: ${result.errors}`);
      if (result.warnings !== undefined) console.log(`  Warnings: ${result.warnings}`);
      if (result.critical !== undefined) console.log(`  Critical Vulnerabilities: ${result.critical}`);
      if (result.high !== undefined) console.log(`  High Vulnerabilities: ${result.high}`);
      if (result.buildSizeMB !== undefined) console.log(`  Build Size: ${result.buildSizeMB}MB`);
      if (result.buildTime !== undefined) console.log(`  Build Time: ${Math.round(result.buildTime / 1000)}s`);
      if (result.outdated !== undefined) console.log(`  Outdated Dependencies: ${result.outdated}`);

      if (result.suggestion) {
        console.log(`  💡 Suggestion: ${result.suggestion}`);
      }

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    // 显示总结统计
    console.log('\n📈 Summary Statistics:');
    console.log(`  Total Checks: ${summary.totalChecks}`);
    console.log(`  Passed: ${summary.passed} ✅`);
    console.log(`  Warnings: ${summary.warnings} ⚠️`);
    console.log(`  Failed: ${summary.failed} ❌`);
    console.log(`  Errors: ${summary.errors} 🚨`);
    if (summary.toolErrors > 0) {
      console.log(`  Tool Errors: ${summary.toolErrors} 🔧`);
    }
    if (summary.codeIssues > 0) {
      console.log(`  Code Issues: ${summary.codeIssues} ⚠️`);
    }

    console.log('\n' + '='.repeat(60));
  }

  async runQualityGates(options = {}) {
    const {
      mode = 'full', // 'full', 'pre-commit', 'pre-push', 'ci'
      verbose = true,
      generateReport = true,
      allowPartialFailure = false
    } = options;

    if (verbose) {
      console.log(`🚀 Starting Enhanced Quality Gates v3 (${mode} mode)...\n`);
    }

    const results = {};

    // 根据模式选择要运行的检查
    const checks = this.getChecksForMode(mode);

    for (const [name, checkFn] of checks) {
      if (verbose) {
        console.log(colors.blue(`Running ${name} check...`));
      }

      try {
        results[name] = await checkFn();
      } catch (error) {
        if (verbose) {
          console.error(colors.red(`❌ ${name} check failed: ${error.message}`));
        }
        results[name] = {
          status: 'ERROR',
          score: 0,
          error: error.message,
          errorType: 'EXECUTION_ERROR',
          suggestion: `Check ${name} configuration and dependencies`
        };
      }
    }

    // 分析结果
    const analysis = this.calculateOverallScore(results);

    // 生成报告
    let reportPath = null;
    if (generateReport) {
      const { report, reportPath: path } = this.generateReport(results, analysis);
      reportPath = path;
    }

    // 显示结果
    if (verbose) {
      this.displayResults(results, analysis);
      if (reportPath) {
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
      }
    } else {
      // 简化输出用于CI/CD
      console.log(`Quality Score: ${analysis.overallScore}/100 (${analysis.grade})`);
      console.log(`Status: ${analysis.criticalFailures.length > 0 || analysis.overallScore < 70 ? 'FAILED' : 'PASSED'}`);
    }

    // 根据结果决定退出码
    const hasCriticalFailures = analysis.criticalFailures.length > 0;
    const hasToolErrors = analysis.toolErrors.length > 0;
    const hasCodeIssues = analysis.codeIssues.length > 0;
    const scoreTooLow = analysis.overallScore < 70;

    // 严格的阻塞逻辑
    const shouldBlock = hasCriticalFailures ||
                       scoreTooLow ||
                       (!allowPartialFailure && (hasToolErrors || hasCodeIssues));

    if (shouldBlock) {
      if (verbose) {
        console.log('\n❌ Quality gates failed! Please address the issues above.');
        if (hasCriticalFailures) {
          console.log('🚨 Critical failures detected - pipeline blocked.');
        }
        if (scoreTooLow) {
          console.log(`📊 Score too low (${analysis.overallScore}/100) - improvement required.`);
        }
        if (hasToolErrors) {
          console.log('🔧 Tool configuration issues detected.');
        }
        if (hasCodeIssues) {
          console.log('⚠️  Code quality issues detected.');
        }
      }
      process.exit(1);
    }

    if (verbose) {
      console.log('\n✅ Quality gates passed! Code is ready for production.');
      if (hasToolErrors) {
        console.log('🔧 Note: Some tool errors were detected but did not block the pipeline.');
      }
      if (hasCodeIssues) {
        console.log('⚠️  Note: Some code issues were detected but are within acceptable limits.');
      }
    }
  }

  getChecksForMode(mode) {
    const allChecks = [
      ['eslint', () => this.checkESLint()],
      ['security', () => this.checkSecurity()],
      ['typescript', () => this.checkTypeScript()], // 新增TypeScript检查
      ['testCoverage', () => this.checkTestCoverage()],
      ['build', () => this.checkBuild()],
      ['dependencies', () => this.checkDependencies()]
    ];

    switch (mode) {
      case 'pre-commit':
        return [
          ['eslint', () => this.checkESLint()],
          ['typescript', () => this.checkTypeScript()]
        ];

      case 'pre-push':
        return [
          ['eslint', () => this.checkESLint()],
          ['typescript', () => this.checkTypeScript()],
          ['testCoverage', () => this.checkTestCoverage()],
          ['build', () => this.checkBuild()]
        ];

      case 'ci':
        return allChecks;

      case 'full':
      default:
        return allChecks;
    }
  }
}

// 命令行接口
async function main() {
  const system = new EnhancedQualityGateSystem();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Enhanced Quality Gates System - Fixed Version v3

Usage: node scripts/enhanced-quality-gates-v3.js [options]

Options:
  --help, -h           Show this help message
  --thresholds         Display current thresholds
  --report-only        Generate report without console output
  --ci-mode            CI/CD mode with minimal output
  --pre-commit         Pre-commit mode (quick checks only)
  --pre-push           Pre-push mode (critical checks)
  --allow-partial-failure  Allow partial failures without blocking
  --mode <mode>        Specify mode: full, pre-commit, pre-push, ci

Features:
  - Enhanced TypeScript checking
  - Improved error classification
  - Better score calculation
  - Detailed issue reporting
  - Flexible threshold management

Examples:
  node scripts/enhanced-quality-gates-v3.js                    # Full checks
  node scripts/enhanced-quality-gates-v3.js --pre-commit       # Quick pre-commit checks
  node scripts/enhanced-quality-gates-v3.js --pre-push         # Pre-push validation
  node scripts/enhanced-quality-gates-v3.js --ci-mode          # CI/CD mode
  node scripts/enhanced-quality-gates-v3.js --allow-partial-failure  # Allow partial failures
  node scripts/enhanced-quality-gates-v3.js --mode ci         # Explicit CI mode
`);
    process.exit(0);
  }

  if (args.includes('--thresholds')) {
    console.log('Current Quality Gates Thresholds:');
    console.log(JSON.stringify(system.thresholds, null, 2));
    process.exit(0);
  }

  // 确定运行模式
  let mode = 'full';
  let verbose = true;
  let generateReport = true;
  let allowPartialFailure = false;

  if (args.includes('--pre-commit')) {
    mode = 'pre-commit';
  } else if (args.includes('--pre-push')) {
    mode = 'pre-push';
  } else if (args.includes('--ci-mode')) {
    mode = 'ci';
    verbose = false;
  }

  // 检查显式模式设置
  const modeIndex = args.indexOf('--mode');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    mode = args[modeIndex + 1];
    if (mode === 'ci') {
      verbose = false;
    }
  }

  // 检查部分失败允许标志
  if (args.includes('--allow-partial-failure')) {
    allowPartialFailure = true;
  }

  const reportOnly = args.includes('--report-only');
  if (reportOnly) {
    verbose = false;
  }

  try {
    await system.runQualityGates({
      mode,
      verbose,
      generateReport,
      allowPartialFailure
    });
  } catch (error) {
    if (verbose) {
      console.error(`❌ Quality gates system error: ${error.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = EnhancedQualityGateSystem;