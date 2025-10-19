/**
 * 类型安全质量门禁系统
 * 定义和执行类型安全的质量标准和检查规则
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface QualityGateConfig {
  /** 质量门禁名称 */
  name: string;
  /** 质量标准 */
  standards: QualityStandard[];
  /** 检查规则 */
  rules: QualityRule[];
  /** 失败策略 */
  failureStrategy: 'fail' | 'warn' | 'ignore';
  /** 排除的文件模式 */
  excludePatterns: string[];
  /** 自定义阈值 */
  customThresholds?: Record<string, number>;
}

export interface QualityStandard {
  /** 标准ID */
  id: string;
  /** 标准名称 */
  name: string;
  /** 标准描述 */
  description: string;
  /** 最低要求 */
  minimum: number;
  /** 目标值 */
  target: number;
  /** 权重 */
  weight: number;
  /** 检查类型 */
  checkType: 'compilation' | 'linting' | 'coverage' | 'complexity' | 'consistency';
  /** 是否为关键标准 */
  critical: boolean;
}

export interface QualityRule {
  /** 规则ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则类型 */
  type: 'error' | 'warning' | 'info';
  /** 规则模式 */
  pattern: string | RegExp;
  /** 规则描述 */
  description: string;
  /** 修复建议 */
  suggestion?: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 是否启用 */
  enabled: boolean;
}

export interface QualityGateResult {
  /** 门禁名称 */
  gateName: string;
  /** 检查时间 */
  timestamp: string;
  /** 是否通过 */
  passed: boolean;
  /** 总体评分 */
  overallScore: number;
  /** 标准评分 */
  standardScores: StandardScore[];
  /** 违规的规则 */
  violations: RuleViolation[];
  /** 质量指标 */
  metrics: QualityMetrics;
  /** 改进建议 */
  recommendations: string[];
  /** 影响评估 */
  impact: ImpactAssessment;
}

export interface StandardScore {
  /** 标准ID */
  standardId: string;
  /** 标准名称 */
  standardName: string;
  /** 实际值 */
  actualValue: number;
  /** 目标值 */
  targetValue: number;
  /** 最低要求 */
  minimumValue: number;
  /** 得分 */
  score: number;
  /** 是否达标 */
  passed: boolean;
  /** 权重 */
  weight: number;
}

export interface RuleViolation {
  /** 规则ID */
  ruleId: string;
  /** 规则名称 */
  ruleName: string;
  /** 文件路径 */
  filePath?: string;
  /** 行号 */
  line?: number;
  /** 列号 */
  column?: number;
  /** 违规消息 */
  message: string;
  /** 严重程度 */
  severity: string;
  /** 修复建议 */
  suggestion?: string;
}

export interface QualityMetrics {
  /** TypeScript编译错误数 */
  compilationErrors: number;
  /** ESLint错误数 */
  lintErrors: number;
  /** ESLint警告数 */
  lintWarnings: number;
  /** 类型覆盖率 */
  typeCoverage: number;
  /** any类型使用次数 */
  anyTypeUsage: number;
  /** unknown类型使用次数 */
  unknownTypeUsage: number;
  /** 类型复杂度 */
  typeComplexity: number;
  /** 类型一致性评分 */
  consistencyScore: number;
  /** 代码行数 */
  totalLines: number;
  /** 类型定义行数 */
  typeDefinitionLines: number;
}

export interface ImpactAssessment {
  /** 影响等级 */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** 技术债务估算 */
  technicalDebt: {
    hours: number;
    complexity: 'low' | 'medium' | 'high';
  };
  /** 影响的模块 */
  affectedModules: string[];
  /** 业务风险 */
  businessRisk: 'low' | 'medium' | 'high';
  /** 修复优先级 */
  fixPriority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 质量门禁系统
 */
export class QualityGateSystem {
  private config: QualityGateConfig;
  private results: QualityGateResult[] = [];

  constructor(config?: Partial<QualityGateConfig>) {
    this.config = {
      name: 'TypeScript类型安全质量门禁',
      failureStrategy: 'fail',
      excludePatterns: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**'
      ],
      standards: this.getDefaultStandards(),
      rules: this.getDefaultRules(),
      ...config
    };
  }

