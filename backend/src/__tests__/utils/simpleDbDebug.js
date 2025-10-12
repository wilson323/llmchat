/**
 * 简化的数据库模式调试工具
 */

const { Pool } = require('pg');

const testDbConfig = {
  host: '106.63.8.99',
  port: 5432,
  database: 'postgres',
  user: 'username',
  password: 'password',
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

async function debugDatabaseSchema() {
  const pool = new Pool(testDbConfig);
  const client = await pool.connect();

  try {
    console.log('=== 数据库连接信息 ===');
    console.log('Host:', testDbConfig.host);
    console.log('Port:', testDbConfig.port);
    console.log('Database:', testDbConfig.database);

    console.log('\n=== 检查数据库表是否存在 ===');
    const tablesResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('数据库表:');
    tablesResult.rows.forEach((row) => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });

    console.log('\n=== 检查users表结构 ===');
    const usersTableExists = tablesResult.rows.some((row) => row.table_name === 'users');

    if (usersTableExists) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      console.log('users表列结构:');
      columnsResult.rows.forEach((col) => {
        console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable}, default: ${col.column_default})`);
      });
    } else {
      console.log('users表不存在');
    }

    console.log('\n=== 检查chat_sessions表结构 ===');
    const sessionsTableExists = tablesResult.rows.some((row) => row.table_name === 'chat_sessions');

    if (sessionsTableExists) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'chat_sessions' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      console.log('chat_sessions表列结构:');
      columnsResult.rows.forEach((col) => {
        console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable}, default: ${col.column_default})`);
      });
    } else {
      console.log('chat_sessions表不存在');
    }

    console.log('\n=== 检查chat_messages表结构 ===');
    const messagesTableExists = tablesResult.rows.some((row) => row.table_name === 'chat_messages');

    if (messagesTableExists) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'chat_messages' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      console.log('chat_messages表列结构:');
      columnsResult.rows.forEach((col) => {
        console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable}, default: ${col.column_default})`);
      });
    } else {
      console.log('chat_messages表不存在');
    }

    console.log('\n=== 测试简单查询 ===');
    try {
      const simpleResult = await client.query('SELECT COUNT(*) as total FROM pg_class WHERE relkind = \'r\' AND relname IN (\'users\', \'chat_sessions\', \'chat_messages\')');
      console.log('找到的表数量:', simpleResult.rows[0].total);
    } catch (error) {
      console.log('查询表数量失败:', error.message);
    }

    console.log('\n=== 测试users表数据 ===');
    if (usersTableExists) {
      try {
        const countResult = await client.query('SELECT COUNT(*) as count FROM users');
        console.log('users表记录数:', countResult.rows[0].count);
      } catch (error) {
        console.log('查询users表失败:', error.message);
      }
    }

  } catch (error) {
    console.error('调试过程出错:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  debugDatabaseSchema()
    .then(() => {
      console.log('\n=== 调试完成 ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('调试失败:', error);
      process.exit(1);
    });
}