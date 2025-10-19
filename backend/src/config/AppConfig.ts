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
   * 从环境变量读取，无默认值
   */
  static getDatabaseConfig() {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host) {
      throw new SystemError({
        message: 'DB_HOST 未配置，请检查根目录 .env 文件',
        code: 'MISSING_DB_HOST',
        component: 'AppConfig',
      });
    }

    if (!port) {
      throw new SystemError({
        message: 'DB_PORT 未配置，请检查根目录 .env 文件',
        code: 'MISSING_DB_PORT',
        component: 'AppConfig',
      });
    }

    if (!user) {
      throw new SystemError({
        message: 'DB_USER 未配置，请检查根目录 .env 文件',
        code: 'MISSING_DB_USER',
        component: 'AppConfig',
      });
    }

    if (!password) {
      throw new SystemError({
        message: 'DB_PASSWORD 未配置，请检查根目录 .env 文件',
        code: 'MISSING_DB_PASSWORD',
        component: 'AppConfig',
      });
    }

    if (!database) {
      throw new SystemError({
        message: 'DB_NAME 未配置，请检查根目录 .env 文件',
        code: 'MISSING_DB_NAME',
        component: 'AppConfig',
      });
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
   * 启动时验证所有必需配置
   */
  static validate() {
    const required = [
      'REDIS_HOST',
      'REDIS_PORT',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',
    ];

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
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
      },
      server: {
        port: process.env.PORT,
        nodeEnv: process.env.NODE_ENV,
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

