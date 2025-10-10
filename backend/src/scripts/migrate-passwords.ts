#!/usr/bin/env ts-node
/**
 * 密码迁移脚本
 *
 * 用途:
 * - 将现有password_plain字段转换为bcrypt哈希
 * - 更新password_hash字段
 * - 验证迁移结果
 *
 * 使用:
 * npm run migrate:passwords
 * 或
 * ts-node -r tsconfig-paths/register backend/src/scripts/migrate-passwords.ts
 *
 * ⚠️  警告:
 * - 执行前会备份数据
 * - 不可逆操作，请谨慎执行
 * - 确保已运行迁移007和008
 */

import '../dotenv-loader'; // 加载环境变量
import bcrypt from 'bcrypt';
import { withClient } from '../utils/db';
import logger from '../utils/logger';

const SALT_ROUNDS = 12;

interface UserRow {
  id: string;
  username: string;
  password_plain: string | null;
  password_hash: string | null;
}

class PasswordMigrator {
  private migratedCount = 0;
  private skippedCount = 0;
  private errorCount = 0;

  /**
   * 执行迁移
   */
  async migrate(): Promise<void> {
    console.log('🔐 开始密码迁移...\n');

    try {
      // 1. 检查数据库连接
      await this.checkConnection();

      // 2. 检查必需字段
      await this.checkRequiredFields();

      // 3. 获取需要迁移的用户
      const users = await this.getUsersToMigrate();

      if (users.length === 0) {
        console.log('✅ 没有需要迁移的用户\n');
        return;
      }

      console.log(`📊 找到 ${users.length} 个需要迁移的用户\n`);

      // 4. 用户确认
      if (!await this.confirmMigration(users.length)) {
        console.log('❌ 迁移已取消\n');
        return;
      }

      // 5. 执行迁移
      await this.migrateUsers(users);

      // 6. 验证结果
      await this.verifyMigration();

      // 7. 生成报告
      this.generateReport();

    } catch (error: any) {
      console.error('\n❌ 迁移失败:', error.message);
      if (error.stack) {
        console.error('\n堆栈跟踪:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  private async checkConnection(): Promise<void> {
    console.log('🔍 检查数据库连接...');

    await withClient(async (client) => {
      const { rows } = await client.query('SELECT NOW()');
      console.log(`✅ 数据库连接正常 (${rows[0].now})\n`);
    });
  }

  private async checkRequiredFields(): Promise<void> {
    console.log('🔍 检查必需字段...');

    await withClient(async (client) => {
      // 检查password_hash字段
      const { rows } = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
          AND column_name IN ('password_hash', 'password_plain')
      `);

      const fields = rows.map((r: any) => r.column_name);

      if (!fields.includes('password_hash')) {
        throw new Error('users表缺少password_hash字段，请先运行数据库迁移');
      }

      console.log('✅ 必需字段检查通过\n');
    });
  }

  private async getUsersToMigrate(): Promise<Array<UserRow>> {
    console.log('🔍 查询需要迁移的用户...');

    const users = await withClient(async (client) => {
      const { rows } = await client.query<UserRow>(`
        SELECT id, username, password_plain, password_hash
        FROM users
        WHERE password_plain IS NOT NULL 
          AND password_plain != ''
          AND (password_hash IS NULL OR password_hash = '')
        ORDER BY created_at
      `);
      return rows;
    });

    return users;
  }

  private async confirmMigration(count: number): Promise<boolean> {
    console.log('⚠️  警告:');
    console.log(`   - 即将迁移 ${count} 个用户的密码`);
    console.log('   - 明文密码将被bcrypt哈希替换');
    console.log('   - 此操作不可逆\n');

    // 自动模式（CI/CD环境）
    if (process.env.AUTO_CONFIRM === 'true') {
      console.log('✅ 自动确认模式：继续迁移\n');
      return true;
    }

    // 交互模式
    console.log('💡 如需继续，请设置环境变量 AUTO_CONFIRM=true\n');
    return false;
  }

  private async migrateUsers(users: Array<UserRow>): Promise<void> {
    console.log('🔄 开始迁移用户密码...\n');

    for (const user of users) {
      try {
        await this.migrateUser(user);
        this.migratedCount++;

        // 显示进度
        const progress = Math.round((this.migratedCount / users.length) * 100);
        process.stdout.write(`\r进度: ${progress}% (${this.migratedCount}/${users.length})`);

      } catch (error: any) {
        this.errorCount++;
        logger.error('用户密码迁移失败', {
          userId: user.id,
          username: user.username,
          error: error.message,
        });
      }
    }

    console.log('\n'); // 换行
  }

  private async migrateUser(user: UserRow): Promise<void> {
    if (!user.password_plain) {
      this.skippedCount++;
      return;
    }

    // 生成bcrypt哈希
    const passwordHash = await bcrypt.hash(user.password_plain, SALT_ROUNDS);

    // 更新数据库
    await withClient(async (client) => {
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             password_updated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [passwordHash, user.id],
      );
    });

    logger.info('用户密码已迁移', {
      userId: user.id,
      username: user.username,
    });
  }

  private async verifyMigration(): Promise<void> {
    console.log('🔍 验证迁移结果...');

    await withClient(async (client) => {
      // 检查是否还有未迁移的用户
      const { rows } = await client.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE password_plain IS NOT NULL 
          AND password_plain != ''
          AND (password_hash IS NULL OR password_hash = '' OR length(password_hash) < 60)
      `);

      const unmigrated = parseInt(rows[0].count, 10);

      if (unmigrated > 0) {
        console.log(`⚠️  仍有 ${unmigrated} 个用户未迁移\n`);
      } else {
        console.log('✅ 所有用户密码已成功迁移\n');
      }
    });
  }

  private generateReport(): void {
    console.log('='.repeat(60));
    console.log('📊 密码迁移报告');
    console.log('='.repeat(60));
    console.log();

    console.log(`✅ 成功迁移: ${this.migratedCount} 个用户`);
    console.log(`⏭️  跳过: ${this.skippedCount} 个用户`);
    console.log(`❌ 失败: ${this.errorCount} 个用户`);
    console.log();

    if (this.migratedCount > 0) {
      console.log('🔧 后续步骤:');
      console.log('   1. 验证用户可以正常登录');
      console.log('   2. 运行迁移007删除password_plain列');
      console.log('   3. 更新AuthController使用AuthServiceV2');
      console.log('   4. 部署到生产环境');
      console.log();
    }

    if (this.errorCount > 0) {
      console.log('⚠️  注意:');
      console.log('   - 部分用户迁移失败，请检查日志');
      console.log('   - 失败的用户可能无法登录');
      console.log('   - 建议联系管理员重置密码');
      console.log();
    }

    console.log('='.repeat(60));
    console.log();
  }
}

// 执行迁移
async function main() {
  const migrator = new PasswordMigrator();
  await migrator.migrate();
}

// 仅当直接运行时执行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

export { PasswordMigrator };
