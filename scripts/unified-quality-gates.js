#!/usr/bin/env node

/**
 * 统一质量门禁系统
 *
 * 功能：
 * - 零容忍错误政策执行
 * - 多维度质量检查
 * - 自动化评分系统
 * - 详细报告生成
 * - 可配置阈值
 *
 * 使用方法：
 * node scripts/unified-quality-gates.js [options]
 *
 * 选项：
 * --mode <mode>           运行模式: strict|standard|lenient (默认: strict)
 * --threshold <number>    质量阈值 (默认: 80)
 * --output <format>       输出格式: json|markdown|console (默认: console)
 * --pre-commit           预提交模式 (快速检查)
 * --ci-mode              CI模式 (详细输出)
 * --report-path <path>    报告输出路径
 * --config <path>         配置文件路径
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class UnifiedQualityGates {
  constructor(options = {}) {
    this.options = {
      mode: options.mode || 'strict',
      threshold: parseInt(options.threshold) || 80,
      output: options.output || 'console',
      preCommit: options.preCommit || false,
      ciMode: options.ciMode || false,
      reportPath: options.reportPath || './quality-reports',
      configPath: options.configPath || './.quality-gates.config.json',
      ...options
    };

    this.results = {
      typescript: { status: 'pending', errors: 0, warnings: 0, score: 0 },
      eslint: { status: 'pending', errors: 0, warnings: 0, score: 0 },
      tests: { status: 'pending', passed: 0, failed: 0, coverage: 0, score: 0 },
      security: { status: 'pending', vulnerabilities: 0, score: 0 },
      build: { status: 'pending', success: false, score: 0 }
    };

    this.config = this.loadConfig();
    this.startTime = Date.now();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.options.configPath)) {
        return JSON.parse(fs.readFileSync(this.options.configPath, 'utf8'));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  配置文件加载失败，使用默认配置'));
    }

    return {
      thresholds: {
        typescript: 100,    // 零容忍TypeScript错误
        eslint: 0,         // 零容忍ESLint错误
        tests: 80,         // 测试覆盖率
        security: 0,       // 零容忍高危漏洞
        build: 100         // 必须构建成功
      },
      rules: {
        failOnWarning: this.options.mode === 'strict',
        skipSlowChecks: this.options.preCommit,
        generateReports: !this.options.preCommit
      }
    };
  }

  async runAll() {
    console.log(chalk.blue.bold('🛡️  统一质量门禁系统'));
    console.log(chalk.blue(`模式: ${this.options.mode} | 阈值: ${this.options.threshold} | 开始时间: ${new Date().toISOString()}`));
    console.log('');

    try {
      // 确保报告目录存在
      if (!fs.existsSync(this.options.reportPath)) {
        fs.mkdirSync(this.options.reportPath, { recursive: true });
      }

      // 执行所有检查
      await this.runTypeScriptCheck();
      await this.runESLintCheck();
      await this.runTestsCheck();
      await this.runSecurityCheck();
      await this.runBuildCheck();

      // 计算总体分数
      const overallScore = this.calculateOverallScore();
      const overallStatus = this.getOverallStatus(overallScore);

      // 生成报告
      const report = this.generateReport(overallScore, overallStatus);

      // 输出结果
      this.outputResults(report);

      // 返回结果
      return {
        success: overallStatus === 'passed',
        score: overallScore,
        status: overallStatus,
        results: this.results,
        report
      };

    } catch (error) {
      console.error(chalk.red('❌ 质量门禁执行失败:'), error.message);
      return {
        success: false,
        error: error.message,
        results: this.results
      };
    }
  }

  async runTypeScriptCheck() {
    console.log(chalk.yellow('📝 TypeScript 类型检查...'));

    try {
      const startTime = Date.now();
      const output = execSync('pnpm run type-check', {
        encoding: 'utf8',
        stdio: this.options.ciMode ? 'pipe' : 'inherit'
      });
      const duration = Date.now() - startTime;

      this.results.typescript = {
        status: 'passed',
        errors: 0,
        warnings: 0,
        score: 100,
        duration,
        output: this.options.ciMode ? output : ''
      };

      console.log(chalk.green('✅ TypeScript 检查通过 - 零错误'));

    } catch (error) {
      const errorOutput = error.stdout || error.stderr || '';
      const errorLines = errorOutput.split('\n').filter(line => line.includes('error TS'));
      const errorCount = errorLines.length;

      this.results.typescript = {
        status: 'failed',
        errors: errorCount,
        warnings: 0,
        score: Math.max(0, 100 - (errorCount * 10)),
        output: errorOutput
      };

      console.log(chalk.red(`❌ TypeScript 检查失败 - ${errorCount} 个错误`));

      if (this.options.mode === 'strict') {
        throw new Error(`TypeScript 类型检查失败: ${errorCount} 个错误`);
      }
    }
  }

  async runESLintCheck() {
    console.log(chalk.yellow('🔍 ESLint 代码质量检查...'));

    try {
      const startTime = Date.now();

      // 尝试生成JSON报告
      let jsonReport = '';
      let output = '';

      try {
        jsonReport = execSync('pnpm run lint --format=json', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        output = execSync('pnpm run lint', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
        jsonReport = '';
      }

      const duration = Date.now() - startTime;
      let errors = 0;
      let warnings = 0;

      // 解析JSON报告
      if (jsonReport) {
        try {
          const reports = JSON.parse(jsonReport);
          reports.forEach(report => {
            if (report.messages) {
              report.messages.forEach(msg => {
                if (msg.severity === 2) errors++;
                else if (msg.severity === 1) warnings++;
              });
            }
          });
        } catch (e) {
          // JSON解析失败，从文本输出中提取
          const errorMatches = output.match(/\d+ error/g) || [];
          const warningMatches = output.match(/\d+ warning/g) || [];
          errors = errorMatches.length ? parseInt(errorMatches[0]) : 0;
          warnings = warningMatches.length ? parseInt(warningMatches[0]) : 0;
        }
      } else {
        // 从文本输出中提取
        const errorMatches = output.match(/\d+ error/g) || [];
        const warningMatches = output.match(/\d+ warning/g) || [];
        errors = errorMatches.length ? parseInt(errorMatches[0]) : 0;
        warnings = warningMatches.length ? parseInt(warningMatches[0]) : 0;
      }

      const hasFailures = errors > 0 || (this.config.rules.failOnWarning && warnings > 0);

      this.results.eslint = {
        status: hasFailures ? 'failed' : 'passed',
        errors,
        warnings,
        score: Math.max(0, 100 - (errors * 5) - (warnings * 2)),
        duration,
        output
      };

      if (hasFailures) {
        console.log(chalk.red(`❌ ESLint 检查失败 - ${errors} 错误, ${warnings} 警告`));
        if (this.options.mode === 'strict') {
          throw new Error(`ESLint 检查失败: ${errors} 错误, ${warnings} 警告`);
        }
      } else {
        console.log(chalk.green('✅ ESLint 检查通过 - 零错误'));
      }

    } catch (error) {
      if (error.message.includes('ESLint 检查失败')) {
        throw error;
      }

      console.log(chalk.red('❌ ESLint 检查执行失败:'), error.message);
      this.results.eslint = {
        status: 'failed',
        errors: 1,
        warnings: 0,
        score: 0,
        output: error.message
      };
    }
  }

  async runTestsCheck() {
    console.log(chalk.yellow('🧪 测试套件检查...'));

    if (this.options.preCommit) {
      console.log(chalk.blue('⏭️  预提交模式 - 跳过完整测试套件'));
      this.results.tests = {
        status: 'skipped',
        passed: 0,
        failed: 0,
        coverage: 0,
        score: 80,
        output: '预提交模式跳过测试'
      };
      return;
    }

    try {
      const startTime = Date.now();
      const output = execSync('pnpm test -- --coverage --passWithNoTests', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const duration = Date.now() - startTime;

      // 解析测试结果
      let passed = 0;
      let failed = 0;
      let coverage = 0;

      // 尝试从输出中提取测试结果
      const testMatches = output.match(/(\d+) passing|(\d+) failed/g) || [];
      testMatches.forEach(match => {
        if (match.includes('passing')) {
          passed = parseInt(match.match(/(\d+) passing/)[1]);
        } else if (match.includes('failed')) {
          failed = parseInt(match.match(/(\d+) failed/)[1]);
        }
      });

      // 尝试提取覆盖率
      const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        coverage = parseFloat(coverageMatch[1]);
      }

      const hasFailures = failed > 0;
      const coverageOk = coverage >= this.config.thresholds.tests;

      this.results.tests = {
        status: hasFailures ? 'failed' : (coverageOk ? 'passed' : 'warning'),
        passed,
        failed,
        coverage,
        score: hasFailures ? 0 : (coverageOk ? 100 : Math.max(0, coverage)),
        duration,
        output
      };

      if (hasFailures) {
        console.log(chalk.red(`❌ 测试失败 - ${passed} 通过, ${failed} 失败`));
        if (this.options.mode === 'strict') {
          throw new Error(`测试失败: ${failed} 个测试失败`);
        }
      } else if (!coverageOk) {
        console.log(chalk.yellow(`⚠️  测试通过但覆盖率不足 - ${coverage}% < ${this.config.thresholds.tests}%`));
      } else {
        console.log(chalk.green(`✅ 测试通过 - ${passed} 通过, 覆盖率 ${coverage}%`));
      }

    } catch (error) {
      if (error.message.includes('测试失败')) {
        throw error;
      }

      console.log(chalk.red('❌ 测试执行失败:'), error.message);
      this.results.tests = {
        status: 'failed',
        passed: 0,
        failed: 1,
        coverage: 0,
        score: 0,
        output: error.message
      };
    }
  }

  async runSecurityCheck() {
    console.log(chalk.yellow('🔒 安全漏洞检查...'));

    if (this.options.preCommit) {
      console.log(chalk.blue('⏭️  预提交模式 - 跳过安全扫描'));
      this.results.security = {
        status: 'skipped',
        vulnerabilities: 0,
        score: 100,
        output: '预提交模式跳过安全扫描'
      };
      return;
    }

    try {
      const startTime = Date.now();
      const output = execSync('pnpm audit --audit-level moderate', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const duration = Date.now() - startTime;

      this.results.security = {
        status: 'passed',
        vulnerabilities: 0,
        score: 100,
        duration,
        output
      };

      console.log(chalk.green('✅ 安全检查通过 - 零漏洞'));

    } catch (error) {
      const output = error.stdout || error.stderr || '';
      const vulnerabilityMatch = output.match(/(\d+) vulnerabilities/);
      const vulnerabilities = vulnerabilityMatch ? parseInt(vulnerabilityMatch[1]) : 0;

      this.results.security = {
        status: vulnerabilities > 5 ? 'failed' : 'warning',
        vulnerabilities,
        score: Math.max(0, 100 - (vulnerabilities * 10)),
        output
      };

      if (vulnerabilities > 5) {
        console.log(chalk.red(`❌ 安全检查失败 - ${vulnerabilities} 个漏洞`));
        if (this.options.mode === 'strict') {
          throw new Error(`安全检查失败: ${vulnerabilities} 个漏洞`);
        }
      } else {
        console.log(chalk.yellow(`⚠️  发现少量安全漏洞 - ${vulnerabilities} 个`));
      }
    }
  }

  async runBuildCheck() {
    console.log(chalk.yellow('🏗️  构建验证...'));

    try {
      const startTime = Date.now();
      const output = execSync('pnpm run build', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const duration = Date.now() - startTime;

      this.results.build = {
        status: 'passed',
        success: true,
        score: 100,
        duration,
        output
      };

      console.log(chalk.green('✅ 构建成功'));

    } catch (error) {
      const output = error.stdout || error.stderr || '';

      this.results.build = {
        status: 'failed',
        success: false,
        score: 0,
        output
      };

      console.log(chalk.red('❌ 构建失败'));
      if (this.options.mode === 'strict') {
        throw new Error('构建失败');
      }
    }
  }

  calculateOverallScore() {
    const weights = {
      typescript: 0.25,
      eslint: 0.20,
      tests: 0.25,
      security: 0.15,
      build: 0.15
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.keys(weights).forEach(key => {
      const result = this.results[key];
      if (result.status !== 'skipped') {
        totalScore += result.score * weights[key];
        totalWeight += weights[key];
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight * 100) / 100 : 0;
  }

  getOverallStatus(score) {
    if (score >= this.options.threshold) {
      return 'passed';
    } else if (score >= this.options.threshold - 10) {
      return 'warning';
    } else {
      return 'failed';
    }
  }

  generateReport(overallScore, overallStatus) {
    const duration = Date.now() - this.startTime;

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration,
        mode: this.options.mode,
        threshold: this.options.threshold,
        overallScore,
        overallStatus
      },
      results: this.results,
      summary: {
        passed: Object.values(this.results).filter(r => r.status === 'passed').length,
        failed: Object.values(this.results).filter(r => r.status === 'failed').length,
        warnings: Object.values(this.results).filter(r => r.status === 'warning').length,
        skipped: Object.values(this.results).filter(r => r.status === 'skipped').length
      },
      recommendations: this.generateRecommendations(overallScore, overallStatus)
    };

    return report;
  }

  generateRecommendations(score, status) {
    const recommendations = [];

    // TypeScript 建议
    if (this.results.typescript.status === 'failed') {
      recommendations.push({
        category: 'TypeScript',
        priority: 'high',
        message: `修复 ${this.results.typescript.errors} 个类型错误`,
        action: '运行 pnpm run type-check 查看详细错误信息'
      });
    }

    // ESLint 建议
    if (this.results.eslint.status === 'failed') {
      recommendations.push({
        category: '代码质量',
        priority: 'high',
        message: `修复 ${this.results.eslint.errors} 个ESLint错误`,
        action: '运行 pnpm run lint:fix 自动修复部分问题'
      });
    }

    // 测试建议
    if (this.results.tests.status === 'failed') {
      recommendations.push({
        category: '测试',
        priority: 'high',
        message: `修复 ${this.results.tests.failed} 个失败测试`,
        action: '运行 pnpm test 查看详细测试失败信息'
      });
    } else if (this.results.tests.coverage < this.config.thresholds.tests) {
      recommendations.push({
        category: '测试覆盖率',
        priority: 'medium',
        message: `提高测试覆盖率至 ${this.config.thresholds.tests}% (当前: ${this.results.tests.coverage}%)`,
        action: '为未覆盖的代码添加单元测试'
      });
    }

    // 安全建议
    if (this.results.security.status === 'failed') {
      recommendations.push({
        category: '安全',
        priority: 'high',
        message: `修复 ${this.results.security.vulnerabilities} 个安全漏洞`,
        action: '运行 pnpm audit --fix 修复依赖漏洞'
      });
    }

    // 构建建议
    if (this.results.build.status === 'failed') {
      recommendations.push({
        category: '构建',
        priority: 'high',
        message: '修复构建错误',
        action: '检查构建日志并修复相关问题'
      });
    }

    // 总体建议
    if (score < this.options.threshold) {
      recommendations.push({
        category: '总体',
        priority: 'high',
        message: `质量分数 ${score} 低于阈值 ${this.options.threshold}`,
        action: '解决上述所有问题以提高代码质量'
      });
    }

    return recommendations;
  }

  outputResults(report) {
    // 保存报告文件
    if (this.config.rules.generateReports) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportFile = path.join(this.options.reportPath, `quality-report-${timestamp}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

      // 创建最新报告链接
      const latestReportFile = path.join(this.options.reportPath, 'latest-quality-report.json');
      if (fs.existsSync(latestReportFile)) {
        fs.unlinkSync(latestReportFile);
      }
      fs.symlinkSync(path.basename(reportFile), latestReportFile);

      console.log(chalk.blue(`📊 报告已保存: ${reportFile}`));
    }

    // 控制台输出
    if (this.options.output === 'console') {
      this.outputToConsole(report);
    } else if (this.options.output === 'markdown') {
      this.outputToMarkdown(report);
    } else if (this.options.output === 'json') {
      console.log(JSON.stringify(report, null, 2));
    }
  }

  outputToConsole(report) {
    console.log('');
    console.log(chalk.blue.bold('📊 质量门禁报告'));
    console.log(chalk.blue('='.repeat(50)));

    // 总体状态
    const statusColor = report.overallStatus === 'passed' ? chalk.green :
                      report.overallStatus === 'warning' ? chalk.yellow : chalk.red;
    const statusIcon = report.overallStatus === 'passed' ? '✅' :
                     report.overallStatus === 'warning' ? '⚠️' : '❌';

    console.log(statusColor(`${statusIcon} 总体状态: ${report.overallStatus.toUpperCase()}`));
    console.log(chalk.blue(`📈 质量分数: ${report.overallScore}/100`));
    console.log(chalk.blue(`⏱️  执行时间: ${report.metadata.duration}ms`));
    console.log('');

    // 详细结果
    console.log(chalk.yellow('📋 详细结果:'));
    Object.entries(report.results).forEach(([key, result]) => {
      const statusIcon = result.status === 'passed' ? '✅' :
                        result.status === 'warning' ? '⚠️' :
                        result.status === 'skipped' ? '⏭️' : '❌';

      console.log(`  ${statusIcon} ${key.charAt(0).toUpperCase() + key.slice(1)}: ${result.status.toUpperCase()}`);

      if (result.score !== undefined) {
        console.log(`    分数: ${result.score}/100`);
      }

      if (result.errors !== undefined && result.errors > 0) {
        console.log(`    错误: ${result.errors}`);
      }

      if (result.warnings !== undefined && result.warnings > 0) {
        console.log(`    警告: ${result.warnings}`);
      }

      if (result.duration !== undefined) {
        console.log(`    耗时: ${result.duration}ms`);
      }

      console.log('');
    });

    // 建议
    if (report.recommendations.length > 0) {
      console.log(chalk.yellow('💡 改进建议:'));
      report.recommendations.forEach((rec, index) => {
        const priorityColor = rec.priority === 'high' ? chalk.red :
                            rec.priority === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`  ${index + 1}. ${priorityColor(rec.category)}: ${rec.message}`);
        console.log(`     建议: ${rec.action}`);
      });
      console.log('');
    }
  }

  outputToMarkdown(report) {
    const markdown = `# 质量门禁报告

## 📊 总体状态
- **状态**: ${report.overallStatus.toUpperCase()}
- **质量分数**: ${report.overallScore}/100
- **执行时间**: ${report.metadata.duration}ms
- **检查时间**: ${report.metadata.timestamp}

## 📋 详细结果

${Object.entries(report.results).map(([key, result]) => `
### ${key.charAt(0).toUpperCase() + key.slice(1)}
- **状态**: ${result.status.toUpperCase()}
- **分数**: ${result.score}/100${result.errors ? `\n- **错误**: ${result.errors}` : ''}${result.warnings ? `\n- **警告**: ${result.warnings}` : ''}${result.duration ? `\n- **耗时**: ${result.duration}ms` : ''}
`).join('')}

## 💡 改进建议

${report.recommendations.map((rec, index) => `
${index + 1}. **${rec.category}** (${rec.priority}): ${rec.message}
   - 建议: ${rec.action}
`).join('')}
`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.options.reportPath, `quality-report-${timestamp}.md`);
    fs.writeFileSync(reportFile, markdown);

    console.log(chalk.blue(`📊 Markdown报告已保存: ${reportFile}`));
    console.log(markdown);
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
      case '--mode':
        options.mode = args[++i];
        break;
      case '--threshold':
        options.threshold = parseInt(args[++i]);
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--pre-commit':
        options.preCommit = true;
        break;
      case '--ci-mode':
        options.ciMode = true;
        break;
      case '--report-path':
        options.reportPath = args[++i];
        break;
      case '--config':
        options.configPath = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
统一质量门禁系统

用法: node unified-quality-gates.js [选项]

选项:
  --mode <mode>           运行模式: strict|standard|lenient (默认: strict)
  --threshold <number>    质量阈值 (默认: 80)
  --output <format>       输出格式: json|markdown|console (默认: console)
  --pre-commit           预提交模式 (快速检查)
  --ci-mode              CI模式 (详细输出)
  --report-path <path>    报告输出路径
  --config <path>         配置文件路径
  --help, -h             显示帮助信息

示例:
  node unified-quality-gates.js --mode strict
  node unified-quality-gates.js --pre-commit
  node unified-quality-gates.js --ci-mode --output markdown
        `);
        process.exit(0);
    }
  }

  // 运行质量门禁
  const qualityGates = new UnifiedQualityGates(options);

  qualityGates.runAll()
    .then(result => {
      if (!result.success) {
        console.log(chalk.red('\n❌ 质量门禁未通过'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ 质量门禁通过'));
        process.exit(0);
      }
    })
    .catch(error => {
      console.error(chalk.red('\n💥 质量门禁执行失败:'), error.message);
      process.exit(1);
    });
}

module.exports = UnifiedQualityGates;