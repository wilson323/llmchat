#!/usr/bin/env node

/**
 * ESLint修复运行器
 * 提供简化的命令行接口来执行修复策略
 */

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');

class ESLintFixRunner {
  constructor() {
    this.projectRoot = process.cwd();
    this.scriptPath = path.join(__dirname, 'eslint-progressive-fix.js');
  }

  /**
   * 执行命令
   */
  async executeCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.scriptPath, ...args], {
        cwd: this.projectRoot,
        stdio: options.silent ? 'pipe' : 'inherit'
      });

      let stdout = '';
      let stderr = '';

      if (!options.silent) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(chalk.blue('🚀 ESLint Progressive Fix Runner'));
    console.log('');
    console.log('Quick Start Commands:');
    console.log('');
    console.log('  📊 Analysis:');
    console.log('    node eslint-fix-runner.js analyze          Generate comprehensive analysis');
    console.log('    node eslint-fix-runner.js any-report        Analyze any type usage');
    console.log('');
    console.log('  🔧 Progressive Fixes:');
    console.log('    node eslint-fix-runner.js fix-blocker       Fix all blocker issues');
    console.log('    node eslint-fix-runner.js fix-major         Fix major code quality issues');
    console.log('    node eslint-fix-runner.js fix-critical      Fix critical type safety issues');
    console.log('    node eslint-fix-runner.js fix-minor         Fix minor style issues');
    console.log('');
    console.log('  📈 Advanced:');
    console.log('    node eslint-fix-runner.js fix-all            Run complete fix strategy');
    console.log('    node eslint-fix-runner.js fix-dry-run        Preview all fixes without applying');
    console.log('    node eslint-fix-runner.js status             Show current ESLint status');
    console.log('');
    console.log('  🛡️ Safety:');
    console.log('    node eslint-fix-runner.js backup             Create backup');
    console.log('    node eslint-fix-runner.js restore            Restore from backup');
    console.log('    node eslint-fix-runner.js verify             Verify current state');
    console.log('');
    console.log('Options:');
    console.log('    --safe-mode                    Enable additional safety checks');
    console.log('    --exclude-tests               Exclude test files from processing');
    console.log('    --batch-size=<number>         Set custom batch size');
    console.log('    --module=<backend|frontend>   Target specific module');
    console.log('');
    console.log('Examples:');
    console.log('    node eslint-fix-runner.js fix-blocker --safe-mode');
    console.log('    node eslint-fix-runner.js fix-major --module=backend');
    console.log('    node eslint-fix-runner.js fix-all --batch-size=20');
  }

  /**
   * 生成状态报告
   */
  async showStatus() {
    console.log(chalk.blue('📊 Current ESLint Status'));

    try {
      // 后端状态
      console.log(chalk.yellow('\n🔧 Backend:'));
      await this.executeCommand(['report'], {
        silent: true,
        module: 'backend'
      });

      // 前端状态
      console.log(chalk.yellow('\n🎨 Frontend:'));
      await this.executeCommand(['report'], {
        silent: true,
        module: 'frontend'
      });

    } catch (error) {
      console.log(chalk.red(`❌ Failed to get status: ${error.message}`));
    }
  }

  /**
   * 执行完整修复策略
   */
  async runCompleteFix(options = {}) {
    console.log(chalk.blue('🚀 Starting Complete ESLint Fix Strategy'));

    const phases = [
      'Phase 1 - Blocker Issues',
      'Phase 2 - Major Issues',
      'Phase 3 - Critical Issues',
      'Phase 4 - Minor Issues'
    ];

    let totalFixed = 0;

    for (const phase of phases) {
      try {
        console.log(chalk.yellow(`\n📝 Executing: ${phase}`));

        const result = await this.executeCommand([phase, '--safe-mode'], {
          silent: true
        });

        totalFixed += result.stdout?.match(/Fixed \d+ issues/)?.[0]?.match(/\d+/)?.[0] || 0;

        console.log(chalk.green(`✅ ${phase} completed`));

      } catch (error) {
        console.log(chalk.red(`❌ ${phase} failed: ${error.message}`));

        if (options.stopOnError) {
          console.log(chalk.yellow('⚠️  Stopping due to error'));
          break;
        } else {
          console.log(chalk.yellow('⚠️  Continuing with next phase...'));
        }
      }
    }

    console.log(chalk.green(`\n🎉 Complete fix strategy finished! Total issues fixed: ${totalFixed}`));
    return totalFixed;
  }

  /**
   * 预览修复（dry-run模式）
   */
  async previewFixes() {
    console.log(chalk.blue('🔍 Preview: What would be fixed (Dry Run Mode)'));

    const phases = [
      'Phase 1 - Blocker Issues',
      'Phase 2 - Major Issues',
      'Phase 3 - Critical Issues',
      'Phase 4 - Minor Issues'
    ];

    for (const phase of phases) {
      console.log(chalk.yellow(`\n📝 Previewing: ${phase}`));

      try {
        await this.executeCommand([phase, '--dry-run', '--safe-mode'], {
          silent: false
        });

        console.log(chalk.green(`✅ ${phase} preview completed`));

      } catch (error) {
        console.log(chalk.red(`❌ ${phase} preview failed: ${error.message}`));
      }
    }

    console.log(chalk.blue('\n💡 Run without --dry-run to apply these fixes'));
  }

  /**
   * 修复特定类别的问题
   */
  async fixCategory(category, options = {}) {
    console.log(chalk.blue(`🔧 Fixing category: ${category}`));

    try {
      const args = [category];

      if (options.safeMode) {
        args.push('--safe-mode');
      }

      if (options.dryRun) {
        args.push('--dry-run');
      }

      if (options.module) {
        args.push('--module', options.module);
      }

      await this.executeCommand(args);
      console.log(chalk.green(`✅ ${category} fixed successfully`));

    } catch (error) {
      console.log(chalk.red(`❌ Failed to fix ${category}: ${error.message}`));
      throw error;
    }
  }

  /**
   * 验证当前状态
   */
  async verify() {
    console.log(chalk.blue('🔍 Verifying current state...'));

    const checks = [
      { name: 'TypeScript compilation', command: 'pnpm run type-check' },
      { name: 'Backend build', command: 'pnpm run backend:build' },
      { name: 'Frontend build', command: 'pnpm run frontend:build' },
      { name: 'Tests', command: 'pnpm test' }
    ];

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
      console.log(chalk.yellow(`\n🔍 Running: ${check.name}`));

      try {
        await this.executeShellCommand(check.command);
        console.log(chalk.green(`✅ ${check.name} passed`));
        passed++;
      } catch (error) {
        console.log(chalk.red(`❌ ${check.name} failed: ${error.message}`));
        failed++;
      }
    }

    console.log(chalk.blue(`\n📊 Verification Summary:`));
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));

    if (failed === 0) {
      console.log(chalk.green('\n🎉 All checks passed!'));
    } else {
      console.log(chalk.yellow('\n⚠️  Some checks failed. Please review and fix issues.'));
    }

    return failed === 0;
  }

  /**
   * 执行shell命令
   */
  async executeShellCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed: ${command}\nOutput: ${output}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 主执行函数
   */
  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    const options = {
      safeMode: args.includes('--safe-mode'),
      excludeTests: args.includes('--exclude-tests'),
      dryRun: args.includes('--dry-run'),
      stopOnError: args.includes('--stop-on-error'),
      batchSize: this.parseOption(args, '--batch-size=', 'number'),
      module: this.parseOption(args, '--module=')
    };

    try {
      switch (command) {
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;

        case 'status':
          await this.showStatus();
          break;

        case 'analyze':
          await this.executeCommand(['report']);
          break;

        case 'any-report':
          await this.executeCommand(['any-report']);
          break;

        case 'backup':
          await this.executeCommand(['backup']);
          break;

        case 'restore':
          console.log(chalk.yellow('⚠️  Restore feature not implemented yet'));
          console.log('Use: git checkout HEAD -- . to restore all files');
          break;

        case 'verify':
          await this.verify();
          break;

        case 'fix-blocker':
          await this.fixCategory('Phase 1 - Blocker Issues', options);
          break;

        case 'fix-major':
          await this.fixCategory('Phase 2 - Major Issues', options);
          break;

        case 'fix-critical':
          await this.fixCategory('Phase 3 - Critical Issues', options);
          break;

        case 'fix-minor':
          await this.fixCategory('Phase 4 - Minor Issues', options);
          break;

        case 'fix-all':
          await this.runCompleteFix(options);
          break;

        case 'fix-dry-run':
          await this.previewFixes();
          break;

        default:
          console.log(chalk.red(`❌ Unknown command: ${command}`));
          console.log('Run "node eslint-fix-runner.js help" for available commands');
          process.exit(1);
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * 解析命令行选项
   */
  parseOption(args, prefix, type = 'string') {
    const option = args.find(arg => arg.startsWith(prefix));
    if (!option) return undefined;

    const value = option.substring(prefix.length);
    return type === 'number' ? parseInt(value) : value;
  }
}

// CLI接口
async function main() {
  const runner = new ESLintFixRunner();
  await runner.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = ESLintFixRunner;