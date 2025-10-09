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
import { PgConfig, normalizePostgresConfig } from '../utils/db';
import { resolveEnvInJsonc } from '../utils/envResolver';
import fs from 'fs';
import path from 'path';

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
    console.error('❌ 错误: 数据库配置缺失 (config.jsonc -> database.postgres)');
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
        console.log('🚀 执行数据库迁移...\n');
        const result = await manager.migrateUp();
        
        if (result.executed.length === 0) {
          console.log('✅ 数据库已是最新状态 (跳过 %d 个迁移)\n', result.skipped);
        } else {
          console.log('\n✅ 成功执行 %d 个迁移:\n', result.executed.length);
          result.executed.forEach(m => {
            console.log('  - %s: %s', m.version, m.name);
          });
          console.log('');
        }
        break;
      }

      case 'down': {
        const steps = parseInt(args[1] || '1', 10);
        if (isNaN(steps) || steps < 1) {
          console.error('❌ 错误: 无效的回滚步数 "%s"', args[1]);
          process.exit(1);
        }

        console.log('🔄 回滚最后 %d 个迁移...\n', steps);
        const rolledBack = await manager.migrateDown(steps);
        
        if (rolledBack.length === 0) {
          console.log('✅ 没有可回滚的迁移\n');
        } else {
          console.log('\n✅ 成功回滚 %d 个迁移:\n', rolledBack.length);
          rolledBack.forEach(m => {
            console.log('  - %s: %s', m.version, m.name);
          });
          console.log('');
        }
        break;
      }

      case 'status': {
        const status = await manager.getStatus();
        
        console.log('📊 数据库迁移状态\n');
        console.log('总迁移数: %d', status.total);
        console.log('已执行: %d', status.executed.length);
        console.log('待执行: %d\n', status.pending.length);

        if (status.executed.length > 0) {
          console.log('✅ 已执行的迁移:\n');
          status.executed.forEach(m => {
            const date = new Date(m.executed_at).toLocaleString('zh-CN');
            console.log('  %s: %s (执行时间: %s)', m.version, m.name, date);
          });
          console.log('');
        }

        if (status.pending.length > 0) {
          console.log('⏳ 待执行的迁移:\n');
          status.pending.forEach(m => {
            console.log('  %s: %s', m.version, m.name);
          });
          console.log('');
        }
        break;
      }

      case 'mark': {
        const version = args[1];
        const name = args[2];
        
        if (!version || !name) {
          console.error('❌ 错误: 缺少参数\n');
          console.log('用法: npm run migrate mark <version> <name>');
          console.log('示例: npm run migrate mark 001 "create users table"');
          process.exit(1);
        }

        await manager.markAsExecuted(version, name);
        console.log('✅ 迁移 %s (%s) 已标记为已执行\n', version, name);
        break;
      }

      default: {
        console.error('❌ 未知命令: %s\n', command);
        console.log('可用命令:');
        console.log('  up          - 执行所有待执行的迁移');
        console.log('  down [n]    - 回滚最后n次迁移 (默认 1)');
        console.log('  status      - 查看迁移状态');
        console.log('  mark <version> <name> - 标记迁移为已执行');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\n❌ 迁移失败:', error instanceof Error ? error.message : String(error));
    console.error('');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

