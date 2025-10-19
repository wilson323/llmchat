/**
 * 类型回归防护系统
 * 防止类型安全问题的回归，监控类型定义的变化
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { hashElement } from 'folder-hash';

export interface TypeRegressionConfig {
  /** 项目根目录 */
  projectRoot: string;
  /** 基线数据存储目录 */
  baselineDir: string;
  /** 严格模式：拒绝任何类型回归 */
  strict?: boolean;
  /** 允许的变化类型 */
  allowedChanges: TypeChangeType[];
  /** 监控的文件模式 */
  watchPatterns: string[];
  /** 排除的文件模式 */
  excludePatterns: string[];
}

export type TypeChangeType =
  | 'interface-addition'
  | 'interface-removal'
  | 'interface-modification'
  | 'type-addition'
  | 'type-removal'
  | 'type-modification'
  | 'enum-addition'
  | 'enum-removal'
  | 'enum-modification'
  | 'export-addition'
  | 'export-removal';

export interface TypeBaseline {
  /** 基线版本 */
  version: string;
  /** 创建时间 */
  timestamp: string;
  /** 项目哈希值 */
  projectHash: string;
  /** 类型定义摘要 */
  typeDefinitions: TypeDefinitionSummary[];
  /** 文件列表 */
  files: BaselineFile[];
  /** 类型使用统计 */
  usageStats: TypeUsageStats;
  /** 依赖关系 */
  dependencies: TypeDependency[];
}

export interface TypeDefinitionSummary {
  /** 类型名称 */
  name: string;
  /** 类型种类 */
  kind: 'interface' | 'type' | 'enum' | 'class';
  /** 文件路径 */
  filePath: string;
  /** 是否导出 */
  isExported: boolean;
  /** 类型哈希值 */
  hash: string;
  /** 依赖的类型 */
  dependencies: string[];
  /** 被依赖的类型 */
  dependents: string[];
  /** 类型复杂度 */
  complexity: number;
}

export interface BaselineFile {
  /** 文件路径 */
  path: string;
  /** 文件哈希值 */
  hash: string;
  /** 类型定义数量 */
  typeCount: number;
  /** 导出的类型 */
  exportedTypes: string[];
  /** 导入的类型 */
  importedTypes: string[];
  /** 最后修改时间 */
  lastModified: string;
}

export interface TypeUsageStats {
  /** 接口数量 */
  interfaces: number;
  /** 类型别名数量 */
  typeAliases: number;
  /** 枚举数量 */
  enums: number;
  /** 泛型使用次数 */
  generics: number;
  /** any类型使用次数 */
  anyTypes: number;
  /** unknown类型使用次数 */
  unknownTypes: number;
  /** 类型断言次数 */
  typeAssertions: number;
  /** 类型守卫次数 */
  typeGuards: number;
}

export interface TypeDependency {
  /** 源类型 */
  source: string;
  /** 目标类型 */
  target: string;
  /** 依赖类型 */
  dependencyType: 'extends' | 'implements' | 'uses' | 'imports';
  /** 文件路径 */
  filePath: string;
}

export interface TypeRegressionReport {
  /** 报告ID */
  id: string;
  /** 基线版本 */
  baselineVersion: string;
  /** 当前版本 */
  currentVersion: string;
  /** 检测时间 */
  timestamp: string;
  /** 是否通过 */
  passed: boolean;
  /** 检测到的变化 */
  changes: TypeChange[];
  /** 错误信息 */
  errors: RegressionError[];
  /** 警告信息 */
  warnings: RegressionWarning[];
  /** 影响评估 */
  impactAssessment: ImpactAssessment;
}

export interface TypeChange {
  /** 变化类型 */
  type: TypeChangeType;
  /** 影响的类型名称 */
  typeName: string;
  /** 文件路径 */
  filePath: string;
  /** 变化描述 */
  description: string;
  /** 严重程度 */
  severity: 'critical' | 'major' | 'minor';
  /** 是否破坏性变更 */
  isBreaking: boolean;
  /** 影响的依赖 */
  affectedDependencies: string[];
}

