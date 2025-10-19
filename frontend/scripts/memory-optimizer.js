#!/usr/bin/env node

/**
 * 内存优化配置脚本
 * 用于开发环境的内存管理优化
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class MemoryOptimizer {
  constructor() {
    this.nodeConfig = {
      // 堆内存配置
      maxOldSpaceSize: 4096, // 4GB
      maxSemiSpaceSize: 256,  // 256MB

      // 垃圾回收配置
      exposeGC: true,
      gcGlobal: false,

      // 其他优化配置
      optimizeForSize: false,
      maxExecutableSize: 0,

      // 内存跟踪
      traceGC: false,
      traceGcVerbose: false
    };

    this.vscodeConfig = {
      "typescript.preferences.includePackageJsonAutoImports": "off",
      "typescript.suggest.autoImports": false,
      "typescript.updateImportsOnFileMove.enabled": "never",
      "typescript.workspaceSymbols.scope": "allOpenProjects",
      "files.watcherExclude": {
        "**/node_modules/**": true,
        "**/dist/**": true,
        "**/coverage/**": true,
        "**/.git/**": true,
        "**/*.test.*": true,
        "**/*.spec.*": true
      },
      "search.exclude": {
        "**/node_modules": true,
        "**/dist": true,
        "**/coverage": true,
        "**/.git": true,
        "**/*.test.*": true,
        "**/*.spec.*": true
      },
      "files.exclude": {
        "**/.tsbuildinfo*": true,
        "**/node_modules": true,
        "**/dist": true,
        "**/coverage": true
      }
    };
  }

  // 生成Node.js启动参数
  generateNodeArgs() {
    const args = [];

    // 堆内存限制
    args.push(`--max-old-space-size=${this.nodeConfig.maxOldSpaceSize}`);
    args.push(`--max-semi-space-size=${this.nodeConfig.maxSemiSpaceSize}`);

    // 垃圾回收优化
    if (this.nodeConfig.exposeGC) {
      args.push('--expose-gc');
    }

    if (this.nodeConfig.gcGlobal) {
      args.push('--gc-global');
    }

    if (this.nodeConfig.optimizeForSize) {
      args.push('--optimize-for-size');
    }

    // 内存跟踪（开发环境可选）
    if (process.env.NODE_ENV === 'development' && this.nodeConfig.traceGC) {
      args.push('--trace-gc');
      args.push('--trace-gc-verbose');
    }

    return args.join(' ');
  }

  // 更新package.json的scripts
  updatePackageScripts() {
    try {
      const packageJsonPath = path.resolve(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const nodeArgs = this.generateNodeArgs();

      // 为内存密集型命令添加Node.js参数
      const memoryIntensiveScripts = [
        'build',
        'type-check',
        'type-check:dev',
        'type-check:perf',
        'test:coverage'
      ];

      memoryIntensiveScripts.forEach(scriptName => {
        if (packageJson.scripts && packageJson.scripts[scriptName]) {
          const originalCommand = packageJson.scripts[scriptName];
          if (!originalCommand.startsWith('node ')) {
            packageJson.scripts[scriptName] = `node ${nodeArgs} ${originalCommand}`;
          }
        }
      });

      // 添加内存监控命令
      packageJson.scripts['dev:memory'] = `node ${nodeArgs} vite`;
      packageJson.scripts['build:memory'] = `node ${nodeArgs} vite build`;
      packageJson.scripts['type-check:memory'] = `node ${nodeArgs} tsc --noEmit -p tsconfig.json`;

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ 已更新package.json的scripts配置');

      return true;
    } catch (error) {
      console.error('❌ 更新package.json失败:', error.message);
      return false;
    }
  }

  // 生成VSCode配置
  generateVSCodeConfig() {
    try {
      const vscodeDir = path.resolve(__dirname, '../.vscode');
      const settingsPath = path.join(vscodeDir, 'settings.json');

      // 确保目录存在
      if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
      }

      let settings = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }

      // 合并配置
      settings = { ...settings, ...this.vscodeConfig };

      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('✅ 已生成VSCode配置文件');

      return settingsPath;
    } catch (error) {
      console.error('❌ 生成VSCode配置失败:', error.message);
      return null;
    }
  }

  // 生成环境变量配置
  generateEnvConfig() {
    const envConfig = `
# 内存优化环境变量
# Node.js 内存限制配置
export NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=256 --expose-gc"

# TypeScript 编译优化
export TS_NODE_COMPILER_OPTIONS="{\\"incremental\\": true, \\"skipLibCheck\\": true}"
export TS_NODE_PROJECT="./tsconfig.performance.json"

# 开发服务器优化
export VITE_MEMORY_LIMIT=4096
export VITE_BUILD_CACHE=false

# 垃圾回收优化
export NODE_ENV=development
export NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size"
`;

    const envPath = path.resolve(__dirname, '../.env.memory');

    try {
      fs.writeFileSync(envPath, envConfig.trim());
      console.log('✅ 已生成环境变量配置文件');
      console.log(`📄 配置文件路径: ${envPath}`);
      console.log('💡 使用方法: source .env.memory');

      return envPath;
    } catch (error) {
      console.error('❌ 生成环境变量配置失败:', error.message);
      return null;
    }
  }

  // 生成内存监控配置
  generateMemoryMonitorConfig() {
    const monitorConfig = {
      thresholds: {
        heapUsed: 512, // MB
        heapTotal: 1024, // MB
        rss: 2048, // MB
        external: 64 // MB
      },
      alerts: {
        heapUsage: true,
        gcFrequency: true,
        memoryLeaks: true
      },
      logging: {
        enabled: true,
        interval: 5000, // 5秒
        detailed: false
      }
    };

    const configPath = path.resolve(__dirname, '../config/memory-monitor.json');

    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(monitorConfig, null, 2));
      console.log('✅ 已生成内存监控配置文件');

      return configPath;
    } catch (error) {
      console.error('❌ 生成内存监控配置失败:', error.message);
      return null;
    }
  }

  // 创建内存清理脚本
  createCleanupScript() {
    const cleanupScript = `#!/bin/bash

# TypeScript 内存清理脚本
echo "🧹 开始清理TypeScript缓存..."

# 清理构建缓存
rm -rf .tsbuildinfo*
rm -rf node_modules/.cache
rm -rf dist build
rm -rf coverage

# 清理依赖预构建缓存
rm -rf node_modules/.vite

# 清理TypeScript服务缓存
find . -name "*.tsbuildinfo" -delete
find . -name ".tsbuildinfo*" -delete

# 执行垃圾回收
if command -v node &> /dev/null; then
    node -e "if(global.gc) global.gc(); console.log('🗑️  执行垃圾回收完成');"
fi

echo "✅ 缓存清理完成"
echo "💡 建议重启开发服务器以确保内存释放"
`;

    const scriptPath = path.resolve(__dirname, '../scripts/cleanup-memory.sh');

    try {
      fs.writeFileSync(scriptPath, cleanupScript);

      // 设置执行权限
      fs.chmodSync(scriptPath, '755');

      console.log('✅ 已创建内存清理脚本');
      console.log(`📄 脚本路径: ${scriptPath}`);

      return scriptPath;
    } catch (error) {
      console.error('❌ 创建内存清理脚本失败:', error.message);
      return null;
    }
  }

  // 优化TypeScript配置
  optimizeTypeScriptConfig() {
    try {
      const configPath = path.resolve(__dirname, '../tsconfig.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // 添加内存优化配置
      if (!config.compilerOptions) {
        config.compilerOptions = {};
      }

      // 增量编译优化
      config.compilerOptions.incremental = true;
      config.compilerOptions.tsBuildInfoFile = '.tsbuildinfo-memory-optimized';
      config.compilerOptions.assumeChangesOnlyAffectDirectDependencies = true;

      // 跳过检查以节省内存
      config.compilerOptions.skipLibCheck = true;
      config.compilerOptions.skipDefaultLibCheck = true;

      // 减少严格性以节省内存（仅在开发环境）
      if (process.env.NODE_ENV === 'development') {
        config.compilerOptions.exactOptionalPropertyTypes = false;
        config.compilerOptions.noUncheckedIndexedAccess = false;
        config.compilerOptions.noUnusedLocals = false;
        config.compilerOptions.noUnusedParameters = false;
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('✅ 已优化TypeScript配置');

      return true;
    } catch (error) {
      console.error('❌ 优化TypeScript配置失败:', error.message);
      return false;
    }
  }

  // 运行完整的内存优化
  async runOptimization() {
    console.log('🚀 开始TypeScript内存优化配置...\n');

    const results = {
      packageScripts: this.updatePackageScripts(),
      vscodeConfig: this.generateVSCodeConfig(),
      envConfig: this.generateEnvConfig(),
      memoryMonitor: this.generateMemoryMonitorConfig(),
      cleanupScript: this.createCleanupScript(),
      tsConfigOpt: this.optimizeTypeScriptConfig()
    };

    console.log('\n📊 优化结果:');
    console.log('='.repeat(40));
    console.log(`package.json scripts: ${results.packageScripts ? '✅' : '❌'}`);
    console.log(`VSCode 配置: ${results.vscodeConfig ? '✅' : '❌'}`);
    console.log(`环境变量配置: ${results.envConfig ? '✅' : '❌'}`);
    console.log(`内存监控配置: ${results.memoryMonitor ? '✅' : '❌'}`);
    console.log(`清理脚本: ${results.cleanupScript ? '✅' : '❌'}`);
    console.log(`TypeScript配置优化: ${results.tsConfigOpt ? '✅' : '❌'}`);
    console.log('='.repeat(40));

    this.printUsageGuide();

    return results;
  }

  // 打印使用指南
  printUsageGuide() {
    console.log('\n💡 使用指南:');
    console.log('='.repeat(40));
    console.log('1. 开发环境优化:');
    console.log('   npm run dev:memory    # 使用优化内存的开发服务器');
    console.log('   npm run type-check:memory  # 使用优化内存的类型检查');
    console.log('');
    console.log('2. 性能监控:');
    console.log('   npm run perf:monitor  # 监控编译性能');
    console.log('   npm run perf:monitor:perf  # 监控性能配置并保存报告');
    console.log('');
    console.log('3. 内存清理:');
    console.log('   ./scripts/cleanup-memory.sh  # 清理缓存和内存');
    console.log('');
    console.log('4. 环境变量:');
    console.log('   source .env.memory    # 加载内存优化环境变量');
    console.log('');
    console.log('5. VSCode配置:');
    console.log('   重启VSCode以应用内存优化配置');
    console.log('='.repeat(40));
  }
}

// 主函数
async function main() {
  const optimizer = new MemoryOptimizer();

  try {
    await optimizer.runOptimization();
    console.log('\n🎉 内存优化配置完成！');
  } catch (error) {
    console.error('\n❌ 内存优化配置失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = MemoryOptimizer;