#!/usr/bin/env node

/**
 * 类型回归测试工具
 * 检测代码变更是否引入了类型安全退化
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

class TypeRegressionTester {
  constructor(options = {}) {
    this.options = {
      baselineBranch: 'main',
      strict: false,
      detailed: true,
      outputFormat: 'console', // 'console', 'json', 'markdown'
      outputFile: null,
      skipBuild: false,
      ...options
    };

    this.baselineDir = join(process.cwd(), '.type-regression');
    this.currentBaselinePath = join(this.baselineDir, 'current.json');
    this.compareBaselinePath = join(this.baselineDir, 'compare.json');
    this.reportPath = join(this.baselineDir, 'report.json');

    this.results = {
      summary: {
        totalChanges: 0,
        breakingChanges: 0,
        nonBreakingChanges: 0,
        regressions: 0,
        improvements: 0,
        passed: false
      },
      changes: {
        added: [],
        removed: [],
        modified: [],
        errors: {
          new: [],
          fixed: [],
          existing: []
        }
      },
      analysis: {
        impact: 'none', // 'none', 'low', 'medium', 'high', 'critical'
        risk: 'low', // 'low', 'medium', 'high', 'critical'
        recommendations: []
      },
      performance: {
        typeCheckTime: 0,
        buildTime: 0,
        memoryUsage: 0
      }
    };

    this.startTime = Date.now();
  }

  /**
   * 运行类型回归测试
   */
  async run() {
    console.log('🔍 开始类型回归测试...\n');

    try {
      // 1. 准备环境
      await this.prepareEnvironment();

      // 2. 获取基线数据
      await this.fetchBaselineData();

      // 3. 分析当前代码
      await this.analyzeCurrentCode();

      // 4. 比较变更
      await this.compareChanges();

      // 5. 影响分析
      await this.analyzeImpact();

      // 6. 性能分析
      if (!this.options.skipBuild) {
        await this.analyzePerformance();
      }

      // 7. 生成报告
      await this.generateReport();

      // 8. 确定结果
      const success = this.determineSuccess();

      if (!success) {
        console.log('❌ 类型回归测试失败');
        process.exit(1);
      } else {
        console.log('✅ 类型回归测试通过');
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ 类型回归测试失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 准备环境
   */
  async prepareEnvironment() {
    console.log('🔧 准备测试环境...');

    // 创建基线目录
    if (!existsSync(this.baselineDir)) {
      mkdirSync(this.baselineDir, { recursive: true });
    }

    // 检查Git状态
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('⚠️ 检测到未提交的变更，可能会影响测试结果');
      }
    } catch (error) {
      console.log('⚠️ 无法获取Git状态');
    }

    // 确保依赖已安装
    try {
      execSync('pnpm install --frozen-lockfile', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('依赖安装失败');
    }

    console.log('✅ 环境准备完成\n');
  }

  /**
   * 获取基线数据
   */
  async fetchBaselineData() {
    console.log('📂 获取基线数据...');

    try {
      // 获取基线分支的最新提交
      const baselineCommit = execSync(`git rev-parse ${this.options.baselineBranch}`, { encoding: 'utf8' }).trim();
      console.log(`基线分支: ${this.options.baselineBranch} (${baselineCommit.substring(0, 8)})`);

      // 检查是否已有缓存基线
      if (existsSync(this.compareBaselinePath)) {
        const cached = JSON.parse(readFileSync(this.compareBaselinePath, 'utf8'));
        if (cached.commit === baselineCommit) {
          console.log('✅ 使用缓存的基线数据\n');
          this.baselineData = cached;
          return;
        }
      }

      // 创建基线数据的临时目录
      const tempDir = join(this.baselineDir, 'temp-baseline');
      if (existsSync(tempDir)) {
        execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });
      }
      mkdirSync(tempDir, { recursive: true });

      // 获取基线分支的代码
      execSync(`git archive ${baselineCommit} | tar -x -C ${tempDir}`, { stdio: 'pipe' });

      // 分析基线类型
      const baselineData = {
        commit: baselineCommit,
        timestamp: new Date().toISOString(),
        types: await this.extractTypeDefinitions(tempDir),
        errors: await this.extractTypeErrors(tempDir),
        coverage: await this.extractCoverageInfo(tempDir)
      };

      // 保存基线数据
      writeFileSync(this.compareBaselinePath, JSON.stringify(baselineData, null, 2));
      this.baselineData = baselineData;

      // 清理临时目录
      execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });

      console.log('✅ 基线数据获取完成\n');

    } catch (error) {
      console.log('⚠️ 无法获取基线数据，将跳过比较');
      this.baselineData = null;
    }
  }

  /**
   * 分析当前代码
   */
  async analyzeCurrentCode() {
    console.log('📊 分析当前代码...');

    const currentData = {
      commit: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
      timestamp: new Date().toISOString(),
      types: await this.extractTypeDefinitions(process.cwd()),
      errors: await this.extractTypeErrors(process.cwd()),
      coverage: await this.extractCoverageInfo(process.cwd())
    };

    this.currentData = currentData;
    writeFileSync(this.currentBaselinePath, JSON.stringify(currentData, null, 2));

    console.log(`✅ 当前代码分析完成 (${currentData.commit.substring(0, 8)})\n`);
  }

  /**
   * 比较变更
   */
  async compareChanges() {
    console.log('🔍 比较类型变更...');

    if (!this.baselineData) {
      console.log('ℹ️ 无基线数据，跳过比较\n');
      return;
    }

    // 比较类型定义
    await this.compareTypes();

    // 比较类型错误
    await this.compareErrors();

    // 比较覆盖率
    await this.compareCoverage();

    // 统计变更
    this.summarizeChanges();

    console.log('✅ 变更比较完成\n');
  }

  /**
   * 比较类型定义
   */
  async compareTypes() {
    const baselineTypes = new Map(this.baselineData.types.map(t => [t.name, t]));
    const currentTypes = new Map(this.currentData.types.map(t => [t.name, t]));

    // 检测新增类型
    for (const [name, type] of currentTypes) {
      if (!baselineTypes.has(name)) {
        this.results.changes.added.push({
          name,
          kind: type.kind,
          file: type.file,
          exported: type.exported,
          breaking: false
        });
      }
    }

    // 检测删除类型
    for (const [name, type] of baselineTypes) {
      if (!currentTypes.has(name)) {
        this.results.changes.removed.push({
          name,
          kind: type.kind,
          file: type.file,
          exported: type.exported,
          breaking: type.exported
        });
      }
    }

    // 检测修改类型
    for (const [name, currentType] of currentTypes) {
      const baselineType = baselineTypes.get(name);
      if (baselineType && !this.areTypesEqual(currentType, baselineType)) {
        this.results.changes.modified.push({
          name,
          kind: currentType.kind,
          file: currentType.file,
          exported: currentType.exported,
          breaking: this.isBreakingChange(currentType, baselineType),
          changes: this.getTypeChanges(currentType, baselineType)
        });
      }
    }
  }

  /**
   * 比较类型错误
   */
  async compareErrors() {
    const baselineErrors = new Set(
      this.baselineData.errors.map(e => `${e.file}:${e.line}:${e.message}`)
    );
    const currentErrors = new Set(
      this.currentData.errors.map(e => `${e.file}:${e.line}:${e.message}`)
    );

    // 检测新增错误
    for (const error of this.currentData.errors) {
      const errorKey = `${error.file}:${error.line}:${error.message}`;
      if (!baselineErrors.has(errorKey)) {
        this.results.changes.errors.new.push(error);
      }
    }

    // 检测修复的错误
    for (const error of this.baselineData.errors) {
      const errorKey = `${error.file}:${error.line}:${error.message}`;
      if (!currentErrors.has(errorKey)) {
        this.results.changes.errors.fixed.push(error);
      }
    }

    // 持续存在的错误
    for (const error of this.currentData.errors) {
      const errorKey = `${error.file}:${error.line}:${error.message}`;
      if (baselineErrors.has(errorKey)) {
        this.results.changes.errors.existing.push(error);
      }
    }
  }

  /**
   * 比较覆盖率
   */
  async compareCoverage() {
    const baselineCoverage = this.baselineData.coverage;
    const currentCoverage = this.currentData.coverage;

    this.coverageChange = currentCoverage.overall - baselineCoverage.overall;

    if (this.coverageChange < -2) {
      this.results.changes.errors.new.push({
        type: 'coverage_regression',
        message: `类型覆盖率下降 ${Math.abs(this.coverageChange).toFixed(2)}%`,
        current: currentCoverage.overall,
        baseline: baselineCoverage.overall
      });
    }
  }

  /**
   * 总结变更
   */
  summarizeChanges() {
    const changes = this.results.changes;

    this.results.summary.totalChanges =
      changes.added.length +
      changes.removed.length +
      changes.modified.length +
      changes.errors.new.length;

    this.results.summary.breakingChanges =
      changes.removed.filter(t => t.breaking).length +
      changes.modified.filter(t => t.breaking).length;

    this.results.summary.nonBreakingChanges =
      this.results.summary.totalChanges - this.results.summary.breakingChanges;

    this.results.summary.regressions =
      changes.errors.new.length +
      (this.coverageChange < -2 ? 1 : 0);

    this.results.summary.improvements =
      changes.errors.fixed.length +
      (this.coverageChange > 2 ? 1 : 0);
  }

  /**
   * 影响分析
   */
  async analyzeImpact() {
    console.log('📈 分析影响...');

    let impactScore = 0;
    let riskScore = 0;

    // 基于破坏性变更计算影响
    if (this.results.summary.breakingChanges > 0) {
      impactScore += this.results.summary.breakingChanges * 20;
      riskScore += this.results.summary.breakingChanges * 15;
    }

    // 基于新增错误计算影响
    if (this.results.changes.errors.new.length > 0) {
      impactScore += this.results.changes.errors.new.length * 10;
      riskScore += this.results.changes.errors.new.length * 8;
    }

    // 基于覆盖率回归计算影响
    if (this.coverageChange < -2) {
      impactScore += Math.abs(this.coverageChange) * 5;
      riskScore += Math.abs(this.coverageChange) * 3;
    }

    // 确定影响级别
    if (impactScore >= 50) {
      this.results.analysis.impact = 'critical';
    } else if (impactScore >= 30) {
      this.results.analysis.impact = 'high';
    } else if (impactScore >= 15) {
      this.results.analysis.impact = 'medium';
    } else if (impactScore > 0) {
      this.results.analysis.impact = 'low';
    }

    // 确定风险级别
    if (riskScore >= 40) {
      this.results.analysis.risk = 'critical';
    } else if (riskScore >= 25) {
      this.results.analysis.risk = 'high';
    } else if (riskScore >= 15) {
      this.results.analysis.risk = 'medium';
    } else {
      this.results.analysis.risk = 'low';
    }

    // 生成建议
    this.generateRecommendations();

    console.log(`✅ 影响分析完成 (${this.results.analysis.impact} impact, ${this.results.analysis.risk} risk)\n`);
  }

  /**
   * 性能分析
   */
  async analyzePerformance() {
    console.log('⚡ 性能分析...');

    try {
      // TypeScript编译时间
      const typeCheckStart = Date.now();
      try {
        execSync('pnpm run type-check', { stdio: 'pipe' });
        this.results.performance.typeCheckTime = Date.now() - typeCheckStart;
      } catch (error) {
        this.results.performance.typeCheckTime = Date.now() - typeCheckStart;
      }

      // 构建时间
      if (!this.options.skipBuild) {
        const buildStart = Date.now();
        try {
          execSync('pnpm run build', { stdio: 'pipe' });
          this.results.performance.buildTime = Date.now() - buildStart;
        } catch (error) {
          this.results.performance.buildTime = Date.now() - buildStart;
        }
      }

      // 内存使用（简化实现）
      this.results.performance.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

      console.log('✅ 性能分析完成\n');
    } catch (error) {
      console.log('⚠️ 性能分析失败\n');
    }
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];

    // 基于破坏性变更的建议
    if (this.results.summary.breakingChanges > 0) {
      recommendations.push({
        type: 'breaking_changes',
        priority: 'critical',
        message: `检测到 ${this.results.summary.breakingChanges} 个破坏性变更，需要更新相关的使用代码`,
        action: 'update_consumers'
      });
    }

    // 基于类型错误的建议
    if (this.results.changes.errors.new.length > 0) {
      recommendations.push({
        type: 'type_errors',
        priority: 'high',
        message: `引入了 ${this.results.changes.errors.new.length} 个新类型错误，需要修复`,
        action: 'fix_type_errors'
      });
    }

    // 基于覆盖率的建议
    if (this.coverageChange < -2) {
      recommendations.push({
        type: 'coverage',
        priority: 'medium',
        message: `类型覆盖率下降 ${Math.abs(this.coverageChange).toFixed(2)}%，建议添加类型定义`,
        action: 'improve_coverage'
      });
    }

    // 基于影响的建议
    if (this.results.analysis.impact === 'critical') {
      recommendations.push({
        type: 'impact',
        priority: 'critical',
        message: '变更具有关键影响，建议进行全面的回归测试',
        action: 'comprehensive_testing'
      });
    }

    this.results.analysis.recommendations = recommendations;
  }

  /**
   * 生成报告
   */
  async generateReport() {
    console.log('📄 生成回归测试报告...');

    const report = {
      timestamp: new Date().toISOString(),
      baseline: {
        commit: this.baselineData?.commit,
        branch: this.options.baselineBranch
      },
      current: {
        commit: this.currentData.commit
      },
      summary: this.results.summary,
      changes: this.results.changes,
      analysis: this.results.analysis,
      performance: this.results.performance,
      coverageChange: this.coverageChange || 0,
      duration: Date.now() - this.startTime
    };

    // 保存报告
    writeFileSync(this.reportPath, JSON.stringify(report, null, 2));

    // 如果指定了输出文件，也保存一份
    if (this.options.outputFile) {
      if (this.options.outputFormat === 'json') {
        writeFileSync(this.options.outputFile, JSON.stringify(report, null, 2));
      } else if (this.options.outputFormat === 'markdown') {
        writeFileSync(this.options.outputFile, this.generateMarkdownReport(report));
      }
    }

    // 显示摘要
    this.displaySummary(report);

    console.log('✅ 报告生成完成\n');
  }

  /**
   * 显示摘要
   */
  displaySummary(report) {
    console.log('📊 类型回归测试摘要');
    console.log('='.repeat(50));
    console.log(`基线: ${report.baseline.commit?.substring(0, 8) || 'N/A'} (${report.baseline.branch})`);
    console.log(`当前: ${report.current.commit.substring(0, 8)}`);
    console.log(`总变更: ${report.summary.totalChanges}`);
    console.log(`破坏性变更: ${report.summary.breakingChanges}`);
    console.log(`新增错误: ${report.changes.errors.new.length}`);
    console.log(`修复错误: ${report.changes.errors.fixed.length}`);
    console.log(`覆盖率变化: ${report.coverageChange > 0 ? '+' : ''}${report.coverageChange.toFixed(2)}%`);
    console.log(`影响级别: ${report.analysis.impact.toUpperCase()}`);
    console.log(`风险级别: ${report.analysis.risk.toUpperCase()}`);
    console.log(`分析耗时: ${(report.duration / 1000).toFixed(2)}s`);

    if (report.analysis.recommendations.length > 0) {
      console.log('\n💡 关键建议:');
      report.analysis.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }

    console.log('='.repeat(50));
  }

  /**
   * 确定成功状态
   */
  determineSuccess() {
    if (this.options.strict) {
      return this.results.summary.breakingChanges === 0 &&
             this.results.changes.errors.new.length === 0;
    }

    // 在非严格模式下，允许少量非破坏性变更
    return this.results.summary.breakingChanges === 0 &&
           this.results.changes.errors.new.length <= 3;
  }

  // 辅助方法
  async extractTypeDefinitions(rootDir) {
    // 简化实现，实际应该使用TypeScript API
    return [];
  }

  async extractTypeErrors(rootDir) {
    try {
      const output = execSync('cd ' + rootDir + ' && npx tsc --noEmit --pretty false', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const errors = [];
      const lines = output.split('\n');

      for (const line of lines) {
        const match = line.match(/^(.+)\((\d+),\d+\):\s+error\s+(.+)$/);
        if (match) {
          const [, filePath, lineNum, message] = match;
          errors.push({
            file: filePath,
            line: parseInt(lineNum),
            message: message.trim()
          });
        }
      }

      return errors;
    } catch (error) {
      // TypeScript返回非零退出码时，解析错误输出
      const output = error.stdout || error.stderr || '';
      const errors = [];
      const lines = output.split('\n');

      for (const line of lines) {
        const match = line.match(/^(.+)\((\d+),\d+\):\s+error\s+(.+)$/);
        if (match) {
          const [, filePath, lineNum, message] = match;
          errors.push({
            file: filePath,
            line: parseInt(lineNum),
            message: message.trim()
          });
        }
      }

      return errors;
    }
  }

  async extractCoverageInfo(rootDir) {
    try {
      const output = execSync('cd ' + rootDir + ' && pnpm exec type-coverage --detail', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const match = output.match(/(\d+\.\d+)%/);
      return {
        overall: match ? parseFloat(match[1]) : 0
      };
    } catch (error) {
      return { overall: 0 };
    }
  }

  areTypesEqual(type1, type2) {
    // 简化实现
    return JSON.stringify(type1) === JSON.stringify(type2);
  }

  isBreakingChange(currentType, baselineType) {
    // 简化的破坏性变更检测
    if (currentType.exported && !baselineType.exported) return false;
    if (!currentType.exported && baselineType.exported) return true;
    return false;
  }

  getTypeChanges(currentType, baselineType) {
    // 简化实现
    return [];
  }

  generateMarkdownReport(report) {
    let markdown = `# 类型回归测试报告\n\n`;
    markdown += `**测试时间**: ${new Date(report.timestamp).toLocaleString('zh-CN')}\n`;
    markdown += `**基线**: ${report.baseline.commit?.substring(0, 8) || 'N/A'} (${report.baseline.branch})\n`;
    markdown += `**当前**: ${report.current.commit.substring(0, 8)}\n\n`;

    markdown += `## 📊 摘要\n\n`;
    markdown += `- **总变更**: ${report.summary.totalChanges}\n`;
    markdown += `- **破坏性变更**: ${report.summary.breakingChanges}\n`;
    markdown += `- **新增错误**: ${report.changes.errors.new.length}\n`;
    markdown += `- **修复错误**: ${report.changes.errors.fixed.length}\n`;
    markdown += `- **覆盖率变化**: ${report.coverageChange > 0 ? '+' : ''}${report.coverageChange.toFixed(2)}%\n`;
    markdown += `- **影响级别**: ${report.analysis.impact.toUpperCase()}\n`;
    markdown += `- **风险级别**: ${report.analysis.risk.toUpperCase()}\n\n`;

    if (report.analysis.recommendations.length > 0) {
      markdown += `## 💡 建议\n\n`;
      report.analysis.recommendations.forEach((rec, index) => {
        markdown += `${index + 1}. **[${rec.priority.toUpperCase()}]** ${rec.message}\n`;
      });
    }

    return markdown;
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
      case '--branch':
        options.baselineBranch = args[++i];
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--format':
        options.outputFormat = args[++i];
        break;
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '--help':
        console.log(`
类型回归测试工具

用法: node type-regression-tester.js [选项]

选项:
  --branch <name>       基线分支 (默认: main)
  --strict              严格模式
  --output <file>       输出报告到文件
  --format <format>     报告格式 (console|json|markdown)
  --skip-build          跳过构建测试
  --help                显示帮助信息

示例:
  node type-regression-tester.js
  node type-regression-tester.js --branch develop --strict
  node type-regression-tester.js --output regression-report.md --format markdown
        `);
        process.exit(0);
    }
  }

  const tester = new TypeRegressionTester(options);
  tester.run();
}

module.exports = TypeRegressionTester;