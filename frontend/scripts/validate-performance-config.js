#!/usr/bin/env node

/**
 * TypeScript性能配置验证脚本
 * 验证所有性能配置是否正确设置并可用
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PerformanceConfigValidator {
  constructor() {
    this.configs = [
      'tsconfig.json',
      'tsconfig.dev.json',
      'tsconfig.performance.json',
      'tsconfig.fast.json'
    ];

    this.scripts = [
      'type-check',
      'type-check:dev',
      'type-check:perf',
      'type-check:fast',
      'perf:monitor',
      'perf:monitor:perf'
    ];

    this.results = {
      configs: {},
      scripts: {},
      files: {},
      overall: false
    };
  }

  // 验证配置文件存在性
  validateConfigFiles() {
    console.log('🔍 验证TypeScript配置文件...');

    for (const config of this.configs) {
      const configPath = path.resolve(__dirname, '..', config);
      const exists = fs.existsSync(configPath);

      this.results.configs[config] = {
        exists,
        path: configPath,
        valid: false
      };

      if (exists) {
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const parsed = JSON.parse(content);
          this.results.configs[config].valid = true;
          this.results.configs[config].content = parsed;
          console.log(`  ✅ ${config} - 有效`);
        } catch (error) {
          console.log(`  ❌ ${config} - 无效: ${error.message}`);
        }
      } else {
        console.log(`  ❌ ${config} - 文件不存在`);
      }
    }
  }

  // 验证package.json脚本
  validatePackageScripts() {
    console.log('\n🔍 验证package.json脚本...');

    try {
      const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      for (const script of this.scripts) {
        const exists = !!packageJson.scripts[script];
        const command = packageJson.scripts[script];

        this.results.scripts[script] = {
          exists,
          command
        };

        if (exists) {
          console.log(`  ✅ ${script} - ${command}`);
        } else {
          console.log(`  ❌ ${script} - 脚本不存在`);
        }
      }
    } catch (error) {
      console.error('  ❌ 无法读取package.json:', error.message);
    }
  }

  // 验证脚本文件存在性
  validateScriptFiles() {
    console.log('\n🔍 验证性能脚本文件...');

    const scripts = [
      'scripts/performance-compiler-monitor.js',
      'scripts/memory-optimizer.js',
      'scripts/quick-perf-test.js'
    ];

    for (const script of scripts) {
      const scriptPath = path.resolve(__dirname, '..', script);
      const exists = fs.existsSync(scriptPath);

      this.results.files[script] = {
        exists,
        path: scriptPath
      };

      if (exists) {
        console.log(`  ✅ ${script} - 存在`);
      } else {
        console.log(`  ❌ ${script} - 不存在`);
      }
    }
  }

  // 验证TypeScript配置语法
  validateTypeScriptSyntax() {
    console.log('\n🔍 验证TypeScript配置语法...');

    for (const config of this.configs) {
      if (this.results.configs[config]?.exists) {
        try {
          execSync(`npx tsc --noEmit --project ${config}`, {
            stdio: 'pipe',
            timeout: 10000
          });
          console.log(`  ✅ ${config} - TypeScript配置语法正确`);
          this.results.configs[config].syntaxValid = true;
        } catch (error) {
          console.log(`  ❌ ${config} - TypeScript配置语法错误: ${error.message}`);
          this.results.configs[config].syntaxValid = false;
        }
      }
    }
  }

  // 验证Vite配置
  validateViteConfig() {
    console.log('\n🔍 验证Vite配置...');

    try {
      const viteConfigPath = path.resolve(__dirname, '..', 'vite.performance.config.ts');
      const exists = fs.existsSync(viteConfigPath);

      if (exists) {
        console.log('  ✅ vite.performance.config.ts - 存在');
        this.results.files['vite.performance.config.ts'] = { exists, path: viteConfigPath };
      } else {
        console.log('  ❌ vite.performance.config.ts - 不存在');
        this.results.files['vite.performance.config.ts'] = { exists: false };
      }
    } catch (error) {
      console.error('  ❌ 验证Vite配置失败:', error.message);
    }
  }

  // 运行快速性能测试
  runQuickPerformanceTest() {
    console.log('\n🔍 运行快速性能测试...');

    try {
      const start = Date.now();
      execSync('npx tsc --noEmit --project tsconfig.fast.json', {
        stdio: 'pipe',
        timeout: 30000
      });
      const duration = Date.now() - start;

      console.log(`  ✅ 快速配置编译时间: ${duration}ms`);
      this.results.performanceTest = {
        fastConfig: duration,
        passed: duration < 5000 // 5秒内通过
      };

      if (duration > 5000) {
        console.log('  ⚠️  编译时间较长，建议进一步优化');
      }
    } catch (error) {
      console.log(`  ❌ 快速配置测试失败: ${error.message}`);
      this.results.performanceTest = {
        fastConfig: -1,
        passed: false,
        error: error.message
      };
    }
  }

  // 生成验证报告
  generateReport() {
    console.log('\n📊 验证报告');
    console.log('='.repeat(50));

    // 统计配置文件
    const validConfigs = Object.values(this.results.configs).filter(c => c.exists && c.valid).length;
    const totalConfigs = Object.keys(this.results.configs).length;
    console.log(`配置文件: ${validConfigs}/${totalConfigs} 有效`);

    // 统计脚本
    const validScripts = Object.values(this.results.scripts).filter(s => s.exists).length;
    const totalScripts = Object.keys(this.results.scripts).length;
    console.log(`脚本命令: ${validScripts}/${totalScripts} 存在`);

    // 统计文件
    const validFiles = Object.values(this.results.files).filter(f => f.exists).length;
    const totalFiles = Object.keys(this.results.files).length;
    console.log(`脚本文件: ${validFiles}/${totalFiles} 存在`);

    // 性能测试
    if (this.results.performanceTest?.passed) {
      console.log(`性能测试: ✅ 通过 (${this.results.performanceTest.fastConfig}ms)`);
    } else if (this.results.performanceTest?.fastConfig > 0) {
      console.log(`性能测试: ⚠️  编译时间较长 (${this.results.performanceTest.fastConfig}ms)`);
    } else {
      console.log('性能测试: ❌ 失败');
    }

    // 总体评估
    const allConfigsValid = validConfigs === totalConfigs;
    const allScriptsExist = validScripts === totalScripts;
    const allFilesExist = validFiles === totalFiles;
    const performancePassed = this.results.performanceTest?.passed;

    this.results.overall = allConfigsValid && allScriptsExist && allFilesExist && performancePassed;

    if (this.results.overall) {
      console.log('\n🎉 所有配置验证通过！性能优化配置已就绪。');
    } else {
      console.log('\n⚠️  存在配置问题，请检查上述报告并修复。');
    }

    console.log('='.repeat(50));

    return this.results;
  }

  // 生成修复建议
  generateSuggestions() {
    console.log('\n💡 修复建议:');
    console.log('='.repeat(50));

    // 配置文件建议
    for (const [config, result] of Object.entries(this.results.configs)) {
      if (!result.exists) {
        console.log(`📝 创建缺失的配置文件: ${config}`);
      } else if (!result.valid) {
        console.log(`🔧 修复无效的配置文件: ${config}`);
      }
    }

    // 脚本建议
    for (const [script, result] of Object.entries(this.results.scripts)) {
      if (!result.exists) {
        console.log(`📝 添加缺失的脚本命令: ${script}`);
      }
    }

    // 文件建议
    for (const [file, result] of Object.entries(this.results.files)) {
      if (!result.exists) {
        console.log(`📝 创建缺失的脚本文件: ${file}`);
      }
    }

    // 性能建议
    if (this.results.performanceTest?.fastConfig > 5000) {
      console.log('⚡ 编译时间较长，建议:');
      console.log('   - 使用 tsconfig.fast.json 进行快速开发');
      console.log('   - 增加 Node.js 内存限制');
      console.log('   - 清理缓存文件');
    }

    if (!this.results.performanceTest?.passed) {
      console.log('🔧 性能测试失败，建议:');
      console.log('   - 检查 TypeScript 配置语法');
      console.log('   - 验证源代码无类型错误');
      console.log('   - 检查依赖项是否正确安装');
    }

    console.log('='.repeat(50));
  }

  // 自动修复常见问题
  autoFix() {
    console.log('\n🔧 尝试自动修复常见问题...');

    // 创建缺失的配置文件（基于现有配置）
    const baseConfig = this.results.configs['tsconfig.json'];
    if (baseConfig?.exists && baseConfig?.valid) {
      for (const config of ['tsconfig.dev.json', 'tsconfig.fast.json']) {
        if (!this.results.configs[config]?.exists) {
          try {
            const configPath = path.resolve(__dirname, '..', config);
            const content = {
              extends: './tsconfig.json',
              compilerOptions: {
                ...baseConfig.content.compilerOptions,
                incremental: true,
                tsBuildInfoFile: `.tsbuildinfo-${config.replace('.json', '')}`,
                skipLibCheck: true,
                skipDefaultLibCheck: true
              },
              exclude: [
                "node_modules",
                "dist",
                "build",
                "**/*.test.*",
                "**/*.spec.*"
              ]
            };

            // 针对不同配置的特殊优化
            if (config === 'tsconfig.fast.json') {
              content.compilerOptions.strict = false;
              content.compilerOptions.noImplicitAny = false;
              content.compilerOptions.noUnusedLocals = false;
              content.compilerOptions.noUnusedParameters = false;
            }

            fs.writeFileSync(configPath, JSON.stringify(content, null, 2));
            console.log(`  ✅ 已创建 ${config}`);
          } catch (error) {
            console.log(`  ❌ 创建 ${config} 失败: ${error.message}`);
          }
        }
      }
    }

    console.log('🔧 自动修复完成，请重新运行验证。');
  }

  // 运行完整验证
  async runValidation(autoFix = false) {
    console.log('🚀 开始TypeScript性能配置验证...\n');

    this.validateConfigFiles();
    this.validatePackageScripts();
    this.validateScriptFiles();
    this.validateTypeScriptSyntax();
    this.validateViteConfig();
    this.runQuickPerformanceTest();

    const report = this.generateReport();

    if (!this.results.overall && autoFix) {
      this.generateSuggestions();
      this.autoFix();
    }

    return report;
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix');

  const validator = new PerformanceConfigValidator();

  try {
    const report = await validator.runValidation(autoFix);

    if (report.overall) {
      console.log('\n🎉 配置验证成功！可以开始使用性能优化配置。');
      console.log('\n📚 推荐命令:');
      console.log('  npm run type-check:fast   # 快速类型检查');
      console.log('  npm run type-check:perf  # 性能优化类型检查');
      console.log('  npm run perf:monitor     # 性能监控');
    } else {
      console.log('\n❌ 配置验证失败，请查看详细报告。');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 验证过程出错:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = PerformanceConfigValidator;