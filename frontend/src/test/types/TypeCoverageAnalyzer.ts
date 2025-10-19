/**
 * 类型覆盖率分析器
 * 用于分析和监控TypeScript类型定义的覆盖率
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { execSync } from 'child_process';

export interface TypeCoverageConfig {
  /** 项目根目录 */
  projectRoot: string;
  /** 源代码目录 */
  srcDir: string;
  /** 排除的文件模式 */
  excludePatterns: string[];
  /** 包含的文件扩展名 */
  includeExtensions: string[];
  /** 类型文件模式 */
  typeFilePatterns: string[];
}

export interface TypeCoverageMetrics {
  /** 总文件数 */
  totalFiles: number;
  /** 有类型定义的文件数 */
  filesWithTypes: number;
  /** 类型文件数量 */
  typeFiles: number;
  /** 总行数 */
  totalLines: number;
  /** 类型定义行数 */
  typeDefinitionLines: number;
  /** 总体类型覆盖率 */
  overallCoverage: number;
  /** 按文件类型的覆盖率 */
  coverageByFileType: Record<string, number>;
  /** 按目录的覆盖率 */
  coverageByDirectory: Record<string, number>;
  /** 类型使用统计 */
  typeUsageStats: TypeUsageStats;
}

export interface TypeUsageStats {
  /** 接口定义数量 */
  interfaces: number;
  /** 类型别名数量 */
  typeAliases: number;
  /** 枚举定义数量 */
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

export interface FileTypeInfo {
  /** 文件路径 */
  filePath: string;
  /** 文件类型 */
  fileType: string;
  /** 是否有类型定义 */
  hasTypes: boolean;
  /** 类型定义数量 */
  typeCount: number;
  /** 类型覆盖行数 */
  typeLines: number;
  /** 总行数 */
  totalLines: number;
  /** 类型覆盖率 */
  coverage: number;
  /** 类型定义详情 */
  typeDetails: TypeDefinition[];
}

export interface TypeDefinition {
  /** 类型名称 */
  name: string;
  /** 类型种类 */
  kind: 'interface' | 'type' | 'enum' | 'class' | 'function';
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 是否导出 */
  isExported: boolean;
  /** 是否有泛型参数 */
  hasGenerics: boolean;
  /** 类型复杂度评分 */
  complexity: number;
}

/**
 * 类型覆盖率分析器
 */
export class TypeCoverageAnalyzer {
  private config: TypeCoverageConfig;
  private fileCache: Map<string, FileTypeInfo> = new Map();

  constructor(config: Partial<TypeCoverageConfig> = {}) {
    this.config = {
      projectRoot: process.cwd(),
      srcDir: 'src',
      excludePatterns: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.config.*'
      ],
      includeExtensions: ['.ts', '.tsx'],
      typeFilePatterns: [
        '**/types/**',
        '**/*.d.ts',
        '**/interfaces/**'
      ],
      ...config
    };
  }

  /**
   * 执行完整的类型覆盖率分析
   */
  async analyzeCoverage(): Promise<TypeCoverageMetrics> {
    console.log('🔍 开始分析类型覆盖率...');

    const sourceFiles = this.getSourceFiles();
    const fileInfos: FileTypeInfo[] = [];

    // 分析每个文件
    for (const filePath of sourceFiles) {
      const fileInfo = await this.analyzeFile(filePath);
      fileInfos.push(fileInfo);
      this.fileCache.set(filePath, fileInfo);
    }

    // 计算总体指标
    const metrics = this.calculateMetrics(fileInfos);

    console.log(`✅ 类型覆盖率分析完成: ${metrics.overallCoverage.toFixed(2)}%`);
    return metrics;
  }

  /**
   * 获取所有源代码文件
   */
  private getSourceFiles(): string[] {
    const files: string[] = [];
    const srcPath = join(this.config.projectRoot, this.config.srcDir);

    const scanDirectory = (dir: string): void => {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (stat.isFile()) {
          const relativePath = fullPath.replace(this.config.projectRoot + '/', '');

          // 检查是否应该排除
          if (this.shouldExcludeFile(relativePath)) {
            continue;
          }

          // 检查文件扩展名
          const ext = extname(fullPath);
          if (this.config.includeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    if (existsSync(srcPath)) {
      scanDirectory(srcPath);
    }

    return files;
  }

  /**
   * 检查文件是否应该被排除
   */
  private shouldExcludeFile(filePath: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
      );
      return regex.test(filePath);
    });
  }

