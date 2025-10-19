#!/usr/bin/env ts-node

/**
 * 类型安全编译检查工具
 *
 * 专门用于TypeScript类型安全的全面检查工具
 * 提供详细的类型错误分析、修复建议和性能影响评估
 *
 * @author Type Safety Expert
 * @since 2025-10-18
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

// ==================== 类型定义 ====================

interface TypeSafetyIssue {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly category: IssueCategory;
  readonly impact: ImpactLevel;
  readonly suggestion?: string;
  readonly autoFixable: boolean;
}

interface IssueCategory {
  readonly type: 'syntax' | 'type' | 'import' | 'export' | 'performance' | 'security';
  readonly subcategory: string;
}

interface ImpactLevel {
  readonly level: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly estimatedFixTime: number; // 分钟
}

interface TypeSafetyReport {
  readonly timestamp: string;
  readonly projectRoot: string;
  readonly totalIssues: number;
  readonly errors: number;
  readonly warnings: number;
  readonly files: number;
  readonly issuesByCategory: Record<string, number>;
  readonly issuesBySeverity: Record<string, number>;
  readonly performanceImpact: PerformanceMetrics;
  readonly recommendations: Recommendation[];
  readonly topIssues: TypeSafetyIssue[];
}

interface PerformanceMetrics {
  readonly totalTypeCheckTime: number;
  readonly slowFiles: Array<{ file: string; time: number }>;
  readonly memoryUsage: number;
  readonly complexityScore: number;
}

interface Recommendation {
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly category: string;
  readonly description: string;
  readonly action: string;
  readonly estimatedEffort: string;
  readonly impact: string;
}

// ==================== 配置 ====================

const CONFIG = {
  // 要检查的目录
  includeDirs: ['frontend/src', 'backend/src', 'shared-types/src'],

  // 要排除的目录
  excludeDirs: [
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
    '__tests__',
    'test'
  ],

  // 要排除的文件模式
  excludePatterns: [
    '*.test.ts',
    '*.spec.ts',
    '*.stories.ts',
    '*.d.ts',
    'node_modules/**/*'
  ],

  // 性能阈值
  performanceThresholds: {
    maxFileCheckTime: 5000, // 5秒
    maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
    maxComplexityScore: 100
  }
};

// ==================== 核心类 ====================

class TypeSafetyChecker {
  private issues: TypeSafetyIssue[] = [];
  private report: TypeSafetyReport;
  private startTime: number = Date.now();

  constructor(
    private readonly projectRoot: string,
    private readonly options: {
      strict?: boolean;
      verbose?: boolean;
      autoFix?: boolean;
      outputFormat?: 'text' | 'json' | 'markdown';
    } = {}
  ) {
    this.report = this.initializeReport();
  }

  /**
   * 运行完整的类型安全检查
   */
  async run(): Promise<TypeSafetyReport> {
    console.log('🔍 开始TypeScript类型安全检查...\n');

    try {
      // 1. 环境检查
      await this.checkEnvironment();

      // 2. TypeScript编译检查
      await this.runTypeScriptCheck();

      // 3. ESLint类型检查
      await this.runESLintCheck();

      // 4. 性能分析
      await this.analyzePerformance();

      // 5. 生成报告
      this.generateReport();

      // 6. 输出结果
      this.outputResults();

      // 7. 自动修复（如果启用）
      if (this.options.autoFix) {
        await this.performAutoFix();
      }

    } catch (error) {
      console.error('❌ 类型安全检查失败:', error);
      throw error;
    }

    return this.report;
  }

