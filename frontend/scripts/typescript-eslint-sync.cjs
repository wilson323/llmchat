#!/usr/bin/env node

/**
 * TypeScript编译器与ESLint协同检查工具
 *
 * 功能特性：
 * - TypeScript编译错误与ESLint规则映射
 * - 统一的错误报告格式
 * - 智能修复建议
 * - 编译器和ESLint冲突检测
 * - 增量检查支持
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// TypeScript错误到ESLint规则的映射
const TS_ERROR_MAPPING = {
  // 类型相关错误
  'TS2304': {
    category: 'TYPE_ERROR',
    eslintRule: '@typescript-eslint/no-unsafe-assignment',
    severity: 'CRITICAL',
    description: '找不到名称',
    fixable: false,
  },
  'TS2339': {
    category: 'TYPE_ERROR',
    eslintRule: '@typescript-eslint/no-unsafe-member-access',
    severity: 'CRITICAL',
    description: '属性不存在',
    fixable: false,
  },
  'TS2345': {
    category: 'TYPE_ERROR',
    eslintRule: '@typescript-eslint/no-unsafe-argument',
    severity: 'CRITICAL',
    description: '参数类型不匹配',
    fixable: false,
  },
  'TS2352': {
    category: 'TYPE_ERROR',
    eslintRule: '@typescript-eslint/no-explicit-any',
    severity: 'CRITICAL',
    description: '类型不兼容',
    fixable: false,
  },

  // 导入相关错误
  'TS2305': {
    category: 'IMPORT_ERROR',
    eslintRule: 'import/no-unresolved',
    severity: 'CRITICAL',
    description: '模块找不到',
    fixable: true,
  },
  'TS2307': {
    category: 'IMPORT_ERROR',
    eslintRule: 'import/no-unresolved',
    severity: 'CRITICAL',
    description: '找不到模块',
    fixable: true,
  },
  'TS2614': {
    category: 'IMPORT_ERROR',
    eslintRule: 'import/no-duplicates',
    severity: 'MAJOR',
    description: '重复导入',
    fixable: true,
  },

  // 变量相关错误
  'TS2300': {
    category: 'VARIABLE_ERROR',
    eslintRule: '@typescript-eslint/no-unused-vars',
    severity: 'MAJOR',
    description: '重复标识符',
    fixable: true,
  },
  'TS2451': {
    category: 'VARIABLE_ERROR',
    eslintRule: '@typescript-eslint/no-unused-vars',
    severity: 'MAJOR',
    description: '重复声明',
    fixable: true,
  },
  'TS2301': {
    category: 'VARIABLE_ERROR',
    eslintRule: '@typescript-eslint/no-unused-vars',
    severity: 'MINOR',
    description: '未使用的变量',
    fixable: true,
  },

  // 函数相关错误
  'TS2554': {
    category: 'FUNCTION_ERROR',
    eslintRule: '@typescript-eslint/no-unsafe-argument',
    severity: 'CRITICAL',
    description: '参数数量不匹配',
    fixable: false,
  },
  'TS2364': {
    category: 'FUNCTION_ERROR',
    eslintRule: '@typescript-eslint/prefer-nullish-coalescing',
    severity: 'MAJOR',
    description: '左侧可能为null',
    fixable: true,
  },

  // 配置相关错误
  'TS18003': {
    category: 'CONFIG_ERROR',
    eslintRule: '@typescript-eslint/no-explicit-any',
    severity: 'CRITICAL',
    description: '配置文件错误',
    fixable: true,
  },

  // 语法错误
  'TS1002': {
    category: 'SYNTAX_ERROR',
    eslintRule: 'semi',
    severity: 'MINOR',
    description: '缺少分号',
    fixable: true,
  },
  'TS1005': {
    category: 'SYNTAX_ERROR',
    eslintRule: 'quotes',
    severity: 'MINOR',
    description: '引号错误',
    fixable: true,
  },
  'TS1109': {
    category: 'SYNTAX_ERROR',
    eslintRule: 'comma-dangle',
    severity: 'MINOR',
    description: '表达式错误',
    fixable: true,
  },
};

// 命令行参数解析
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    tsconfig: 'tsconfig.json',
    project: '.',
    mode: 'full', // full, incremental, eslint-only, typescript-only
    fix: false,
    report: false,
    output: null,
    quiet: false,
    maxIssues: 100,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--tsconfig':
        options.tsconfig = args[++i];
        break;
      case '--project':
        options.project = args[++i];
        break;
      case '--mode':
        options.mode = args[++i];
        break;
      case '--fix':
        options.fix = true;
        break;
      case '--report':
        options.report = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--quiet':
      case '-q':
        options.quiet = true;
        break;
      case '--max-issues':
        options.maxIssues = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          options.project = arg;
        }
        break;
    }
  }

  // 验证模式
  const validModes = ['full', 'incremental', 'eslint-only', 'typescript-only'];
  if (!validModes.includes(options.mode)) {
    console.error(`❌ 无效的检查模式: ${options.mode}`);
    console.error('可用模式:', validModes.join(', '));
    process.exit(1);
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🔗 TypeScript编译器与ESLint协同检查工具

用法: node typescript-eslint-sync.js [选项] [项目路径]

选项:
  --tsconfig <文件>      TypeScript配置文件 [默认: tsconfig.json]
  --project <路径>      项目路径 [默认: .]
  --mode <模式>         检查模式 (full|incremental|eslint-only|typescript-only) [默认: full]
  --fix                 自动修复可修复的问题
  --report              生成协同报告
  --output <文件>       输出报告到文件
  --quiet, -q           静默模式
  --max-issues <数量>   最大问题数量限制 [默认: 100]
  --help, -h            显示帮助信息

检查模式说明:
  full           - 完整检查：TypeScript编译器 + ESLint
  incremental    - 增量检查：只检查变更的文件
  eslint-only    - 仅ESLint检查
  typescript-only- 仅TypeScript检查

错误分类:
  🚨 CRITICAL     - 类型错误、导入错误
  ⚠️ MAJOR        - 函数错误、变量错误
  ✨ MINOR         - 语法错误、配置错误

输出格式:
  统一的错误报告格式，支持自动修复建议
  TypeScript错误自动映射到对应的ESLint规则
  提供修复建议和自动化修复脚本

示例:
  node typescript-eslint-sync.js                      # 完整检查
  node typescript-eslint-sync.js --mode incremental  # 增量检查
  node typescript-eslint-sync.js --fix               # 自动修复
  node typescript-eslint-sync.js --report            # 生成报告
`);
}

/**
 * 执行TypeScript编译器检查
 * @param {Object} options 选项
 * @returns {Object} TypeScript检查结果
 */
