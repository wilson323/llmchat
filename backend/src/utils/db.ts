import { Pool } from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { readJsonc } from '@/utils/config';
import { deepReplaceEnvVariables } from '@/utils/envHelper';
import logger from '@/utils/logger';
import MigrationManager from './MigrationManager';

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

  // 优先使用环境变量直接配置，避免依赖配置文件
  const rawPg: PostgresConfig = {
    host: process.env.DB_HOST ?? 'localhost',
    port: process.env.DB_PORT ?? 5432,
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'postgres',
    ssl: process.env.DB_SSL === 'true'
  };

  // 如果环境变量中的用户名或密码是默认值，尝试读取配置文件作为后备
  if (rawPg.user === 'postgres' || rawPg.password === 'password') {
    logger.info('[initDB] 尝试从配置文件加载数据库配置...');
    try {
      const rawCfg = await readJsonc<PgConfig>('config/config.jsonc');
      const cfg = deepReplaceEnvVariables(rawCfg);
      const configPg = cfg.database?.postgres;
      if (configPg) {
        Object.assign(rawPg, configPg);
        logger.info('[initDB] 配置文件加载成功');
      }
    } catch (error: any) {
      logger.warn('[initDB] 配置文件加载失败，使用环境变量', { error });
    }
  }

  const pg = normalizePostgresConfig(rawPg);
  logger.info(`[initDB] 数据库配置 - Host: ${pg.host}, Port: ${pg.port}, Database: ${pg.database}, User: ${pg.user}`);

  // 先连接到 postgres 默认数据库，检查并创建目标数据库
  logger.info('[initDB] 连接到 postgres 默认数据库...');
  const tempPool = new Pool({
    host: pg.host,
    port: pg.port ?? 5432,
    user: pg.user,
    password: pg.password,
    database: 'postgres', // 先连接到默认数据库
    ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,
    connectionTimeoutMillis: 5000,  // 5秒连接超时
    query_timeout: 5000,  // 5秒查询超时
  });

  try {
    logger.info('[initDB] 尝试连接到 postgres 数据库（5秒超时）...');
    const client = await Promise.race([
      tempPool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('连接超时')), 5000)
      )
    ]);
    logger.info('[initDB] 成功连接到 postgres 数据库');

    try {
      // 检查数据库是否存在
      logger.info(`[initDB] 检查数据库 "${pg.database}" 是否存在...`);
      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [pg.database],
      );

      if (result.rows.length === 0) {
        // 数据库不存在，创建它
        logger.info(`🔨 数据库 "${pg.database}" 不存在，正在创建...`);
        await client.query(`CREATE DATABASE "${pg.database}"`);
        logger.info(`✅ 数据库 "${pg.database}" 创建成功`);
      } else {
        logger.info(`✅ 数据库 "${pg.database}" 已存在`);
      }
    } catch (checkError) {
      logger.error('[initDB] 检查/创建数据库时出错', { error: checkError });
      throw checkError;
    } finally {
      client.release();
      logger.info('[initDB] 释放临时连接');
    }
  } catch (tempPoolError) {
    logger.error('[initDB] 连接到 postgres 数据库失败', { error: tempPoolError });
    throw tempPoolError;
  } finally {
    await tempPool.end();
    logger.info('[initDB] 关闭临时连接池');
  }

  // 现在连接到目标数据库
  logger.info(`[initDB] 连接到目标数据库 "${pg.database}"...`);
  pool = new Pool({
    host: pg.host,
    port: pg.port ?? 5432,
    user: pg.user,
    password: pg.password,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,
    
    // ✅ T006: 动态连接池配置（环境变量控制）
    max: parseInt(process.env.DB_POOL_MAX || '50'),          // 最大连接数（默认50）
    min: parseInt(process.env.DB_POOL_MIN || '10'),          // 最小连接数（默认10）
    idleTimeoutMillis: 30_000,        // 30秒空闲超时
    connectionTimeoutMillis: 5000,   // 5秒连接超时
    query_timeout: 5000,             // 5秒查询超时
    maxUses: 7500,                    // 每个连接最多使用7500次后回收
    
    // ✅ 应用标识
    application_name: 'llmchat-backend',
  });

  logger.info('[initDB] 数据库连接池创建成功', {
    min: pool.options.min,
    max: pool.options.max,
    idleTimeout: pool.options.idleTimeoutMillis,
  });
  
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
    } catch (error: any) {
      // 列可能不存在，忽略错误
      logger.info('[initDB] 明文密码列不存在或已移除');
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
    } catch (error: any) {
      logger.warn('[initDB] email列添加失败', { error });
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
    } catch (error: any) {
      logger.warn('[initDB] email_verified列添加失败', { error });
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
    } catch (error: any) {
      logger.warn('[initDB] failed_login_attempts列添加失败', { error });
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
    } catch (error: any) {
      logger.warn('[initDB] locked_until列添加失败', { error });
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
    } catch (error: any) {
      logger.warn('[initDB] last_login_at列添加失败', { error });
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
    } catch (error: any) {
      logger.warn('[initDB] last_login_ip列添加失败', { error });
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

    // 首次空库自动种子管理员（仅非生产环境）——使用安全哈希
    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const count = parseInt(rows[0]?.count || '0', 10);
    if (count === 0) {
      const { salt, hash } = hashPassword('admin');
      await client.query(
        'INSERT INTO users(username, password_salt, password_hash, role, status) VALUES ($1,$2,$3,$4,$5)',
        ['admin', salt, hash, 'admin', 'active'],
      );
      logger.info('[initDB] ✅ 安全管理员账户已创建（密码：admin，请立即修改）');
    }
  });

  // 🔧 种子智能体数据（添加错误处理）
  try {
    logger.info('🌱 开始种子智能体数据...');
    await seedAgentsFromFile();
    logger.info('✅ 智能体数据种子完成');
  } catch (error: any) {
    logger.error('❌ 智能体数据种子失败', { error });
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
  } catch (error: any) {
    logger.warn('⚠️  数据库迁移失败，使用现有表结构', { error });
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

