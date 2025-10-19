#!/usr/bin/env node

/**
 * ESLint代码质量检查和报告工具
 *
 * 功能特性：
 * - 全面的代码质量分析
 * - 分级问题统计
 * - 质量趋势跟踪
 * - 生成HTML/JSON/Markdown报告
 * - 质量门禁检查
 */

const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');

// 导入质量规则模块
const {
  QUALITY_LEVELS,
  analyzeResults,
  generateQualityReport,
  printQualityReport,
} = require('./eslint-quality-rules.cjs');

// 命令行参数解析
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    paths: ['src'],
    format: 'console',
    output: null,
    threshold: 80,
    failOnLevel: 'BLOCKER',
    trend: false,
    compareWith: null,
    quiet: false,
    verbose: false,
    report: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--threshold':
      case '-t':
        options.threshold = parseInt(args[++i]);
        break;
      case '--fail-on':
        options.failOnLevel = args[++i];
        break;
      case '--trend':
        options.trend = true;
        break;
      case '--compare-with':
        options.compareWith = args[++i];
        break;
      case '--quiet':
      case '-q':
        options.quiet = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--report':
      case '-r':
        options.report = true;
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

  // 验证参数
  const validFormats = ['console', 'json', 'html', 'markdown'];
  if (!validFormats.includes(options.format)) {
    console.error(`❌ 无效的输出格式: ${options.format}`);
    console.error('可用格式:', validFormats.join(', '));
    process.exit(1);
  }

  const validLevels = Object.keys(QUALITY_LEVELS);
  if (!validLevels.includes(options.failOnLevel)) {
    console.error(`❌ 无效的失败级别: ${options.failOnLevel}`);
    console.error('可用级别:', validLevels.join(', '));
    process.exit(1);
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
📊 ESLint代码质量检查工具

用法: node eslint-quality-check.js [选项] [路径...]

选项:
  --format, -f <格式>     输出格式 (console|json|html|markdown) [默认: console]
  --output, -o <文件>     输出到文件
  --threshold, -t <分数>  质量分数阈值 [默认: 80]
  --fail-on <级别>        发现此级别问题时失败 [默认: BLOCKER]
  --trend                 显示质量趋势
  --compare-with <文件>   与历史报告对比
  --quiet, -q             静默模式
  --verbose, -v           详细输出
  --report, -r            生成详细报告
  --help, -h              显示帮助信息

示例:
  node eslint-quality-check.js                           # 基础检查
  node eslint-quality-check.js --format html            # HTML报告
  node eslint-quality-check.js --threshold 90           # 提高质量阈值
  node eslint-quality-check.js --fail-on CRITICAL      # 关键问题时失败
  node eslint-quality-check.js --trend                 # 显示趋势
  node eslint-quality-check.js --report --output report.html

质量等级说明:
  🚨 BLOCKER  - 阻塞开发，必须立即修复
  ⚠️ CRITICAL - 关键类型安全，需要尽快修复
  ⚡ MAJOR    - 代码质量，需要计划修复
  ✨ MINOR    - 代码风格，可自动修复

质量分数计算:
  基础分数: 100分
  问题扣分: BLOCKER(-20) CRITICAL(-10) MAJOR(-3) MINOR(-1)
  最终分数: max(0, 100 - 总扣分/文件数)
`);
}

/**
 * 创建ESLint实例
 * @returns {ESLint} ESLint实例
 */
function createESLintInstance() {
  return new ESLint({
    overrideConfigFile: path.join(__dirname, '../eslint.config.js'),
    useEslintrc: false,
    fix: false,
    cache: true,
    cacheLocation: path.join(__dirname, '../.eslintcache'),
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  });
}

/**
 * 获取文件列表
 * @param {Array} paths 路径数组
 * @returns {Array} 文件路径数组
 */
function getFileList(paths) {
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
 * 执行质量检查
 * @param {ESLint} eslint ESLint实例
 * @param {Array} files 文件列表
 * @param {Object} options 选项
 * @returns {Object} 检查结果
 */
async function performQualityCheck(eslint, files, options) {
  if (!options.quiet) {
    console.log('📊 开始执行代码质量检查...');
    console.log(`📁 检查文件: ${files.length}`);
    console.log(`📋 质量阈值: ${options.threshold}`);
  }

  const startTime = Date.now();

  try {
    // 执行ESLint检查
    const results = await eslint.lintFiles(files);

    // 分析结果
    const issues = analyzeResults(results);
    const report = generateQualityReport(issues);

    // 添加执行时间
    report.execution = {
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      filesChecked: files.length,
      options: options,
    };

    return report;

  } catch (error) {
    throw new Error(`质量检查失败: ${error.message}`);
  }
}

/**
 * 生成HTML报告
 * @param {Object} report 质量报告
 * @returns {string} HTML内容
 */
function generateHTMLReport(report) {
  const gradeColor = getGradeColor(report.quality.grade);
  const statusColor = getStatusColor(report.quality.status);

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESLint代码质量报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .title { margin: 0; font-size: 2em; }
        .subtitle { margin: 10px 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .metric-value { font-size: 2em; font-weight: bold; margin: 0; }
        .metric-label { color: #666; margin: 5px 0 0; }
        .issues { margin-bottom: 30px; }
        .issue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .issue-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid; }
        .issue-count { font-size: 1.5em; font-weight: bold; margin: 0; }
        .issue-label { margin: 5px 0 10px; color: #666; }
        .blocker { border-color: #dc3545; }
        .critical { border-color: #fd7e14; }
        .major { border-color: #ffc107; }
        .minor { border-color: #28a745; }
        .grade { font-size: 3em; font-weight: bold; margin: 0; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .recommendation { margin-bottom: 10px; }
        .timestamp { text-align: center; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.9em; font-weight: bold; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">📊 ESLint代码质量报告</h1>
            <div class="subtitle">
                质量等级: <span class="grade" style="color: ${gradeColor}">${report.quality.grade}</span>
                <span class="status" style="background: ${statusColor}; color: white;">${report.quality.status}</span>
            </div>
        </div>

        <div class="content">
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">${report.quality.score}</div>
                    <div class="metric-label">质量分数</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${report.summary.total}</div>
                    <div class="metric-label">总问题数</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${report.summary.files}</div>
                    <div class="metric-label">检查文件数</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${Math.round(report.execution.duration / 1000)}s</div>
                    <div class="metric-label">执行时间</div>
                </div>
            </div>

            <div class="issues">
                <h2>📋 问题分布</h2>
                <div class="issue-grid">
                    <div class="issue-card blocker">
                        <div class="issue-count">${report.summary.blocker}</div>
                        <div class="issue-label">🚨 阻塞问题</div>
                        <div>必须立即修复</div>
                    </div>
                    <div class="issue-card critical">
                        <div class="issue-count">${report.summary.critical}</div>
                        <div class="issue-label">⚠️ 关键问题</div>
                        <div>影响类型安全</div>
                    </div>
                    <div class="issue-card major">
                        <div class="issue-count">${report.summary.major}</div>
                        <div class="issue-label">⚡ 重要问题</div>
                        <div>影响代码质量</div>
                    </div>
                    <div class="issue-card minor">
                        <div class="issue-count">${report.summary.minor}</div>
                        <div class="issue-label">✨ 风格问题</div>
                        <div>可自动修复</div>
                    </div>
                </div>
            </div>

            ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h2>💡 修复建议</h2>
                ${report.recommendations.map(rec => `
                    <div class="recommendation">
                        <strong>${rec.message}</strong><br>
                        <small>行动: ${rec.action}</small>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div class="timestamp">
                生成时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * 生成Markdown报告
 * @param {Object} report 质量报告
 * @returns {string} Markdown内容
 */
function generateMarkdownReport(report) {
  return `
# ESLint代码质量报告

## 📊 质量概览

| 指标 | 数值 |
|------|------|
| 质量分数 | ${report.quality.score}/100 |
| 质量等级 | ${report.quality.grade} |
| 质量状态 | ${report.quality.status} |
| 检查文件 | ${report.summary.files} |
| 总问题数 | ${report.summary.total} |
| 执行时间 | ${Math.round(report.execution.duration / 1000)}秒 |

## 📋 问题分布

| 等级 | 数量 | 描述 |
|------|------|------|
| 🚨 阻塞 | ${report.summary.blocker} | 必须立即修复 |
| ⚠️ 关键 | ${report.summary.critical} | 影响类型安全 |
| ⚡ 重要 | ${report.summary.major} | 影响代码质量 |
| ✨ 风格 | ${report.summary.minor} | 可自动修复 |

## 💡 修复建议

${report.recommendations.map(rec => `
- **${rec.message}**
  - 行动: ${rec.action}
  ${rec.commands ? `- 命令: \`${rec.commands.join('`, `')}\`` : ''}
`).join('')}

---

*报告生成时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}*
`;
}

/**
 * 获取等级颜色
 * @param {string} grade 等级
 * @returns {string} 颜色
 */
function getGradeColor(grade) {
  const colors = {
    'A': '#28a745',
    'B': '#17a2b8',
    'C': '#ffc107',
    'D': '#fd7e14',
    'F': '#dc3545',
  };
  return colors[grade] || '#6c757d';
}

/**
 * 获取状态颜色
 * @param {string} status 状态
 * @returns {string} 颜色
 */
function getStatusColor(status) {
  const colors = {
    'EXCELLENT': '#28a745',
    'GOOD': '#17a2b8',
    'NEEDS_ATTENTION': '#ffc107',
    'CRITICAL': '#fd7e14',
    'BLOCKED': '#dc3545',
  };
  return colors[status] || '#6c757d';
}

/**
 * 输出报告
 * @param {Object} report 质量报告
 * @param {Object} options 选项
 */
function outputReport(report, options) {
  let content;

  switch (options.format) {
    case 'json':
      content = JSON.stringify(report, null, 2);
      break;
    case 'html':
      content = generateHTMLReport(report);
      break;
    case 'markdown':
      content = generateMarkdownReport(report);
      break;
    case 'console':
    default:
      printQualityReport(report);
      if (options.verbose && report.recommendations.length > 0) {
        console.log('\n💡 详细建议:');
        report.recommendations.forEach((rec, index) => {
          console.log(`\n${index + 1}. ${rec.message}`);
          console.log(`   行动: ${rec.action}`);
          if (rec.commands) {
            console.log(`   命令: ${rec.commands.join(', ')}`);
          }
        });
      }
      break;
  }

  if (options.output && content) {
    try {
      fs.writeFileSync(options.output, content);
      console.log(`📄 报告已保存到: ${options.output}`);
    } catch (error) {
      console.error('❌ 保存报告失败:', error.message);
    }
  }
}

/**
 * 检查质量门禁
 * @param {Object} report 质量报告
 * @param {Object} options 选项
 */
function checkQualityGate(report, options) {
  // 检查质量分数
  if (report.quality.score < options.threshold) {
    console.error(`❌ 质量分数 ${report.quality.score} 低于阈值 ${options.threshold}`);
    process.exit(1);
  }

  // 检查失败级别
  const failLevel = options.failOnLevel.toUpperCase();
  const levelCounts = {
    'BLOCKER': report.summary.blocker,
    'CRITICAL': report.summary.critical,
    'MAJOR': report.summary.major,
    'MINOR': report.summary.minor,
  };

  if (levelCounts[failLevel] > 0) {
    console.error(`❌ 发现 ${levelCounts[failLevel]} 个 ${failLevel} 级别问题`);
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`✅ 质量门禁通过 (分数: ${report.quality.score} >= ${options.threshold})`);
  }
}

