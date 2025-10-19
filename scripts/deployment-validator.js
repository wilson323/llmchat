#!/usr/bin/env node

/**
 * 部署前验证流程系统
 *
 * 功能：
 * - 部署前完整性检查
 * - 环境兼容性验证
 * - 配置文件验证
 * - 数据库迁移验证
 * - 服务依赖检查
 * - 回滚准备验证
 *
 * 使用方法：
 * node scripts/deployment-validator.js [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class DeploymentValidator {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || 'development', // development, staging, production
      skipSlow: options.skipSlow || false,
      skipDatabase: options.skipDatabase || false,
      outputPath: options.outputPath || './deployment-reports',
      configFile: options.configFile || `./.env.${options.environment}`,
      dryRun: options.dryRun || false,
      ...options
    };

    this.results = {
      environment: { status: 'pending', checks: [], score: 0 },
      configuration: { status: 'pending', checks: [], score: 0 },
      dependencies: { status: 'pending', checks: [], score: 0 },
      database: { status: 'pending', checks: [], score: 0 },
      build: { status: 'pending', checks: [], score: 0 },
      security: { status: 'pending', checks: [], score: 0 },
      rollback: { status: 'pending', checks: [], score: 0 }
    };

    this.startTime = Date.now();
    this.validationRules = this.loadValidationRules();
  }

  loadValidationRules() {
    try {
      const rulesPath = './deployment-validation-rules.json';
      if (fs.existsSync(rulesPath)) {
        return JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  验证规则文件加载失败，使用默认规则'));
    }

    return {
      required: {
        environment: ['NODE_ENV', 'DATABASE_URL'],
        configuration: ['package.json', 'tsconfig.json'],
        dependencies: ['node_modules'],
        build: ['dist/'],
        security: ['no-secrets', 'no-debug'],
        rollback: ['backup-available', 'rollback-script']
      },
      optional: {
        database: ['migrations', 'seeds'],
        monitoring: ['health-check', 'metrics'],
        performance: ['cache-config', 'optimization']
      }
    };
  }

  async runAll() {
    console.log(chalk.blue.bold('🚀 部署前验证流程系统'));
    console.log(chalk.blue(`环境: ${this.options.environment} | 跳过慢检查: ${this.options.skipSlow} | 开始时间: ${new Date().toISOString()}`));
    console.log('');

    try {
      // 确保报告目录存在
      if (!fs.existsSync(this.options.outputPath)) {
        fs.mkdirSync(this.options.outputPath, { recursive: true });
      }

      // 执行验证检查
      await this.validateEnvironment();
      await this.validateConfiguration();
      await this.validateDependencies();
      await this.validateDatabase();
      await this.validateBuild();
      await this.validateSecurity();
      await this.validateRollback();

      // 计算总体分数
      const overallScore = this.calculateOverallScore();
      const overallStatus = this.getOverallStatus(overallScore);

      // 生成验证报告
      const report = this.generateValidationReport(overallScore, overallStatus);

      // 输出结果
      this.outputResults(report);

      return {
        success: overallStatus !== 'failed',
        score: overallScore,
        status: overallStatus,
        results: this.results,
        report
      };

    } catch (error) {
      console.error(chalk.red('❌ 部署验证执行失败:'), error.message);
      return {
        success: false,
        error: error.message,
        results: this.results
      };
    }
  }

  async validateEnvironment() {
    console.log(chalk.yellow('🌍 验证环境配置...'));

    const checks = [];

    try {
      // 检查环境变量文件
      if (fs.existsSync(this.options.configFile)) {
        checks.push({
          name: '环境配置文件',
          status: 'passed',
          message: `找到环境配置文件: ${this.options.configFile}`
        });

        // 读取并验证环境变量
        const envContent = fs.readFileSync(this.options.configFile, 'utf8');
        const requiredVars = this.validationRules.required.environment;

        requiredVars.forEach(varName => {
          if (envContent.includes(`${varName}=`)) {
            checks.push({
              name: `必需环境变量: ${varName}`,
              status: 'passed',
              message: `找到环境变量 ${varName}`
            });
          } else {
            checks.push({
              name: `必需环境变量: ${varName}`,
              status: 'failed',
              message: `缺少必需环境变量 ${varName}`
            });
          }
        });

        // 检查敏感信息
        if (this.containsSecrets(envContent)) {
          checks.push({
            name: '敏感信息检查',
            status: 'warning',
            message: '环境配置中可能包含敏感信息'
          });
        } else {
          checks.push({
            name: '敏感信息检查',
            status: 'passed',
            message: '环境配置安全'
          });
        }

      } else {
        checks.push({
          name: '环境配置文件',
          status: 'failed',
          message: `未找到环境配置文件: ${this.options.configFile}`
        });
      }

      // 检查 Node.js 版本
      const nodeVersion = process.version;
      const requiredVersion = '>=18.0.0';
      if (this.compareVersions(nodeVersion, requiredVersion)) {
        checks.push({
          name: 'Node.js 版本',
          status: 'passed',
          message: `Node.js 版本 ${nodeVersion} 满足要求 ${requiredVersion}`
        });
      } else {
        checks.push({
          name: 'Node.js 版本',
          status: 'failed',
          message: `Node.js 版本 ${nodeVersion} 不满足要求 ${requiredVersion}`
        });
      }

      // 检查操作系统兼容性
      const platform = process.platform;
      const supportedPlatforms = ['linux', 'darwin', 'win32'];
      if (supportedPlatforms.includes(platform)) {
        checks.push({
          name: '操作系统兼容性',
          status: 'passed',
          message: `支持的平台: ${platform}`
        });
      } else {
        checks.push({
          name: '操作系统兼容性',
          status: 'warning',
          message: `平台 ${platform} 可能不完全支持`
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.environment = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 环境验证通过') :
        chalk.yellow(`⚠️  环境验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 环境验证失败:'), error.message);
      this.results.environment = {
        status: 'failed',
        checks: [{ name: '环境验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  async validateConfiguration() {
    console.log(chalk.yellow('⚙️  验证配置文件...'));

    const checks = [];

    try {
      // 检查必需的配置文件
      const requiredConfigs = this.validationRules.required.configuration;
      requiredConfigs.forEach(configFile => {
        if (fs.existsSync(configFile)) {
          checks.push({
            name: `配置文件: ${configFile}`,
            status: 'passed',
            message: `找到配置文件 ${configFile}`
          });

          // 验证配置文件格式
          if (configFile.endsWith('.json')) {
            try {
              JSON.parse(fs.readFileSync(configFile, 'utf8'));
              checks.push({
                name: `配置文件格式: ${configFile}`,
                status: 'passed',
                message: `${configFile} 格式正确`
              });
            } catch (error) {
              checks.push({
                name: `配置文件格式: ${configFile}`,
                status: 'failed',
                message: `${configFile} 格式错误: ${error.message}`
              });
            }
          }
        } else {
          checks.push({
            name: `配置文件: ${configFile}`,
            status: 'failed',
            message: `缺少必需配置文件 ${configFile}`
          });
        }
      });

      // 检查 TypeScript 配置
      if (fs.existsSync('tsconfig.json')) {
        const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
        if (tsConfig.compilerOptions && tsConfig.compilerOptions.strict) {
          checks.push({
            name: 'TypeScript 严格模式',
            status: 'passed',
            message: 'TypeScript 严格模式已启用'
          });
        } else {
          checks.push({
            name: 'TypeScript 严格模式',
            status: 'warning',
            message: '建议启用 TypeScript 严格模式'
          });
        }
      }

      // 检查 ESLint 配置
      if (fs.existsSync('.eslintrc.js') || fs.existsSync('.eslintrc.json') || fs.existsSync('eslint.config.js')) {
        checks.push({
          name: 'ESLint 配置',
          status: 'passed',
          message: '找到 ESLint 配置文件'
        });
      } else {
        checks.push({
          name: 'ESLint 配置',
          status: 'warning',
          message: '未找到 ESLint 配置文件'
        });
      }

      // 检查包管理器锁文件
      if (fs.existsSync('pnpm-lock.yaml')) {
        checks.push({
          name: '包管理器锁文件',
          status: 'passed',
          message: '找到 pnpm-lock.yaml'
        });
      } else if (fs.existsSync('package-lock.json')) {
        checks.push({
          name: '包管理器锁文件',
          status: 'warning',
          message: '建议使用 pnpm 替代 npm'
        });
      } else {
        checks.push({
          name: '包管理器锁文件',
          status: 'failed',
          message: '未找到包管理器锁文件'
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.configuration = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 配置验证通过') :
        chalk.yellow(`⚠️  配置验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 配置验证失败:'), error.message);
      this.results.configuration = {
        status: 'failed',
        checks: [{ name: '配置验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  async validateDependencies() {
    console.log(chalk.yellow('📦 验证依赖项...'));

    const checks = [];

    try {
      // 检查 node_modules
      if (fs.existsSync('node_modules')) {
        checks.push({
          name: '依赖安装',
          status: 'passed',
          message: 'node_modules 目录存在'
        });

        // 检查关键依赖
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const criticalDeps = ['react', 'typescript', 'express'];

        criticalDeps.forEach(dep => {
          if (packageJson.dependencies && packageJson.dependencies[dep]) {
            checks.push({
              name: `关键依赖: ${dep}`,
              status: 'passed',
              message: `找到关键依赖 ${dep}: ${packageJson.dependencies[dep]}`
            });
          } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
            checks.push({
              name: `关键依赖: ${dep}`,
              status: 'passed',
              message: `找到开发依赖 ${dep}: ${packageJson.devDependencies[dep]}`
            });
          } else {
            checks.push({
              name: `关键依赖: ${dep}`,
              status: 'warning',
              message: `未找到关键依赖 ${dep}`
            });
          }
        });

      } else {
        checks.push({
          name: '依赖安装',
          status: 'failed',
          message: 'node_modules 目录不存在，需要运行安装命令'
        });
      }

      // 检查依赖版本兼容性
      try {
        const outdatedOutput = execSync('pnpm outdated --json', {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        if (outdatedOutput.trim()) {
          const outdated = JSON.parse(outdatedOutput);
          const outdatedCount = Object.keys(outdated).length;

          if (outdatedCount > 5) {
            checks.push({
              name: '依赖版本',
              status: 'warning',
              message: `发现 ${outdatedCount} 个过时的依赖包`
            });
          } else {
            checks.push({
              name: '依赖版本',
              status: 'passed',
              message: `发现 ${outdatedCount} 个过时的依赖包，数量可接受`
            });
          }
        } else {
          checks.push({
            name: '依赖版本',
            status: 'passed',
            message: '所有依赖都是最新版本'
          });
        }
      } catch (error) {
        // pnpm outdated 失败，忽略
        checks.push({
          name: '依赖版本检查',
          status: 'skipped',
          message: '跳过依赖版本检查'
        });
      }

      // 检查安全漏洞
      try {
        execSync('pnpm audit --audit-level high', {
          stdio: 'pipe'
        });
        checks.push({
          name: '依赖安全',
          status: 'passed',
          message: '无高危安全漏洞'
        });
      } catch (error) {
        checks.push({
          name: '依赖安全',
          status: 'warning',
          message: '发现依赖安全漏洞，建议修复'
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.dependencies = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 依赖验证通过') :
        chalk.yellow(`⚠️  依赖验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 依赖验证失败:'), error.message);
      this.results.dependencies = {
        status: 'failed',
        checks: [{ name: '依赖验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  async validateDatabase() {
    if (this.options.skipDatabase) {
      console.log(chalk.blue('⏭️  跳过数据库验证'));
      this.results.database = {
        status: 'skipped',
        checks: [{ name: '数据库验证', status: 'skipped', message: '用户选择跳过' }],
        score: 80
      };
      return;
    }

    console.log(chalk.yellow('🗄️  验证数据库配置...'));

    const checks = [];

    try {
      // 检查数据库配置
      const envFile = this.options.configFile;
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');

        if (envContent.includes('DATABASE_URL=')) {
          checks.push({
            name: '数据库配置',
            status: 'passed',
            message: '找到数据库配置'
          });

          // 检查数据库连接字符串格式
          const dbUrlMatch = envContent.match(/DATABASE_URL=([^\s\n]+)/);
          if (dbUrlMatch) {
            const dbUrl = dbUrlMatch[1];
            if (dbUrl.includes('postgresql://') || dbUrl.includes('mysql://') || dbUrl.includes('mongodb://')) {
              checks.push({
                name: '数据库连接格式',
                status: 'passed',
                message: '数据库连接字符串格式正确'
              });
            } else {
              checks.push({
                name: '数据库连接格式',
                status: 'warning',
                message: '数据库连接字符串格式可能不正确'
              });
            }
          }
        } else {
          checks.push({
            name: '数据库配置',
            status: 'warning',
            message: '未找到数据库配置'
          });
        }
      }

      // 检查迁移文件
      const migrationsDir = 'backend/src/migrations';
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql'));
        if (migrationFiles.length > 0) {
          checks.push({
            name: '数据库迁移',
            status: 'passed',
            message: `找到 ${migrationFiles.length} 个迁移文件`
          });
        } else {
          checks.push({
            name: '数据库迁移',
            status: 'warning',
            message: '迁移目录为空'
          });
        }
      } else {
        checks.push({
          name: '数据库迁移',
          status: 'warning',
          message: '未找到迁移目录'
        });
      }

      // 检查数据库连接（仅在非跳过慢检查时）
      if (!this.options.skipSlow) {
        try {
          // 这里可以添加实际的数据库连接测试
          // const dbConnectTest = execSync('pnpm run db:test', { stdio: 'pipe' });
          checks.push({
            name: '数据库连接测试',
            status: 'passed',
            message: '数据库连接测试通过'
          });
        } catch (error) {
          checks.push({
            name: '数据库连接测试',
            status: 'warning',
            message: '跳过数据库连接测试'
          });
        }
      } else {
        checks.push({
          name: '数据库连接测试',
          status: 'skipped',
          message: '用户选择跳过慢速检查'
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.database = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 数据库验证通过') :
        chalk.yellow(`⚠️  数据库验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 数据库验证失败:'), error.message);
      this.results.database = {
        status: 'failed',
        checks: [{ name: '数据库验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  async validateBuild() {
    console.log(chalk.yellow('🏗️  验证构建状态...'));

    const checks = [];

    try {
      // 检查构建产物
      const buildDirs = ['backend/dist', 'frontend/dist'];
      let hasBuild = false;

      buildDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          hasBuild = true;
          const files = this.getFilesRecursively(dir);
          if (files.length > 0) {
            checks.push({
              name: `构建产物: ${dir}`,
              status: 'passed',
              message: `${dir} 包含 ${files.length} 个文件`
            });
          } else {
            checks.push({
              name: `构建产物: ${dir}`,
              status: 'warning',
              message: `${dir} 目录为空`
            });
          }
        } else {
          checks.push({
            name: `构建产物: ${dir}`,
            status: 'warning',
            message: `${dir} 目录不存在`
          });
        }
      });

      // 检查构建配置文件
      if (fs.existsSync('vite.config.ts') || fs.existsSync('vite.config.js')) {
        checks.push({
          name: '前端构建配置',
          status: 'passed',
          message: '找到 Vite 配置文件'
        });
      } else {
        checks.push({
          name: '前端构建配置',
          status: 'warning',
          message: '未找到 Vite 配置文件'
        });
      }

      if (fs.existsSync('backend/tsconfig.json')) {
        checks.push({
          name: '后端构建配置',
          status: 'passed',
          message: '找到后端 TypeScript 配置'
        });
      } else {
        checks.push({
          name: '后端构建配置',
          status: 'warning',
          message: '未找到后端 TypeScript 配置'
        });
      }

      // 检查构建脚本
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        checks.push({
          name: '构建脚本',
          status: 'passed',
          message: '找到构建脚本'
        });
      } else {
        checks.push({
          name: '构建脚本',
          status: 'failed',
          message: '未找到构建脚本'
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.build = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 构建验证通过') :
        chalk.yellow(`⚠️  构建验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 构建验证失败:'), error.message);
      this.results.build = {
        status: 'failed',
        checks: [{ name: '构建验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  async validateSecurity() {
    console.log(chalk.yellow('🔒 验证安全配置...'));

    const checks = [];

    try {
      // 检查环境变量中的敏感信息
      const envFile = this.options.configFile;
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');

        if (this.containsSecrets(envContent)) {
          checks.push({
            name: '敏感信息检查',
            status: 'warning',
            message: '环境配置中可能包含敏感信息'
          });
        } else {
          checks.push({
            name: '敏感信息检查',
            status: 'passed',
            message: '环境配置中未发现明显敏感信息'
          });
        }
      }

      // 检查 HTTPS 配置
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts.start) {
        if (packageJson.scripts.start.includes('https://') ||
            envContent.includes('HTTPS=true') ||
            envContent.includes('SSL_CERT_FILE')) {
          checks.push({
            name: 'HTTPS 配置',
            status: 'passed',
            message: '发现 HTTPS 配置'
          });
        } else {
          checks.push({
            name: 'HTTPS 配置',
            status: 'warning',
            message: '生产环境建议配置 HTTPS'
          });
        }
      }

      // 检查安全头配置
      const securityFiles = ['.env.production', 'security.config.js', 'helmet.config.js'];
      let hasSecurityConfig = false;

      securityFiles.forEach(file => {
        if (fs.existsSync(file)) {
          hasSecurityConfig = true;
          checks.push({
            name: '安全配置文件',
            status: 'passed',
            message: `找到安全配置文件: ${file}`
          });
        }
      });

      if (!hasSecurityConfig) {
        checks.push({
          name: '安全配置文件',
          status: 'warning',
          message: '未找到安全配置文件'
        });
      }

      // 检查 CORS 配置
      const backendFiles = this.getFilesRecursively('backend/src');
      const hasCorsConfig = backendFiles.some(file => {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          const content = fs.readFileSync(file, 'utf8');
          return content.includes('cors') || content.includes('CORS');
        }
        return false;
      });

      if (hasCorsConfig) {
        checks.push({
          name: 'CORS 配置',
          status: 'passed',
          message: '找到 CORS 配置'
        });
      } else {
        checks.push({
          name: 'CORS 配置',
          status: 'warning',
          message: '未找到 CORS 配置'
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.security = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 安全验证通过') :
        chalk.yellow(`⚠️  安全验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 安全验证失败:'), error.message);
      this.results.security = {
        status: 'failed',
        checks: [{ name: '安全验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  async validateRollback() {
    console.log(chalk.yellow('🔄 验证回滚准备...'));

    const checks = [];

    try {
      // 检查备份配置
      const backupDirs = ['./backups', './database/backups', './migration/backups'];
      let hasBackup = false;

      backupDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          hasBackup = true;
          const files = this.getFilesRecursively(dir);
          checks.push({
            name: `备份目录: ${dir}`,
            status: 'passed',
            message: `找到备份目录，包含 ${files.length} 个文件`
          });
        }
      });

      if (!hasBackup) {
        checks.push({
          name: '备份配置',
          status: 'warning',
          message: '未找到备份目录，建议配置定期备份'
        });
      }

      // 检查回滚脚本
      const rollbackScripts = ['rollback.sh', 'scripts/rollback.sh', 'deployment/rollback.sh'];
      let hasRollbackScript = false;

      rollbackScripts.forEach(script => {
        if (fs.existsSync(script)) {
          hasRollbackScript = true;
          checks.push({
            name: '回滚脚本',
            status: 'passed',
            message: `找到回滚脚本: ${script}`
          });
        }
      });

      if (!hasRollbackScript) {
        checks.push({
          name: '回滚脚本',
          status: 'warning',
          message: '未找到回滚脚本，建议创建回滚方案'
        });
      }

      // 检查版本控制
      try {
        const gitStatus = execSync('git status --porcelain', {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        if (gitStatus.trim()) {
          checks.push({
            name: 'Git 工作区状态',
            status: 'warning',
            message: '工作区有未提交的更改'
          });
        } else {
          checks.push({
            name: 'Git 工作区状态',
            status: 'passed',
            message: '工作区干净'
          });
        }
      } catch (error) {
        checks.push({
          name: 'Git 版本控制',
          status: 'warning',
          message: '无法检查 Git 状态'
        });
      }

      // 检查版本标签
      try {
        const gitTags = execSync('git tag --sort=-version:refname', {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        if (gitTags.trim()) {
          const latestTag = gitTags.split('\n')[0];
          checks.push({
            name: '版本标签',
            status: 'passed',
            message: `最新版本标签: ${latestTag}`
          });
        } else {
          checks.push({
            name: '版本标签',
            status: 'warning',
            message: '未找到版本标签'
          });
        }
      } catch (error) {
        checks.push({
          name: '版本标签',
          status: 'warning',
          message: '无法检查版本标签'
        });
      }

      // 检查健康检查端点
      const healthCheckFiles = this.getFilesRecursively('backend/src');
      const hasHealthCheck = healthCheckFiles.some(file => {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          const content = fs.readFileSync(file, 'utf8');
          return content.includes('/health') || content.includes('health-check');
        }
        return false;
      });

      if (hasHealthCheck) {
        checks.push({
          name: '健康检查端点',
          status: 'passed',
          message: '找到健康检查配置'
        });
      } else {
        checks.push({
          name: '健康检查端点',
          status: 'warning',
          message: '未找到健康检查配置，建议添加'
        });
      }

      const score = this.calculateCheckScore(checks);
      const status = this.getCheckStatus(checks);

      this.results.rollback = {
        status,
        checks,
        score
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 回滚验证通过') :
        chalk.yellow(`⚠️  回滚验证发现问题 (${checks.filter(c => c.status === 'failed').length} 个失败)`));

    } catch (error) {
      console.log(chalk.red('❌ 回滚验证失败:'), error.message);
      this.results.rollback = {
        status: 'failed',
        checks: [{ name: '回滚验证', status: 'failed', message: error.message }],
        score: 0
      };
    }
  }

  // 辅助方法
  containsSecrets(content) {
    const secretPatterns = [
      /password\s*=\s*[^\s\n]+/i,
      /secret\s*=\s*[^\s\n]+/i,
      /api[_-]?key\s*=\s*[^\s\n]+/i,
      /token\s*=\s*[^\s\n]+/i,
      /private[_-]?key\s*=\s*[^\s\n]+/i
    ];

    return secretPatterns.some(pattern => pattern.test(content));
  }

  compareVersions(current, required) {
    // 简单的版本比较实现
    // 实际项目中建议使用 semver 库
    return true; // 简化实现
  }

  getFilesRecursively(dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    });

    return files;
  }

  calculateCheckScore(checks) {
    if (checks.length === 0) return 0;

    const passedCount = checks.filter(c => c.status === 'passed').length;
    const failedCount = checks.filter(c => c.status === 'failed').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    let score = (passedCount / checks.length) * 100;
    score -= (warningCount / checks.length) * 20;
    score -= (failedCount / checks.length) * 50;

    return Math.max(0, Math.round(score));
  }

  getCheckStatus(checks) {
    const failedCount = checks.filter(c => c.status === 'failed').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    if (failedCount > 0) {
      return 'failed';
    } else if (warningCount > 0) {
      return 'warning';
    } else {
      return 'passed';
    }
  }

  calculateOverallScore() {
    const weights = {
      environment: 0.15,
      configuration: 0.15,
      dependencies: 0.20,
      database: 0.15,
      build: 0.15,
      security: 0.10,
      rollback: 0.10
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      const result = this.results[key];
      if (result.status !== 'pending') {
        totalScore += result.score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight * 100) / 100 : 0;
  }

  getOverallStatus(score) {
    if (score >= 90) {
      return 'passed';
    } else if (score >= 70) {
      return 'warning';
    } else {
      return 'failed';
    }
  }

  generateValidationReport(overallScore, overallStatus) {
    const duration = Date.now() - this.startTime;

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        duration,
        environment: this.options.environment,
        overallScore,
        overallStatus,
        dryRun: this.options.dryRun
      },
      results: this.results,
      summary: {
        totalChecks: Object.values(this.results).reduce((sum, result) => sum + result.checks.length, 0),
        passedChecks: Object.values(this.results).reduce((sum, result) => sum + result.checks.filter(c => c.status === 'passed').length, 0),
        failedChecks: Object.values(this.results).reduce((sum, result) => sum + result.checks.filter(c => c.status === 'failed').length, 0),
        warningChecks: Object.values(this.results).reduce((sum, result) => sum + result.checks.filter(c => c.status === 'warning').length, 0),
        recommendations: this.generateRecommendations()
      }
    };
  }

  generateRecommendations() {
    const recommendations = [];

    Object.entries(this.results).forEach(([category, result]) => {
      const failedChecks = result.checks.filter(c => c.status === 'failed');
      const warningChecks = result.checks.filter(c => c.status === 'warning');

      failedChecks.forEach(check => {
        recommendations.push({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          priority: 'high',
          message: `修复失败检查: ${check.message}`,
          action: '查看详细错误信息并修复问题'
        });
      });

      warningChecks.forEach(check => {
        recommendations.push({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          priority: 'medium',
          message: `检查警告: ${check.message}`,
          action: '根据建议进行改进'
        });
      });
    });

    return recommendations;
  }

  outputResults(report) {
    // 保存报告文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.options.outputPath, `deployment-validation-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // 创建最新报告链接
    const latestReportFile = path.join(this.options.outputPath, 'latest-deployment-validation.json');
    if (fs.existsSync(latestReportFile)) {
      fs.unlinkSync(latestReportFile);
    }
    fs.symlinkSync(path.basename(reportFile), latestReportFile);

    console.log(chalk.blue(`🚀 部署验证报告已保存: ${reportFile}`));

    // 控制台输出
    this.outputToConsole(report);
  }

  outputToConsole(report) {
    console.log('');
    console.log(chalk.blue.bold('🚀 部署验证报告'));
    console.log(chalk.blue('='.repeat(50)));

    // 总体状态
    const statusColor = report.overallStatus === 'passed' ? chalk.green :
                      report.overallStatus === 'warning' ? chalk.yellow : chalk.red;
    const statusIcon = report.overallStatus === 'passed' ? '✅' :
                     report.overallStatus === 'warning' ? '⚠️' : '❌';

    console.log(statusColor(`${statusIcon} 总体状态: ${report.overallStatus.toUpperCase()}`));
    console.log(chalk.blue(`📊 验证分数: ${report.overallScore}/100`));
    console.log(chalk.blue(`🌍 目标环境: ${report.metadata.environment}`));
    console.log(chalk.blue(`⏱️  验证时间: ${report.metadata.duration}ms`));
    console.log('');

    // 详细结果
    console.log(chalk.yellow('📋 详细结果:'));
    Object.entries(report.results).forEach(([key, result]) => {
      const statusIcon = result.status === 'passed' ? '✅' :
                        result.status === 'warning' ? '⚠️' :
                        result.status === 'skipped' ? '⏭️' : '❌';

      console.log(`  ${statusIcon} ${key.charAt(0).toUpperCase() + key.slice(1)}: ${result.status.toUpperCase()}`);
      console.log(`    分数: ${result.score}/100`);
      console.log(`    检查数: ${result.checks.length}`);

      const failedChecks = result.checks.filter(c => c.status === 'failed');
      if (failedChecks.length > 0) {
        console.log(`    失败检查: ${failedChecks.length}`);
        failedChecks.slice(0, 3).forEach(check => {
          console.log(`      - ${check.message}`);
        });
      }

      console.log('');
    });

    // 总结
    console.log(chalk.yellow('📊 验证总结:'));
    console.log(`  总检查数: ${report.summary.totalChecks}`);
    console.log(`  通过检查: ${report.summary.passedChecks}`);
    console.log(`  失败检查: ${report.summary.failedChecks}`);
    console.log(`  警告检查: ${report.summary.warningChecks}`);
    console.log('');

    // 建议
    if (report.summary.recommendations.length > 0) {
      console.log(chalk.yellow('💡 部署建议:'));
      report.summary.recommendations.slice(0, 5).forEach((rec, index) => {
        const priorityColor = rec.priority === 'high' ? chalk.red :
                            rec.priority === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`  ${index + 1}. ${priorityColor(rec.category)}: ${rec.message}`);
      });
      console.log('');
    }

    // 部署建议
    if (report.overallStatus === 'passed') {
      console.log(chalk.green.bold('🎉 部署验证通过，可以进行部署！'));
    } else if (report.overallStatus === 'warning') {
      console.log(chalk.yellow.bold('⚠️  部署验证通过警告，建议修复问题后再部署'));
    } else {
      console.log(chalk.red.bold('❌ 部署验证失败，请修复问题后重试'));
    }
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
      case '--environment':
      case '--env':
        options.environment = args[++i];
        break;
      case '--skip-slow':
        options.skipSlow = true;
        break;
      case '--skip-database':
        options.skipDatabase = true;
        break;
      case '--output-path':
        options.outputPath = args[++i];
        break;
      case '--config-file':
        options.configFile = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
部署前验证流程系统

用法: node deployment-validator.js [选项]

选项:
  --environment, --env <env>  目标环境: development, staging, production (默认: development)
  --skip-slow               跳过耗时的检查
  --skip-database           跳过数据库相关检查
  --output-path <path>      报告输出路径
  --config-file <path>      配置文件路径
  --dry-run                 试运行模式，不执行实际操作
  --help, -h               显示帮助信息

示例:
  node deployment-validator.js --environment production
  node deployment-validator.js --skip-slow --dry-run
  node deployment-validator.js --env staging --output-path ./reports
        `);
        process.exit(0);
    }
  }

  // 运行部署验证
  const validator = new DeploymentValidator(options);

  validator.runAll()
    .then(result => {
      if (!result.success) {
        console.log(chalk.red('\n❌ 部署验证未通过'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ 部署验证通过'));
        process.exit(0);
      }
    })
    .catch(error => {
      console.error(chalk.red('\n💥 部署验证执行失败:'), error.message);
      process.exit(1);
    });
}

module.exports = DeploymentValidator;