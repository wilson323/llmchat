#!/usr/bin/env node
/**
 * 质量监控仪表板脚本
 * 生成代码质量报告和趋势分析
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════╗');
console.log('║      📊 代码质量监控仪表板      ║');
console.log('╚════════════════════════════════════════════════════╝\n');

// 执行命令并返回结果
function execCommand(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options });
  } catch (error) {
    return error.stdout || '';
  }
}

// 1. ESLint检查
console.log('🔍 正在运行ESLint检查...');
const eslintOutput = execCommand('cd backend && npx eslint src --format json');

let eslintStats = {
  errors: 0,
  warnings: 0,
  files: 0
};

try {
  const eslintResults = JSON.parse(eslintOutput);
  eslintResults.forEach(result => {
    if (result.messages.length > 0) {
      eslintStats.files++;
    }
    result.messages.forEach(msg => {
      if (msg.severity === 2) eslintStats.errors++;
      else if (msg.severity === 1) eslintStats.warnings++;
    });
  });
} catch (e) {
  console.log('   ⚠️  无法解析ESLint输出');
}

console.log(`   • 错误: ${eslintStats.errors}`);
console.log(`   • 警告: ${eslintStats.warnings}`);
console.log(`   • 问题文件: ${eslintStats.files}`);

// 2. TypeScript类型检查
console.log('\n🔍 正在运行TypeScript类型检查...');
const tscOutput = execCommand('cd backend && npx tsc --noEmit');
const tsErrors = (tscOutput.match(/error TS\d+:/g) || []).length;
console.log(`   • 类型错误: ${tsErrors}`);

// 3. 测试统计
console.log('\n🧪 测试统计...');
const testOutput = execCommand('cd backend && npm test -- --passWithNoTests 2>&1');
const testMatch = testOutput.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
let testStats = { failed: 0, passed: 0, total: 0 };
if (testMatch) {
  testStats = {
    failed: parseInt(testMatch[1]),
    passed: parseInt(testMatch[2]),
    total: parseInt(testMatch[3])
  };
}
const testPassRate = testStats.total > 0 ? ((testStats.passed / testStats.total) * 100).toFixed(1) : 0;
console.log(`   • 通过: ${testStats.passed}/${testStats.total}`);
console.log(`   • 通过率: ${testPassRate}%`);

// 4. 生成质量报告
const report = {
  timestamp: new Date().toISOString(),
  eslint: eslintStats,
  typescript: { errors: tsErrors },
  tests: { ...testStats, passRate: parseFloat(testPassRate) },
  quality: {
    score: calculateQualityScore(eslintStats, tsErrors, testPassRate),
    grade: calculateGrade(eslintStats, tsErrors, testPassRate)
  }
};

// 计算质量分数 (0-100)
function calculateQualityScore(eslint, tsErrors, testPassRate) {
  let score = 100;
  score -= eslint.errors * 2;
  score -= eslint.warnings * 0.5;
  score -= tsErrors * 2;
  score -= (100 - parseFloat(testPassRate)) * 0.5;
  return Math.max(0, score).toFixed(1);
}

// 计算质量等级
function calculateGrade(eslint, tsErrors, testPassRate) {
  const score = parseFloat(calculateQualityScore(eslint, tsErrors, testPassRate));
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  return 'D';
}

// 保存报告
const reportsDir = path.join(__dirname, '..', 'quality-reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const reportFile = path.join(reportsDir, `quality-report-${Date.now()}.json`);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

// 更新最新报告
const latestFile = path.join(reportsDir, 'latest.json');
fs.writeFileSync(latestFile, JSON.stringify(report, null, 2));

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║      📈 质量评分卡      ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log(`\n  🎯 总体质量分数: ${report.quality.score}/100`);
console.log(`  🏆 质量等级: ${report.quality.grade}`);

if (report.quality.score >= 95) {
  console.log('\n  🌟🌟🌟 卓越！代码质量达到顶尖水平！');
} else if (report.quality.score >= 90) {
  console.log('\n  🌟🌟 优秀！代码质量非常好！');
} else if (report.quality.score >= 80) {
  console.log('\n  🌟 良好！还有改进空间。');
} else {
  console.log('\n  ⚠️  需要改进代码质量。');
}

console.log(`\n  📄 详细报告: ${reportFile}`);
console.log('');

// 退出码基于质量分数
process.exit(report.quality.score < 80 ? 1 : 0);

