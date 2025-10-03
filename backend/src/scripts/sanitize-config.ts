#!/usr/bin/env ts-node
/**
 * 配置文件脱敏脚本
 * 
 * 用途:
 * - 自动将config文件中的敏感信息替换为环境变量占位符
 * - 生成.env文件模板
 * - 备份原始配置
 * 
 * 使用:
 * npm run sanitize:config
 * 或
 * ts-node backend/src/scripts/sanitize-config.ts
 * 
 * ⚠️  警告: 执行前会自动备份原配置文件
 */

import fs from 'fs';
import path from 'path';

interface SensitivePattern {
  pattern: RegExp;
  envVarName: string;
  description: string;
}

class ConfigSanitizer {
  private backupDir = 'config/backups';
  private extractedVars: Map<string, string> = new Map();

  /**
   * 执行配置脱敏
   */
  async sanitize(): Promise<void> {
    console.log('🔒 开始配置文件脱敏...\n');

    // 1. 创建备份目录
    this.ensureBackupDir();

    // 2. 处理agents.json
    await this.sanitizeAgentsConfig();

    // 3. 处理config.jsonc
    await this.sanitizeMainConfig();

    // 4. 生成.env文件
    this.generateEnvFile();

    // 5. 生成报告
    this.generateReport();
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupDir(): void {
    const dir = path.resolve(process.cwd(), this.backupDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 备份文件
   */
  private backupFile(filePath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.backup`);
    const fullBackupPath = path.resolve(process.cwd(), backupPath);

    fs.copyFileSync(filePath, fullBackupPath);
    console.log(`📦 备份: ${filePath} -> ${backupPath}`);
    
    return backupPath;
  }

  /**
   * 脱敏agents.json
   */
  private async sanitizeAgentsConfig(): Promise<void> {
    const filePath = path.resolve(process.cwd(), 'config/agents.json');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  config/agents.json 不存在，跳过');
      return;
    }

    // 备份
    this.backupFile(filePath);

    // 读取
    const content = fs.readFileSync(filePath, 'utf-8');
    let config: any;
    
    try {
      config = JSON.parse(content);
    } catch (error) {
      console.error('❌ agents.json 解析失败:', error);
      return;
    }

    // 处理每个agent
    let modified = false;
    if (config.agents && Array.isArray(config.agents)) {
      config.agents.forEach((agent: any, index: number) => {
        // 替换API Key
        if (agent.apiKey && !agent.apiKey.startsWith('${')) {
          const envVarName = `FASTGPT_API_KEY_${index + 1}`;
          this.extractedVars.set(envVarName, agent.apiKey);
          agent.apiKey = `\${${envVarName}}`;
          modified = true;
        }

        // 替换App ID
        if (agent.appId && !agent.appId.startsWith('${')) {
          const envVarName = `FASTGPT_APP_ID_${index + 1}`;
          this.extractedVars.set(envVarName, agent.appId);
          agent.appId = `\${${envVarName}}`;
          modified = true;
        }

        // 替换Endpoint (如果包含敏感信息)
        if (agent.endpoint && !agent.endpoint.startsWith('${')) {
          if (agent.endpoint.includes('api.fastgpt.in') || agent.endpoint.includes('localhost')) {
            const envVarName = `FASTGPT_ENDPOINT`;
            if (!this.extractedVars.has(envVarName)) {
              this.extractedVars.set(envVarName, agent.endpoint.replace(/\/chat\/completions.*$/, ''));
            }
            agent.endpoint = `\${${envVarName}}/chat/completions`;
            modified = true;
          }
        }
      });
    }

    if (modified) {
      // 写入
      fs.writeFileSync(
        filePath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      console.log('✅ config/agents.json 已脱敏');
    } else {
      console.log('ℹ️  config/agents.json 无需修改 (已使用占位符)');
    }
  }

  /**
   * 脱敏config.jsonc
   */
  private async sanitizeMainConfig(): Promise<void> {
    const filePath = path.resolve(process.cwd(), 'config/config.jsonc');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  config/config.jsonc 不存在，跳过');
      return;
    }

    // 备份
    this.backupFile(filePath);

    // 读取 (处理JSONC注释)
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 移除注释以解析
    const jsonContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
      .replace(/\/\/.*/g, '');          // 行注释

    let config: any;
    try {
      config = JSON.parse(jsonContent);
    } catch (error) {
      console.error('❌ config.jsonc 解析失败:', error);
      return;
    }

    // 处理数据库配置
    let modified = false;
    if (config.database) {
      const dbConfig = config.database;

      if (dbConfig.password && !dbConfig.password.startsWith('${')) {
        this.extractedVars.set('DB_PASSWORD', dbConfig.password);
        dbConfig.password = '${DB_PASSWORD}';
        modified = true;
      }

      if (dbConfig.user && !dbConfig.user.startsWith('${')) {
        this.extractedVars.set('DB_USER', dbConfig.user);
        dbConfig.user = '${DB_USER}';
        modified = true;
      }

      if (dbConfig.host && !dbConfig.host.startsWith('${')) {
        this.extractedVars.set('DB_HOST', dbConfig.host);
        dbConfig.host = '${DB_HOST}';
        modified = true;
      }

      if (dbConfig.port && !String(dbConfig.port).startsWith('${')) {
        this.extractedVars.set('DB_PORT', String(dbConfig.port));
        dbConfig.port = '${DB_PORT}';
        modified = true;
      }

      if (dbConfig.database && !dbConfig.database.startsWith('${')) {
        this.extractedVars.set('DB_NAME', dbConfig.database);
        dbConfig.database = '${DB_NAME}';
        modified = true;
      }
    }

    if (modified) {
      // 保留原始JSONC格式 (简单替换)
      let newContent = content;
      for (const [envVar, value] of this.extractedVars.entries()) {
        if (envVar.startsWith('DB_')) {
          // 替换数据库配置中的值
          newContent = newContent.replace(
            new RegExp(`"${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
            `"\${${envVar}}"`
          );
        }
      }

      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log('✅ config/config.jsonc 已脱敏');
    } else {
      console.log('ℹ️  config/config.jsonc 无需修改 (已使用占位符)');
    }
  }

  /**
   * 生成.env文件
   */
  private generateEnvFile(): void {
    const envPath = path.resolve(process.cwd(), 'backend/.env');
    
    if (fs.existsSync(envPath)) {
      console.log('⚠️  backend/.env 已存在，不会覆盖');
      console.log('💡 提取的环境变量将显示在下方，请手动添加到.env文件');
      return;
    }

    // 读取模板
    const templatePath = path.resolve(process.cwd(), 'backend/ENV_TEMPLATE.txt');
    let envContent = '';

    if (fs.existsSync(templatePath)) {
      envContent = fs.readFileSync(templatePath, 'utf-8');
    } else {
      envContent = '# LLMChat 环境变量\n\n';
    }

    // 添加提取的变量
    if (this.extractedVars.size > 0) {
      envContent += '\n# === 从配置文件提取的敏感信息 ===\n';
      for (const [key, value] of this.extractedVars.entries()) {
        envContent += `${key}=${value}\n`;
      }
    }

    // 写入
    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log(`✅ 生成 backend/.env 文件 (提取了${this.extractedVars.size}个变量)`);
  }

  /**
   * 生成报告
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 配置脱敏报告');
    console.log('='.repeat(60) + '\n');

    console.log(`✅ 配置文件脱敏完成！\n`);

    if (this.extractedVars.size > 0) {
      console.log(`📝 提取的环境变量 (${this.extractedVars.size}个):\n`);
      for (const [key, value] of this.extractedVars.entries()) {
        // 脱敏显示
        const maskedValue = value.length > 8
          ? value.substring(0, 4) + '***' + value.substring(value.length - 4)
          : '***';
        console.log(`   ${key}=${maskedValue}`);
      }
      console.log();
    }

    console.log('🔧 后续步骤:\n');
    console.log('   1. 检查 backend/.env 文件，确认所有变量正确');
    console.log('   2. 运行验证脚本: npm run validate:env');
    console.log('   3. 备份文件位于: config/backups/');
    console.log('   4. 如需回滚，从备份目录恢复即可\n');

    console.log('⚠️  重要提示:\n');
    console.log('   - 请勿提交 backend/.env 到版本控制');
    console.log('   - 请勿提交 config/backups/ 到版本控制');
    console.log('   - 生产环境请使用不同的密钥值\n');

    console.log('='.repeat(60) + '\n');
  }
}

// 执行脱敏
async function main() {
  const sanitizer = new ConfigSanitizer();
  await sanitizer.sanitize();
}

// 仅当直接运行时执行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脱敏脚本执行失败:', error);
    process.exit(1);
  });
}

export { ConfigSanitizer };

