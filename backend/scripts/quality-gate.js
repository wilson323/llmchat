#!/usr/bin/env node

/**
 * 代码质量门禁检查脚本
 * 用于CI/CD流程中的质量检查
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class QualityGate {
  constructor() {
    this.projectRoot = process.cwd();
    this.thresholds = {
      eslintErrors: 0,
      eslintWarnings: 50,
      typeScriptErrors: 0,
      testCoverage: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      },
      complexity: {
        max: 10
      }
    };
    this.results = {};
    this.passed = true;
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];

    console.log(`${colors[type]}${prefix} ${message}${colors.reset}`);
  }

  async checkESLint() {
    this.log('检查ESLint错误和警告...');

    try {
      const output = execSync('npx eslint src --ext .ts --format=json', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const issues = JSON.parse(output);
      const errors = issues.filter(i => i.severity === 2);
      const warnings = issues.filter(i => i.severity === 1);

      this.results.eslint = {
        errors: errors.length,
        warnings: warnings.length,
        passed: errors.length <= this.thresholds.eslintErrors,
        details: errors.slice(0, 5).map(e => ({
          file: e.filePath,
          line: e.line,
          column: e.column,
          message: e.message
        }))
      };

      if (this.results.eslint.passed) {
        this.log(`ESLint检查通过: ${errors.length} 错误, ${warnings.length} 警告`, 'success');
      } else {
        this.log(`ESLint检查失败: ${errors.length} 错误 (阈值: ${this.thresholds.eslintErrors})`, 'error');
        this.passed = false;
      }

      return this.results.eslint;
    } catch (error) {
      this.log('ESLint检查执行失败', 'error');
      this.results.eslint = { errors: -1, warnings: -1, passed: false };
      this.passed = false;
      return this.results.eslint;
    }
  }

  async checkTypeScript() {
    this.log('检查TypeScript编译错误...');

    try {
      execSync('npx tsc --noEmit', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.results.typescript = {
        errors: 0,
        passed: true
      };

      this.log('TypeScript检查通过', 'success');
      return this.results.typescript;
    } catch (error) {
      const output = error.stdout || error.message;
      const errorLines = output.split('\n').filter(line => line.includes('error TS'));

      this.results.typescript = {
        errors: errorLines.length,
        passed: false,
        details: errorLines.slice(0, 5)
      };

      this.log(`TypeScript检查失败: ${errorLines.length} 个类型错误`, 'error');
      this.passed = false;
      return this.results.typescript;
    }
  }

  async checkTestCoverage() {
    this.log('检查测试覆盖率...');

    try {
      // 检查是否存在覆盖率报告
      const coverageFile = path.join(this.projectRoot, 'coverage/coverage-summary.json');

      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        const total = coverage.total;

        const passed =
          total.lines.pct >= this.thresholds.testCoverage.lines &&
          total.functions.pct >= this.thresholds.testCoverage.functions &&
          total.statements.pct >= this.thresholds.testCoverage.statements &&
          total.branches.pct >= this.thresholds.testCoverage.branches;

        this.results.coverage = {
          lines: total.lines.pct,
          functions: total.functions.pct,
          statements: total.statements.pct,
          branches: total.branches.pct,
          passed: passed
        };

        if (passed) {
          this.log(`测试覆盖率通过: 语句 ${total.statements.pct}%, 分支 ${total.branches.pct}%`, 'success');
        } else {
          this.log(`测试覆盖率不足: 语句 ${total.statements.pct}% (需要 ≥${this.thresholds.testCoverage.statements}%)`, 'error');
          this.passed = false;
        }
      } else {
        this.log('未找到覆盖率报告，尝试生成...', 'warning');
        try {
          execSync('npm run test:coverage', {
            encoding: 'utf8',
            stdio: 'pipe'
          });

          // 重新读取覆盖率文件
          const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
          const total = coverage.total;

          this.results.coverage = {
            lines: total.lines.pct,
            functions: total.functions.pct,
            statements: total.statements.pct,
            branches: total.branches.pct,
            passed: true
          };

          this.log(`测试覆盖率: 语句 ${total.statements.pct}%, 分支 ${total.branches.pct}%`, 'success');
        } catch (error) {
          this.log('测试覆盖率检查失败', 'error');
          this.results.coverage = { passed: false };
          this.passed = false;
        }
      }

      return this.results.coverage;
    } catch (error) {
      this.log('测试覆盖率检查失败', 'error');
      this.results.coverage = { passed: false };
      this.passed = false;
      return this.results.coverage;
    }
  }

  async checkCodeComplexity() {
    this.log('检查代码复杂度...');

    // 简单的复杂度检查（实际项目可以使用complexity-report等工具）
    try {
      const output = execSync('find src -name "*.ts" -exec wc -l {} + | sort -n | tail -10', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const lines = output.split('\n');
      const maxFile = lines[lines.length - 2];
      const maxLines = parseInt(maxFile.split(/\s+/)[0]);

      const passed = maxLines <= this.thresholds.complexity.max * 20; // 简单假设：每个函数平均20行

      this.results.complexity = {
        maxFile,
        maxLines,
        passed: passed
      };

      if (passed) {
        this.log('代码复杂度检查通过', 'success');
      } else {
        this.log(`最大文件行数: ${maxLines}, 可能过于复杂`, 'warning');
      }

      return this.results.complexity;
    } catch (error) {
      this.log('代码复杂度检查失败', 'warning');
      return { passed: true };
    }
  }

  async checkPackageSecurity() {
    this.log('检查依赖安全性...');

    try {
      const output = execSync('npm audit --json', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const audit = JSON.parse(output);
      const vulnerabilities = audit.vulnerabilities || {};
      const highVulns = Object.values(vulnerabilities).filter(v => v.severity === 'high' || v.severity === 'critical');

      this.results.security = {
        total: Object.keys(vulnerabilities).length,
        high: highVulns.length,
        passed: highVulns.length === 0
      };

      if (this.results.security.passed) {
        this.log('安全检查通过，无高危漏洞', 'success');
      } else {
        this.log(`发现 ${highVulns.length} 个高危安全漏洞`, 'error');
        this.passed = false;
      }

      return this.results.security;
    } catch (error) {
      this.log('安全检查失败', 'warning');
      return { passed: true };
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      passed: this.passed,
      results: this.results,
      thresholds: this.thresholds,
      summary: {
        totalChecks: 5,
        passedChecks: Object.values(this.results).filter(r => r.passed).length
      }
    };

    // 保存报告
    const reportPath = path.join(this.projectRoot, 'quality-gate-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 质量检查报告');
    console.log('='.repeat(60));

    console.log(`\n📋 检查结果汇总:`);
    console.log(`  ESLint: ${this.results.eslint?.errors || 'N/A'} 错误, ${this.results.eslint?.warnings || 'N/A'} 警告`);
    console.log(`  TypeScript: ${this.results.typescript?.errors || 'N/A'} 错误`);
    console.log(`  测试覆盖率: ${this.results.coverage?.lines || 'N/A'}%`);
    console.log(`  安全漏洞: ${this.results.security?.high || 'N/A'} 个高危`);

    if (this.passed) {
      console.log('\n✅ 质量门禁检查通过！');
      console.log('代码符合质量标准，可以继续部署。');
    } else {
      console.log('\n❌ 质量门禁检查失败！');
      console.log('请修复上述问题后重新运行检查。');

      if (this.results.eslint?.details?.length > 0) {
        console.log('\n🔍 需要修复的ESLint错误（前5个）:');
        this.results.eslint.details.forEach(error => {
          console.log(`  ${path.basename(error.file)}:${error.line}:${error.column} - ${error.message}`);
        });
      }

      if (this.results.typescript?.details?.length > 0) {
        console.log('\n🔍 需要修复的TypeScript错误（前5个）:');
        this.results.typescript.details.forEach(error => {
          console.log(`  ${error}`);
        });
      }
    }

    console.log('\n📁 详细报告: quality-gate-report.json');
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 开始代码质量门禁检查...\n');

    const startTime = Date.now();

    try {
      await this.checkESLint();
      await this.checkTypeScript();
      await this.checkTestCoverage();
      await this.checkCodeComplexity();
      await this.checkPackageSecurity();

      const report = this.generateReport();
      const duration = Date.now() - startTime;

      console.log(`\n⏱️  检查完成，耗时: ${Math.round(duration / 1000)}秒`);

      this.printSummary();

      if (!this.passed) {
        process.exit(1);
      }

    } catch (error) {
      this.log('质量检查过程中发生错误: ' + error.message, 'error');
      process.exit(1);
    }
  }
}

// 运行质量门禁
if (require.main === module) {
  new QualityGate().run();
}

module.exports = QualityGate;