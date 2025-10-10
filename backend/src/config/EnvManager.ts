/**
 * 环境变量管理器 - 高可用单例模式
 *
 * 功能:
 * - 统一管理所有环境变量
 * - 启动时验证必需配置
 * - 提供类型安全的访问接口
 * - 支持降级默认值
 *
 * 高可用特性:
 * - 启动时快速失败 (Fail Fast)
 * - 清晰的错误提示
 * - 配置缓存避免重复读取
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { existsSync } from 'fs';

export class EnvManager {
  private static instance: EnvManager;
  private config: Map<string, string>;
  private isInitialized = false;

  private constructor() {
    this.config = new Map();
    this.loadEnv();
    this.validateRequired();
    this.isInitialized = true;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): EnvManager {
    if (!EnvManager.instance) {
      EnvManager.instance = new EnvManager();
    }
    return EnvManager.instance;
  }

  /**
   * 加载环境变量
   * 优先级: 系统环境变量 > .env文件
   */
  private loadEnv(): void {
    const envPath = path.resolve(__dirname, '../../.env');

    // 开发环境必须有.env文件
    if (process.env.NODE_ENV !== 'production' && !existsSync(envPath)) {
      console.error('❌ .env file not found:', envPath);
      console.error('📝 Please create .env file based on .env.example');
      process.exit(1);
    }

    // 加载.env文件
    if (existsSync(envPath)) {
      const result = dotenv.config({ path: envPath });
      if (result.error) {
        console.error('❌ Failed to load .env file:', result.error);
        process.exit(1);
      }
      console.log('✅ Loaded .env file from:', envPath);
    }

    // 转换为Map (系统环境变量优先)
    this.config = new Map(Object.entries(process.env as Record<string, string>));
    console.log(`✅ Loaded ${this.config.size} environment variables`);
  }

  /**
   * 验证必需的环境变量
   */
  private validateRequired(): void {
    const required = [
      // 安全配置
      'TOKEN_SECRET',

      // 数据库配置
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',

      // Redis配置 (可选,降级到内存)
      // 'REDIS_HOST',
      // 'REDIS_PORT',
    ];

    const missing: Array<string> = [];
    const warnings: Array<string> = [];

    for (const key of required) {
      const value = this.config.get(key);
      if (!value || value.trim() === '') {
        missing.push(key);
      }
    }

    // 检查可选但推荐的配置
    const recommended = [
      'REDIS_HOST',
      'REDIS_PORT',
      'FASTGPT_API_KEY_1',
      'FRONTEND_URL',
    ];

    for (const key of recommended) {
      const value = this.config.get(key);
      if (!value || value.trim() === '') {
        warnings.push(key);
      }
    }

    // 打印警告
    if (warnings.length > 0) {
      console.warn('⚠️  Missing recommended environment variables:');
      warnings.forEach(key => console.warn(`   - ${key} (using default or degraded mode)`));
    }

    // 必需配置缺失则退出
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(key => console.error(`   - ${key}`));
      console.error('\n📝 Please set these variables in .env file or environment');
      console.error('💡 Refer to .env.example for template\n');
      process.exit(1);
    }

    console.log('✅ All required environment variables validated');
  }

  /**
   * 获取环境变量 (支持降级默认值)
   * @param key 环境变量名
   * @param fallback 默认值
   * @returns 环境变量值或默认值
   */
  public get(key: string, fallback: string = ''): string {
    const value = this.config.get(key);
    return value ?? fallback;
  }

  /**
   * 获取必需的环境变量 (不存在则抛出异常)
   * @param key 环境变量名
   * @returns 环境变量值
   * @throws Error 如果变量不存在
   */
  public getRequired(key: string): string {
    const value = this.config.get(key);
    if (!value || value.trim() === '') {
      throw new Error(`Required environment variable not found: ${key}`);
    }
    return value;
  }

  /**
   * 获取整数类型环境变量
   * @param key 环境变量名
   * @param fallback 默认值
   * @returns 整数值
   */
  public getInt(key: string, fallback: number = 0): number {
    const value = this.get(key);
    if (!value) {
      return fallback;
    }

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * 获取布尔类型环境变量
   * @param key 环境变量名
   * @param fallback 默认值
   * @returns 布尔值
   */
  public getBoolean(key: string, fallback: boolean = false): boolean {
    const value = this.get(key).toLowerCase();
    if (!value) {
      return fallback;
    }

    return value === 'true' || value === '1' || value === 'yes';
  }

  /**
   * 检查环境变量是否存在
   * @param key 环境变量名
   * @returns 是否存在
   */
  public has(key: string): boolean {
    const value = this.config.get(key);
    return value !== undefined && value.trim() !== '';
  }

  /**
   * 获取当前环境 (development/production/test)
   */
  public getEnvironment(): string {
    return this.get('NODE_ENV', 'development');
  }

  /**
   * 是否为生产环境
   */
  public isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * 是否为开发环境
   */
  public isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * 获取所有环境变量 (调试用,生产环境禁用)
   * 注意: 不会打印敏感信息
   */
  public getAllSafe(): Record<string, string> {
    if (this.isProduction()) {
      throw new Error('getAllSafe is disabled in production');
    }

    const safe: Record<string, string> = {};
    const sensitiveKeys = [
      'PASSWORD',
      'SECRET',
      'KEY',
      'TOKEN',
      'API_KEY',
      'PRIVATE',
    ];

    for (const [key, value] of this.config.entries()) {
      // 敏感信息脱敏
      const isSensitive = sensitiveKeys.some(pattern =>
        key.toUpperCase().includes(pattern),
      );

      if (isSensitive) {
        safe[key] = value ? '***REDACTED***' : '';
      } else {
        safe[key] = value;
      }
    }

    return safe;
  }

  /**
   * 获取配置统计信息
   */
  public getStats(): {
    total: number;
    required: number;
    optional: number;
    missing: number;
    } {
    const requiredKeys = [
      'TOKEN_SECRET',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',
    ];

    const missing = requiredKeys.filter(key => !this.has(key));

    return {
      total: this.config.size,
      required: requiredKeys.length,
      optional: this.config.size - requiredKeys.length,
      missing: missing.length,
    };
  }

  /**
   * 重新加载环境变量 (热重载,仅开发环境)
   */
  public reload(): void {
    if (this.isProduction()) {
      throw new Error('Hot reload is disabled in production');
    }

    console.log('🔄 Reloading environment variables...');
    this.config.clear();
    this.loadEnv();
    this.validateRequired();
    console.log('✅ Environment variables reloaded');
  }
}

// 导出单例实例
export const envManager = EnvManager.getInstance();
