#!/usr/bin/env node
/**
 * 数据库迁移CLI工具
 * Usage:
 *   npm run migrate up          - 执行所有待执行的迁移
 *   npm run migrate down [n]    - 回滚最后n次迁移 (默认 1)
 *   npm run migrate status      - 查看迁移状态
 *   npm run migrate mark <version> <name> - 标记迁移为已执行
 */

import { Pool } from 'pg';
import { readJsonc } from '../utils/config';
import { createMigrationManager } from '../utils/migrate';
import type { PgConfig} from '../utils/db';
import { normalizePostgresConfig } from '../utils/db';
import { resolveEnvInJsonc } from '../utils/envResolver';
import fs from 'fs';
import path from 'path';
import { logger } from '@/utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  // 加载配置
  const configPath = path.resolve(__dirname, '../../../config/config.jsonc');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const resolvedConfig = resolveEnvInJsonc(configContent);
  const cfg = JSON.parse(resolvedConfig) as PgConfig;

  const rawPg = cfg.database?.postgres;
  if (!rawPg) {
    logger.error('❌ 错误: 数据库配置缺失 (config.jsonc -> database.postgres)');
    process.exit(1);
  }

  const pg = normalizePostgresConfig(rawPg);

  // 创建连接池
  const pool = new Pool({
    host: pg.host,
    port: pg.port ?? 5432,
    user: pg.user,
    password: pg.password,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } : undefined,
  });

  const manager = createMigrationManager(pool);

  try {
    switch (command) {
      case 'up': {
        logger.debug('🚀 执行数据库迁移...\n');
        const result = await manager.migrateUp();

        if (result.executed.length === 0) {
          logger.debug('✅ 数据库已是最新状态 (跳过 %d 个迁移)\n', result.skipped);
        } else {
          logger.debug('\n✅ 成功执行 %d 个迁移:\n', result.executed.length);
          result.executed.forEach(m => {
            logger.debug('  - %s: %s', m.version, m.name);
          });
          logger.debug('');
        }
        break;
      }

      case 'down': {
        const steps = parseInt(args[1] || '1', 10);
        if (isNaN(steps) || steps < 1) {
          logger.error('❌ 错误: 无效的回滚步数 "%s"', args[1]);
          process.exit(1);
        }

        logger.debug('🔄 回滚最后 %d 个迁移...\n', steps);
        const rolledBack = await manager.migrateDown(steps);

        if (rolledBack.length === 0) {
          logger.debug('✅ 没有可回滚的迁移\n');
        } else {
          logger.debug('\n✅ 成功回滚 %d 个迁移:\n', rolledBack.length);
          rolledBack.forEach(m => {
            logger.debug('  - %s: %s', m.version, m.name);
          });
          logger.debug('');
        }
        break;
      }

      case 'status': {
        const status = await manager.getStatus();

        logger.debug('📊 数据库迁移状态\n');
        logger.debug('总迁移数: %d', status.total);
        logger.debug('已执行: %d', status.executed.length);
        logger.debug('待执行: %d\n', status.pending.length);

        if (status.executed.length > 0) {
          logger.debug('✅ 已执行的迁移:\n');
          status.executed.forEach(m => {
            const date = new Date(m.executed_at).toLocaleString('zh-CN');
            logger.debug('  %s: %s (执行时间: %s)', m.version, m.name, date);
          });
          logger.debug('');
        }

        if (status.pending.length > 0) {
          logger.debug('⏳ 待执行的迁移:\n');
          status.pending.forEach(m => {
            logger.debug('  %s: %s', m.version, m.name);
          });
          logger.debug('');
        }
        break;
      }

      case 'mark': {
        const version = args[1];
        const name = args[2];

        if (!version || !name) {
          logger.error('❌ 错误: 缺少参数\n');
          logger.debug('用法: npm run migrate mark <version> <name>');
          logger.debug('示例: npm run migrate mark 001 "create users table"');
          process.exit(1);
        }

        await manager.markAsExecuted(version, name);
        logger.debug('✅ 迁移 %s (%s) 已标记为已执行\n', version, name);
        break;
      }

      default: {
        logger.error('❌ 未知命令: %s\n', command);
        logger.debug('可用命令:');
        logger.debug('  up          - 执行所有待执行的迁移');
        logger.debug('  down [n]    - 回滚最后n次迁移 (默认 1)');
        logger.debug('  status      - 查看迁移状态');
        logger.debug('  mark <version> <name> - 标记迁移为已执行');
        process.exit(1);
      }
    }
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'migrate',
      operation: 'main',
    });
    logger.error('\n❌ 迁移失败:', error.message);
    logger.error('');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

