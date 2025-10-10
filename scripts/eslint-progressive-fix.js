#!/usr/bin/env node

/**
 * ESLint渐进式修复工具
 * 支持分阶段、分类、风险可控的自动修复
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

class ESLintProgressiveFixer {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      backup: options.backup !== false,
      safeMode: options.safeMode || false,
      batchSize: options.batchSize || 50,
      ...options
    };

    this.projectRoot = process.cwd();
    this.backupDir = path.join(this.projectRoot, '.eslint-fix-backups');
    this.reportsDir = path.join(this.projectRoot, 'reports');

    this.ensureDirectories();
    this.loadConfiguration();
  }

  /**
   * 确保必要的目录存在
   */
  ensureDirectories() {
    [this.backupDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 加载配置文件
   */
  loadConfiguration() {
    const configPath = path.join(__dirname, '../config/eslint-fix-rules.json');
    if (fs.existsSync(configPath)) {
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      this.config = this.getDefaultConfiguration();
      this.saveConfiguration();
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfiguration() {
    return {
      phases: [
        {
          name: 'Phase 1 - Blocker Issues',
          priority: 'blocker',
          categories: [
            {
              name: 'syntax-errors',
              rules: ['no-unused-vars', 'no-unreachable', 'no-constant-condition'],
              strategy: 'auto-fix',
              risk: 'low',
              batchSize: 30
            },
            {
              name: 'security-issues',
              rules: ['no-debugger', 'no-eval', 'no-alert', 'no-script-url'],
              strategy: 'auto-remove',
              risk: 'very-low',
              batchSize: 50
            },
            {
              name: 'duplicate-imports',
              rules: ['no-duplicate-imports', 'no-useless-constructor'],
              strategy: 'auto-fix',
              risk: 'low',
              batchSize: 40
            }
          ]
        },
        {
          name: 'Phase 2 - Major Issues',
          priority: 'major',
          categories: [
            {
              name: 'variable-declarations',
              rules: ['prefer-const', 'no-var'],
              strategy: 'auto-fix',
              risk: 'low',
              batchSize: 60
            },
            {
              name: 'control-structures',
              rules: ['eqeqeq', 'curly', 'brace-style', 'default-case'],
              strategy: 'auto-fix',
              risk: 'low',
              batchSize: 50
            },
            {
              name: 'typescript-best-practices',
              rules: ['prefer-nullish-coalescing', 'prefer-optional-chain', 'no-unnecessary-type-assertion'],
              strategy: 'auto-fix-with-review',
              risk: 'medium',
              batchSize: 30
            },
            {
              name: 'code-style',
              rules: ['comma-dangle', 'quotes', 'semi', 'indent'],
              strategy: 'auto-fix',
              risk: 'very-low',
              batchSize: 100
            }
          ]
        },
        {
          name: 'Phase 3 - Critical Issues',
          priority: 'critical',
          categories: [
            {
              name: 'type-safety',
              rules: ['@typescript-eslint/no-explicit-any'],
              strategy: 'categorized-approach',
              risk: 'high',
              batchSize: 20,
              subcategories: {
                'third-party': 'preserve-with-comment',
                'api-response': 'define-interface',
                'temp-vars': 'add-type-annotation',
                'legacy-code': 'preserve-with-todo'
              }
            },
            {
              name: 'unsafe-operations',
              rules: [
                '@typescript-eslint/no-unsafe-assignment',
                '@typescript-eslint/no-unsafe-call',
                '@typescript-eslint/no-unsafe-member-access',
                '@typescript-eslint/no-unsafe-return'
              ],
              strategy: 'gradual-typing',
              risk: 'medium',
              batchSize: 25
            },
            {
              name: 'async-issues',
              rules: [
                '@typescript-eslint/no-floating-promises',
                '@typescript-eslint/no-misused-promises',
                '@typescript-eslint/require-await'
              ],
              strategy: 'async-handling',
              risk: 'medium-high',
              batchSize: 15
            }
          ]
        },
        {
          name: 'Phase 4 - Minor Issues',
          priority: 'minor',
          categories: [
            {
              name: 'formatting',
              rules: ['space-infix-ops', 'keyword-spacing', 'no-trailing-spaces'],
              strategy: 'auto-fix',
              risk: 'very-low',
              batchSize: 100
            },
            {
              name: 'naming',
              rules: ['no-useless-rename'],
              strategy: 'auto-fix',
              risk: 'low',
              batchSize: 30
            },
            {
              name: 'comments',
              rules: ['spaced-comment'],
              strategy: 'auto-fix',
              risk: 'very-low',
              batchSize: 50
            }
          ]
        }
      ],

      modules: ['backend', 'frontend', 'shared-types'],

      excludePaths: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        '.git',
        '*.min.js',
        '*.bundle.js'
      ],

      testPatterns: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/__tests__/**/*'
      ]
    };
  }

  /**
   * 保存配置文件
   */
  saveConfiguration() {
    const configPath = path.join(__dirname, '../config/eslint-fix-rules.json');
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * 创建备份
   */
  async createBackup(stage = 'pre-fix') {
    if (!this.options.backup) {
      return;
    }

    const spinner = ora('Creating backup...').start();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${stage}-${timestamp}`);

    try {
      // 创建git状态备份
      execSync(`git status --porcelain > "${backupPath}-git-status.txt"`, { cwd: this.projectRoot });
      execSync(`git diff HEAD > "${backupPath}-git-diff.patch"`, { cwd: this.projectRoot });

      // 创建文件备份
      const filesToBackup = this.getAllTypeScriptFiles();
      for (const file of filesToBackup) {
        const relativePath = path.relative(this.projectRoot, file);
        const backupFilePath = path.join(backupPath, relativePath);
        const backupDir = path.dirname(backupFilePath);

        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        fs.copyFileSync(file, backupFilePath);
      }

      spinner.succeed(`Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      spinner.fail('Failed to create backup');
      throw error;
    }
  }

  /**
   * 获取所有TypeScript文件
   */
  getAllTypeScriptFiles() {
    const files = [];

    this.config.modules.forEach(module => {
      const modulePath = path.join(this.projectRoot, module, 'src');
      if (fs.existsSync(modulePath)) {
        const moduleFiles = this.findFiles(modulePath, ['.ts', '.tsx']);
        files.push(...moduleFiles);
      }
    });

    return files.filter(file => {
      const relativePath = path.relative(this.projectRoot, file);

      // 排除测试文件（如果配置要求）
      if (this.options.excludeTests) {
        const isTestFile = this.config.testPatterns.some(pattern =>
          this.matchPattern(relativePath, pattern)
        );
        if (isTestFile) return false;
      }

      // 排除指定路径
      const isExcluded = this.config.excludePaths.some(excludePath =>
        relativePath.includes(excludePath)
      );

      return !isExcluded;
    });
  }

  /**
   * 递归查找文件
   */
  findFiles(dir, extensions) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.findFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * 模式匹配
   */
  matchPattern(str, pattern) {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    return new RegExp(`^${regexPattern}$`).test(str);
  }

  /**
   * 运行ESLint检查
   */
  async runESLintCheck(files, rules = [], format = 'json') {
    const ruleArgs = rules.length > 0 ? rules.map(rule => `--rule ${rule}`).join(' ') : '';
    const fileArgs = files.map(file => `"${file}"`).join(' ');

    const command = `npx eslint ${fileArgs} ${ruleArgs} --format=${format} --no-eslintrc --config .eslintrc.cjs`;

    try {
      const result = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return format === 'json' ? JSON.parse(result) : result;
    } catch (error) {
      if (format === 'json') {
        return JSON.parse(error.stdout || '[]');
      }
      throw error;
    }
  }

  /**
   * 生成问题报告
   */
  async generateReport() {
    const spinner = ora('Analyzing ESLint issues...').start();

    try {
      const allFiles = this.getAllTypeScriptFiles();
      const report = await this.runESLintCheck(allFiles);

      // 分析问题分布
      const analysis = this.analyzeIssues(report);

      // 保存报告
      const reportPath = path.join(this.reportsDir, `eslint-analysis-${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify({ report, analysis }, null, 2));

      spinner.succeed(`Report generated: ${reportPath}`);
      return { report, analysis, reportPath };
    } catch (error) {
      spinner.fail('Failed to generate report');
      throw error;
    }
  }

  /**
   * 分析问题分布
   */
  analyzeIssues(report) {
    const analysis = {
      total: report.length,
      bySeverity: { error: 0, warning: 0 },
      byRule: {},
      byFile: {},
      byModule: { backend: 0, frontend: 0, 'shared-types': 0 },
      byCategory: {
        blocker: 0,
        major: 0,
        critical: 0,
        minor: 0
      }
    };

    for (const result of report) {
      const filePath = result.filePath;
      const module = this.detectModule(filePath);

      analysis.byModule[module] = (analysis.byModule[module] || 0) + result.messages.length;
      analysis.byFile[filePath] = result.messages.length;

      for (const message of result.messages) {
        const rule = message.ruleId;
        const severity = message.severity === 2 ? 'error' : 'warning';
        const category = this.categorizeRule(rule);

        analysis.bySeverity[severity]++;
        analysis.byRule[rule] = (analysis.byRule[rule] || 0) + 1;
        analysis.byCategory[category]++;
      }
    }

    return analysis;
  }

  /**
   * 检测文件所属模块
   */
  detectModule(filePath) {
    if (filePath.includes('/backend/')) return 'backend';
    if (filePath.includes('/frontend/')) return 'frontend';
    if (filePath.includes('/shared-types/')) return 'shared-types';
    return 'unknown';
  }

  /**
   * 规则分类
   */
  categorizeRule(rule) {
    if (!rule) return 'minor';

    const blockerRules = [
      'no-unused-vars',
      'no-unreachable',
      'no-constant-condition',
      'no-debugger',
      'no-eval',
      'no-alert',
      'no-script-url',
      'no-duplicate-imports',
      'no-useless-constructor'
    ];

    const criticalRules = [
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-unsafe-assignment',
      '@typescript-eslint/no-unsafe-call',
      '@typescript-eslint/no-unsafe-member-access',
      '@typescript-eslint/no-unsafe-return',
      '@typescript-eslint/no-floating-promises',
      '@typescript-eslint/no-misused-promises'
    ];

    const majorRules = [
      'prefer-const',
      'no-var',
      'eqeqeq',
      'curly',
      'brace-style',
      'prefer-nullish-coalescing',
      'prefer-optional-chain',
      'comma-dangle',
      'quotes',
      'semi',
      'indent'
    ];

    if (blockerRules.includes(rule)) return 'blocker';
    if (criticalRules.includes(rule)) return 'critical';
    if (majorRules.includes(rule)) return 'major';
    return 'minor';
  }

  /**
   * 修复特定阶段的问题
   */
  async fixPhase(phaseName, options = {}) {
    const phase = this.config.phases.find(p => p.name === phaseName);
    if (!phase) {
      throw new Error(`Phase not found: ${phaseName}`);
    }

    console.log(chalk.blue(`\n🚀 Starting ${phaseName}`));

    // 创建备份
    if (options.backup !== false) {
      await this.createBackup(phaseName);
    }

    let totalFixed = 0;

    for (const category of phase.categories) {
      console.log(chalk.yellow(`\n📝 Processing category: ${category.name}`));

      const fixed = await this.fixCategory(category, options);
      totalFixed += fixed;

      console.log(chalk.green(`✅ Fixed ${fixed} issues in ${category.name}`));

      // 运行验证
      if (options.verify !== false) {
        await this.verifyFix();
      }
    }

    console.log(chalk.green(`\n🎉 Phase ${phaseName} completed! Total fixed: ${totalFixed}`));
    return totalFixed;
  }

  /**
   * 修复特定类别的问题
   */
  async fixCategory(category, options = {}) {
    const spinner = ora(`Fixing ${category.name}...`).start();

    try {
      const allFiles = this.getAllTypeScriptFiles();
      let fixedCount = 0;

      // 分批处理文件
      const batches = this.createBatches(allFiles, category.batchSize || this.options.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        spinner.text = `Fixing ${category.name} - Batch ${i + 1}/${batches.length}`;

        const batchFixed = await this.fixBatch(batch, category, options);
        fixedCount += batchFixed;

        // 显示进度
        const progress = Math.round(((i + 1) / batches.length) * 100);
        spinner.text = `Fixing ${category.name} - ${progress}% (${fixedCount} fixed)`;
      }

      spinner.succeed(`Fixed ${fixedCount} issues in ${category.name}`);
      return fixedCount;
    } catch (error) {
      spinner.fail(`Failed to fix ${category.name}`);
      throw error;
    }
  }

  /**
   * 创建文件批次
   */
  createBatches(files, batchSize) {
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 修复单个批次
   */
  async fixBatch(files, category, options = {}) {
    if (this.options.dryRun) {
      console.log(chalk.gray(`[DRY RUN] Would fix ${category.name} for ${files.length} files`));
      return 0;
    }

    const ruleArgs = category.rules.map(rule => `--fix --rule ${rule}`).join(' ');
    const fileArgs = files.map(file => `"${file}"`).join(' ');

    try {
      const command = `npx eslint ${fileArgs} ${ruleArgs} --no-eslintrc --config .eslintrc.cjs`;

      // 在安全模式下，先检查修复可能的影响
      if (this.options.safeMode || category.risk === 'high') {
        const preFixReport = await this.runESLintCheck(files, category.rules);

        // 执行修复
        execSync(command, { cwd: this.projectRoot, stdio: 'pipe' });

        // 验证修复结果
        const postFixReport = await this.runESLintCheck(files, category.rules);
        const fixedCount = preFixReport.reduce((count, result) => {
          return count + result.messages.filter(msg =>
            category.rules.includes(msg.ruleId)
          ).length;
        }, 0);

        return fixedCount;
      } else {
        // 直接执行修复
        execSync(command, { cwd: this.projectRoot, stdio: 'pipe' });

        // 估算修复数量
        const preFixReport = await this.runESLintCheck(files, category.rules);
        return preFixReport.reduce((count, result) => count + result.messages.length, 0);
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Some fixes failed for batch: ${error.message}`));
      return 0;
    }
  }

  /**
   * 验证修复结果
   */
  async verifyFix() {
    const spinner = ora('Verifying fixes...').start();

    try {
      // 运行测试
      if (fs.existsSync(path.join(this.projectRoot, 'package.json'))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));

        if (packageJson.scripts && packageJson.scripts.test) {
          try {
            execSync('pnpm test --silent', { cwd: this.projectRoot, stdio: 'pipe' });
          } catch (error) {
            spinner.warn('Tests failed after fixes - review required');
            return false;
          }
        }
      }

      // 检查构建
      try {
        execSync('pnpm build', { cwd: this.projectRoot, stdio: 'pipe' });
      } catch (error) {
        spinner.fail('Build failed after fixes');
        throw new Error('Build verification failed');
      }

      spinner.succeed('Fixes verified successfully');
      return true;
    } catch (error) {
      spinner.fail('Verification failed');
      throw error;
    }
  }

  /**
   * 生成详细的any类型使用报告
   */
  async generateAnyTypeReport() {
    const spinner = ora('Analyzing any type usage...').start();

    try {
      const allFiles = this.getAllTypeScriptFiles();
      const report = await this.runESLintCheck(allFiles, ['@typescript-eslint/no-explicit-any']);

      const analysis = {
        total: 0,
        byFile: {},
        byContext: {
          'third-party': [],
          'api-response': [],
          'temp-vars': [],
          'legacy-code': [],
          'unknown': []
        },
        examples: []
      };

      for (const result of report) {
        for (const message of result.messages) {
          if (message.ruleId === '@typescript-eslint/no-explicit-any') {
            analysis.total++;

            const filePath = result.filePath;
            analysis.byFile[filePath] = (analysis.byFile[filePath] || 0) + 1;

            // 尝试分析使用上下文
            const context = this.analyzeAnyTypeContext(result, message);
            analysis.byContext[context].push({
              file: filePath,
              line: message.line,
              column: message.column,
              message: message.message
            });

            // 保存示例（最多10个）
            if (analysis.examples.length < 10) {
              analysis.examples.push({
                file: filePath,
                line: message.line,
                column: message.column,
                message: message.message,
                context
              });
            }
          }
        }
      }

      const reportPath = path.join(this.reportsDir, `any-type-analysis-${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));

      spinner.succeed(`Any type report generated: ${reportPath}`);
      return { analysis, reportPath };
    } catch (error) {
      spinner.fail('Failed to analyze any type usage');
      throw error;
    }
  }

  /**
   * 分析any类型使用上下文
   */
  analyzeAnyTypeContext(result, message) {
    const filePath = result.filePath;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const line = lines[message.line - 1] || '';

    // 简单的上下文分析逻辑
    if (line.includes('import') || line.includes('require')) {
      return 'third-party';
    }
    if (line.includes('fetch') || line.includes('response') || line.includes('api')) {
      return 'api-response';
    }
    if (line.includes('_') || line.includes('temp')) {
      return 'temp-vars';
    }
    if (line.includes('TODO') || line.includes('FIXME')) {
      return 'legacy-code';
    }

    return 'unknown';
  }

  /**
   * 回滚到指定备份
   */
  async rollback(backupPath) {
    const spinner = ora('Rolling back changes...').start();

    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupPath}`);
      }

      // 恢复文件
      const files = this.getAllTypeScriptFiles();
      for (const file of files) {
        const relativePath = path.relative(this.projectRoot, file);
        const backupFilePath = path.join(backupPath, relativePath);

        if (fs.existsSync(backupFilePath)) {
          fs.copyFileSync(backupFilePath, file);
        }
      }

      spinner.succeed('Rollback completed');
      return true;
    } catch (error) {
      spinner.fail('Rollback failed');
      throw error;
    }
  }

  /**
   * 主执行函数
   */
  async run(command, options = {}) {
    try {
      switch (command) {
        case 'report':
        case 'analyze':
          return await this.generateReport();

        case 'any-report':
          return await this.generateAnyTypeReport();

        case 'backup':
          return await this.createBackup(options.stage);

        case 'rollback':
          if (!options.backupPath) {
            throw new Error('Backup path required for rollback');
          }
          return await this.rollback(options.backupPath);

        default:
          // 如果是阶段名称
          if (command.startsWith('phase')) {
            return await this.fixPhase(command, options);
          }

          // 如果是类别名称
          const phase = this.config.phases.find(p =>
            p.categories.some(c => c.name === command)
          );

          if (phase) {
            const category = phase.categories.find(c => c.name === command);
            return await this.fixCategory(category, options);
          }

          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const options = {
    dryRun: args.includes('--dry-run'),
    backup: !args.includes('--no-backup'),
    safeMode: args.includes('--safe-mode'),
    excludeTests: args.includes('--exclude-tests'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || undefined,
    stage: args.find(arg => arg.startsWith('--stage='))?.split('=')[1],
    backupPath: args.find(arg => arg.startsWith('--backup='))?.split('=')[1]
  };

  if (!command) {
    console.log(chalk.blue('ESLint Progressive Fixer'));
    console.log('\nUsage:');
    console.log('  node eslint-progressive-fix.js <command> [options]');
    console.log('\nCommands:');
    console.log('  report                    Generate comprehensive ESLint analysis report');
    console.log('  any-report                Analyze any type usage');
    console.log('  backup                    Create backup');
    console.log('  rollback --backup=<path>  Rollback to backup');
    console.log('  <phase-name>              Fix specific phase');
    console.log('  <category-name>           Fix specific category');
    console.log('\nOptions:');
    console.log('  --dry-run                 Show what would be fixed without making changes');
    console.log('  --no-backup              Skip creating backup');
    console.log('  --safe-mode              Enable additional safety checks');
    console.log('  --exclude-tests          Exclude test files from processing');
    console.log('  --batch-size=<number>    Set batch size for processing');
    console.log('  --stage=<name>           Specify stage name for backup');
    console.log('\nExamples:');
    console.log('  node eslint-progressive-fix.js report');
    console.log('  node eslint-progressive-fix.js Phase\\ 1\\ -\\ Blocker\\ Issues');
    console.log('  node eslint-progressive-fix.js syntax-errors --dry-run');
    console.log('  node eslint-progressive-fix.js rollback --backup=.eslint-fix-backups/backup-pre-fix-2025-10-11');
    process.exit(0);
  }

  const fixer = new ESLintProgressiveFixer(options);
  await fixer.run(command, options);
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = ESLintProgressiveFixer;