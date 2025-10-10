#!/usr/bin/env node

/**
 * 本地质量门禁检查脚本
 * 在提交前验证代码质量标准
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class QualityGateChecker {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = path.join(this.projectRoot, 'reports');
    this.config = this.loadQualityConfig();
  }

  /**
   * 加载质量配置
   */
  loadQualityConfig() {
    const configPath = path.join(this.projectRoot, 'config/quality-gates.json');

    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // 默认配置
    return {
      thresholds: {
        maxErrorsPerFile: 5,
        maxWarningsPerFile: 20,
        maxTotalErrors: 100,
        maxTotalWarnings: 500,
        maxComplexity: 15,
        minTestCoverage: 80
      },
      rules: {
        requireTestCoverage: true,
        requireBuildSuccess: true,
        requireTypeCheck: true,
        blockOnCritical: true,
        blockOnSecurity: true
      },
      excludePaths: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        '.git',
        '*.test.ts',
        '*.test.tsx',
        '*.spec.ts',
        '*.spec.tsx'
      ]
    };
  }

  /**
   * 运行ESLint检查
   */
  async runESLintCheck(module) {
    console.log(chalk.blue(`🔍 Running ESLint check for ${module}...`));

    const modulePath = path.join(this.projectRoot, module);
    if (!fs.existsSync(modulePath)) {
      console.log(chalk.yellow(`⚠️  Module ${module} not found, skipping...`));
      return { errors: 0, warnings: 0, files: [] };
    }

    try {
      const cmd = `cd ${module} && npx eslint src --format=json`;
      const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });

      const report = JSON.parse(result);
      const analysis = this.analyzeESLintReport(report);

      console.log(chalk.green(`✅ ${module}: ${analysis.errors} errors, ${analysis.warnings} warnings`));
      return analysis;
    } catch (error) {
      // ESLint返回非0退出码时仍然尝试解析输出
      try {
        const report = JSON.parse(error.stdout || '[]');
        const analysis = this.analyzeESLintReport(report);
        console.log(chalk.yellow(`⚠️  ${module}: ${analysis.errors} errors, ${analysis.warnings} warnings`));
        return analysis;
      } catch (parseError) {
        console.log(chalk.red(`❌ ${module}: ESLint check failed`));
        return { errors: 0, warnings: 0, files: [] };
      }
    }
  }

  /**
   * 分析ESLint报告
   */
  analyzeESLintReport(report) {
    let totalErrors = 0;
    let totalWarnings = 0;
    const files = [];

    for (const result of report) {
      const filePath = result.filePath;
      let fileErrors = 0;
      let fileWarnings = 0;

      for (const message of result.messages) {
        if (message.severity === 2) {
          fileErrors++;
        } else {
          fileWarnings++;
        }
      }

      totalErrors += fileErrors;
      totalWarnings += fileWarnings;

      files.push({
        path: filePath,
        errors: fileErrors,
        warnings: fileWarnings
      });
    }

    return {
      errors: totalErrors,
      warnings: totalWarnings,
      files
    };
  }

  /**
   * 检查代码复杂度
   */
  async checkComplexity() {
    console.log(chalk.blue('🔍 Checking code complexity...'));

    try {
      const complexityReport = await this.generateComplexityReport();
      const violations = this.analyzeComplexityViolations(complexityReport);

      console.log(chalk.green(`✅ Complexity check: ${violations.length} violations`));
      return violations;
    } catch (error) {
      console.log(chalk.red('❌ Complexity check failed'));
      return [];
    }
  }

  /**
   * 生成复杂度报告
   */
  async generateComplexityReport() {
    const cmd = 'npx eslint . --rule "complexity: [\'error\', { max: 10 }]" --format=json';
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return JSON.parse(result);
  }

  /**
   * 分析复杂度违规
   */
  analyzeComplexityViolations(report) {
    const violations = [];

    for (const result of report) {
      for (const message of result.messages) {
        if (message.ruleId === 'complexity') {
          violations.push({
            file: result.filePath,
            line: message.line,
            message: message.message
          });
        }
      }
    }

    return violations;
  }

  /**
   * 检查测试覆盖率
   */
  async checkTestCoverage() {
    if (!this.config.rules.requireTestCoverage) {
      console.log(chalk.yellow('⚠️  Test coverage check disabled'));
      return { coverage: 100, passed: true };
    }

    console.log(chalk.blue('🔍 Checking test coverage...'));

    try {
      // 运行测试并生成覆盖率报告
      execSync('pnpm test --coverage', { stdio: 'pipe' });

      // 读取覆盖率报告
      const coveragePath = path.join(this.projectRoot, 'coverage/coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        const totalCoverage = coverage.total.statements.pct;

        const passed = totalCoverage >= this.config.thresholds.minTestCoverage;

        console.log(chalk[passed ? 'green' : 'yellow'](
          `${passed ? '✅' : '⚠️'} Coverage: ${totalCoverage}% (required: ${this.config.thresholds.minTestCoverage}%)`
        ));

        return { coverage: totalCoverage, passed };
      } else {
        console.log(chalk.yellow('⚠️  Coverage report not found'));
        return { coverage: 0, passed: false };
      }
    } catch (error) {
      console.log(chalk.red('❌ Test coverage check failed'));
      return { coverage: 0, passed: false };
    }
  }

  /**
   * 检查构建成功
   */
  async checkBuildSuccess() {
    if (!this.config.rules.requireBuildSuccess) {
      console.log(chalk.yellow('⚠️  Build check disabled'));
      return { passed: true };
    }

    console.log(chalk.blue('🔍 Checking build success...'));

    try {
      // 检查后端构建
      execSync('pnpm run backend:build', { stdio: 'pipe' });
      console.log(chalk.green('✅ Backend build successful'));

      // 检查前端构建
      execSync('pnpm run frontend:build', { stdio: 'pipe' });
      console.log(chalk.green('✅ Frontend build successful'));

      return { passed: true };
    } catch (error) {
      console.log(chalk.red('❌ Build failed'));
      return { passed: false };
    }
  }

  /**
   * 检查TypeScript类型
   */
  async checkTypeScript() {
    if (!this.config.rules.requireTypeCheck) {
      console.log(chalk.yellow('⚠️  TypeScript check disabled'));
      return { passed: true };
    }

    console.log(chalk.blue('🔍 Checking TypeScript types...'));

    try {
      execSync('pnpm run type-check', { stdio: 'pipe' });
      console.log(chalk.green('✅ TypeScript check passed'));
      return { passed: true };
    } catch (error) {
      console.log(chalk.red('❌ TypeScript check failed'));
      return { passed: false };
    }
  }

  /**
   * 检查安全问题
   */
  async checkSecurityIssues() {
    if (!this.config.rules.blockOnSecurity) {
      console.log(chalk.yellow('⚠️  Security check disabled'));
      return { issues: 0, passed: true };
    }

    console.log(chalk.blue('🔍 Checking security issues...'));

    try {
      // 检查npm审计
      const auditResult = execSync('pnpm audit --json', { encoding: 'utf8', stdio: 'pipe' });
      const audit = JSON.parse(auditResult);

      const highVulns = audit.vulnerabilities ?
        Object.values(audit.vulnerabilities).filter(v => v.severity === 'high').length : 0;

      if (highVulns > 0) {
        console.log(chalk.red(`❌ Found ${highVulns} high-severity vulnerabilities`));
        return { issues: highVulns, passed: false };
      }

      // 检查ESLint安全规则
      const securityRules = ['no-eval', 'no-implied-eval', 'no-new-func', 'no-script-url'];
      let securityIssues = 0;

      for (const rule of securityRules) {
        try {
          execSync(`npx eslint . --rule "${rule}: error" --format=json`, { stdio: 'pipe' });
        } catch (error) {
          securityIssues++;
        }
      }

      if (securityIssues > 0) {
        console.log(chalk.yellow(`⚠️  Found ${securityIssues} ESLint security issues`));
        return { issues: securityIssues, passed: false };
      }

      console.log(chalk.green('✅ Security check passed'));
      return { issues: 0, passed: true };
    } catch (error) {
      console.log(chalk.red('❌ Security check failed'));
      return { issues: 1, passed: false };
    }
  }

  /**
   * 生成质量报告
   */
  generateQualityReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: results.backend.errors + results.frontend.errors,
        totalWarnings: results.backend.warnings + results.frontend.warnings,
        qualityGatePassed: results.qualityGatePassed
      },
      backend: results.backend,
      frontend: results.frontend,
      complexity: results.complexity,
      testCoverage: results.testCoverage,
      buildSuccess: results.buildSuccess,
      typeScript: results.typeScript,
      security: results.security,
      thresholds: this.config.thresholds
    };

    // 确保报告目录存在
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // 保存报告
    const reportPath = path.join(this.reportsDir, `quality-gate-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 也保存最新的报告
    const latestPath = path.join(this.reportsDir, 'latest-quality-gate.json');
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
  }

  /**
   * 显示质量摘要
   */
  displayQualitySummary(results) {
    console.log(chalk.blue('\n📊 Quality Gate Summary'));
    console.log('='.repeat(50));

    // ESLint结果
    console.log(chalk.yellow('\n🔧 ESLint Issues:'));
    console.log(`Backend: ${results.backend.errors} errors, ${results.backend.warnings} warnings`);
    console.log(`Frontend: ${results.frontend.errors} errors, ${results.frontend.warnings} warnings`);
    console.log(`Total: ${results.backend.errors + results.frontend.errors} errors, ${results.backend.warnings + results.frontend.warnings} warnings`);

    // 阈值对比
    const totalErrors = results.backend.errors + results.frontend.errors;
    const totalWarnings = results.backend.warnings + results.frontend.warnings;

    console.log(chalk.yellow('\n📏 Thresholds:'));
    console.log(`Errors: ${totalErrors}/${this.config.thresholds.maxTotalErrors}`);
    console.log(`Warnings: ${totalWarnings}/${this.config.thresholds.maxTotalWarnings}`);

    // 其他检查结果
    console.log(chalk.yellow('\n🔍 Other Checks:'));
    console.log(`Complexity: ${results.complexity.length} violations`);
    console.log(`Test Coverage: ${results.testCoverage.coverage}%`);
    console.log(`Build Success: ${results.buildSuccess.passed ? '✅' : '❌'}`);
    console.log(`TypeScript: ${results.typeScript.passed ? '✅' : '❌'}`);
    console.log(`Security: ${results.security.passed ? '✅' : '❌'}`);

    // 最终结果
    console.log(chalk.blue('\n🎯 Quality Gate Result:'));
    if (results.qualityGatePassed) {
      console.log(chalk.green.bold('✅ PASSED - Code meets quality standards'));
    } else {
      console.log(chalk.red.bold('❌ FAILED - Code does not meet quality standards'));
    }
  }

  /**
   * 主检查函数
   */
  async run() {
    console.log(chalk.blue('🚀 Starting Quality Gate Check'));

    const results = {
      backend: await this.runESLintCheck('backend'),
      frontend: await this.runESLintCheck('frontend'),
      complexity: await this.checkComplexity(),
      testCoverage: await this.checkTestCoverage(),
      buildSuccess: await this.checkBuildSuccess(),
      typeScript: await this.checkTypeScript(),
      security: await this.checkSecurityIssues()
    };

    // 评估质量门禁
    const totalErrors = results.backend.errors + results.frontend.errors;
    const totalWarnings = results.backend.warnings + results.frontend.warnings;

    results.qualityGatePassed = (
      totalErrors <= this.config.thresholds.maxTotalErrors &&
      totalWarnings <= this.config.thresholds.maxTotalWarnings &&
      results.complexity.length <= 10 && // 允许少量复杂度违规
      results.testCoverage.passed &&
      results.buildSuccess.passed &&
      results.typeScript.passed &&
      results.security.passed
    );

    // 生成报告
    const { report, reportPath } = this.generateQualityReport(results);

    // 显示摘要
    this.displayQualitySummary(results);

    console.log(chalk.blue(`\n📄 Detailed report saved to: ${reportPath}`));

    return results;
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const options = {
    silent: args.includes('--silent'),
    outputFormat: args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'console'
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue('Quality Gate Checker'));
    console.log('');
    console.log('Usage:');
    console.log('  node quality-gate-check.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --silent       Suppress console output');
    console.log('  --format=<fmt> Output format (console|json)');
    console.log('  --help, -h     Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node quality-gate-check.js');
    console.log('  node quality-gate-check.js --format=json');
    console.log('  node quality-gate-check.js --silent');
    process.exit(0);
  }

  const checker = new QualityGateChecker();
  const results = await checker.run();

  if (options.outputFormat === 'json') {
    console.log(JSON.stringify(results, null, 2));
  }

  // 根据结果设置退出码
  process.exit(results.qualityGatePassed ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = QualityGateChecker;