  /**
   * 分析单个文件的类型信息
   */
  private async analyzeFile(filePath: string): Promise<FileTypeInfo> {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = filePath.replace(this.config.projectRoot + '/', '');

    const fileInfo: FileTypeInfo = {
      filePath: relativePath,
      fileType: this.getFileType(filePath),
      hasTypes: false,
      typeCount: 0,
      typeLines: 0,
      totalLines: lines.length,
      coverage: 0,
      typeDetails: []
    };

    // 分析类型定义
    const typeDefinitions = this.extractTypeDefinitions(content);
    fileInfo.typeDetails = typeDefinitions;
    fileInfo.typeCount = typeDefinitions.length;
    fileInfo.hasTypes = typeDefinitions.length > 0;

    // 计算类型行数
    fileInfo.typeLines = typeDefinitions.reduce(
      (total, typeDef) => total + (typeDef.endLine - typeDef.startLine + 1),
      0
    );

    // 计算覆盖率
    fileInfo.coverage = fileInfo.totalLines > 0
      ? (fileInfo.typeLines / fileInfo.totalLines) * 100
      : 0;

    return fileInfo;
  }

  /**
   * 获取文件类型
   */
  private getFileType(filePath: string): string {
    const ext = extname(filePath);
    const dir = basename(dirname(filePath));
    const name = basename(filePath, ext);

    // 根据目录和文件名判断类型
    if (dir === 'types' || ext === '.d.ts') return 'types';
    if (dir === 'components') return 'components';
    if (dir === 'hooks') return 'hooks';
    if (dir === 'store') return 'store';
    if (dir === 'services') return 'services';
    if (dir === 'utils') return 'utils';
    if (dir === 'pages') return 'pages';

    return 'misc';
  }

  /**
   * 提取类型定义
   */
  private extractTypeDefinitions(content: string): TypeDefinition[] {
    const lines = content.split('\n');
    const typeDefinitions: TypeDefinition[] = [];

    // 类型定义模式
    const patterns = {
      interface: /^(\s*(export\s+)?)interface\s+(\w+)/,
      type: /^(\s*(export\s+)?)type\s+(\w+)/,
      enum: /^(\s*(export\s+)?)enum\s+(\w+)/,
      class: /^(\s*(export\s+)?)class\s+(\w+)/,
      function: /^(\s*(export\s+)?)function\s+(\w+)/
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const [kind, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
          const isExported = match[2] !== undefined;
          const name = match[3];

          // 查找类型定义的结束位置
          let endLine = i;
          let braceCount = 0;
          let hasOpenedBrace = false;

          for (let j = i; j < lines.length; j++) {
            const currentLine = lines[j];

            // 计算大括号
            for (const char of currentLine) {
              if (char === '{') {
                braceCount++;
                hasOpenedBrace = true;
              } else if (char === '}') {
                braceCount--;
              }
            }

            if (hasOpenedBrace && braceCount === 0) {
              endLine = j;
              break;
            }
          }

          // 检查是否有泛型参数
          const hasGenerics = line.includes('<') && line.includes('>');

          // 计算复杂度
          const complexity = this.calculateTypeComplexity(
            lines.slice(i, endLine + 1).join('\n')
          );

          typeDefinitions.push({
            name,
            kind: kind as TypeDefinition['kind'],
            startLine: i + 1,
            endLine: endLine + 1,
            isExported,
            hasGenerics,
            complexity
          });

          break; // 避免同一行匹配多个模式
        }
      }
    }