function runTypeScriptCheck(options) {
  if (!options.quiet) {
    console.log('🔍 执行TypeScript编译器检查...');
  }

  const startTime = Date.now();
  const tsconfigPath = path.resolve(options.project, options.tsconfig);

  try {
    // 执行tsc编译检查
    const output = execSync(`npx tsc --noEmit --project "${tsconfigPath}" --pretty false`, {
      encoding: 'utf8',
      cwd: options.project,
    });

    // 没有错误
    return {
      success: true,
      errors: [],
      warnings: [],
      duration: Date.now() - startTime,
      output: output,
    };

  } catch (error) {
    // 解析错误输出
    const errors = parseTypeScriptErrors(error.stdout || error.message);

    return {
      success: false,
      errors: errors,
      warnings: [],
      duration: Date.now() - startTime,
      output: error.stdout || error.message,
    };
  }
}

/**
 * 解析TypeScript错误输出
 * @param {string} output TypeScript输出
 * @returns {Array} 解析后的错误列表
 */
function parseTypeScriptErrors(output) {
  const errors = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // 匹配TypeScript错误格式: file(line,column): error TS####: message
    const match = line.match(/^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
    if (match) {
      const [, filePath, lineNum, colNum, errorCode, message] = match;
      const mapping = TS_ERROR_MAPPING[errorCode];

      errors.push({
        file: filePath.trim(),
        line: parseInt(lineNum),
        column: parseInt(colNum),
        errorCode: errorCode,
        message: message.trim(),
        category: mapping?.category || 'UNKNOWN',
        eslintRule: mapping?.eslintRule || null,
        severity: mapping?.severity || 'MAJOR',
        description: mapping?.description || 'TypeScript错误',
        fixable: mapping?.fixable || false,
        source: 'typescript',
      });
    }
  }

  return errors;
}

/**
 * 执行ESLint检查
 * @param {Object} options 选项
 * @returns {Object} ESLint检查结果
 */
