#!/usr/bin/env node

/**
 * ESLint代码质量规则定义和管理
 *
 * 定义了分级的质量规则体系：
 * - BLOCKER: 阻塞开发，必须立即修复
 * - CRITICAL: 关键类型安全，需要尽快修复
 * - MAJOR: 代码质量，需要计划修复
 * - MINOR: 代码风格，可自动修复
 */

const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs');

// 质量规则等级定义
const QUALITY_LEVELS = {
  BLOCKER: {
    priority: 1,
    color: '\x1b[41m', // 红色背景
    emoji: '🚨',
    description: '阻塞开发，必须立即修复',
    maxFixTime: 0, // 立即修复
  },
  CRITICAL: {
    priority: 2,
    color: '\x1b[31m', // 红色文字
    emoji: '⚠️',
    description: '关键类型安全，需要尽快修复',
    maxFixTime: 24 * 60 * 60 * 1000, // 24小时
  },
  MAJOR: {
    priority: 3,
    color: '\x1b[33m', // 黄色文字
    emoji: '⚡',
    description: '代码质量，需要计划修复',
    maxFixTime: 7 * 24 * 60 * 60 * 1000, // 7天
  },
  MINOR: {
    priority: 4,
    color: '\x1b[36m', // 青色文字
    emoji: '✨',
    description: '代码风格，可自动修复',
    maxFixTime: 30 * 24 * 60 * 60 * 1000, // 30天
  },
};

// 规则分类映射
const RULE_CATEGORIES = {
  // BLOCKER 级别规则
  BLOCKER: [
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
    'no-unused-expressions',
    '@typescript-eslint/no-unused-vars',
    '@typescript-eslint/no-non-null-assertion',
    'react/jsx-no-duplicate-props',
    'react/jsx-no-undef',
    'react/jsx-key',
    'react/no-children-prop',
    'react/no-danger-with-children',
    'react/no-deprecated',
    'react/no-direct-mutation-state',
    'react/no-find-dom-node',
    'react/no-is-mounted',
    'react/no-render-return-value',
    'react/no-string-refs',
    'react/no-unescaped-entities',
    'react/no-unknown-property',
    'react/require-render-return',
    'react/self-closing-comp',
    'react-hooks/rules-of-hooks',
    'import/no-self-import',
    'import/no-cycle',
    '@typescript-eslint/ban-ts-comment',
  ],

  // CRITICAL 级别规则
  CRITICAL: [
    '@typescript-eslint/no-explicit-any',
    '@typescript-eslint/no-unsafe-assignment',
    '@typescript-eslint/no-unsafe-member-access',
    '@typescript-eslint/no-unsafe-call',
    '@typescript-eslint/no-unsafe-return',
    '@typescript-eslint/no-unsafe-argument',
    '@typescript-eslint/prefer-nullish-coalescing',
    '@typescript-eslint/prefer-optional-chain',
    '@typescript-eslint/no-unnecessary-type-assertion',
    '@typescript-eslint/no-floating-promises',
    '@typescript-eslint/require-await',
    '@typescript-eslint/return-await',
    'react-hooks/exhaustive-deps',
    'import/named',
    'import/default',
    'import/no-absolute-path',
    'import/no-dynamic-require',
    'import/no-useless-path-segments',
    'import/no-relative-packages',
  ],

  // MAJOR 级别规则
  MAJOR: [
    'prefer-const',
    'no-var',
    'no-empty',
    'no-extra-boolean-cast',
    'eqeqeq',
    'curly',
    'brace-style',
    'complexity',
    'max-depth',
    'max-params',
    'max-nested-callbacks',
    'react/display-name',
    'react/jsx-pascal-case',
    'react/jsx-boolean-value',
    'react/no-array-index-key',
    'react/no-redundant-should-component-update',
    'react/forbid-prop-types',
    'react/no-typos',
    '@typescript-eslint/await-thenable',
    '@typescript-eslint/no-misused-promises',
    'react/jsx-no-bind',
    'react/jsx-fragments',
  ],

  // MINOR 级别规则
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
    'no-useless-rename',
    'prettier/prettier',
    'max-len',
    'no-magic-numbers',
    'no-console',
  ],
};

// 规则严重性级别映射
const RULE_SEVERITY = {
  'error': 'BLOCKER',
  'warn': 'MAJOR',
  'off': 'IGNORED',
};

