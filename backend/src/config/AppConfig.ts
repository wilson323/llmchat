/**
 * 统一配置服务
 *
 * 原则:
 * - 所有配置从环境变量读取
 * - 无硬编码默认值
 * - 启动时验证配置完整性
 * - 配置源: 根目录 .env
 */

import { logger } from '@/utils/logger';
import { SystemError } from '@/types/errors';

export class AppConfig {
  /**
   * Redis 配置
   * 从环境变量读取，无默认值
   */
  static getRedisConfig() {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;

    if (!host) {
      throw new SystemError({
        message: 'REDIS_HOST 未配置，请检查根目录 .env 文件',
        code: 'MISSING_REDIS_HOST',
        component: 'AppConfig',
      });
    }

    if (!port) {
      throw new SystemError({
        message: 'REDIS_PORT 未配置，请检查根目录 .env 文件',
        code: 'MISSING_REDIS_PORT',
        component: 'AppConfig',
      });
    }

    return {
      host,
      port: parseInt(port, 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
    };
  }

  /**
   * PostgreSQL 配置
   * 从环境变量读取，提供开发环境默认值
   */
  static getDatabaseConfig() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'llmchat';

    // 开发环境警告：使用默认配置
    if (process.env.NODE_ENV === 'development' && (!process.env.DB_HOST || !process.env.DB_USER)) {
      console.warn('⚠️  [开发模式] 使用数据库默认配置，生产环境请配置完整的数据库环境变量');
    }

    return {
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
      ssl: process.env.DB_SSL === 'true',
    };
  }

  /**
   * 服务器配置
   */
  static getServerConfig() {
    return {
      port: process.env.PORT || '3001',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * 启动时验证所有必需配置（开发模式：数据库配置可选）
   */
  static validate() {
    // 开发环境：只验证关键配置
    const required = process.env.NODE_ENV === 'production' 
      ? ['REDIS_HOST', 'REDIS_PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
      : ['REDIS_HOST', 'REDIS_PORT']; // 开发环境只要求Redis配置

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      const error = `缺少必需的环境变量: ${missing.join(', ')}\n请检查根目录的 .env 文件`;
      logger.error('配置验证失败', { missing });
      throw new SystemError({
        message: error,
        code: 'CONFIG_VALIDATION_FAILED',
        component: 'AppConfig',
      });
    }

    // 记录配置信息（不记录敏感信息）
    logger.info('✅ 配置验证通过', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'llmchat',
      },
      server: {
        port: process.env.PORT || '3005',
        nodeEnv: process.env.NODE_ENV || 'development',
      }
    });
  }

  /**
   * 获取完整的配置摘要（用于日志）
   */
  static getSummary() {
    return {
      redis: `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      database: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
      server: `PORT=${process.env.PORT}`,
    };
  }
}

