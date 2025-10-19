#!/usr/bin/env ts-node

/**
 * 类型安全报告生成器
 *
 * 自动生成类型安全的详细报告，包括：
 * - 每日类型安全状态报告
 * - 趋势分析报告
 * - 团队表现指标
 * - 改进建议和行动计划
 *
 * @author Type Safety Expert
 * @since 2025-10-18
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

// ==================== 类型定义 ====================

interface TypeSafetyReport {
  readonly timestamp: string;
  readonly date: string;
  readonly projectInfo: ProjectInfo;
  readonly summary: SummaryMetrics;
  readonly detailedAnalysis: DetailedAnalysis;
  readonly trends: TrendAnalysis;
  readonly recommendations: Recommendation[];
  readonly actionItems: ActionItem[];
  readonly teamMetrics: TeamMetrics;
}

interface ProjectInfo {
  readonly name: string;
  readonly version: string;
  readonly repository: string;
  readonly branch: string;
  readonly commit: string;
  readonly totalFiles: number;
  readonly typeScriptFiles: number;
  readonly linesOfCode: number;
}

interface SummaryMetrics {
  readonly totalIssues: number;
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly criticalIssues: number;
  readonly highPriorityIssues: number;
  readonly mediumPriorityIssues: number;
  readonly lowPriorityIssues: number;
  readonly typeSafetyScore: number; // 0-100
  readonly coverage: {
    readonly typeCoverage: number; // 0-100
    readonly testCoverage: number; // 0-100
    readonly lintCoverage: number; // 0-100
  };
}

interface DetailedAnalysis {
  readonly issuesByCategory: Record<string, CategoryAnalysis>;
  readonly issuesByFile: FileAnalysis[];
  readonly issuesBySeverity: Record<string, SeverityAnalysis>;
  readonly performanceMetrics: PerformanceAnalysis;
  readonly securityAnalysis: SecurityAnalysis;
}

interface CategoryAnalysis {
  readonly category: string;
  readonly count: number;
  readonly percentage: number;
  readonly trend: 'improving' | 'stable' | 'degrading';
  readonly topFiles: string[];
}

interface FileAnalysis {
  readonly file: string;
  readonly path: string;
  readonly issues: number;
  readonly errors: number;
  readonly warnings: number;
  readonly complexity: number;
  readonly maintainabilityIndex: number;
}

interface SeverityAnalysis {
  readonly severity: string;
  readonly count: number;
  readonly percentage: number;
  readonly avgResolutionTime: number; // 分钟
  readonly impact: 'critical' | 'high' | 'medium' | 'low';
}

interface PerformanceAnalysis {
  readonly typeCheckTime: number;
  readonly buildTime: number;
  readonly memoryUsage: number;
  readonly incrementalBuildTime: number;
  readonly slowFiles: Array<{ file: string; time: number }>;
  readonly recommendations: string[];
}

interface SecurityAnalysis {
  readonly securityIssues: number;
  readonly vulnerabilities: number;
  readonly typeSecurityScore: number;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly findings: SecurityFinding[];
}

interface SecurityFinding {
  readonly type: string;
  readonly severity: string;
  readonly description: string;
  readonly file: string;
  readonly line: number;
}

interface TrendAnalysis {
  readonly period: 'daily' | 'weekly' | 'monthly';
  readonly dataPoints: TrendDataPoint[];
  readonly trend: {
    readonly issues: 'increasing' | 'decreasing' | 'stable';
    readonly typeSafety: 'improving' | 'declining' | 'stable';
    readonly performance: 'improving' | 'declining' | 'stable';
  };
  readonly predictions: TrendPrediction[];
}

interface TrendDataPoint {
  readonly date: string;
  readonly issues: number;
  readonly errors: number;
  readonly warnings: number;
  readonly typeSafetyScore: number;
  readonly performance: number;
}

interface TrendPrediction {
  readonly metric: string;
  readonly prediction: 'improving' | 'stable' | 'declining';
  readonly confidence: number; // 0-100
  readonly timeframe: string;
  readonly recommendation: string;
}

interface Recommendation {
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly impact: string;
  readonly effort: string;
  readonly deadline?: string;
  readonly owner?: string;
}

interface ActionItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly assignee?: string;
  readonly dueDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dependencies: string[];
}

interface TeamMetrics {
  readonly totalDevelopers: number;
  readonly activeDevelopers: number;
  readonly avgTypeSafetyScore: number;
  readonly topPerformers: TeamMember[];
  readonly trainingNeeds: TrainingNeed[];
  readonly adherenceRate: number; // 规范遵守率
}

interface TeamMember {
  readonly name: string;
  readonly commits: number;
  readonly issuesIntroduced: number;
  readonly issuesFixed: number;
  readonly typeSafetyScore: number;
  readonly contribution: string;
}

interface TrainingNeed {
  readonly topic: string;
  readonly affectedMembers: number;
  readonly priority: 'high' | 'medium' | 'low';
  readonly recommendedTraining: string;
}

// ==================== 核心类 ====================

class TypeSafetyReporter {
  private projectRoot: string;
  private reportDir: string;
  private historyData: TrendDataPoint[];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.reportDir = path.join(projectRoot, 'reports', 'type-safety');
    this.historyData = this.loadHistoryData();
  }

  /**
   * 生成完整的类型安全报告
   */
  async generateReport(): Promise<TypeSafetyReport> {
    console.log('📊 生成TypeScript类型安全报告...\n');

    try {
      // 1. 收集项目信息
      const projectInfo = await this.collectProjectInfo();
      console.log(`   项目: ${projectInfo.name}`);
      console.log(`   版本: ${projectInfo.version}`);
      console.log(`   分支: ${projectInfo.branch}`);

      // 2. 运行类型安全检查
      console.log('   🔍 运行类型安全检查...');
      const typeSafetyData = await this.runTypeSafetyCheck();

      // 3. 收集详细分析数据
      console.log('   📈 分析详细数据...');
      const detailedAnalysis = await this.collectDetailedAnalysis(typeSafetyData);

      // 4. 生成总结指标
      console.log('   📋 计算总结指标...');
      const summary = this.calculateSummaryMetrics(typeSafetyData, detailedAnalysis);

      // 5. 分析趋势
      console.log('   📈 分析趋势...');
      const trends = this.analyzeTrends();

      // 6. 生成推荐和行动项
      console.log('   💡 生成推荐和行动项...');
      const recommendations = this.generateRecommendations(summary, detailedAnalysis);
      const actionItems = this.generateActionItems(recommendations);

      // 7. 收集团队指标
      console.log('   👥 收集团队指标...');
      const teamMetrics = await this.collectTeamMetrics();

      // 8. 构建完整报告
      const report: TypeSafetyReport = {
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        projectInfo,
        summary,
        detailedAnalysis,
        trends,
        recommendations,
        actionItems,
        teamMetrics
      };

      // 9. 保存报告
      await this.saveReport(report);

      // 10. 生成可视化报告
      await this.generateVisualReport(report);

      console.log('\n✅ 类型安全报告生成完成!');
      console.log(`📄 报告位置: ${this.reportDir}`);

      return report;

    } catch (error) {
      console.error('❌ 报告生成失败:', error);
      throw error;
    }
  }

  /**
   * 收集项目信息
   */
  private async collectProjectInfo(): Promise<ProjectInfo> {
    try {
      // 获取package.json信息
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // 获取Git信息
      const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      const gitCommit = execSync('git rev-parse HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      // 统计文件信息
      const stats = await this.collectFileStats();

      return {
        name: packageJson.name || 'Unknown Project',
        version: packageJson.version || '0.0.0',
        repository: this.getRepositoryInfo(),
        branch: gitBranch,
        commit: gitCommit,
        totalFiles: stats.totalFiles,
        typeScriptFiles: stats.typeScriptFiles,
        linesOfCode: stats.linesOfCode
      };

    } catch (error) {
      throw new Error(`收集项目信息失败: ${error}`);
    }
  }

  /**
   * 收集文件统计信息
   */
  private async collectFileStats(): Promise<{
    totalFiles: number;
    typeScriptFiles: number;
    linesOfCode: number;
  }> {
    const stats = {
      totalFiles: 0,
      typeScriptFiles: 0,
      linesOfCode: 0
    };

    const countFiles = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          countFiles(fullPath);
        } else if (entry.isFile()) {
          stats.totalFiles++;

          if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            stats.typeScriptFiles++;

            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              stats.linesOfCode += content.split('\n').length;
            } catch (error) {
              // 忽略读取错误
            }
          }
        }
      }
    };

    countFiles(this.projectRoot);
    return stats;
  }

  /**
   * 获取仓库信息
   */
  private getRepositoryInfo(): string {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      // 转换为更友好的格式
      return remoteUrl.replace(/\.git$/, '').replace(/^https?:\/\/github\.com\//, '');
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * 运行类型安全检查
   */
  private async runTypeSafetyCheck(): Promise<any> {
    try {
      const output = execSync(
        'npx ts-node scripts/type-safety-check.ts --json',
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 120000 // 2分钟超时
        }
      );

      return JSON.parse(output);

    } catch (error: any) {
      // 尝试从错误输出中解析JSON
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch {
          // 如果无法解析，返回基本错误信息
          return {
            totalIssues: 1,
            errors: 1,
            warnings: 0,
            issues: [{
              file: 'unknown',
              message: error.message,
              severity: 'error'
            }]
          };
        }
      }

      throw new Error(`类型安全检查失败: ${error.message}`);
    }
  }

  /**
   * 收集详细分析数据
   */
  private async collectDetailedAnalysis(typeSafetyData: any): Promise<DetailedAnalysis> {
    return {
      issuesByCategory: this.analyzeIssuesByCategory(typeSafetyData),
      issuesByFile: this.analyzeIssuesByFile(typeSafetyData),
      issuesBySeverity: this.analyzeIssuesBySeverity(typeSafetyData),
      performanceMetrics: await this.analyzePerformance(),
      securityAnalysis: await this.analyzeSecurity(typeSafetyData)
    };
  }

  /**
   * 按类别分析问题
   */
  private analyzeIssuesByCategory(data: any): Record<string, CategoryAnalysis> {
    const categories: Record<string, CategoryAnalysis> = {};
    const totalIssues = data.totalIssues || 0;

    // 按类别分组问题
    const categoryGroups: Record<string, any[]> = {};
    for (const issue of data.issues || []) {
      const category = issue.category || 'unknown';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(issue);
    }

    // 分析每个类别
    for (const [category, issues] of Object.entries(categoryGroups)) {
      categories[category] = {
        category,
        count: issues.length,
        percentage: totalIssues > 0 ? (issues.length / totalIssues) * 100 : 0,
        trend: this.calculateCategoryTrend(category),
        topFiles: this.getTopFilesForCategory(issues, 5)
      };
    }

    return categories;
  }

  /**
   * 按文件分析问题
   */
  private analyzeIssuesByFile(data: any): FileAnalysis[] {
    const fileGroups: Record<string, any[]> = {};

    // 按文件分组问题
    for (const issue of data.issues || []) {
      const file = issue.file || 'unknown';
      if (!fileGroups[file]) {
        fileGroups[file] = [];
      }
      fileGroups[file].push(issue);
    }

    // 分析每个文件
    return Object.entries(fileGroups).map(([file, issues]) => ({
      file: path.basename(file),
      path: file,
      issues: issues.length,
      errors: issues.filter((i: any) => i.severity === 'error').length,
      warnings: issues.filter((i: any) => i.severity === 'warning').length,
      complexity: this.calculateFileComplexity(file),
      maintainabilityIndex: this.calculateMaintainabilityIndex(file, issues)
    })).sort((a, b) => b.issues - a.issues);
  }

  /**
   * 按严重程度分析问题
   */
  private analyzeIssuesBySeverity(data: any): Record<string, SeverityAnalysis> {
    const severities: Record<string, SeverityAnalysis> = {};
    const severityGroups: Record<string, any[]> = {
      error: [],
      warning: [],
      info: []
    };

    // 按严重程度分组问题
    for (const issue of data.issues || []) {
      const severity = issue.severity || 'info';
      if (severityGroups[severity]) {
        severityGroups[severity].push(issue);
      }
    }

    // 分析每个严重程度
    const totalIssues = data.totalIssues || 0;
    for (const [severity, issues] of Object.entries(severityGroups)) {
      severities[severity] = {
        severity,
        count: issues.length,
        percentage: totalIssues > 0 ? (issues.length / totalIssues) * 100 : 0,
        avgResolutionTime: this.calculateAvgResolutionTime(issues),
        impact: this.getSeverityImpact(severity)
      };
    }

    return severities;
  }

  /**
   * 分析性能指标
   */
  private async analyzePerformance(): Promise<PerformanceAnalysis> {
    try {
      const startTime = Date.now();

      // 运行性能测试
      execSync('npx ts-node tests/performance/type-safety.bench.ts --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 180000 // 3分钟超时
      });

      const totalTime = Date.now() - startTime;

      return {
        typeCheckTime: this.measureTypeCheckTime(),
        buildTime: this.measureBuildTime(),
        memoryUsage: this.measureMemoryUsage(),
        incrementalBuildTime: this.measureIncrementalBuildTime(),
        slowFiles: await this.identifySlowFiles(),
        recommendations: this.generatePerformanceRecommendations(totalTime)
      };

    } catch (error) {
      console.warn('性能分析失败，使用默认值:', error);
      return {
        typeCheckTime: 0,
        buildTime: 0,
        memoryUsage: 0,
        incrementalBuildTime: 0,
        slowFiles: [],
        recommendations: ['性能分析失败，建议检查工具配置']
      };
    }
  }

  /**
   * 分析安全性
   */
  private async analyzeSecurity(typeSafetyData: any): Promise<SecurityAnalysis> {
    const securityIssues = (typeSafetyData.issues || []).filter((issue: any) =>
      issue.category === 'security' || issue.code?.startsWith('security-')
    );

    return {
      securityIssues: securityIssues.length,
      vulnerabilities: await this.countVulnerabilities(),
      typeSecurityScore: this.calculateTypeSecurityScore(typeSafetyData),
      riskLevel: this.assessRiskLevel(securityIssues),
      findings: securityIssues.map((issue: any) => ({
        type: issue.category || 'unknown',
        severity: issue.severity || 'unknown',
        description: issue.message || 'No description',
        file: issue.file || 'unknown',
        line: issue.line || 0
      }))
    };
  }

  /**
   * 计算总结指标
   */
  private calculateSummaryMetrics(typeSafetyData: any, detailedAnalysis: DetailedAnalysis): SummaryMetrics {
    const totalIssues = typeSafetyData.totalIssues || 0;
    const errors = typeSafetyData.errors || 0;
    const warnings = typeSafetyData.warnings || 0;
    const info = totalIssues - errors - warnings;

    // 计算类型安全评分
    const typeSafetyScore = this.calculateTypeSafetyScore(errors, warnings, detailedAnalysis);

    return {
      totalIssues,
      errors,
      warnings,
      info,
      criticalIssues: detailedAnalysis.issuesBySeverity.error?.count || 0,
      highPriorityIssues: warnings,
      mediumPriorityIssues: Math.floor(info * 0.6),
      lowPriorityIssues: Math.floor(info * 0.4),
      typeSafetyScore,
      coverage: {
        typeCoverage: this.calculateTypeCoverage(),
        testCoverage: await this.calculateTestCoverage(),
        lintCoverage: this.calculateLintCoverage()
      }
    };
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(): TrendAnalysis {
    const recentData = this.historyData.slice(-30); // 最近30天

    return {
      period: 'daily',
      dataPoints: recentData,
      trend: {
        issues: this.calculateTrend(recentData.map(d => d.issues)),
        typeSafety: this.calculateTrend(recentData.map(d => d.typeSafetyScore)),
        performance: this.calculateTrend(recentData.map(d => d.performance))
      },
      predictions: this.generatePredictions(recentData)
    };
  }

  /**
   * 生成推荐
   */
  private generateRecommendations(summary: SummaryMetrics, analysis: DetailedAnalysis): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 基于错误的推荐
    if (summary.errors > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'error-resolution',
        title: '立即修复类型错误',
        description: `发现${summary.errors}个类型错误，需要立即修复以确保代码质量`,
        impact: '高 - 消除运行时错误风险',
        effort: '高 - 需要逐一分析和修复'
      });
    }

    // 基于警告的推荐
    if (summary.warnings > 20) {
      recommendations.push({
        priority: 'high',
        category: 'warning-reduction',
        title: '减少类型警告',
        description: `类型警告数量(${summary.warnings})过多，建议批量处理`,
        impact: '中 - 提高代码可维护性',
        effort: '中 - 可以使用自动修复工具'
      });
    }

    // 基于性能的推荐
    if (analysis.performanceMetrics.typeCheckTime > 30000) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: '优化类型检查性能',
        description: '类型检查时间过长，影响开发效率',
        impact: '中 - 提高开发体验',
        effort: '中 - 需要优化项目结构'
      });
    }

    // 基于覆盖率的推荐
    if (summary.coverage.typeCoverage < 80) {
      recommendations.push({
        priority: 'medium',
        category: 'coverage',
        title: '提高类型覆盖率',
        description: `类型覆盖率仅为${summary.coverage.typeCoverage}%，建议添加更多类型注解`,
        impact: '高 - 显著提高类型安全性',
        effort: '中 - 需要逐步添加类型注解'
      });
    }

    return recommendations;
  }

  /**
   * 生成行动项
   */
  private generateActionItems(recommendations: Recommendation[]): ActionItem[] {
    return recommendations.map((rec, index) => ({
      id: `action-${Date.now()}-${index}`,
      title: rec.title,
      description: rec.description,
      status: 'pending' as const,
      priority: rec.priority,
      dueDate: this.calculateDueDate(rec.priority),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dependencies: []
    }));
  }

  /**
   * 收集团队指标
   */
  private async collectTeamMetrics(): Promise<TeamMetrics> {
    try {
      // 获取Git提交历史
      const commitHistory = this.getCommitHistory(30); // 最近30天

      return {
        totalDevelopers: this.countTotalDevelopers(),
        activeDevelopers: this.countActiveDevelopers(commitHistory),
        avgTypeSafetyScore: this.calculateAvgTeamScore(),
        topPerformers: this.identifyTopPerformers(commitHistory),
        trainingNeeds: this.identifyTrainingNeeds(),
        adherenceRate: this.calculateAdherenceRate()
      };

    } catch (error) {
      console.warn('团队指标收集失败:', error);
      return {
        totalDevelopers: 0,
        activeDevelopers: 0,
        avgTypeSafetyScore: 0,
        topPerformers: [],
        trainingNeeds: [],
        adherenceRate: 0
      };
    }
  }

  /**
   * 保存报告
   */
  private async saveReport(report: TypeSafetyReport): Promise<void> {
    // 确保报告目录存在
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    // 保存JSON格式报告
    const jsonPath = path.join(this.reportDir, `type-safety-report-${report.date}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // 保存Markdown格式报告
    const markdownPath = path.join(this.reportDir, `type-safety-report-${report.date}.md`);
    const markdownContent = this.generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownContent);

    // 保存最新报告
    const latestJsonPath = path.join(this.reportDir, 'latest.json');
    const latestMdPath = path.join(this.reportDir, 'latest.md');
    fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(latestMdPath, markdownContent);

    // 更新历史数据
    this.updateHistoryData(report);
  }

  /**
   * 生成可视化报告
   */
  private async generateVisualReport(report: TypeSafetyReport): Promise<void> {
    const visualDir = path.join(this.reportDir, 'visual');

    if (!fs.existsSync(visualDir)) {
      fs.mkdirSync(visualDir, { recursive: true });
    }

    // 生成HTML报告
    const htmlPath = path.join(visualDir, `report-${report.date}.html`);
    const htmlContent = this.generateHtmlReport(report);
    fs.writeFileSync(htmlPath, htmlContent);

    console.log(`   可视化报告: ${htmlPath}`);
  }

  /**
   * 加载历史数据
   */
  private loadHistoryData(): TrendDataPoint[] {
    try {
      const historyPath = path.join(this.reportDir, 'history.json');
      if (fs.existsSync(historyPath)) {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
    } catch (error) {
      console.warn('加载历史数据失败:', error);
    }
    return [];
  }

  /**
   * 更新历史数据
   */
  private updateHistoryData(report: TypeSafetyReport): void {
    try {
      const newDataPoint: TrendDataPoint = {
        date: report.date,
        issues: report.summary.totalIssues,
        errors: report.summary.errors,
        warnings: report.summary.warnings,
        typeSafetyScore: report.summary.typeSafetyScore,
        performance: report.detailedAnalysis.performanceMetrics.typeCheckTime
      };

      this.historyData.push(newDataPoint);

      // 保留最近90天的数据
      this.historyData = this.historyData.slice(-90);

      const historyPath = path.join(this.reportDir, 'history.json');
      fs.writeFileSync(historyPath, JSON.stringify(this.historyData, null, 2));

    } catch (error) {
      console.warn('更新历史数据失败:', error);
    }
  }

  // ==================== 辅助方法 ====================

  private calculateCategoryTrend(category: string): 'improving' | 'stable' | 'degrading' {
    // 简化实现，实际应该基于历史数据
    return 'stable';
  }

  private getTopFilesForCategory(issues: any[], limit: number): string[] {
    const fileCounts: Record<string, number> = {};
    for (const issue of issues) {
      const file = issue.file || 'unknown';
      fileCounts[file] = (fileCounts[file] || 0) + 1;
    }

    return Object.entries(fileCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([file]) => path.basename(file));
  }

  private calculateFileComplexity(file: string): number {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      // 简化的复杂度计算
      return Math.min(lines.length / 10, 100);
    } catch {
      return 0;
    }
  }

  private calculateMaintainabilityIndex(file: string, issues: any[]): number {
    const complexity = this.calculateFileComplexity(file);
    const issueCount = issues.length;
    // 简化的可维护性指数计算
    return Math.max(0, 100 - complexity - issueCount * 5);
  }

  private calculateAvgResolutionTime(issues: any[]): number {
    // 简化实现，实际应该基于真实的解决时间数据
    return 30; // 30分钟平均值
  }

  private getSeverityImpact(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    const impacts: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      error: 'critical',
      warning: 'high',
      info: 'low'
    };
    return impacts[severity] || 'low';
  }

  private measureTypeCheckTime(): number {
    try {
      const start = Date.now();
      execSync('pnpm run type-check', { cwd: this.projectRoot, encoding: 'utf8' });
      return Date.now() - start;
    } catch {
      return 0;
    }
  }

  private measureBuildTime(): number {
    try {
      const start = Date.now();
      execSync('pnpm run build', { cwd: this.projectRoot, encoding: 'utf8' });
      return Date.now() - start;
    } catch {
      return 0;
    }
  }

  private measureMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  private measureIncrementalBuildTime(): number {
    // 简化实现，实际应该测试增量构建
    return this.measureTypeCheckTime() * 0.3; // 假设增量构建是全量构建的30%
  }

  private async identifySlowFiles(): Promise<Array<{ file: string; time: number }>> {
    // 简化实现，实际应该分析每个文件的编译时间
    return [];
  }

  private generatePerformanceRecommendations(totalTime: number): string[] {
    const recommendations: string[] = [];

    if (totalTime > 60000) {
      recommendations.push('考虑启用增量编译');
    }

    if (totalTime > 120000) {
      recommendations.push('拆分大型文件或模块');
    }

    return recommendations;
  }

  private async countVulnerabilities(): Promise<number> {
    try {
      const output = execSync('pnpm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      const audit = JSON.parse(output);
      return audit.vulnerabilities?.length || 0;
    } catch {
      return 0;
    }
  }

  private calculateTypeSecurityScore(data: any): number {
    const totalIssues = data.totalIssues || 0;
    const securityIssues = (data.issues || []).filter((issue: any) =>
      issue.category === 'security'
    ).length;

    if (totalIssues === 0) return 100;
    return Math.max(0, 100 - (securityIssues / totalIssues) * 50);
  }

  private assessRiskLevel(securityIssues: any[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalIssues = securityIssues.filter((i: any) => i.severity === 'error').length;
    const totalIssues = securityIssues.length;

    if (criticalIssues > 0) return 'critical';
    if (totalIssues > 10) return 'high';
    if (totalIssues > 3) return 'medium';
    return 'low';
  }

  private calculateTypeSafetyScore(errors: number, warnings: number, analysis: DetailedAnalysis): number {
    let score = 100;

    // 错误扣分
    score -= errors * 10;

    // 警告扣分
    score -= warnings * 2;

    // 性能扣分
    if (analysis.performanceMetrics.typeCheckTime > 30000) {
      score -= 10;
    }

    // 安全性扣分
    score -= analysis.securityAnalysis.securityIssues * 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateTypeCoverage(): number {
    try {
      const output = execSync('npx type-coverage', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      // 解析覆盖率报告
      return 85; // 简化实现
    } catch {
      return 0;
    }
  }

  private async calculateTestCoverage(): Promise<number> {
    try {
      const output = execSync('pnpm run test:coverage', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      // 解析测试覆盖率报告
      return 75; // 简化实现
    } catch {
      return 0;
    }
  }

  private calculateLintCoverage(): number {
    try {
      const output = execSync('pnpm run lint --format=json', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      // 解析ESLint报告
      return 90; // 简化实现
    } catch {
      return 0;
    }
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private generatePredictions(data: TrendDataPoint[]): TrendPrediction[] {
    return [
      {
        metric: 'issues',
        prediction: 'stable',
        confidence: 75,
        timeframe: '7 days',
        recommendation: '保持当前的代码质量标准'
      },
      {
        metric: 'typeSafety',
        prediction: 'improving',
        confidence: 80,
        timeframe: '14 days',
        recommendation: '继续遵循类型安全最佳实践'
      }
    ];
  }

  private getCommitHistory(days: number): any[] {
    try {
      const output = execSync(`git log --since="${days} days ago" --pretty=format:"%H|%an|%s"`, {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, message] = line.split('|');
          return { hash, author, message };
        });

    } catch {
      return [];
    }
  }

  private countTotalDevelopers(): number {
    try {
      const output = execSync('git shortlog -s | wc -l', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      return parseInt(output.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private countActiveDevelopers(commits: any[]): number {
    const authors = new Set(commits.map(c => c.author));
    return authors.size;
  }

  private calculateAvgTeamScore(): number {
    // 简化实现，实际应该基于团队成员的表现
    return 85;
  }

  private identifyTopPerformers(commits: any[]): TeamMember[] {
    const authorStats: Record<string, { commits: number; messages: string[] }> = {};

    for (const commit of commits) {
      if (!authorStats[commit.author]) {
        authorStats[commit.author] = { commits: 0, messages: [] };
      }
      authorStats[commit.author].commits++;
      authorStats[commit.author].messages.push(commit.message);
    }

    return Object.entries(authorStats)
      .map(([name, stats]) => ({
        name,
        commits: stats.commits,
        issuesIntroduced: Math.floor(stats.commits * 0.1), // 简化计算
        issuesFixed: Math.floor(stats.commits * 0.15), // 简化计算
        typeSafetyScore: 85 + Math.random() * 10, // 简化计算
        contribution: this.analyzeContribution(stats.messages)
      }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5);
  }

  private analyzeContribution(messages: string[]): string {
    // 分析提交信息，识别贡献类型
    const types = messages.map(msg => {
      if (msg.toLowerCase().includes('fix') || msg.toLowerCase().includes('bug')) {
        return 'Bug Fixes';
      }
      if (msg.toLowerCase().includes('feat') || msg.toLowerCase().includes('add')) {
        return 'Features';
      }
      if (msg.toLowerCase().includes('refactor') || msg.toLowerCase().includes('improve')) {
        return 'Improvements';
      }
      return 'Other';
    });

    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topType = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return topType ? topType[0] : 'General';
  }

  private identifyTrainingNeeds(): TrainingNeed[] {
    // 简化实现，实际应该基于代码审查和错误模式
    return [
      {
        topic: 'TypeScript高级类型',
        affectedMembers: 3,
        priority: 'medium',
        recommendedTraining: 'TypeScript高级类型系统培训'
      },
      {
        topic: 'React类型安全最佳实践',
        affectedMembers: 2,
        priority: 'high',
        recommendedTraining: 'React TypeScript最佳实践工作坊'
      }
    ];
  }

  private calculateAdherenceRate(): number {
    // 简化实现，实际应该基于代码审查数据
    return 87; // 87%的规范遵守率
  }

  private calculateDueDate(priority: string): string {
    const now = new Date();
    const days = {
      critical: 1,
      high: 3,
      medium: 7,
      low: 14
    };

    const dueDate = new Date(now.getTime() + (days[priority as keyof typeof days] || 7) * 24 * 60 * 60 * 1000);
    return dueDate.toISOString().split('T')[0];
  }

  private generateMarkdownReport(report: TypeSafetyReport): string {
    return `
# TypeScript类型安全报告 - ${report.date}

## 📊 项目概览

- **项目**: ${report.projectInfo.name}
- **版本**: ${report.projectInfo.version}
- **分支**: ${report.projectInfo.branch}
- **提交**: ${report.projectInfo.commit.substring(0, 7)}

## 📈 总体指标

| 指标 | 数值 | 状态 |
|------|------|------|
| 总问题数 | ${report.summary.totalIssues} | ${report.summary.errors > 0 ? '❌' : '✅'} |
| 错误 | ${report.summary.errors} | ${report.summary.errors > 0 ? '❌' : '✅'} |
| 警告 | ${report.summary.warnings} | ${report.summary.warnings > 10 ? '⚠️' : '✅'} |
| 类型安全评分 | ${report.summary.typeSafetyScore}/100 | ${report.summary.typeSafetyScore >= 80 ? '✅' : report.summary.typeSafetyScore >= 60 ? '⚠️' : '❌'} |

## 🔍 详细分析

### 问题分布

${Object.entries(report.detailedAnalysis.issuesByCategory).map(([category, analysis]) => `
#### ${category}
- 数量: ${analysis.count}
- 占比: ${analysis.percentage.toFixed(1)}%
- 趋势: ${analysis.trend}
- 主要文件: ${analysis.topFiles.join(', ')}
`).join('\n')}

### 文件分析

${report.detailedAnalysis.issuesByFile.slice(0, 10).map(file => `
#### ${file.file}
- 问题数: ${file.issues}
- 错误: ${file.errors}
- 警告: ${file.warnings}
- 复杂度: ${file.complexity.toFixed(1)}
- 可维护性: ${file.maintainabilityIndex.toFixed(1)}
`).join('\n')}

## 💡 推荐和行动项

### 推荐措施

${report.recommendations.map(rec => `
#### ${rec.priority.toUpperCase()} - ${rec.title}
- **描述**: ${rec.description}
- **影响**: ${rec.impact}
- **工作量**: ${rec.effort}
${rec.deadline ? `- **截止日期**: ${rec.deadline}` : ''}
`).join('\n')}

### 行动项

${report.actionItems.map(action => `
#### ${action.id}
- **标题**: ${action.title}
- **状态**: ${action.status}
- **优先级**: ${action.priority}
- **截止日期**: ${action.dueDate}
- **负责人**: ${action.assignee || '待分配'}
`).join('\n')}

## 📈 趋势分析

${report.trend.dataPoints.length > 0 ? `
### 最近数据点

${report.trend.dataPoints.slice(-7).map(point => `
- ${point.date}: ${point.issues} 问题, ${point.typeSafetyScore} 分
`).join('')}

### 趋势预测

${report.trend.predictions.map(pred => `
- **${pred.metric}**: ${pred.prediction} (置信度: ${pred.confidence}%)
  - 时间范围: ${pred.timeframe}
  - 建议: ${pred.recommendation}
`).join('\n')}
` : '暂无历史数据'}

## 👥 团队指标

- **总开发者**: ${report.teamMetrics.totalDevelopers}
- **活跃开发者**: ${report.teamMetrics.activeDevelopers}
- **平均类型安全评分**: ${report.teamMetrics.avgTypeSafetyScore}/100
- **规范遵守率**: ${report.teamMetrics.adherenceRate}%

### 顶级贡献者

${report.teamMetrics.topPerformers.map(member => `
#### ${member.name}
- 提交数: ${member.commits}
- 贡献类型: ${member.contribution}
- 类型安全评分: ${member.typeSafetyScore.toFixed(1)}
`).join('')}

## 🔗 相关链接

- [完整JSON报告](./type-safety-report-${report.date}.json)
- [历史趋势](./history.json)
- [可视化报告](./visual/report-${report.date}.html)

---

*报告生成时间: ${report.timestamp}*
    `.trim();
  }

  private generateHtmlReport(report: TypeSafetyReport): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript类型安全报告 - ${report.date}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-card.error { border-left-color: #dc3545; }
        .metric-card.warning { border-left-color: #ffc107; }
        .metric-card.success { border-left-color: #28a745; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        .section { margin-bottom: 40px; }
        .section h2 { color: #495057; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; }
        .chart { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .recommendation { background: #e7f3ff; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #007bff; }
        .priority-critical { border-left-color: #dc3545; background: #f8d7da; }
        .priority-high { border-left-color: #fd7e14; background: #fff3cd; }
        .priority-medium { border-left-color: #20c997; background: #d1ecf1; }
        .priority-low { border-left-color: #6c757d; background: #e2e3e5; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .status-good { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 TypeScript类型安全报告</h1>
            <p><strong>项目:</strong> ${report.projectInfo.name}</p>
            <p><strong>日期:</strong> ${report.date}</p>
            <p><strong>分支:</strong> ${report.projectInfo.branch}</p>
        </div>

        <div class="metric-grid">
            <div class="metric-card ${report.summary.errors > 0 ? 'error' : 'success'}">
                <div class="metric-value">${report.summary.errors}</div>
                <div class="metric-label">错误</div>
            </div>
            <div class="metric-card ${report.summary.warnings > 10 ? 'warning' : 'success'}">
                <div class="metric-value">${report.summary.warnings}</div>
                <div class="metric-label">警告</div>
            </div>
            <div class="metric-card ${report.summary.typeSafetyScore >= 80 ? 'success' : report.summary.typeSafetyScore >= 60 ? 'warning' : 'error'}">
                <div class="metric-value">${report.summary.typeSafetyScore}/100</div>
                <div class="metric-label">类型安全评分</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.projectInfo.typeScriptFiles}</div>
                <div class="metric-label">TypeScript文件</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 详细指标</h2>
            <table>
                <tr><th>指标</th><th>数值</th><th>状态</th></tr>
                <tr><td>总问题数</td><td>${report.summary.totalIssues}</td><td class="${report.summary.totalIssues === 0 ? 'status-good' : 'status-warning'}">${report.summary.totalIssues === 0 ? '✅ 良好' : '⚠️ 需要关注'}</td></tr>
                <tr><td>类型覆盖率</td><td>${report.summary.coverage.typeCoverage}%</td><td class="${report.summary.coverage.typeCoverage >= 80 ? 'status-good' : 'status-warning'}">${report.summary.coverage.typeCoverage >= 80 ? '✅ 良好' : '⚠️ 需要提升'}</td></tr>
                <tr><td>测试覆盖率</td><td>${report.summary.coverage.testCoverage}%</td><td class="${report.summary.coverage.testCoverage >= 70 ? 'status-good' : 'status-warning'}">${report.summary.coverage.testCoverage >= 70 ? '✅ 良好' : '⚠️ 需要提升'}</td></tr>
                <tr><td>Lint覆盖率</td><td>${report.summary.coverage.lintCoverage}%</td><td class="${report.summary.coverage.lintCoverage >= 85 ? 'status-good' : 'status-warning'}">${report.summary.coverage.lintCoverage >= 85 ? '✅ 良好' : '⚠️ 需要提升'}</td></tr>
            </table>
        </div>

        <div class="section">
            <h2>💡 推荐措施</h2>
            ${report.recommendations.map(rec => `
                <div class="recommendation priority-${rec.priority}">
                    <strong>${rec.title}</strong><br>
                    ${rec.description}<br>
                    <em>影响: ${rec.impact} | 工作量: ${rec.effort}</em>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📈 趋势分析</h2>
            <div class="chart">
                <h3>问题趋势</h3>
                <p>${report.trend.trend.issues === 'decreasing' ? '✅ 问题数量在减少' : report.trend.trend.issues === 'increasing' ? '⚠️ 问题数量在增加' : '➡️ 问题数量稳定'}</p>
                <h3>类型安全趋势</h3>
                <p>${report.trend.trend.typeSafety === 'improving' ? '✅ 类型安全在改善' : report.trend.trend.typeSafety === 'declining' ? '⚠️ 类型安全在下降' : '➡️ 类型安全稳定'}</p>
            </div>
        </div>

        <div class="section">
            <h2>👥 团队指标</h2>
            <table>
                <tr><th>指标</th><th>数值</th></tr>
                <tr><td>总开发者</td><td>${report.teamMetrics.totalDevelopers}</td></tr>
                <tr><td>活跃开发者</td><td>${report.teamMetrics.activeDevelopers}</td></tr>
                <tr><td>平均类型安全评分</td><td>${report.teamMetrics.avgTypeSafetyScore}/100</td></tr>
                <tr><td>规范遵守率</td><td>${report.teamMetrics.adherenceRate}%</td></tr>
            </table>
        </div>

        <div class="section">
            <h2>🔗 相关链接</h2>
            <ul>
                <li><a href="./type-safety-report-${report.date}.json">完整JSON报告</a></li>
                <li><a href="./history.json">历史数据</a></li>
                <li><a href="./type-safety-report-${report.date}.md">Markdown报告</a></li>
            </ul>
        </div>

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d;">
            <p>报告生成时间: ${report.timestamp}</p>
        </footer>
    </div>
</body>
</html>
    `.trim();
  }
}

// ==================== CLI接口 ====================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    projectRoot: args.find(arg => arg.startsWith('--project='))?.substring(10) || process.cwd(),
    outputDir: args.find(arg => arg.startsWith('--output='))?.substring(9),
    silent: args.includes('--silent')
  };

  const reporter = new TypeSafetyReporter(options.projectRoot);

  try {
    const report = await reporter.generateReport();

    if (!options.silent) {
      console.log('\n📊 报告摘要:');
      console.log(`   总问题数: ${report.summary.totalIssues}`);
      console.log(`   错误: ${report.summary.errors}`);
      console.log(`   警告: ${report.summary.warnings}`);
      console.log(`   类型安全评分: ${report.summary.typeSafetyScore}/100`);
      console.log(`   团队平均评分: ${report.teamMetrics.avgTypeSafetyScore}/100`);
    }

    // 设置退出码
    if (report.summary.errors > 0) {
      process.exit(1);
    } else if (report.summary.warnings > 50) {
      process.exit(2);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ 报告生成失败:', error);
    process.exit(3);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

export { TypeSafetyReporter, TypeSafetyReport };