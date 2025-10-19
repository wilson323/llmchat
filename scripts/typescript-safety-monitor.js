#!/usr/bin/env node

/**
 * TypeScript类型安全监控系统
 * 专门用于监控、分析和报告TypeScript类型错误的自动化工具
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TypeScriptSafetyMonitor {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = path.join(this.projectRoot, 'reports', 'typescript-safety');
    this.configPath = path.join(this.projectRoot, '.typescript-safety.config.json');
    this.trendDataPath = path.join(this.reportsDir, 'trends');
    this.config = this.loadConfig();
    this.ensureReportsDir();
  }

  ensureReportsDir() {
    const dirs = [
      this.reportsDir,
      this.trendDataPath,
      path.join(this.reportsDir, 'snapshots'),
      path.join(this.reportsDir, 'analysis')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadConfig() {
    const defaultConfig = {
      strict: true,
      paths: ['frontend/src', 'backend/src'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        errors: {
          critical: 0,
          high: 0,
          medium: 5,
          low: 10
        },
        complexity: {
          maxCognitiveComplexity: 15,
          maxCyclomaticComplexity: 10
        },
        typeCoverage: {
          minimum: 95,
          anyTypes: {
            maxAllowed: 5,
            maxPercentage: 2
          }
        }
      },
      monitoring: {
        enableTrendAnalysis: true,
        enableSnapshotComparison: true,
        enableDetailedReporting: true,
        retentionDays: 90
      },
      alerts: {
        enableSlack: false,
        enableEmail: false,
        enableGithubIssues: true,
        thresholds: {
          critical: 0,
          high: 2,
          medium: 10
        }
      }
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return { ...defaultConfig, ...config };
      }
    } catch (error) {
      console.warn('⚠️ Could not load TypeScript safety config, using defaults');
    }

    // 保存默认配置
    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  runCommand(command, options = {}) {
    const { silent = false, timeout = 120000, allowFailure = false } = options;

    try {
      const startTime = Date.now();
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit',
        timeout
      });

      const duration = Date.now() - startTime;
      return {
        success: true,
        output: result,
        duration,
        executionTime: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      if (allowFailure) {
        return {
          success: false,
          output: error.stdout || '',
          error: error.message,
          duration,
          executionTime: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  analyzeTypeScriptErrors() {
    console.log('🔍 Analyzing TypeScript errors...');

    const results = {
      frontend: this.analyzeTypeScriptProject('frontend'),
      backend: this.analyzeTypeScriptProject('backend'),
      sharedTypes: this.analyzeTypeScriptProject('shared-types')
    };

    // 聚合结果
    const aggregated = this.aggregateResults(results);

    return {
      ...aggregated,
      details: results,
      analyzedAt: new Date().toISOString()
    };
  }

  analyzeTypeScriptProject(projectName) {
    const projectPath = path.join(this.projectRoot, projectName);

    if (!fs.existsSync(projectPath)) {
      return {
        projectName,
        status: 'NOT_FOUND',
        errors: 0,
        warnings: 0,
        issues: [],
        typeCoverage: 0,
        complexity: { average: 0, max: 0 }
      };
    }

    console.log(`  📁 Analyzing ${projectName}...`);

    // TypeScript编译检查
    const tsCheck = this.runTypeScriptCheck(projectPath);

    // 类型覆盖率分析
    const typeCoverage = this.analyzeTypeCoverage(projectPath);

    // 复杂度分析
    const complexity = this.analyzeComplexity(projectPath);

    return {
      projectName,
      path: projectPath,
      status: tsCheck.success ? 'PASSED' : 'FAILED',
      errors: tsCheck.errors || 0,
      warnings: tsCheck.warnings || 0,
      issues: tsCheck.issues || [],
      typeCoverage,
      complexity,
      analyzedAt: new Date().toISOString()
    };
  }

  runTypeScriptCheck(projectPath) {
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
      return {
        success: false,
        errors: 0,
        warnings: 0,
        issues: [],
        error: 'tsconfig.json not found'
      };
    }

    try {
      // 运行TypeScript编译检查
      const result = this.runCommand(`cd "${projectPath}" && npx tsc --noEmit --pretty false`, {
        silent: true,
        allowFailure: true
      });

      if (!result.success) {
        const issues = this.parseTypeScriptErrors(result.output);
        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;

        return {
          success: false,
          errors,
          warnings,
          issues,
          output: result.output
        };
      }

      return {
        success: true,
        errors: 0,
        warnings: 0,
        issues: []
      };
    } catch (error) {
      return {
        success: false,
        errors: 1,
        warnings: 0,
        issues: [{
          file: 'unknown',
          line: 0,
          column: 0,
          code: 'COMPILE_ERROR',
          message: error.message,
          severity: 'error'
        }],
        error: error.message
      };
    }
  }

  parseTypeScriptErrors(output) {
    const issues = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // TypeScript错误格式: file(line,column): error TS####: message
      const match = line.match(/^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);

      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;

        issues.push({
          file: file.trim(),
          line: parseInt(lineNum),
          column: parseInt(colNum),
          code: code.trim(),
          message: message.trim(),
          severity,
          category: this.categorizeError(code, message)
        });
      }
    }

    return issues;
  }

  categorizeError(code, message) {
    // 常见TypeScript错误分类
    const categories = {
      'TYPE_MISMATCH': ['TS2322', 'TS2345', 'TS2769'],
      'MISSING_DEFINITION': ['TS2304', 'TS2305', 'TS2307'],
      'ANY_TYPE': ['TS7006', 'TS7008', 'TS7031'],
      'ASYNC_ISSUES': ['TS2339', 'TS2367', 'TS2532'],
      'IMPORT_EXPORT': ['TS2309', 'TS2614', 'TS2497'],
      'OPTIONAL_PROPERTIES': ['TS2533', 'TS2739', 'TS2741'],
      'GENERIC_ISSUES': ['TS2314', 'TS2344', 'TS2315']
    };

    for (const [category, codes] of Object.entries(categories)) {
      if (codes.includes(code)) {
        return category;
      }
    }

    // 基于消息内容的分类
    if (message.includes('any') || message.includes('unknown')) {
      return 'ANY_TYPE';
    }
    if (message.includes('optional') || message.includes('undefined')) {
      return 'OPTIONAL_PROPERTIES';
    }
    if (message.includes('async') || message.includes('await') || message.includes('Promise')) {
      return 'ASYNC_ISSUES';
    }

    return 'GENERAL';
  }

  analyzeTypeCoverage(projectPath) {
    // 简化的类型覆盖率分析
    try {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) {
        return { percentage: 0, anyTypes: 0, totalTypes: 0 };
      }

      const files = this.findTypeScriptFiles(srcPath);
      let totalTypes = 0;
      let anyTypes = 0;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const analysis = this.analyzeFileForTypeUsage(content);
        totalTypes += analysis.totalTypes;
        anyTypes += analysis.anyTypes;
      }

      const percentage = totalTypes > 0 ? ((totalTypes - anyTypes) / totalTypes) * 100 : 0;

      return {
        percentage: Math.round(percentage * 100) / 100,
        anyTypes,
        totalTypes,
        filesAnalyzed: files.length
      };
    } catch (error) {
      return { percentage: 0, anyTypes: 0, totalTypes: 0, error: error.message };
    }
  }

  findTypeScriptFiles(dir) {
    const files = [];

    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(fullPath);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
          if (!item.endsWith('.d.ts') && !item.includes('.test.') && !item.includes('.spec.')) {
            files.push(fullPath);
          }
        }
      }
    }

    traverse(dir);
    return files;
  }

  analyzeFileForTypeUsage(content) {
    // 简化的类型使用分析
    const anyTypeRegex = /:\s*any\b|as\s+any\b|<any>/g;
    const typeAnnotationRegex = /:\s*[A-Z][a-zA-Z0-9_<>[\]|,\s]*\b|<\s*[A-Z][a-zA-Z0-9_<>[\]|,\s]*>/g;

    const anyMatches = content.match(anyTypeRegex) || [];
    const typeMatches = content.match(typeAnnotationRegex) || [];

    return {
      anyTypes: anyMatches.length,
      totalTypes: typeMatches.length + anyMatches.length
    };
  }

  analyzeComplexity(projectPath) {
    // 简化的复杂度分析
    try {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) {
        return { average: 0, max: 0, functions: 0 };
      }

      const files = this.findTypeScriptFiles(srcPath);
      let totalComplexity = 0;
      let maxComplexity = 0;
      let functionCount = 0;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const analysis = this.analyzeFileComplexity(content);
        totalComplexity += analysis.totalComplexity;
        maxComplexity = Math.max(maxComplexity, analysis.maxComplexity);
        functionCount += analysis.functionCount;
      }

      return {
        average: functionCount > 0 ? Math.round((totalComplexity / functionCount) * 100) / 100 : 0,
        max: maxComplexity,
        functions: functionCount,
        filesAnalyzed: files.length
      };
    } catch (error) {
      return { average: 0, max: 0, functions: 0, error: error.message };
    }
  }

  analyzeFileComplexity(content) {
    // 简化的圈复杂度计算
    const complexityKeywords = [
      'if', 'else', 'while', 'for', 'foreach', 'do', 'switch', 'case',
      'catch', '&&', '||', '?', 'throw', 'return'
    ];

    let totalComplexity = 0;
    let maxComplexity = 0;
    let functionCount = 0;

    // 查找函数
    const functionRegex = /(?:function\s+\w+|=>\s*{|\w+\s*:\s*\([^)]*\)\s*=>|class\s+\w+|interface\s+\w+)/g;
    const functions = content.match(functionRegex) || [];

    functionCount = functions.length;

    // 为每个关键字增加复杂度
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex) || [];
      totalComplexity += matches.length;
    }

    maxComplexity = Math.max(1, Math.ceil(totalComplexity / Math.max(1, functionCount)));

    return {
      totalComplexity,
      maxComplexity,
      functionCount
    };
  }

  aggregateResults(results) {
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalIssues = [];
    let totalTypeCoverage = 0;
    let totalComplexity = { sum: 0, max: 0, count: 0 };
    let projectsAnalyzed = 0;

    for (const [projectName, result] of Object.entries(results)) {
      if (result.status !== 'NOT_FOUND') {
        totalErrors += result.errors || 0;
        totalWarnings += result.warnings || 0;
        totalIssues.push(...(result.issues || []));
        totalTypeCoverage += result.typeCoverage?.percentage || 0;

        if (result.complexity) {
          totalComplexity.sum += result.complexity.average || 0;
          totalComplexity.max = Math.max(totalComplexity.max, result.complexity.max || 0);
          totalComplexity.count++;
        }

        projectsAnalyzed++;
      }
    }

    // 计算优先级分数
    const severityWeights = { critical: 50, high: 20, medium: 10, low: 5 };
    let weightedScore = 100;

    for (const issue of totalIssues) {
      const weight = severityWeights[issue.severity] || 5;
      weightedScore = Math.max(0, weightedScore - weight);
    }

    const status = this.determineOverallStatus(totalErrors, totalWarnings, weightedScore);

    return {
      status,
      totalErrors,
      totalWarnings,
      totalIssues: totalIssues.length,
      weightedScore,
      typeCoverage: projectsAnalyzed > 0 ? Math.round((totalTypeCoverage / projectsAnalyzed) * 100) / 100 : 0,
      complexity: {
        average: totalComplexity.count > 0 ? Math.round((totalComplexity.sum / totalComplexity.count) * 100) / 100 : 0,
        max: totalComplexity.max
      },
      projectsAnalyzed,
      trends: this.analyzeTrends(totalErrors, totalWarnings)
    };
  }

  determineOverallStatus(errors, warnings, score) {
    const thresholds = this.config.thresholds.errors;

    if (errors > thresholds.critical || score < 50) {
      return 'CRITICAL';
    }
    if (errors > thresholds.high || score < 70) {
      return 'HIGH';
    }
    if (errors > thresholds.medium || warnings > thresholds.medium || score < 85) {
      return 'MEDIUM';
    }
    if (errors > thresholds.low || warnings > thresholds.low || score < 95) {
      return 'LOW';
    }

    return 'EXCELLENT';
  }

  analyzeTrends(errors, warnings) {
    // 简化的趋势分析
    const today = new Date().toISOString().split('T')[0];
    const trendFile = path.join(this.trendDataPath, `${today}.json`);

    let trend = 'stable';
    let previousData = null;

    // 尝试读取最近的历史数据
    try {
      const recentFiles = fs.readdirSync(this.trendDataPath)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      if (recentFiles.length > 0) {
        const previousFile = path.join(this.trendDataPath, recentFiles[0]);
        previousData = JSON.parse(fs.readFileSync(previousFile, 'utf8'));

        if (previousData) {
          if (errors > previousData.totalErrors) {
            trend = 'degrading';
          } else if (errors < previousData.totalErrors) {
            trend = 'improving';
          }
        }
      }
    } catch (error) {
      // 忽略趋势分析错误
    }

    // 保存当前数据
    const currentData = {
      date: today,
      totalErrors: errors,
      totalWarnings: warnings,
      analyzedAt: new Date().toISOString()
    };

    fs.writeFileSync(trendFile, JSON.stringify(currentData, null, 2));

    return {
      direction: trend,
      previousErrors: previousData?.totalErrors || 0,
      change: previousData ? errors - previousData.totalErrors : 0
    };
  }

  generateReport(analysis) {
    const timestamp = new Date().toISOString();
    const reportPath = path.join(this.reportsDir, `typescript-safety-${timestamp.split('T')[0]}.json`);

    const report = {
      timestamp,
      config: this.config,
      analysis,
      summary: {
        status: analysis.status,
        score: analysis.weightedScore,
        errors: analysis.totalErrors,
        warnings: analysis.totalWarnings,
        typeCoverage: analysis.typeCoverage,
        complexity: analysis.complexity.average,
        projectsAnalyzed: analysis.projectsAnalyzed
      },
      recommendations: this.generateRecommendations(analysis)
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    // 基于错误数量
    if (analysis.totalErrors > 0) {
      recommendations.push({
        category: 'critical',
        priority: 'high',
        title: '修复TypeScript编译错误',
        description: `发现 ${analysis.totalErrors} 个TypeScript错误，需要立即修复以确保类型安全`,
        action: '运行 `pnpm run type-check` 查看详细错误信息并逐一修复',
        impact: 'critical'
      });
    }

    // 基于类型覆盖率
    if (analysis.typeCoverage < this.config.thresholds.typeCoverage.minimum) {
      recommendations.push({
        category: 'type-coverage',
        priority: 'medium',
        title: '提高类型覆盖率',
        description: `当前类型覆盖率为 ${analysis.typeCoverage}%，建议提高到 ${this.config.thresholds.typeCoverage.minimum}%`,
        action: '减少 `any` 类型的使用，为所有变量和函数添加明确的类型注解',
        impact: 'high'
      });
    }

    // 基于复杂度
    if (analysis.complexity.average > this.config.thresholds.complexity.maxCognitiveComplexity) {
      recommendations.push({
        category: 'complexity',
        priority: 'medium',
        title: '降低代码复杂度',
        description: `平均复杂度为 ${analysis.complexity.average}，建议控制在 ${this.config.thresholds.complexity.maxCognitiveComplexity} 以下`,
        action: '重构复杂函数，拆分大函数，减少嵌套层次',
        impact: 'medium'
      });
    }

    // 基于趋势
    if (analysis.trends.direction === 'degrading') {
      recommendations.push({
        category: 'trend',
        priority: 'high',
        title: '质量趋势恶化',
        description: `TypeScript错误数量增加了 ${analysis.trends.change} 个`,
        action: '实施代码审查流程，加强类型检查，考虑引入更严格的TypeScript配置',
        impact: 'high'
      });
    }

    return recommendations;
  }

  displayResults(analysis, reportPath) {
    console.log('\n🔒 TypeScript Safety Report');
    console.log('=' .repeat(60));

    const statusColors = {
      'EXCELLENT': '🟢',
      'LOW': '🟡',
      'MEDIUM': '🟠',
      'HIGH': '🔴',
      'CRITICAL': '🚨'
    };

    console.log(`\n📊 Overall Status: ${statusColors[analysis.status]} ${analysis.status}`);
    console.log(`🎯 Safety Score: ${analysis.weightedScore}/100`);
    console.log(`📝 Total Errors: ${analysis.totalErrors}`);
    console.log(`⚠️ Total Warnings: ${analysis.totalWarnings}`);
    console.log(`🔤 Type Coverage: ${analysis.typeCoverage}%`);
    console.log(`🔧 Complexity: ${analysis.complexity.average} (max: ${analysis.complexity.max})`);
    console.log(`📁 Projects Analyzed: ${analysis.projectsAnalyzed}`);

    if (analysis.trends.direction !== 'stable') {
      const trendIcon = analysis.trends.direction === 'improving' ? '📈' : '📉';
      console.log(`📈 Trend: ${trendIcon} ${analysis.trends.direction} (${analysis.trends.change > 0 ? '+' : ''}${analysis.trends.change})`);
    }

    console.log('\n📋 Project Details:');
    console.log('-'.repeat(40));

    for (const [projectName, result] of Object.entries(analysis.details)) {
      if (result.status !== 'NOT_FOUND') {
        const projectStatus = result.status === 'PASSED' ? '✅' : '❌';
        console.log(`\n${projectStatus} ${projectName}:`);
        console.log(`  Errors: ${result.errors}, Warnings: ${result.warnings}`);
        console.log(`  Type Coverage: ${result.typeCoverage?.percentage || 0}%`);
        console.log(`  Complexity: ${result.complexity?.average || 0}`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }

  async run(options = {}) {
    const {
      mode = 'full', // 'full', 'quick', 'ci'
      generateReport = true,
      displayResults = true
    } = options;

    console.log(`🔒 TypeScript Safety Monitor (${mode} mode)`);
    console.log('='.repeat(60));

    // 运行分析
    const analysis = this.analyzeTypeScriptErrors();

    // 生成报告
    let reportPath = null;
    if (generateReport) {
      const { report, reportPath: path } = this.generateReport(analysis);
      reportPath = path;
    }

    // 显示结果
    if (displayResults && mode !== 'ci') {
      this.displayResults(analysis, reportPath);
    } else if (mode === 'ci') {
      // CI模式输出
      console.log(`TypeScript Safety Score: ${analysis.weightedScore}/100`);
      console.log(`Status: ${analysis.status}`);
      console.log(`Errors: ${analysis.totalErrors}`);
      console.log(`Type Coverage: ${analysis.typeCoverage}%`);
    }

    // 返回结果用于程序化使用
    return {
      analysis,
      reportPath,
      success: analysis.totalErrors === 0
    };
  }
}

// 命令行接口
async function main() {
  const monitor = new TypeScriptSafetyMonitor();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TypeScript Safety Monitor

Usage: node scripts/typescript-safety-monitor.js [options]

Options:
  --help, -h           Show this help message
  --mode <mode>        Specify mode: full, quick, ci (default: full)
  --no-report          Skip report generation
  --quiet              Suppress console output
  --config             Show current configuration
  --init               Initialize default configuration

Examples:
  node scripts/typescript-safety-monitor.js                    # Full analysis
  node scripts/typescript-safety-monitor.js --mode quick       # Quick check
  node scripts/typescript-safety-monitor.js --mode ci          # CI/CD mode
  node scripts/typescript-safety-monitor.js --config           # Show config
`);
    process.exit(0);
  }

  if (args.includes('--config')) {
    console.log('Current TypeScript Safety Configuration:');
    console.log(JSON.stringify(monitor.config, null, 2));
    process.exit(0);
  }

  if (args.includes('--init')) {
    console.log('✅ TypeScript safety configuration initialized');
    console.log(`📁 Configuration file: ${monitor.configPath}`);
    console.log(`📁 Reports directory: ${monitor.reportsDir}`);
    process.exit(0);
  }

  // 解析选项
  const mode = args.includes('--mode ci') ? 'ci' :
               args.includes('--mode quick') ? 'quick' : 'full';
  const generateReport = !args.includes('--no-report');
  const displayResults = !args.includes('--quiet');

  try {
    const result = await monitor.run({
      mode,
      generateReport,
      displayResults
    });

    // 根据结果设置退出码
    if (!result.success && mode !== 'ci') {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ TypeScript safety monitor error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TypeScriptSafetyMonitor;