function runESLintCheck(options) {
  const { ESLint } = require('eslint');

  if (!options.quiet) {
    console.log('🔍 执行ESLint检查...');
  }

  const startTime = Date.now();

  try {
    const eslint = new ESLint({
      overrideConfigFile: path.join(__dirname, '../eslint.config.js'),
      useEslintrc: false,
      fix: options.fix,
      cache: true,
      cacheLocation: path.join(__dirname, '../.eslintcache'),
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      cwd: options.project,
    });

    const { glob } = require('glob');
    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      cwd: options.project,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    });

    const results = await eslint.lintFiles(files);

    // 转换为统一格式
    const errors = [];
    for (const result of results) {
      for (const message of result.messages) {
        errors.push({
          file: result.filePath,
          line: message.line,
          column: message.column,
          errorCode: message.ruleId,
          message: message.message,
          category: 'ESLINT_RULE',
          eslintRule: message.ruleId,
          severity: message.severity === 2 ? 'MAJOR' : 'MINOR',
          description: 'ESLint规则',
          fixable: message.fix !== undefined,
          source: 'eslint',
          fix: message.fix,
        });
      }
    }

    return {
      success: errors.length === 0,
      errors: errors,
      warnings: [],
      duration: Date.now() - startTime,
      results: results,
    };

  } catch (error) {
    return {
      success: false,
      errors: [{
        file: 'unknown',
        line: 0,
        column: 0,
        errorCode: 'ESLint_ERROR',
        message: error.message,
        category: 'ESLINT_ERROR',
        eslintRule: null,
        severity: 'CRITICAL',
        description: 'ESLint执行错误',
        fixable: false,
        source: 'eslint',
      }],
      warnings: [],
      duration: Date.now() - startTime,
      output: error.message,
    };
  }
}

/**
 * 合并TypeScript和ESLint错误
 * @param {Object} tsResult TypeScript结果
 * @param {Object} eslintResult ESLint结果
 * @returns {Object} 合并后的结果
 */
function mergeResults(tsResult, eslintResult) {
  const allErrors = [...tsResult.errors, ...eslintResult.errors];

  // 按文件和位置排序
  allErrors.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  // 检测冲突
  const conflicts = detectConflicts(tsResult.errors, eslintResult.errors);

  // 统计信息
  const stats = {
    total: allErrors.length,
    bySource: {
      typescript: tsResult.errors.length,
      eslint: eslintResult.errors.length,
    },
    bySeverity: {
      CRITICAL: allErrors.filter(e => e.severity === 'CRITICAL').length,
      MAJOR: allErrors.filter(e => e.severity === 'MAJOR').length,
      MINOR: allErrors.filter(e => e.severity === 'MINOR').length,
    },
    byCategory: {},
    fixable: allErrors.filter(e => e.fixable).length,
  };

  // 按类别统计
  for (const error of allErrors) {
    stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
  }

  return {
    success: tsResult.success && eslintResult.success,
    errors: allErrors.slice(0, options.maxIssues),
    truncated: allErrors.length > options.maxIssues,
    conflicts: conflicts,
    stats: stats,
    duration: tsResult.duration + eslintResult.duration,
    tsResult: tsResult,
    eslintResult: eslintResult,
  };
}

/**
 * 检测TypeScript和ESLint规则冲突
 * @param {Array} tsErrors TypeScript错误
 * @param {Array} eslintErrors ESLint错误
 * @returns {Array} 冲突列表
 */
function detectConflicts(tsErrors, eslintErrors) {
  const conflicts = [];

  for (const tsError of tsErrors) {
    if (!tsError.eslintRule) continue;

    // 查找对应的ESLint错误
    const matchingESLintErrors = eslintErrors.filter(eslintError =>
      eslintError.file === tsError.file &&
      eslintError.line === tsError.line &&
      eslintError.column === tsError.column &&
      eslintError.eslintRule === tsError.eslintRule
    );

    if (matchingESLintErrors.length > 0) {
      conflicts.push({
        type: 'duplicate_check',
        file: tsError.file,
        line: tsError.line,
        column: tsError.column,
        typescriptError: tsError,
        eslintErrors: matchingESLintErrors,
        severity: 'MINOR',
        description: 'TypeScript和ESLint重复检查',
      });
    }
  }

  return conflicts;
}

/**
 * 生成修复建议
 * @param {Object} mergedResult 合并结果
 * @returns {Array} 修复建议列表
 */
