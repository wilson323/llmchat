/**
 * 运行多组性能测试，使用不同的渲染耗时
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试不同的渲染耗时场景
const renderTimes = [
  { ms: 3, scenario: '保守估计（轻量组件）' },
  { ms: 5, scenario: '中等复杂度（标准组件）' },
  { ms: 8, scenario: '复杂组件（含图片/代码高亮）' },
  { ms: 10, scenario: '重型组件（大型列表）' },
];

console.log('🚀 开始批量性能测试\n');
console.log('测试场景:');
renderTimes.forEach(({ ms, scenario }) => {
  console.log(`  - ${ms}ms: ${scenario}`);
});
console.log('\n========================================\n');

const results = [];

for (const { ms, scenario } of renderTimes) {
  console.log(`\n🔄 测试场景: ${scenario} (${ms}ms/次渲染)`);
  console.log('--------------------\n');
  
  // 修改脚本中的RENDER_TIME_MS
  const scriptPath = path.join(__dirname, 'performance-test-with-render.js');
  let script = fs.readFileSync(scriptPath, 'utf-8');
  
  // 替换 RENDER_TIME_MS 的值
  script = script.replace(
    /const RENDER_TIME_MS = \d+;/,
    `const RENDER_TIME_MS = ${ms};`
  );
  
  // 写回临时文件
  const tempPath = path.join(__dirname, 'temp-perf-test.js');
  fs.writeFileSync(tempPath, script);
  
  try {
    // 运行测试
    const output = execSync(`node "${tempPath}"`, { encoding: 'utf-8' });
    console.log(output);
    
    // 解析结果
    const durationMatch = output.match(/总耗时减少: ([-\d.]+)%/);
    const renderMatch = output.match(/渲染次数减少: ([-\d.]+)%/);
    
    if (durationMatch && renderMatch) {
      results.push({
        scenario,
        renderTime: ms,
        durationImprovement: parseFloat(durationMatch[1]),
        renderReduction: parseFloat(renderMatch[1]),
      });
    }
  } catch (error) {
    console.error(`测试失败: ${error.message}`);
  }
  
  // 清理临时文件
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
}

// 生成总结报告
console.log('\n========================================');
console.log('📊 批量测试总结');
console.log('========================================\n');

console.log('| 渲染耗时 | 场景 | 总耗时提升 | 渲染次数减少 |');
console.log('|---------|------|-----------|------------|');

results.forEach(({ renderTime, scenario, durationImprovement, renderReduction }) => {
  const durationStr = durationImprovement >= 0 
    ? `+${durationImprovement.toFixed(1)}%` 
    : `${durationImprovement.toFixed(1)}%`;
  console.log(`| ${renderTime}ms | ${scenario} | ${durationStr} | ${renderReduction.toFixed(1)}% |`);
});

console.log('\n🎯 关键发现:\n');

// 找出最佳场景
const bestResult = results.reduce((best, current) => 
  current.durationImprovement > best.durationImprovement ? current : best
);

if (bestResult.durationImprovement >= 50) {
  console.log(`✅ 在 "${bestResult.scenario}" 场景下，性能提升最显著（${bestResult.durationImprovement.toFixed(1)}%）`);
  console.log('✅ 强烈建议全面迁移到优化版Store\n');
} else if (bestResult.durationImprovement >= 30) {
  console.log(`⚠️ 在 "${bestResult.scenario}" 场景下，性能有明显提升（${bestResult.durationImprovement.toFixed(1)}%）`);
  console.log('⚠️ 建议全面迁移，但可能需要结合其他优化\n');
} else {
  console.log(`ℹ️ 性能提升有限（最好${bestResult.durationImprovement.toFixed(1)}%）`);
  console.log('ℹ️ 建议在真实浏览器环境中进一步验证\n');
}

console.log('💡 说明:');
console.log('  - 真实React应用中，渲染耗时通常在5-10ms/次');
console.log('  - 复杂组件（代码高亮、图片、列表）可能达到10-20ms/次');
console.log('  - 优化的核心价值在于减少渲染次数，而非减少每次渲染耗时');
console.log('  - 建议使用 React DevTools Profiler 测量真实环境性能\n');

console.log('========================================\n');

