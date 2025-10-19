#!/usr/bin/env node

/**
 * Enterprise Quality Scoring System
 * 企业级质量评分系统
 *
 * 功能：
 * - 综合代码质量评分
 * - 多维度质量指标分析
 * - 趋势分析和预警
 * - 自动化质量报告生成
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EnterpriseQualityScorer {
  constructor(options = {}) {
    this.options = {
      configPath: options.configPath || '.quality-thresholds.json',
      outputPath: options.outputPath || 'quality-reports',
      format: options.format || 'json',
      environment: options.environment || 'development',
      verbose: options.verbose || false,
      ...options
    };

    this.config = this.loadConfig();
    this.metrics = {};
    this.scores = {};
    this.alerts = [];
  }

  /**
   * 加载质量门禁配置
   */
  loadConfig() {
    try {
      const configPath = path.resolve(this.options.configPath);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.log('✅ 配置文件加载成功:', configPath);
        return config;
      } else {
        this.log('⚠️ 配置文件不存在，使用默认配置');
        return this.getDefaultConfig();
      }
    } catch (error) {
      this.log('❌ 配置文件加载失败:', error.message);
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      thresholds: {
        overall_quality: { excellent: 90, good: 80, acceptable: 70, minimum: 60 },
        code_quality: {
          typescript_errors: 0,
          eslint_errors: 0,
          eslint_warnings: 10,
          test_coverage: { statements: 80, branches: 75, functions: 80, lines: 80 }
        },
        security: {
          high_vulnerabilities: 0,
          medium_vulnerabilities: 5,
          low_vulnerabilities: 15
        },
        performance: {
          build_time: 300,
          bundle_size: { backend: '100MB', frontend: '10MB' }
        },
        testing: {
          unit_test_coverage: 80,
          integration_test_coverage: 70,
          e2e_test_coverage: 60
        }
      },
      weights: {
        code_quality: 0.35,
        security: 0.25,
        performance: 0.20,
        testing: 0.15,
        documentation: 0.05
      }
    };
  }

  /**
   * 执行全面质量评分
   */
  async execute() {
    this.log('🚀 开始企业级质量评分分析...');

    try {
      // 确保输出目录存在
      this.ensureDirectory(this.options.outputPath);

      // 1. 代码质量分析
      await this.analyzeCodeQuality();

      // 2. 安全扫描分析
      await this.analyzeSecurity();

      // 3. 性能分析
      await this.analyzePerformance();

      // 4. 测试覆盖率分析
      await this.analyzeTesting();

      // 5. 文档质量分析
      await this.analyzeDocumentation();

      // 6. 计算综合评分
      this.calculateOverallScore();

      // 7. 生成报告
      await this.generateReports();

      // 8. 创建质量趋势数据
      await this.updateQualityTrends();

      this.log('✅ 质量评分分析完成');
      return this.getResults();

    } catch (error) {
      this.log('❌ 质量评分分析失败:', error.message);
      throw error;
    }
  }

  /**
   * 代码质量分析
   */
  async analyzeCodeQuality() {
    this.log('🔍 分析代码质量...');

    const metrics = {
      typescript_errors: 0,
      eslint_errors: 0,
      eslint_warnings: 0,
      prettier_violations: 0,
      complexity_score: 0,
      maintainability_index: 0,
      duplicated_lines: 0,
      test_coverage: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      }
    };

    try {
      // TypeScript 类型检查
      this.log('  📝 运行 TypeScript 类型检查...');
      try {
        execSync('pnpm run type-check', { stdio: 'pipe' });
        metrics.typescript_errors = 0;
      } catch (error) {
        // 解析 TypeScript 错误数量
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        metrics.typescript_errors = this.countErrors(output);
      }

      // ESLint 检查
      this.log('  🔍 运行 ESLint 代码检查...');
      try {
        const eslintOutput = execSync('pnpm run lint --format=json', {
          stdio: 'pipe',
          encoding: 'utf8'
        });

        if (eslintOutput) {
          const eslintResults = JSON.parse(eslintOutput);
          metrics.eslint_errors = eslintResults.filter(r => r.errorCount > 0).length;
          metrics.eslint_warnings = eslintResults.reduce((sum, r) => sum + r.warningCount, 0);
        }
      } catch (error) {
        metrics.eslint_errors = 1; // 假设有错误
      }

      // Prettier 检查
      this.log('  🎨 运行 Prettier 格式检查...');
      try {
        execSync('pnpm run prettier:check', { stdio: 'pipe' });
        metrics.prettier_violations = 0;
      } catch (error) {
        metrics.prettier_violations = 1;
      }

      // 测试覆盖率分析
      this.log('  🧪 分析测试覆盖率...');
      metrics.test_coverage = await this.analyzeTestCoverage();

      this.metrics.code_quality = metrics;
      this.log(`✅ 代码质量分析完成: ${metrics.typescript_errors} TypeScript 错误, ${metrics.eslint_errors} ESLint 错误`);

    } catch (error) {
      this.log('⚠️ 代码质量分析部分失败:', error.message);
      this.metrics.code_quality = metrics;
    }
  }

  /**
   * 安全扫描分析
   */
  async analyzeSecurity() {
    this.log('🔒 分析安全状况...');

    const metrics = {
      high_vulnerabilities: 0,
      medium_vulnerabilities: 0,
      low_vulnerabilities: 0,
      secret_leaks: 0,
      insecure_dependencies: 0,
      security_hotspots: 0
    };

    try {
      // 依赖安全审计
      this.log('  🔍 运行依赖安全审计...');
      try {
        const auditOutput = execSync('pnpm audit --json', {
          stdio: 'pipe',
          encoding: 'utf8'
        });

        if (auditOutput) {
          const auditData = JSON.parse(auditOutput);
          const vulnerabilities = auditData.vulnerabilities || {};

          Object.values(vulnerabilities).forEach(vuln => {
            switch (vuln.severity) {
              case 'high':
              case 'critical':
                metrics.high_vulnerabilities++;
                break;
              case 'moderate':
                metrics.medium_vulnerabilities++;
                break;
              case 'low':
                metrics.low_vulnerabilities++;
                break;
            }
          });
        }
      } catch (error) {
        // audit 可能因为漏洞而失败，尝试解析输出
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        metrics.medium_vulnerabilities = this.countVulnerabilities(output, 'moderate');
        metrics.high_vulnerabilities = this.countVulnerabilities(output, 'high');
      }

      this.metrics.security = metrics;
      this.log(`✅ 安全分析完成: ${metrics.high_vulnerabilities} 高危, ${metrics.medium_vulnerabilities} 中危漏洞`);

    } catch (error) {
      this.log('⚠️ 安全分析失败:', error.message);
      this.metrics.security = metrics;
    }
  }

  /**
   * 性能分析
   */
  async analyzePerformance() {
    this.log('⚡ 分析性能指标...');

    const metrics = {
      build_time: 0,
      bundle_size: {
        backend: '0B',
        frontend: '0B'
      },
      memory_usage: 0,
      api_response_time: 0,
      lighthouse_score: 0
    };

    try {
      // 构建时间分析
      this.log('  🏗️ 测量构建时间...');
      const buildStart = Date.now();
      try {
        execSync('pnpm run build', { stdio: 'pipe' });
        metrics.build_time = Date.now() - buildStart;
      } catch (error) {
        metrics.build_time = Date.now() - buildStart;
      }

      // 分析构建产物大小
      this.log('  📦 分析构建产物大小...');
      if (fs.existsSync('backend/dist')) {
        metrics.bundle_size.backend = this.getDirectorySize('backend/dist');
      }
      if (fs.existsSync('frontend/dist')) {
        metrics.bundle_size.frontend = this.getDirectorySize('frontend/dist');
      }

      this.metrics.performance = metrics;
      this.log(`✅ 性能分析完成: 构建时间 ${metrics.build_time}ms, 前端大小 ${metrics.bundle_size.frontend}`);

    } catch (error) {
      this.log('⚠️ 性能分析失败:', error.message);
      this.metrics.performance = metrics;
    }
  }

  /**
   * 测试分析
   */
  async analyzeTesting() {
    this.log('🧪 分析测试状况...');

    const metrics = {
      unit_test_coverage: 0,
      integration_test_coverage: 0,
      e2e_test_coverage: 0,
      test_flakiness: 0,
      critical_test_paths: {
        authentication: 0,
        data_protection: 0,
        api_endpoints: 0,
        ui_components: 0
      }
    };

    try {
      // 测试覆盖率已经在前面的代码质量分析中处理
      if (this.metrics.code_quality?.test_coverage) {
        metrics.unit_test_coverage = this.metrics.code_quality.test_coverage.statements;
      }

      // 分析关键测试路径覆盖率
      this.log('  🎯 分析关键测试路径...');
      metrics.critical_test_paths = await this.analyzeCriticalTestPaths();

      this.metrics.testing = metrics;
      this.log(`✅ 测试分析完成: 单元测试覆盖率 ${metrics.unit_test_coverage}%`);

    } catch (error) {
      this.log('⚠️ 测试分析失败:', error.message);
      this.metrics.testing = metrics;
    }
  }

  /**
   * 文档质量分析
   */
  async analyzeDocumentation() {
    this.log('📚 分析文档质量...');

    const metrics = {
      api_coverage: 0,
      code_comment_ratio: 0,
      readme_completeness: 0,
      changelog_updated: false,
      architecture_docs: false
    };

    try {
      // README 完整性检查
      if (fs.existsSync('README.md')) {
        const readmeContent = fs.readFileSync('README.md', 'utf8');
        const requiredSections = ['安装', '使用', '配置', '贡献'];
        const foundSections = requiredSections.filter(section =>
          readmeContent.toLowerCase().includes(section.toLowerCase())
        );
        metrics.readme_completeness = Math.round((foundSections.length / requiredSections.length) * 100);
      }

      // 架构文档检查
      const architectureFiles = [
        'docs/ARCHITECTURE.md',
        'docs/ARCHITECTURE_GUIDE.md',
        'ARCHITECTURE.md'
      ];
      metrics.architecture_docs = architectureFiles.some(file => fs.existsSync(file));

      // API 文档覆盖率（简化版）
      metrics.api_coverage = await this.calculateApiCoverage();

      this.metrics.documentation = metrics;
      this.log(`✅ 文档分析完成: README 完整性 ${metrics.readme_completeness}%`);

    } catch (error) {
      this.log('⚠️ 文档分析失败:', error.message);
      this.metrics.documentation = metrics;
    }
  }

  /**
   * 计算综合评分
   */
  calculateOverallScore() {
    this.log('📊 计算综合质量评分...');

    const scores = {};
    const weights = this.config.weights;

    // 计算各维度评分
    scores.code_quality = this.calculateCodeQualityScore();
    scores.security = this.calculateSecurityScore();
    scores.performance = this.calculatePerformanceScore();
    scores.testing = this.calculateTestingScore();
    scores.documentation = this.calculateDocumentationScore();

    // 计算加权总分
    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(scores).forEach(([category, score]) => {
      const weight = weights[category] || 0;
      totalScore += score * weight;
      totalWeight += weight;
    });

    scores.overall = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    this.scores = scores;

    // 确定质量等级
    scores.grade = this.getQualityGrade(scores.overall);
    scores.alert_level = this.getAlertLevel(scores.overall);

    this.log(`✅ 综合评分完成: ${scores.overall}/100 (${scores.grade})`);
  }

  /**
   * 计算代码质量评分
   */
  calculateCodeQualityScore() {
    const metrics = this.metrics.code_quality || {};
    const thresholds = this.config.thresholds.code_quality;

    let score = 100;

    // TypeScript 错误扣分
    if (metrics.typescript_errors > 0) {
      score -= Math.min(metrics.typescript_errors * 10, 50);
    }

    // ESLint 错误扣分
    if (metrics.eslint_errors > 0) {
      score -= Math.min(metrics.eslint_errors * 15, 40);
    }

    // ESLint 警告扣分
    if (metrics.eslint_warnings > (thresholds.eslint_warnings || 10)) {
      score -= Math.min((metrics.eslint_warnings - thresholds.eslint_warnings) * 2, 20);
    }

    // 测试覆盖率评分
    const coverage = metrics.test_coverage || {};
    const avgCoverage = (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4;
    if (avgCoverage < (thresholds.test_coverage?.statements || 80)) {
      score -= Math.round((80 - avgCoverage) * 0.5);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算安全评分
   */
  calculateSecurityScore() {
    const metrics = this.metrics.security || {};
    const thresholds = this.config.thresholds.security;

    let score = 100;

    // 高危漏洞严重扣分
    if (metrics.high_vulnerabilities > 0) {
      score -= metrics.high_vulnerabilities * 30;
    }

    // 中危漏洞扣分
    if (metrics.medium_vulnerabilities > (thresholds.medium_vulnerabilities || 5)) {
      score -= (metrics.medium_vulnerabilities - thresholds.medium_vulnerabilities) * 10;
    }

    // 低危漏洞轻微扣分
    if (metrics.low_vulnerabilities > (thresholds.low_vulnerabilities || 15)) {
      score -= (metrics.low_vulnerabilities - thresholds.low_vulnerabilities) * 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算性能评分
   */
  calculatePerformanceScore() {
    const metrics = this.metrics.performance || {};
    const thresholds = this.config.thresholds.performance;

    let score = 100;

    // 构建时间评分
    if (metrics.build_time > (thresholds.build_time || 300)) {
      score -= Math.min((metrics.build_time - thresholds.build_time) / 10, 30);
    }

    // 构建产物大小评分（简化版）
    const frontendSize = this.parseSize(metrics.bundle_size?.frontend || '0B');
    const maxFrontendSize = this.parseSize(thresholds.bundle_size?.frontend || '10MB');
    if (frontendSize > maxFrontendSize) {
      score -= Math.min((frontendSize - maxFrontendSize) / maxFrontendSize * 20, 25);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算测试评分
   */
  calculateTestingScore() {
    const metrics = this.metrics.testing || {};
    const thresholds = this.config.thresholds.testing;

    let score = 100;

    // 单元测试覆盖率评分
    if (metrics.unit_test_coverage < (thresholds.unit_test_coverage || 80)) {
      score -= (80 - metrics.unit_test_coverage) * 0.8;
    }

    // 集成测试覆盖率评分
    if (metrics.integration_test_coverage < (thresholds.integration_test_coverage || 70)) {
      score -= (70 - metrics.integration_test_coverage) * 0.6;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算文档评分
   */
  calculateDocumentationScore() {
    const metrics = this.metrics.documentation || {};

    let score = 0;

    // README 完整性 (40%)
    score += metrics.readme_completeness * 0.4;

    // API 文档覆盖率 (30%)
    score += metrics.api_coverage * 0.3;

    // 架构文档存在 (20%)
    score += (metrics.architecture_docs ? 100 : 0) * 0.2;

    // 更新日志 (10%)
    score += (metrics.changelog_updated ? 100 : 0) * 0.1;

    return Math.round(score);
  }

  /**
   * 获取质量等级
   */
  getQualityGrade(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Acceptable';
    if (score >= 60) return 'Poor';
    return 'Critical';
  }

  /**
   * 获取告警级别
   */
  getAlertLevel(score) {
    if (score >= 85) return 'info';
    if (score >= 75) return 'warning';
    if (score >= 60) return 'error';
    return 'critical';
  }

  /**
   * 生成报告
   */
  async generateReports() {
    this.log('📋 生成质量报告...');

    const results = this.getResults();

    // JSON 格式报告
    if (this.options.format === 'json' || this.options.format === 'all') {
      const jsonPath = path.join(this.options.outputPath, 'quality-score.json');
      fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
      this.log(`✅ JSON 报告已生成: ${jsonPath}`);
    }

    // HTML 格式报告
    if (this.options.format === 'html' || this.options.format === 'all') {
      const htmlPath = path.join(this.options.outputPath, 'quality-score.html');
      const htmlReport = this.generateHtmlReport(results);
      fs.writeFileSync(htmlPath, htmlReport);
      this.log(`✅ HTML 报告已生成: ${htmlPath}`);
    }

    // Markdown 格式报告
    if (this.options.format === 'markdown' || this.options.format === 'all') {
      const mdPath = path.join(this.options.outputPath, 'quality-score.md');
      const mdReport = this.generateMarkdownReport(results);
      fs.writeFileSync(mdPath, mdReport);
      this.log(`✅ Markdown 报告已生成: ${mdPath}`);
    }
  }

  /**
   * 更新质量趋势
   */
  async updateQualityTrends() {
    this.log('📈 更新质量趋势数据...');

    const trendDir = path.join(this.options.outputPath, 'trends');
    this.ensureDirectory(trendDir);

    const trendFile = path.join(trendDir, 'quality-trends.json');
    let trends = [];

    // 读取现有趋势数据
    if (fs.existsSync(trendFile)) {
      try {
        trends = JSON.parse(fs.readFileSync(trendFile, 'utf8'));
      } catch (error) {
        this.log('⚠️ 无法读取趋势数据，创建新的');
        trends = [];
      }
    }

    // 添加当前数据点
    const currentData = {
      timestamp: new Date().toISOString(),
      build_number: process.env.GITHUB_RUN_NUMBER || 'local',
      commit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF_NAME || 'local',
      scores: this.scores,
      metrics: this.metrics,
      environment: this.options.environment
    };

    trends.push(currentData);

    // 保留最近90天的数据
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    trends = trends.filter(trend => new Date(trend.timestamp) > cutoffDate);

    // 保存趋势数据
    fs.writeFileSync(trendFile, JSON.stringify(trends, null, 2));
    this.log(`✅ 趋势数据已更新: ${trends.length} 个数据点`);
  }

  /**
   * 获取最终结果
   */
  getResults() {
    return {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      config_version: this.config.version,
      metrics: this.metrics,
      scores: this.scores,
      alerts: this.alerts,
      recommendations: this.generateRecommendations(),
      summary: {
        overall_score: this.scores.overall || 0,
        grade: this.scores.grade || 'Unknown',
        alert_level: this.scores.alert_level || 'unknown',
        deployment_ready: this.isDeploymentReady()
      }
    };
  }

  /**
   * 生成改进建议
   */
  generateRecommendations() {
    const recommendations = [];
    const scores = this.scores;

    if (scores.code_quality < 80) {
      recommendations.push({
        category: 'code_quality',
        priority: 'high',
        action: '提高代码质量',
        description: '修复 TypeScript 错误，减少 ESLint 警告，提高测试覆盖率',
        impact: '显著改善代码可维护性'
      });
    }

    if (scores.security < 85) {
      recommendations.push({
        category: 'security',
        priority: 'critical',
        action: '加强安全措施',
        description: '修复安全漏洞，更新依赖包，实施安全最佳实践',
        impact: '提高应用安全性'
      });
    }

    if (scores.performance < 75) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        action: '优化性能',
        description: '减少构建时间，优化资源大小，改善加载性能',
        impact: '提升用户体验'
      });
    }

    return recommendations;
  }

  /**
   * 检查是否准备好部署
   */
  isDeploymentReady() {
    const thresholds = this.config.environments?.[this.options.environment] ||
                     this.config.environments?.development || {};

    const minScore = thresholds.overall_quality?.minimum || 60;
    return this.scores.overall >= minScore;
  }

  // 辅助方法
  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  log(message) {
    if (this.options.verbose) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  countErrors(output) {
    const lines = output.split('\n');
    return lines.filter(line => line.includes('error')).length;
  }

  countVulnerabilities(output, severity) {
    const regex = new RegExp(`${severity}\\s+\\d+`, 'gi');
    const matches = output.match(regex);
    return matches ? matches.length : 0;
  }

  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;
    return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
  }

  getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return '0B';

    let totalSize = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    files.forEach(file => {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        totalSize += this.getDirectorySize(filePath);
      } else {
        totalSize += fs.statSync(filePath).size;
      }
    });

    return this.formatSize(totalSize);
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100}${units[unitIndex]}`;
  }

  async analyzeTestCoverage() {
    // 这里应该解析覆盖率报告文件
    // 简化实现，返回默认值
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    };
  }

  async analyzeCriticalTestPaths() {
    // 分析关键测试路径的覆盖率
    return {
      authentication: 0,
      data_protection: 0,
      api_endpoints: 0,
      ui_components: 0
    };
  }

  async calculateApiCoverage() {
    // 计算 API 文档覆盖率
    return 0;
  }

  generateHtmlReport(results) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>LLMChat 质量评分报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .score { font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; }
        .excellent { color: #28a745; }
        .good { color: #17a2b8; }
        .acceptable { color: #ffc107; }
        .poor { color: #fd7e14; }
        .critical { color: #dc3545; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏗️ LLMChat 企业级质量评分报告</h1>
        <p>生成时间: ${results.timestamp}</p>
        <p>环境: ${results.environment}</p>
    </div>

    <div class="score ${results.summary.alert_level}">
        总体评分: ${results.summary.overall_score}/100
        <div>${results.summary.grade}</div>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>🔍 代码质量</h3>
            <p>评分: ${results.scores.code_quality || 0}/100</p>
        </div>
        <div class="metric">
            <h3>🔒 安全性</h3>
            <p>评分: ${results.scores.security || 0}/100</p>
        </div>
        <div class="metric">
            <h3>⚡ 性能</h3>
            <p>评分: ${results.scores.performance || 0}/100</p>
        </div>
        <div class="metric">
            <h3>🧪 测试</h3>
            <p>评分: ${results.scores.testing || 0}/100</p>
        </div>
        <div class="metric">
            <h3>📚 文档</h3>
            <p>评分: ${results.scores.documentation || 0}/100</p>
        </div>
    </div>

    ${results.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>🎯 改进建议</h3>
        <ul>
            ${results.recommendations.map(rec => `
                <li><strong>${rec.action}</strong> (${rec.priority}): ${rec.description}</li>
            `).join('')}
        </ul>
    </div>
    ` : ''}

    <div>
        <p><strong>部署就绪状态:</strong> ${results.summary.deployment_ready ? '✅ 就绪' : '❌ 未就绪'}</p>
    </div>
</body>
</html>`;
  }

  generateMarkdownReport(results) {
    return `
# LLMChat 企业级质量评分报告

**生成时间**: ${results.timestamp}
**环境**: ${results.environment}
**总体评分**: ${results.summary.overall_score}/100 (${results.summary.grade})

## 📊 评分详情

| 维度 | 评分 | 状态 |
|------|------|------|
| 🔍 代码质量 | ${results.scores.code_quality || 0}/100 | ${this.getStatusEmoji(results.scores.code_quality)} |
| 🔒 安全性 | ${results.scores.security || 0}/100 | ${this.getStatusEmoji(results.scores.security)} |
| ⚡ 性能 | ${results.scores.performance || 0}/100 | ${this.getStatusEmoji(results.scores.performance)} |
| 🧪 测试 | ${results.scores.testing || 0}/100 | ${this.getStatusEmoji(results.scores.testing)} |
| 📚 文档 | ${results.scores.documentation || 0}/100 | ${this.getStatusEmoji(results.scores.documentation)} |

## 🎯 改进建议

${results.recommendations.map(rec => `
### ${rec.action} (${rec.priority})
**描述**: ${rec.description}
**影响**: ${rec.impact}
`).join('\n')}

## 📋 部署状态

**部署就绪**: ${results.summary.deployment_ready ? '✅ 是' : '❌ 否'}
**告警级别**: ${results.summary.alert_level}

---
*报告由 LLMChat 企业级质量评分系统生成*
`;
  }

  getStatusEmoji(score) {
    if (score >= 90) return '🌟 优秀';
    if (score >= 80) return '✅ 良好';
    if (score >= 70) return '⚠️ 可接受';
    if (score >= 60) return '❌ 较差';
    return '🚨 严重';
  }
}

// CLI 入口
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
        options.outputPath = args[++i];
        break;
      case '--environment':
        options.environment = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--config':
        options.configPath = args[++i];
        break;
      case '--help':
        console.log(`
企业级质量评分系统

用法: node enterprise-quality-scoring.js [选项]

选项:
  --format <format>     输出格式 (json|html|markdown|all) [默认: json]
  --output <path>       输出目录 [默认: quality-reports]
  --environment <env>   环境 (development|staging|production) [默认: development]
  --config <path>       配置文件路径 [默认: .quality-thresholds.json]
  --verbose             详细输出
  --help                显示帮助信息

示例:
  node enterprise-quality-scoring.js --format all --environment production
        `);
        process.exit(0);
    }
  }

  // 执行质量评分
  const scorer = new EnterpriseQualityScorer(options);
  scorer.execute()
    .then(results => {
      console.log('✅ 质量评分完成!');
      console.log(`📊 总体评分: ${results.summary.overall_score}/100 (${results.summary.grade})`);
      console.log(`🚀 部署就绪: ${results.summary.deployment_ready ? '是' : '否'}`);

      if (results.summary.deployment_ready) {
        process.exit(0);
      } else {
        console.log('❌ 质量评分未达到部署要求');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ 质量评分失败:', error.message);
      process.exit(1);
    });
}

module.exports = EnterpriseQualityScorer;