// 自定义规则级别配置
const CUSTOM_RULE_LEVELS = {
  // 将某些warn规则提升到CRITICAL级别
  CRITICAL: [
    '@typescript-eslint/no-explicit-any',
    '@typescript-eslint/no-floating-promises',
    '@typescript-eslint/prefer-nullish-coalescing',
    '@typescript-eslint/prefer-optional-chain',
    'react-hooks/exhaustive-deps',
  ],

  // 将某些error规则降级到MAJOR级别
  MAJOR: [
    'complexity',
    'max-depth',
    'max-params',
    'max-nested-callbacks',
    'react/display-name',
    'no-console',
  ],

  // 将某些error规则降级到MINOR级别
  MINOR: [
    'max-len',
    'no-magic-numbers',
    'comma-dangle',
    'semi',
    'quotes',
  ],
};

/**
 * 获取规则的等级
 * @param {string} ruleId 规则ID
 * @param {string} severity 严重性 ('error', 'warn', 'off')
 * @returns {string} 规则等级
 */
function getRuleLevel(ruleId, severity) {
  // 如果规则被关闭，返回IGNORED
  if (severity === 'off') return 'IGNORED';

  // 检查自定义配置
  for (const [level, rules] of Object.entries(CUSTOM_RULE_LEVELS)) {
    if (rules.includes(ruleId)) {
      return level;
    }
  }

  // 检查基础分类
  for (const [level, rules] of Object.entries(RULE_CATEGORIES)) {
    if (rules.includes(ruleId)) {
      return level;
    }
  }

  // 默认基于严重性
  return RULE_SEVERITY[severity] || 'MAJOR';
}

/**
 * 格式化输出
 * @param {string} level 规则等级
 * @param {string} message 消息
 * @returns {string} 格式化后的消息
 */
function formatMessage(level, message) {
  const levelConfig = QUALITY_LEVELS[level];
  if (!levelConfig) return message;

  return `${levelConfig.color}${levelConfig.emoji} [${level}] ${message}\x1b[0m`;
}

/**
 * 分析ESLint结果并按等级分类
 * @param {Array} results ESLint结果数组
 * @returns {Object} 按等级分类的问题
 */
function analyzeResults(results) {
  const issues = {
    BLOCKER: [],
    CRITICAL: [],
    MAJOR: [],
    MINOR: [],
    IGNORED: [],
    summary: {
      total: 0,
      blocker: 0,
      critical: 0,
      major: 0,
      minor: 0,
      files: results.length,
    },
  };

  for (const result of results) {
    if (!result.messages) continue;

    for (const message of result.messages) {
      const level = getRuleLevel(message.ruleId, message.severity);

      const issue = {
        file: result.filePath,
        line: message.line,
        column: message.column,
        ruleId: message.ruleId,
        message: message.message,
        level: level,
        severity: message.severity,
      };

      issues[level].push(issue);
      issues.summary.total++;
      issues.summary[level.toLowerCase()]++;
    }
  }

  return issues;
}

/**
 * 生成质量报告
 * @param {Object} issues 分析结果
 * @returns {Object} 质量报告
 */
function generateQualityReport(issues) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: issues.summary,
    quality: {
      score: calculateQualityScore(issues),
      grade: calculateQualityGrade(issues),
      status: getQualityStatus(issues),
    },
    recommendations: generateRecommendations(issues),
    breakdown: generateBreakdown(issues),
  };

  return report;
}

/**
 * 计算质量分数 (0-100)
 * @param {Object} issues 问题分析结果
 * @returns {number} 质量分数
 */
function calculateQualityScore(issues) {
  const total = issues.summary.total;
  if (total === 0) return 100;

  // 权重配置
  const weights = {
    BLOCKER: 20,
    CRITICAL: 10,
    MAJOR: 3,
    MINOR: 1,
  };

  let penalty = 0;
  for (const [level, count] of Object.entries(issues.summary)) {
    if (level === 'total' || level === 'files') continue;
    penalty += (count * (weights[level] || 1));
  }

  // 分数计算：100 - (总罚分 / 文件数)
  const score = Math.max(0, 100 - (penalty / Math.max(1, issues.summary.files)));
  return Math.round(score * 100) / 100;
}

/**
 * 计算质量等级
 * @param {Object} issues 问题分析结果
 * @returns {string} 质量等级 (A, B, C, D, F)
 */