/**
 * 加载历史报告进行对比
 * @param {string} filePath 文件路径
 * @returns {Object|null} 历史报告
 */
function loadHistoricalReport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️ 无法加载历史报告: ${error.message}`);
    return null;
  }
}

/**
 * 显示质量趋势
 * @param {Object} current 当前报告
 * @param {Object} previous 历史报告
 */
function showQualityTrend(current, previous) {
  if (!previous) return;

  console.log('\n📈 质量趋势对比:');
  console.log(`   质量分数: ${previous.quality.score} → ${current.quality.score} (${current.quality.score - previous.quality.score >= 0 ? '+' : ''}${current.quality.score - previous.quality.score})`);

  const metrics = ['total', 'blocker', 'critical', 'major', 'minor'];
  metrics.forEach(metric => {
    const currentCount = current.summary[metric];
    const previousCount = previous.summary[metric];
    const diff = currentCount - previousCount;
    const trend = diff >= 0 ? `+${diff}` : `${diff}`;
    const emoji = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';

    console.log(`   ${metric}: ${previousCount} → ${currentCount} (${emoji} ${trend})`);
  });
}

/**
 * 主函数
 */
async function main() {
  const options = parseArguments();

  try {
    // 创建ESLint实例
    const eslint = createESLintInstance();

    // 获取文件列表
    const files = getFileList(options.paths);
    if (files.length === 0) {
      console.log('✅ 没有找到需要检查的文件');
      return;
    }

    // 执行质量检查
    const report = await performQualityCheck(eslint, files, options);

    // 加载历史报告（如果需要）
    if (options.compareWith || options.trend) {
      const historicalReport = loadHistoricalReport(options.compareWith || 'eslint-quality-report.json');
      if (historicalReport) {
        showQualityTrend(report, historicalReport);
      }
    }

    // 输出报告
    outputReport(report, options);

    // 保存当前报告（用于趋势对比）
    if (options.report) {
      const reportPath = options.output || 'eslint-quality-report.json';
      try {
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📊 报告已保存: ${reportPath}`);
      } catch (error) {
        console.error('❌ 保存报告失败:', error.message);
      }
    }

    // 检查质量门禁
    checkQualityGate(report, options);

  } catch (error) {
    console.error('❌ 质量检查失败:', error.message);
    if (options.verbose) {
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
  performQualityCheck,
  generateHTMLReport,
  generateMarkdownReport,
  checkQualityGate,
};