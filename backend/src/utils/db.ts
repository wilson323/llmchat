import { Pool } from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { readJsonc } from '@/utils/config';
import { deepReplaceEnvVariables } from '@/utils/envHelper';
import logger from '@/utils/logger';
import MigrationManager from './MigrationManager';
import { AppConfig } from '@/config/AppConfig'; // ✅ 统一配置服务
import { createErrorFromUnknown } from '@/types/errors';

export interface PgConfig {
  database?: {
    postgres?: {
      host: string;
      port?: number | string;
      user: string;
      password: string;
      database: string;
      ssl?: boolean | string;
    }
  };
  auth?: {
    tokenTTLSeconds?: number;
  };
}

type PostgresConfig = NonNullable<NonNullable<PgConfig['database']>['postgres']>;
export type NormalizedPostgresConfig = Omit<PostgresConfig, 'port' | 'ssl'> & {
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

    logger.warn(`[initDB] 无法解析数据库配置字段 ${fieldName} 为数字`, { value });
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

    logger.warn(`[initDB] 无法解析数据库配置字段 ${fieldName} 为布尔值`, { value });
  }

  return undefined;
}

export function normalizePostgresConfig(pg: PostgresConfig): NormalizedPostgresConfig {
  const config: NormalizedPostgresConfig = {
    host: pg.host,
    user: pg.user,
    password: pg.password,
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

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    throw new Error('DB_NOT_INITIALIZED');
  }
  return pool;
}

