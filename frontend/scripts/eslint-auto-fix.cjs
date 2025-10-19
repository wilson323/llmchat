#!/usr/bin/env node

/**
 * 自动化ESLint修复脚本
 *
 * 功能特性：
 * - 分级修复策略（安全/标准/激进）
 * - 详细的修复报告
 * - 修复前后对比
 * - 自动化格式化
 * - 质量评分
 */

const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// 导入质量规则模块
const {
  QUALITY_LEVELS,
  analyzeResults,
  generateQualityReport,
  printQualityReport,
} = require('./eslint-quality-rules.js');

// 修复策略配置
const FIX_STRATEGIES = {
  safe: {
    description: '安全修复：只修复MINOR级别问题',
    levels: ['MINOR'],
    maxFilesPerBatch: 5,
    dryRun: false,
  },
  standard: {
    description: '标准修复：修复MINOR和MAJOR级别问题',
    levels: ['MINOR', 'MAJOR'],
    maxFilesPerBatch: 10,
    dryRun: false,
  },
  aggressive: {
    description: '激进修复：修复所有可修复的问题',
    levels: ['MINOR', 'MAJOR', 'CRITICAL'],
    maxFilesPerBatch: 20,
    dryRun: false,
  },
  'dry-run': {
    description: '模拟运行：检查问题但不实际修复',
    levels: ['MINOR', 'MAJOR', 'CRITICAL'],
    maxFilesPerBatch: Infinity,
    dryRun: true,
  },
};

/**
 * 解析命令行参数
 * @returns {Object} 解析后的参数
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    strategy: 'standard',
    dryRun: false,
    quiet: false,
    format: false,
    report: false,
    output: null,
    paths: ['src'],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--strategy':
      case '-s':
        options.strategy = args[++i];
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        options.strategy = 'dry-run';
        break;
      case '--quiet':
      case '-q':
        options.quiet = true;
        break;
      case '--format':
      case '-f':
        options.format = true;
        break;
      case '--report':
      case '-r':
        options.report = true;
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          options.paths = arg.split(',');
        }
        break;
    }
  }

  // 验证策略
  if (!FIX_STRATEGIES[options.strategy]) {
    console.error(`❌ 未知的修复策略: ${options.strategy}`);
    console.error('可用策略:', Object.keys(FIX_STRATEGIES).join(', '));
    process.exit(1);
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🔧 ESLint自动修复工具

用法: node eslint-auto-fix.js [选项] [路径...]

选项:
  --strategy, -s <策略>    修复策略 (safe|standard|aggressive|dry-run) [默认: standard]
  --dry-run, -d           模拟运行，不实际修复文件
  --quiet, -q             静默模式，减少输出
  --format, -f            修复后自动格式化代码
  --report, -r            生成详细报告
  --output, -o <文件>      将报告保存到文件
  --help, -h              显示帮助信息

示例:
  node eslint-auto-fix.js                          # 标准修复
  node eslint-auto-fix.js --strategy safe          # 安全修复
  node eslint-auto-fix.js --dry-run               # 模拟运行
  node eslint-auto-fix.js --format --report       # 修复+格式化+报告
  node eslint-auto-fix.js src/components/**/*.tsx  # 修复特定文件

修复策略说明:
  safe      - 只修复MINOR级别问题（代码风格），100%安全
  standard  - 修复MINOR和MAJOR级别问题，99%安全
  aggressive- 修复所有可修复问题，90%安全
  dry-run   - 模拟运行，检查问题但不修复
