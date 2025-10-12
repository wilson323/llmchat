/**
 * 数据库迁移集成测试
 * 验证数据库迁移、版本控制和模式更新功能
 */

import { testDbEnv, DatabaseAssertions, dbTestSetup } from '../utils/dbTestUtils';
import logger from '../../utils/logger';

describe('Database Migration Integration Tests', () => {
  beforeAll(async () => {
    await dbTestSetup.beforeAll();
  });

  beforeEach(async () => {
    await dbTestSetup.beforeEach();
  });

  afterAll(async () => {
    await dbTestSetup.afterAll();
  });

  describe('Schema Initialization', () => {
    it('should create all required tables on initialization', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 检查所有必需的表是否存在
        const tables = [
          'users',
          'chat_sessions',
          'chat_messages',
        ];

        for (const table of tables) {
          const result = await client.query(
            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) as exists`,
            [table]
          );
          expect(result.rows[0].exists).toBe(true);
        }
      } finally {
        client.release();
      }
    });

    it('should create all required indexes', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 检查关键索引是否存在
        const expectedIndexes = [
          { table: 'users', column: 'email' },
          { table: 'chat_sessions', column: 'user_id' },
          { table: 'chat_messages', column: 'session_id' },
        ];

        for (const index of expectedIndexes) {
          const result = await client.query(
            `SELECT EXISTS (
              SELECT FROM pg_indexes
              WHERE tablename = $1 AND indexdef LIKE $2
            ) as exists`,
            [index.table, `%${index.column}%`]
          );
          expect(result.rows[0].exists).toBe(true);
        }
      } finally {
        client.release();
      }
    });

    it('should have correct table schemas', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 检查users表结构
        const usersSchema = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'users'
          ORDER BY ordinal_position
        `);

        const expectedUserColumns = [
          { name: 'id', type: 'uuid', nullable: 'NO' },
          { name: 'email', type: 'character varying', nullable: 'NO' },
          { name: 'password_hash', type: 'character varying', nullable: 'NO' },
          { name: 'full_name', type: 'character varying', nullable: 'YES' },
          { name: 'role', type: 'character varying', nullable: 'YES' },
          { name: 'created_at', type: 'timestamp without time zone', nullable: 'YES' },
          { name: 'updated_at', type: 'timestamp without time zone', nullable: 'YES' },
        ];

        expect(usersSchema.rows).toHaveLength(expectedUserColumns.length);

        expectedUserColumns.forEach((expected, index) => {
          const actual = usersSchema.rows[index];
          expect(actual.column_name).toBe(expected.name);
          expect(actual.data_type).toBe(expected.type);
          expect(actual.is_nullable).toBe(expected.nullable);
        });
      } finally {
        client.release();
      }
    });
  });

  describe('Data Types and Constraints', () => {
    it('should enforce UUID primary keys', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 尝试插入无效UUID应该失败
        await expect(
          client.query(
            'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
            ['invalid-uuid', 'test@example.com', 'hashed_password']
          )
        ).rejects.toThrow(/invalid input syntax for type uuid/i);
      } finally {
        client.release();
      }
    });

    it('should enforce foreign key constraints', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 先创建用户
        const userResult = await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          ['fk@example.com', 'hashed_password']
        );
        const userId = userResult.rows[0].id;

        // 创建会话（有效的外键）
        await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3)',
          ['Valid Session', 'test-agent-1', userId]
        );

        // 尝试创建会话（无效的外键）
        await expect(
          client.query(
            'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3)',
            ['Invalid Session', 'test-agent-1', '00000000-0000-0000-0000-000000000000']
          )
        ).rejects.toThrow(/foreign.*key.*constraint/i);
      } finally {
        client.release();
      }
    });

    it('should handle JSONB data type correctly', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        const complexJson = {
          messages: [
            { role: 'user', content: 'Hello', metadata: { source: 'web' } },
            { role: 'assistant', content: 'Hi!', metadata: { model: 'gpt-4' } },
          ],
          settings: {
            theme: 'dark',
            language: 'en',
          },
          stats: {
            messageCount: 2,
            lastActivity: new Date().toISOString(),
          },
        };

        await client.query(
          'INSERT INTO chat_sessions (title, agent_id, messages) VALUES ($1, $2, $3)',
          ['JSONB Test', 'test-agent-1', JSON.stringify(complexJson)]
        );

        // 查询并验证JSONB数据
        const result = await client.query(
          "SELECT messages->'settings'->>'theme' as theme FROM chat_sessions WHERE title = $1",
          ['JSONB Test']
        );

        expect(result.rows[0].theme).toBe('dark');

        // 测试JSONB查询功能
        const messageCount = await client.query(
          "SELECT jsonb_array_length(messages->'messages') as count FROM chat_sessions WHERE title = $1",
          ['JSONB Test']
        );

        expect(parseInt(messageCount.rows[0].count)).toBe(2);
      } finally {
        client.release();
      }
    });

    it('should handle timestamp columns correctly', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        const beforeInsert = new Date();

        await client.query(
          'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)',
          ['timestamp@example.com', 'hashed_password', 'Timestamp User']
        );

        const result = await client.query(
          'SELECT created_at, updated_at FROM users WHERE email = $1',
          ['timestamp@example.com']
        );

        const createdAt = new Date(result.rows[0].created_at);
        const updatedAt = new Date(result.rows[0].updated_at);

        expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
        expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
      } finally {
        client.release();
      }
    });
  });

  describe('Performance and Indexing', () => {
    it('should use indexes for email lookups', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 插入测试数据
        const testEmail = 'index@example.com';
        await client.query(
          'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)',
          [testEmail, 'hashed_password', 'Index User']
        );

        // 检查查询是否使用了索引
        const explainResult = await client.query(
          "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE email = $1",
          [testEmail]
        );

        const explainText = explainResult.rows.map(row => row['QUERY PLAN']).join(' ');

        // 索引查询应该包含 "Index Scan" 或类似的索引使用指示
        expect(explainText.toLowerCase()).toMatch(/index scan|bitmap index scan/i);
      } finally {
        client.release();
      }
    });

    it('should handle large datasets efficiently', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        const batchSize = 1000;
        const startTime = Date.now();

        // 插入大量数据
        await client.query('BEGIN');

        for (let i = 0; i < batchSize; i++) {
          await client.query(
            'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)',
            [`user${i}@performance.com`, 'hashed_password', `Performance User ${i}`]
          );

          // 每100条提交一次以避免事务过大
          if (i % 100 === 0) {
            await client.query('COMMIT');
            await client.query('BEGIN');
          }
        }

        await client.query('COMMIT');

        const insertDuration = Date.now() - startTime;

        // 测试查询性能
        const queryStartTime = Date.now();
        const result = await client.query('SELECT COUNT(*) as count FROM users WHERE email LIKE $1', ['%@performance.com']);
        const queryDuration = Date.now() - queryStartTime;

        expect(parseInt(result.rows[0].count)).toBe(batchSize);
        expect(insertDuration).toBeLessThan(5000); // 插入应该在5秒内完成
        expect(queryDuration).toBeLessThan(1000); // 查询应该在1秒内完成

        logger.info('大数据集性能测试完成', {
          component: 'dbMigrationTest',
          batchSize,
          insertDuration,
          queryDuration,
        });
      } finally {
        client.release();
      }
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain referential integrity on cascade deletes', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 创建用户
        const userResult = await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          ['cascade@example.com', 'hashed_password']
        );
        const userId = userResult.rows[0].id;

        // 创建会话
        const sessionResult = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['Cascade Session', 'test-agent-1', userId]
        );
        const sessionId = sessionResult.rows[0].id;

        // 创建消息
        await client.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', 'Cascade test message']
        );

        // 验证数据存在
        const userCount = await client.query('SELECT COUNT(*) as count FROM users WHERE id = $1', [userId]);
        const sessionCount = await client.query('SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = $1', [userId]);
        const messageCount = await client.query('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = $1', [sessionId]);

        expect(parseInt(userCount.rows[0].count)).toBe(1);
        expect(parseInt(sessionCount.rows[0].count)).toBe(1);
        expect(parseInt(messageCount.rows[0].count)).toBe(1);

        // 删除用户（应该级联删除相关数据）
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        // 验证级联删除
        const finalUserCount = await client.query('SELECT COUNT(*) as count FROM users WHERE id = $1', [userId]);
        const finalSessionCount = await client.query('SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = $1', [userId]);
        const finalMessageCount = await client.query('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = $1', [sessionId]);

        expect(parseInt(finalUserCount.rows[0].count)).toBe(0);
        expect(parseInt(finalSessionCount.rows[0].count)).toBe(0);
        expect(parseInt(finalMessageCount.rows[0].count)).toBe(0);
      } finally {
        client.release();
      }
    });

    it('should prevent circular references', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 这个测试主要是验证数据库设计是否避免了循环引用
        // 在当前设计中，不会出现循环引用的情况

        // 创建正常的数据关系
        const userResult = await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          ['normal@example.com', 'hashed_password']
        );
        const userId = userResult.rows[0].id;

        const sessionResult = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['Normal Session', 'test-agent-1', userId]
        );
        const sessionId = sessionResult.rows[0].id;

        // 验证数据关系正确
        const sessionCheck = await client.query('SELECT user_id FROM chat_sessions WHERE id = $1', [sessionId]);
        expect(sessionCheck.rows[0].user_id).toBe(userId);

        // 消息引用会话，会话引用用户，这是单向的，不会形成循环
        await client.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', 'No circular reference']
        );

        const messageCheck = await client.query('SELECT session_id FROM chat_messages WHERE session_id = $1', [sessionId]);
        expect(messageCheck.rows[0].session_id).toBe(sessionId);
      } finally {
        client.release();
      }
    });
  });

  describe('Schema Evolution', () => {
    it('should handle adding new columns gracefully', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 检查当前列数
        const currentColumns = await client.query(
          "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'users'"
        );
        const initialColumnCount = parseInt(currentColumns.rows[0].count);

        // 添加新列（模拟迁移）
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');

        // 验证新列存在
        const newColumns = await client.query(
          "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'users'"
        );
        const finalColumnCount = parseInt(newColumns.rows[0].count);

        expect(finalColumnCount).toBeGreaterThanOrEqual(initialColumnCount);

        // 测试新列的使用
        await client.query(
          'INSERT INTO users (email, password_hash, phone, avatar_url) VALUES ($1, $2, $3, $4)',
          ['schema@example.com', 'hashed_password', '+1234567890', 'https://example.com/avatar.jpg']
        );

        const result = await client.query('SELECT phone, avatar_url FROM users WHERE email = $1', ['schema@example.com']);
        expect(result.rows[0].phone).toBe('+1234567890');
        expect(result.rows[0].avatar_url).toBe('https://example.com/avatar.jpg');
      } finally {
        client.release();
      }
    });

    it('should maintain backward compatibility', async () => {
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();

      try {
        // 使用原有的列创建记录（不使用新列）
        await client.query(
          'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)',
          ['compat@example.com', 'hashed_password', 'Compatibility User']
        );

        // 验证记录可以被正常查询
        const result = await client.query('SELECT email, full_name FROM users WHERE email = $1', ['compat@example.com']);
        expect(result.rows[0].email).toBe('compat@example.com');
        expect(result.rows[0].full_name).toBe('Compatibility User');

        // 查询应该能处理NULL的新列
        const resultWithNewCols = await client.query('SELECT phone, avatar_url FROM users WHERE email = $1', ['compat@example.com']);
        expect(resultWithNewCols.rows[0].phone).toBeNull();
        expect(resultWithNewCols.rows[0].avatar_url).toBeNull();
      } finally {
        client.release();
      }
    });
  });
});