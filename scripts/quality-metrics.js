#!/usr/bin/env node

/**
 * 质量度量脚本
 * 收集和分析项目质量指标，生成详细的报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class QualityMetrics {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.metrics = {
      timestamp: new Date().toISOString(),
      typescript: {},
      eslint: {},
      testing: {},
      coverage: {},
      security: {},
      performance: {},
      complexity: {}
    };
  }

  /**
   * 收集TypeScript指标
   */
  collectTypeScriptMetrics() {
    console.log('📊 收集TypeScript指标...');

    try {
      // 检查TypeScript编译错误
      const typeCheckResult = execSync('pnpm run type-check 2>&1', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      this.metrics.typescript = {
        status: 'pass',
        errors: 0,
        compiled: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorOutput = error.stdout || error.stderr || '';
      const errorLines = errorOutput.split('\n').filter(line => line.trim());

      this.metrics.typescript = {
        status: 'fail',
        errors: errorLines.length,
        errorDetails: errorLines.slice(0, 10), // 保留前10个错误
        compiled: false,
        timestamp: new Date().toISOString()
      };
    }

    // 收集tsconfig配置信息
    const tsconfigPath = path.join(this.projectRoot, 'frontend/tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      this.metrics.typescript.strictMode = tsconfig.compilerOptions?.strict || false;
      this.metrics.typescript.noUnusedLocals = tsconfig.compilerOptions?.noUnusedLocals || false;
      this.metrics.typescript.noUnusedParameters = tsconfig.compilerOptions?.noUnusedParameters || false;
    }

    console.log(`✅ TypeScript指标收集完成 - 状态: ${this.metrics.typescript.status}`);
  }

  /**
   * 收集ESLint指标
   */
  collectESLintMetrics() {
    console.log('🔍 收集ESLint指标...');

    try {
      // 运行ESLint并获取JSON输出
      const eslintResult = execSync('ESLINT_DEV=true npx eslint src/**/*.{ts,tsx} --format=json 2>/dev/null', {
        encoding: 'utf8',
        cwd: path.join(this.projectRoot, 'frontend')
      });

      const eslintIssues = JSON.parse(eslintResult || '[]');

      // 统计错误类型
      const errorStats = {
        total: eslintIssues.length,
        errors: eslintIssues.filter(issue => issue.severity === 2).length,
        warnings: eslintIssues.filter(issue => issue.severity === 1).length,
        byRule: {},
        byFile: {}
      };

      // 按规则分类统计
      eslintIssues.forEach(issue => {
        if (!errorStats.byRule[issue.ruleId]) {
          errorStats.byRule[issue.ruleId] = { count: 0, severity: issue.severity };
        }
        errorStats.byRule[issue.ruleId].count++;

        if (!errorStats.byFile[issue.filePath]) {
          errorStats.byFile[issue.filePath] = { count: 0, errors: 0, warnings: 0 };
        }
        errorStats.byFile[issue.filePath].count++;
        if (issue.severity === 2) {
          errorStats.byFile[issue.filePath].errors++;
        } else {
          errorStats.byFile[issue.filePath].warnings++;
        }
      });

      this.metrics.eslint = {
        ...errorStats,
        status: errorStats.errors === 0 ? 'pass' : 'fail',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.eslint = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    console.log(`✅ ESLint指标收集完成 - 错误: ${this.metrics.eslint.errors || 0}, 警告: ${this.metrics.eslint.warnings || 0}`);
  }

  /**
   * 收集测试指标
   */
  collectTestingMetrics() {
    console.log('🧪 收集测试指标...');

    // 前端测试指标
    try {
      const frontendTestResult = execSync('cd frontend && npm run test -- --run --coverage --watchAll=false --passWithNoTests 2>&1', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const testStats = this.parseTestOutput(frontendTestResult);
      this.metrics.testing.frontend = {
        ...testStats,
        status: testStats.failed === 0 ? 'pass' : 'fail',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const testStats = this.parseTestOutput(error.stdout || error.stderr || '');
      this.metrics.testing.frontend = {
        ...testStats,
        status: 'fail',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    // 后端测试指标
    try {
      const backendTestResult = execSync('pnpm run backend:test 2>&1', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const backendTestStats = this.parseTestOutput(backendTestResult);
      this.metrics.testing.backend = {
        ...backendTestStats,
        status: backendTestStats.failed === 0 ? 'pass' : 'fail',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const backendTestStats = this.parseTestOutput(error.stdout || error.stderr || '');
      this.metrics.testing.backend = {
        ...backendTestStats,
        status: 'fail',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    console.log(`✅ 测试指标收集完成`);
  }

  /**
   * 收集测试覆盖率指标
   */
  collectCoverageMetrics() {
    console.log('📈 收集测试覆盖率指标...');

    // 前端覆盖率
    const frontendCoveragePath = path.join(this.projectRoot, 'frontend/coverage/coverage-summary.json');
    if (fs.existsSync(frontendCoveragePath)) {
      try {
        const coverageData = JSON.parse(fs.readFileSync(frontendCoveragePath, 'utf8'));
        this.metrics.coverage.frontend = {
          lines: coverageData.total.lines.pct,
          functions: coverageData.total.functions.pct,
          branches: coverageData.total.branches.pct,
          statements: coverageData.total.statements.pct,
          status: this.getCoverageStatus(coverageData.total.lines.pct),
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.warn('⚠️ 无法解析前端覆盖率数据:', error.message);
      }
    }

    // 后端覆盖率
    const backendCoveragePath = path.join(this.projectRoot, 'backend/coverage/coverage-summary.json');
    if (fs.existsSync(backendCoveragePath)) {
      try {
        const backendCoverageData = JSON.parse(fs.readFileSync(backendCoveragePath, 'utf8'));
        this.metrics.coverage.backend = {
          lines: backendCoverageData.total.lines.pct,
          functions: backendCoverageData.total.functions.pct,
          branches: backendCoverageData.total.branches.pct,
          statements: backendCoverageData.total.statements.pct,
          status: this.getCoverageStatus(backendCoverageData.total.lines.pct),
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.warn('⚠️ 无法解析后端覆盖率数据:', error.message);
      }
    }

    console.log(`✅ 覆盖率指标收集完成`);
  }

  /**
   * 收集安全指标
   */
  collectSecurityMetrics() {
    console.log('🛡️ 收集安全指标...');

    try {
      // 运行安全审计
      const auditResult = execSync('pnpm audit --json 2>/dev/null', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const auditData = JSON.parse(auditResult);
      const vulnerabilities = auditData.vulnerabilities || [];

      const securityStats = {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
        info: vulnerabilities.filter(v => v.severity === 'info').length,
        status: 'pass',
        timestamp: new Date().toISOString()
      };

      // 如果有critical或high漏洞，状态为fail
      if (securityStats.critical > 0 || securityStats.high > 0) {
        securityStats.status = 'fail';
      }

      this.metrics.security = securityStats;
    } catch (error) {
      this.metrics.security = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    console.log(`✅ 安全指标收集完成 - 严重漏洞: ${this.metrics.security.critical || 0}`);
  }

  /**
   * 收集复杂度指标
   */
  collectComplexityMetrics() {
    console.log('🏗️ 收集代码复杂度指标...');

    try {
      // 统计文件数量和代码行数
      const frontendStats = this.getDirectoryStats(path.join(this.projectRoot, 'frontend/src'));
      const backendStats = this.getDirectoryStats(path.join(this.projectRoot, 'backend/src'));

      this.metrics.complexity = {
        frontend: {
          files: frontendStats.files,
          lines: frontendStats.lines,
          directories: frontendStats.directories,
          avgLinesPerFile: frontendStats.files > 0 ? Math.round(frontendStats.lines / frontendStats.files) : 0
        },
        backend: {
          files: backendStats.files,
          lines: backendStats.lines,
          directories: backendStats.directories,
          avgLinesPerFile: backendStats.files > 0 ? Math.round(backendStats.lines / backendStats.files) : 0
        },
        total: {
          files: frontendStats.files + backendStats.files,
          lines: frontendStats.lines + backendStats.lines,
          directories: frontendStats.directories + backendStats.directories
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.complexity = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    console.log(`✅ 复杂度指标收集完成 - 总文件数: ${this.metrics.complexity.total?.files || 0}`);
  }

  /**
   * 解析测试输出
   */
  parseTestOutput(output) {
    const lines = output.split('\n');
    const testStats = {
      suites: 0,
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      time: 0
    };

    lines.forEach(line => {
      // Jest输出格式
      const jestMatch = line.match(/Test Suites:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/);
      if (jestMatch) {
        testStats.suites = parseInt(jestMatch[1]) + parseInt(jestMatch[2]);
      }

      const testMatch = line.match(/Tests:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/);
      if (testMatch) {
        testStats.tests = parseInt(testMatch[1]) + parseInt(testMatch[2]);
        testStats.failed = parseInt(testMatch[1]);
        testStats.passed = parseInt(testMatch[2]);
      }

      const timeMatch = line.match(/Time:\s*(\d+(?:\.\d+)?)\s*s/);
      if (timeMatch) {
        testStats.time = parseFloat(timeMatch[1]);
      }

      // Vitest输出格式
      const vitestMatch = line.match(/✓\s*(\d+)\s*✗\s*(\d+)\s*⏸\s*(\d+)/);
      if (vitestMatch) {
        testStats.passed = parseInt(vitestMatch[1]);
        testStats.failed = parseInt(vitestMatch[2]);
        testStats.skipped = parseInt(vitestMatch[3]);
        testStats.tests = testStats.passed + testStats.failed + testStats.skipped;
      }
    });

    return testStats;
  }

  /**
   * 获取目录统计信息
   */
  getDirectoryStats(dirPath) {
    let files = 0;
    let lines = 0;
    let directories = 0;

    if (!fs.existsSync(dirPath)) {
      return { files: 0, lines: 0, directories: 0 };
    }

    const traverse = (currentPath) => {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          directories++;
          traverse(itemPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
          files++;
          try {
            const content = fs.readFileSync(itemPath, 'utf8');
            lines += content.split('\n').length;
          } catch (error) {
            // 忽略读取错误的文件
          }
        }
      }
    };

    traverse(dirPath);
    return { files, lines, directories };
  }

  /**
   * 获取覆盖率状态
   */
  getCoverageStatus(coverage) {
    if (coverage >= 80) return 'excellent';
    if (coverage >= 60) return 'good';
    if (coverage >= 40) return 'acceptable';
    return 'needs-improvement';
  }

  /**
   * 生成质量报告
   */
  generateReport() {
    console.log('📝 生成质量报告...');

    const report = {
      summary: this.generateSummary(),
      metrics: this.metrics,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };

    // 保存JSON报告
    const reportPath = path.join(this.projectRoot, 'quality-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON报告已保存: ${reportPath}`);

    // 生成Markdown报告
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(this.projectRoot, 'QUALITY_REPORT.md');
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`✅ Markdown报告已保存: ${markdownPath}`);

    return report;
  }

  /**
   * 生成质量摘要
   */
  generateSummary() {
    const summary = {
      overall: 'good',
      score: 0,
      issues: [],
      strengths: []
    };

    // 计算各部分得分
    const scores = {
      typescript: this.metrics.typescript.status === 'pass' ? 20 : 0,
      eslint: this.metrics.eslint.status === 'pass' ? 20 : 0,
      testing: this.calculateTestingScore(),
      coverage: this.calculateCoverageScore(),
      security: this.metrics.security.status === 'pass' ? 20 : 0
    };

    summary.score = Object.values(scores).reduce((a, b) => a + b, 0);

    // 确定总体状态
    if (summary.score >= 90) {
      summary.overall = 'excellent';
    } else if (summary.score >= 70) {
      summary.overall = 'good';
    } else if (summary.score >= 50) {
      summary.overall = 'acceptable';
    } else {
      summary.overall = 'needs-improvement';
    }

    // 识别问题和优势
    if (this.metrics.typescript.status !== 'pass') {
      summary.issues.push(`TypeScript编译失败 (${this.metrics.typescript.errors}个错误)`);
    }

    if (this.metrics.eslint.errors > 0) {
      summary.issues.push(`ESLint错误 (${this.metrics.eslint.errors}个错误)`);
    }

    if (this.metrics.security.critical > 0) {
      summary.issues.push(`严重安全漏洞 (${this.metrics.security.critical}个)`);
    }

    if (this.metrics.typescript.status === 'pass') {
      summary.strengths.push('TypeScript编译通过');
    }

    if (this.metrics.eslint.errors === 0) {
      summary.strengths.push('ESLint检查通过');
    }

    if (this.metrics.security.critical === 0 && this.metrics.security.high === 0) {
      summary.strengths.push('无严重安全漏洞');
    }

    return summary;
  }

  /**
   * 计算测试得分
   */
  calculateTestingScore() {
    let score = 0;
    const maxScore = 20;

    if (this.metrics.testing.frontend?.status === 'pass') score += 10;
    if (this.metrics.testing.backend?.status === 'pass') score += 10;

    return score;
  }

  /**
   * 计算覆盖率得分
   */
  calculateCoverageScore() {
    let score = 0;
    const maxScore = 20;

    const frontendCoverage = this.metrics.coverage.frontend?.lines || 0;
    const backendCoverage = this.metrics.coverage.backend?.lines || 0;
    const avgCoverage = (frontendCoverage + backendCoverage) / 2;

    if (avgCoverage >= 80) score = 20;
    else if (avgCoverage >= 60) score = 15;
    else if (avgCoverage >= 40) score = 10;
    else if (avgCoverage >= 20) score = 5;

    return score;
  }

  /**
   * 生成改进建议
   */
  generateRecommendations() {
    const recommendations = [];

    // TypeScript建议
    if (this.metrics.typescript.status !== 'pass') {
      recommendations.push({
        category: 'TypeScript',
        priority: 'high',
        description: '修复TypeScript编译错误',
        action: '运行 `pnpm run type-check` 查看详细错误信息并逐一修复'
      });
    }

    // ESLint建议
    if (this.metrics.eslint.errors > 0) {
      recommendations.push({
        category: 'Code Quality',
        priority: 'high',
        description: '修复ESLint错误',
        action: `运行 \`pnpm run lint:fix\` 自动修复可修复的问题，其余问题手动修复`
      });
    }

    // 测试建议
    const frontendTests = this.metrics.testing.frontend;
    const backendTests = this.metrics.testing.backend;

    if (frontendTests?.failed > 0) {
      recommendations.push({
        category: 'Testing',
        priority: 'medium',
        description: '修复失败的测试',
        action: `前端有${frontendTests.failed}个失败测试，检查测试日志并修复`
      });
    }

    if (backendTests?.failed > 0) {
      recommendations.push({
        category: 'Testing',
        priority: 'medium',
        description: '修复失败的测试',
        action: `后端有${backendTests.failed}个失败测试，检查测试日志并修复`
      });
    }

    // 覆盖率建议
    const frontendCoverage = this.metrics.coverage.frontend?.lines || 0;
    const backendCoverage = this.metrics.coverage.backend?.lines || 0;

    if (frontendCoverage < 60) {
      recommendations.push({
        category: 'Coverage',
        priority: 'medium',
        description: '提高前端测试覆盖率',
        action: `当前覆盖率${frontendCoverage}%，建议添加更多测试用例达到60%以上`
      });
    }

    if (backendCoverage < 60) {
      recommendations.push({
        category: 'Coverage',
        priority: 'medium',
        description: '提高后端测试覆盖率',
        action: `当前覆盖率${backendCoverage}%，建议添加更多测试用例达到60%以上`
      });
    }

    // 安全建议
    if (this.metrics.security.critical > 0 || this.metrics.security.high > 0) {
      recommendations.push({
        category: 'Security',
        priority: 'high',
        description: '修复安全漏洞',
        action: `存在${this.metrics.security.critical}个严重和${this.metrics.security.high}个高危漏洞，立即修复`
      });
    }

    return recommendations;
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport(report) {
    const { summary, metrics, recommendations } = report;

    return `# LLMChat 项目质量报告

## 📊 质量摘要

**总体评分**: ${summary.score}/100
**总体状态**: ${summary.overall.toUpperCase()}

### ✅ 项目优势
${summary.strengths.map(strength => `- ${strength}`).join('\n') || '- 无显著优势'}

### ⚠️ 需要改进
${summary.issues.map(issue => `- ${issue}`).join('\n') || '- 无明显问题'}

---

## 🔍 详细指标

### TypeScript 编译
- **状态**: ${metrics.typescript.status.toUpperCase()}
- **错误数**: ${metrics.typescript.errors || 0}
- **严格模式**: ${metrics.typescript.strictMode ? '✅ 启用' : '❌ 未启用'}

### ESLint 代码质量
- **状态**: ${metrics.eslint.status.toUpperCase()}
- **错误**: ${metrics.eslint.errors || 0}
- **警告**: ${metrics.eslint.warnings || 0}
- **总问题数**: ${metrics.eslint.total || 0}

### 测试结果
#### 前端测试
- **状态**: ${metrics.testing.frontend?.status.toUpperCase() || 'N/A'}
- **通过**: ${metrics.testing.frontend?.passed || 0}
- **失败**: ${metrics.testing.frontend?.failed || 0}
- **跳过**: ${metrics.testing.frontend?.skipped || 0}

#### 后端测试
- **状态**: ${metrics.testing.backend?.status.toUpperCase() || 'N/A'}
- **通过**: ${metrics.testing.backend?.passed || 0}
- **失败**: ${metrics.testing.backend?.failed || 0}
- **跳过**: ${metrics.testing.backend?.skipped || 0}

### 测试覆盖率
#### 前端覆盖率
- **行覆盖率**: ${metrics.coverage.frontend?.lines || 0}%
- **函数覆盖率**: ${metrics.coverage.frontend?.functions || 0}%
- **分支覆盖率**: ${metrics.coverage.frontend?.branches || 0}%
- **状态**: ${metrics.coverage.frontend?.status?.toUpperCase() || 'N/A'}

#### 后端覆盖率
- **行覆盖率**: ${metrics.coverage.backend?.lines || 0}%
- **函数覆盖率**: ${metrics.coverage.backend?.functions || 0}%
- **分支覆盖率**: ${metrics.coverage.backend?.branches || 0}%
- **状态**: ${metrics.coverage.backend?.status?.toUpperCase() || 'N/A'}

### 安全审计
- **状态**: ${metrics.security.status.toUpperCase()}
- **严重漏洞**: ${metrics.security.critical || 0}
- **高危漏洞**: ${metrics.security.high || 0}
- **中危漏洞**: ${metrics.security.moderate || 0}
- **低危漏洞**: ${metrics.security.low || 0}

### 代码复杂度
- **总文件数**: ${metrics.complexity.total?.files || 0}
- **总代码行数**: ${metrics.complexity.total?.lines || 0}
- **前端文件**: ${metrics.complexity.frontend?.files || 0}
- **后端文件**: ${metrics.complexity.backend?.files || 0}

---

## 🎯 改进建议

${recommendations.map(rec => `
### ${rec.category} (${rec.priority.toUpperCase()})
**问题**: ${rec.description}
**建议**: ${rec.action}
`).join('\n')}

---

## 📈 质量趋势

*此报告由自动化质量检查工具生成*
*生成时间: ${new Date().toLocaleString()}*
`;
  }

  /**
   * 运行完整度量流程
   */
  async run() {
    console.log('🚀 开始质量度量分析...\n');

    this.collectTypeScriptMetrics();
    this.collectESLintMetrics();
    this.collectTestingMetrics();
    this.collectCoverageMetrics();
    this.collectSecurityMetrics();
    this.collectComplexityMetrics();

    console.log('\n📊 生成质量报告...');
    const report = this.generateReport();

    console.log('\n✅ 质量度量完成!');
    console.log(`📈 总体评分: ${report.summary.score}/100`);
    console.log(`🎯 总体状态: ${report.summary.overall.toUpperCase()}`);

    if (report.summary.issues.length > 0) {
      console.log(`⚠️ 发现 ${report.summary.issues.length} 个问题需要解决`);
    }

    return report;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const metrics = new QualityMetrics();
  metrics.run().catch(error => {
    console.error('❌ 质量度量失败:', error);
    process.exit(1);
  });
}

module.exports = QualityMetrics;