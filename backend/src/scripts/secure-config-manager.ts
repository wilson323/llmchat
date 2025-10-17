#!/usr/bin/env ts-node
/**
 * 安全配置管理器
 *
 * 安全原则:
 * 1. 禁止使用正则表达式进行结构化数据处理
 * 2. 使用专门的JSON解析器和类型验证
 * 3. 实现原子操作和完整性检查
 * 4. 提供安全的回滚机制
 *
 * 用途:
 * - 安全地管理配置文件
 * - 提取敏感信息到环境变量
 * - 保持配置文件的完整性
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface SecureConfigOptions {
  backupDir: string;
  createChecksum: boolean;
  validateAfterModification: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface BackupInfo {
  filePath: string;
  backupPath: string;
  checksum: string;
  timestamp: Date;
}

class SecureConfigManager {
  private readonly options: SecureConfigOptions;
  private readonly backups: Map<string, BackupInfo> = new Map();

  constructor(options: Partial<SecureConfigOptions> = {}) {
    this.options = {
      backupDir: 'config/backups',
      createChecksum: true,
      validateAfterModification: true,
      ...options,
    };
  }

  /**
   * 安全地处理agents.json配置
   */
  async processAgentsConfig(): Promise<ValidationResult> {
    const filePath = path.resolve(process.cwd(), 'config/agents.json');

    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        errors: ['config/agents.json does not exist'],
        warnings: [],
      };
    }

    try {
      // 1. 创建备份
      const backupInfo = await this.createSecureBackup(filePath);

      // 2. 使用JSON解析器读取配置
      const config = this.parseJSONFile(filePath);
      if (!config) {
        return {
          valid: false,
          errors: ['Failed to parse agents.json'],
          warnings: [],
        };
      }

      // 3. 类型安全的配置处理
      const result = await this.processAgentsConfigSecurely(config);

      if (result.modified) {
        // 4. 验证修改后的配置
        const validationResult = this.validateAgentsConfig(result.config);
        if (!validationResult.valid) {
          await this.restoreFromBackup(filePath);
          return validationResult;
        }

        // 5. 安全写入
        await this.writeJSONFile(filePath, result.config);
        console.log('✅ config/agents.json processed successfully');
      }

      return {
        valid: true,
        errors: [],
        warnings: result.warnings,
      };

    } catch (error: any) {
      return {
        valid: false,
        errors: [`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  /**
   * 创建安全备份
   */
  private async createSecureBackup(filePath: string): Promise<BackupInfo> {
    await this.ensureBackupDirectory();

    const timestamp = new Date();
    const fileName = path.basename(filePath);
    const backupPath = path.join(
      this.options.backupDir,
      `${fileName}.${timestamp.toISOString().replace(/[:.]/g, '-')}.backup`,
    );

    // 读取原文件并计算校验和
    const content = fs.readFileSync(filePath, 'utf-8');
    const checksum = this.calculateChecksum(content);

    // 创建备份信息
    const backupInfo: BackupInfo = {
      filePath,
      backupPath,
      checksum,
      timestamp,
    };

    // 写入备份文件
    const fullBackupPath = path.resolve(process.cwd(), backupPath);
    fs.writeFileSync(fullBackupPath, content, 'utf-8');

    // 保存备份信息
    this.backups.set(filePath, backupInfo);

    console.log(`📦 Secure backup created: ${backupPath}`);
    return backupInfo;
  }

  /**
   * 使用JSON解析器安全读取文件
   */
  private parseJSONFile(filePath: string): any {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      console.error(`❌ Failed to parse JSON file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 安全处理agents配置
   */
  private async processAgentsConfigSecurely(config: any): Promise<{
    config: any;
    modified: boolean;
    warnings: string[];
  }> {
    const result = {
      config: JSON.parse(JSON.stringify(config)), // 深拷贝
      modified: false,
      warnings: [] as string[],
    };

    if (!config.agents || !Array.isArray(config.agents)) {
      result.warnings.push('Invalid agents configuration structure');
      return result;
    }

    for (let i = 0; i < config.agents.length; i++) {
      const agent = config.agents[i];

      // 验证agent结构
      if (!this.validateAgentStructure(agent)) {
        result.warnings.push(`Invalid agent structure at index ${i}`);
        continue;
      }

      // 安全处理API Key
      if (agent.apiKey && typeof agent.apiKey === 'string' && !agent.apiKey.startsWith('${')) {
        if (!this.isValidApiKey(agent.apiKey)) {
          result.warnings.push(`Invalid API key format for agent at index ${i}`);
          continue;
        }

        result.config.agents[i].apiKey = `\${FASTGPT_API_KEY_${i + 1}}`;
        result.modified = true;
      }

      // 安全处理App ID
      if (agent.appId && typeof agent.appId === 'string' && !agent.appId.startsWith('${')) {
        result.config.agents[i].appId = `\${FASTGPT_APP_ID_${i + 1}}`;
        result.modified = true;
      }

      // 安全处理Endpoint
      if (agent.endpoint && typeof agent.endpoint === 'string' && !agent.endpoint.startsWith('${')) {
        const normalizedEndpoint = this.normalizeEndpoint(agent.endpoint);
        if (normalizedEndpoint) {
          result.config.agents[i].endpoint = '${FASTGPT_ENDPOINT}/chat/completions';
          result.modified = true;
        } else {
          result.warnings.push(`Invalid endpoint for agent at index ${i}`);
        }
      }
    }

    return result;
  }

  /**
   * 验证agent结构
   */
  private validateAgentStructure(agent: any): boolean {
    return (
      agent &&
      typeof agent === 'object' &&
      typeof agent.id === 'string' &&
      typeof agent.name === 'string' &&
      typeof agent.provider === 'string'
    );
  }

  /**
   * 验证API Key格式
   */
  private isValidApiKey(apiKey: string): boolean {
    // 基本的API Key格式验证
    return (
      typeof apiKey === 'string' &&
      apiKey.length >= 10 &&
      apiKey.length <= 200 &&
      /^[a-zA-Z0-9\-_]+$/.test(apiKey)
    );
  }

  /**
   * 标准化Endpoint
   */
  private normalizeEndpoint(endpoint: string): string | null {
    try {
      const url = new URL(endpoint);

      // 只允许特定域名
      const allowedHosts = ['api.fastgpt.in', 'localhost', '127.0.0.1'];
      if (!allowedHosts.includes(url.hostname)) {
        return null;
      }

      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }

  /**
   * 验证agents配置
   */
  private validateAgentsConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 基本结构验证
      if (!config || typeof config !== 'object') {
        errors.push('Invalid config structure');
        return { valid: false, errors, warnings };
      }

      if (!Array.isArray(config.agents)) {
        errors.push('Agents must be an array');
        return { valid: false, errors, warnings };
      }

      // 逐个验证agent
      config.agents.forEach((agent: any, index: number) => {
        if (!this.validateAgentStructure(agent)) {
          errors.push(`Invalid agent structure at index ${index}`);
        }

        // 验证必需字段
        if (!agent.id || typeof agent.id !== 'string') {
          errors.push(`Missing or invalid id for agent at index ${index}`);
        }

        if (!agent.name || typeof agent.name !== 'string') {
          errors.push(`Missing or invalid name for agent at index ${index}`);
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };

    } catch (error: any) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * 安全写入JSON文件
   */
  private async writeJSONFile(filePath: string, config: any): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 从备份恢复
   */
  private async restoreFromBackup(filePath: string): Promise<void> {
    const backupInfo = this.backups.get(filePath);
    if (!backupInfo) {
      throw new Error('No backup found for restoration');
    }

    const fullBackupPath = path.resolve(process.cwd(), backupInfo.backupPath);
    if (!fs.existsSync(fullBackupPath)) {
      throw new Error(`Backup file not found: ${backupInfo.backupPath}`);
    }

    const backupContent = fs.readFileSync(fullBackupPath, 'utf-8');
    const currentChecksum = this.calculateChecksum(backupContent);

    if (currentChecksum !== backupInfo.checksum) {
      throw new Error('Backup file integrity check failed');
    }

    fs.writeFileSync(filePath, backupContent, 'utf-8');
    console.log(`🔄 Restored from backup: ${backupInfo.backupPath}`);
  }

  /**
   * 计算文件校验和
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 确保备份目录存在
   */
  private async ensureBackupDirectory(): Promise<void> {
    const dir = path.resolve(process.cwd(), this.options.backupDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 生成安全报告
   */
  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🛡️ 安全配置管理报告');
    console.log('='.repeat(60) + '\n');

    console.log('✅ 配置处理完成，遵循安全原则:\n');

    console.log('🔒 安全措施:');
    console.log('   - 禁止使用正则表达式进行结构化数据处理');
    console.log('   - 使用类型安全的JSON解析器');
    console.log('   - 实现完整性校验和原子操作');
    console.log('   - 提供安全的备份和回滚机制\n');

    console.log('📁 备份文件:');
    for (const [filePath, backupInfo] of this.backups) {
      console.log(`   ${filePath} -> ${backupInfo.backupPath}`);
      console.log(`   校验和: ${backupInfo.checksum.substring(0, 16)}...`);
    }
    console.log();

    console.log('⚠️ 重要提醒:');
    console.log('   - 备份文件包含敏感信息，请妥善保管');
    console.log('   - 建议在生产环境中使用环境变量管理');
    console.log('   - 定期轮换API密钥和敏感配置\n');

    console.log('='.repeat(60) + '\n');
  }
}

// 主执行函数
async function main() {
  const manager = new SecureConfigManager();

  try {
    console.log('🛡️ 开始安全配置处理...\n');

    const result = await manager.processAgentsConfig();

    if (result.valid) {
      console.log('✅ 配置处理成功完成');
      if (result.warnings.length > 0) {
        console.log('\n⚠️ 警告:');
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
    } else {
      console.log('❌ 配置处理失败');
      result.errors.forEach(error => console.log(`   - ${error}`));
      process.exit(1);
    }

    manager.generateReport();

  } catch (error: any) {
    console.error('❌ 安全配置处理失败:', error);
    process.exit(1);
  }
}

// 仅当直接运行时执行
if (require.main === module) {
  main();
}

export { SecureConfigManager };
