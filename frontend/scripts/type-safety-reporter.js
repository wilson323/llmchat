#!/usr/bin/env node

/**
 * 类型安全自动化报告生成器
 * 生成详细的类型安全检查报告
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

class TypeSafetyReporter {
  constructor(options = {}) {
    this.options = {
      format: 'html', // 'html', 'markdown', 'json', 'pdf'
      outputDir: join(process.cwd(), 'type-safety-reports'),
      includeCharts: true,
      includeDetails: true,
      emailRecipients: [],
      slackWebhook: null,
      ...options
    };

    this.reportData = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        project: 'llmchat-frontend',
        duration: 0
      },
      summary: {
        overall: 0,
        grade: 'A',
        passed: false,
        issues: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        improvements: 0,
        regressions: 0
      },
      sections: {
        typescript: {},
        eslint: {},
        coverage: {},
        regression: {},
        performance: {},
        trends: {}
      },
      recommendations: [],
      appendix: {
        files: [],
        errors: [],
        metrics: []
      }
    };

    this.startTime = Date.now();
  }

  /**
   * 生成完整报告
   */
  async generateReport() {
    console.log('📝 开始生成类型安全报告...\n');

    try {
      // 1. 准备报告目录
      await this.prepareReportDirectory();

      // 2. 收集数据
      await this.collectData();

      // 3. 生成摘要
      await this.generateSummary();

      // 4. 生成建议
      await this.generateRecommendations();

      // 5. 渲染报告
      await this.renderReport();

      // 6. 发送通知
      await this.sendNotifications();

      const duration = Date.now() - this.startTime;
      this.reportData.metadata.duration = duration;

      console.log(`✅ 报告生成完成 (${(duration / 1000).toFixed(2)}s)\n`);
      console.log(`📄 报告位置: ${this.getReportPath()}`);

    } catch (error) {
      console.error('❌ 报告生成失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 准备报告目录
   */
  async prepareReportDirectory() {
    console.log('📁 准备报告目录...');

    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
    }

    // 创建子目录
    const subdirs = ['assets', 'data', 'charts'];
    for (const subdir of subdirs) {
      const fullPath = join(this.options.outputDir, subdir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }

    console.log('✅ 报告目录准备完成\n');
  }

  /**
   * 收集数据
   */
  async collectData() {
    console.log('📊 收集类型安全数据...');

    try {
      // 收集TypeScript数据
      await this.collectTypeScriptData();

      // 收集ESLint数据
      await this.collectESLintData();

      // 收集覆盖率数据
      await this.collectCoverageData();

      // 收集回归测试数据
      await this.collectRegressionData();

      // 收集性能数据
      await this.collectPerformanceData();

      // 收集趋势数据
      await this.collectTrendData();

      console.log('✅ 数据收集完成\n');

    } catch (error) {
      console.log('⚠️ 部分数据收集失败:', error.message);
    }
  }

  /**
   * 收集TypeScript数据
   */
  async collectTypeScriptData() {
    try {
      const startTime = Date.now();

      // 运行TypeScript检查
      const output = execSync('npx tsc --noEmit --pretty false', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;

      this.reportData.sections.typescript = {
        passed: true,
        errors: 0,
        warnings: 0,
        duration,
        issues: []
      };

    } catch (error) {
      const errorOutput = error.stdout || error.stderr || '';
      const duration = Date.now() - startTime;

      const errors = this.parseTypeScriptErrors(errorOutput);

      this.reportData.sections.typescript = {
        passed: false,
        errors: errors.length,
        warnings: 0,
        duration,
        issues: errors
      };

      // 添加到附录
      this.reportData.appendix.errors.push(...errors);
    }
  }

  /**
   * 收集ESLint数据
   */
  async collectESLintData() {
    try {
      const startTime = Date.now();

      const output = execSync('npx eslint src/ --ext .ts,.tsx --format=json', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const eslintResults = JSON.parse(output);

      let errors = 0;
      let warnings = 0;
      const issues = [];

      for (const file of eslintResults) {
        for (const message of file.messages) {
          const issue = {
            file: file.filePath,
            line: message.line,
            column: message.column,
            message: message.message,
            rule: message.ruleId,
            severity: message.severity === 2 ? 'error' : 'warning'
          };

          issues.push(issue);

          if (issue.severity === 'error') {
            errors++;
          } else {
            warnings++;
          }
        }
      }

      this.reportData.sections.eslint = {
        passed: errors === 0,
        errors,
        warnings,
        duration,
        issues: issues.slice(0, 50) // 限制显示数量
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      this.reportData.sections.eslint = {
        passed: false,
        errors: 1,
        warnings: 0,
        duration,
        issues: [{
          type: 'execution_error',
          message: 'ESLint执行失败',
          details: error.message
        }]
      };
    }
  }

  /**
   * 收集覆盖率数据
   */
  async collectCoverageData() {
    try {
      const output = execSync('pnpm exec type-coverage --detail', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const match = output.match(/(\d+\.\d+)%/);
      const coverage = match ? parseFloat(match[1]) : 0;

      const fileCoverage = this.parseFileCoverage(output);

      this.reportData.sections.coverage = {
        passed: coverage >= 90,
        percentage: coverage,
        target: 90,
        files: fileCoverage,
        trends: []
      };

    } catch (error) {
      this.reportData.sections.coverage = {
        passed: false,
        percentage: 0,
        target: 90,
        files: {},
        trends: []
      };
    }
  }

  /**
   * 收集回归测试数据
   */
  async collectRegressionData() {
    const reportPath = join(process.cwd(), '.type-regression', 'report.json');

    if (existsSync(reportPath)) {
      try {
        const regressionReport = JSON.parse(readFileSync(reportPath, 'utf8'));

        this.reportData.sections.regression = {
          passed: regressionReport.summary.breakingChanges === 0,
          breakingChanges: regressionReport.summary.breakingChanges,
          totalChanges: regressionReport.summary.totalChanges,
          regressions: regressionReport.summary.regressions,
          improvements: regressionReport.summary.improvements,
          changes: regressionReport.changes
        };

      } catch (error) {
        this.reportData.sections.regression = {
          passed: false,
          breakingChanges: 0,
          totalChanges: 0,
          regressions: 0,
          improvements: 0,
          changes: {}
        };
      }
    } else {
      this.reportData.sections.regression = {
        passed: true,
        breakingChanges: 0,
        totalChanges: 0,
        regressions: 0,
        improvements: 0,
        changes: {}
      };
    }
  }

  /**
   * 收集性能数据
   */
  async collectPerformanceData() {
    try {
      // TypeScript编译时间
      const tsStart = Date.now();
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        const tsTime = Date.now() - tsStart;

        // 构建时间
        const buildStart = Date.now();
        try {
          execSync('pnpm run build', { stdio: 'pipe' });
          const buildTime = Date.now() - buildStart;

          this.reportData.sections.performance = {
            typeCheckTime: tsTime,
            buildTime,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
            bundleSize: this.getBundleSize()
          };

        } catch (error) {
          this.reportData.sections.performance = {
            typeCheckTime: tsTime,
            buildTime: -1,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
            bundleSize: 0
          };
        }

      } catch (error) {
        this.reportData.sections.performance = {
          typeCheckTime: -1,
          buildTime: -1,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          bundleSize: 0
        };
      }

    } catch (error) {
      this.reportData.sections.performance = {
        typeCheckTime: -1,
        buildTime: -1,
        memoryUsage: 0,
        bundleSize: 0
      };
    }
  }

  /**
   * 收集趋势数据
   */
  async collectTrendData() {
    const trendPath = join(process.cwd(), '.type-coverage-trend.json');

    if (existsSync(trendPath)) {
      try {
        const trends = JSON.parse(readFileSync(trendPath, 'utf8'));

        this.reportData.sections.trends = {
          data: trends.slice(-30), // 最近30天
          weeklyTrend: this.calculateWeeklyTrend(trends),
          monthlyTrend: this.calculateMonthlyTrend(trends)
        };

      } catch (error) {
        this.reportData.sections.trends = {
          data: [],
          weeklyTrend: 0,
          monthlyTrend: 0
        };
      }
    } else {
      this.reportData.sections.trends = {
        data: [],
        weeklyTrend: 0,
        monthlyTrend: 0
      };
    }
  }

  /**
   * 生成摘要
   */
  async generateSummary() {
    console.log('📋 生成报告摘要...');

    const sections = this.reportData.sections;

    // 计算总体评分
    let score = 0;

    // TypeScript (30%)
    if (sections.typescript.passed) {
      score += 30;
    }

    // ESLint (25%)
    const eslintScore = Math.max(0, 25 - (sections.eslint.errors * 5) - (sections.eslint.warnings * 1));
    score += eslintScore;

    // 覆盖率 (25%)
    const coverageScore = (sections.coverage.percentage / 100) * 25;
    score += coverageScore;

    // 回归测试 (20%)
    if (sections.regression.passed) {
      score += 20;
    }

    this.reportData.summary.overall = Math.round(score);

    // 确定等级
    if (score >= 95) this.reportData.summary.grade = 'A+';
    else if (score >= 90) this.reportData.summary.grade = 'A';
    else if (score >= 85) this.reportData.summary.grade = 'B+';
    else if (score >= 80) this.reportData.summary.grade = 'B';
    else if (score >= 75) this.reportData.summary.grade = 'C+';
    else if (score >= 70) this.reportData.summary.grade = 'C';
    else this.reportData.summary.grade = 'F';

    // 确定通过状态
    this.reportData.summary.passed =
      sections.typescript.passed &&
      sections.eslint.passed &&
      sections.coverage.passed &&
      sections.regression.passed;

    // 统计问题
    this.reportData.summary.issues = {
      critical: sections.typescript.errors + sections.eslint.errors,
      high: sections.coverage.percentage < 80 ? 1 : 0,
      medium: sections.eslint.warnings,
      low: sections.coverage.percentage >= 80 && sections.coverage.percentage < 90 ? 1 : 0
    };

    this.reportData.summary.improvements = sections.regression.improvements;
    this.reportData.summary.regressions = sections.regression.regressions;

    console.log('✅ 摘要生成完成\n');
  }

  /**
   * 生成建议
   */
  async generateRecommendations() {
    console.log('💡 生成改进建议...');

    const recommendations = [];

    // TypeScript建议
    if (!this.reportData.sections.typescript.passed) {
      recommendations.push({
        type: 'critical',
        title: '修复TypeScript编译错误',
        description: `发现 ${this.reportData.sections.typescript.errors} 个TypeScript编译错误，需要立即修复`,
        actions: [
          '检查类型定义是否完整',
          '确保导入路径正确',
          '修复类型不匹配问题'
        ],
        impact: 'high'
      });
    }

    // ESLint建议
    if (this.reportData.sections.eslint.errors > 0) {
      recommendations.push({
        type: 'high',
        title: '修复ESLint错误',
        description: `发现 ${this.reportData.sections.eslint.errors} 个ESLint错误，影响代码质量`,
        actions: [
          '运行 `pnpm run lint:fix` 自动修复',
          '手动修复剩余问题',
          '配置ESLint规则以适应项目需求'
        ],
        impact: 'medium'
      });
    }

    // 覆盖率建议
    if (this.reportData.sections.coverage.percentage < 90) {
      recommendations.push({
        type: 'medium',
        title: '提高类型覆盖率',
        description: `当前类型覆盖率 ${this.reportData.sections.coverage.percentage}%，目标 90%`,
        actions: [
          '为函数参数和返回值添加类型',
          '使用接口定义对象结构',
          '避免使用 `any` 类型'
        ],
        impact: 'medium'
      });
    }

    // 性能建议
    if (this.reportData.sections.performance.typeCheckTime > 30000) {
      recommendations.push({
        type: 'medium',
        title: '优化TypeScript编译性能',
        description: `TypeScript编译时间过长 (${(this.reportData.sections.performance.typeCheckTime / 1000).toFixed(1)}s)`,
        actions: [
          '启用增量编译',
          '优化tsconfig.json配置',
          '检查项目结构是否合理'
        ],
        impact: 'low'
      });
    }

    this.reportData.recommendations = recommendations;
    console.log(`✅ 生成了 ${recommendations.length} 条建议\n`);
  }

  /**
   * 渲染报告
   */
  async renderReport() {
    console.log('🎨 渲染报告...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `type-safety-report-${timestamp}`;

    switch (this.options.format) {
      case 'html':
        await this.renderHTMLReport(fileName);
        break;
      case 'markdown':
        await this.renderMarkdownReport(fileName);
        break;
      case 'json':
        await this.renderJSONReport(fileName);
        break;
      default:
        await this.renderHTMLReport(fileName);
    }

    console.log('✅ 报告渲染完成\n');
  }

  /**
   * 渲染HTML报告
   */
  async renderHTMLReport(fileName) {
    const htmlContent = this.generateHTMLReport();
    const filePath = join(this.options.outputDir, `${fileName}.html`);
    writeFileSync(filePath, htmlContent);

    // 生成图表数据
    if (this.options.includeCharts) {
      this.generateChartFiles();
    }
  }

  /**
   * 渲染Markdown报告
   */
  async renderMarkdownReport(fileName) {
    const markdownContent = this.generateMarkdownReport();
    const filePath = join(this.options.outputDir, `${fileName}.md`);
    writeFileSync(filePath, markdownContent);
  }

  /**
   * 渲染JSON报告
   */
  async renderJSONReport(fileName) {
    const filePath = join(this.options.outputDir, `${fileName}.json`);
    writeFileSync(filePath, JSON.stringify(this.reportData, null, 2));
  }

  /**
   * 生成HTML报告
   */
  generateHTMLReport() {
    const { metadata, summary, sections, recommendations } = this.reportData;

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Type Safety Report - ${metadata.project}</title>
    <style>
        ${this.getReportCSS()}
    </style>
</head>
<body>
    <div class="report-container">
        <header class="report-header">
            <h1>类型安全检查报告</h1>
            <div class="report-meta">
                <p><strong>项目:</strong> ${metadata.project}</p>
                <p><strong>生成时间:</strong> ${new Date(metadata.timestamp).toLocaleString('zh-CN')}</p>
                <p><strong>版本:</strong> ${metadata.version}</p>
            </div>
        </header>

        <section class="summary-section">
            <h2>📊 总体摘要</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>总体评分</h3>
                    <div class="score ${summary.grade}">${summary.overall}/100</div>
                    <div class="grade">${summary.grade}</div>
                </div>
                <div class="summary-card">
                    <h3>检查状态</h3>
                    <div class="status ${summary.passed ? 'passed' : 'failed'}">
                        ${summary.passed ? '✅ 通过' : '❌ 失败'}
                    </div>
                </div>
                <div class="summary-card">
                    <h3>问题统计</h3>
                    <div class="issues">
                        <span class="issue critical">严重: ${summary.issues.critical}</span>
                        <span class="issue high">高: ${summary.issues.high}</span>
                        <span class="issue medium">中: ${summary.issues.medium}</span>
                        <span class="issue low">低: ${summary.issues.low}</span>
                    </div>
                </div>
                <div class="summary-card">
                    <h3>变更情况</h3>
                    <div class="changes">
                        <div>改进: ${summary.improvements}</div>
                        <div>退化: ${summary.regressions}</div>
                    </div>
                </div>
            </div>
        </section>

        <section class="details-section">
            <h2>🔍 详细检查结果</h2>

            <div class="check-item">
                <h3>TypeScript 编译</h3>
                <div class="check-status ${sections.typescript.passed ? 'passed' : 'failed'}">
                    ${sections.typescript.passed ? '✅ 通过' : '❌ 失败'}
                </div>
                <div class="check-details">
                    <p>错误: ${sections.typescript.errors}</p>
                    <p>耗时: ${(sections.typescript.duration / 1000).toFixed(2)}s</p>
                </div>
            </div>

            <div class="check-item">
                <h3>ESLint 检查</h3>
                <div class="check-status ${sections.eslint.passed ? 'passed' : 'failed'}">
                    ${sections.eslint.passed ? '✅ 通过' : '❌ 失败'}
                </div>
                <div class="check-details">
                    <p>错误: ${sections.eslint.errors}</p>
                    <p>警告: ${sections.eslint.warnings}</p>
                    <p>耗时: ${(sections.eslint.duration / 1000).toFixed(2)}s</p>
                </div>
            </div>

            <div class="check-item">
                <h3>类型覆盖率</h3>
                <div class="check-status ${sections.coverage.passed ? 'passed' : 'failed'}">
                    ${sections.coverage.passed ? '✅ 通过' : '❌ 失败'}
                </div>
                <div class="check-details">
                    <p>覆盖率: ${sections.coverage.percentage}%</p>
                    <p>目标: ${sections.coverage.target}%</p>
                </div>
            </div>

            <div class="check-item">
                <h3>回归测试</h3>
                <div class="check-status ${sections.regression.passed ? 'passed' : 'failed'}">
                    ${sections.regression.passed ? '✅ 通过' : '❌ 失败'}
                </div>
                <div class="check-details">
                    <p>破坏性变更: ${sections.regression.breakingChanges}</p>
                    <p>总变更数: ${sections.regression.totalChanges}</p>
                </div>
            </div>
        </section>

        ${recommendations.length > 0 ? `
        <section class="recommendations-section">
            <h2>💡 改进建议</h2>
            <div class="recommendations">
                ${recommendations.map(rec => `
                    <div class="recommendation ${rec.type}">
                        <h3>${rec.title}</h3>
                        <p>${rec.description}</p>
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                        <div class="impact">影响程度: ${rec.impact}</div>
                    </div>
                `).join('')}
            </div>
        </section>
        ` : ''}

        <footer class="report-footer">
            <p>报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            <p>生成工具: Type Safety Reporter v${metadata.version}</p>
        </footer>
    </div>
</body>
</html>
    `;
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport() {
    const { metadata, summary, sections, recommendations } = this.reportData;

    let markdown = `# 类型安全检查报告\n\n`;
    markdown += `**项目**: ${metadata.project}\n`;
    markdown += `**生成时间**: ${new Date(metadata.timestamp).toLocaleString('zh-CN')}\n`;
    markdown += `**版本**: ${metadata.version}\n\n`;

    markdown += `## 📊 总体摘要\n\n`;
    markdown += `- **总体评分**: ${summary.overall}/100 (${summary.grade})\n`;
    markdown += `- **检查状态**: ${summary.passed ? '✅ 通过' : '❌ 失败'}\n`;
    markdown += `- **问题统计**: 严重(${summary.issues.critical}) 高(${summary.issues.high}) 中(${summary.issues.medium}) 低(${summary.issues.low})\n`;
    markdown += `- **变更情况**: 改进(${summary.improvements}) 退化(${summary.regressions})\n\n`;

    markdown += `## 🔍 详细检查结果\n\n`;

    markdown += `### TypeScript 编译\n`;
    markdown += `- **状态**: ${sections.typescript.passed ? '✅ 通过' : '❌ 失败'}\n`;
    markdown += `- **错误数**: ${sections.typescript.errors}\n`;
    markdown += `- **耗时**: ${(sections.typescript.duration / 1000).toFixed(2)}s\n\n`;

    markdown += `### ESLint 检查\n`;
    markdown += `- **状态**: ${sections.eslint.passed ? '✅ 通过' : '❌ 失败'}\n`;
    markdown += `- **错误数**: ${sections.eslint.errors}\n`;
    markdown += `- **警告数**: ${sections.eslint.warnings}\n`;
    markdown += `- **耗时**: ${(sections.eslint.duration / 1000).toFixed(2)}s\n\n`;

    markdown += `### 类型覆盖率\n`;
    markdown += `- **状态**: ${sections.coverage.passed ? '✅ 通过' : '❌ 失败'}\n`;
    markdown += `- **覆盖率**: ${sections.coverage.percentage}%\n`;
    markdown += `- **目标**: ${sections.coverage.target}%\n\n`;

    markdown += `### 回归测试\n`;
    markdown += `- **状态**: ${sections.regression.passed ? '✅ 通过' : '❌ 失败'}\n`;
    markdown += `- **破坏性变更**: ${sections.regression.breakingChanges}\n`;
    markdown += `- **总变更数**: ${sections.regression.totalChanges}\n\n`;

    if (recommendations.length > 0) {
      markdown += `## 💡 改进建议\n\n`;
      recommendations.forEach((rec, index) => {
        markdown += `### ${index + 1}. ${rec.title}\n`;
        markdown += `**类型**: ${rec.type}\n`;
        markdown += `**描述**: ${rec.description}\n`;
        markdown += `**影响程度**: ${rec.impact}\n\n`;
        markdown += `**建议操作**:\n`;
        rec.actions.forEach(action => {
          markdown += `- ${action}\n`;
        });
        markdown += `\n`;
      });
    }

    return markdown;
  }

  /**
   * 获取报告CSS
   */
  getReportCSS() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f8fafc;
      }

      .report-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .report-header {
        text-align: center;
        margin-bottom: 3rem;
        padding: 2rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .report-header h1 {
        font-size: 2.5rem;
        margin-bottom: 1rem;
        color: #1f2937;
      }

      .report-meta {
        display: flex;
        justify-content: center;
        gap: 2rem;
        color: #6b7280;
      }

      .summary-section {
        margin-bottom: 3rem;
      }

      .summary-section h2 {
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
        color: #1f2937;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
      }

      .summary-card {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
      }

      .summary-card h3 {
        margin-bottom: 1rem;
        color: #6b7280;
      }

      .score {
        font-size: 3rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .score.A { color: #10b981; }
      .score.B { color: #3b82f6; }
      .score.C { color: #f59e0b; }
      .score.F { color: #ef4444; }

      .status {
        font-size: 1.5rem;
        font-weight: bold;
      }

      .status.passed { color: #10b981; }
      .status.failed { color: #ef4444; }

      .issues {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .issue {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
      }

      .issue.critical { background: #fecaca; color: #dc2626; }
      .issue.high { background: #fed7aa; color: #ea580c; }
      .issue.medium { background: #fef3c7; color: #d97706; }
      .issue.low { background: #dbeafe; color: #2563eb; }

      .details-section h2 {
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
        color: #1f2937;
      }

      .check-item {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 1rem;
      }

      .check-item h3 {
        margin-bottom: 1rem;
        color: #1f2937;
      }

      .check-status {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .check-status.passed { background: #d1fae5; color: #065f46; }
      .check-status.failed { background: #fee2e2; color: #991b1b; }

      .check-details {
        color: #6b7280;
      }

      .recommendations-section h2 {
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
        color: #1f2937;
      }

      .recommendation {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 1rem;
        border-left: 4px solid #3b82f6;
      }

      .recommendation.critical { border-left-color: #ef4444; }
      .recommendation.high { border-left-color: #f59e0b; }
      .recommendation.medium { border-left-color: #3b82f6; }

      .recommendation h3 {
        margin-bottom: 0.5rem;
        color: #1f2937;
      }

      .recommendation ul {
        margin: 1rem 0;
        padding-left: 1.5rem;
      }

      .impact {
        font-weight: bold;
        color: #6b7280;
      }

      .report-footer {
        margin-top: 3rem;
        padding: 1.5rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
        color: #6b7280;
      }

      @media (max-width: 768px) {
        .report-container {
          padding: 1rem;
        }

        .summary-grid {
          grid-template-columns: 1fr;
        }

        .report-meta {
          flex-direction: column;
          gap: 0.5rem;
        }
      }
    `;
  }

  /**
   * 生成图表文件
   */
  generateChartFiles() {
    const chartsDir = join(this.options.outputDir, 'charts');

    // 覆盖率趋势图
    const coverageData = this.reportData.sections.trends.data.map(point => ({
      date: new Date(point.timestamp).toLocaleDateString('zh-CN'),
      coverage: point.coverage
    }));

    writeFileSync(
      join(chartsDir, 'coverage-trend.json'),
      JSON.stringify(coverageData, null, 2)
    );

    // 问题分布图
    const issueData = [
      { name: '严重', value: this.reportData.summary.issues.critical },
      { name: '高', value: this.reportData.summary.issues.high },
      { name: '中', value: this.reportData.summary.issues.medium },
      { name: '低', value: this.reportData.summary.issues.low }
    ];

    writeFileSync(
      join(chartsDir, 'issue-distribution.json'),
      JSON.stringify(issueData, null, 2)
    );
  }

  /**
   * 发送通知
   */
  async sendNotifications() {
    console.log('📤 发送通知...');

    // 发送邮件通知
    if (this.options.emailRecipients.length > 0) {
      await this.sendEmailNotification();
    }

    // 发送Slack通知
    if (this.options.slackWebhook) {
      await this.sendSlackNotification();
    }

    console.log('✅ 通知发送完成\n');
  }

  /**
   * 发送邮件通知
   */
  async sendEmailNotification() {
    // 这里应该实现实际的邮件发送逻辑
    console.log(`📧 将发送邮件通知给: ${this.options.emailRecipients.join(', ')}`);
  }

  /**
   * 发送Slack通知
   */
  async sendSlackNotification() {
    // 这里应该实现实际的Slack通知逻辑
    console.log('💬 将发送Slack通知');
  }

  /**
   * 获取报告路径
   */
  getReportPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `type-safety-report-${timestamp}.${this.options.format}`;
    return join(this.options.outputDir, fileName);
  }

  // 辅助方法
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
          message: message.trim()
        });
      }
    }

    return errors;
  }

  parseFileCoverage(output) {
    const files = {};
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('src/') && line.includes('%')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const coverage = parseFloat(parts[parts.length - 1].replace('%', ''));
          const filePath = parts.slice(0, -1).join(' ');
          files[filePath] = coverage;
        }
      }
    }

    return files;
  }

  getBundleSize() {
    const distPath = join(process.cwd(), 'dist');
    if (existsSync(distPath)) {
      try {
        const output = execSync(`du -sh ${distPath}`, { encoding: 'utf8' });
        return output.split('\t')[0];
      } catch (error) {
        return 'N/A';
      }
    }
    return 'N/A';
  }

  calculateWeeklyTrend(trends) {
    if (trends.length < 14) return 0;

    const recent = trends.slice(-7);
    const previous = trends.slice(-14, -7);

    const recentAvg = recent.reduce((sum, p) => sum + p.coverage, 0) / recent.length;
    const previousAvg = previous.reduce((sum, p) => sum + p.coverage, 0) / previous.length;

    return recentAvg - previousAvg;
  }

  calculateMonthlyTrend(trends) {
    if (trends.length < 30) return 0;

    const recent = trends.slice(-30);
    const previous = trends.slice(-60, -30);

    const recentAvg = recent.reduce((sum, p) => sum + p.coverage, 0) / recent.length;
    const previousAvg = previous.reduce((sum, p) => sum + p.coverage, 0) / previous.length;

    return recentAvg - previousAvg;
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
      case '--format':
        options.format = args[++i];
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--no-charts':
        options.includeCharts = false;
        break;
      case '--no-details':
        options.includeDetails = false;
        break;
      case '--email':
        options.emailRecipients = args[++i].split(',');
        break;
      case '--slack':
        options.slackWebhook = args[++i];
        break;
      case '--help':
        console.log(`
类型安全报告生成器

用法: node type-safety-reporter.js [选项]

选项:
  --format <format>       报告格式 (html|markdown|json) (默认: html)
  --output <dir>          输出目录 (默认: ./type-safety-reports)
  --no-charts             不生成图表
  --no-details            不包含详细信息
  --email <emails>        发送邮件通知 (逗号分隔)
  --slack <webhook>       发送Slack通知
  --help                  显示帮助信息

示例:
  node type-safety-reporter.js
  node type-safety-reporter.js --format markdown --output ./reports
  node type-safety-reporter.js --email team@example.com --slack https://hooks.slack.com/...
        `);
        process.exit(0);
    }
  }

  const reporter = new TypeSafetyReporter(options);
  reporter.generateReport();
}

module.exports = TypeSafetyReporter;