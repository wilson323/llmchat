#!/usr/bin/env ts-node
/**
 * 环境变量配置验证脚本
 * 
 * 用途:
 * - 启动前验证所有必需的环境变量
 * - 检查配置文件中的占位符是否都有对应环境变量
 * - 验证配置值的合法性
 * 
 * 使用:
 * npm run validate:env
 * 或
 * ts-node backend/src/scripts/validate-env.ts
 */

// 加载环境变量
import dotenv from 'dotenv';
import path from 'path';

// 加载.env文件
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { EnvManager } from '../config/EnvManager';
import fs from 'fs';

interface ValidationResult {
  passed: boolean;
  errors: Array<string>;
  warnings: Array<string>;
  info: Array<string>;
}

class EnvValidator {
  private result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
    info: [],
  };

  /**
   * 执行完整验证
   */
  async validate(): Promise<ValidationResult> {
    console.log('🔍 开始环境变量验证...\n');

    // 1. 验证EnvManager初始化
    this.validateEnvManager();

    // 2. 验证必需的环境变量
    this.validateRequiredVars();

    // 3. 验证推荐的环境变量
    this.validateRecommendedVars();

    // 4. 验证配置文件占位符
    await this.validateConfigPlaceholders();

    // 5. 验证配置值合法性
    this.validateConfigValues();

    // 6. 生成报告
    this.generateReport();

    return this.result;
  }

  /**
   * 验证EnvManager初始化
   */
  private validateEnvManager(): void {
    try {
      const envManager = EnvManager.getInstance();
      const stats = envManager.getStats();
      
      this.result.info.push(
        `✅ EnvManager初始化成功 (总计${stats.total}个变量)`
      );

      if (stats.missing > 0) {
        this.result.errors.push(
          `❌ 缺少${stats.missing}个必需环境变量`
        );
        this.result.passed = false;
      }
    } catch (error: any) {
      this.result.errors.push(`❌ EnvManager初始化失败: ${error.message}`);
      this.result.passed = false;
    }
  }

  /**
   * 验证必需的环境变量
   */
  private validateRequiredVars(): void {
    const envManager = EnvManager.getInstance();
    
    const requiredVars = [
      { key: 'TOKEN_SECRET', minLength: 32, description: 'JWT Token密钥' },
      { key: 'DB_HOST', minLength: 1, description: '数据库主机' },
      { key: 'DB_PORT', minLength: 1, description: '数据库端口' },
      { key: 'DB_USER', minLength: 1, description: '数据库用户名' },
      { key: 'DB_PASSWORD', minLength: 1, description: '数据库密码' },
      { key: 'DB_NAME', minLength: 1, description: '数据库名称' },
    ];

    for (const { key, minLength, description } of requiredVars) {
      if (!envManager.has(key)) {
        this.result.errors.push(`❌ 缺少必需变量: ${key} (${description})`);
        this.result.passed = false;
      } else {
        const value = envManager.get(key);
        if (value.length < minLength) {
          this.result.errors.push(
            `❌ ${key} 长度不足 (需要至少${minLength}字符)`
          );
          this.result.passed = false;
        } else {
          this.result.info.push(`✅ ${key}: ${description} - OK`);
        }
      }
    }
  }

  /**
   * 验证推荐的环境变量
   */
  private validateRecommendedVars(): void {
    const envManager = EnvManager.getInstance();
    
    const recommendedVars = [
      { key: 'REDIS_HOST', description: 'Redis主机 (Token存储)', impact: '单实例部署可用，多实例需Redis' },
      { key: 'REDIS_PORT', description: 'Redis端口', impact: '同上' },
      { key: 'FASTGPT_API_KEY_1', description: 'FastGPT API密钥', impact: 'FastGPT智能体不可用' },
      { key: 'FRONTEND_URL', description: '前端URL', impact: 'CORS配置可能不正确' },
      { key: 'LOG_LEVEL', description: '日志级别', impact: '使用默认info级别' },
    ];

    for (const { key, description, impact } of recommendedVars) {
      if (!envManager.has(key)) {
        this.result.warnings.push(
          `⚠️  推荐配置 ${key} 未设置\n   说明: ${description}\n   影响: ${impact}`
        );
      } else {
        this.result.info.push(`✅ ${key}: ${description} - OK`);
      }
    }
  }

  /**
   * 验证配置文件中的占位符
   */
  private async validateConfigPlaceholders(): Promise<void> {
    const configFiles = [
      '../config/agents.json',
      '../config/config.jsonc',
    ];

    for (const file of configFiles) {
      const filePath = path.resolve(process.cwd(), file);
      
      if (!fs.existsSync(filePath)) {
        this.result.warnings.push(`⚠️  配置文件不存在: ${file}`);
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const placeholders = this.extractPlaceholders(content);

        if (placeholders.length > 0) {
          this.result.info.push(`\n📄 ${file} 中的占位符:`);
          
          const envManager = EnvManager.getInstance();
          for (const placeholder of placeholders) {
            if (!envManager.has(placeholder)) {
              this.result.errors.push(
                `❌ 占位符 \${${placeholder}} 在 ${file} 中使用但环境变量未设置`
              );
              this.result.passed = false;
            } else {
              this.result.info.push(`   ✅ \${${placeholder}} - 已设置`);
            }
          }
        } else {
          this.result.warnings.push(
            `⚠️  ${file} 中未找到环境变量占位符 (可能已硬编码敏感信息)`
          );
        }
      } catch (error: any) {
        this.result.errors.push(`❌ 读取配置文件失败 ${file}: ${error.message}`);
        this.result.passed = false;
      }
    }
  }

  /**
   * 验证配置值合法性
   */
  private validateConfigValues(): void {
    const envManager = EnvManager.getInstance();

    // 验证端口号
    const port = envManager.getInt('PORT', 3001);
    if (port < 1 || port > 65535) {
      this.result.errors.push(`❌ PORT 值不合法: ${port} (应在1-65535之间)`);
      this.result.passed = false;
    } else {
      this.result.info.push(`✅ PORT: ${port} - OK`);
    }

    // 验证数据库端口
    const dbPort = envManager.getInt('DB_PORT', 5432);
    if (dbPort < 1 || dbPort > 65535) {
      this.result.errors.push(`❌ DB_PORT 值不合法: ${dbPort}`);
      this.result.passed = false;
    } else {
      this.result.info.push(`✅ DB_PORT: ${dbPort} - OK`);
    }

    // 验证NODE_ENV
    const nodeEnv = envManager.getEnvironment();
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(nodeEnv)) {
      this.result.warnings.push(
        `⚠️  NODE_ENV 值不标准: ${nodeEnv} (推荐: ${validEnvs.join('/')})`
      );
    } else {
      this.result.info.push(`✅ NODE_ENV: ${nodeEnv} - OK`);
    }

    // 验证TOKEN_SECRET强度 (生产环境)
    if (envManager.isProduction()) {
      const tokenSecret = envManager.get('TOKEN_SECRET');
      if (tokenSecret.includes('change-in-production')) {
        this.result.errors.push(
          `❌ TOKEN_SECRET 使用默认值，生产环境必须修改！`
        );
        this.result.passed = false;
      }
    }
  }

  /**
   * 提取配置文件中的环境变量占位符
   */
  private extractPlaceholders(content: string): string[] {
    const matches = content.match(/\$\{([^}]+)\}/g);
    if (!matches) return [];
    
    const placeholders = matches.map(match => match.slice(2, -1));
    return [...new Set(placeholders)]; // 去重
  }

  /**
   * 生成验证报告
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 环境变量验证报告');
    console.log('='.repeat(60) + '\n');

    // 错误
    if (this.result.errors.length > 0) {
      console.log('❌ 错误 (' + this.result.errors.length + '):\n');
      this.result.errors.forEach(error => console.log(error));
      console.log();
    }

    // 警告
    if (this.result.warnings.length > 0) {
      console.log('⚠️  警告 (' + this.result.warnings.length + '):\n');
      this.result.warnings.forEach(warning => console.log(warning));
      console.log();
    }

    // 信息
    if (this.result.info.length > 0 && process.env.VERBOSE === 'true') {
      console.log('ℹ️  详细信息:\n');
      this.result.info.forEach(info => console.log(info));
      console.log();
    }

    // 总结
    console.log('='.repeat(60));
    if (this.result.passed) {
      console.log('✅ 验证通过！所有必需的环境变量已正确配置。');
      if (this.result.warnings.length > 0) {
        console.log(`   (有${this.result.warnings.length}个警告，建议修复)`);
      }
    } else {
      console.log('❌ 验证失败！请修复上述错误后重试。');
      console.log('\n💡 提示:');
      console.log('   1. 检查 backend/.env 文件是否存在');
      console.log('   2. 参考 backend/ENV_TEMPLATE.txt 补充缺失配置');
      console.log('   3. 确保所有敏感信息已从配置文件移至.env');
    }
    console.log('='.repeat(60) + '\n');
  }
}

// 执行验证
async function main() {
  console.log('🚀 启动环境变量验证脚本...');
  
  try {
    const validator = new EnvValidator();
    const result = await validator.validate();

    // 退出码: 0=成功, 1=失败
    process.exit(result.passed ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ 验证过程发生严重错误:');
    console.error(error.message);
    if (error.stack) {
      console.error('\n堆栈跟踪:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 立即执行（不检查模块状态）
main().catch(error => {
  console.error('❌ 脚本启动失败:', error);
  process.exit(1);
});

export { EnvValidator };