function calculateQualityGrade(issues) {
  const score = calculateQualityScore(issues);

  if (score >= 95) return 'A';
  if (score >= 85) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * 获取质量状态
 * @param {Object} issues 问题分析结果
 * @returns {string} 质量状态
 */
function getQualityStatus(issues) {
  if (issues.summary.blocker > 0) return 'BLOCKED';
  if (issues.summary.critical > 0) return 'CRITICAL';
  if (issues.summary.major > 0) return 'NEEDS_ATTENTION';
  if (issues.summary.minor > 0) return 'GOOD';
  return 'EXCELLENT';
}

/**
 * 生成修复建议
 * @param {Object} issues 问题分析结果
 * @returns {Array} 修复建议列表
 */
function generateRecommendations(issues) {
  const recommendations = [];

  if (issues.summary.blocker > 0) {
    recommendations.push({
      priority: 1,
      level: 'BLOCKER',
      message: `发现 ${issues.summary.blocker} 个阻塞问题，必须立即修复`,
      action: '立即修复所有阻塞问题',
      commands: ['pnpm run lint:fix'],
    });
  }

  if (issues.summary.critical > 0) {
    recommendations.push({
      priority: 2,
      level: 'CRITICAL',
      message: `发现 ${issues.summary.critical} 个关键问题，影响类型安全`,
      action: '优先修复类型安全问题',
      commands: ['pnpm run type-check', 'pnpm run lint:fix'],
    });
  }

  if (issues.summary.major > 0) {
    recommendations.push({
      priority: 3,
      level: 'MAJOR',
      message: `发现 ${issues.summary.major} 个重要问题，影响代码质量`,
      action: '计划修复代码质量问题',
      commands: ['pnpm run lint:fix'],
    });
  }

  if (issues.summary.minor > 0) {
    recommendations.push({
      priority: 4,
      level: 'MINOR',
      message: `发现 ${issues.summary.minor} 个代码风格问题`,
      action: '自动修复代码风格',
      commands: ['pnpm run format:code'],
    });
  }

  return recommendations;
}

/**
 * 生成详细分解
 * @param {Object} issues 问题分析结果
 * @returns {Object} 详细分解
 */
function generateBreakdown(issues) {
  const breakdown = {};

  for (const [level, issueList] of Object.entries(issues)) {
    if (level === 'summary' || level === 'IGNORED') continue;

    breakdown[level] = {
      count: issueList.length,
      rules: {},
      files: {},
    };

    for (const issue of issueList) {
      // 按规则分组
      if (!breakdown[level].rules[issue.ruleId]) {
        breakdown[level].rules[issue.ruleId] = [];
      }
      breakdown[level].rules[issue.ruleId].push(issue);

      // 按文件分组
      if (!breakdown[level].files[issue.file]) {
        breakdown[level].files[issue.file] = [];
      }
      breakdown[level].files[issue.file].push(issue);
    }
  }

  return breakdown;
}

/**
 * 打印质量报告
 * @param {Object} report 质量报告
 */
function printQualityReport(report) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 ESLint 代码质量报告');
  console.log('='.repeat(80));

  console.log(`📅 生成时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);
  console.log(`📁 检查文件: ${report.summary.files}`);
  console.log(`🔍 总问题数: ${report.summary.total}`);

  console.log('\n📈 质量指标:');
  console.log(`   分数: ${report.quality.score}/100`);
  console.log(`   等级: ${report.quality.grade}`);
  console.log(`   状态: ${report.quality.status}`);

  console.log('\n📋 问题分布:');
  console.log(`   🚨 阻塞: ${report.summary.blocker}`);
  console.log(`   ⚠️  关键: ${report.summary.critical}`);
  console.log(`   ⚡ 重要: ${report.summary.major}`);
  console.log(`   ✨ 风格: ${report.summary.minor}`);

  if (report.recommendations.length > 0) {
    console.log('\n💡 修复建议:');
    for (const rec of report.recommendations) {
      console.log(`\n${formatMessage(rec.level, rec.message)}`);
      console.log(`   行动: ${rec.action}`);
      console.log(`   命令: ${rec.commands.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

module.exports = {
  QUALITY_LEVELS,
  RULE_CATEGORIES,
  CUSTOM_RULE_LEVELS,
  getRuleLevel,
  formatMessage,
  analyzeResults,
  generateQualityReport,
  printQualityReport,
};

// 如果直接运行此脚本
if (require.main === module) {
  // 这里可以添加命令行工具逻辑
  console.log('ESLint质量规则定义模块');
  console.log('使用方法: require("./eslint-quality-rules.js")');
}