`);
}

/**
 * 创建ESLint实例
 * @param {Object} options 配置选项
 * @returns {ESLint} ESLint实例
 */
function createESLintInstance(options) {
  const eslintOptions = {
    overrideConfigFile: path.join(__dirname, '../eslint.config.js'),
    useEslintrc: false,
    fix: !options.dryRun,
    cache: true,
    cacheLocation: path.join(__dirname, '../.eslintcache'),
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  };

  return new ESLint(eslintOptions);
}

/**
 * 获取文件列表
 * @param {Array} paths 路径数组
 * @returns {Array} 文件路径数组
 */
function getFileList(paths) {
  const { glob } = require('glob');
  const files = [];

  for (const pattern of paths) {
    // 如果是目录，添加通配符
    const searchPattern = fs.statSync(pattern).isDirectory()
      ? path.join(pattern, '**/*.{ts,tsx,js,jsx}')
      : pattern;

    const matchedFiles = glob.sync(searchPattern, {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.next/**',
        '**/temp/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    });

    files.push(...matchedFiles);
  }

  return [...new Set(files)]; // 去重
}

/**
 * 批量处理文件
 * @param {ESLint} eslint ESLint实例
 * @param {Array} files 文件列表
 * @param {Object} options 选项
 * @returns {Object} 处理结果
 */
async function processFilesInBatches(eslint, files, options) {
  const strategy = FIX_STRATEGIES[options.strategy];
  const results = {
    total: files.length,
    processed: 0,
    fixed: 0,
    failed: 0,
    issues: {
      before: { total: 0, byLevel: {} },
      after: { total: 0, byLevel: {} },
    },
    batches: [],
  };

  console.log(`📦 开始批量处理 ${files.length} 个文件...`);
  console.log(`📋 使用策略: ${strategy.description}\n`);

  // 分批处理
  for (let i = 0; i < files.length; i += strategy.maxFilesPerBatch) {
    const batch = files.slice(i, i + strategy.maxFilesPerBatch);
    const batchNumber = Math.floor(i / strategy.maxFilesPerBatch) + 1;
    const totalBatches = Math.ceil(files.length / strategy.maxFilesPerBatch);

    console.log(`🔄 处理批次 ${batchNumber}/${totalBatches} (${batch.length} 个文件)`);

    try {
      // 修复前检查
      const beforeResults = await eslint.lintFiles(batch);
      const beforeIssues = analyzeResults(beforeResults);

      // 执行修复
      const fixResults = await eslint.lintFiles(batch);

      // 保存修复结果
      if (!options.dryRun) {
        await ESLint.outputFixes(fixResults);
      }

      // 修复后检查
      const afterResults = await eslint.lintFiles(batch);
      const afterIssues = analyzeResults(afterResults);

      // 统计结果
      const batchResults = {
        batchNumber,
        files: batch,
        before: beforeIssues.summary,
        after: afterIssues.summary,
        fixed: beforeIssues.summary.total - afterIssues.summary.total,
        success: true,
      };

      results.batches.push(batchResults);
      results.processed += batch.length;
      results.fixed += batchResults.fixed;

      // 显示批次结果
      console.log(`   ✅ 批次完成: 修复 ${batchResults.fixed} 个问题`);

    } catch (error) {
      console.error(`   ❌ 批次失败: ${error.message}`);
      results.failed++;
      results.batches.push({
        batchNumber,
        files: batch,
        error: error.message,
        success: false,
      });
    }
  }

  return results;
}

/**
 * 格式化代码
 * @param {Array} files 文件列表
 * @param {Object} options 选项
 */
function formatCode(files, options) {
  if (!options.format || options.dryRun) return;

  console.log('\n🎨 格式化代码...');

  try {
    // 运行Prettier格式化
    execSync(`npx prettier --write "${files.join('" "')}"`, {
      stdio: options.quiet ? 'pipe' : 'inherit',
      cwd: path.dirname(__dirname),
    });
    console.log('✅ 代码格式化完成');
  } catch (error) {
    console.error('❌ 代码格式化失败:', error.message);
  }
}

/**
 * 生成修复报告
 * @param {Object} processResults 处理结果
 * @param {Object} options 选项
 * @returns {Object} 修复报告
 */
function generateFixReport(processResults, options) {
  const report = {
    timestamp: new Date().toISOString(),
    strategy: options.strategy,
    dryRun: options.dryRun,
    summary: {
      totalFiles: processResults.total,
      processedFiles: processResults.processed,
      failedFiles: processResults.failed,
      fixedIssues: processResults.fixed,
      successRate: ((processResults.processed / processResults.total) * 100).toFixed(2),
    },
    batches: processResults.batches,
    recommendations: generateFixRecommendations(processResults, options),
  };

  return report;
}

/**
 * 生成修复建议
 * @param {Object} processResults 处理结果
 * @param {Object} options 选项
 * @returns {Array} 修复建议列表
 */
function generateFixRecommendations(processResults, options) {
  const recommendations = [];

  if (processResults.failed > 0) {
    recommendations.push({
      priority: 1,
      level: 'ERROR',
      message: `${processResults.failed} 个文件处理失败`,
      action: '检查错误日志，手动修复失败的问题',
    });
  }

  if (processResults.fixed === 0 && !options.dryRun) {
    recommendations.push({
      priority: 2,
      level: 'INFO',
      message: '没有发现可自动修复的问题',
      action: '代码质量良好，或者需要手动修复',
    });
  }

  if (options.strategy === 'safe' && processResults.fixed > 0) {
    recommendations.push({
      priority: 3,
      level: 'SUGGESTION',
      message: '安全策略修复完成，建议尝试标准策略',
      action: '运行: node eslint-auto-fix.js --strategy standard',
    });
  }

  if (options.dryRun && processResults.fixed > 0) {
    recommendations.push({
      priority: 4,
      level: 'ACTION',
      message: `发现 ${processResults.fixed} 个可修复的问题`,
      action: '运行: node eslint-auto-fix.js --strategy standard',
    });
  }

  return recommendations;
}

/**
 * 打印修复报告
 * @param {Object} report 修复报告
 * @param {Object} options 选项
 */
function printFixReport(report, options) {
  if (options.quiet) return;

  console.log('\n' + '='.repeat(80));
  console.log('🔧 ESLint自动修复报告');
  console.log('='.repeat(80));

  console.log(`📅 修复时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);
  console.log(`📋 修复策略: ${report.strategy}`);
  console.log(`🔍 模拟运行: ${report.dryRun ? '是' : '否'}`);

  console.log('\n📊 处理统计:');
  console.log(`   总文件数: ${report.summary.totalFiles}`);
  console.log(`   处理文件: ${report.summary.processedFiles}`);
  console.log(`   失败文件: ${report.summary.failedFiles}`);
  console.log(`   修复问题: ${report.summary.fixedIssues}`);
  console.log(`   成功率: ${report.summary.successRate}%`);

  if (report.recommendations.length > 0) {
    console.log('\n💡 建议和后续操作:');
    for (const rec of report.recommendations) {
      console.log(`   • ${rec.message}`);
      if (rec.action) {
        console.log(`     → ${rec.action}`);
      }
    }
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
    const reportPath = outputPath || `eslint-fix-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 报告已保存到: ${reportPath}`);
  } catch (error) {
    console.error('❌ 保存报告失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  const options = parseArguments();

  if (!options.quiet) {
    console.log('🔧 ESLint自动修复工具启动');
    console.log(`📋 修复策略: ${FIX_STRATEGIES[options.strategy].description}`);
    if (options.dryRun) {
      console.log('🔍 模拟运行模式 - 不会修改文件');
    }
  }

  try {
    // 创建ESLint实例
    const eslint = createESLintInstance(options);

    // 获取文件列表
    const files = getFileList(options.paths);
    if (files.length === 0) {
      console.log('✅ 没有找到需要处理的文件');
      return;
    }

    // 批量处理文件
    const processResults = await processFilesInBatches(eslint, files, options);

    // 格式化代码
    if (processResults.fixed > 0) {
      formatCode(files, options);
    }

    // 生成报告
    const report = generateFixReport(processResults, options);

    // 打印报告
    printFixReport(report, options);

    // 保存报告
    if (options.report || options.output) {
      saveReportToFile(report, options.output);
    }

    // 设置退出码
    if (processResults.failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 自动修复失败:', error.message);
    if (!options.quiet) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseArguments,
  createESLintInstance,
  getFileList,
  processFilesInBatches,
  generateFixReport,
  FIX_STRATEGIES,
};