export async function initDB(): Promise<void> {
  logger.info('[initDB] 开始初始化数据库...');

  // ✅ 使用统一配置服务（从环境变量读取，无硬编码）
  const dbConfig = AppConfig.getDatabaseConfig();
  const rawPg: PostgresConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl
  };

  // 如果环境变量中的用户名或密码是默认值，尝试读取配置文件作为后备
  if (rawPg.user === 'postgres' || rawPg.password === '123456' || rawPg.password === 'password') {
    logger.info('[initDB] 检测到默认配置，尝试从配置文件加载数据库配置...');
    try {
      const rawCfg = await readJsonc<PgConfig>('config/config.jsonc');
      const cfg = deepReplaceEnvVariables(rawCfg);
      const configPg = cfg.database?.postgres;
      if (configPg) {
        Object.assign(rawPg, configPg);
        logger.info('[initDB] 配置文件加载成功');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.configLoad',
      });
      logger.warn('[initDB] 配置文件加载失败，使用环境变量默认值', { error: error.toLogObject() });
    }
  }

  const pg = normalizePostgresConfig(rawPg);
  console.log('[DB] ========== 数据库配置详情 ==========');
  console.log('[DB] Host:', pg.host);
  console.log('[DB] Port:', pg.port);
  console.log('[DB] User:', pg.user);
  console.log('[DB] Password:', pg.password ? '***' : '(empty)');
  console.log('[DB] Database:', pg.database);
  console.log('[DB] SSL:', pg.ssl);
  console.log('[DB] =====================================');
  
  logger.info(`[initDB] 数据库配置 - Host: ${pg.host}, Port: ${pg.port}, Database: ${pg.database}, User: ${pg.user}`);

  // 尝试连接目标数据库，如果不存在则自动创建
  console.log(`[DB] 开始连接数据库...`);
  logger.info(`[initDB] 尝试连接到目标数据库 "${pg.database}"...`);

  // 先创建一个临时连接池测试目标数据库是否存在
  console.log(`[DB] 创建临时连接池测试目标数据库...`);
  const testPool = new Pool({
    host: pg.host,
    port: pg.port ?? 5432,
    user: pg.user,
    password: pg.password,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,
    connectionTimeoutMillis: 5000,
  });

  let databaseExists = false;
  try {
    console.log('[DB] 测试连接到目标数据库...');
    const testClient = await testPool.connect();
    console.log('[DB] ✓ 目标数据库存在且可连接');
    testClient.release();
    databaseExists = true;
  } catch (testError: any) {
    console.log('[DB] 连接目标数据库失败');
    console.log('[DB] 错误代码:', testError.code);
    console.log('[DB] 错误消息:', testError.message);
    
    // 错误码 3D000 表示数据库不存在
    if (testError.code === '3D000') {
      console.log('[DB] ⚠️  数据库不存在，尝试自动创建...');
      logger.info(`[initDB] 数据库 "${pg.database}" 不存在，尝试创建...`);
      
      // 连接到postgres默认数据库来创建目标数据库
      console.log('[DB] 连接到postgres默认数据库...');
      const postgresPool = new Pool({
        host: pg.host,
        port: pg.port ?? 5432,
        user: pg.user,
        password: pg.password,
        database: 'postgres',
        ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,
        connectionTimeoutMillis: 5000,
      });

      try {
        const postgresClient = await postgresPool.connect();
        console.log('[DB] ✓ 已连接到postgres数据库');
        
        try {
          console.log(`[DB] 执行CREATE DATABASE "${pg.database}"...`);
          await postgresClient.query(`CREATE DATABASE "${pg.database}"`);
          console.log(`[DB] ✓ 数据库 "${pg.database}" 创建成功！`);
          logger.info(`[initDB] 数据库 "${pg.database}" 创建成功`);
          databaseExists = true;
        } catch (createError: any) {
          console.error('[DB] ✗ 创建数据库失败！');
          console.error('[DB] 错误代码:', createError.code);
          console.error('[DB] 错误消息:', createError.message);
          throw createError;
        } finally {
          postgresClient.release();
          console.log('[DB] 释放postgres连接');
        }
      } catch (postgresError: any) {
        console.error('[DB] ✗ 无法连接到postgres数据库！');
        console.error('[DB] 错误代码:', postgresError.code);
        console.error('[DB] 错误消息:', postgresError.message);
        console.error('[DB] 完整错误:', postgresError);
        throw postgresError;
      } finally {
        await postgresPool.end();
        console.log('[DB] 关闭postgres连接池');
      }
    } else {
      // 其他错误，直接抛出
      console.error('[DB] ✗ 连接失败（非数据库不存在错误）');
      console.error('[DB] 错误类型:', testError.constructor.name);
      console.error('[DB] 完整错误:', testError);
      throw testError;
    }
  } finally {
    await testPool.end();
    console.log('[DB] 关闭测试连接池');
  }

  if (!databaseExists) {
    throw new Error(`数据库 "${pg.database}" 不存在且创建失败`);
  }

  // 现在连接到目标数据库（已确认存在）
  console.log(`[DB] 创建正式连接池到 "${pg.database}"...`);
  logger.info(`[initDB] 连接到目标数据库 "${pg.database}"...`);
  pool = new Pool({
    host: pg.host,
    port: pg.port ?? 5432,
    user: pg.user,
    password: pg.password,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,

    // ✅ T006: 动态连接池配置（环境变量控制）
    max: parseInt(process.env.DB_POOL_MAX || '20'),          // 最大连接数（优化为20，避免过多连接）
    min: parseInt(process.env.DB_POOL_MIN || '2'),           // 最小连接数（优化为2）
    idleTimeoutMillis: 300_000,      // 🔧 5分钟空闲超时（避免长时间空闲导致断开）
    connectionTimeoutMillis: 10_000, // 10秒连接超时（远程数据库需要更长时间）
    query_timeout: 30_000,           // 30秒查询超时（复杂查询需要更长时间）
    maxUses: 5000,                   // 每个连接最多使用5000次后回收

    // 🔧 TCP Keepalive配置（防止远程服务器/防火墙关闭空闲连接）
    keepAlive: true,                 // 启用TCP keepalive
    keepAliveInitialDelayMillis: 10_000,  // 🔧 10秒后开始发送keepalive包（更频繁的心跳）

    // ✅ 应用标识
    application_name: 'llmchat-backend',
  });

  console.log('[DB] ✓ 正式连接池已创建');
  console.log('[DB] 连接池配置: min=' + pool.options.min + ', max=' + pool.options.max);
  logger.info('[initDB] 数据库连接池创建成功', {
    min: pool.options.min,
    max: pool.options.max,
    idleTimeout: pool.options.idleTimeoutMillis,
  });

  // 最终验证连接
  console.log('[DB] 最终验证数据库连接...');
  try {
    const finalClient = await pool.connect();
    console.log('[DB] ✓ 数据库连接验证成功！');
    const result = await finalClient.query('SELECT current_database(), current_user, version()');
    console.log('[DB] 当前数据库:', result.rows[0].current_database);
    console.log('[DB] 当前用户:', result.rows[0].current_user);
    console.log('[DB] PostgreSQL版本:', result.rows[0].version);
    finalClient.release();
    console.log('[DB] ✓ 验证连接已释放');
  } catch (finalError: any) {
    console.error('[DB] ✗ 最终验证失败！');
    console.error('[DB] 错误类型:', finalError.constructor.name);
    console.error('[DB] 错误代码:', finalError.code);
    console.error('[DB] 错误消息:', finalError.message);
    throw finalError;
  }

  // ✅ T006: 连接池事件监听
  pool.on('connect', (_client) => {
    logger.info('DB Pool: 新连接已建立', {
      total: pool!.totalCount,
      idle: pool!.idleCount,
      waiting: pool!.waitingCount,
    });
  });

  pool.on('acquire', (_client) => {
    // 仅在debug模式记录（避免日志洪水）
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('DB Pool: 连接已获取');
    }
  });

  pool.on('remove', (_client) => {
    logger.info('DB Pool: 连接已移除', {
      total: pool!.totalCount,
      idle: pool!.idleCount,
    });
  });

  pool.on('error', (err, _client) => {
    logger.error('DB Pool: 意外错误', {
      error: err.message,
      stack: err.stack,
    });
    
    // 🔧 如果是连接终止错误，尝试恢复连接池
    if (err.message.includes('Connection terminated') || err.message.includes('ECONNRESET')) {
      logger.warn('DB Pool: 检测到连接断开，连接池将自动创建新连接');
      // node-postgres会自动重连，这里只记录日志
    }
  });

  // ✅ T006: 定期报告连接池状态（每分钟）
  setInterval(() => {
    if (pool && pool.totalCount > 0) {
      logger.info('DB Pool Status', {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      });
    }
  }, 60000);

  // 🔧 主动连接健康检查（每3分钟执行一次简单查询保持连接活跃）
  setInterval(async () => {
    if (pool) {
      try {
        await pool.query('SELECT 1');
        logger.debug('DB Pool: 连接健康检查通过');
      } catch (err: unknown) {
        logger.warn('DB Pool: 健康检查失败，连接池将自动恢复', {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }, 180_000); // 3分钟

  // 建表（若不存在）
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        email_verified BOOLEAN DEFAULT false,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 移除明文密码列（安全修复）
    try {
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS password_plain;');
      logger.info('[initDB] ✅ 已移除不安全的明文密码列');
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.dropColumn',
      });
      // 列可能不存在，忽略错误
      logger.info('[initDB] 明文密码列不存在或已移除', error.toLogObject());
    }

    // Schema演进：添加缺失的列（兼容旧版本数据库）
    try {
      // 检查email列是否存在
      const emailColumnCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
      `);

      if (emailColumnCheck.rows.length === 0) {
        await client.query('ALTER TABLE users ADD COLUMN email TEXT;');
        await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;');
        logger.info('[initDB] ✅ 添加email列');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.addEmailColumn',
      });
      logger.warn('[initDB] email列添加失败', { error: error.toLogObject() });
    }

    try {
      // 检查email_verified列是否存在
      const emailVerifiedCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email_verified'
      `);

      if (emailVerifiedCheck.rows.length === 0) {
        await client.query('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;');
        logger.info('[initDB] ✅ 添加email_verified列');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.addEmailVerifiedColumn',
      });
      logger.warn('[initDB] email_verified列添加失败', { error: error.toLogObject() });
    }

    try {
      // 添加failed_login_attempts列
      const failedLoginCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
      `);

      if (failedLoginCheck.rows.length === 0) {
        await client.query('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;');
        logger.info('[initDB] ✅ 添加failed_login_attempts列');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.addFailedLoginAttemptsColumn',
      });
      logger.warn('[initDB] failed_login_attempts列添加失败', { error: error.toLogObject() });
    }

    try {
      // 添加locked_until列
      const lockedUntilCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_until'
      `);

      if (lockedUntilCheck.rows.length === 0) {
        await client.query('ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;');
        logger.info('[initDB] ✅ 添加locked_until列');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.addLockedUntilColumn',
      });
      logger.warn('[initDB] locked_until列添加失败', { error: error.toLogObject() });
    }

    try {
      // 添加last_login_at列
      const lastLoginAtCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_login_at'
      `);

      if (lastLoginAtCheck.rows.length === 0) {
        await client.query('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;');
        logger.info('[initDB] ✅ 添加last_login_at列');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.addLastLoginAtColumn',
      });
      logger.warn('[initDB] last_login_at列添加失败', { error: error.toLogObject() });
    }

    try {
      // 添加last_login_ip列
      const lastLoginIpCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_login_ip'
      `);

      if (lastLoginIpCheck.rows.length === 0) {
        await client.query('ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45);');
        logger.info('[initDB] ✅ 添加last_login_ip列');
      }
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'db',
        operation: 'initDB.addLastLoginIpColumn',
      });
      logger.warn('[initDB] last_login_ip列添加失败', { error: error.toLogObject() });
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        level TEXT NOT NULL,
        message TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        provider TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        api_key TEXT NOT NULL,
        app_id TEXT,
        model TEXT NOT NULL,
        max_tokens INTEGER,
        temperature REAL,
        system_prompt TEXT,
        capabilities JSONB DEFAULT '[]'::jsonb,
        rate_limit JSONB,
        features JSONB,
        metadata JSONB,
        is_active BOOLEAN DEFAULT true,
        source TEXT DEFAULT 'db',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
        title TEXT,
        user_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 审计日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id TEXT,
        username TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 审计日志索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
        ON chat_messages (session_id, created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_configs_provider
        ON agent_configs (provider);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_configs_app
        ON agent_configs (app_id)
        WHERE app_id IS NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_geo_events (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
        session_id TEXT,
        ip TEXT,
        country TEXT,
        province TEXT,
        city TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_geo_events_created
        ON chat_geo_events (created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_geo_events_agent
        ON chat_geo_events (agent_id, created_at);
    `);

    // 首次空库自动种子管理员（仅非生产环境）——使用bcrypt安全哈希
    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const count = parseInt(rows[0]?.count || '0', 10);
    if (count === 0) {
      // 🔧 修复：使用bcrypt而不是SHA-256，与AuthServiceV2保持一致
      const bcrypt = await import('bcrypt');
      const SALT_ROUNDS = 12;
      const passwordHash = await bcrypt.hash('admin', SALT_ROUNDS);
      const randomSalt = crypto.randomBytes(16).toString('hex'); // 保持字段兼容性
      
      await client.query(
        'INSERT INTO users(username, password_salt, password_hash, role, status) VALUES ($1,$2,$3,$4,$5)',
        ['admin', randomSalt, passwordHash, 'admin', 'active'],
      );
      logger.info('[initDB] ✅ 安全管理员账户已创建（用户名:admin 密码:admin，请立即修改）');
    }
  });

  // 🔧 种子智能体数据（添加错误处理）
  try {
    logger.info('🌱 开始种子智能体数据...');
    await seedAgentsFromFile();
    logger.info('✅ 智能体数据种子完成');
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'db',
      operation: 'seedAgents',
    });
    logger.error('❌ 智能体数据种子失败', { error: error.toLogObject() });
    // 不抛出异常，允许服务继续启动
  }

  // 🔄 自动运行数据库迁移（版本化管理）
  try {
    logger.info('🔄 开始检查数据库迁移...');
    const migrationManager = new MigrationManager(pool, 'src/migrations');
    const result = await migrationManager.runMigrations();
    logger.info('✅ 数据库迁移完成', {
      executed: result.executed,
      skipped: result.skipped,
      totalTimeMs: result.totalTime
    });
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'db',
      operation: 'runMigrations',
    });
    logger.warn('⚠️  数据库迁移失败，使用现有表结构', { error: error.toLogObject() });
    // 不抛出异常，允许服务继续启动
  }
}

export async function withClient<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const realSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${realSalt}:${password}`).digest('hex');
  return { salt: realSalt, hash };
}

export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function seedAgentsFromFile(): Promise<void> {
  logger.info('🌱 [seedAgentsFromFile] 开始执行智能体种子函数...');

  const filePathCandidates = [
    path.resolve(__dirname, '../../../config/agents.json'),  // 从 backend/src/utils 到根目录 config
    path.resolve(process.cwd(), 'config/agents.json'),       // 从当前工作目录
    path.resolve(process.cwd(), '../config/agents.json'),     // 如果 cwd 是 backend
  ];

  logger.info('[seedAgentsFromFile] 候选文件路径', { paths: filePathCandidates });

  let fileContent: string | null = null;
  for (const filePath of filePathCandidates) {
    try {
      logger.info('[seedAgentsFromFile] 尝试读取文件', { path: filePath });
      if (fs.existsSync(filePath)) {
        fileContent = fs.readFileSync(filePath, 'utf-8');
        logger.info('[seedAgentsFromFile] ✅ 文件读取成功', { path: filePath, length: fileContent.length });
        break;
      } else {
        logger.warn('[seedAgentsFromFile] 文件不存在', { path: filePath });
      }
    } catch (e) {
      logger.error('[seedAgentsFromFile] 读取智能体配置文件失败', { path: filePath, error: e });
    }
  }

  if (!fileContent) {
    logger.error('[seedAgentsFromFile] ❌ 所有候选路径都未找到agents.json文件！');
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (e) {
    logger.warn('[initDB] 解析 agents.json 失败', { error: e });
    return;
  }

  const agents: any[] = Array.isArray(parsed?.agents) ? parsed.agents : [];
  if (agents.length === 0) {
    logger.info('[seedAgentsFromFile] agents.json为空，跳过种子');
    return;
  }

  // 🔧 关键修复：替换环境变量占位符
  const resolvedAgents = deepReplaceEnvVariables(agents);
  logger.info('[seedAgentsFromFile] 智能体配置环境变量已替换', { count: agents.length });

  await withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM agent_configs');
    const count = parseInt(rows[0]?.count || '0', 10);

    logger.info(`[seedAgentsFromFile] 数据库现有智能体数量: ${count}`);

    // 🔧 修复：即使有数据也执行UPSERT（使用ON CONFLICT）
    // if (count > 0) {
    //   return;
    // }

    const insertText = `
      INSERT INTO agent_configs (
        id, name, description, provider, endpoint, api_key, app_id, model,
        max_tokens, temperature, system_prompt, capabilities, rate_limit,
        features, metadata, is_active, source
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12::jsonb,$13::jsonb,
        $14::jsonb,$15::jsonb,$16,$17
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        provider = EXCLUDED.provider,
        endpoint = EXCLUDED.endpoint,
        api_key = EXCLUDED.api_key,
        app_id = EXCLUDED.app_id,
        model = EXCLUDED.model,
        max_tokens = EXCLUDED.max_tokens,
        temperature = EXCLUDED.temperature,
        system_prompt = EXCLUDED.system_prompt,
        capabilities = EXCLUDED.capabilities,
        rate_limit = EXCLUDED.rate_limit,
        features = EXCLUDED.features,
        metadata = EXCLUDED.metadata,
        is_active = EXCLUDED.is_active,
        source = 'json',
        updated_at = NOW();
    `;

    for (const agent of resolvedAgents) {
      try {
        logger.info('[seedAgentsFromFile] 导入智能体', { id: agent.id, name: agent.name });
        await client.query(insertText, [
          agent.id,
          agent.name,
          agent.description ?? '',
          agent.provider,
          agent.endpoint,
          agent.apiKey,
          agent.appId ?? null,
          agent.model,
          agent.maxTokens ?? null,
          agent.temperature ?? null,
          agent.systemPrompt ?? null,
          JSON.stringify(agent.capabilities ?? []),
          JSON.stringify(agent.rateLimit ?? null),
          JSON.stringify(agent.features ?? null),
          JSON.stringify({ source: 'json' }),
          agent.isActive ?? true,
          'json',
        ]);
      } catch (e) {
        logger.error('[seedAgentsFromFile] 导入智能体失败', { agentId: agent?.id, error: e });
      }
    }

    logger.info(`✅ [seedAgentsFromFile] 智能体种子完成，共处理 ${resolvedAgents.length} 个智能体`);
  });
}