function generateFixSuggestions(mergedResult) {
  const suggestions = [];
  const { errors, stats } = mergedResult;

  // 按严重性分组
  const criticalErrors = errors.filter(e => e.severity === 'CRITICAL');
  const majorErrors = errors.filter(e => e.severity === 'MAJOR');
  const minorErrors = errors.filter(e => e.severity === 'MINOR');
  const fixableErrors = errors.filter(e => e.fixable);

  // 关键问题建议
  if (criticalErrors.length > 0) {
    suggestions.push({
      priority: 1,
      severity: 'CRITICAL',
      message: `发现 ${criticalErrors.length} 个关键问题，影响编译和类型安全`,
      action: '立即修复所有类型错误和导入问题',
      commands: [
        'npx tsc --noEmit', // 查看详细的TypeScript错误
        'npm run lint:fix', // 尝试自动修复
      ],
      affectedFiles: [...new Set(criticalErrors.map(e => e.file))],
    });
  }

  // 重要问题建议
  if (majorErrors.length > 0) {
    suggestions.push({
      priority: 2,
      severity: 'MAJOR',
      message: `发现 ${majorErrors.length} 个重要问题，影响代码质量`,
      action: '优先修复函数和变量相关的问题',
      commands: [
        'npm run lint:fix',
        'npm run type-check',
      ],
      affectedFiles: [...new Set(majorErrors.map(e => e.file))],
    });
  }

  // 自动修复建议
  if (fixableErrors.length > 0) {
    suggestions.push({
      priority: 3,
      severity: 'AUTO_FIXABLE',
      message: `发现 ${fixableErrors.length} 个可自动修复的问题`,
      action: '运行自动修复命令',
      commands: [
        'npm run lint:fix-all',
        'npm run format:code',
      ],
      affectedFiles: [...new Set(fixableErrors.map(e => e.file))],
    });
  }

  // 风格问题建议
  if (minorErrors.length > 0) {
    suggestions.push({
      priority: 4,
      severity: 'MINOR',
      message: `发现 ${minorErrors.length} 个代码风格问题`,
      action: '运行代码格式化工具',
      commands: [
        'npm run format:code',
        'npm run lint:fix',
      ],
      affectedFiles: [...new Set(minorErrors.map(e => e.file))],
    });
  }

  // 冲突检测建议
  if (mergedResult.conflicts.length > 0) {
    suggestions.push({
      priority: 5,
      severity: 'CONFIG',
      message: `发现 ${mergedResult.conflicts.length} 个检查冲突`,
      action: '优化ESLint和TypeScript配置，避免重复检查',
      commands: [
        '检查tsconfig.json和eslint.config.js配置',
        '考虑调整规则优先级',
      ],
      affectedFiles: [...new Set(mergedResult.conflicts.map(c => c.file))],
    });
  }

  return suggestions;
}

/**
 * 生成协同报告
 * @param {Object} mergedResult 合并结果
 * @param {Object} options 选项
 * @returns {Object} 协同报告
 */
function generateSyncReport(mergedResult, options) {
  const suggestions = generateFixSuggestions(mergedResult);

  const report = {
    timestamp: new Date().toISOString(),
    project: options.project,
    tsconfig: options.tsconfig,
    mode: options.mode,
    summary: {
      success: mergedResult.success,
      totalErrors: mergedResult.stats.total,
      truncated: mergedResult.truncated,
      duration: mergedResult.duration,
      conflicts: mergedResult.conflicts.length,
    },
    stats: mergedResult.stats,
    suggestions: suggestions,
    quality: {
      score: calculateQualityScore(mergedResult.stats),
      grade: calculateQualityGrade(mergedResult.stats),
      status: getQualityStatus(mergedResult.stats),
    },
  };

  return report;
}

/**
 * 计算质量分数
 * @param {Object} stats 统计信息
 * @returns {number} 质量分数
 */
function calculateQualityScore(stats) {
  const weights = {
    CRITICAL: 20,
    MAJOR: 5,
    MINOR: 1,
  };

  let penalty = 0;
  penalty += stats.bySeverity.CRITICAL * weights.CRITICAL;
  penalty += stats.bySeverity.MAJOR * weights.MAJOR;
  penalty += stats.bySeverity.MINOR * weights.MINOR;

  const score = Math.max(0, 100 - penalty);
  return Math.round(score * 100) / 100;
}

/**
 * 计算质量等级
 * @param {Object} stats 统计信息
 * @returns {string} 质量等级
 */
