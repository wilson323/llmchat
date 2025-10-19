#!/usr/bin/env node

/**
 * 快速性能测试脚本
 * 用于日常开发中的快速性能检查
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 快速性能测试开始...\n');

const projectRoot = path.join(__dirname, '..');
const results = {};

async function quickTest(name, command) {
  console.log(`🧪 ${name}...`);
  
  try {
    const startTime = Date.now();
    execSync(command, { 
      cwd: projectRoot, 
      stdio: 'pipe',
      timeout: 60000 
    });
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    results[name] = { success: true, duration };
    console.log(`  ✅ ${duration}ms\n`);
    
    return duration;
  } catch (error) {
    results[name] = { success: false, error: error.message };
    console.log(`  ❌ 失败\n`);
    return -1;
  }
}

async function runQuickTests() {
  // 运行快速测试
  await quickTest('TypeScript 类型检查', 'pnpm run type-check');
  await quickTest('ESLint 检查', 'pnpm run lint');
  
  // 检查构建产物大小
  console.log('📦 检查构建产物...');
  try {
    const fs = require('fs');
    const distPath = path.join(projectRoot, 'dist');
    
    if (fs.existsSync(distPath)) {
      const stats = fs.statSync(distPath);
      console.log(`  ✅ 构建产物存在\n`);
      results['构建产物'] = { success: true, exists: true };
    } else {
      console.log(`  ⚠️  构建产物不存在，需要运行构建\n`);
      results['构建产物'] = { success: false, exists: false };
    }
  } catch (error) {
    console.log(`  ❌ 检查失败\n`);
    results['构建产物'] = { success: false, error: error.message };
  }
  
  // 输出结果摘要
  console.log('📊 测试结果摘要:');
  console.log('==================');
  
  let successCount = 0;
  let totalTests = 0;
  
  Object.entries(results).forEach(([name, result]) => {
    totalTests++;
    if (result.success) {
      successCount++;
      const icon = name.includes('构建产物') ? '📦' : '✅';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${icon} ${name}: 通过${duration}`);
    } else {
      console.log(`❌ ${name}: 失败`);
    }
  });
  
  const successRate = (successCount / totalTests * 100).toFixed(1);
  console.log(`\n🎯 成功率: ${successRate}% (${successCount}/${totalTests})`);
  
  // 快速建议
  console.log('\n💡 快速建议:');
  
  if (!results['TypeScript 类型检查']?.success) {
    console.log('  🔧 修复 TypeScript 类型错误');
  }
  
  if (!results['ESLint 检查']?.success) {
    console.log('  🔧 修复 ESLint 错误');
  }
  
  if (!results['构建产物']?.exists) {
    console.log('  🔧 运行 pnpm run build 生成构建产物');
  }
  
  const typeCheckTime = results['TypeScript 类型检查']?.duration;
  if (typeCheckTime && typeCheckTime > 20000) {
    console.log('  ⚠️  类型检查时间较长，考虑优化 tsconfig 配置');
  }
  
  const lintTime = results['ESLint 检查']?.duration;
  if (lintTime && lintTime > 15000) {
    console.log('  ⚠️  ESLint 检查时间较长，考虑优化规则配置');
  }
  
  console.log('\n✨ 快速性能测试完成!');
  
  // 返回性能等级
  return successRate === '100.0' ? 'A' : 
         successRate >= '80.0' ? 'B' : 
         successRate >= '60.0' ? 'C' : 'D';
}

// 如果直接运行此脚本
if (require.main === module) {
  runQuickTests()
    .then(grade => {
      console.log(`\n🎯 性能等级: ${grade}`);
      process.exit(grade === 'A' ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 快速测试失败:', error);
      process.exit(1);
    });
}

module.exports = { runQuickTests };