  /**
   * 执行质量门禁检查
   */
  async execute(): Promise<QualityGateResult> {
    console.log(`🚪 执行质量门禁检查: ${this.config.name}`);

    const result: QualityGateResult = {
      gateName: this.config.name,
      timestamp: new Date().toISOString(),
      passed: false,
      overallScore: 0,
      standardScores: [],
      violations: [],
      metrics: await this.collectMetrics(),
      recommendations: [],
      impact: {
        level: 'low',
        technicalDebt: { hours: 0, complexity: 'low' },
        affectedModules: [],
        businessRisk: 'low',
        fixPriority: 'low'
      }
    };

    try {
      // 1. 评估各项标准
      await this.evaluateStandards(result);

      // 2. 检查规则违规
      await this.checkRuleViolations(result);

      // 3. 计算总体评分
      this.calculateOverallScore(result);

      // 4. 生成改进建议
      this.generateRecommendations(result);

      // 5. 评估影响
      this.assessImpact(result);

      // 6. 确定是否通过
      this.determinePassStatus(result);

      // 7. 保存结果
      this.saveResult(result);

      console.log(`✅ 质量门禁检查完成: ${result.passed ? '通过' : '失败'} (评分: ${result.overallScore}/100)`);

    } catch (error) {
      console.error('❌ 质量门禁检查失败:', error.message);
      result.passed = false;
      result.violations.push({
        ruleId: 'GATE_EXECUTION_FAILED',
        ruleName: '门禁执行失败',
        message: `质量门禁执行过程中发生错误: ${error.message}`,
        severity: 'critical',
        suggestion: '检查配置和依赖，确保环境正确'
      });
    }

    return result;
  }