function calculateQualityGrade(stats) {
  const score = calculateQualityScore(stats);

  if (score >= 95) return 'A';
  if (score >= 85) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * 获取质量状态
 * @param {Object} stats 统计信息
 * @returns {string} 质量状态
 */
function getQualityStatus(stats) {
  if (stats.bySeverity.CRITICAL > 0) return 'CRITICAL';
  if (stats.bySeverity.MAJOR > 0) return 'NEEDS_ATTENTION';
  if (stats.bySeverity.MINOR > 0) return 'GOOD';
  return 'EXCELLENT';
}

/**
 * 打印协同报告
 * @param {Object} report 协同报告
 * @param {Object} options 选项
 */
function printSyncReport(report, options) {
  if (options.quiet) return;

  console.log('\n' + '='.repeat(80));
  console.log('🔗 TypeScript与ESLint协同检查报告');
  console.log('='.repeat(80));

  console.log(`📅 检查时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);
  console.log(`📁 项目路径: ${report.project}`);
  console.log(`⚙️  配置文件: ${report.tsconfig}`);
  console.log(`🔍 检查模式: ${report.mode}`);

  console.log('\n📊 检查统计:');
  console.log(`   总问题数: ${report.summary.totalErrors}`);
  console.log(`   TypeScript: ${report.stats.bySource.typescript}`);
  console.log(`   ESLint: ${report.stats.bySource.eslint}`);
  console.log(`   执行时间: ${Math.round(report.summary.duration / 1000)}s`);
  console.log(`   检查冲突: ${report.summary.conflicts}`);

  console.log('\n📈 质量指标:');
  console.log(`   分数: ${report.quality.score}/100`);
  console.log(`   等级: ${report.quality.grade}`);
  console.log(`   状态: ${report.quality.status}`);

  console.log('\n📋 问题分布:');
  console.log(`   🚨 关键: ${report.stats.bySeverity.CRITICAL}`);
  console.log(`   ⚠️  重要: ${report.stats.bySeverity.MAJOR}`);
  console.log(`   ✨ 风格: ${report.stats.bySeverity.MINOR}`);
  console.log(`   🔧 可修复: ${report.stats.fixable}`);

  if (report.suggestions.length > 0) {
    console.log('\n💡 修复建议:');
    for (const suggestion of report.suggestions) {
      console.log(`\n${suggestion.severity}: ${suggestion.message}`);
      console.log(`   行动: ${suggestion.action}`);
      if (suggestion.commands.length > 0) {
        console.log(`   命令: ${suggestion.commands.join(', ')}`);
      }
    }
  }

  if (report.summary.truncated) {
    console.log('\n⚠️ 注意: 问题列表已截断，只显示前100个问题');
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * 保存报告到文件
 * @param {Object} report 报告
 * @param {string} outputPath 输出路径
 */
function saveReportToFile(report, outputPath) {
  try {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 协同报告已保存到: ${outputPath}`);
  } catch (error) {
    console.error('❌ 保存报告失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  const options = parseArguments();

  try {
    let tsResult, eslintResult;

    // 根据模式执行检查
    switch (options.mode) {
      case 'typescript-only':
        tsResult = runTypeScriptCheck(options);
        eslintResult = { success: true, errors: [], duration: 0 };
        break;
      case 'eslint-only':
        tsResult = { success: true, errors: [], duration: 0 };
        eslintResult = await runESLintCheck(options);
        break;
      case 'incremental':
        // TODO: 实现增量检查逻辑
        console.log('🔄 增量检查模式暂未实现，使用完整检查');
        // 继续执行完整检查
      case 'full':
      default:
        tsResult = runTypeScriptCheck(options);
        eslintResult = await runESLintCheck(options);
        break;
    }

    // 合并结果
    const mergedResult = mergeResults(tsResult, eslintResult);

    // 生成协同报告
    const report = generateSyncReport(mergedResult, options);

    // 打印报告
    printSyncReport(report, options);

    // 保存报告
    if (options.report || options.output) {
      const reportPath = options.output || 'typescript-eslint-sync-report.json';
      saveReportToFile(report, reportPath);
    }

    // 设置退出码
    if (!report.summary.success || report.stats.bySeverity.CRITICAL > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 协同检查失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  main,
  runTypeScriptCheck,
  runESLintCheck,
  mergeResults,
  generateSyncReport,
  TS_ERROR_MAPPING,
};