  /**
   * 检查环境
   */
  private async checkEnvironment(): Promise<void> {
    console.log('📋 检查环境配置...');

    // 检查TypeScript版本
    try {
      const version = execSync('npx tsc --version', { encoding: 'utf8' });
      console.log(`   TypeScript: ${version.trim()}`);
    } catch (error) {
      throw new Error('TypeScript未安装或配置错误');
    }

    // 检查配置文件
    const configFiles = [
      'tsconfig.json',
      'frontend/tsconfig.json',
      'backend/tsconfig.json',
      'shared-types/tsconfig.json'
    ];

    for (const configFile of configFiles) {
      const fullPath = path.join(this.projectRoot, configFile);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✓ ${configFile}`);
      } else {
        console.log(`   ⚠️  ${configFile} 不存在`);
      }
    }

    console.log('✅ 环境检查完成\n');
  }

  /**
   * 运行TypeScript编译检查
   */
  private async runTypeScriptCheck(): Promise<void> {
    console.log('🔬 运行TypeScript编译检查...');

    for (const dir of CONFIG.includeDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  目录不存在: ${dir}`);
        continue;
      }

      console.log(`   检查目录: ${dir}`);

      try {
        const output = execSync(
          `npx tsc --noEmit --strict ${this.options.verbose ? '' : '--quiet'}`,
          {
            cwd: fullPath,
            encoding: 'utf8',
            timeout: 60000 // 60秒超时
          }
        );

        if (output) {
          console.log(`   ✓ 无TypeScript错误`);
        }

      } catch (unknownError: unknown) {
        // 解析TypeScript错误
        const issues = this.parseTypeScriptErrors((unknownError as any).stdout || (unknownError as any).stderr || '', dir);
        this.issues.push(...issues);

        console.log(`   ❌ 发现 ${issues.length} 个TypeScript问题`);
      }
    }

    console.log('✅ TypeScript检查完成\n');
  }

  /**
   * 运行ESLint类型检查
   */
  private async runESLintCheck(): Promise<void> {
    console.log('🔍 运行ESLint类型检查...');

    try {
      const output = execSync(
        `npx eslint "${CONFIG.includeDirs.join(' ')}" --ext .ts,.tsx --format=json --no-eslintrc --config .eslintrc.cjs`,
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 60000
        }
      );

      if (output) {
        const eslintResults = JSON.parse(output);
        const issues = this.parseESLintResults(eslintResults);
        this.issues.push(...issues);

        console.log(`   发现 ${issues.length} 个ESLint类型问题`);
      }

    } catch (unknownError: unknown) {
      // ESLint返回非零退出码时仍然有输出
      const error = unknownError as any;
      if (error.stdout) {
        try {
          const eslintResults = JSON.parse(error.stdout);
          const issues = this.parseESLintResults(eslintResults);
          this.issues.push(...issues);

          console.log(`   发现 ${issues.length} 个ESLint类型问题`);
        } catch (parseError) {
          console.log('   ⚠️  无法解析ESLint输出');
        }
      }
    }

    console.log('✅ ESLint检查完成\n');
  }

  /**
   * 分析性能
   */
  private async analyzePerformance(): Promise<void> {
    console.log('⚡ 分析性能指标...');

    const startTime = Date.now();

    try {
      // 获取类型检查时间
      const typeCheckTime = execSync(
        `npx tsc --noEmit --diagnostics --extendedDiagnostics`,
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 120000
        }
      );

      // 解析诊断信息
      const diagnostics = this.parseDiagnostics(typeCheckTime);

      this.report.performanceImpact = {
        totalTypeCheckTime: Date.now() - startTime,
        slowFiles: diagnostics.slowFiles,
        memoryUsage: diagnostics.memoryUsage,
        complexityScore: diagnostics.complexityScore
      };

      console.log(`   类型检查时间: ${this.report.performanceImpact.totalTypeCheckTime}ms`);
      console.log(`   内存使用: ${Math.round(this.report.performanceImpact.memoryUsage / 1024 / 1024)}MB`);
      console.log(`   复杂度评分: ${this.report.performanceImpact.complexityScore}`);

    } catch (error) {
      console.log('   ⚠️  性能分析失败，使用默认值');

      this.report.performanceImpact = {
        totalTypeCheckTime: Date.now() - startTime,
        slowFiles: [],
        memoryUsage: 0,
        complexityScore: 0
      };
    }

    console.log('✅ 性能分析完成\n');
  }

  /**
   * 解析TypeScript错误
   */
  private parseTypeScriptErrors(output: string, directory: string): TypeSafetyIssue[] {
    const issues: TypeSafetyIssue[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // TypeScript错误格式: file(line,column): error TScode: message
      const match = line.match(/^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.+)$/);

      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;

        issues.push({
          id: `ts-${code}-${file}-${lineNum}-${colNum}`,
          file: path.join(directory, file),
          line: parseInt(lineNum),
          column: parseInt(colNum),
          severity: severity as 'error' | 'warning',
          code: `TS${code}`,
          message,
          category: this.categorizeTypeScriptError(`TS${code}`),
          impact: this.assessImpact(`TS${code}`, severity as 'error' | 'warning'),
          suggestion: this.getSuggestion(`TS${code}`),
          autoFixable: this.isAutoFixable(`TS${code}`)
        });
      }
    }

    return issues;
  }

  /**
   * 解析ESLint结果
   */
  private parseESLintResults(results: any[]): TypeSafetyIssue[] {
    const issues: TypeSafetyIssue[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        if (message.ruleId && message.ruleId.startsWith('@typescript-eslint/')) {
          issues.push({
            id: `eslint-${message.ruleId}-${result.filePath}-${message.line}`,
            file: result.filePath,
            line: message.line,
            column: message.column,
            severity: message.severity === 2 ? 'error' : 'warning',
            code: message.ruleId,
            message: message.message,
            category: this.categorizeESLintError(message.ruleId),
            impact: this.assessImpact(message.ruleId, message.severity === 2 ? 'error' : 'warning'),
            suggestion: this.getESLintSuggestion(message.ruleId),
            autoFixable: message.fix !== undefined
          });
        }
      }
    }

    return issues;
  }

  /**
   * 解析诊断信息
   */
  private parseDiagnostics(output: string): {
    slowFiles: Array<{ file: string; time: number }>;
    memoryUsage: number;
    complexityScore: number;
  } {
    const slowFiles: Array<{ file: string; time: number }> = [];
    let memoryUsage = 0;
    let complexityScore = 0;

    const lines = output.split('\n');
    for (const line of lines) {
      // 解析文件检查时间
      const timeMatch = line.match(/Files:\s+(\d+)/);
      if (timeMatch) {
        complexityScore += parseInt(timeMatch[1]);
      }

      // 解析内存使用
      const memoryMatch = line.match(/Memory:\s+(\d+)MB/);
      if (memoryMatch) {
        memoryUsage = parseInt(memoryMatch[1]) * 1024 * 1024;
      }
    }

    return { slowFiles, memoryUsage, complexityScore };
  }

  /**
   * 分类TypeScript错误
   */
  private categorizeTypeScriptError(code: string): IssueCategory {
    const categories: Record<string, IssueCategory> = {
      'TS2304': { type: 'type', subcategory: 'missing-definition' },
      'TS2322': { type: 'type', subcategory: 'assignment' },
      'TS2339': { type: 'type', subcategory: 'property-access' },
      'TS7006': { type: 'type', subcategory: 'implicit-any' },
      'TS2582': { type: 'type', subcategory: 'unused-variable' },
      'TS2561': { type: 'type', subcategory: 'property-access' },
      'TS2769': { type: 'type', subcategory: 'overload' },
      'TS2345': { type: 'type', subcategory: 'argument-type' }
    };

    return categories[code] || { type: 'type', subcategory: 'general' };
  }

  /**
   * 分类ESLint错误
   */
  private categorizeESLintError(ruleId: string): IssueCategory {
    const categories: Record<string, IssueCategory> = {
      '@typescript-eslint/no-unused-vars': { type: 'type', subcategory: 'unused-variable' },
      '@typescript-eslint/no-explicit-any': { type: 'type', subcategory: 'explicit-any' },
      '@typescript-eslint/explicit-function-return-type': { type: 'type', subcategory: 'missing-return-type' },
      '@typescript-eslint/no-non-null-assertion': { type: 'type', subcategory: 'null-assertion' },
      '@typescript-eslint/prefer-nullish-coalescing': { type: 'type', subcategory: 'nullish-operation' }
    };

    return categories[ruleId] || { type: 'type', subcategory: 'eslint-general' };
  }

  /**
   * 评估影响程度
   */
  private assessImpact(code: string, severity: 'error' | 'warning'): ImpactLevel {
    const impacts: Record<string, ImpactLevel> = {
      'TS2304': { level: 'critical', description: '类型定义缺失', estimatedFixTime: 5 },
      'TS2322': { level: 'high', description: '类型不匹配', estimatedFixTime: 10 },
      'TS2339': { level: 'high', description: '属性访问错误', estimatedFixTime: 8 },
      'TS7006': { level: 'medium', description: '隐式any类型', estimatedFixTime: 3 },
      'TS2345': { level: 'high', description: '参数类型错误', estimatedFixTime: 5 }
    };

    const baseImpact = impacts[code] || {
      level: severity === 'error' ? 'medium' : 'low' as const,
      description: '一般类型问题',
      estimatedFixTime: 5
    };

    // 警告降级
    if (severity === 'warning' && baseImpact.level === 'critical') {
      return { ...baseImpact, level: 'medium' as const };
    }

    return baseImpact;
  }

  /**
   * 获取修复建议
   */
  private getSuggestion(code: string): string | undefined {
    const suggestions: Record<string, string> = {
      'TS2304': '检查导入路径或添加类型声明文件',
      'TS2322': '检查类型兼容性，可能需要类型转换或修改类型定义',
      'TS2339': '检查对象结构或添加类型定义',
      'TS7006': '添加显式类型注解',
      'TS2561': '使用可选链操作符或检查对象是否存在',
      'TS2345': '检查参数类型是否符合函数签名'
    };

    return suggestions[code];
  }

  /**
   * 获取ESLint修复建议
   */
  private getESLintSuggestion(ruleId: string): string | undefined {
    const suggestions: Record<string, string> = {
      '@typescript-eslint/no-unused-vars': '删除未使用的变量或添加下划线前缀',
      '@typescript-eslint/no-explicit-any': '使用具体类型替换any',
      '@typescript-eslint/explicit-function-return-type': '添加函数返回类型注解',
      '@typescript-eslint/no-non-null-assertion': '使用可选链或空值检查替代非空断言',
      '@typescript-eslint/prefer-nullish-coalescing': '使用nullish coalescing operator (??)'
    };

    return suggestions[ruleId];
  }

  /**
   * 检查是否可自动修复
   */
  private isAutoFixable(code: string): boolean {
    const autoFixableCodes = [
      'TS7006', // 隐式any
      'TS2561', // 属性不存在
      'TS2345', // 参数类型错误
      'TS2582'  // 未使用变量
    ];

    return autoFixableCodes.includes(code);
  }

  /**
   * 生成报告
   */
  private generateReport(): void {
    const issuesByCategory: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};

    // 统计问题
    for (const issue of this.issues) {
      issuesByCategory[issue.category.type] = (issuesByCategory[issue.category.type] || 0) + 1;
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
    }

    // 生成推荐
    const recommendations = this.generateRecommendations();

    // 获取最严重的问题
    const topIssues = this.issues
      .filter(issue => issue.severity === 'error')
      .sort((a, b) => {
        const priority = { critical: 3, high: 2, medium: 1, low: 0 };
        return priority[b.impact.level] - priority[a.impact.level];
      })
      .slice(0, 10);

    this.report = {
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      totalIssues: this.issues.length,
      errors: this.issues.filter(i => i.severity === 'error').length,
      warnings: this.issues.filter(i => i.severity === 'warning').length,
      files: new Set(this.issues.map(i => i.file)).size,
      issuesByCategory,
      issuesBySeverity,
      performanceImpact: this.report.performanceImpact,
      recommendations,
      topIssues
    };
  }

  /**
   * 生成推荐
   */
  private generateRecommendations(): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 基于问题类型的推荐
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    if (errorCount > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'error-resolution',
        description: `发现${errorCount}个类型错误，需要立即修复`,
        action: '运行类型安全修复工具或手动修复错误',
        estimatedEffort: `${errorCount * 10}分钟`,
        impact: '确保类型安全，提高代码质量'
      });
    }

    // 基于性能的推荐
    if (this.report.performanceImpact.totalTypeCheckTime > 30000) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        description: '类型检查时间过长，影响开发体验',
        action: '优化项目结构，启用增量编译，考虑使用项目引用',
        estimatedEffort: '2-4小时',
        impact: '提高构建速度，改善开发体验'
      });
    }

    // 基于复杂度的推荐
    if (this.report.performanceImpact.complexityScore > 1000) {
      recommendations.push({
        priority: 'medium',
        category: 'complexity',
        description: '项目复杂度较高，建议进行模块化重构',
        action: '拆分大型模块，减少依赖关系，优化导入结构',
        estimatedEffort: '1-2天',
        impact: '降低维护成本，提高代码可读性'
      });
    }

    return recommendations;
  }

  /**
   * 输出结果
   */
  private outputResults(): void {
    const format = this.options.outputFormat || 'text';

    switch (format) {
      case 'json':
        console.log(JSON.stringify(this.report, null, 2));
        break;
      case 'markdown':
        this.outputMarkdown();
        break;
      default:
        this.outputText();
    }
  }

  /**
   * 文本格式输出
   */
  private outputText(): void {
    console.log('📊 类型安全检查报告');
    console.log('='.repeat(50));
    console.log(`📅 检查时间: ${this.report.timestamp}`);
    console.log(`📁 项目路径: ${this.report.projectRoot}`);
    console.log(`📄 检查文件: ${this.report.files}`);
    console.log(`🔍 总问题数: ${this.report.totalIssues}`);
    console.log(`❌ 错误: ${this.report.errors}`);
    console.log(`⚠️  警告: ${this.report.warnings}`);
    console.log('');

    // 问题分类统计
    console.log('📈 问题分类统计:');
    for (const [category, count] of Object.entries(this.report.issuesByCategory)) {
      console.log(`   ${category}: ${count}`);
    }
    console.log('');

    // 性能指标
    console.log('⚡ 性能指标:');
    console.log(`   类型检查时间: ${this.report.performanceImpact.totalTypeCheckTime}ms`);
    console.log(`   内存使用: ${Math.round(this.report.performanceImpact.memoryUsage / 1024 / 1024)}MB`);
    console.log(`   复杂度评分: ${this.report.performanceImpact.complexityScore}`);
    console.log('');

    // 推荐
    if (this.report.recommendations.length > 0) {
      console.log('💡 修复建议:');
      for (const rec of this.report.recommendations) {
        const priority = rec.priority === 'critical' ? '🚨' :
                        rec.priority === 'high' ? '⚠️' :
                        rec.priority === 'medium' ? '💭' : '💡';
        console.log(`   ${priority} ${rec.description}`);
        console.log(`      行动: ${rec.action}`);
        console.log(`      工作量: ${rec.estimatedEffort}`);
        console.log(`      影响: ${rec.impact}`);
        console.log('');
      }
    }

    // 主要问题
    if (this.report.topIssues.length > 0) {
      console.log('🔥 主要问题 (前10个):');
      for (const issue of this.report.topIssues) {
        const severity = issue.severity === 'error' ? '❌' : '⚠️';
        const autoFix = issue.autoFixable ? '🔧' : '👋';
        console.log(`   ${severity} ${autoFix} ${issue.file}:${issue.line}:${issue.column}`);
        console.log(`      ${issue.code}: ${issue.message}`);
        if (issue.suggestion) {
          console.log(`      💡 建议: ${issue.suggestion}`);
        }
        console.log(`      ⏱️  预计修复时间: ${issue.impact.estimatedFixTime}分钟`);
        console.log('');
      }
    }
  }

  /**
   * Markdown格式输出
   */
  private outputMarkdown(): void {
    console.log('# TypeScript 类型安全检查报告\n');
    console.log(`- **检查时间**: ${this.report.timestamp}`);
    console.log(`- **项目路径**: ${this.report.projectRoot}`);
    console.log(`- **检查文件数**: ${this.report.files}`);
    console.log(`- **总问题数**: ${this.report.totalIssues}`);
    console.log(`- **错误数**: ${this.report.errors}`);
    console.log(`- **警告数**: ${this.report.warnings}\n`);

    console.log('## 📊 问题统计\n');
    console.log('### 按分类');
    for (const [category, count] of Object.entries(this.report.issuesByCategory)) {
      console.log(`- **${category}**: ${count}`);
    }

    console.log('\n### 按严重程度');
    for (const [severity, count] of Object.entries(this.report.issuesBySeverity)) {
      const emoji = severity === 'error' ? '❌' : '⚠️';
      console.log(`- **${severity}**: ${count} ${emoji}`);
    }

    console.log('\n## ⚡ 性能指标\n');
    console.log(`- **类型检查时间**: ${this.report.performanceImpact.totalTypeCheckTime}ms`);
    console.log(`- **内存使用**: ${Math.round(this.report.performanceImpact.memoryUsage / 1024 / 1024)}MB`);
    console.log(`- **复杂度评分**: ${this.report.performanceImpact.complexityScore}`);

    console.log('\n## 💡 修复建议\n');
    for (const rec of this.report.recommendations) {
      const priority = rec.priority === 'critical' ? '🚨' :
                      rec.priority === 'high' ? '⚠️' :
                      rec.priority === 'medium' ? '💭' : '💡';
      console.log(`### ${priority} ${rec.description}`);
      console.log(`- **行动**: ${rec.action}`);
      console.log(`- **工作量**: ${rec.estimatedEffort}`);
      console.log(`- **影响**: ${rec.impact}\n`);
    }

    console.log('\n## 🔥 主要问题\n');
    for (const issue of this.report.topIssues) {
      const severity = issue.severity === 'error' ? '❌' : '⚠️';
      const autoFix = issue.autoFixable ? '🔧' : '👋';
      console.log(`### ${severity} ${autoFix} ${issue.file}:${issue.line}:${issue.column}`);
      console.log(`**${issue.code}**: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`**建议**: ${issue.suggestion}`);
      }
      console.log(`**预计修复时间**: ${issue.impact.estimatedFixTime}分钟\n`);
    }
  }

  /**
   * 执行自动修复
   */
  private async performAutoFix(): Promise<void> {
    console.log('🔧 执行自动修复...');

    const autoFixableIssues = this.issues.filter(issue => issue.autoFixable);
    console.log(`   发现 ${autoFixableIssues.length} 个可自动修复的问题`);

    try {
      // 运行ESLint自动修复
      execSync(
        `npx eslint "${CONFIG.includeDirs.join(' ')}" --ext .ts,.tsx --fix`,
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 120000
        }
      );

      console.log('   ✅ ESLint自动修复完成');

      // TODO: 添加更多自动修复逻辑

    } catch (error) {
      console.log('   ⚠️  自动修复部分失败');
    }

    console.log('✅ 自动修复完成\n');
  }

  /**
   * 初始化报告
   */
  private initializeReport(): TypeSafetyReport {
    return {
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      files: 0,
      issuesByCategory: {},
      issuesBySeverity: {},
      performanceImpact: {
        totalTypeCheckTime: 0,
        slowFiles: [],
        memoryUsage: 0,
        complexityScore: 0
      },
      recommendations: [],
      topIssues: []
    };
  }
}

// ==================== CLI接口 ====================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    strict: args.includes('--strict'),
    verbose: args.includes('--verbose'),
    autoFix: args.includes('--auto-fix'),
    outputFormat: args.includes('--json') ? 'json' as const :
                   args.includes('--markdown') ? 'markdown' as const :
                   'text' as const
  };

  const projectRoot = process.cwd();

  const checker = new TypeSafetyChecker(projectRoot, options);

  try {
    const report = await checker.run();

    // 设置退出码
    if (report.errors > 0) {
      process.exit(1);
    } else if (report.warnings > 0) {
      process.exit(2);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(3);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

export { TypeSafetyChecker, TypeSafetyReport, TypeSafetyIssue };