export interface RegressionError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 文件路径 */
  filePath?: string;
  /** 行号 */
  line?: number;
  /** 建议修复 */
  suggestion?: string;
}

export interface RegressionWarning {
  /** 警告代码 */
  code: string;
  /** 警告消息 */
  message: string;
  /** 文件路径 */
  filePath?: string;
  /** 建议改进 */
  suggestion?: string;
}

export interface ImpactAssessment {
  /** 影响的文件数量 */
  affectedFiles: number;
  /** 影响的类型数量 */
  affectedTypes: number;
  /** 破坏性变更数量 */
  breakingChanges: number;
  /** 影响评估等级 */
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 需要人工审查的项 */
  requiresManualReview: string[];
}

/**
 * 类型回归防护器
 */
export class TypeRegressionGuard {
  private config: TypeRegressionConfig;
  private currentBaseline: TypeBaseline | null = null;

  constructor(config: Partial<TypeRegressionConfig> = {}) {
    this.config = {
      projectRoot: process.cwd(),
      baselineDir: '.type-baseline',
      strict: false,
      allowedChanges: [
        'interface-addition',
        'type-addition',
        'enum-addition',
        'export-addition'
      ],
      watchPatterns: [
        'src/**/*.ts',
        'src/**/*.tsx',
        'types/**/*.ts',
        'types/**/*.d.ts'
      ],
      excludePatterns: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**'
      ],
      ...config
    };

