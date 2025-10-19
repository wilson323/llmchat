#!/usr/bin/env node

/**
 * 多环境类型安全验证工具
 * 针对不同环境进行专门的类型安全检查
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

class MultiEnvironmentValidator {
  constructor(options = {}) {
    this.options = {
      environments: ['development', 'staging', 'production'],
      parallel: true,
      failFast: false,
      outputFormat: 'console',
      outputFile: null,
      ...options
    };

    this.environments = {
      development: {
        name: 'Development',
        strict: false,
        typeCoverage: {
          minimum: 80,
          target: 85
        },
        eslint: {
          maxErrors: 0,
          maxWarnings: 50,
          allowAnyInTests: true
        },
        build: {
          required: false,
          optimization: false
        },
        performance: {
          maxTypeCheckTime: 30000, // 30s
          maxBuildTime: 60000    // 60s
        }
      },
      staging: {
        name: 'Staging',
        strict: true,
        typeCoverage: {
          minimum: 90,
          target: 95
        },
        eslint: {
          maxErrors: 0,
          maxWarnings: 10,
          allowAnyInTests: false
        },
        build: {
          required: true,
          optimization: true
        },
        performance: {
          maxTypeCheckTime: 45000, // 45s
          maxBuildTime: 90000     // 90s
        }
      },
      production: {
        name: 'Production',
        strict: true,
        typeCoverage: {
          minimum: 95,
          target: 98
        },
        eslint: {
          maxErrors: 0,
          maxWarnings: 0,
          allowAnyInTests: false
        },
        build: {
          required: true,
          optimization: true,
          analyze: true
        },
        performance: {
          maxTypeCheckTime: 60000, // 60s
          maxBuildTime: 120000    // 120s
        }
      }
    };

    this.results = {
      summary: {
        totalEnvironments: this.options.environments.length,
        passedEnvironments: 0,
        failedEnvironments: 0,
        overall: false
      },
      environments: {},
      issues: {
        critical: [],
        high: [],
        medium: [],
        low: []
      },
      recommendations: []
    };

    this.startTime = Date.now();
  }

  /**
   * 运行多环境验证
   */
  async run() {
    console.log('🌍 开始多环境类型安全验证...\n');

    try {
      // 1. 准备环境
      await this.prepareEnvironment();

      // 2. 验证各个环境
      if (this.options.parallel) {
        await this.validateEnvironmentsParallel();
      } else {
        await this.validateEnvironmentsSequential();
      }

      // 3. 分析结果
      await this.analyzeResults();

      // 4. 生成报告
      await this.generateReport();

      // 5. 确定总体结果
      const success = this.determineOverallSuccess();

      if (!success) {
        console.log('❌ 多环境验证失败');
        process.exit(1);
      } else {
        console.log('✅ 多环境验证通过');
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ 多环境验证失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 准备环境
   */
  async prepareEnvironment() {
    console.log('🔧 准备验证环境...');

    // 确保依赖已安装
    try {
      execSync('pnpm install --frozen-lockfile', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('依赖安装失败');
    }

    // 创建环境配置目录
    const configDir = join(process.cwd(), '.env-configs');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // 为每个环境创建配置文件
    for (const envName of this.options.environments) {
      const envConfig = this.environments[envName];
      if (!envConfig) {
        console.log(`⚠️ 未知环境: ${envName}，跳过`);
        continue;
      }

      const configFile = join(configDir, `${envName}.config.js`);
      const config = this.generateEnvironmentConfig(envName, envConfig);
      writeFileSync(configFile, config);
    }

    console.log('✅ 环境准备完成\n');
  }

  /**
   * 并行验证环境
   */
  async validateEnvironmentsParallel() {
    console.log('🚀 并行验证环境...');

    const promises = this.options.environments.map(env =>
      this.validateEnvironment(env)
    );

    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const env = this.options.environments[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        this.results.environments[env] = result.value;
        if (result.value.passed) {
          this.results.summary.passedEnvironments++;
        } else {
          this.results.summary.failedEnvironments++;
          if (this.options.failFast) {
            console.log(`❌ 环境 ${env} 验证失败，终止执行`);
            break;
          }
        }
      } else {
        console.log(`❌ 环境 ${env} 验证异常:`, result.reason.message);
        this.results.environments[env] = {
          name: env,
          passed: false,
          error: result.reason.message
        };
        this.results.summary.failedEnvironments++;
      }
    }

    console.log('✅ 并行验证完成\n');
  }

  /**
   * 串行验证环境
   */
  async validateEnvironmentsSequential() {
    console.log('📋 串行验证环境...');

    for (const env of this.options.environments) {
      try {
        const result = await this.validateEnvironment(env);
        this.results.environments[env] = result;

        if (result.passed) {
          this.results.summary.passedEnvironments++;
        } else {
          this.results.summary.failedEnvironments++;
          if (this.options.failFast) {
            console.log(`❌ 环境 ${env} 验证失败，终止执行`);
            break;
          }
        }
      } catch (error) {
        console.log(`❌ 环境 ${env} 验证异常:`, error.message);
        this.results.environments[env] = {
          name: env,
          passed: false,
          error: error.message
        };
        this.results.summary.failedEnvironments++;
      }
    }

    console.log('✅ 串行验证完成\n');
  }

  /**
   * 验证单个环境
   */
  async validateEnvironment(envName) {
    console.log(`🔍 验证 ${envName} 环境...`);

    const envConfig = this.environments[envName];
    if (!envConfig) {
      throw new Error(`未知环境: ${envName}`);
    }

    const result = {
      name: envName,
      displayName: envConfig.name,
      passed: true,
      checks: {
        typescript: { passed: false, errors: 0, warnings: 0, duration: 0 },
        eslint: { passed: false, errors: 0, warnings: 0, duration: 0 },
        typeCoverage: { passed: false, percentage: 0, duration: 0 },
        build: { passed: false, duration: 0, size: 0 }
      },
      issues: [],
      performance: {
        typeCheckTime: 0,
        buildTime: 0
      }
    };

    try {
      // 1. TypeScript检查
      await this.checkTypeScript(envName, envConfig, result);

      // 2. ESLint检查
      await this.checkESLint(envName, envConfig, result);

      // 3. 类型覆盖率检查
      await this.checkTypeCoverage(envName, envConfig, result);

      // 4. 构建检查（如果需要）
      if (envConfig.build.required) {
        await this.checkBuild(envName, envConfig, result);
      }

      // 确定整体状态
      result.passed = result.checks.typescript.passed &&
                       result.checks.eslint.passed &&
                       result.checks.typeCoverage.passed &&
                       (!envConfig.build.required || result.checks.build.passed);

      if (result.passed) {
        console.log(`✅ ${envName} 环境验证通过`);
      } else {
        console.log(`❌ ${envName} 环境验证失败`);
      }

    } catch (error) {
      console.log(`❌ ${envName} 环境验证异常:`, error.message);
      result.passed = false;
      result.error = error.message;
    }

    return result;
  }

  /**
   * TypeScript检查
   */
  async checkTypeScript(envName, envConfig, result) {
    const startTime = Date.now();

    try {
      // 根据环境配置调整TypeScript选项
      const tsConfig = this.generateTypeScriptConfig(envName, envConfig);
      const tsConfigPath = join(process.cwd(), '.env-configs', `${envName}.tsconfig.json`);
      writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));

      // 运行TypeScript检查
      execSync(`npx tsc --project ${tsConfigPath} --noEmit`, {
        stdio: 'pipe',
        timeout: envConfig.performance.maxTypeCheckTime
      });

      result.checks.typescript.passed = true;
      result.checks.typescript.errors = 0;
      result.checks.typescript.warnings = 0;

    } catch (error) {
      result.checks.typescript.passed = false;
      const errorOutput = error.stdout || error.stderr || '';

      // 解析错误数量
      const errorLines = errorOutput.split('\n').filter(line => line.includes('error TS'));
      result.checks.typescript.errors = errorLines.length;

      if (result.checks.typescript.errors > 0) {
        result.issues.push({
          type: 'typescript_error',
          severity: 'critical',
          message: `${result.checks.typescript.errors} TypeScript错误`,
          details: errorOutput
        });
      }
    }

    result.checks.typescript.duration = Date.now() - startTime;
    result.performance.typeCheckTime = result.checks.typescript.duration;
  }

  /**
   * ESLint检查
   */
  async checkESLint(envName, envConfig, result) {
    const startTime = Date.now();

    try {
      // 根据环境配置调整ESLint规则
      const eslintConfig = this.generateESLintConfig(envName, envConfig);
      const eslintConfigPath = join(process.cwd(), '.env-configs', `${envName}.eslintrc.js`);
      writeFileSync(eslintConfigPath, `module.exports = ${JSON.stringify(eslintConfig, null, 2)};`);

      // 运行ESLint检查
      const output = execSync(`npx eslint --config ${eslintConfigPath} src/ --ext .ts,.tsx --format=json`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const eslintResults = JSON.parse(output);
      let errors = 0;
      let warnings = 0;

      for (const file of eslintResults) {
        for (const message of file.messages) {
          if (message.severity === 2) {
            errors++;
          } else {
            warnings++;
          }
        }
      }

      result.checks.eslint.errors = errors;
      result.checks.eslint.warnings = warnings;

      // 检查是否通过阈值
      if (errors <= envConfig.eslint.maxErrors && warnings <= envConfig.eslint.maxWarnings) {
        result.checks.eslint.passed = true;
      } else {
        result.checks.eslint.passed = false;
        result.issues.push({
          type: 'eslint_error',
          severity: errors > 0 ? 'critical' : 'high',
          message: `ESLint: ${errors} 错误, ${warnings} 警告 (限制: ${envConfig.eslint.maxErrors}/${envConfig.eslint.maxWarnings})`
        });
      }

    } catch (error) {
      result.checks.eslint.passed = false;
      const errorOutput = error.stdout || error.stderr || '';

      if (errorOutput.startsWith('[')) {
        const eslintResults = JSON.parse(errorOutput);
        let errors = 0;
        let warnings = 0;

        for (const file of eslintResults) {
          for (const message of file.messages) {
            if (message.severity === 2) {
              errors++;
            } else {
              warnings++;
            }
          }
        }

        result.checks.eslint.errors = errors;
        result.checks.eslint.warnings = warnings;

        if (errors > envConfig.eslint.maxErrors || warnings > envConfig.eslint.maxWarnings) {
          result.issues.push({
            type: 'eslint_error',
            severity: errors > 0 ? 'critical' : 'high',
            message: `ESLint: ${errors} 错误, ${warnings} 警告 (限制: ${envConfig.eslint.maxErrors}/${envConfig.eslint.maxWarnings})`
          });
        }
      } else {
        result.checks.eslint.errors = 1;
        result.issues.push({
          type: 'eslint_error',
          severity: 'critical',
          message: 'ESLint执行失败',
          details: errorOutput
        });
      }
    }

    result.checks.eslint.duration = Date.now() - startTime;
  }

  /**
   * 类型覆盖率检查
   */
  async checkTypeCoverage(envName, envConfig, result) {
    const startTime = Date.now();

    try {
      const output = execSync('pnpm exec type-coverage --detail', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const match = output.match(/(\d+\.\d+)%/);
      const coverage = match ? parseFloat(match[1]) : 0;

      result.checks.typeCoverage.percentage = coverage;

      if (coverage >= envConfig.typeCoverage.minimum) {
        result.checks.typeCoverage.passed = true;
      } else {
        result.checks.typeCoverage.passed = false;
        result.issues.push({
          type: 'coverage_error',
          severity: coverage < 70 ? 'critical' : 'high',
          message: `类型覆盖率 ${coverage}% 低于要求 ${envConfig.typeCoverage.minimum}%`
        });
      }

    } catch (error) {
      result.checks.typeCoverage.passed = false;
      result.checks.typeCoverage.percentage = 0;
      result.issues.push({
        type: 'coverage_error',
        severity: 'critical',
        message: '类型覆盖率检查失败',
        details: error.message
      });
    }

    result.checks.typeCoverage.duration = Date.now() - startTime;
  }

  /**
   * 构建检查
   */
  async checkBuild(envName, envConfig, result) {
    const startTime = Date.now();

    try {
      // 运行构建
      const buildCommand = envConfig.build.optimization ? 'pnpm run build' : 'pnpm run build:dev';

      execSync(buildCommand, {
        stdio: 'pipe',
        timeout: envConfig.performance.maxBuildTime
      });

      // 检查构建产物
      const distPath = join(process.cwd(), 'dist');
      if (existsSync(distPath)) {
        const sizeOutput = execSync(`du -sh ${distPath}`, { encoding: 'utf8' });
        const size = sizeOutput.split('\t')[0];
        result.checks.build.size = size;
      }

      result.checks.build.passed = true;

    } catch (error) {
      result.checks.build.passed = false;
      result.issues.push({
        type: 'build_error',
        severity: 'critical',
        message: '构建失败',
        details: error.message
      });
    }

    result.checks.build.duration = Date.now() - startTime;
    result.performance.buildTime = result.checks.build.duration;
  }

  /**
   * 分析结果
   */
  async analyzeResults() {
    console.log('📊 分析验证结果...');

    // 收集所有问题
    for (const [envName, result] of Object.entries(this.results.environments)) {
      if (result.issues) {
        for (const issue of result.issues) {
          this.results.issues[issue.severity].push({
            ...issue,
            environment: envName
          });
        }
      }
    }

    // 生成总体建议
    this.generateRecommendations();

    console.log('✅ 结果分析完成\n');
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];

    // 基于关键问题生成建议
    if (this.results.issues.critical.length > 0) {
      recommendations.push({
        type: 'critical_issues',
        priority: 'critical',
        message: `发现 ${this.results.issues.critical.length} 个关键问题，需要立即修复`,
        environments: [...new Set(this.results.issues.critical.map(i => i.environment))]
      });
    }

    // 基于环境差异生成建议
    const failingEnvs = Object.entries(this.results.environments)
      .filter(([name, result]) => !result.passed)
      .map(([name]) => name);

    if (failingEnvs.length > 0) {
      recommendations.push({
        type: 'environment_failures',
        priority: 'high',
        message: `以下环境验证失败: ${failingEnvs.join(', ')}`,
        environments: failingEnvs
      });
    }

    // 基于性能问题生成建议
    const slowEnvs = Object.entries(this.results.environments)
      .filter(([name, result]) =>
        result.performance.typeCheckTime > 60000 || result.performance.buildTime > 120000
      )
      .map(([name]) => name);

    if (slowEnvs.length > 0) {
      recommendations.push({
        type: 'performance_issues',
        priority: 'medium',
        message: `以下环境性能较慢: ${slowEnvs.join(', ')}`,
        environments: slowEnvs
      });
    }

    this.results.recommendations = recommendations;
  }

  /**
   * 生成报告
   */
  async generateReport() {
    console.log('📄 生成多环境验证报告...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      environments: this.results.environments,
      issues: this.results.issues,
      recommendations: this.results.recommendations,
      duration: Date.now() - this.startTime
    };

    // 保存报告
    const reportPath = join(process.cwd(), '.multi-env-validation-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 如果指定了输出文件，也保存一份
    if (this.options.outputFile) {
      if (this.options.outputFormat === 'json') {
        writeFileSync(this.options.outputFile, JSON.stringify(report, null, 2));
      } else if (this.options.outputFormat === 'markdown') {
        writeFileSync(this.options.outputFile, this.generateMarkdownReport(report));
      }
    }

    // 显示摘要
    this.displaySummary(report);

    console.log('✅ 报告生成完成\n');
  }

  /**
   * 显示摘要
   */
  displaySummary(report) {
    console.log('📊 多环境类型安全验证摘要');
    console.log('='.repeat(50));
    console.log(`验证时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);
    console.log(`环境数量: ${report.summary.totalEnvironments}`);
    console.log(`通过环境: ${report.summary.passedEnvironments}`);
    console.log(`失败环境: ${report.summary.failedEnvironments}`);
    console.log(`总体状态: ${report.summary.overall ? '✅ 通过' : '❌ 失败'}`);
    console.log(`验证耗时: ${(report.duration / 1000).toFixed(2)}s`);

    // 按环境显示结果
    console.log('\n📋 环境验证结果:');
    for (const [envName, result] of Object.entries(report.environments)) {
      const status = result.passed ? '✅' : '❌';
      const perfInfo = `TypeCheck: ${(result.performance.typeCheckTime / 1000).toFixed(1)}s`;
      console.log(`  ${status} ${result.displayName || envName} - ${perfInfo}`);

      if (result.issues && result.issues.length > 0) {
        result.issues.slice(0, 2).forEach(issue => {
          console.log(`    - ${issue.type}: ${issue.message}`);
        });
      }
    }

    // 显示关键问题
    if (report.issues.critical.length > 0) {
      console.log('\n🚨 关键问题:');
      report.issues.critical.slice(0, 3).forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.environment}] ${issue.message}`);
      });
    }

    // 显示建议
    if (report.recommendations.length > 0) {
      console.log('\n💡 建议:');
      report.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }

    console.log('='.repeat(50));
  }

  /**
   * 确定总体成功状态
   */
  determineOverallSuccess() {
    this.results.summary.overall = this.results.summary.failedEnvironments === 0;
    return this.results.summary.overall;
  }

  /**
   * 生成环境配置
   */
  generateEnvironmentConfig(envName, envConfig) {
    return {
      mode: envName,
      strict: envConfig.strict,
      typeCoverage: envConfig.typeCoverage.minimum,
      eslint: envConfig.eslint,
      build: envConfig.build,
      performance: envConfig.performance
    };
  }

  /**
   * 生成TypeScript配置
   */
  generateTypeScriptConfig(envName, envConfig) {
    const baseConfig = {
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        baseUrl: "./src",
        paths: {
          "@/*": ["./*"],
          "@/components/*": ["components/*"],
          "@/hooks/*": ["hooks/*"],
          "@/store/*": ["store/*"],
          "@/services/*": ["services/*"],
          "@/types/*": ["types/*"],
          "@/utils/*": ["utils/*"]
        }
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist", "build"]
    };

    // 根据环境调整严格性
    if (envConfig.strict) {
      baseConfig.compilerOptions.strict = true;
      baseConfig.compilerOptions.exactOptionalPropertyTypes = true;
      baseConfig.compilerOptions.noImplicitReturns = true;
      baseConfig.compilerOptions.noUncheckedIndexedAccess = true;
      baseConfig.compilerOptions.noUnusedLocals = true;
      baseConfig.compilerOptions.noUnusedParameters = true;
    } else {
      baseConfig.compilerOptions.strict = false;
      baseConfig.compilerOptions.noImplicitAny = true;
    }

    return baseConfig;
  }

  /**
   * 生成ESLint配置
   */
  generateESLintConfig(envName, envConfig) {
    const baseConfig = {
      extends: [
        '@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking'
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      plugins: ['@typescript-eslint'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/prefer-const': 'error'
      },
      overrides: []
    };

    // 根据环境调整规则
    if (envConfig.eslint.allowAnyInTests) {
      baseConfig.overrides.push({
        files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
        rules: {
          '@typescript-eslint/no-explicit-any': 'off'
        }
      });
    }

    if (envConfig.eslint.maxWarnings === 0) {
      // 警告级别的问题也视为错误
      Object.keys(baseConfig.rules).forEach(rule => {
        if (baseConfig.rules[rule] === 'warn') {
          baseConfig.rules[rule] = 'error';
        }
      });
    }

    return baseConfig;
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport(report) {
    let markdown = `# 多环境类型安全验证报告\n\n`;
    markdown += `**验证时间**: ${new Date(report.timestamp).toLocaleString('zh-CN')}\n`;
    markdown += `**环境数量**: ${report.summary.totalEnvironments}\n`;
    markdown += `**通过环境**: ${report.summary.passedEnvironments}\n`;
    markdown += `**失败环境**: ${report.summary.failedEnvironments}\n`;
    markdown += `**总体状态**: ${report.summary.overall ? '✅ 通过' : '❌ 失败'}\n\n`;

    markdown += `## 📋 环境验证结果\n\n`;

    for (const [envName, result] of Object.entries(report.environments)) {
      const status = result.passed ? '✅' : '❌';
      markdown += `### ${status} ${result.displayName || envName}\n\n`;

      markdown += `| 检查项 | 状态 | 详情 |\n`;
      markdown += `|--------|------|------|\n`;

      markdown += `| TypeScript | ${result.checks.typescript.passed ? '✅' : '❌'} | ${result.checks.typescript.errors} 错误 |\n`;
      markdown += `| ESLint | ${result.checks.eslint.passed ? '✅' : '❌'} | ${result.checks.eslint.errors} 错误, ${result.checks.eslint.warnings} 警告 |\n`;
      markdown += `| 类型覆盖率 | ${result.checks.typeCoverage.passed ? '✅' : '❌'} | ${result.checks.typeCoverage.percentage}% |\n`;

      if (result.checks.build.duration > 0) {
        markdown += `| 构建 | ${result.checks.build.passed ? '✅' : '❌'} | ${(result.checks.build.duration / 1000).toFixed(1)}s${result.checks.build.size ? `, ${result.checks.build.size}` : ''} |\n`;
      }

      markdown += `\n`;
    }

    if (report.recommendations.length > 0) {
      markdown += `## 💡 建议\n\n`;
      report.recommendations.forEach((rec, index) => {
        markdown += `${index + 1}. **[${rec.priority.toUpperCase()}]** ${rec.message}\n`;
        if (rec.environments) {
          markdown += `   - 影响环境: ${rec.environments.join(', ')}\n`;
        }
        markdown += `\n`;
      });
    }

    return markdown;
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--env':
        options.environments = args[++i].split(',');
        break;
      case '--sequential':
        options.parallel = false;
        break;
      case '--fail-fast':
        options.failFast = true;
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--format':
        options.outputFormat = args[++i];
        break;
      case '--help':
        console.log(`
多环境类型安全验证工具

用法: node multi-env-validator.js [选项]

选项:
  --env <env1,env2>     指定要验证的环境 (默认: development,staging,production)
  --sequential          串行执行（默认并行）
  --fail-fast           遇到失败时立即停止
  --output <file>       输出报告到文件
  --format <format>     报告格式 (console|json|markdown)
  --help                显示帮助信息

示例:
  node multi-env-validator.js
  node multi-env-validator.js --env staging,production
  node multi-env-validator.js --sequential --fail-fast
  node multi-env-validator.js --output report.md --format markdown
        `);
        process.exit(0);
    }
  }

  const validator = new MultiEnvironmentValidator(options);
  validator.run();
}

module.exports = MultiEnvironmentValidator;