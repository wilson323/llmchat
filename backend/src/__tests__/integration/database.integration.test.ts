/**
 * 数据库集成测试
 * 验证数据库连接、事务处理和数据操作功能
 */

import { Pool } from 'pg';
import { initDB, withClient, hashPassword } from '../../utils/db';
import {
  testDbEnv,
  TestDataFactory,
  DatabaseAssertions,
  dbTestSetup,
  testDbConfig
} from '../utils/dbTestUtils';

describe('Database Integration Tests', () => {
  let pool: Pool;

  beforeAll(async () => {
    await dbTestSetup.beforeAll();
    pool = dbTestSetup.getClient();
  });

  beforeEach(async () => {
    await dbTestSetup.beforeEach();
  });

  afterAll(async () => {
    await dbTestSetup.afterAll();
  });

  describe('Database Connection and Configuration', () => {
    it('should establish database connection successfully', async () => {
      const isConnected = await testDbEnv.checkConnection();
      expect(isConnected).toBe(true);
    });

    it('should have correct database configuration', async () => {
      expect(testDbConfig.host).toBe('106.63.8.99');
      expect(testDbConfig.port).toBe(5432);
      expect(testDbConfig.database).toBe('postgres');
      expect(testDbConfig.user).toBe('username');
      expect(testDbConfig.password).toBe('password');
    });

    it('should get database statistics', async () => {
      const stats = await testDbEnv.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats.users).toBe(0);
      expect(stats.sessions).toBe(0);
      expect(stats.messages).toBe(0);
      expect(stats.pool).toBeDefined();
      expect(stats.pool.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle connection pool management', async () => {
      const initialStats = await testDbEnv.getDatabaseStats();
      const initialPoolSize = initialStats.pool.totalCount;

      // 创建多个并发连接
      const connections = await Promise.all([
        pool.connect(),
        pool.connect(),
        pool.connect(),
      ]);

      const concurrentStats = await testDbEnv.getDatabaseStats();
      expect(concurrentStats.pool.totalCount).toBeGreaterThanOrEqual(initialPoolSize);

      // 释放连接
      connections.forEach(client => client.release());

      // 等待连接池稳定
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalStats = await testDbEnv.getDatabaseStats();
      expect(finalStats.pool.idleCount).toBeGreaterThan(0);
    });
  });

  describe('Database Transactions', () => {
    it('should execute simple transaction successfully', async () => {
      const result = await testDbEnv.withTransaction(async (client) => {
        const insertResult = await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
          ['testuser', 'testsalt'.repeat(8), 'hashed_password', 'user']
        );

        return insertResult.rows[0].id;
      });

      expect(result).toBeDefined();
      await DatabaseAssertions.assertExists('users', 'username = $1', ['testuser']);
    });

    it('should rollback transaction on error', async () => {
      let errorThrown = false;

      try {
        await testDbEnv.withTransaction(async (client) => {
          // 插入用户
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            ['testuser', 'testsalt'.repeat(8), 'hashed_password', 'user']
          );

          // 故意抛出错误触发回滚
          throw new Error('Intentional error for rollback test');
        });
      } catch (error) {
        errorThrown = true;
      }

      expect(errorThrown).toBe(true);
      await DatabaseAssertions.assertNotExists('users', 'username = $1', ['testuser']);
    });

    it('should handle nested operations in transaction', async () => {
      const userId = await testDbEnv.withTransaction(async (client) => {
        // 创建用户
        const userResult = await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
          ['test@example.com', 'hashed_password', 'Test User']
        );
        const userId = userResult.rows[0].id;

        // 创建会话
        const sessionResult = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['Test Session', 'test-agent-1', userId]
        );
        const sessionId = sessionResult.rows[0].id;

        // 创建消息
        await client.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', 'Hello world']
        );

        return userId;
      });

      expect(userId).toBeDefined();
      await DatabaseAssertions.assertExists('users', 'username = $1', ['test@example.com')]);
      await DatabaseAssertions.assertExists('chat_sessions', 'user_id = $1', [userId]);
      await DatabaseAssertions.assertExists('chat_messages', 'session_id IN (SELECT id FROM chat_sessions WHERE user_id = $1)', [userId]);
    });

    it('should handle concurrent transactions', async () => {
      const transactionPromises = Array.from({ length: 5 }, (_, index) =>
        testDbEnv.withTransaction(async (client) => {
          const email = `user${index}@example.com`;
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
            [email, 'hashed_password', `User ${index}`]
          );
          return email;
        })
      );

      const results = await Promise.all(transactionPromises);
      expect(results).toHaveLength(5);

      for (const email of results) {
        await DatabaseAssertions.assertExists('users', 'username = $1'), [email]);
      }

      await DatabaseAssertions.assertCount('users', 5);
    });
  });

  describe('User Data Operations', () => {
    it('should create user with valid data', async () => {
      const userData = TestDataFactory.createUser();

      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role, role) VALUES ($1, $2, $3, $4)',
          [userData.email, userData.password_hash, userData.role, userData.role]
        );
      });

      await DatabaseAssertions.assertExists('users', 'username = $1'), [userData.email]);
    });

    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com';

      // 插入第一个用户
      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
          [email, 'hashed_password', 'User 1']
        );
      });

      // 尝试插入重复邮箱应该失败
      await expect(
        testDbEnv.withTransaction(async (client) => {
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
            [email, 'hashed_password', 'User 2']
          );
        })
      ).rejects.toThrow();
    });

    it('should handle user password hashing', async () => {
      const plainPassword = 'test123';
      const hashedPassword = hashPassword(plainPassword);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.salt).toBeDefined();
      expect(hashedPassword.hash).toBeDefined();
      expect(hashedPassword.salt.length).toBe(32); // 16 bytes = 32 hex chars
      expect(hashedPassword.hash.length).toBe(64); // SHA-256 = 64 hex chars
    });

    it('should update user data', async () => {
      const userId = await testDbEnv.withTransaction(async (client) => {
        const result = await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
          ['update@example.com', 'hashed_password', 'Original Name']
        );
        return result.rows[0].id;
      });

      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['Updated Name', userId]
        );
      });

      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
        expect(result.rows[0].role).toBe('Updated Name');
      } finally {
        client.release();
      }
    });

    it('should delete user and related data', async () => {
      const userId = await testDbEnv.withTransaction(async (client) => {
        // 创建用户
        const userResult = await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
          ['delete@example.com', 'hashed_password', 'User to Delete']
        );
        const userId = userResult.rows[0].id;

        // 创建会话和消息
        const sessionResult = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['Session to Delete', 'test-agent-1', userId]
        );
        const sessionId = sessionResult.rows[0].id;

        await client.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', 'Message to delete']
        );

        return userId;
      });

      // 验证数据存在
      await DatabaseAssertions.assertExists('users', 'id = $1', [userId]);
      await DatabaseAssertions.assertExists('chat_sessions', 'user_id = $1', [userId]);
      await DatabaseAssertions.assertExists('chat_messages', 'session_id IN (SELECT id FROM chat_sessions WHERE user_id = $1)', [userId]);

      // 删除用户（级联删除相关数据）
      await testDbEnv.withTransaction(async (client) => {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
      });

      // 验证所有相关数据都被删除
      await DatabaseAssertions.assertNotExists('users', 'id = $1', [userId]);
      await DatabaseAssertions.assertNotExists('chat_sessions', 'user_id = $1', [userId]);
      await DatabaseAssertions.assertNotExists('chat_messages', 'session_id IN (SELECT id FROM chat_sessions WHERE user_id = $1)', [userId]);
    });
  });

  describe('Chat Session Operations', () => {
    let userId: string;

    beforeEach(async () => {
      userId = await testDbEnv.withTransaction(async (client) => {
        const result = await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
          ['session@example.com', 'hashed_password', 'Session User']
        );
        return result.rows[0].id;
      });
    });

    it('should create chat session for user', async () => {
      const sessionData = TestDataFactory.createSession();

      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id, messages) VALUES ($1, $2, $3, $4)',
          [sessionData.title, sessionData.agent_id, userId, JSON.stringify(sessionData.messages)]
        );
      });

      await DatabaseAssertions.assertExists('chat_sessions', 'user_id = $1', [userId]);
      await DatabaseAssertions.assertCount('chat_sessions', 1);
    });

    it('should store and retrieve JSON message data', async () => {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
      ];

      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id, messages) VALUES ($1, $2, $3, $4)',
          ['JSON Test Session', 'test-agent-1', userId, JSON.stringify(messages)]
        );
      });

      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT messages FROM chat_sessions WHERE user_id = $1', [userId]);
        const storedMessages = JSON.parse(result.rows[0].messages);
        expect(storedMessages).toHaveLength(2);
        expect(storedMessages[0].content).toBe('Hello');
        expect(storedMessages[1].content).toBe('Hi there!');
      } finally {
        client.release();
      }
    });

    it('should update session with new messages', async () => {
      const sessionId = await testDbEnv.withTransaction(async (client) => {
        const result = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id, messages) VALUES ($1, $2, $3, $4) RETURNING id',
          ['Update Test Session', 'test-agent-1', userId, '[]']
        );
        return result.rows[0].id;
      });

      const newMessage = TestDataFactory.createMessage();

      await testDbEnv.withTransaction(async (client) => {
        // 更新消息数组
        await client.query(
          'UPDATE chat_sessions SET messages = jsonb_array_append(messages, $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify(newMessage), sessionId]
        );
      });

      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT messages FROM chat_sessions WHERE id = $1', [sessionId]);
        const messages = JSON.parse(result.rows[0].messages);
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe(newMessage.content);
      } finally {
        client.release();
      }
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle bulk insert operations efficiently', async () => {
      const startTime = Date.now();
      const batchSize = 100;

      await testDbEnv.withTransaction(async (client) => {
        const promises = Array.from({ length: batchSize }, (_, index) => {
          const userData = TestDataFactory.createUser({
            email: `bulk${index}@example.com`,
            role: `Bulk User ${index}`,
          });

          return client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
            [userData.email, userData.password_hash, userData.role]
          );
        });

        await Promise.all(promises);
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
      await DatabaseAssertions.assertCount('users', batchSize);
    });

    it('should handle concurrent read/write operations', async () => {
      const concurrentOperations = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentOperations }, async (_, index) => {
        return testDbEnv.withTransaction(async (client) => {
          // 写入操作
          const email = `concurrent${index}@example.com`;
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
            [email, 'hashed_password', `Concurrent User ${index}`]
          );

          // 读取操作
          const result = await client.query('SELECT COUNT(*) as count FROM users');
          return parseInt(result.rows[0].count);
        });
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000); // 应该在3秒内完成
      expect(results).toHaveLength(concurrentOperations);
      expect(Math.max(...results)).toBe(concurrentOperations);
    });

    it('should maintain connection pool health under stress', async () => {
      const initialStats = await testDbEnv.getDatabaseStats();
      const stressOperations = 50;

      // 执行大量数据库操作
      await Promise.all(Array.from({ length: stressOperations }, async () => {
        await testDbEnv.withTransaction(async (client) => {
          await client.query('SELECT 1');
          await new Promise(resolve => setTimeout(resolve, 10)); // 模拟处理时间
        });
      }));

      const finalStats = await testDbEnv.getDatabaseStats();

      // 连接池应该保持健康
      expect(finalStats.pool.totalCount).toBeGreaterThan(0);
      expect(finalStats.pool.waitingCount).toBe(0); // 不应该有等待的连接
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // 使用无效的连接配置
      const invalidConfig = { ...testDbConfig, password: 'wrongpassword' };
      const invalidPool = new Pool(invalidConfig);

      await expect(invalidPool.connect()).rejects.toThrow();

      await invalidPool.end();
    });

    it('should handle malformed SQL queries', async () => {
      await expect(
        testDbEnv.withTransaction(async (client) => {
          await client.query('INVALID SQL QUERY');
        })
      ).rejects.toThrow();
    });

    it('should handle constraint violations', async () => {
      const email = 'constraint@example.com';

      // 插入第一个用户
      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
          [email, 'hashed_password', 'User 1']
        );
      });

      // 尝试插入重复邮箱应该违反唯一约束
      await expect(
        testDbEnv.withTransaction(async (client) => {
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
            [email, 'hashed_password', 'User 2']
          );
        })
      ).rejects.toThrow(/unique.*constraint/i);
    });

    it('should handle foreign key constraints', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        testDbEnv.withTransaction(async (client) => {
          await client.query(
            'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3)',
            ['Orphan Session', 'test-agent-1', nonExistentUserId]
          );
        })
      ).rejects.toThrow(/foreign.*key.*constraint/i);
    });

    it('should handle large JSON data', async () => {
      const largeMessages = Array.from({ length: 1000 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Large message content ${index} with additional text to increase size`,
        metadata: { index, timestamp: Date.now() },
      }));

      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id, messages) VALUES ($1, $2, $3, $4)',
          ['Large JSON Session', 'test-agent-1', null, JSON.stringify(largeMessages)]
        );
      });

      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT messages FROM chat_sessions WHERE title = $1', ['Large JSON Session']);
        const retrievedMessages = JSON.parse(result.rows[0].messages);
        expect(retrievedMessages).toHaveLength(1000);
      } finally {
        client.release();
      }
    });
  });
});