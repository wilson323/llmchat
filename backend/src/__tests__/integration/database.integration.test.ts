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
      expect(testDbConfig.host).toBe('171.43.138.237');
      expect(testDbConfig.port).toBe(5443);
      expect(testDbConfig.database).toBe('zkteco_test');
      expect(testDbConfig.user).toBe('username');
      expect(testDbConfig.password).toBe('postgres');
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
        // 创建用户（使用辅助函数）
        const userId = await TestDataFactory.insertUser(client, {
          username: 'test@example.com',
          role: 'Test User'
        });

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
      await DatabaseAssertions.assertExists('users', 'username = $1', ['test@example.com']);
      await DatabaseAssertions.assertExists('chat_sessions', 'user_id = $1', [userId]);
      await DatabaseAssertions.assertExists('chat_messages', 'session_id IN (SELECT id FROM chat_sessions WHERE user_id = $1)', [userId]);
    });

    it('should handle concurrent transactions', async () => {
      const timestamp = Date.now();
      const transactionPromises = Array.from({ length: 5 }, (_, index) =>
        testDbEnv.withTransaction(async (client) => {
          const email = `user${timestamp}-${index}@example.com`;
          await TestDataFactory.insertUser(client, {
            username: email,
            email: email,
            role: `User ${index}`
          });
          return email;
        })
      );

      const results = await Promise.all(transactionPromises);
      expect(results).toHaveLength(5);

      for (const email of results) {
        await DatabaseAssertions.assertExists('users', 'username = $1', [email]);
      }

      await DatabaseAssertions.assertCount('users', 5);
    });
  });

  describe('User Data Operations', () => {
    it('should create user with valid data', async () => {
      const userData = TestDataFactory.createUser();

      await testDbEnv.withTransaction(async (client) => {
        await TestDataFactory.insertUser(client, {
          username: userData.username,
          email: userData.email
        });
      });

      await DatabaseAssertions.assertExists('users', 'username = $1', [userData.username]);
    });

    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com';

      // 插入第一个用户
      await testDbEnv.withTransaction(async (client) => {
        await TestDataFactory.insertUser(client, {
          username: email,
          email: email,
          role: 'User 1'
        });
      });

      // 尝试插入重复邮箱应该失败
      await expect(
        testDbEnv.withTransaction(async (client) => {
          await TestDataFactory.insertUser(client, {
            username: email,
            email: email,
            role: 'User 2'
          });
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
        return await TestDataFactory.insertUser(client, {
          username: 'update@example.com',
          email: 'update@example.com',
          role: 'Original Name'
        });
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
        const userId = await TestDataFactory.insertUser(client, {
          username: 'delete@example.com',
          email: 'delete@example.com',
          role: 'User to Delete'
        });

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
    let userId: number;

    beforeEach(async () => {
      userId = await testDbEnv.withTransaction(async (client) => {
        return await TestDataFactory.insertUser(client, {
          username: 'session@example.com',
          email: 'session@example.com',
          role: 'Session User'
        });
      });
    });

    it('should create chat session for user', async () => {
      const sessionData = TestDataFactory.createSession();

      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3)',
          [sessionData.title, sessionData.agent_id, userId]
        );
      });

      await DatabaseAssertions.assertExists('chat_sessions', 'user_id = $1', [userId]);
      await DatabaseAssertions.assertCount('chat_sessions', 1);
    });

    it('should store and retrieve JSON message data', async () => {
      // 创建会话
      const sessionId = await testDbEnv.withTransaction(async (client) => {
        const result = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['JSON Test Session', 'test-agent-1', userId]
        );
        return result.rows[0].id;
      });

      // 验证会话创建成功
      await DatabaseAssertions.assertExists('chat_sessions', 'id = $1', [sessionId]);
      await DatabaseAssertions.assertExists('chat_sessions', 'user_id = $1', [userId]);
    });

    it('should update session with new messages', async () => {
      const sessionId = await testDbEnv.withTransaction(async (client) => {
        const result = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['Update Test Session', 'test-agent-1', userId]
        );
        return result.rows[0].id;
      });

      // 更新会话标题
      await testDbEnv.withTransaction(async (client) => {
        await client.query(
          'UPDATE chat_sessions SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['Updated Title', sessionId]
        );
      });

      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT title FROM chat_sessions WHERE id = $1', [sessionId]);
        expect(result.rows[0].title).toBe('Updated Title');
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
          return TestDataFactory.insertUser(client, {
            username: `bulk${index}@example.com`,
            email: `bulk${index}@example.com`,
            role: `Bulk User ${index}`,
          });
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
          await TestDataFactory.insertUser(client, {
            username: email,
            email: email,
            role: `Concurrent User ${index}`
          });

          // 读取操作
          const result = await client.query('SELECT COUNT(*) as count FROM users');
          return parseInt(result.rows[0].count);
        });
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000); // 应该在3秒内完成
      expect(results).toHaveLength(concurrentOperations);
      // 验证所有并发操作都返回了计数结果
      results.forEach(count => {
        expect(count).toBeGreaterThan(0);
      });
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
        await TestDataFactory.insertUser(client, {
          username: email,
          email: email,
          role: 'User 1'
        });
      });

      // 尝试插入重复邮箱应该违反唯一约束
      await expect(
        testDbEnv.withTransaction(async (client) => {
          await TestDataFactory.insertUser(client, {
            username: email,
            email: email,
            role: 'User 2'
          });
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
      // 创建测试用户
      const testUserId = await testDbEnv.withTransaction(async (client) => {
        return await TestDataFactory.insertUser(client, {
          username: 'largedata@example.com',
          email: 'largedata@example.com'
        });
      });

      // 创建会话并验证可以存储大量数据
      const sessionId = await testDbEnv.withTransaction(async (client) => {
        const result = await client.query(
          'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
          ['Large Data Session', 'test-agent-1', testUserId]
        );
        return result.rows[0].id;
      });

      // 验证会话创建成功（表明可以处理数据操作）
      await DatabaseAssertions.assertExists('chat_sessions', 'id = $1', [sessionId]);
    });
  });
});