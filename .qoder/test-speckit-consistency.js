#!/usr/bin/env node

/**
 * Speckit文档一致性测试
 * 验证Speckit文档是否符合规范
 */

const { spawn } = require('child_process');

// 运行npm脚本并返回Promise
function runNpmScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 运行 ${script}...`);

    const child = spawn('npm', ['run', script], {
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        console.log(`✅ ${script} 通过`);
        resolve({ code, stdout, stderr });
      } else {
        console.log(`❌ ${script} 失败 (退出码: ${code})`);
        reject({ code, stdout, stderr });
      }
    });

    child.on('error', error => {
      console.log(`❌ ${script} 执行出错: ${error.message}`);
      reject({ error, stdout, stderr });
    });
  });
}

// 主函数
async function main() {
  console.log('🚀 Speckit文档一致性测试启动...\n');

  const scripts = [
    'validate:docs:consistency',
    'validate:docs:coverage',
    'validate:docs:references',
    'validate:docs:ambiguity',
  ];

  const results = [];

  for (const script of scripts) {
    try {
      const result = await runNpmScript(script);
      results.push({ script, success: true, result });
    } catch (error) {
      results.push({ script, success: false, error });
    }
  }

  // 汇总结果
  console.log('\n📊 测试结果汇总:');
  console.log(`总共测试: ${scripts.length} 项`);
  console.log(`通过: ${results.filter(r => r.success).length} 项`);
  console.log(`失败: ${results.filter(r => !r.success).length} 项`);

  results.forEach(({ script, success }) => {
    console.log(`  ${success ? '✅' : '❌'} ${script}`);
  });

  const allPassed = results.every(r => r.success);

  if (allPassed) {
    console.log('\n🎉 所有Speckit文档一致性测试通过！');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分Speckit文档一致性测试失败，请检查上述输出。');
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('❌ 测试执行出错:', error);
  process.exit(1);
});
