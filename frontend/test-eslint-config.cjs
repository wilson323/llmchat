#!/usr/bin/env node

/**
 * 简化的ESLint配置测试工具
 */

const { ESLint } = require('eslint');
const path = require('path');

async function testESLintConfig() {
  console.log('🔍 测试ESLint配置...');

  try {
    const eslint = new ESLint({
      overrideConfigFile: path.join(__dirname, 'eslint.config.js'),
      useEslintrc: false,
      fix: false,
    });

    // 测试单个文件
    const testFile = 'src/components/ui/Button.tsx';
    console.log(`📁 测试文件: ${testFile}`);

    const results = await eslint.lintFiles([testFile]);

    console.log(`✅ ESLint配置测试成功`);
    console.log(`📊 检查结果: ${results.length} 个文件`);

    if (results.length > 0) {
      const result = results[0];
      console.log(`   错误数: ${result.errorCount}`);
      console.log(`   警告数: ${result.warningCount}`);
      console.log(`   可修复: ${result.fixableErrorCount}`);

      if (result.messages.length > 0) {
        console.log('\n📋 发现的问题:');
        result.messages.forEach((msg, index) => {
          console.log(`   ${index + 1}. [${msg.severity === 2 ? 'ERROR' : 'WARN'}] ${msg.ruleId}: ${msg.message}`);
          console.log(`      位置: 第${msg.line}行, 第${msg.column}列`);
        });
      }
    }

    return results;

  } catch (error) {
    console.error('❌ ESLint配置测试失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testESLintConfig();
}

module.exports = { testESLintConfig };