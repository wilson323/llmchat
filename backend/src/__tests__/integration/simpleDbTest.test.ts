/**
 * 简化的数据库集成测试
 * 使用现有数据库结构进行基本功能测试
 */

import { testDbEnv, dbTestSetup } from '../utils/dbTestUtils';
import logger from '../../utils/logger';

describe('Simple Database Integration Tests', () => {
  beforeAll(async () => {
    await dbTestSetup.beforeAll();
  });

  beforeEach(async () => {
    await dbTestSetup.beforeEach();
  });

  afterAll(async () => {
    await dbTestSetup.afterAll();
  });

  describe('Database Connection', () => {
    it('should establish database connection successfully', async () => {
      const isConnected = await testDbEnv.checkConnection();
      expect(isConnected).toBe(true);
    });

    it('should get database statistics', async () => {
      const stats = await testDbEnv.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats.pool).toBeDefined();
      expect(stats.pool.totalCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Basic Data Operations', () => {
    it('should insert and retrieve user data', async () => {
      const result = await testDbEnv.withTransaction(async (client) => {
        const insertResult = await client.query(
          'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
          ['testuser123', 'testsalt'.repeat(8), 'hashed_password', 'user']
        );
        return insertResult.rows[0].id;
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('number');

      // 验证数据插入
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const verifyResult = await client.query(
          'SELECT username, role FROM users WHERE id = $1',
          [result]
        );
        expect(verifyResult.rows).toHaveLength(1);
        expect(verifyResult.rows[0].username).toBe('testuser123');
        expect(verifyResult.rows[0].role).toBe('user');
      } finally {
        client.release();
      }
    });

    it('should handle transactions correctly', async () => {
      let success = false;

      try {
        await testDbEnv.withTransaction(async (client) => {
          // 插入用户
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            ['transaction_test', 'testsalt'.repeat(8), 'hashed_password', 'user']
          );

          // 验证插入成功
          const checkResult = await client.query(
            'SELECT COUNT(*) as count FROM users WHERE username = $1',
            ['transaction_test']
          );
          expect(parseInt(checkResult.rows[0].count)).toBe(1);
          success = true;
        });
      } catch (error) {
        logger.error('Transaction test failed', { error: error instanceof Error ? error.message : String(error) });
      }

      expect(success).toBe(true);
    });

    it('should handle rollback on errors', async () => {
      let errorThrown = false;

      try {
        await testDbEnv.withTransaction(async (client) => {
          // 插入用户
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            ['rollback_test', 'testsalt'.repeat(8), 'hashed_password', 'user']
          );

          // 故意抛出错误触发回滚
          throw new Error('Intentional rollback test');
        });
      } catch (error) {
        errorThrown = true;
      }

      expect(errorThrown).toBe(true);

      // 验证数据被回滚
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const checkResult = await client.query(
          'SELECT COUNT(*) as count FROM users WHERE username = $1',
          ['rollback_test']
        );
        expect(parseInt(checkResult.rows[0].count)).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent operations', async () => {
      const startTime = Date.now();
      const concurrentOperations = 10;

      const promises = Array.from({ length: concurrentOperations }, async (_, index) => {
        return testDbEnv.withTransaction(async (client) => {
          const username = `concurrent_${index}_${Date.now()}`;
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            [username, 'testsalt'.repeat(8), 'hashed_password', 'user']
          );
          return username;
        });
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentOperations);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成

      logger.info('并发操作测试完成', {
        operationCount: concurrentOperations,
        duration,
        averagePerOperation: duration / concurrentOperations
      });
    });

    it('should cleanup test data efficiently', async () => {
      // 插入一些测试数据
      await testDbEnv.withTransaction(async (client) => {
        for (let i = 0; i < 5; i++) {
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            [`cleanup_test_${i}`, 'testsalt'.repeat(8), 'hashed_password', 'user']
          );
        }
      });

      // 验证数据存在
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const beforeCleanup = await client.query(
          "SELECT COUNT(*) as count FROM users WHERE username LIKE 'cleanup_test_%'"
        );
        expect(parseInt(beforeCleanup.rows[0].count)).toBe(5);
      } finally {
        client.release();
      }

      // 执行清理
      await testDbEnv.cleanupTestData();

      // 验证数据被清理
      const client2 = await pool.connect();
      try {
        const afterCleanup = await client2.query(
          "SELECT COUNT(*) as count FROM users WHERE username LIKE 'cleanup_test_%'"
        );
        expect(parseInt(afterCleanup.rows[0].count)).toBe(0);
      } finally {
        client2.release();
      }
    });
  });
});