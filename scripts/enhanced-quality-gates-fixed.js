#!/usr/bin/env node

/**
 * 增强质量门禁系统
 * 集成多项质量检查，提供智能阈值管理和趋势分析
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple color replacement - no chaining for simplicity
const colors = {
  red: (text) => text,
  green: (text) => text,
  yellow: (text) => text,
  blue: (text) => text,
  magenta: (text) => text,
  bold: (text) => text
};

class QualityGateSystem {
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
        maxWarnings: 10,
        errorWeight: 10,
        warningWeight: 2
      },
      security: {
        maxCritical: 0,
        maxHigh: 0,
        maxModerate: 5,
        criticalWeight: 50,
        highWeight: 20,
        moderateWeight: 5
      },
      testCoverage: {
        minCoverage: 80,
        minStatements: 80,
        minBranches: 70,
        minFunctions: 80,
        minLines: 80
      },
      build: {
        maxSizeMB: 50,
        maxTimeSeconds: 120
      },
      dependencies: {
        maxOutdated: 10,
        maxHighVulns: 0,
        requireLicenseCheck: true
      },
      performance: {
        maxBundleSizeKB: 500,
        maxLoadTimeMs: 3000
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
    const { silent = false, timeout = 60000, allowFailure = false } = options;

    const startTime = Date.now();
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit',
        timeout
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

    // For pre-commit mode, check only staged files to be more efficient
    const checkStaged = process.argv.includes('--pre-commit');
    let command = 'pnpm run lint --format=json';

    if (checkStaged) {
      // Get staged files and run ESLint only on them
      try {
        const stagedFiles = this.runCommand('git diff --cached --name-only --diff-filter=ACM', { silent: true });
        if (stagedFiles.success && stagedFiles.output.trim()) {
          const tsFiles = stagedFiles.output.split('\n')
            .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
            .filter(file => !file.includes('node_modules') && !file.includes('dist'))
            .join(' ');

          if (tsFiles.trim()) {
            // Make paths relative to project root for ESLint
            const relativeFiles = tsFiles.split(' ').map(file => {
              if (file.startsWith('backend/')) return file;
              if (file.startsWith('frontend/')) return file;
              if (file.startsWith('shared-types/')) return file;
              return file;
            }).join(' ');

            command = `npx eslint ${relativeFiles} --format=json`;
          } else {
            // No TypeScript files staged, skip ESLint
            return {
              status: 'PASSED',
              errors: 0,
              warnings: 0,
              score: 100,
              totalIssues: 0,
              analyzedAt: new Date().toISOString()
            };
          }
        } else {
          // No staged files
          return {
            status: 'PASSED',
            errors: 0,
            warnings: 0,
            score: 100,
            totalIssues: 0,
            analyzedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        // If git command fails, fall back to full lint
        command = 'pnpm run lint --format=json';
      }
    }

    const result = this.runCommand(command, { silent: true, allowFailure: true });

    if (!result.success) {
      return {
        status: 'FAILED',
        errors: 0,
        warnings: 0,
        score: 50, // 工具错误给部分分数
        issues: [],
        error: result.error
      };
    }

    try {
      const eslintReport = JSON.parse(result.output);
      const issues = eslintReport || [];

      const errors = issues.filter(issue => issue.severity === 2).length;
      const warnings = issues.filter(issue => issue.severity === 1).length;

      const threshold = this.thresholds.eslint;
      let passed = errors <= threshold.maxErrors && warnings <= threshold.maxWarnings;

      // 计算质量分数
      let score = 100;
      score -= errors * threshold.errorWeight;
      score -= warnings * threshold.warningWeight;
      score = Math.max(0, score);

      return {
        status: passed ? 'PASSED' : 'FAILED',
        errors,
        warnings,
        score,
        totalIssues: issues.length,
        threshold,
        issues: issues.slice(0, 20), // 保存前20个问题作为样本
        analyzedAt: new Date().toISOString()
      };
    } catch (parseError) {
      return {
        status: 'ERROR',
        errors: 0,
        warnings: 0,
        score: 50, // 工具错误给部分分数
        issues: [],
        error: 'Failed to parse ESLint output'
      };
    }
  }

  checkSecurity() {
    console.log(colors.blue('🔒 Running security audit...'));

    const result = this.runCommand('pnpm audit --json', { silent: true, allowFailure: true });

    if (!result.success) {
      return {
        status: 'ERROR',
        vulnerabilities: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        score: 50, // 工具错误给部分分数
        error: result.error
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

      // 计算安全分数
      let score = 100;
      score -= critical * threshold.criticalWeight;
      score -= high * threshold.highWeight;
      score -= moderate * threshold.moderateWeight;
      score = Math.max(0, score);

      return {
        status: passed ? 'PASSED' : 'FAILED',
        total,
        critical,
        high,
        moderate,
        low,
        score,
        threshold,
        analyzedAt: new Date().toISOString()
      };
    } catch (parseError) {
      return {
        status: 'ERROR',
        vulnerabilities: 0,
        score: 50, // 工具错误给部分分数
        error: 'Failed to parse audit results'
      };
    }
  }

  checkTestCoverage() {
    console.log(colors.blue('🧪 Running test coverage analysis...'));

    const result = this.runCommand('pnpm run test:coverage', { silent: true, allowFailure: true });

    if (!result.success) {
      // 如果覆盖率失败，尝试运行普通测试
      const testResult = this.runCommand('pnpm test', { silent: true, allowFailure: true });
      return {
        status: testResult.success ? 'WARNING' : 'FAILED',
        coverageAvailable: false,
        testsPassed: testResult.success,
        score: testResult.success ? 70 : 0,
        error: testResult.success ? 'Coverage not available' : testResult.error
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
      analyzedAt: new Date().toISOString()
    };
  }

  checkBuild() {
    console.log(colors.blue('🏗️  Running build validation...'));

    const startTime = Date.now();
    const result = this.runCommand('pnpm run build', { silent: true, allowFailure: true });
    const buildTime = Date.now() - startTime;

    if (!result.success) {
      return {
        status: 'FAILED',
        buildSuccess: false,
        buildTime,
        buildSize: 0,
        score: 50, // 工具错误给部分分数
        error: result.error
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
      analyzedAt: new Date().toISOString()
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

      // 检查安全漏洞（已在checkSecurity中处理）
      const threshold = this.thresholds.dependencies;
      let passed = outdated <= threshold.maxOutdated;

      // 计算依赖分数
      let score = 100;
      if (outdated > threshold.maxOutdated) {
        score -= Math.min(25, (outdated - threshold.maxOutdated) * 3);
      }

      return {
        status: passed ? 'PASSED' : 'WARNING',
        total: dependencies.length + devDependencies.length,
        production: dependencies.length,
        development: devDependencies.length,
        outdated,
        score,
        threshold,
        analyzedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        score: 50, // 工具错误给部分分数
        error: error.message
      };
    }
  }

  calculateOverallScore(results) {
    const weights = {
      eslint: 0.25,
      security: 0.30,
      testCoverage: 0.25,
      build: 0.15,
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

      // 根据错误类型分类
      if (result.status === "ERROR") {
        if (result.errorType === "TOOL_ERROR") {
          toolErrors.push(check);
        } else {
          criticalFailures.push(check);
        }
        // 工具错误给部分分数，其他错误根据情况给分
        totalScore += result.score * weight;
        totalWeight += weight;
      } else if (result.status === "FAILED") {
        codeIssues.push(check);
        totalScore += result.score * weight;
        totalWeight += weight;
      } else {
        // PASSED 或 WARNING
        totalScore += result.score * weight;
        totalWeight += weight;
      }
    }

    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    // 计算等级，考虑错误类型的影响
    let grade;
    if (overallScore >= 90) grade = "A+";
    else if (overallScore >= 85) grade = "A";
    else if (overallScore >= 80) grade = "B+";
    else if (overallScore >= 75) grade = "B";
    else if (overallScore >= 70) grade = "C+";
    else if (overallScore >= 65) grade = "C";
    else if (overallScore >= 60) grade = "D";
    else grade = "F";

    // 生成详细建议
    let recommendation = this.getRecommendation(overallScore, results);
    
    // 如果有工具错误，添加工具修复建议
    if (toolErrors.length > 0) {
      recommendation += ` Fix tool errors: ${toolErrors.join(", ")}.`;
    }
    
    // 如果有代码问题，添加代码修复建议
    if (codeIssues.length > 0) {
      recommendation += ` Address code issues: ${codeIssues.join(", ")}.`;
    }
    
    // 如果有严重错误，添加紧急修复建议
    if (criticalFailures.length > 0) {
      recommendation += ` CRITICAL: Fix ${criticalFailures.join(", ")} immediately.`;
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
        passed: Object.values(results).filter(r => r.status === "PASSED").length,
        warnings: Object.values(results).filter(r => r.status === "WARNING").length,
        failed: Object.values(results).filter(r => r.status === "FAILED").length,
        errors: Object.values(results).filter(r => r.status === "ERROR").length,
        toolErrors: toolErrors.length,
        codeIssues: codeIssues.length
      }
    };
  }


  generateReport(results, analysis) {
    const timestamp = new Date().toISOString();

    const report = {
      timestamp,
      repository: this.getRepoInfo(),
      thresholds: this.thresholds,
      results,
      analysis,
      summary: {
        totalChecks: Object.keys(results).length,
        passed: Object.values(results).filter(r => r.status === 'PASSED').length,
        warnings: Object.values(results).filter(r => r.status === 'WARNING').length,
        failed: Object.values(results).filter(r => r.status === 'FAILED').length,
        errors: Object.values(results).filter(r => r.status === 'ERROR').length
      }
    };

    // 保存报告
    const reportPath = path.join(this.reportsDir, `quality-gate-${timestamp.split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
  }
  displayResults(results, analysis) {
    console.log("\n🎯 Quality Gates Report");
    console.log("=" .repeat(60));

    // 总体评分
    const { overallScore, grade, criticalFailures, toolErrors, codeIssues, recommendation, summary } = analysis;
    const gradeColor = grade.includes("A") ? colors.green :
                       grade.includes("B") ? colors.blue :
                       grade.includes("C") ? colors.yellow : colors.red;

    console.log(`\n📊 Overall Score: ${overallScore}/100 (${grade})`);
    console.log(`💡 Recommendation: ${recommendation}`);

    // 显示不同类型的问题统计
    if (criticalFailures.length > 0) {
      console.log(`\n🚨 Critical Failures: ${criticalFailures.join(", ")}`);
    }
    if (toolErrors.length > 0) {
      console.log(`\n🔧 Tool Errors: ${toolErrors.join(", ")}`);
    }
    if (codeIssues.length > 0) {
      console.log(`\n⚠️  Code Issues: ${codeIssues.join(", ")}`);
    }

    // 详细结果
    console.log("\n📋 Detailed Results:");
    console.log("-".repeat(60));

    const checkNames = {
      eslint: "🔍 ESLint Analysis",
      security: "🔒 Security Audit",
      testCoverage: "🧪 Test Coverage",
      build: "🏗️  Build Validation",
      dependencies: "📦 Dependencies Check"
    };

    for (const [check, result] of Object.entries(results)) {
      const name = checkNames[check] || check;
      const statusColor = result.status === "PASSED" ? colors.green :
                         result.status === "WARNING" ? colors.yellow :
                         result.status === "FAILED" ? colors.red : colors.magenta;

      console.log(`\n${name}: ${result.status}`);

      if (result.errorType) {
        console.log(`  Error Type: ${result.errorType}`);
      }

      if (result.score !== undefined) {
        const scoreColor = result.score >= 80 ? colors.green :
                          result.score >= 60 ? colors.yellow : colors.red;
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
    console.log("\n📈 Summary Statistics:");
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

    console.log("\n" + "=" .repeat(60));
  }
  async runQualityGates(options = {}) {
    const {
      mode = "full", // "full", "pre-commit", "pre-push", "ci"
      verbose = true,
      generateReport = true,
      allowPartialFailure = false // 新增：允许部分失败
    } = options;

    if (verbose) {
      console.log(`🚀 Starting Enhanced Quality Gates (${mode} mode)...\n`);
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
          status: "ERROR",
          score: 0,
          error: error.message,
          errorType: "EXECUTION_ERROR",
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
      console.log(`Status: ${analysis.criticalFailures.length > 0 ? "FAILED" : "PASSED"}`);
    }

    // 根据结果决定退出码
    const hasCriticalFailures = analysis.criticalFailures.length > 0;
    const hasToolErrors = analysis.toolErrors.length > 0;
    const hasCodeIssues = analysis.codeIssues.length > 0;

    // 只有严重错误才阻止继续，工具错误和代码问题可以根据配置决定
    const shouldBlock = hasCriticalFailures || 
                       (!allowPartialFailure && (hasToolErrors || hasCodeIssues));

    if (shouldBlock) {
      if (verbose) {
        console.log("\n❌ Quality gates failed! Please address the issues above.");
        if (hasToolErrors) {
          console.log("🔧 Tool configuration issues detected.");
        }
        if (hasCodeIssues) {
          console.log("⚠️  Code quality issues detected.");
        }
      }
      process.exit(1);
    }

    if (verbose) {
      console.log("\n✅ Quality gates passed! Code is ready for production.");
      if (hasToolErrors) {
        console.log("🔧 Note: Some tool errors were detected but did not block the pipeline.");
      }
      if (hasCodeIssues) {
        console.log("⚠️  Note: Some code issues were detected but are within acceptable limits.");
      }
    }
  }
  --pre-push           Pre-push mode (critical checks)
  --mode <mode>        Specify mode: full, pre-commit, pre-push, ci

Examples:
  node scripts/enhanced-quality-gates.js                    # Full checks
  node scripts/enhanced-quality-gates.js --pre-commit       # Quick pre-commit checks
  node scripts/enhanced-quality-gates.js --pre-push         # Pre-push validation
  node scripts/enhanced-quality-gates.js --ci-mode          # CI/CD mode
  node scripts/enhanced-quality-gates.js --mode ci         # Explicit CI mode
`);
    process.exit(0);
  }

  if (args.includes('--thresholds')) {
    console.log('Current Quality Gates Thresholds:');
    console.log(JSON.stringify(system.thresholds, null, 2));
    process.exit(0);
  }

  // 确定运行模式
  let mode = "full";
  let verbose = true;
  let generateReport = true;
  let allowPartialFailure = false;

  if (args.includes("--pre-commit")) {
    mode = "pre-commit";
  } else if (args.includes("--pre-push")) {
    mode = "pre-push";
  } else if (args.includes("--ci-mode")) {
    mode = "ci";
    verbose = false;
  }

  // 检查显式模式设置
  const modeIndex = args.indexOf("--mode");
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    mode = args[modeIndex + 1];
    if (mode === "ci") {
      verbose = false;
    }
  }

  // 检查部分失败允许标志
  if (args.includes("--allow-partial-failure")) {
    allowPartialFailure = true;
  }

  const reportOnly = args.includes("--report-only");
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

module.exports = QualityGateSystem;