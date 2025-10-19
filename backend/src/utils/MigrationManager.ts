/**
 * 数据库迁移管理器
 *
 * 功能：
 * - 自动检测并创建数据库
 * - 版本化迁移管理
 * - 表结构自动同步
 * - 事务保证和回滚支持
 */

import type { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import logger from './logger';
import { createErrorFromUnknown } from '@/types/errors';

export interface MigrationRecord {
  id: number;
  version: number;
  name: string;
  executed_at: Date;
  execution_time_ms: number;
  checksum: string;
}

export interface MigrationFile {
  version: number;
  name: string;
  filepath: string;
  sql: string;
  checksum: string;
}

export class MigrationManager {
  private readonly pool: Pool;
  private readonly migrationsDir: string;

  constructor(pool: Pool, migrationsDir = 'src/migrations') {
    this.pool = pool;
    this.migrationsDir = path.resolve(process.cwd(), migrationsDir);
  }

  /**
   * 确保迁移表存在
   */
  private async ensureMigrationsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        execution_time_ms INTEGER,
        checksum VARCHAR(64)
      );
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
    `);
    logger.info('[Migration] ✅ 迁移表已就绪');
  }

  /**
   * 获取已执行的迁移
   */
  private async getExecutedMigrations(client: PoolClient): Promise<Set<number>> {
    const result = await client.query<{version: number}>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return new Set(result.rows.map(r => r.version));
  }

  /**
   * 读取迁移文件
   */
  private async loadMigrationFiles(): Promise<MigrationFile[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn(`[Migration] 迁移目录不存在: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const migrations: MigrationFile[] = [];

    for (const file of files) {
      // 解析文件名格式: 001_initial_schema.sql
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match?.[1] || !match[2]) {
        logger.warn(`[Migration] 跳过无效文件名: ${file}`);
        continue;
      }

      const versionStr = match[1];
      const name = match[2];
      const version = parseInt(versionStr, 10);
      const filepath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filepath, 'utf-8');

      // 计算校验和
      const crypto = await import('crypto');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      migrations.push({
        version,
        name,
        filepath,
        sql,
        checksum
      });
    }

    return migrations;
  }

  /**
   * 执行单个迁移
   */
  private async executeMigration(
    client: PoolClient,
    migration: MigrationFile
  ): Promise<number> {
    const startTime = Date.now();

    try {
      logger.info(`[Migration] 执行迁移 ${migration.version}: ${migration.name}`);

      // 执行迁移SQL
      await client.query(migration.sql);

      const executionTime = Date.now() - startTime;

      // 记录迁移
      await client.query(
        `INSERT INTO schema_migrations (version, name, execution_time_ms, checksum)
         VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.name, executionTime, migration.checksum]
      );

      logger.info(`[Migration] ✅ 迁移 ${migration.version} 完成 (${executionTime}ms)`);
      return executionTime;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'MigrationManager',
        operation: 'executeMigration',
      });
      logger.error(`[Migration] ❌ 迁移 ${migration.version} 失败`, { error: error.toLogObject() });
      throw error;
    }
  }

  /**
   * 运行所有待执行的迁移
   */
  public async runMigrations(): Promise<{
    executed: number;
    skipped: number;
    totalTime: number;
  }> {
    const client = await this.pool.connect();
    let executed = 0;
    let skipped = 0;
    let totalTime = 0;

    try {
      // 开始事务
      await client.query('BEGIN');

      // 确保迁移表存在
      await this.ensureMigrationsTable(client);

      // 获取已执行的迁移
      const executedVersions = await this.getExecutedMigrations(client);
      logger.info(`[Migration] 已执行的迁移数: ${executedVersions.size}`);

      // 加载迁移文件
      const migrations = await this.loadMigrationFiles();
      logger.info(`[Migration] 发现迁移文件: ${migrations.length}个`);

      // 执行待处理的迁移
      for (const migration of migrations) {
        if (executedVersions.has(migration.version)) {
          skipped++;
          logger.debug(`[Migration] 跳过已执行的迁移 ${migration.version}: ${migration.name}`);
          continue;
        }

        const execTime = await this.executeMigration(client, migration);
        totalTime += execTime;
        executed++;
      }

      // 提交事务
      await client.query('COMMIT');

      logger.info('[Migration] 🎉 迁移执行完成', {
        executed,
        skipped,
        totalTimeMs: totalTime
      });

      return { executed, skipped, totalTime };
    } catch (unknownError: unknown) {
      // 回滚事务
      await client.query('ROLLBACK');
      const error = createErrorFromUnknown(unknownError, {
        component: 'MigrationManager',
        operation: 'runMigrations',
      });
      logger.error('[Migration] ❌ 迁移执行失败，已回滚', { error: error.toLogObject() });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取迁移状态
   */
  public async getMigrationStatus(): Promise<{
    executed: MigrationRecord[];
    pending: MigrationFile[];
  }> {
    const client = await this.pool.connect();

    try {
      // 确保表存在
      await this.ensureMigrationsTable(client);

      // 获取已执行的迁移
      const result = await client.query<MigrationRecord>(
        'SELECT * FROM schema_migrations ORDER BY version'
      );
      const executedVersions = new Set(result.rows.map(r => r.version));

      // 获取待执行的迁移
      const allMigrations = await this.loadMigrationFiles();
      const pending = allMigrations.filter(m => !executedVersions.has(m.version));

      return {
        executed: result.rows,
        pending
      };
    } finally {
      client.release();
    }
  }

  /**
   * 验证迁移完整性
   */
  public async validateMigrations(): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await this.ensureMigrationsTable(client);

      const result = await client.query<{version: number; checksum: string}>(
        'SELECT version, checksum FROM schema_migrations ORDER BY version'
      );

      const migrations = await this.loadMigrationFiles();
      const migrationsMap = new Map(migrations.map(m => [m.version, m]));

      for (const record of result.rows) {
        const migration = migrationsMap.get(record.version);
        if (!migration) {
          logger.error(`[Migration] ❌ 缺少迁移文件 version ${record.version}`);
          return false;
        }

        if (migration.checksum !== record.checksum) {
          logger.error(`[Migration] ❌ 迁移文件 ${record.version} 校验和不匹配`);
          return false;
        }
      }

      logger.info('[Migration] ✅ 所有迁移文件校验通过');
      return true;
    } finally {
      client.release();
    }
  }
}

export default MigrationManager;


