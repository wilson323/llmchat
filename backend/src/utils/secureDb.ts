/**
 * Secure Database Configuration Manager
 *
 * Handles encrypted database credentials and secure connection management
 * to prevent plaintext password exposure in logs, memory dumps, and configuration files.
 */

import type { PoolConfig } from 'pg';
import { Pool } from 'pg';
import type { EncryptedData } from './secureCredentials';
import { SecureCredentialsManager } from './secureCredentials';
import logger from './logger';
import { createErrorFromUnknown } from '@/types/errors';

export interface SecurePgConfig {
  database?: {
    postgres?: {
      host: string;
      port?: number | string;
      user: string;
      password: string | EncryptedData; // Can be encrypted or plaintext (for migration)
      database: string;
      ssl?: boolean | string;
      encryptedPassword?: boolean; // Flag to indicate if password is encrypted
    }
  };
  auth?: {
    tokenTTLSeconds?: number;
  };
}

type PostgresConfig = NonNullable<NonNullable<SecurePgConfig['database']>['postgres']>;
export type NormalizedSecurePostgresConfig = Omit<PostgresConfig, 'port' | 'ssl'> & {
  port?: number;
  ssl?: boolean;
};

const PLACEHOLDER_REGEX = /\$\{[^}]+\}/;

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_REGEX.test(value);
}

function parseOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || isPlaceholder(trimmed)) {
      return undefined;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }

    logger.warn(`[secureDb] 无法解析数据库配置字段 ${fieldName} 为数字`, { value });
  }

  return undefined;
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || isPlaceholder(trimmed)) {
      return undefined;
    }

    const normalized = trimmed.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }

    logger.warn(`[secureDb] 无法解析数据库配置字段 ${fieldName} 为布尔值`, { value });
  }

  return undefined;
}

/**
 * Decrypts password if it's encrypted, otherwise returns as-is
 */
function decryptPasswordIfNeeded(password: string | EncryptedData, isEncrypted?: boolean): string {
  if (isEncrypted && typeof password === 'object' && SecureCredentialsManager.validateEncryptedData(password)) {
    try {
      return SecureCredentialsManager.decryptDatabasePassword(password);
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'secureDb',
        operation: 'decryptPasswordIfNeeded',
      });
      logger.error('[secureDb] Failed to decrypt database password', { error: error.toLogObject() });
      throw new Error('Failed to decrypt database password');
    }
  }

  if (typeof password === 'string') {
    return password;
  }

  throw new Error('Invalid password format');
}

/**
 * Masks password in logs and error messages
 */
function maskPassword(password: string): string {
  if (!password || password.length < 4) {
    return '***';
  }
  return password.substring(0, 2) + '***' + password.substring(password.length - 2);
}

export function normalizeSecurePostgresConfig(pg: PostgresConfig): NormalizedSecurePostgresConfig {
  const config: NormalizedSecurePostgresConfig = {
    host: pg.host,
    user: pg.user,
    password: typeof pg.password === 'string' ? pg.password : '***encrypted***',
    database: pg.database,
  };

  const port = parseOptionalNumber(pg.port, 'port');
  if (port !== undefined) {
    config.port = port;
  }

  const ssl = parseOptionalBoolean(pg.ssl, 'ssl');
  if (ssl !== undefined) {
    config.ssl = ssl;
  }

  return config;
}

export function createSecurePoolConfig(pg: PostgresConfig): PoolConfig {
  const isEncrypted = (pg as any).encryptedPassword === true;
  const decryptedPassword = decryptPasswordIfNeeded(pg.password, isEncrypted);

  // Log masked password for security
  logger.info('[secureDb] Creating database connection pool', {
    host: pg.host,
    port: Number(pg.port) ?? 5432,
    database: pg.database,
    user: pg.user,
    passwordMasked: maskPassword(decryptedPassword),
    passwordEncrypted: isEncrypted,
  });

  return {
    host: pg.host,
    port: Number(pg.port) ?? 5432,
    user: pg.user,
    password: decryptedPassword,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,
    max: 50,                          // 连接池最大50个连接（支持1000并发）
    min: 5,                           // 最小保持5个连接
    idleTimeoutMillis: 30_000,        // 30秒空闲超时
    connectionTimeoutMillis: 10_000,  // 10秒连接超时
    maxUses: 7500,                    // 每个连接最多使用7500次后回收
  };
}

/**
 * Migrates plaintext password to encrypted format
 */
export function migrateToEncryptedPassword(plaintextPassword: string): EncryptedData {
  logger.info('[secureDb] Migrating password to encrypted storage');
  return SecureCredentialsManager.encryptDatabasePassword(plaintextPassword);
}

/**
 * Checks if password needs migration (is plaintext)
 */
export function needsPasswordMigration(password: string | EncryptedData): boolean {
  return typeof password === 'string';
}

/**
 * Validates secure database configuration
 */
export function validateSecureConfig(config: SecurePgConfig): boolean {
  try {
    const pg = config.database?.postgres;
    if (!pg) {
      logger.error('[secureDb] Database configuration missing');
      return false;
    }

    if (!pg.host || !pg.user || !pg.database) {
      logger.error('[secureDb] Required database fields missing', {
        hasHost: !!pg.host,
        hasUser: !!pg.user,
        hasDatabase: !!pg.database,
      });
      return false;
    }

    const isEncrypted = (pg as any).encryptedPassword === true;
    if (isEncrypted && !SecureCredentialsManager.validateEncryptedData(pg.password)) {
      logger.error('[secureDb] Invalid encrypted password format');
      return false;
    }

    return true;
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'secureDb',
      operation: 'validateSecureConfig',
    });
    logger.error('[secureDb] Configuration validation failed', { error: error.toLogObject() });
    return false;
  }
}

/**
 * Creates a secure database pool with encrypted password support
 */
export function createSecurePool(config: SecurePgConfig): Pool {
  if (!validateSecureConfig(config)) {
    throw new Error('Invalid database configuration');
  }

  const pg = config.database!.postgres!;
  const poolConfig = createSecurePoolConfig(pg);

  return new Pool(poolConfig);
}
