#!/usr/bin/env node

/**
 * 质量检查脚本
 * 运行完整的代码质量检查流程
 */

const { execSync } = require('child_process');

// 直接定义颜色函数，避免依赖问题
const colors = {
  success: (text) => `\x1b[32m${text}\x1b[0m`,
  error: (text) => `\x1b[31m${text}\x1b[0m`,
  warning: (text) => `\x1b[33m${text}\x1b[0m`,
  info: (text) => `\x1b[34m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`
};

function runCommand(command, description, options = {}) {
  const {
    silent = false,
    allowedToFail = false,
    workingDir = process.cwd()
  } = options;

  console.log(colors.info(`🔍 ${description}...`));

  try {
    const result = execSync(command, {
      stdio: silent ? 'pipe' : 'inherit',
      cwd: workingDir,
      encoding: 'utf8'
    });

    if (silent && result) {
      console.log(result);
    }

    console.log(colors.success(`✅ ${description} completed successfully`));
    return true;
  } catch (error) {
    if (allowedToFail) {
      console.log(colors.warning(`⚠️  ${description} completed with warnings`));
      return true;
    } else {
      console.log(colors.error(`❌ ${description} failed:`));
      if (!silent) {
        console.log(colors.dim(error.message));
      }
      return false;
    }
  }
}

function main() {
  console.log(colors.info('🚀 Starting comprehensive quality checks...\n'));

  const checks = [
    {
      command: 'pnpm run type-check',
      description: 'TypeScript type checking',
      allowedToFail: false
    },
    {
      command: 'pnpm run lint',
      description: 'ESLint checking',
      allowedToFail: false
    },
    {
      command: 'pnpm run build',
      description: 'Build validation',
      allowedToFail: false
    },
    {
      command: 'pnpm test',
      description: 'Unit tests',
      allowedToFail: false
    }
  ];

  let allPassed = true;

  for (const check of checks) {
    const passed = runCommand(check.command, check.description, {
      silent: false,
      allowedToFail: check.allowedToFail
    });

    if (!passed) {
      allPassed = false;

      if (!check.allowedToFail) {
        console.log(colors.error('\n🛑 Quality checks failed. Please fix the issues above.'));
        process.exit(1);
      }
    }
  }

  if (allPassed) {
    console.log(colors.success('\n🎉 All quality checks passed! Code is ready for commit/push.'));
    console.log(colors.info('\n📋 Summary:'));
    console.log(colors.dim('  ✓ Types are correct'));
    console.log(colors.dim('  ✓ Linting passes'));
    console.log(colors.dim('  ✓ Build succeeds'));
    console.log(colors.dim('  ✓ Tests pass'));
  }
}

// 处理命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Quality Check Script

Usage: node scripts/quality-check.js [options]

Options:
  --help, -h     Show this help message
  --pre-commit   Run lightweight checks (lint + type-check only)
  --pre-push     Run full checks (default behavior)

Examples:
  node scripts/quality-check.js
  node scripts/quality-check.js --pre-commit
`);
  process.exit(0);
}

if (args.includes('--pre-commit')) {
  // 预提交模式 - 运行快速检查
  console.log(colors.info('🔧 Running pre-commit checks (lightweight)...\n'));

  const preCommitChecks = [
    {
      command: 'npx tsc --noEmit',
      description: 'TypeScript type checking',
      allowedToFail: false
    }
  ];

  let allPassed = true;
  for (const check of preCommitChecks) {
    const passed = runCommand(check.command, check.description, {
      silent: false,
      allowedToFail: check.allowedToFail
    });

    if (!passed) {
      allPassed = false;
      console.log(colors.error('\n🛑 Pre-commit checks failed. Please fix the issues before committing.'));
      process.exit(1);
    }
  }

  if (allPassed) {
    console.log(colors.success('\n✅ Pre-commit checks passed! Ready to commit.'));
  }
} else if (args.includes('--staged')) {
  // 检查staged文件模式
  console.log(colors.info('📋 Running checks on staged files...\n'));

  try {
    // 获取staged文件列表
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(file => file.trim() && /\.(js|jsx|ts|tsx)$/.test(file));

    if (stagedFiles.length === 0) {
      console.log(colors.info('ℹ️  No TypeScript/JavaScript files staged.'));
      process.exit(0);
    }

    console.log(colors.info(`📁 Found ${stagedFiles.length} staged TS/JS files to check:`));
    stagedFiles.forEach(file => console.log(colors.dim(`  - ${file}`)));
    console.log('');

    // 对staged文件运行类型检查
    const passed = runCommand('npx tsc --noEmit', 'TypeScript type checking on staged files', {
      silent: false,
      allowedToFail: false
    });

    if (passed) {
      console.log(colors.success('\n✅ Staged files type-check passed!'));
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.log(colors.error('❌ Failed to get staged files list'));
    process.exit(1);
  }
} else {
  // 默认行为 - 完整检查
  main();
}