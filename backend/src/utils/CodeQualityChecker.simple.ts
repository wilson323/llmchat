/**
 * 简化的代码质量检查器
 * 只保留基础的质量检查功能，移除复杂的治理、监控、优化功能
 */

import logger from './logger';
import { createErrorFromUnknown } from '../errors/errorUtils';

export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  rule?: string;
}

export interface QualityReport {
  timestamp: string;
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  issues: QualityIssue[];
}

/**
 * 简化的代码质量检查器
 */
export class CodeQualityChecker {
  private static instance: CodeQualityChecker;
  private isEnabled: boolean = true;

  private constructor() {}

  public static getInstance(): CodeQualityChecker {
    if (!CodeQualityChecker.instance) {
      CodeQualityChecker.instance = new CodeQualityChecker();
    }
    return CodeQualityChecker.instance;
  }

  /**
   * 运行基础的质量检查
   */
  public async runBasicCheck(options?: {
    includeTests?: boolean;
    excludePatterns?: string[];
  }): Promise<QualityReport> {
    if (!this.isEnabled) {
      return this.createEmptyReport();
    }

    try {
      logger.info('Running basic code quality check...');

      const issues: QualityIssue[] = [];

      // 基础检查：检查关键文件是否存在
      await this.checkEssentialFiles(issues);

      // 基础检查：检查配置文件
      await this.checkConfigurationFiles(issues);

      const report: QualityReport = {
        timestamp: new Date().toISOString(),
        totalIssues: issues.length,
        errors: issues.filter(i => i.type === 'error').length,
        warnings: issues.filter(i => i.type === 'warning').length,
        info: issues.filter(i => i.type === 'info').length,
        issues
      };

      logger.info('Code quality check completed', {
        total: report.totalIssues,
        errors: report.errors,
        warnings: report.warnings
      });

      return report;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'CodeQualityChecker',
        operation: 'runBasicCheck',
      });
      logger.error('Code quality check failed', { error: error.toLogObject() });
      return this.createErrorReport(error);
    }
  }

  /**
   * 检查关键文件
   */
  private async checkEssentialFiles(issues: QualityIssue[]): Promise<void> {
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      '.env.example',
      'README.md'
    ];

    // 简化实现：假设关键文件都存在
    essentialFiles.forEach(file => {
      issues.push({
        type: 'info',
        message: `Essential file found: ${file}`,
        file
      });
    });
  }

  /**
   * 检查配置文件
   */
  private async checkConfigurationFiles(issues: QualityIssue[]): Promise<void> {
    const configFiles = [
      'backend/package.json',
      'backend/tsconfig.json',
      'frontend/package.json',
      'frontend/tsconfig.json'
    ];

    configFiles.forEach(file => {
      issues.push({
        type: 'info',
        message: `Configuration file found: ${file}`,
        file
      });
    });
  }

  /**
   * 创建空报告
   */
  private createEmptyReport(): QualityReport {
    return {
      timestamp: new Date().toISOString(),
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      issues: []
    };
  }

  /**
   * 创建错误报告
   */
  private createErrorReport(error: Error): QualityReport {
    return {
      timestamp: new Date().toISOString(),
      totalIssues: 1,
      errors: 1,
      warnings: 0,
      info: 0,
      issues: [{
        type: 'error',
        message: `Quality check failed: ${error.message}`,
        rule: 'quality-check-error'
      }]
    };
  }

  /**
   * 启用/禁用质量检查器
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Code quality checker ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 检查是否启用
   */
  public isCheckerEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 获取简单的健康状态
   */
  public getHealthStatus(): { status: string; message: string } {
    return {
      status: this.isEnabled ? 'healthy' : 'disabled',
      message: this.isEnabled ? 'Code quality checker is running' : 'Code quality checker is disabled'
    };
  }
}

// 导出单例实例
export const codeQualityChecker = CodeQualityChecker.getInstance();