  /**
   * 收集质量指标
   */
  private async collectMetrics(): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      compilationErrors: 0,
      lintErrors: 0,
      lintWarnings: 0,
      typeCoverage: 0,
      anyTypeUsage: 0,
      unknownTypeUsage: 0,
      typeComplexity: 0,
      consistencyScore: 0,
      totalLines: 0,
      typeDefinitionLines: 0
    };

    try {
      // TypeScript编译错误
      const compileOutput = execSync('pnpm run type-check', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      metrics.compilationErrors = 0; // 如果没有输出，说明没有错误
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || '';
      metrics.compilationErrors = (errorOutput.match(/error/g) || []).length;
    }

    try {
      // ESLint检查
      const eslintOutput = execSync('pnpm eslint src/ --ext .ts,.tsx --format=json', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const eslintResults = JSON.parse(eslintOutput);

      for (const file of eslintResults) {
        for (const message of file.messages) {
          if (message.severity === 2) {
            metrics.lintErrors++;
          } else {
            metrics.lintWarnings++;
          }
        }
      }
    } catch (error) {
      // ESLint可能返回非零退出码但仍然输出JSON
      try {
        const errorOutput = error.stdout || error.stderr || '';
        if (errorOutput.startsWith('[')) {
          const eslintResults = JSON.parse(errorOutput);
          for (const file of eslintResults) {
            for (const message of file.messages) {
              if (message.severity === 2) {
                metrics.lintErrors++;
              } else {
                metrics.lintWarnings++;
              }
            }
          }
        }
      } catch (parseError) {
        // 忽略解析错误
      }
    }

    // 类型覆盖率
    try {
      const coverageOutput = execSync('pnpm exec type-coverage --detail', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const match = coverageOutput.match(/(\d+\.\d+)%/);
      if (match) {
        metrics.typeCoverage = parseFloat(match[1]);
      }
    } catch (error) {
      // type-coverage可能未安装
      console.warn('⚠️ type-coverage未安装，跳过类型覆盖率分析');
    }

    // 代码行数统计
    try {
      const sourceFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim().split('\n');

      for (const file of sourceFiles) {
        try {
          const content = execSync(`wc -l "${file}"`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          const lines = parseInt(content.trim().split(' ')[0]);
          metrics.totalLines += lines;

          // 检查是否为类型定义文件
          if (file.includes('/types/') || file.endsWith('.d.ts')) {
            metrics.typeDefinitionLines += lines;
          }
        } catch (error) {
          // 忽略单个文件的错误
        }
      }
    } catch (error) {
      // 忽略文件统计错误
    }

    // any和unknown类型使用统计
    try {
      const anyOutput = execSync('grep -r "\\bany\\b" src/ --include="*.ts" --include="*.tsx" | wc -l', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      metrics.anyTypeUsage = parseInt(anyOutput.trim()) || 0;

      const unknownOutput = execSync('grep -r "\\bunknown\\b" src/ --include="*.ts" --include="*.tsx" | wc -l', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      metrics.unknownTypeUsage = parseInt(unknownOutput.trim()) || 0;
    } catch (error) {
      // 忽略grep错误
    }

    // 计算类型复杂度和一致性
    metrics.typeComplexity = this.calculateTypeComplexity();
    metrics.consistencyScore = this.calculateConsistencyScore();

    return metrics;
  }

  /**
   * 评估质量标准
   */
  private async evaluateStandards(result: QualityGateResult): Promise<void> {
    for (const standard of this.config.standards) {
      if (!standard.enabled) continue;

      const score = await this.evaluateStandard(standard, result.metrics);
      result.standardScores.push(score);
    }
  }

  /**
   * 评估单个标准
   */
  private async evaluateStandard(
    standard: QualityStandard,
    metrics: QualityMetrics
  ): Promise<StandardScore> {
    let actualValue = 0;

    switch (standard.checkType) {
      case 'compilation':
        actualValue = metrics.compilationErrors === 0 ? 100 : 0;
        break;
      case 'linting':
        const totalLintIssues = metrics.lintErrors + metrics.lintWarnings;
        actualValue = totalLintIssues === 0 ? 100 : Math.max(0, 100 - totalLintIssues * 5);
        break;
      case 'coverage':
        actualValue = metrics.typeCoverage;
        break;
      case 'complexity':
        actualValue = Math.max(0, 100 - metrics.typeComplexity * 2);
        break;
      case 'consistency':
        actualValue = metrics.consistencyScore;
        break;
    }

    // 应用自定义阈值
    const minimum = this.config.customThresholds?.[`${standard.id}_minimum`] || standard.minimum;
    const target = this.config.customThresholds?.[`${standard.id}_target`] || standard.target;

    // 计算得分
    let score = 0;
    if (actualValue >= target) {
      score = 100;
    } else if (actualValue >= minimum) {
      score = 50 + ((actualValue - minimum) / (target - minimum)) * 50;
    } else {
      score = (actualValue / minimum) * 50;
    }

    return {
      standardId: standard.id,
      standardName: standard.name,
      actualValue,
      targetValue: target,
      minimumValue: minimum,
      score: Math.round(score),
      passed: actualValue >= minimum,
      weight: standard.weight
    };
  }

  /**
   * 检查规则违规
   */
  private async checkRuleViolations(result: QualityGateResult): Promise<void> {
    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;

      const violations = await this.checkRule(rule, result.metrics);
      result.violations.push(...violations);
    }
  }

  /**
   * 检查单个规则
   */
  private async checkRule(
    rule: QualityRule,
    metrics: QualityMetrics
  ): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    switch (rule.id) {
      case 'no_compilation_errors':
        if (metrics.compilationErrors > 0) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: `发现 ${metrics.compilationErrors} 个TypeScript编译错误`,
            severity: rule.severity,
            suggestion: rule.suggestion
          });
        }
        break;

      case 'no_lint_errors':
        if (metrics.lintErrors > 0) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: `发现 ${metrics.lintErrors} 个ESLint错误`,
            severity: rule.severity,
            suggestion: rule.suggestion
          });
        }
        break;

      case 'min_type_coverage':
        if (metrics.typeCoverage < 70) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: `类型覆盖率 ${metrics.typeCoverage}% 低于最低要求 70%`,
            severity: rule.severity,
            suggestion: rule.suggestion
          });
        }
        break;

      case 'limit_any_usage':
        if (metrics.anyTypeUsage > 10) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: `any类型使用次数 ${metrics.anyTypeUsage} 超过限制`,
            severity: rule.severity,
            suggestion: rule.suggestion
          });
        }
        break;

      case 'type_consistency':
        if (metrics.consistencyScore < 80) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: `类型一致性评分 ${metrics.consistencyScore} 低于要求`,
            severity: rule.severity,
            suggestion: rule.suggestion
          });
        }
        break;
    }

    return violations;
  }

  /**
   * 计算总体评分
   */
  private calculateOverallScore(result: QualityGateResult): void {
    let totalScore = 0;
    let totalWeight = 0;

    for (const score of result.standardScores) {
      totalScore += score.score * score.weight;
      totalWeight += score.weight;
    }

    result.overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(result: QualityGateResult): void {
    const recommendations: string[] = [];

    // 基于标准评分生成建议
    for (const score of result.standardScores) {
      if (!score.passed) {
        switch (score.standardId) {
          case 'compilation':
            recommendations.push('修复所有TypeScript编译错误，确保代码可以正常构建');
            break;
          case 'linting':
            recommendations.push('修复ESLint错误，提高代码质量和一致性');
            break;
          case 'coverage':
            recommendations.push(`提高类型覆盖率从 ${score.actualValue}% 到 ${score.targetValue}%`);
            break;
          case 'complexity':
            recommendations.push('简化类型定义，降低类型复杂度');
            break;
          case 'consistency':
            recommendations.push('统一类型定义风格，提高代码一致性');
            break;
        }
      }
    }

    // 基于违规生成建议
    for (const violation of result.violations) {
      if (violation.suggestion && !recommendations.includes(violation.suggestion)) {
        recommendations.push(violation.suggestion);
      }
    }

    // 基于指标生成建议
    if (result.metrics.anyTypeUsage > 5) {
      recommendations.push('逐步替换any类型为更具体的类型定义');
    }

    if (result.metrics.lintWarnings > 20) {
      recommendations.push('处理ESLint警告，进一步提高代码质量');
    }

    result.recommendations = recommendations;
  }

  /**
   * 评估影响
   */
  private assessImpact(result: QualityGateResult): void {
    let impactLevel: ImpactAssessment['level'] = 'low';
    let technicalDebtHours = 0;
    const affectedModules: string[] = [];

    // 计算技术债务
    technicalDebtHours += result.metrics.compilationErrors * 2; // 每个编译错误2小时
    technicalDebtHours += result.metrics.lintErrors * 0.5; // 每个ESLint错误0.5小时
    technicalDebtHours += (70 - result.metrics.typeCoverage) * 0.1; // 覆盖率每1% 0.1小时

    // 确定影响等级
    const criticalViolations = result.violations.filter(v => v.severity === 'critical');
    const highViolations = result.violations.filter(v => v.severity === 'high');

    if (criticalViolations.length > 0 || result.overallScore < 50) {
      impactLevel = 'critical';
    } else if (highViolations.length > 3 || result.overallScore < 70) {
      impactLevel = 'high';
    } else if (result.violations.length > 5 || result.overallScore < 85) {
      impactLevel = 'medium';
    }

    // 确定业务风险和修复优先级
    let businessRisk: ImpactAssessment['businessRisk'] = 'low';
    let fixPriority: ImpactAssessment['fixPriority'] = 'low';

    if (impactLevel === 'critical') {
      businessRisk = 'high';
      fixPriority = 'critical';
    } else if (impactLevel === 'high') {
      businessRisk = 'medium';
      fixPriority = 'high';
    } else if (impactLevel === 'medium') {
      businessRisk = 'low';
      fixPriority = 'medium';
    }

    result.impact = {
      level: impactLevel,
      technicalDebt: {
        hours: Math.round(technicalDebtHours),
        complexity: technicalDebtHours > 20 ? 'high' : technicalDebtHours > 8 ? 'medium' : 'low'
      },
      affectedModules,
      businessRisk,
      fixPriority
    };
  }

  /**
   * 确定通过状态
   */
  private determinePassStatus(result: QualityGateResult): void {
    // 检查关键标准
    const criticalStandards = this.config.standards.filter(s => s.critical);
    const criticalFailed = criticalStandards.some(standard => {
      const score = result.standardScores.find(s => s.standardId === standard.id);
      return !score || !score.passed;
    });

    // 检查关键违规
    const criticalViolations = result.violations.filter(v => v.severity === 'critical');

    if (criticalFailed || criticalViolations.length > 0) {
      result.passed = false;
      return;
    }

    // 根据失败策略决定
    switch (this.config.failureStrategy) {
      case 'fail':
        result.passed = result.overallScore >= 70;
        break;
      case 'warn':
        result.passed = true; // 警告模式总是通过
        break;
      case 'ignore':
        result.passed = true; // 忽略模式总是通过
        break;
    }
  }

  /**
   * 保存结果
   */
  private saveResult(result: QualityGateResult): void {
    this.results.push(result);

    // 保存到文件
    const resultsDir = join(process.cwd(), '.quality-gate-results');
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    const resultFile = join(resultsDir, `gate-${Date.now()}.json`);
    writeFileSync(resultFile, JSON.stringify(result, null, 2));

    // 更新最新结果
    const latestFile = join(resultsDir, 'latest.json');
    writeFileSync(latestFile, JSON.stringify(result, null, 2));
  }

  /**
   * 计算类型复杂度
   */
  private calculateTypeComplexity(): number {
    // 简化实现，基于文件数量和类型使用情况
    try {
      const typeFiles = execSync('find src -name "*.d.ts" -o -path "*/types/*" -name "*.ts"', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim().split('\n').filter(Boolean);

      return Math.min(50, typeFiles.length);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 计算一致性评分
   */
  private calculateConsistencyScore(): number {
    // 简化实现，基于any类型使用和编译错误
    const metrics = this.collectMetrics();
    let score = 100;

    if (metrics.compilationErrors > 0) {
      score -= metrics.compilationErrors * 10;
    }

    if (metrics.anyTypeUsage > 0) {
      score -= metrics.anyTypeUsage * 2;
    }

    return Math.max(0, score);
  }

  /**
   * 获取默认标准
   */
  private getDefaultStandards(): QualityStandard[] {
    return [
      {
        id: 'compilation',
        name: 'TypeScript编译',
        description: '代码必须无TypeScript编译错误',
        minimum: 100,
        target: 100,
        weight: 30,
        checkType: 'compilation',
        critical: true,
        enabled: true
      },
      {
        id: 'linting',
        name: 'ESLint检查',
        description: '代码必须通过ESLint类型规则检查',
        minimum: 90,
        target: 100,
        weight: 25,
        checkType: 'linting',
        critical: true,
        enabled: true
      },
      {
        id: 'coverage',
        name: '类型覆盖率',
        description: '类型定义覆盖率应达到要求',
        minimum: 70,
        target: 85,
        weight: 25,
        checkType: 'coverage',
        critical: false,
        enabled: true
      },
      {
        id: 'complexity',
        name: '类型复杂度',
        description: '类型定义应保持适当的复杂度',
        minimum: 60,
        target: 80,
        weight: 10,
        checkType: 'complexity',
        critical: false,
        enabled: true
      },
      {
        id: 'consistency',
        name: '类型一致性',
        description: '类型定义应保持一致的风格',
        minimum: 80,
        target: 95,
        weight: 10,
        checkType: 'consistency',
        critical: false,
        enabled: true
      }
    ];
  }

  /**
   * 获取默认规则
   */
  private getDefaultRules(): QualityRule[] {
    return [
      {
        id: 'no_compilation_errors',
        name: '无编译错误',
        type: 'error',
        pattern: /error/g,
        description: '不允许有TypeScript编译错误',
        suggestion: '修复所有TypeScript编译错误',
        severity: 'critical',
        enabled: true
      },
      {
        id: 'no_lint_errors',
        name: '无ESLint错误',
        type: 'error',
        pattern: /error/g,
        description: '不允许有ESLint错误',
        suggestion: '修复所有ESLint错误',
        severity: 'high',
        enabled: true
      },
      {
        id: 'min_type_coverage',
        name: '最低类型覆盖率',
        type: 'warning',
        pattern: /\d+\.\d+%/,
        description: '类型覆盖率不能低于70%',
        suggestion: '增加类型定义以提高覆盖率',
        severity: 'medium',
        enabled: true
      },
      {
        id: 'limit_any_usage',
        name: '限制any使用',
        type: 'warning',
        pattern: /\bany\b/g,
        description: '限制any类型的使用',
        suggestion: '使用具体类型替换any类型',
        severity: 'medium',
        enabled: true
      },
      {
        id: 'type_consistency',
        name: '类型一致性',
        type: 'info',
        pattern: /interface|type|enum/g,
        description: '保持类型定义的一致性',
        suggestion: '统一类型定义风格和命名规范',
        severity: 'low',
        enabled: true
      }
    ];
  }

  /**
   * 获取历史结果
   */
  getHistory(): QualityGateResult[] {
    return [...this.results];
  }

  /**
   * 生成质量趋势报告
   */
  generateTrendReport(): string {
    if (this.results.length === 0) {
      return '暂无历史数据';
    }

    const recent = this.results.slice(-10); // 最近10次结果
    let report = `# 质量门禁趋势报告\n\n`;

    recent.forEach((result, index) => {
      report += `## ${index + 1}. ${result.timestamp}\n`;
      report += `- 评分: ${result.overallScore}/100\n`;
      report += `- 状态: ${result.passed ? '✅ 通过' : '❌ 失败'}\n`;
      report += `- 影响: ${result.impact.level}\n`;
      report += `- 技术债务: ${result.impact.technicalDebt.hours}小时\n\n`;
    });

    return report;
  }
}

export default QualityGateSystem;