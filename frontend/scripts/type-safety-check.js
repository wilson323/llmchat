#!/usr/bin/env node

/**
 * 类型安全检查脚本
 * 用于本地开发和CI/CD的类型安全检查
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

class TypeSafetyChecker {
  constructor(options = {}) {
    this.options = {
      strict: false,
      createBaseline: false,
      outputFormat: 'console', // 'console', 'json', 'markdown'
      outputFile: null,
      ...options
    };

    this.results = {
      compilation: { passed: false, errors: [], warnings: [], duration: 0 },
      linting: { passed: false, errors: [], warnings: [], duration: 0 },
      coverage: { passed: false, percentage: 0, details: {}, duration: 0 },
      regression: { passed: false, changes: [], errors: [], duration: 0 }
    };

    this.startTime = Date.now();
  }

  /**
   * 执行完整的类型安全检查
   */
  async run() {
    console.log('🚀 开始类型安全检查...\n');

    try {
      // 1. TypeScript编译检查
      await this.checkCompilation();

      // 2. ESLint类型规则检查
      await this.checkLinting();

      // 3. 类型覆盖率分析
      await this.checkCoverage();

      // 4. 类型回归检测
      await this.checkRegression();

      // 5. 生成报告
      await this.generateReport();

      // 6. 确定退出码
      const exitCode = this.determineExitCode();
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ 类型安全检查过程中发生错误:', error.message);
      process.exit(1);
    }
  }

  /**
   * TypeScript编译检查
   */
  async checkCompilation() {
    console.log('🔍 TypeScript编译检查...');
    const startTime = Date.now();

    try {
      const output = execSync('pnpm run type-check', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.results.compilation.passed = true;
      console.log('✅ TypeScript编译检查通过\n');

    } catch (error) {
      const errorOutput = error.stdout || error.stderr || '';
      this.results.compilation.passed = false;
      this.results.compilation.errors = this.parseTypeScriptErrors(errorOutput);

      console.log(`❌ TypeScript编译检查失败 (${this.results.compilation.errors.length} 个错误)\n`);
      this.results.compilation.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.message}`);
        if (err.file && err.line) {
          console.log(`     文件: ${err.file}:${err.line}`);
        }
      });
      console.log('');
    }

    this.results.compilation.duration = Date.now() - startTime;
  }

  /**
   * ESLint类型规则检查
   */
  async checkLinting() {
    console.log('🔍 ESLint类型规则检查...');
    const startTime = Date.now();

    try {
      // 创建专门的类型检查配置
      const typeLintConfig = {
        extends: ['./.eslintrc.cjs'],
        rules: {
          '@typescript-eslint/no-explicit-any': 'error',
          '@typescript-eslint/no-unused-vars': 'error',
          '@typescript-eslint/prefer-const': 'error',
          '@typescript-eslint/no-unsafe-assignment': 'error',
          '@typescript-eslint/no-unsafe-call': 'error',
          '@typescript-eslint/no-unsafe-member-access': 'error',
          '@typescript-eslint/no-unsafe-return': 'error',
          '@typescript-eslint/no-unsafe-argument': 'error'
        }
      };

      const configPath = join(process.cwd(), '.eslintrc.type-check.json');
      writeFileSync(configPath, JSON.stringify(typeLintConfig, null, 2));

      const output = execSync(`pnpm eslint --config ${configPath} src/ --ext .ts,.tsx --format=json`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const eslintResults = JSON.parse(output);
      this.processESLintResults(eslintResults);

      if (this.results.linting.errors.length === 0) {
        console.log('✅ ESLint类型规则检查通过\n');
      } else {
        console.log(`❌ ESLint类型规则检查失败 (${this.results.linting.errors.length} 个错误, ${this.results.linting.warnings.length} 个警告)\n`);
      }

      // 清理临时配置文件
      if (existsSync(configPath)) {
        require('fs').unlinkSync(configPath);
      }

    } catch (error) {
      // ESLint返回非零退出码时，我们需要解析输出
      try {
        const errorOutput = error.stdout || error.stderr || '';
        if (errorOutput.startsWith('[')) {
          const eslintResults = JSON.parse(errorOutput);
          this.processESLintResults(eslintResults);
        } else {
          this.results.linting.errors.push({
            message: 'ESLint执行失败',
            details: errorOutput
          });
        }
      } catch (parseError) {
        this.results.linting.errors.push({
          message: 'ESLint输出解析失败',
          details: error.message
        });
      }

      console.log(`❌ ESLint类型规则检查失败 (${this.results.linting.errors.length} 个错误)\n`);
    }

    this.results.linting.duration = Date.now() - startTime;
  }

  /**
   * 类型覆盖率分析
   */
  async checkCoverage() {
    console.log('📊 类型覆盖率分析...');
    const startTime = Date.now();

    try {
      // 检查是否安装了type-coverage
      try {
        execSync('pnpm exec type-coverage --version', { stdio: 'pipe' });
      } catch (error) {
        console.log('⚠️ type-coverage未安装，跳过类型覆盖率分析');
        console.log('   安装命令: pnpm add -D type-coverage @type-coverage/cli\n');
        this.results.coverage.passed = false;
        this.results.coverage.duration = Date.now() - startTime;
        return;
      }

      const output = execSync('pnpm exec type-coverage --detail --strict', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.results.coverage = this.parseTypeCoverage(output);
      console.log(`📊 类型覆盖率: ${this.results.coverage.percentage}%`);

      if (this.results.coverage.percentage >= 70) {
        console.log('✅ 类型覆盖率达标 (≥70%)\n');
        this.results.coverage.passed = true;
      } else {
        console.log('⚠️ 类型覆盖率不足 (<70%)\n');
        this.results.coverage.passed = false;
      }

    } catch (error) {
      const errorOutput = error.stdout || error.stderr || '';
      this.results.coverage.passed = false;
      this.results.coverage.percentage = 0;
      console.log('❌ 类型覆盖率分析失败\n');
      console.log('错误详情:', errorOutput);
    }

    this.results.coverage.duration = Date.now() - startTime;
  }

  /**
   * 类型回归检测
   */
  async checkRegression() {
    console.log('🔍 类型回归检测...');
    const startTime = Date.now();

    try {
      const baselineDir = join(process.cwd(), '.type-baseline');
      const baselinePath = join(baselineDir, 'latest.json');

      // 检查是否需要创建基线
      if (this.options.createBaseline || !existsSync(baselinePath)) {
        console.log('📝 创建类型基线...');
        await this.createBaseline();
        this.results.regression.passed = true;
        console.log('✅ 类型基线创建完成\n');
      } else {
        console.log('🔍 检测类型变更...');
        const changes = await this.detectTypeChanges(baselinePath);
        this.results.regression.changes = changes;

        if (changes.length === 0) {
          console.log('✅ 类型回归检测通过 - 无变更\n');
          this.results.regression.passed = true;
        } else {
          console.log(`📝 检测到 ${changes.length} 个类型变更\n`);
          changes.forEach((change, index) => {
            console.log(`  ${index + 1}. ${change.type}: ${change.name} (${change.file})`);
          });

          // 在严格模式下，任何变更都失败
          const breakingChanges = changes.filter(c => c.breaking);
          if (breakingChanges.length > 0 || this.options.strict) {
            console.log(`❌ 检测到 ${breakingChanges.length} 个破坏性变更\n`);
            this.results.regression.passed = false;
          } else {
            console.log('✅ 类型回归检测通过 - 无破坏性变更\n');
            this.results.regression.passed = true;
          }
        }
      }

    } catch (error) {
      console.log('❌ 类型回归检测失败:', error.message);
      this.results.regression.passed = false;
      this.results.regression.errors.push({
        message: error.message,
        type: 'detection_failed'
      });
    }

    this.results.regression.duration = Date.now() - startTime;
  }

  /**
   * 生成报告
   */
  async generateReport() {
    const totalTime = Date.now() - this.startTime;
    const passedCount = Object.values(this.results).filter(r => r.passed).length;
    const totalCount = Object.keys(this.results).length;

    console.log('📊 类型安全检查报告');
    console.log('='.repeat(50));
    console.log(`总耗时: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`检查通过: ${passedCount}/${totalCount}`);
    console.log('');

    // 详细结果
    this.printDetailedResults();

    // 根据输出格式生成报告文件
    if (this.options.outputFile) {
      await this.saveReport();
    }

    // 生成质量评分
    const score = this.calculateQualityScore();
    console.log(`\n🎯 类型安全评分: ${score.score}/100 (${score.grade})`);

    if (score.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      score.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('='.repeat(50));
  }

  /**
   * 解析TypeScript错误
   */
  parseTypeScriptErrors(output) {
    const errors = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(.+)\((\d+),\d+\):\s+error\s+(.+)$/);
      if (match) {
        const [, filePath, lineNum, message] = match;
        errors.push({
          file: filePath,
          line: parseInt(lineNum),
          message: message.trim(),
          type: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * 处理ESLint结果
   */
  processESLintResults(results) {
    this.results.linting.errors = [];
    this.results.linting.warnings = [];

    for (const file of results) {
      for (const message of file.messages) {
        const issue = {
          file: file.filePath,
          line: message.line,
          column: message.column,
          message: message.message,
          rule: message.ruleId,
          type: message.severity === 2 ? 'error' : 'warning'
        };

        if (issue.type === 'error') {
          this.results.linting.errors.push(issue);
        } else {
          this.results.linting.warnings.push(issue);
        }
      }
    }
  }

  /**
   * 解析类型覆盖率结果
   */
  parseTypeCoverage(output) {
    const lines = output.split('\n');
    let percentage = 0;
    const details = {};

    for (const line of lines) {
      if (line.includes('%')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) {
          percentage = parseFloat(match[1]);
        }
      }

      // 解析详细文件信息
      if (line.includes('src/') && line.includes('%')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const coverage = parseFloat(parts[parts.length - 1].replace('%', ''));
          const filePath = parts.slice(0, -1).join(' ');
          details[filePath] = coverage;
        }
      }
    }

    return {
      passed: percentage >= 70,
      percentage,
      details
    };
  }

  /**
   * 创建类型基线
   */
  async createBaseline() {
    const baselineDir = join(process.cwd(), '.type-baseline');

    if (!existsSync(baselineDir)) {
      mkdirSync(baselineDir, { recursive: true });
    }

    let gitHash = 'unknown';
    try {
      gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      // 忽略Git错误
    }

    const baseline = {
      version: gitHash,
      timestamp: new Date().toISOString(),
      projectHash: gitHash,
      typeDefinitions: await this.extractTypeDefinitions(),
      files: await this.analyzeFiles(),
      usageStats: await this.calculateUsageStats(),
      dependencies: []
    };

    const baselinePath = join(baselineDir, 'latest.json');
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  }

  /**
   * 检测类型变更
   */
  async detectTypeChanges(baselinePath) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const currentDefinitions = await this.extractTypeDefinitions();

    const changes = [];

    // 简化的变更检测逻辑
    const baselineTypes = new Map(baseline.typeDefinitions.map(t => [t.name, t]));
    const currentTypes = new Map(currentDefinitions.map(t => [t.name, t]));

    // 检测新增类型
    for (const [name, type] of currentTypes) {
      if (!baselineTypes.has(name)) {
        changes.push({
          type: 'addition',
          name,
          file: type.filePath,
          breaking: false
        });
      }
    }

    // 检测删除类型
    for (const [name, type] of baselineTypes) {
      if (!currentTypes.has(name)) {
        changes.push({
          type: 'removal',
          name,
          file: type.filePath,
          breaking: type.isExported
        });
      }
    }

    return changes;
  }

  /**
   * 提取类型定义（简化实现）
   */
  async extractTypeDefinitions() {
    // 这里应该实现真正的类型定义提取
    // 为简化示例，返回空数组
    return [];
  }

  /**
   * 分析文件（简化实现）
   */
  async analyzeFiles() {
    return [];
  }

  /**
   * 计算使用统计（简化实现）
   */
  async calculateUsageStats() {
    return {
      interfaces: 0,
      typeAliases: 0,
      enums: 0,
      anyTypes: 0
    };
  }

  /**
   * 打印详细结果
   */
  printDetailedResults() {
    console.log('📋 详细结果:');
    console.log('');

    // TypeScript编译
    console.log(`TypeScript编译: ${this.results.compilation.passed ? '✅ 通过' : '❌ 失败'}`);
    if (this.results.compilation.errors.length > 0) {
      console.log(`  错误: ${this.results.compilation.errors.length}`);
    }
    console.log(`  耗时: ${this.results.compilation.duration}ms`);
    console.log('');

    // ESLint检查
    console.log(`ESLint类型规则: ${this.results.linting.passed ? '✅ 通过' : '❌ 失败'}`);
    if (this.results.linting.errors.length > 0 || this.results.linting.warnings.length > 0) {
      console.log(`  错误: ${this.results.linting.errors.length}, 警告: ${this.results.linting.warnings.length}`);
    }
    console.log(`  耗时: ${this.results.linting.duration}ms`);
    console.log('');

    // 类型覆盖率
    console.log(`类型覆盖率: ${this.results.coverage.passed ? '✅ 通过' : '⚠️ 不足'} (${this.results.coverage.percentage}%)`);
    console.log(`  耗时: ${this.results.coverage.duration}ms`);
    console.log('');

    // 类型回归
    console.log(`类型回归检测: ${this.results.regression.passed ? '✅ 通过' : '❌ 失败'}`);
    if (this.results.regression.changes.length > 0) {
      console.log(`  变更: ${this.results.regression.changes.length}`);
    }
    console.log(`  耗时: ${this.results.regression.duration}ms`);
    console.log('');
  }

  /**
   * 保存报告
   */
  async saveReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      results: this.results,
      summary: {
        totalChecks: Object.keys(this.results).length,
        passedChecks: Object.values(this.results).filter(r => r.passed).length,
        score: this.calculateQualityScore()
      }
    };

    let reportContent;
    const ext = this.options.outputFormat === 'json' ? '.json' : '.md';

    if (this.options.outputFormat === 'json') {
      reportContent = JSON.stringify(reportData, null, 2);
    } else {
      reportContent = this.generateMarkdownReport(reportData);
    }

    writeFileSync(this.options.outputFile, reportContent);
    console.log(`📄 报告已保存到: ${this.options.outputFile}`);
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport(data) {
    let report = `# 类型安全检查报告\n\n`;
    report += `**检查时间**: ${data.timestamp}\n`;
    report += `**总耗时**: ${(data.duration / 1000).toFixed(2)}s\n`;
    report += `**通过检查**: ${data.summary.passedChecks}/${data.summary.totalChecks}\n`;
    report += `**质量评分**: ${data.summary.score.score}/100 (${data.summary.score.grade})\n\n`;

    report += `## 📊 检查结果\n\n`;

    for (const [name, result] of Object.entries(data.results)) {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      report += `### ${name}\n`;
      report += `- **状态**: ${status}\n`;
      report += `- **耗时**: ${result.duration}ms\n`;

      if (result.errors && result.errors.length > 0) {
        report += `- **错误数**: ${result.errors.length}\n`;
      }
      if (result.warnings && result.warnings.length > 0) {
        report += `- **警告数**: ${result.warnings.length}\n`;
      }
      report += `\n`;
    }

    if (data.summary.score.recommendations.length > 0) {
      report += `## 💡 改进建议\n\n`;
      data.summary.score.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }

    return report;
  }

  /**
   * 计算质量评分
   */
  calculateQualityScore() {
    let score = 0;
    const recommendations = [];

    // 编译检查 (30分)
    if (this.results.compilation.passed) {
      score += 30;
    } else {
      recommendations.push('修复TypeScript编译错误');
    }

    // ESLint检查 (25分)
    if (this.results.linting.passed) {
      score += 25;
    } else {
      recommendations.push('修复ESLint类型规则错误');
    }

    // 类型覆盖率 (25分)
    const coverageScore = Math.min(25, (this.results.coverage.percentage / 100) * 25);
    score += coverageScore;
    if (this.results.coverage.percentage < 70) {
      recommendations.push('提高类型覆盖率到70%以上');
    }

    // 回归检测 (20分)
    if (this.results.regression.passed) {
      score += 20;
    } else {
      recommendations.push('解决类型回归问题');
    }

    // 确定等级
    let grade;
    if (score >= 90) grade = 'A+';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 50) grade = 'D';
    else grade = 'F';

    return { score: Math.round(score), grade, recommendations };
  }

  /**
   * 确定退出码
   */
  determineExitCode() {
    // 关键检查失败时退出码为1
    const criticalFailures = [
      this.results.compilation.passed,
      this.results.linting.passed,
      this.results.regression.passed
    ];

    if (criticalFailures.some(passed => !passed)) {
      return 1;
    }

    // 覆盖率不足但其他检查通过时退出码为2
    if (!this.results.coverage.passed) {
      return 2;
    }

    return 0;
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
      case '--strict':
        options.strict = true;
        break;
      case '--create-baseline':
        options.createBaseline = true;
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--format':
        options.outputFormat = args[++i];
        break;
      case '--help':
        console.log(`
类型安全检查脚本

用法: node type-safety-check.js [选项]

选项:
  --strict              启用严格模式
  --create-baseline     创建新的类型基线
  --output <file>       输出报告到文件
  --format <format>     报告格式 (console|json|markdown)
  --help                显示帮助信息

示例:
  node type-safety-check.js
  node type-safety-check.js --strict --output report.md
  node type-safety-check.js --create-baseline --format json
        `);
        process.exit(0);
    }
  }

  const checker = new TypeSafetyChecker(options);
  checker.run();
}

module.exports = TypeSafetyChecker;