    return typeDefinitions;
  }

  /**
   * 计算类型定义的复杂度
   */
  private calculateTypeComplexity(typeDef: string): number {
    let complexity = 1;

    // 基于各种特征增加复杂度
    if (typeDef.includes('extends')) complexity += 1;
    if (typeDef.includes('extends ')) complexity += typeDef.split('extends ').length - 1;
    if (typeDef.includes('<')) complexity += 1;
    if (typeDef.includes('keyof')) complexity += 1;
    if (typeDef.includes('infer')) complexity += 2;
    if (typeDef.includes('never')) complexity += 1;
    if (typeDef.includes('unknown')) complexity += 1;
    if (typeDef.includes('any')) complexity += 0.5; // any降低复杂度

    // 联合类型和交叉类型
    complexity += (typeDef.split('|').length - 1) * 0.5;
    complexity += (typeDef.split('&').length - 1) * 0.5;

    return complexity;
  }

  /**
   * 计算覆盖率指标
   */
  private calculateMetrics(fileInfos: FileTypeInfo[]): TypeCoverageMetrics {
    const totalFiles = fileInfos.length;
    const filesWithTypes = fileInfos.filter(f => f.hasTypes).length;
    const typeFiles = fileInfos.filter(f => f.fileType === 'types').length;

    const totalLines = fileInfos.reduce((sum, f) => sum + f.totalLines, 0);
    const typeDefinitionLines = fileInfos.reduce((sum, f) => sum + f.typeLines, 0);

    const overallCoverage = totalLines > 0 ? (typeDefinitionLines / totalLines) * 100 : 0;

    // 按文件类型统计覆盖率
    const coverageByFileType: Record<string, number> = {};
    const filesByType: Record<string, FileTypeInfo[]> = {};

    fileInfos.forEach(file => {
      if (!filesByType[file.fileType]) {
        filesByType[file.fileType] = [];
      }
      filesByType[file.fileType].push(file);
    });

    Object.entries(filesByType).forEach(([type, files]) => {
      const typeLines = files.reduce((sum, f) => sum + f.typeLines, 0);
      const totalLines = files.reduce((sum, f) => sum + f.totalLines, 0);
      coverageByFileType[type] = totalLines > 0 ? (typeLines / totalLines) * 100 : 0;
    });

    // 按目录统计覆盖率
    const coverageByDirectory: Record<string, number> = {};
    const filesByDirectory: Record<string, FileTypeInfo[]> = {};

    fileInfos.forEach(file => {
      const dir = dirname(file.filePath);
      if (!filesByDirectory[dir]) {
        filesByDirectory[dir] = [];
      }
      filesByDirectory[dir].push(file);
    });

    Object.entries(filesByDirectory).forEach(([dir, files]) => {
      const typeLines = files.reduce((sum, f) => sum + f.typeLines, 0);
      const totalLines = files.reduce((sum, f) => sum + f.totalLines, 0);
      coverageByDirectory[dir] = totalLines > 0 ? (typeLines / totalLines) * 100 : 0;
    });

    // 类型使用统计
    const typeUsageStats = this.calculateTypeUsageStats(fileInfos);

    return {
      totalFiles,
      filesWithTypes,
      typeFiles,
      totalLines,
      typeDefinitionLines,
      overallCoverage,
      coverageByFileType,
      coverageByDirectory,
      typeUsageStats
    };
  }

  /**
   * 计算类型使用统计
   */
  private calculateTypeUsageStats(fileInfos: FileTypeInfo[]): TypeUsageStats {
    let interfaces = 0;
    let typeAliases = 0;
    let enums = 0;
    let generics = 0;
    let anyTypes = 0;
    let unknownTypes = 0;
    let typeAssertions = 0;
    let typeGuards = 0;

    fileInfos.forEach(file => {
      file.typeDetails.forEach(type => {
        switch (type.kind) {
          case 'interface':
            interfaces++;
            break;
          case 'type':
            typeAliases++;
            break;
          case 'enum':
            enums++;
            break;
        }

        if (type.hasGenerics) {
          generics++;
        }
      });

      // 统计any和unknown的使用
      const content = readFileSync(join(this.config.projectRoot, file.filePath), 'utf8');
      anyTypes += (content.match(/\bany\b/g) || []).length;
      unknownTypes += (content.match(/\bunknown\b/g) || []).length;
      typeAssertions += (content.match(/as\s+\w+/g) || []).length;
      typeGuards += (content.match(/is\s+\w+/g) || []).length;
    });

    return {
      interfaces,
      typeAliases,
      enums,
      generics,
      anyTypes,
      unknownTypes,
      typeAssertions,
      typeGuards
    };
  }

  /**
   * 生成覆盖率报告
   */
  generateReport(metrics: TypeCoverageMetrics): string {
    let report = `# TypeScript 类型覆盖率报告\n\n`;

    // 总体概览
    report += `## 📊 总体概览\n\n`;
    report += `- **总体覆盖率**: ${metrics.overallCoverage.toFixed(2)}%\n`;
    report += `- **总文件数**: ${metrics.totalFiles}\n`;
    report += `- **有类型定义的文件**: ${metrics.filesWithTypes}\n`;
    report += `- **类型文件**: ${metrics.typeFiles}\n`;
    report += `- **总行数**: ${metrics.totalLines}\n`;
    report += `- **类型定义行数**: ${metrics.typeDefinitionLines}\n\n`;

    // 按文件类型的覆盖率
    report += `## 📁 按文件类型的覆盖率\n\n`;
    Object.entries(metrics.coverageByFileType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, coverage]) => {
        const emoji = this.getCoverageEmoji(coverage);
        report += `- **${type}**: ${emoji} ${coverage.toFixed(2)}%\n`;
      });
    report += `\n`;

    // 类型使用统计
    report += `## 📈 类型使用统计\n\n`;
    const stats = metrics.typeUsageStats;
    report += `- **接口定义**: ${stats.interfaces}\n`;
    report += `- **类型别名**: ${stats.typeAliases}\n`;
    report += `- **枚举定义**: ${stats.enums}\n`;
    report += `- **泛型使用**: ${stats.generics}\n`;
    report += `- **any类型使用**: ${stats.anyTypes} ⚠️\n`;
    report += `- **unknown类型使用**: ${stats.unknownTypes}\n`;
    report += `- **类型断言**: ${stats.typeAssertions}\n`;
    report += `- **类型守卫**: ${stats.typeGuards}\n\n`;

    // 质量评估
    report += `## 🎯 质量评估\n\n`;
    const qualityScore = this.calculateQualityScore(metrics);
    report += `- **质量评分**: ${qualityScore.score}/100 (${qualityScore.grade})\n`;
    report += `- **建议**: ${qualityScore.recommendations.join('、')}\n\n`;

    // 低覆盖率文件
    report += `## ⚠️ 需要改进的文件\n\n`;
    const lowCoverageFiles = this.getLowCoverageFiles();
    if (lowCoverageFiles.length > 0) {
      lowCoverageFiles.forEach(file => {
        report += `- **${file.filePath}**: ${file.coverage.toFixed(2)}%\n`;
      });
    } else {
      report += `✅ 所有文件的类型覆盖率都在可接受范围内\n`;
    }
    report += `\n`;

    return report;
  }

  /**
   * 获取覆盖率对应的emoji
   */
  private getCoverageEmoji(coverage: number): string {
    if (coverage >= 80) return '🟢';
    if (coverage >= 60) return '🟡';
    if (coverage >= 40) return '🟠';
    return '🔴';
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(metrics: TypeCoverageMetrics): {
    score: number;
    grade: string;
    recommendations: string[];
  } {
    let score = 0;
    const recommendations: string[] = [];

    // 覆盖率评分 (40分)
    if (metrics.overallCoverage >= 80) {
      score += 40;
    } else if (metrics.overallCoverage >= 60) {
      score += 30;
      recommendations.push('提高总体类型覆盖率到80%以上');
    } else if (metrics.overallCoverage >= 40) {
      score += 20;
      recommendations.push('显著提高类型覆盖率');
    } else {
      score += 10;
      recommendations.push('紧急需要增加类型定义');
    }

    // any类型使用评分 (20分)
    const anyRatio = metrics.typeUsageStats.anyTypes / metrics.totalLines;
    if (anyRatio < 0.01) {
      score += 20;
    } else if (anyRatio < 0.02) {
      score += 15;
      recommendations.push('减少any类型的使用');
    } else if (anyRatio < 0.05) {
      score += 10;
      recommendations.push('大幅减少any类型的使用');
    } else {
      recommendations.push('避免使用any类型，改用具体类型');
    }

    // 类型使用多样性评分 (20分)
    const typeDiversity =
      (metrics.typeUsageStats.interfaces > 0 ? 5 : 0) +
      (metrics.typeUsageStats.typeAliases > 0 ? 5 : 0) +
      (metrics.typeUsageStats.enums > 0 ? 5 : 0) +
      (metrics.typeUsageStats.generics > 0 ? 5 : 0);

    score += typeDiversity;
    if (typeDiversity < 15) {
      recommendations.push('增加类型定义的多样性');
    }

    // 类型文件比例评分 (20分)
    const typeFileRatio = metrics.typeFiles / metrics.totalFiles;
    if (typeFileRatio >= 0.1) {
      score += 20;
    } else if (typeFileRatio >= 0.05) {
      score += 15;
      recommendations.push('增加专门的类型定义文件');
    } else if (typeFileRatio >= 0.02) {
      score += 10;
      recommendations.push('建立类型定义文件结构');
    } else {
      recommendations.push('创建专门的类型定义文件');
    }

    // 确定等级
    let grade: string;
    if (score >= 90) grade = 'A+';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 50) grade = 'D';
    else grade = 'F';

    return { score, grade, recommendations };
  }

  /**
   * 获取低覆盖率文件列表
   */
  private getLowCoverageFiles(): FileTypeInfo[] {
    return Array.from(this.fileCache.values())
      .filter(file => file.coverage < 40 && file.totalLines > 10)
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 10);
  }

  /**
   * 获取文件详细信息
   */
  getFileInfo(filePath: string): FileTypeInfo | undefined {
    return this.fileCache.get(filePath);
  }

  /**
   * 保存覆盖率数据到文件
   */
  async saveCoverageData(filePath: string): Promise<void> {
    const metrics = await this.analyzeCoverage();
    const data = {
      timestamp: new Date().toISOString(),
      metrics,
      files: Array.from(this.fileCache.values())
    };

    require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

// 辅助函数
function dirname(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

// 默认导出
export default TypeCoverageAnalyzer;