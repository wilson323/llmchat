#!/usr/bin/env node

/**
 * CI/CD质量门禁脚本
 * 专用于GitHub Actions等CI/CD环境
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class QualityGatesCI {
  constructor() {
    this.results = {
      typescript: { passed: false, score: 0, error: null },
      eslint: { passed: false, score: 0, errors: 0, warnings: 0 },
      tests: { passed: false, score: 0, coverage: {} },
      security: { passed: false, score: 0, vulnerabilities: 0 },
      build: { passed: false, score: 0 }
    };

    this.thresholds = {
      overall: { minScore: 70 },
      typescript: { required: true },
      eslint: { maxErrors: 0, maxWarnings: 10 },
      tests: { minCoverage: 30 },
      security: { maxVulnerabilities: 5 },
      build: { required: true }
    };
  }

  async runCommand(command, description, options = {}) {
    const { allowFailure = false, timeout = 120000 } = options;

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout
      });

      return { success: true, output: result };
    } catch (error) {
      if (allowFailure) {
        return {
          success: false,
          error: error.message,
          output: error.stdout || ''
        };
      }
      throw error;
    }
  }

  async checkTypeScript() {
    console.log('📝 TypeScript类型检查...');

    try {
      await this.runCommand('pnpm run type-check', 'TypeScript检查');
      this.results.typescript = {
        passed: true,
        score: 25,
        error: null
      };
      console.log('✅ TypeScript检查通过');
    } catch (error) {
      this.results.typescript = {
        passed: false,
        score: 0,
        error: error.message
      };
      console.log('❌ TypeScript检查失败');
    }
  }

  async checkESLint() {
    console.log('🔍 ESLint代码质量检查...');

    try {
      const result = await this.runCommand(
        'pnpm run lint --format=json',
        'ESLint检查',
        { allowFailure: true }
      );

      let errors = 0;
      let warnings = 0;

      if (result.success && result.output.trim()) {
        try {
          const reports = JSON.parse(result.output);
          if (Array.isArray(reports)) {
            reports.forEach(report => {
              if (report.messages) {
                report.messages.forEach(msg => {
                  if (msg.severity === 2) errors++;
                  else warnings++;
                });
              }
            });
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      const passed = errors <= this.thresholds.eslint.maxErrors &&
                     warnings <= this.thresholds.eslint.maxWarnings;

      let score = 20;
      if (!passed) {
        score = Math.max(0, 20 - errors * 5 - warnings);
      }

      this.results.eslint = {
        passed,
        score,
        errors,
        warnings
      };

      if (passed) {
        console.log('✅ ESLint检查通过');
      } else {
        console.log(`⚠️ ESLint发现问题: ${errors}错误, ${warnings}警告`);
      }
    } catch (error) {
      this.results.eslint = {
        passed: false,
        score: 0,
        errors: 1,
        warnings: 0
      };
      console.log('❌ ESLint检查失败');
    }
  }

  async checkTests() {
    console.log('🧪 测试套件检查...');

    try {
      const testResult = await this.runCommand(
        'pnpm test',
        '运行测试',
        { allowFailure: true, timeout: 300000 }
      );

      let coverage = {};
      let coverageScore = 0;

      // 检查覆盖率报告
      const coverageFiles = [
        'backend/coverage/coverage-summary.json',
        'frontend/coverage/coverage-summary.json'
      ];

      for (const coverageFile of coverageFiles) {
        if (fs.existsSync(coverageFile)) {
          try {
            const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
            if (coverageData.total) {
              coverage[coverageFile.includes('backend') ? 'backend' : 'frontend'] = {
                lines: coverageData.total.lines.pct,
                functions: coverageData.total.functions.pct,
                branches: coverageData.total.branches.pct,
                statements: coverageData.total.statements.pct
              };
            }
          } catch (e) {
            // 忽略读取错误
          }
        }
      }

      // 计算覆盖率分数
      if (Object.keys(coverage).length > 0) {
        const allLines = Object.values(coverage).map(c => c.lines);
        const avgLines = allLines.reduce((a, b) => a + b, 0) / allLines.length;

        if (avgLines >= this.thresholds.tests.minCoverage) {
          coverageScore = 25;
        } else {
          coverageScore = Math.max(0, 25 * (avgLines / this.thresholds.tests.minCoverage));
        }

        console.log(`📊 平均测试覆盖率: ${avgLines.toFixed(1)}%`);
      } else {
        coverageScore = testResult.success ? 15 : 0;
      }

      const passed = testResult.success;

      this.results.tests = {
        passed,
        score: testResult.success ? 25 : 0,
        coverageScore,
        coverage
      };

      if (passed) {
        console.log('✅ 测试通过');
      } else {
        console.log('❌ 测试失败');
      }
    } catch (error) {
      this.results.tests = {
        passed: false,
        score: 0,
        coverageScore: 0,
        coverage: {}
      };
      console.log('❌ 测试检查失败');
    }
  }

  async checkSecurity() {
    console.log('🔒 安全漏洞检查...');

    try {
      const auditResult = await this.runCommand(
        'pnpm audit --json',
        '安全审计',
        { allowFailure: true, timeout: 60000 }
      );

      let vulnerabilities = 0;
      let highVulns = 0;
      let moderateVulns = 0;

      if (auditResult.success) {
        try {
          const auditData = JSON.parse(auditResult.output);
          if (auditData.vulnerabilities) {
            vulnerabilities = Object.keys(auditData.vulnerabilities).length;

            Object.values(auditData.vulnerabilities).forEach(vuln => {
              if (vuln.severity === 'high' || vuln.severity === 'critical') {
                highVulns++;
              } else if (vuln.severity === 'moderate') {
                moderateVulns++;
              }
            });
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      const passed = highVulns === 0 &&
                    moderateVulns <= this.thresholds.security.maxVulnerabilities;

      let score = 20;
      if (!passed) {
        score = Math.max(0, 20 - highVulns * 10 - moderateVulns * 2);
      }

      this.results.security = {
        passed,
        score,
        vulnerabilities,
        summary: { high: highVulns, moderate: moderateVulns }
      };

      if (passed) {
        console.log('✅ 安全检查通过');
      } else {
        console.log(`⚠️ 发现安全问题: ${highVulns}高危, ${moderateVulns}中危`);
      }
    } catch (error) {
      this.results.security = {
        passed: false,
        score: 0,
        vulnerabilities: -1
      };
      console.log('❌ 安全检查失败');
    }
  }

  async checkBuild() {
    console.log('🔨 构建检查...');

    try {
      await this.runCommand('pnpm run build', '项目构建', { timeout: 300000 });

      this.results.build = {
        passed: true,
        score: 10
      };
      console.log('✅ 构建成功');
    } catch (error) {
      this.results.build = {
        passed: false,
        score: 0
      };
      console.log('❌ 构建失败');
    }
  }

  calculateOverallScore() {
    const totalScore = Object.values(this.results).reduce((sum, result) => sum + result.score, 0);
    const maxScore = 100;

    return {
      score: totalScore,
      maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      grade: this.getGrade(totalScore)
    };
  }

  getGrade(score) {
    if (score >= 90) return 'A 优秀';
    if (score >= 80) return 'B 良好';
    if (score >= 70) return 'C 合格';
    if (score >= 60) return 'D 需要改进';
    return 'F 不合格';
  }

  generateReport() {
    const overall = this.calculateOverallScore();

    const report = {
      timestamp: new Date().toISOString(),
      mode: 'CI',
      overall,
      thresholds: this.thresholds,
      results: this.results,
      passed: overall.score >= this.thresholds.overall.minScore
    };

    return report;
  }

  printReport() {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(60));
    console.log('🛡️ CI/CD 质量门禁报告');
    console.log('='.repeat(60));

    console.log(`\n📊 总体评分: ${report.overall.score}/${report.overall.maxScore} (${report.overall.percentage}%) - ${report.overall.grade}`);
    console.log(`⏰ 时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);

    console.log('\n📋 详细结果:');

    const statusIcons = {
      true: '✅',
      false: '❌'
    };

    console.log(`\n📝 TypeScript检查: ${statusIcons[this.results.typescript.passed]} (${this.results.typescript.score}/25分)`);
    console.log(`🔍 ESLint检查: ${statusIcons[this.results.eslint.passed]} (${this.results.eslint.score}/20分)`);
    if (this.results.eslint.errors > 0 || this.results.eslint.warnings > 0) {
      console.log(`   - 错误: ${this.results.eslint.errors}, 警告: ${this.results.eslint.warnings}`);
    }

    console.log(`🧪 测试检查: ${statusIcons[this.results.tests.passed]} (${this.results.tests.score + this.results.tests.coverageScore}/45分)`);
    if (Object.keys(this.results.tests.coverage).length > 0) {
      Object.entries(this.results.tests.coverage).forEach(([name, coverage]) => {
        console.log(`   - ${name}: 行覆盖率 ${coverage.lines.toFixed(1)}%`);
      });
    }

    console.log(`🔒 安全检查: ${statusIcons[this.results.security.passed]} (${this.results.security.score}/20分)`);
    if (this.results.security.summary) {
      console.log(`   - 高危漏洞: ${this.results.security.summary.high}, 中危漏洞: ${this.results.security.summary.moderate}`);
    }

    console.log(`🔨 构建检查: ${statusIcons[this.results.build.passed]} (${this.results.build.score}/10分)`);

    console.log('\n' + '='.repeat(60));
    if (report.passed) {
      console.log('✅ 质量门禁通过 - 可以继续部署');
    } else {
      console.log('❌ 质量门禁未通过 - 请修复问题后重试');
    }
    console.log('='.repeat(60));

    return report;
  }

  async saveReport() {
    const report = this.generateReport();
    const reportDir = 'quality-reports';

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(reportDir, `quality-gates-ci-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // 保存最新报告
    const latestFile = path.join(reportDir, 'latest-ci.json');
    fs.writeFileSync(latestFile, JSON.stringify(report, null, 2));

    console.log(`质量报告已保存: ${reportFile}`);
    return reportFile;
  }

  async run() {
    console.log('🚀 启动CI/CD质量门禁检查...\n');

    const startTime = Date.now();

    try {
      // 按顺序执行检查
      await this.checkTypeScript();
      await this.checkESLint();
      await this.checkTests();
      await this.checkSecurity();
      await this.checkBuild();

      const duration = Date.now() - startTime;

      const report = this.printReport();
      await this.saveReport();

      console.log(`质量门禁检查完成，耗时: ${duration}ms`);

      // CI模式输出
      console.log(`::set-output name=quality-score::${report.overall.score}`);
      console.log(`::set-output name=quality-status::${report.passed ? 'passed' : 'failed'}`);
      console.log(`::set-output name=quality-grade::${report.overall.grade}`);

      if (this.results.tests.coverageScore > 0) {
        console.log(`::set-output name=coverage-score::${this.results.tests.coverageScore}`);
      }

      return report;

    } catch (error) {
      console.error('质量门禁检查过程中发生错误:', error.message);
      throw error;
    }
  }
}

// 命令行接口
async function main() {
  const qualityGates = new QualityGatesCI();
  const report = await qualityGates.run();

  // 根据结果设置退出码
  if (!report.passed) {
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('CI/CD质量门禁执行失败:', error.message);
    process.exit(1);
  });
}

module.exports = QualityGatesCI;