    // 确保基线目录存在
    const baselinePath = join(this.config.projectRoot, this.config.baselineDir);
    if (!existsSync(baselinePath)) {
      mkdirSync(baselinePath, { recursive: true });
    }
  }

  /**
   * 创建类型基线
   */
  async createBaseline(version: string, description?: string): Promise<TypeBaseline> {
    console.log(`📝 创建类型基线: v${version}`);

    const baseline: TypeBaseline = {
      version,
      timestamp: new Date().toISOString(),
      projectHash: await this.calculateProjectHash(),
      typeDefinitions: await this.extractTypeDefinitions(),
      files: await this.analyzeFiles(),
      usageStats: await this.calculateUsageStats(),
      dependencies: await this.extractDependencies()
    };

    // 保存基线
    const baselinePath = join(
      this.config.projectRoot,
      this.config.baselineDir,
      `baseline-${version}.json`
    );

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

    // 更新最新基线链接
    const latestPath = join(
      this.config.projectRoot,
      this.config.baselineDir,
      'latest.json'
    );
    writeFileSync(latestPath, JSON.stringify(baseline, null, 2));

    // 添加描述文件
    if (description) {
      const descPath = join(
        this.config.projectRoot,
        this.config.baselineDir,
        `baseline-${version}.md`
      );
      writeFileSync(
        descPath,
        `# 类型基线 v${version}\n\n创建时间: ${baseline.timestamp}\n描述: ${description}\n`
      );
    }

    this.currentBaseline = baseline;
    console.log(`✅ 类型基线创建完成: ${baselinePath}`);

    return baseline;
  }

  /**
   * 加载最新基线
   */
  async loadLatestBaseline(): Promise<TypeBaseline | null> {
    const latestPath = join(
      this.config.projectRoot,
      this.config.baselineDir,
      'latest.json'
    );

    if (!existsSync(latestPath)) {
      console.warn('⚠️ 未找到类型基线，请先创建基线');
      return null;
    }

    try {
      const baseline = JSON.parse(readFileSync(latestPath, 'utf8'));
      this.currentBaseline = baseline;
      return baseline;
    } catch (error) {
      console.error('❌ 加载类型基线失败:', error);
      return null;
    }
  }

  /**
   * 检测类型回归
   */
  async detectRegression(baseline?: TypeBaseline): Promise<TypeRegressionReport> {
    const targetBaseline = baseline || this.currentBaseline || await this.loadLatestBaseline();

    if (!targetBaseline) {
      throw new Error('无法检测类型回归：没有可用的基线');
    }

    console.log(`🔍 检测类型回归 (基线: v${targetBaseline.version})`);

    const report: TypeRegressionReport = {
      id: this.generateReportId(),
      baselineVersion: targetBaseline.version,
      currentVersion: await this.getCurrentVersion(),
      timestamp: new Date().toISOString(),
      passed: true,
      changes: [],
      errors: [],
      warnings: [],
      impactAssessment: {
        affectedFiles: 0,
        affectedTypes: 0,
        breakingChanges: 0,
        impactLevel: 'low',
        requiresManualReview: []
      }
    };

    try {
      // 获取当前类型状态
      const currentDefinitions = await this.extractTypeDefinitions();
      const currentFiles = await this.analyzeFiles();
      const currentStats = await this.calculateUsageStats();

      // 比较类型定义变化
      const typeChanges = this.compareTypeDefinitions(
        targetBaseline.typeDefinitions,
        currentDefinitions
      );
      report.changes.push(...typeChanges);

      // 比较文件变化
      const fileChanges = this.compareFiles(targetBaseline.files, currentFiles);
      report.changes.push(...fileChanges);

      // 检查编译错误
      const compilationErrors = await this.checkCompilationErrors();
      report.errors.push(...compilationErrors);

      // 检查类型使用变化
      const usageChanges = this.compareUsageStats(
        targetBaseline.usageStats,
        currentStats
      );
      report.warnings.push(...usageChanges);

      // 评估影响
      report.impactAssessment = this.assessImpact(report.changes, report.errors);

      // 确定是否通过
      report.passed = this.evaluateRegressionResult(report);

      console.log(
        report.passed
          ? '✅ 类型回归检测通过'
          : `❌ 类型回归检测失败 (${report.changes.length} 个变化, ${report.errors.length} 个错误)`
      );

      return report;

    } catch (error) {
      report.passed = false;
      report.errors.push({
        code: 'REGRESSION_DETECTION_FAILED',
        message: `回归检测过程中发生错误: ${error instanceof Error ? error.message : String(error)}`
      });
      return report;
    }
  }

  /**
   * 生成回归检测报告
   */
  generateReport(report: TypeRegressionReport): string {
    let output = `# 类型回归检测报告\n\n`;
    output += `**报告ID**: ${report.id}\n`;
    output += `**基线版本**: ${report.baselineVersion}\n`;
    output += `**当前版本**: ${report.currentVersion}\n`;
    output += `**检测时间**: ${report.timestamp}\n`;
    output += `**检测结果**: ${report.passed ? '✅ 通过' : '❌ 失败'}\n\n`;

    // 影响评估
    const impact = report.impactAssessment;
    output += `## 📊 影响评估\n\n`;
    output += `- **影响等级**: ${this.getImpactLevelEmoji(impact.impactLevel)} ${impact.impactLevel}\n`;
    output += `- **影响文件数**: ${impact.affectedFiles}\n`;
    output += `- **影响类型数**: ${impact.affectedTypes}\n`;
    output += `- **破坏性变更**: ${impact.breakingChanges}\n`;
    output += `- **需要人工审查**: ${impact.requiresManualReview.length} 项\n\n`;

    // 检测到的变化
    if (report.changes.length > 0) {
      output += `## 🔄 检测到的变化 (${report.changes.length})\n\n`;

      const changesBySeverity = this.groupChangesBySeverity(report.changes);

      Object.entries(changesBySeverity).forEach(([severity, changes]) => {
        if (changes.length > 0) {
          output += `### ${this.getSeverityEmoji(severity)} ${severity.toUpperCase()} (${changes.length})\n\n`;
          changes.forEach(change => {
            output += `- **${change.typeName}** (${change.type})\n`;
            output += `  - 文件: ${change.filePath}\n`;
            output += `  - 描述: ${change.description}\n`;
            if (change.isBreaking) {
              output += `  - ⚠️ 破坏性变更\n`;
            }
            if (change.affectedDependencies.length > 0) {
              output += `  - 影响: ${change.affectedDependencies.join(', ')}\n`;
            }
            output += `\n`;
          });
        }
      });
    }

    // 错误信息
    if (report.errors.length > 0) {
      output += `## ❌ 错误信息 (${report.errors.length})\n\n`;
      report.errors.forEach(error => {
        output += `- **${error.code}**: ${error.message}\n`;
        if (error.filePath) {
          output += `  - 文件: ${error.filePath}\n`;
        }
        if (error.line) {
          output += `  - 行号: ${error.line}\n`;
        }
        if (error.suggestion) {
          output += `  - 建议: ${error.suggestion}\n`;
        }
        output += `\n`;
      });
    }

    // 警告信息
    if (report.warnings.length > 0) {
      output += `## ⚠️ 警告信息 (${report.warnings.length})\n\n`;
      report.warnings.forEach(warning => {
        output += `- **${warning.code}**: ${warning.message}\n`;
        if (warning.filePath) {
          output += `  - 文件: ${warning.filePath}\n`;
        }
        if (warning.suggestion) {
          output += `  - 建议: ${warning.suggestion}\n`;
        }
        output += `\n`;
      });
    }

    // 建议
    output += `## 💡 改进建议\n\n`;
    const suggestions = this.generateSuggestions(report);
    suggestions.forEach((suggestion, index) => {
      output += `${index + 1}. ${suggestion}\n`;
    });

    return output;
  }

  /**
   * 保存回归检测报告
   */
  async saveReport(report: TypeRegressionReport): Promise<string> {
    const reportsDir = join(
      this.config.projectRoot,
      this.config.baselineDir,
      'reports'
    );

    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, `report-${report.id}.json`);
    const markdownPath = join(reportsDir, `report-${report.id}.md`);

    // 保存JSON格式
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 保存Markdown格式
    const markdownReport = this.generateReport(report);
    writeFileSync(markdownPath, markdownReport);

    console.log(`📄 回归检测报告已保存: ${reportPath}`);
    return reportPath;
  }

  /**
   * 计算项目哈希值
   */
  private async calculateProjectHash(): Promise<string> {
    try {
      const hashResult = await hashElement(this.config.projectRoot, {
        folders: {
          include: ['src', 'types']
        },
        files: {
          include: ['*.ts', '*.tsx'],
          exclude: ['*.test.*', '*.spec.*']
        }
      });

      return hashResult.hash;
    } catch (error) {
      console.warn('计算项目哈希失败，使用时间戳代替');
      return Date.now().toString();
    }
  }

  /**
   * 提取类型定义
   */
  private async extractTypeDefinitions(): Promise<TypeDefinitionSummary[]> {
    // 这里应该实现真正的类型定义提取逻辑
    // 为简化示例，返回空数组
    return [];
  }

  /**
   * 分析文件
   */
  private async analyzeFiles(): Promise<BaselineFile[]> {
    // 这里应该实现真正的文件分析逻辑
    // 为简化示例，返回空数组
    return [];
  }

  /**
   * 计算使用统计
   */
  private async calculateUsageStats(): Promise<TypeUsageStats> {
    // 这里应该实现真正的统计计算逻辑
    return {
      interfaces: 0,
      typeAliases: 0,
      enums: 0,
      generics: 0,
      anyTypes: 0,
      unknownTypes: 0,
      typeAssertions: 0,
      typeGuards: 0
    };
  }

  /**
   * 提取依赖关系
   */
  private async extractDependencies(): Promise<TypeDependency[]> {
    // 这里应该实现真正的依赖提取逻辑
    return [];
  }

  /**
   * 获取当前版本
   */
  private async getCurrentVersion(): Promise<string> {
    try {
      const gitHash = execSync('git rev-parse --short HEAD', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      }).trim();
      return gitHash;
    } catch {
      return Date.now().toString();
    }
  }

  /**
   * 比较类型定义
   */
  private compareTypeDefinitions(
    baseline: TypeDefinitionSummary[],
    current: TypeDefinitionSummary[]
  ): TypeChange[] {
    const changes: TypeChange[] = [];
    const baselineMap = new Map(baseline.map(t => [t.name, t]));
    const currentMap = new Map(current.map(t => [t.name, t]));

    // 检测新增的类型
    for (const [name, type] of currentMap) {
      if (!baselineMap.has(name)) {
        changes.push({
          type: `${type.kind}-addition` as TypeChangeType,
          typeName: name,
          filePath: type.filePath,
          description: `新增${type.kind}: ${name}`,
          severity: 'minor',
          isBreaking: false,
          affectedDependencies: []
        });
      }
    }

    // 检测删除的类型
    for (const [name, type] of baselineMap) {
      if (!currentMap.has(name)) {
        changes.push({
          type: `${type.kind}-removal` as TypeChangeType,
          typeName: name,
          filePath: type.filePath,
          description: `删除${type.kind}: ${name}`,
          severity: type.isExported ? 'major' : 'minor',
          isBreaking: type.isExported,
          affectedDependencies: type.dependents
        });
      }
    }

    // 检测修改的类型
    for (const [name, baselineType] of baselineMap) {
      const currentType = currentMap.get(name);
      if (currentType && baselineType.hash !== currentType.hash) {
        changes.push({
          type: `${baselineType.kind}-modification` as TypeChangeType,
          typeName: name,
          filePath: currentType.filePath,
          description: `修改${baselineType.kind}: ${name}`,
          severity: this.determineModificationSeverity(baselineType, currentType),
          isBreaking: this.isBreakingChange(baselineType, currentType),
          affectedDependencies: currentType.dependents
        });
      }
    }

    return changes;
  }

  /**
   * 比较文件变化
   */
  private compareFiles(baseline: BaselineFile[], current: BaselineFile[]): TypeChange[] {
    // 简化实现，实际应该比较文件内容变化
    return [];
  }

  /**
   * 检查编译错误
   */
  private async checkCompilationErrors(): Promise<RegressionError[]> {
    const errors: RegressionError[] = [];

    try {
      execSync('pnpm run type-check', {
        cwd: this.config.projectRoot,
        stdio: 'pipe'
      });
    } catch (error: any) {
      const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';

      // 解析TypeScript错误
      const lines = errorOutput.split('\n');
      for (const line of lines) {
        const match = line.match(/^(.+)\((\d+),\d+\):\s+(error|warning)\s+(.+)$/);
        if (match) {
          const [, filePath, lineNum, level, message] = match;
          if (level === 'error') {
            errors.push({
              code: 'TS_COMPILATION_ERROR',
              message: message.trim(),
              filePath,
              line: parseInt(lineNum),
              suggestion: '修复TypeScript编译错误'
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * 比较使用统计
   */
  private compareUsageStats(
    baseline: TypeUsageStats,
    current: TypeUsageStats
  ): RegressionWarning[] {
    const warnings: RegressionWarning[] = [];

    // 检查any类型使用增加
    if (current.anyTypes > baseline.anyTypes) {
      const increase = current.anyTypes - baseline.anyTypes;
      warnings.push({
        code: 'ANY_TYPE_USAGE_INCREASED',
        message: `any类型使用增加了 ${increase} 次`,
        suggestion: '考虑使用更具体的类型替换any类型'
      });
    }

    // 检查类型定义减少
    if (current.interfaces < baseline.interfaces) {
      warnings.push({
        code: 'INTERFACE_COUNT_DECREASED',
        message: `接口定义减少了 ${baseline.interfaces - current.interfaces} 个`,
        suggestion: '确保接口定义的减少是预期的'
      });
    }

    return warnings;
  }

  /**
   * 评估影响
   */
  private assessImpact(changes: TypeChange[], errors: RegressionError[]): ImpactAssessment {
    const affectedFiles = new Set(changes.map(c => c.filePath));
    const affectedTypes = new Set(changes.map(c => c.typeName));
    const breakingChanges = changes.filter(c => c.isBreaking).length;

    let impactLevel: ImpactAssessment['impactLevel'] = 'low';
    if (breakingChanges > 5 || errors.length > 0) {
      impactLevel = 'critical';
    } else if (breakingChanges > 2 || affectedTypes.size > 10) {
      impactLevel = 'high';
    } else if (breakingChanges > 0 || affectedTypes.size > 5) {
      impactLevel = 'medium';
    }

    const requiresManualReview = changes
      .filter(c => c.severity === 'critical' || c.isBreaking)
      .map(c => `${c.typeName} (${c.filePath})`);

    return {
      affectedFiles: affectedFiles.size,
      affectedTypes: affectedTypes.size,
      breakingChanges,
      impactLevel,
      requiresManualReview
    };
  }

  /**
   * 评估回归检测结果
   */
  private evaluateRegressionResult(report: TypeRegressionReport): boolean {
    // 如果有编译错误，直接失败
    if (report.errors.length > 0) {
      return false;
    }

    // 严格模式下，任何不允许的变化都失败
    if (this.config.strict) {
      const disallowedChanges = report.changes.filter(
        change => !this.config.allowedChanges.includes(change.type)
      );
      return disallowedChanges.length === 0;
    }

    // 非严格模式下，只有破坏性变更才失败
    const breakingChanges = report.changes.filter(change => change.isBreaking);
    return breakingChanges.length === 0;
  }

  /**
   * 按严重程度分组变化
   */
  private groupChangesBySeverity(changes: TypeChange[]): Record<string, TypeChange[]> {
    const grouped: Record<string, TypeChange[]> = {
      critical: [],
      major: [],
      minor: []
    };

    changes.forEach(change => {
      grouped[change.severity].push(change);
    });

    return grouped;
  }

  /**
   * 确定修改的严重程度
   */
  private determineModificationSeverity(
    baseline: TypeDefinitionSummary,
    current: TypeDefinitionSummary
  ): TypeChange['severity'] {
    if (baseline.isExported !== current.isExported) {
      return 'major';
    }
    if (Math.abs(current.complexity - baseline.complexity) > 3) {
      return 'major';
    }
    return 'minor';
  }

  /**
   * 判断是否为破坏性变更
   */
  private isBreakingChange(
    baseline: TypeDefinitionSummary,
    current: TypeDefinitionSummary
  ): boolean {
    // 导出状态变化
    if (baseline.isExported && !current.isExported) {
      return true;
    }

    // 复杂度大幅降低可能意味着功能移除
    if (current.complexity < baseline.complexity * 0.5) {
      return true;
    }

    return false;
  }

  /**
   * 生成报告ID
   */
  private generateReportId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `regression-${timestamp}-${random}`;
  }

  /**
   * 获取影响等级对应的emoji
   */
  private getImpactLevelEmoji(level: string): string {
    switch (level) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * 获取严重程度对应的emoji
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'major': return '🟠';
      case 'minor': return '🟡';
      default: return '⚪';
    }
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(report: TypeRegressionReport): string[] {
    const suggestions: string[] = [];

    if (report.errors.length > 0) {
      suggestions.push('优先修复所有编译错误，确保代码可以正常构建');
    }

    if (report.impactAssessment.breakingChanges > 0) {
      suggestions.push('仔细审查所有破坏性变更，确保向后兼容性');
    }

    if (report.changes.length > 10) {
      suggestions.push('考虑分阶段提交大量类型变更，便于代码审查');
    }

    if (report.warnings.some(w => w.code.includes('ANY_TYPE'))) {
      suggestions.push('逐步替换any类型为更具体的类型定义');
    }

    if (report.impactAssessment.requiresManualReview.length > 0) {
      suggestions.push('安排人工审查关键类型的变更，确保设计合理性');
    }

    return suggestions;
  }
}

// 默认导出
export default TypeRegressionGuard;