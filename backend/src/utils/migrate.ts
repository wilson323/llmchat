/**
 * 数据库迁移管理工具
 * 提供版本化的数据库schema管理,支持migrate up/down
 */

import type { Pool, PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import logger from '@/utils/logger';

export interface Migration {
  version: string;
  name: string;
  up: string;
  down?: string;
  timestamp: Date;
}

export interface MigrationRecord {
  version: string;
  name: string;
  executed_at: Date;
}

export class MigrationManager {
  private readonly pool: Pool;
  private readonly migrationsDir: string;

  constructor(pool: Pool, migrationsDir?: string) {
    this.pool = pool;
    this.migrationsDir = migrationsDir || path.join(__dirname, '../migrations');
  }

  /**
   * 确保迁移跟踪表存在
   */
  private async ensureMigrationTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at
        ON schema_migrations(executed_at DESC);
    `);
  }

  /**
   * 获取已执行的迁移列表
   */
  private async getExecutedMigrations(client: PoolClient): Promise<string[]> {
    const result = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC',
    );
    return result.rows.map(row => row.version);
  }

  /**
   * 记录迁移执行
   */
  private async recordMigration(client: PoolClient, migration: Migration): Promise<void> {
    await client.query(
      'INSERT INTO schema_migrations (version, name, executed_at) VALUES ($1, $2, NOW())',
      [migration.version, migration.name],
    );
  }

  /**
   * 删除迁移记录
   */
  private async unrecordMigration(client: PoolClient, version: string): Promise<void> {
    await client.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [version],
    );
  }

  /**
   * 从文件系统加载所有迁移脚本
   */
  private async loadMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

      const migrations: Migration[] = [];

      for (const file of sqlFiles) {
        // 文件名格式: 001_create_users.sql
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (!match) {
          logger.warn(`迁移文件名格式不正确,跳过: ${file}`, { component: 'MigrationManager' });
          continue;
        }

        const [, version, name] = match;

        if (!version || !name) {
          logger.warn(`迁移文件解析失败: ${file}`, { component: 'MigrationManager' });
          continue;
        }

        const filePath = path.join(this.migrationsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // 支持 -- UP 和 -- DOWN 分隔符
        const parts = content.split(/-- DOWN/i);
        const upPart = parts[0];

        if (!upPart) {
          logger.warn(`迁移文件缺少 UP 部分: ${file}`, { component: 'MigrationManager' });
          continue;
        }

        const upSQL = upPart.replace(/-- UP/i, '').trim();
        const downSQL = parts[1]?.trim();

        const migration: Migration = {
          version,
          name: name.replace(/_/g, ' '),
          up: upSQL,
          timestamp: new Date(),
        };

        if (downSQL) {
          migration.down = downSQL;
        }

        migrations.push(migration);
      }

      return migrations;
    } catch (error: any) {
      logger.error('加载迁移脚本失败', { component: 'MigrationManager', error });
      throw error;
    }
  }

  /**
   * 执行所有待执行的迁移 (migrate up)
   */
  async migrateUp(): Promise<{ executed: Migration[]; skipped: number }> {
    const client = await this.pool.connect();
    try {
      await this.ensureMigrationTable(client);
      const executedVersions = await this.getExecutedMigrations(client);
      const allMigrations = await this.loadMigrations();

      const pendingMigrations = allMigrations.filter(
        m => !executedVersions.includes(m.version),
      );

      if (pendingMigrations.length === 0) {
        logger.info('没有待执行的迁移', { component: 'MigrationManager' });
        return { executed: [], skipped: allMigrations.length };
      }

      const executed: Migration[] = [];

      for (const migration of pendingMigrations) {
        logger.info(`执行迁移: ${migration.version} - ${migration.name}`, {
          component: 'MigrationManager',
        });

        try {
          await client.query('BEGIN');
          await client.query(migration.up);
          await this.recordMigration(client, migration);
          await client.query('COMMIT');

          executed.push(migration);
          logger.info(`迁移成功: ${migration.version} - ${migration.name}`, {
            component: 'MigrationManager',
          });
        } catch (error: any) {
          await client.query('ROLLBACK');
          logger.error(`迁移失败: ${migration.version} - ${migration.name}`, {
            component: 'MigrationManager',
            error,
          });
          throw new Error(
            `Migration ${migration.version} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return {
        executed,
        skipped: allMigrations.length - pendingMigrations.length,
      };
    } finally {
      client.release();
    }
  }

  /**
   * 回滚最后一次迁移 (migrate down)
   */
  async migrateDown(steps = 1): Promise<Migration[]> {
    const client = await this.pool.connect();
    try {
      await this.ensureMigrationTable(client);
      const executedVersions = await this.getExecutedMigrations(client);

      if (executedVersions.length === 0) {
        logger.info('没有可回滚的迁移', { component: 'MigrationManager' });
        return [];
      }

      const allMigrations = await this.loadMigrations();
      const versionsToRollback = executedVersions.slice(-steps).reverse();
      const rolledBack: Migration[] = [];

      for (const version of versionsToRollback) {
        const migration = allMigrations.find(m => m.version === version);
        if (!migration) {
          logger.warn(`找不到迁移脚本: ${version}`, { component: 'MigrationManager' });
          continue;
        }

        if (!migration.down) {
          throw new Error(`Migration ${version} does not have a DOWN script`);
        }

        logger.info(`回滚迁移: ${migration.version} - ${migration.name}`, {
          component: 'MigrationManager',
        });

        try {
          await client.query('BEGIN');
          await client.query(migration.down);
          await this.unrecordMigration(client, version);
          await client.query('COMMIT');

          rolledBack.push(migration);
          logger.info(`回滚成功: ${migration.version} - ${migration.name}`, {
            component: 'MigrationManager',
          });
        } catch (error: any) {
          await client.query('ROLLBACK');
          logger.error(`回滚失败: ${migration.version} - ${migration.name}`, {
            component: 'MigrationManager',
            error,
          });
          throw new Error(
            `Migration rollback ${version} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return rolledBack;
    } finally {
      client.release();
    }
  }

  /**
   * 获取迁移状态
   */
  async getStatus(): Promise<{
    executed: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    const client = await this.pool.connect();
    try {
      await this.ensureMigrationTable(client);
      const executedVersions = await this.getExecutedMigrations(client);
      const allMigrations = await this.loadMigrations();

      const executedResult = await client.query<MigrationRecord>(
        'SELECT version, name, executed_at FROM schema_migrations ORDER BY version ASC',
      );

      const pending = allMigrations.filter(m => !executedVersions.includes(m.version));

      return {
        executed: executedResult.rows,
        pending,
        total: allMigrations.length,
      };
    } finally {
      client.release();
    }
  }

  /**
   * 强制将特定迁移标记为已执行（危险操作,谨慎使用）
   */
  async markAsExecuted(version: string, name: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await this.ensureMigrationTable(client);
      await client.query(
        'INSERT INTO schema_migrations (version, name, executed_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
        [version, name],
      );
      logger.info(`迁移 ${version} 已标记为已执行`, { component: 'MigrationManager' });
    } finally {
      client.release();
    }
  }
}

/**
 * 创建迁移管理器实例
 */
export function createMigrationManager(pool: Pool, migrationsDir?: string): MigrationManager {
  return new MigrationManager(pool, migrationsDir);
}

