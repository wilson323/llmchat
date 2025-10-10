#!/usr/bin/env node

/**
 * 🛡️ Pre-commit安全检查脚本
 * 在代码提交前检查危险模式和安全问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 危险模式列表
const DANGEROUS_PATTERNS = [
  {
    name: '正则表达式代码替换',
    pattern: /\.replace\s*\(\s*\/.*\/.*[gimsuxy]*\s*,/g,
    severity: 'high',
    message: '发现危险的字符串替换模式'
  },
  {
    name: '动态RegExp构造',
    pattern: /new\s+RegExp\s*\([^)]*\)/g,
    severity: 'high',
    message: '发现动态正则表达式构造'
  },
  {
    name: 'sed命令替换',
    pattern: /sed.*-i.*s\//g,
    severity: 'critical',
    message: '发现sed文本替换命令'
  },
  {
    name: 'execSync文本操作',
    pattern: /execSync.*\b(sed|awk|perl|replace)\b/g,
    severity: 'critical',
    message: '发现execSync文本操作命令'
  },
  {
    name: 'eval代码执行',
    pattern: /eval\s*\(/g,
    severity: 'high',
    message: '发现eval代码执行'
  },
  {
    name: 'Function构造函数',
    pattern: /new\s+Function\s*\(/g,
    severity: 'high',
    message: '发现Function构造函数'
  }
];

// 敏感信息模式
const SENSITIVE_PATTERNS = [
  {
    name: '硬编码API密钥',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    message: '发现硬编码的API密钥'
  },
  {
    name: '硬编码密码',
    pattern: /(password|passwd|pwd)\s*=\s*['"][^'"]{4,}['"]/gi,
    severity: 'critical',
    message: '发现硬编码密码'
  },
  {
    name: '硬编码数据库连接',
    pattern: /(mongodb|mysql|postgres):\/\/[^:]+:[^@]+@/g,
    severity: 'critical',
    message: '发现硬编码数据库连接字符串'
  }
];

// 检查统计
let stats = {
  filesChecked: 0,
  issuesFound: 0,
  criticalIssues: 0,
  highRiskIssues: 0,
  blockedFiles: []
};

/**
 * 日志输出函数
 */
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  critical: (msg) => console.log(`${colors.red}[CRITICAL]${colors.reset} ${msg}`)
};

/**
 * 检查单个文件
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    let fileIssues = 0;

    log.info(`检查文件: ${relativePath}`);

    // 检查危险模式
    DANGEROUS_PATTERNS.forEach(patternObj => {
      const matches = content.match(patternObj.pattern);
      if (matches) {
        fileIssues++;
        stats.issuesFound++;

        if (patternObj.severity === 'critical') {
          stats.criticalIssues++;
          stats.blockedFiles.push(relativePath);
        } else if (patternObj.severity === 'high') {
          stats.highRiskIssues++;
        }

        log.error(`${patternObj.message} in ${relativePath}`);
        matches.forEach(match => {
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes(match)) {
              console.log(`  第${index + 1}行: ${line.trim()}`);
            }
          });
        });
        console.log('');
      }
    });

    // 检查敏感信息
    SENSITIVE_PATTERNS.forEach(patternObj => {
      const matches = content.match(patternObj.pattern);
      if (matches) {
        fileIssues++;
        stats.issuesFound++;

        if (patternObj.severity === 'critical') {
          stats.criticalIssues++;
          stats.blockedFiles.push(relativePath);
        }

        log.error(`${patternObj.message} in ${relativePath}`);
        matches.forEach(match => {
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes(match)) {
              console.log(`  第${index + 1}行: ${line.replace(/[^:]*:[^:].*$/, '$1: ***')}`);
            }
          });
        });
        console.log('');
      }
    });

    stats.filesChecked++;
    return fileIssues;

  } catch (error) {
    log.warn(`无法读取文件: ${filePath} - ${error.message}`);
    return 0;
  }
}

/**
 * 获取暂存的文件列表
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.split('\n').filter(file =>
      file.trim() &&
      (file.endsWith('.ts') || file.endsWith('.tsx') ||
       file.endsWith('.js') || file.endsWith('.jsx') ||
       file.endsWith('.json') || file.endsWith('.md'))
    );
  } catch (error) {
    log.warn('无法获取暂存文件列表，检查所有文件');
    return getAllFiles();
  }
}

/**
 * 获取所有相关文件
 */
function getAllFiles() {
  const files = [];

  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'dist') {
          scanDirectory(fullPath);
        } else if (stat.isFile() &&
                  (item.endsWith('.ts') || item.endsWith('.tsx') ||
                   item.endsWith('.js') || item.endsWith('.jsx'))) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      // 忽略无法读取的目录
    }
  }

  ['src', 'lib', 'scripts', 'backend', 'frontend'].forEach(dir => {
    if (fs.existsSync(dir)) {
      scanDirectory(dir);
    }
  });

  return files;
}

/**
 * 生成安全报告
 */
function generateReport() {
  console.log('========================================');
  console.log(`${colors.blue}📊 Pre-commit安全检查报告${colors.reset}`);
  console.log('========================================');
  console.log(`检查文件数: ${stats.filesChecked}`);
  console.log(`发现问题数: ${stats.issuesFound}`);
  console.log(`严重问题数: ${colors.red}${stats.criticalIssues}${colors.reset}`);
  console.log(`高风险问题数: ${colors.yellow}${stats.highRiskIssues}${colors.reset}`);
  console.log('');

  if (stats.criticalIssues > 0) {
    log.critical('🚨 发现严重安全问题！提交被阻止！');
    console.log('');
    console.log(`${colors.yellow}📋 解决步骤:${colors.reset}`);
    console.log('1. 移除或修复所有危险的安全问题');
    console.log('2. 使用企业级代码修复工具: pnpm run enterprise:fix');
    console.log('3. 使用环境变量替代硬编码敏感信息');
    console.log('4. 使用TypeScript AST API替代正则表达式');
    console.log('5. 重新提交代码');
    console.log('');

    if (stats.blockedFiles.length > 0) {
      console.log(`${colors.red}被阻止的文件:${colors.reset}`);
      stats.blockedFiles.forEach(file => console.log(`  - ${file}`));
      console.log('');
    }

    return false;
  } else if (stats.highRiskIssues > 0) {
    log.warn('⚠️ 发现高风险安全问题！');
    console.log('');
    console.log('建议在提交前修复这些问题以提高代码安全性。');
    console.log('使用企业级修复工具: pnpm run enterprise:fix');
    console.log('');
    return true; // 允许提交但警告
  } else if (stats.issuesFound === 0) {
    log.success('✅ 安全检查通过！未发现安全问题。');
    console.log('');
    return true;
  } else {
    log.warn('发现一些安全问题，但可以继续提交。');
    console.log('');
    return true;
  }
}

/**
 * 主函数
 */
function main() {
  console.log(`${colors.blue}🛡️ Pre-commit安全检查${colors.reset}`);
  console.log('检查代码中的危险模式和安全问题...');
  console.log('');

  // 获取要检查的文件
  const files = getStagedFiles();

  if (files.length === 0) {
    log.info('没有文件需要检查。');
    process.exit(0);
  }

  console.log(`检查 ${files.length} 个文件...`);
  console.log('');

  // 检查每个文件
  files.forEach(file => {
    if (fs.existsSync(file)) {
      checkFile(file);
    }
  });

  // 生成报告并设置退出码
  const canProceed = generateReport();
  process.exit(canProceed ? 0 : 1);
}

// 运行检查
if (require.main === module) {
  main();
}

module.exports = { checkFile, generateReport, main };