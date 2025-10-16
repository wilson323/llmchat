#!/usr/bin/env node

/**
 * TypeScript 严格质量门禁系统
 *
 * 零容忍TypeScript错误政策 - 任何类型错误都会阻止合并
 * 支持多环境配置和详细报告生成
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TypeScriptQualityGates {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = path.join(this.projectRoot, 'reports', 'typescript');
    this.strictConfig = this.loadStrictConfig();
    this.ensureReportsDir();
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  loadStrictConfig() {
    return {
      // 零容忍配置
      zeroTolerance: {
        maxErrors: 0,
        maxWarnings: 0,
        allowAny: false,
        allowImplicitAny: false,
        requireStrict: true
      },

      // 严格检查选项
      strictOptions: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        noImplicitReturns: true,
        noImplicitThis: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true
      },

      // 检查范围
      checkPaths: [
        { name: 'shared-types', path: 'shared-types', required: true },
        { name: 'backend', path: 'backend', required: true },
        { name: 'frontend', path: 'frontend', required: true }
      ]
    };
  }

  runCommand(command, options = {}) {
    const {
      silent = false,
      timeout = 120000,
      allowFailure = false,
      cwd = this.projectRoot
    } = options;

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit',
        timeout,
        cwd
      });

      return {
        success: true,
        output: result,
        executionTime: new Date().toISOString()
      };
    } catch (error) {
      if (allowFailure) {
        return {
          success: false,
          output: error.stdout || '',
          error: error.message,
          executionTime: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  createStrictTsconfig basePath {
    const strictConfig = {
      extends: './tsconfig.json',
      compilerOptions: this.strictConfig.strictOptions
    };

    const configPath = path.join(basePath, 'tsconfig.quality-gates.json');
    fs.writeFileSync(configPath, JSON.stringify(strictConfig, null, 2));
    return configPath;
  }

  checkTypeScriptProject(projectInfo) {
    const { name, path: projectPath, required } = projectInfo;
    console.log(`🔍 检查 ${name} TypeScript...`);

    const fullPath = path.join(this.projectRoot, projectPath);

    // 检查项目路径是否存在
    if (!fs.existsSync(fullPath)) {
      const message = `❌ ${name} 项目路径不存在: ${projectPath}`;
      console.log(message);

      if (required) {
        throw new Error(message);
      }

      return {
        status: 'SKIPPED',
        reason: 'Project path not found',
        score: 0
      };
    }

    const results = {
      name,
      path: projectPath,
      checks: {}
    };

    try {
      // 1. 基础类型检查
      console.log(`  📋 执行基础类型检查...`);
      const basicCheck = this.runCommand('pnpm run type-check', {
        cwd: fullPath,
        silent: true,
        allowFailure: true
      });

      results.checks.basic = {
        status: basicCheck.success ? 'PASSED' : 'FAILED',
        output: basicCheck.output,
        error: basicCheck.error
      };

      // 2. 严格模式检查
      console.log(`  🔒 执行严格模式检查...`);
      const strictConfigPath = this.createStrictTsconfig(fullPath);

      const strictCheck = this.runCommand(`npx tsc --noEmit --project ${path.basename(strictConfigPath)}`, {
        cwd: fullPath,
        silent: true,
        allowFailure: true
      });

      results.checks.strict = {
        status: strictCheck.success ? 'PASSED' : 'FAILED',
        output: strictCheck.output,
        error: strictCheck.error,
        configPath: strictConfigPath
      };

      // 3. 分析错误
      const errorAnalysis = this.analyzeTypeScriptErrors(strictCheck);
      results.errorAnalysis = errorAnalysis;

      // 4. 计算质量分数
      results.score = this.calculateQualityScore(results);
      results.status = this.determineOverallStatus(results);

      console.log(`  ✅ ${name} 检查完成 - 状态: ${results.status}, 分数: ${results.score}/100`);

    } catch (error) {
      console.log(`  ❌ ${name} 检查失败: ${error.message}`);
      results.status = 'ERROR';
      results.error = error.message;
      results.score = 0;
    }

    return results;
  }

  analyzeTypeScriptErrors(checkResult) {
    if (checkResult.success) {
      return {
        totalErrors: 0,
        totalWarnings: 0,
        errorTypes: {},
        severity: 'NONE'
      };
    }

    const output = checkResult.error || checkResult.output || '';
    const lines = output.split('\n');

    const errorTypes = {
      'noImplicitAny': 0,
      'strictNullChecks': 0,
      'strictFunctionTypes': 0,
      'noImplicitReturns': 0,
      'noUnusedLocals': 0,
      'noUnusedParameters': 0,
      'exactOptionalPropertyTypes': 0,
      'noUncheckedIndexedAccess': 0,
      'propertyAccess': 0,
      'module': 0,
      'syntax': 0,
      'other': 0
    };

    let totalErrors = 0;
    let totalWarnings = 0;

    lines.forEach(line => {
      // 分析TypeScript错误类型
      if (line.includes('error TS')) {
        totalErrors++;

        if (line.includes('TS7020') || line.includes('Implicit any')) {
          errorTypes.noImplicitAny++;
        } else if (line.includes('TS2531') || line.includes('Object is possibly')) {
          errorTypes.strictNullChecks++;
        } else if (line.includes('TS2345') || line.includes('not assignable')) {
          errorTypes.strictFunctionTypes++;
        } else if (line.includes('TS7030') || line.includes('implicitly has return type')) {
          errorTypes.noImplicitReturns++;
        } else if (line.includes('TS6133') || line.includes('is declared but never used')) {
          if (line.includes('parameter')) {
            errorTypes.noUnusedParameters++;
          } else {
            errorTypes.noUnusedLocals++;
          }
        } else if (line.includes('TS2375') || line.includes('contains') && line.includes('undefined')) {
          errorTypes.exactOptionalPropertyTypes++;
        } else if (line.includes('TS7053') || line.includes('implicitly has type')) {
          errorTypes.noUncheckedIndexedAccess++;
        } else if (line.includes('TS2339') || line.includes('does not exist')) {
          errorTypes.propertyAccess++;
        } else if (line.includes('TS2307') || line.includes('Cannot find module')) {
          errorTypes.module++;
        } else if (line.includes('TS100') || line.includes('TS10')) {
          errorTypes.syntax++;
        } else {
          errorTypes.other++;
        }
      } else if (line.includes('warning TS')) {
        totalWarnings++;
      }
    });

    // 确定严重性
    let severity = 'LOW';
    if (totalErrors > 0) {
      if (totalErrors > 10 || errorTypes.noImplicitAny > 0) {
        severity = 'HIGH';
      } else if (totalErrors > 5) {
        severity = 'MEDIUM';
      }
    }

    return {
      totalErrors,
      totalWarnings,
      errorTypes,
      severity,
      criticalErrors: errorTypes.noImplicitAny + errorTypes.strictNullChecks + errorTypes.syntax
    };
  }

  calculateQualityScore(results) {
    const { checks, errorAnalysis } = results;
    let score = 100;

    // 基础检查权重 40%
    if (checks.basic?.status === 'FAILED') {
      score -= 40;
    }

    // 严格检查权重 60%
    if (checks.strict?.status === 'FAILED') {
      score -= 60;

      // 根据错误类型额外扣分
      const { totalErrors, criticalErrors } = errorAnalysis;

      // 关键错误额外扣分
      score -= criticalErrors * 10;

      // 其他错误扣分
      score -= Math.min(totalErrors * 2, 30);
    }

    return Math.max(0, score);
  }

  determineOverallStatus(results) {
    const { checks, errorAnalysis } = results;

    // 如果基础检查失败，直接失败
    if (checks.basic?.status === 'FAILED') {
      return 'FAILED';
    }

    // 如果严格检查失败，根据错误类型决定
    if (checks.strict?.status === 'FAILED') {
      // 零容忍政策 - 任何错误都导致失败
      if (errorAnalysis.totalErrors > 0) {
        return 'FAILED';
      }
    }

    return 'PASSED';
  }

  generateReport(projectResults) {
    const timestamp = new Date().toISOString();

    const report = {
      timestamp,
      projectRoot: this.projectRoot,
      configuration: this.strictConfig,
      results: projectResults,
      summary: {
        totalProjects: projectResults.length,
        passedProjects: projectResults.filter(r => r.status === 'PASSED').length,
        failedProjects: projectResults.filter(r => r.status === 'FAILED').length,
        skippedProjects: projectResults.filter(r => r.status === 'SKIPPED').length,
        errorProjects: projectResults.filter(r => r.status === 'ERROR').length
      }
    };

    // 计算总体分数
    const totalScore = projectResults.reduce((sum, result) => sum + (result.score || 0), 0);
    report.summary.overallScore = projectResults.length > 0 ? Math.round(totalScore / projectResults.length) : 0;

    // 确定总体状态
    report.summary.overallStatus = projectResults.some(r => r.status === 'FAILED' || r.status === 'ERROR') ? 'FAILED' : 'PASSED';

    // 保存详细报告
    const reportPath = path.join(this.reportsDir, `typescript-quality-report-${timestamp.split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 生成简化报告
    const summaryPath = path.join(this.reportsDir, 'typescript-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      timestamp: report.timestamp,
      status: report.summary.overallStatus,
      score: report.summary.overallScore,
      summary: report.summary
    }, null, 2));

    return { report, reportPath, summaryPath };
  }

  displayResults(projectResults) {
    console.log('\n🎯 TypeScript 质量门禁报告');
    console.log('=' .repeat(60));

    const { summary } = this.generateReport(projectResults);

    console.log(`\n📊 总体状态: ${summary.overallStatus}`);
    console.log(`📈 总体分数: ${summary.overallScore}/100`);
    console.log(`📁 项目统计: ${summary.passedProjects}/${summary.totalProjects} 通过`);

    console.log('\n📋 详细结果:');
    console.log('-'.repeat(60));

    projectResults.forEach(result => {
      const statusIcon = result.status === 'PASSED' ? '✅' :
                        result.status === 'FAILED' ? '❌' :
                        result.status === 'SKIPPED' ? '⏭️' : '🚨';

      console.log(`\n${statusIcon} ${result.name}: ${result.status} (${result.score || 0}/100)`);

      if (result.errorAnalysis) {
        const { totalErrors, totalWarnings, severity } = result.errorAnalysis;
        if (totalErrors > 0 || totalWarnings > 0) {
          console.log(`  错误: ${totalErrors}, 警告: ${totalWarnings}, 严重性: ${severity}`);
        }
      }

      if (result.error) {
        console.log(`  错误: ${result.error}`);
      }
    });

    console.log('\n' + '=' .repeat(60));
  }

  async runQualityGates(options = {}) {
    const {
      mode = 'full', // 'full', 'basic', 'strict'
      verbose = true,
      generateReport = true,
      exitOnFailure = true
    } = options;

    if (verbose) {
      console.log('🚀 启动 TypeScript 严格质量门禁检查');
      console.log(`📅 检查时间: ${new Date().toLocaleString()}`);
      console.log(`🔧 检查模式: ${mode}`);
      console.log('');
    }

    const results = [];

    // 检查所有项目
    for (const projectInfo of this.strictConfig.checkPaths) {
      try {
        const result = this.checkTypeScriptProject(projectInfo);
        results.push(result);
      } catch (error) {
        console.error(`❌ 检查 ${projectInfo.name} 时发生错误: ${error.message}`);
        results.push({
          ...projectInfo,
          status: 'ERROR',
          error: error.message,
          score: 0
        });
      }
    }

    // 生成报告
    let reportPaths = null;
    if (generateReport) {
      const { reportPath, summaryPath } = this.generateReport(results);
      reportPaths = { reportPath, summaryPath };
    }

    // 显示结果
    if (verbose) {
      this.displayResults(results);

      if (reportPaths) {
        console.log(`\n📄 详细报告: ${reportPaths.reportPath}`);
        console.log(`📋 摘要报告: ${reportPaths.summaryPath}`);
      }
    }

    // 检查是否有关键失败
    const hasFailures = results.some(r => r.status === 'FAILED' || r.status === 'ERROR');

    if (hasFailures && exitOnFailure) {
      console.log('\n❌ TypeScript 质量门禁失败！');
      console.log('🔧 零容忍政策: 所有类型错误必须修复才能合并');
      process.exit(1);
    }

    if (!hasFailures && verbose) {
      console.log('\n✅ TypeScript 质量门禁全部通过！');
    }

    return {
      results,
      reportPaths,
      success: !hasFailures
    };
  }
}

// 命令行接口
async function main() {
  const gates = new TypeScriptQualityGates();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TypeScript 严格质量门禁系统

Usage: node scripts/typescript-quality-gates.js [options]

Options:
  --help, -h              显示帮助信息
  --mode <mode>           检查模式: full, basic, strict (默认: full)
  --no-report             不生成报告文件
  --no-exit               失败时不退出进程
  --basic-only            仅执行基础检查
  --strict-only           仅执行严格模式检查

Examples:
  node scripts/typescript-quality-gates.js              # 完整检查
  node scripts/typescript-quality-gates.js --mode basic # 基础检查
  node scripts/typescript-quality-gates.js --strict-only # 仅严格检查
`);
    process.exit(0);
  }

  // 解析选项
  const mode = args.includes('--mode') ?
    args[args.indexOf('--mode') + 1] || 'full' : 'full';

  const verbose = !args.includes('--quiet');
  const generateReport = !args.includes('--no-report');
  const exitOnFailure = !args.includes('--no-exit');

  // 特殊模式
  let options = { mode, verbose, generateReport, exitOnFailure };

  if (args.includes('--basic-only')) {
    options.mode = 'basic';
  }

  if (args.includes('--strict-only')) {
    options.mode = 'strict';
  }

  try {
    await gates.runQualityGates(options);
  } catch (error) {
    console.error(`❌ TypeScript 质量门禁系统错误: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TypeScriptQualityGates;