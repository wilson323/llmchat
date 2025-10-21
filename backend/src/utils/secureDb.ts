/**
 * Secure Database Configuration Manager
 *
 * Handles encrypted database credentials and secure connection management
 * to prevent plaintext password exposure in logs, memory dumps, and configuration files.
 */

import { Pool, type PoolConfig } from 'pg';
import { SecureCredentialsManager, type EncryptedData } from './secureCredentials';
import logger from './logger';
import { createErrorFromUnknown } from '@/types/errors';

// 数据库配置常量
const MIN_PASSWORD_LENGTH_FOR_MASK = 4;
const DEFAULT_POSTGRES_PORT = 5432;
const POOL_CONFIG = {
  MAX_POOL_SIZE: 50,
  MIN_POOL_SIZE: 5,
  IDLE_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 10000,
  MAX_USES: 7500,
} as const;

export interface PostgresConfig {
  host: string;
  port?: number | string;
  user: string;
  password: string | EncryptedData;
  database: string;
  ssl?: boolean | string;
  encryptedPassword?: boolean;
}

export interface SecurePgConfig {
  database?: {
    postgres?: PostgresConfig;
  };
  auth?: {
    tokenTTLSeconds?: number;
  };
}

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
  if (!password || password.length < MIN_PASSWORD_LENGTH_FOR_MASK) {
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
  const isEncrypted = pg.encryptedPassword === true;
  const decryptedPassword = decryptPasswordIfNeeded(pg.password, isEncrypted);

  // Log masked password for security
  logger.info('[secureDb] Creating database connection pool', {
    host: pg.host,
    port: Number(pg.port) ?? DEFAULT_POSTGRES_PORT,
    database: pg.database,
    user: pg.user,
    passwordMasked: maskPassword(decryptedPassword),
    passwordEncrypted: isEncrypted,
  });

  return {
    host: pg.host,
    port: Number(pg.port) ?? DEFAULT_POSTGRES_PORT,
    user: pg.user,
    password: decryptedPassword,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } : undefined,
    max: POOL_CONFIG.MAX_POOL_SIZE,
    min: POOL_CONFIG.MIN_POOL_SIZE,
    idleTimeoutMillis: POOL_CONFIG.IDLE_TIMEOUT,
    connectionTimeoutMillis: POOL_CONFIG.CONNECTION_TIMEOUT,
    maxUses: POOL_CONFIG.MAX_USES,
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

    const isEncrypted = pg.encryptedPassword === true;
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

  const database = config.database;
  const postgres = database?.postgres;

  if (!database || !postgres) {
    throw new Error('Database configuration is missing');
  }

  const poolConfig = createSecurePoolConfig(postgres);

  return new Pool(poolConfig);
}
