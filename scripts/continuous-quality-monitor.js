#!/usr/bin/env node
/**
 * 持续质量监控脚本
 * 定期运行质量检查并生成趋势报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════╗');
console.log('║    📊 持续质量监控系统    ║');
console.log('╚════════════════════════════════════════════════════╝\n');

const reportsDir = path.join(__dirname, '..', 'quality-reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 执行命令
function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  } catch (error) {
    return error.stdout || '';
  }
}

// 1. ESLint检查
console.log('🔍 ESLint检查...');
const eslintJson = exec('cd backend && npx eslint src --format json');
let eslintStats = { errors: 0, warnings: 0, files: 0 };

try {
  const results = JSON.parse(eslintJson);
  results.forEach(file => {
    if (file.messages.length > 0) eslintStats.files++;
    file.messages.forEach(msg => {
      if (msg.severity === 2) eslintStats.errors++;
      else eslintStats.warnings++;
    });
  });
} catch (e) {}

console.log(`   错误: ${eslintStats.errors}`);
console.log(`   警告: ${eslintStats.warnings}`);

// 2. TypeScript检查
console.log('\n🔍 TypeScript检查...');
const tscOutput = exec('cd backend && npx tsc --noEmit');
const tsErrors = (tscOutput.match(/error TS\d+:/g) || []).length;
console.log(`   类型错误: ${tsErrors}`);

// 3. 测试统计
console.log('\n🧪 测试检查...');
const testOutput = exec('cd backend && npm test -- --passWithNoTests 2>&1');
const testMatch = testOutput.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
let testStats = { failed: 0, passed: 0, total: 0, passRate: 0 };
if (testMatch) {
  testStats = {
    failed: parseInt(testMatch[1]),
    passed: parseInt(testMatch[2]),
    total: parseInt(testMatch[3]),
    passRate: parseFloat(((parseInt(testMatch[2]) / parseInt(testMatch[3])) * 100).toFixed(1))
  };
}
console.log(`   通过率: ${testStats.passRate}%`);

// 4. 计算质量分数
const qualityScore = calculateQualityScore({
  eslint: eslintStats,
  typescript: tsErrors,
  tests: testStats
});

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║    📈 质量评分    ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log(`\n  总分: ${qualityScore.score}/100`);
console.log(`  等级: ${qualityScore.grade}`);
console.log(`  状态: ${getStatusEmoji(qualityScore.score)} ${getStatusText(qualityScore.score)}`);

// 5. 保存报告
const report = {
  timestamp: new Date().toISOString(),
  eslint: eslintStats,
  typescript: { errors: tsErrors },
  tests: testStats,
  quality: qualityScore
};

const reportFile = path.join(reportsDir, `monitor-${Date.now()}.json`);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(reportsDir, 'latest.json'), JSON.stringify(report, null, 2));

console.log(`\n📄 报告已保存: ${reportFile}\n`);

// 6. 趋势分析
analyzeTrends(reportsDir);

// 辅助函数
function calculateQualityScore({ eslint, typescript, tests }) {
  let score = 100;
  score -= eslint.errors * 2;
  score -= eslint.warnings * 0.5;
  score -= typescript * 2;
  if (tests.total > 0) {
    score -= (100 - tests.passRate) * 0.5;
  }
  score = Math.max(0, score);
  
  let grade = 'D';
  if (score >= 95) grade = 'A+';
  else if (score >= 90) grade = 'A';
  else if (score >= 85) grade = 'B+';
  else if (score >= 80) grade = 'B';
  else if (score >= 75) grade = 'C+';
  else if (score >= 70) grade = 'C';
  
  return { score: score.toFixed(1), grade };
}

function getStatusEmoji(score) {
  if (score >= 95) return '🌟';
  if (score >= 90) return '✅';
  if (score >= 80) return '⚠️';
  return '❌';
}

function getStatusText(score) {
  if (score >= 95) return '卓越';
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '及格';
  return '需要改进';
}

function analyzeTrends(dir) {
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('monitor-'))
    .sort()
    .slice(-7);
  
  if (files.length < 2) {
    console.log('📈 趋势分析: 数据不足\n');
    return;
  }
  
  const reports = files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
  
  if (reports.length < 2) return;
  
  const first = reports[0];
  const last = reports[reports.length - 1];
  
  const scoreDiff = parseFloat(last.quality.score) - parseFloat(first.quality.score);
  const eslintDiff = (last.eslint.errors + last.eslint.warnings) - (first.eslint.errors + first.eslint.warnings);
  const tsDiff = last.typescript.errors - first.typescript.errors;
  
  console.log('📈 质量趋势（最近7次）:');
  console.log(`   分数: ${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)}`);
  console.log(`   ESLint: ${eslintDiff >= 0 ? '+' : ''}${eslintDiff}`);
  console.log(`   TypeScript: ${tsDiff >= 0 ? '+' : ''}${tsDiff}`);
  console.log(`   趋势: ${scoreDiff > 0 ? '📈 改善' : scoreDiff < 0 ? '📉 下降' : '→ 稳定'}\n`);
}

process.exit(parseFloat(qualityScore.score) < 80 ? 1 : 0);

