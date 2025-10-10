#!/usr/bin/env node

/**
 * ESLint渐进式修复策略脚本
 * 根据优先级分阶段修复ESLint问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 错误分类
  RULE_PRIORITIES: {
    // BLOCKER - 阻塞开发，必须立即修复
    BLOCKER: [
      '@typescript-eslint/no-unused-vars',
      'no-unreachable',
      'no-constant-condition',
      'no-debugger',
      'no-alert',
      'no-eval',
      'no-implied-eval',
      'no-new-func',
      'no-script-url',
      'no-useless-constructor',
      'no-duplicate-imports',
      'no-unused-expressions'
    ],

    // CRITICAL - 关键类型安全，需要尽快修复
    CRITICAL: [
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-unsafe-assignment',
      '@typescript-eslint/no-unsafe-member-access',
      '@typescript-eslint/no-unsafe-call',
      '@typescript-eslint/no-unsafe-return',
      '@typescript-eslint/no-unsafe-argument'
    ],

    // MAJOR - 代码质量，需要计划修复
    MAJOR: [
      'prefer-const',
      'no-var',
      'no-empty',
      'no-extra-boolean-cast',
      'no-extra-semi',
      'eqeqeq',
      'curly',
      'brace-style',
      '@typescript-eslint/prefer-nullish-coalescing',
      '@typescript-eslint/prefer-optional-chain',
      '@typescript-eslint/no-unnecessary-type-assertion'
    ],

    // MINOR - 代码风格，可自动修复
    MINOR: [
      'comma-dangle',
      'comma-spacing',
      'comma-style',
      'computed-property-spacing',
      'func-call-spacing',
      'key-spacing',
      'keyword-spacing',
      'linebreak-style',
      'no-multiple-empty-lines',
      'no-trailing-spaces',
      'object-curly-spacing',
      'quotes',
      'semi',
      'semi-spacing',
      'space-before-blocks',
      'space-in-parens',
      'space-infix-ops',
      'space-unary-ops',
      'spaced-comment',
      'no-useless-rename'
    ]
  },

  // 复杂度规则 - 需要手动修复
  COMPLEXITY_RULES: [
    'complexity',
    'max-depth',
    'max-nested-callbacks',
    'max-params',
    'max-len'
  ],

  // 忽略的规则（暂时不修复）
  IGNORE_RULES: [
    'no-magic-numbers', // 太多误报，单独处理
    'no-console' // 开发阶段允许
  ]
};

// 工具函数
function runCommand(command, options = {}) {
  try {
    console.log(`🔄 Running: ${command}`);
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    if (options.silent) {
      return error.stdout || '';
    }
    throw error;
  }
}

function getPriorityRules(priority) {
  return CONFIG.RULE_PRIORITIES[priority] || [];
}

function fixRules(rules, options = {}) {
  if (!rules || rules.length === 0) {
    console.log('⚠️ No rules to fix');
    return;
  }

  const ruleString = rules.join(',');
  const fixOption = options.autoFix ? '--fix' : '';

  console.log(`🔧 Fixing rules: ${rules.join(', ')}`);

  try {
    runCommand(`npx eslint ${fixOption} --quiet --rule "${ruleString}" .`, options);
    console.log('✅ Rules fixed successfully');
  } catch (error) {
    console.log(`❌ Failed to fix rules: ${error.message}`);
    if (!options.continueOnError) {
      throw error;
    }
  }
}

function getProjectStats() {
  console.log('📊 Getting project statistics...');

  try {
    const backendResult = runCommand('cd backend && npx eslint --format=json .', { silent: true });
    const frontendResult = runCommand('cd frontend && npx eslint --format=json .', { silent: true });

    const backendData = JSON.parse(backendResult);
    const frontendData = JSON.parse(frontendResult);

    const stats = {
      backend: {
        errors: backendData.reduce((sum, file) => sum + file.errorCount, 0),
        warnings: backendData.reduce((sum, file) => sum + file.warningCount, 0),
        files: backendData.length
      },
      frontend: {
        errors: frontendData.reduce((sum, file) => sum + file.errorCount, 0),
        warnings: frontendData.reduce((sum, file) => sum + file.warningCount, 0),
        files: frontendData.length
      }
    };

    stats.total = {
      errors: stats.backend.errors + stats.frontend.errors,
      warnings: stats.backend.warnings + stats.frontend.warnings,
      files: stats.backend.files + stats.frontend.files
    };

    return stats;
  } catch (error) {
    console.log(`⚠️ Could not get detailed stats: ${error.message}`);
    return null;
  }
}

function printStats(stats) {
  if (!stats) {
    console.log('❌ Could not retrieve statistics');
    return;
  }

  console.log('\n📊 ESLint Statistics:');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│                    │  Errors  │ Warnings │   Files   │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Backend             │   ${stats.backend.errors.toString().padStart(6)} │ ${stats.backend.warnings.toString().padStart(8)} │ ${stats.backend.files.toString().padStart(9)} │`);
  console.log(`│ Frontend            │   ${stats.frontend.errors.toString().padStart(6)} │ ${stats.frontend.warnings.toString().padStart(8)} │ ${stats.frontend.files.toString().padStart(9)} │`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Total               │   ${stats.total.errors.toString().padStart(6)} │ ${stats.total.warnings.toString().padStart(8)} │ ${stats.total.files.toString().padStart(9)} │`);
  console.log('└─────────────────────────────────────────────────────────┘');
}

// 修复策略
class ESLintFixStrategy {
  constructor() {
    this.initialStats = null;
    this.currentStats = null;
  }

  async initialize() {
    console.log('🚀 Initializing ESLint Fix Strategy...\n');
    this.initialStats = getProjectStats();
    printStats(this.initialStats);
  }

  async fixBlockerIssues() {
    console.log('\n🚨 === PHASE 1: Fixing BLOCKER Issues ===');
    const blockerRules = getPriorityRules('BLOCKER');

    // 分组修复以避免冲突
    const groups = [
      ['@typescript-eslint/no-unused-vars'], // 单独修复变量问题
      ['no-unreachable', 'no-constant-condition'], // 控制流问题
      ['no-debugger', 'no-alert', 'no-eval', 'no-implied-eval', 'no-new-func', 'no-script-url'], // 安全问题
      ['no-useless-constructor', 'no-duplicate-imports', 'no-unused-expressions'] // 代码质量
    ];

    for (const group of groups) {
      const rules = group.filter(rule => blockerRules.includes(rule));
      if (rules.length > 0) {
        fixRules(rules, { autoFix: true, continueOnError: true });
        this.currentStats = getProjectStats();
        console.log('Current stats after fixing:', rules.join(', '));
        printStats(this.currentStats);
      }
    }
  }

  async fixCriticalIssues() {
    console.log('\n⚡ === PHASE 2: Fixing CRITICAL Issues ===');
    const criticalRules = getPriorityRules('CRITICAL');

    // 类型安全规则需要谨慎处理
    for (const rule of criticalRules) {
      console.log(`\n🔍 Processing critical rule: ${rule}`);

      if (rule === '@typescript-eslint/no-explicit-any') {
        // any类型修复需要分步进行
        console.log('📝 Any type fixes require manual review. Generating report...');
        this.generateAnyTypeReport();
      } else {
        // 其他类型安全规则可以先警告
        fixRules([rule], { autoFix: false, continueOnError: true });
      }
    }

    this.currentStats = getProjectStats();
    printStats(this.currentStats);
  }

  async fixMajorIssues() {
    console.log('\n🔧 === PHASE 3: Fixing MAJOR Issues ===');
    const majorRules = getPriorityRules('MAJOR');

    // 分组自动修复
    const autoFixGroups = [
      ['prefer-const', 'no-var'], // 变量声明
      ['eqeqeq', 'curly', 'brace-style'], // 控制结构
      ['comma-dangle', 'comma-spacing', 'comma-style', 'computed-property-spacing'], // 格式化
      ['func-call-spacing', 'key-spacing', 'keyword-spacing', 'linebreak-style'], // 间距
      ['no-multiple-empty-lines', 'no-trailing-spaces', 'object-curly-spacing'], // 空白
      ['quotes', 'semi', 'semi-spacing'], // 分号和引号
      ['space-before-blocks', 'space-in-parens', 'space-infix-ops', 'space-unary-ops', 'spaced-comment'], // 空格
      ['no-useless-rename'] // 命名
    ];

    for (const group of autoFixGroups) {
      const rules = group.filter(rule => majorRules.includes(rule));
      if (rules.length > 0) {
        fixRules(rules, { autoFix: true, continueOnError: true });
        this.currentStats = getProjectStats();
        console.log('Current stats after fixing:', rules.join(', '));
        printStats(this.currentStats);
      }
    }

    // TypeScript特定规则需要特殊处理
    const tsRules = majorRules.filter(rule => rule.startsWith('@typescript-eslint/'));
    if (tsRules.length > 0) {
      console.log('📝 TypeScript-specific rules require manual review:');
      tsRules.forEach(rule => console.log(`  - ${rule}`));
    }
  }

  async fixMinorIssues() {
    console.log('\n✨ === PHASE 4: Fixing MINOR Issues ===');
    const minorRules = getPriorityRules('MINOR');

    // 这些规则应该都可以自动修复
    fixRules(minorRules, { autoFix: true, continueOnError: true });

    this.currentStats = getProjectStats();
    printStats(this.currentStats);
  }

  generateAnyTypeReport() {
    try {
      console.log('📋 Generating any type usage report...');
      const result = runCommand('grep -r "any" --include="*.ts" --include="*.tsx" . | head -20', { silent: true });
      console.log('📝 Any type usage samples:');
      console.log(result);

      // 保存报告
      const reportPath = 'eslint-any-type-report.md';
      const report = `# ESLint Any Type Usage Report

Generated: ${new Date().toISOString()}

## Summary
This report shows files that use \`any\` type and need manual refactoring.

## Files with any type usage
\`\`\`
${result}
\`\`\`

## Recommendations
1. Replace \`any\` with specific types where possible
2. Use \`unknown\` instead of \`any\` for safer typing
3. Consider interface definitions for complex objects
4. Use generics for reusable components

## Migration Strategy
1. Start with utility functions (lowest risk)
2. Move to service layer
3. Update component props last
4. Test thoroughly after each change
`;

      fs.writeFileSync(reportPath, report);
      console.log(`📄 Report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️ Could not generate any type report: ${error.message}`);
    }
  }

  async handleComplexityIssues() {
    console.log('\n📈 === PHASE 5: Handling Complexity Issues ===');

    console.log('📝 Complexity issues require manual refactoring:');
    CONFIG.COMPLEXITY_RULES.forEach(rule => {
      console.log(`  - ${rule}: Reduce complexity by extracting functions/methods`);
    });

    // 生成复杂度报告
    this.generateComplexityReport();
  }

  generateComplexityReport() {
    try {
      console.log('📋 Generating complexity report...');

      const backendComplexity = runCommand('cd backend && npx eslint --rule "complexity" --format=compact . | head -10', { silent: true });
      const frontendComplexity = runCommand('cd frontend && npx eslint --rule "complexity" --format=compact . | head -10', { silent: true });

      const report = `# ESLint Complexity Report

Generated: ${new Date().toISOString()}

## Backend Complexity Issues
\`\`\`
${backendComplexity}
\`\`\`

## Frontend Complexity Issues
\`\`\`
${frontendComplexity}
\`\`\`

## Recommendations
1. Extract complex logic into separate functions
2. Use early returns to reduce nesting
3. Break down large functions into smaller ones
4. Consider design patterns for complex logic

## Refactoring Strategy
1. Start with the most complex functions
2. Create unit tests before refactoring
3. Refactor in small, testable steps
4. Verify functionality after each change
`;

      fs.writeFileSync('eslint-complexity-report.md', report);
      console.log('📄 Complexity report saved to: eslint-complexity-report.md');
    } catch (error) {
      console.log(`⚠️ Could not generate complexity report: ${error.message}`);
    }
  }

  async generateFinalReport() {
    console.log('\n📊 === FINAL REPORT ===');

    if (!this.initialStats || !this.currentStats) {
      console.log('❌ Could not generate comparison report');
      return;
    }

    const errorImprovement = this.initialStats.total.errors - this.currentStats.total.errors;
    const warningImprovement = this.initialStats.total.warnings - this.currentStats.total.warnings;

    console.log('\n📈 Improvement Summary:');
    console.log(`┌─────────────────────────────────────────────────┐`);
    console.log(`│ Metric          │ Before │ After  │ Change   │`);
    console.log(`├─────────────────────────────────────────────────┤`);
    console.log(`│ Errors          │   ${this.initialStats.total.errors.toString().padStart(6)} │ ${this.currentStats.total.errors.toString().padStart(6)} │ ${errorImprovement > 0 ? '+' : ''}${errorImprovement.toString().padStart(7)} │`);
    console.log(`│ Warnings        │   ${this.initialStats.total.warnings.toString().padStart(6)} │ ${this.currentStats.total.warnings.toString().padStart(6)} │ ${warningImprovement > 0 ? '+' : ''}${warningImprovement.toString().padStart(7)} │`);
    console.log(`└─────────────────────────────────────────────────┘`);

    const report = `# ESLint Fix Strategy Report

Generated: ${new Date().toISOString()}

## Executive Summary
- Initial Issues: ${this.initialStats.total.errors} errors, ${this.initialStats.total.warnings} warnings
- Final Issues: ${this.currentStats.total.errors} errors, ${this.currentStats.total.warnings} warnings
- Error Improvement: ${errorImprovement > 0 ? '+' : ''}${errorImprovement}
- Warning Improvement: ${warningImprovement > 0 ? '+' : ''}${warningImprovement}

## Phases Completed
1. ✅ BLOCKER Issues - Fixed critical errors blocking development
2. ✅ CRITICAL Issues - Addressed type safety concerns
3. ✅ MAJOR Issues - Improved code quality
4. ✅ MINOR Issues - Auto-fixed style issues
5. 📝 Complexity Issues - Generated manual refactoring reports

## Remaining Work
- Manual review of any type usage (see eslint-any-type-report.md)
- Manual refactoring of complex functions (see eslint-complexity-report.md)
- Consider enabling stricter TypeScript rules gradually

## Next Steps
1. Review and fix remaining any type usage
2. Refactor complex functions to reduce complexity
3. Enable stricter ESLint rules progressively
4. Set up pre-commit hooks to maintain code quality
`;

    fs.writeFileSync('eslint-fix-strategy-report.md', report);
    console.log('📄 Final report saved to: eslint-fix-strategy-report.md');
  }

  async run() {
    try {
      await this.initialize();
      await this.fixBlockerIssues();
      await this.fixCriticalIssues();
      await this.fixMajorIssues();
      await this.fixMinorIssues();
      await this.handleComplexityIssues();
      await this.generateFinalReport();

      console.log('\n🎉 ESLint Fix Strategy completed successfully!');
    } catch (error) {
      console.error('\n❌ ESLint Fix Strategy failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const strategy = new ESLintFixStrategy();

  switch (command) {
    case 'init':
      await strategy.initialize();
      break;

    case 'blocker':
      await strategy.initialize();
      await strategy.fixBlockerIssues();
      break;

    case 'critical':
      await strategy.initialize();
      await strategy.fixCriticalIssues();
      break;

    case 'major':
      await strategy.initialize();
      await strategy.fixMajorIssues();
      break;

    case 'minor':
      await strategy.initialize();
      await strategy.fixMinorIssues();
      break;

    case 'complexity':
      await strategy.generateComplexityReport();
      break;

    case 'any-report':
      strategy.generateAnyTypeReport();
      break;

    case 'stats':
      const stats = getProjectStats();
      printStats(stats);
      break;

    case 'full':
    default:
      await strategy.run();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ESLintFixStrategy, CONFIG };