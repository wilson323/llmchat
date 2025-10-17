/**
 * 数据库性能基准测试
 * 建立准确的性能测试基准和监控
 */

import { testDbEnv, TestDataFactory, dbTestSetup } from '../utils/dbTestUtils';
import logger from '../../utils/logger';

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage?: number;
  throughput?: number;
  success: boolean;
  error?: string;
}

interface BenchmarkResult {
  operation: string;
  samples: number[];
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  standardDeviation: number;
  throughput: number;
  successRate: number;
}

describe('Database Performance Benchmarking', () => {
  const BENCHMARK_ITERATIONS = 100;
  const PERFORMANCE_THRESHOLD_MS = 1000; // 1秒阈值
  const WARMUP_ITERATIONS = 10;

  beforeAll(async () => {
    await dbTestSetup.beforeAll();
  });

  beforeEach(async () => {
    await dbTestSetup.beforeEach();
  });

  afterAll(async () => {
    await dbTestSetup.afterAll();
  });

  describe('Connection Performance', () => {
    it('should establish connections quickly', async () => {
      const metrics: PerformanceMetrics[] = [];

      // 预热连接池
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        const client = await testDbEnv.getTestPool().connect();
        await client.query('SELECT 1');
        client.release();
      }

      // 性能测试
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const startTime = Date.now();

        try {
          const client = await testDbEnv.getTestPool().connect();
          await client.query('SELECT 1');
          client.release();

          const duration = Date.now() - startTime;
          metrics.push({
            operation: 'connection_establishment',
            duration,
            success: true,
          });
        } catch (error) {
          metrics.push({
            operation: 'connection_establishment',
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result = calculateBenchmarkResult('connection_establishment', metrics);

      logger.info('连接性能基准测试结果', {
        component: 'dbPerformance',
        operation: 'connection_establishment',
        iterations: BENCHMARK_ITERATIONS,
        mean: result.mean,
        p95: result.p95,
        p99: result.p99,
        throughput: result.throughput,
      });

      expect(result.mean).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(result.p95).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
      expect(result.successRate).toBe(100);
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      const MAX_CONNECTIONS = 20;
      const metrics: PerformanceMetrics[] = [];

      // 尝试创建超过连接池限制的连接
      const connectionPromises = Array.from({ length: MAX_CONNECTIONS + 5 }, async (_, index) => {
        const startTime = Date.now();

        try {
          const client = await testDbEnv.getTestPool().connect();
          await client.query('SELECT pg_sleep(0.1)'); // 短暂等待
          client.release();

          const duration = Date.now() - startTime;
          metrics.push({
            operation: `pool_connection_${index}`,
            duration,
            success: true,
          });
        } catch (error) {
          metrics.push({
            operation: `pool_connection_${index}`,
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.allSettled(connectionPromises);

      const successfulConnections = metrics.filter(m => m.success).length;
      const failedConnections = metrics.filter(m => !m.success).length;

      logger.info('连接池压力测试结果', {
        component: 'dbPerformance',
        operation: 'connection_pool_stress',
        totalAttempts: MAX_CONNECTIONS + 5,
        successful: successfulConnections,
        failed: failedConnections,
        successRate: (successfulConnections / (MAX_CONNECTIONS + 5)) * 100,
      });

      expect(successfulConnections).toBeGreaterThan(MAX_CONNECTIONS * 0.8); // 至少80%成功
    });
  });

  describe('CRUD Operations Performance', () => {
    it('should perform inserts efficiently', async () => {
      const metrics: PerformanceMetrics[] = [];
      const BATCH_SIZE = 50;

      // 预热
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        const userData = TestDataFactory.createUser({ email: `warmup${i}@example.com` });
        await testDbEnv.withTransaction(async (client) => {
          await client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            [userData.email, 'test-salt', userData.password_hash, userData.role]
          );
        });
      }

      // 清理预热数据
      await testDbEnv.cleanupTestData();

      // 性能测试
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const startTime = Date.now();

        try {
          await testDbEnv.withTransaction(async (client) => {
            const userData = TestDataFactory.createUser({ email: `perf${i}@example.com` });
            await client.query(
              'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
              [userData.email, userData.password_hash, userData.role]
            );
          });

          const duration = Date.now() - startTime;
          metrics.push({
            operation: 'user_insert',
            duration,
            success: true,
            throughput: 1,
          });
        } catch (error) {
          metrics.push({
            operation: 'user_insert',
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result = calculateBenchmarkResult('user_insert', metrics);

      logger.info('插入操作性能基准', {
        component: 'dbPerformance',
        operation: 'user_insert',
        iterations: BENCHMARK_ITERATIONS,
        mean: result.mean,
        p95: result.p95,
        throughput: result.throughput,
        successRate: (metrics.filter(m => m.success).length / metrics.length) * 100,
      });

      expect(result.mean).toBeLessThan(100); // 单次插入应该很快
      expect(result.p95).toBeLessThan(500);
      expect(result.successRate).toBe(100);
    });

    it('should perform bulk inserts efficiently', async () => {
      const BULK_SIZES = [10, 50, 100];
      const results: BenchmarkResult[] = [];

      for (const bulkSize of BULK_SIZES) {
        const metrics: PerformanceMetrics[] = [];

        for (let i = 0; i < 10; i++) { // 每个批量大小测试10次
          const startTime = Date.now();

          try {
            await testDbEnv.withTransaction(async (client) => {
              const promises = Array.from({ length: bulkSize }, (_, index) => {
                const userData = TestDataFactory.createUser({
                  email: `bulk${bulkSize}_${i}_${index}@example.com`,
                  role: `Bulk User ${bulkSize}_${i}_${index}`,
                });

                return client.query(
                  'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3)',
                  [userData.email, userData.password_hash, userData.role]
                );
              });

              await Promise.all(promises);
            });

            const duration = Date.now() - startTime;
            metrics.push({
              operation: `bulk_insert_${bulkSize}`,
              duration,
              success: true,
              throughput: bulkSize / (duration / 1000), // 记录/秒
            });
          } catch (error) {
            metrics.push({
              operation: `bulk_insert_${bulkSize}`,
              duration: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const result = calculateBenchmarkResult(`bulk_insert_${bulkSize}`, metrics);
        results.push(result);

        logger.info(`批量插入性能 (${bulkSize}条记录)`, {
          component: 'dbPerformance',
          bulkSize,
          mean: result.mean,
          p95: result.p95,
          throughput: result.throughput,
          avgPerRecord: result.mean / bulkSize,
        });
      }

      // 验证批量插入的效率随批量大小递增
      expect(results[1]!.throughput).toBeGreaterThan(results[0]!.throughput); // 50条 > 10条
      expect(results[2]!.throughput).toBeGreaterThan(results[1]!.throughput); // 100条 > 50条
    });

    it('should perform queries efficiently', async () => {
      // 准备测试数据
      const TEST_USERS = 1000;
      await testDbEnv.withTransaction(async (client) => {
        const promises = Array.from({ length: TEST_USERS }, (_, index) => {
          const userData = TestDataFactory.createUser({
            email: `query${index}@example.com`,
            role: `Query User ${index}`,
          });

          return client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
            [userData.email, 'test-salt', userData.password_hash, userData.role]
          );
        });

        await Promise.all(promises);
      });

      const metrics: PerformanceMetrics[] = [];

      // 性能测试
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const startTime = Date.now();

        try {
          const result = await testDbEnv.withTransaction(async (client) => {
            return await client.query(
              'SELECT COUNT(*) as count FROM users WHERE email LIKE $1',
              ['%query%@example.com']
            );
          });

          const duration = Date.now() - startTime;
          metrics.push({
            operation: 'user_query',
            duration,
            success: true,
            throughput: 1,
          });

          expect(parseInt(result.rows[0].count)).toBe(TEST_USERS);
        } catch (error) {
          metrics.push({
            operation: 'user_query',
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result = calculateBenchmarkResult('user_query', metrics);

      logger.info('查询操作性能基准', {
        component: 'dbPerformance',
        operation: 'user_query',
        iterations: BENCHMARK_ITERATIONS,
        dataVolume: TEST_USERS,
        mean: result.mean,
        p95: result.p95,
        throughput: result.throughput,
      });

      expect(result.mean).toBeLessThan(50); // 查询应该很快
      expect(result.p95).toBeLessThan(200);
      expect(result.successRate).toBe(100);
    });

    it('should perform updates efficiently', async () => {
      // 准备测试数据
      const userIds = await testDbEnv.withTransaction(async (client) => {
        const promises = Array.from({ length: 100 }, (_, index) => {
          const userData = TestDataFactory.createUser({
            email: `update${index}@example.com`,
            role: `Update User ${index}`,
          });

          return client.query(
            'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
            [userData.email, userData.password_hash, userData.role]
          );
        });

        const results = await Promise.all(promises);
        return results.map(r => r.rows[0].id);
      });

      const metrics: PerformanceMetrics[] = [];

      // 性能测试
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const startTime = Date.now();
        const randomUserId = userIds[i % userIds.length];

        try {
          await testDbEnv.withTransaction(async (client) => {
            await client.query(
              'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [`Updated User ${i}`, randomUserId]
            );
          });

          const duration = Date.now() - startTime;
          metrics.push({
            operation: 'user_update',
            duration,
            success: true,
            throughput: 1,
          });
        } catch (error) {
          metrics.push({
            operation: 'user_update',
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result = calculateBenchmarkResult('user_update', metrics);

      logger.info('更新操作性能基准', {
        component: 'dbPerformance',
        operation: 'user_update',
        iterations: BENCHMARK_ITERATIONS,
        mean: result.mean,
        p95: result.p95,
        throughput: result.throughput,
      });

      expect(result.mean).toBeLessThan(100);
      expect(result.p95).toBeLessThan(300);
      expect(result.successRate).toBe(100);
    });
  });

  describe('Transaction Performance', () => {
    it('should handle nested transactions efficiently', async () => {
      const metrics: PerformanceMetrics[] = [];
      const NESTING_DEPTH = 3;

      for (let i = 0; i < BENCHMARK_ITERATIONS / 10; i++) { // 减少迭代次数，因为嵌套事务较慢
        const startTime = Date.now();

        try {
          await testDbEnv.withTransaction(async (client) => {
            // 第一层：创建用户
            const userResult = await client.query(
              'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
              [`nested${i}@example.com`, 'test-salt', 'hashed_password', `Nested User ${i}`]
            );
            const userId = userResult.rows[0].id;

            // 第二层：创建会话
            const sessionResult = await client.query(
              'INSERT INTO chat_sessions (title, agent_id, user_id) VALUES ($1, $2, $3) RETURNING id',
              [`Nested Session ${i}`, 'test-agent-1', userId]
            );
            const sessionId = sessionResult.rows[0].id;

            // 第三层：创建消息
            await client.query(
              'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
              [sessionId, 'user', `Nested message ${i}`]
            );
          });

          const duration = Date.now() - startTime;
          metrics.push({
            operation: 'nested_transaction',
            duration,
            success: true,
            throughput: 1,
          });
        } catch (error) {
          metrics.push({
            operation: 'nested_transaction',
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result = calculateBenchmarkResult('nested_transaction', metrics);

      logger.info('嵌套事务性能基准', {
        component: 'dbPerformance',
        operation: 'nested_transaction',
        nestingDepth: NESTING_DEPTH,
        iterations: BENCHMARK_ITERATIONS / 10,
        mean: result.mean,
        p95: result.p95,
        throughput: result.throughput,
      });

      expect(result.mean).toBeLessThan(200);
      expect(result.p95).toBeLessThan(500);
      expect(result.successRate).toBe(100);
    });

    it('should handle rollback efficiently', async () => {
      const metrics: PerformanceMetrics[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS / 5; i++) { // 减少迭代次数
        const startTime = Date.now();

        try {
          await testDbEnv.withTransaction(async (client) => {
            // 插入一些数据
            await client.query(
              'INSERT INTO users (username, password_salt, password_hash, role) VALUES ($1, $2, $3, $4)',
              [`rollback${i}@example.com`, 'test-salt', 'hashed_password', `Rollback User ${i}`]
            );

            // 故意触发回滚
            if (i % 2 === 0) {
              throw new Error('Intentional rollback');
            }
          });
        } catch (error) {
          // 预期的错误，说明回滚成功
          const duration = Date.now() - startTime;
          metrics.push({
            operation: 'transaction_rollback',
            duration,
            success: true,
            throughput: 1,
          });
        }
      }

      const result = calculateBenchmarkResult('transaction_rollback', metrics);

      logger.info('事务回滚性能基准', {
        component: 'dbPerformance',
        operation: 'transaction_rollback',
        iterations: BENCHMARK_ITERATIONS / 5,
        mean: result.mean,
        p95: result.p95,
        throughput: result.throughput,
      });

      expect(result.mean).toBeLessThan(150);
      expect(result.p95).toBeLessThan(400);
      expect(result.successRate).toBe(100);

      // 验证数据确实被回滚了
      const pool = testDbEnv.getTestPool();
      const client = await pool.connect();
      try {
        const result = await client.query("SELECT COUNT(*) as count FROM users WHERE email LIKE 'rollback%'");
        expect(parseInt(result.rows[0].count)).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  describe('JSON Performance', () => {
    it('should handle JSONB operations efficiently', async () => {
      const metrics: PerformanceMetrics[] = [];
      const JSON_SIZES = [100, 500, 1000]; // JSON对象的大小

      for (const jsonSize of JSON_SIZES) {
        const largeJson = {
          messages: Array.from({ length: jsonSize }, (_, index) => ({
            id: index,
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `Large message content ${index} with additional text to increase size for performance testing`,
            metadata: {
              timestamp: Date.now(),
              model: 'test-model',
              tokens: Math.floor(Math.random() * 1000),
              language: 'en',
              confidence: Math.random(),
            },
          })),
          settings: {
            theme: 'dark',
            language: 'en',
            version: '1.0.0',
            features: Array.from({ length: 50 }, (_, i) => `feature_${i}`),
          },
        };

        for (let i = 0; i < 10; i++) {
          const startTime = Date.now();

          try {
            await testDbEnv.withTransaction(async (client) => {
              await client.query(
                'INSERT INTO chat_sessions (title, agent_id, messages) VALUES ($1, $2, $3)',
                [`JSON Test ${jsonSize} ${i}`, 'test-agent-1', JSON.stringify(largeJson)]
              );

              // 测试JSONB查询
              await client.query(
                "SELECT jsonb_array_length(messages->'messages') as count FROM chat_sessions WHERE title = $1",
                [`JSON Test ${jsonSize} ${i}`]
              );
            });

            const duration = Date.now() - startTime;
            metrics.push({
              operation: `jsonb_operations_${jsonSize}`,
              duration,
              success: true,
              throughput: 1,
            });
          } catch (error) {
            metrics.push({
              operation: `jsonb_operations_${jsonSize}`,
              duration: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const result = calculateBenchmarkResult(`jsonb_operations_${jsonSize}`, metrics);

        logger.info(`JSONB操作性能 (${jsonSize}条消息)`, {
          component: 'dbPerformance',
          jsonSize,
          mean: result.mean,
          p95: result.p95,
          throughput: result.throughput,
        });

        expect(result.mean).toBeLessThan(1000); // 即使是大数据量也应该在合理时间内
        expect(result.successRate).toBe(100);
      }
    });
  });
});

/**
 * 计算基准测试结果
 */
function calculateBenchmarkResult(operation: string, metrics: PerformanceMetrics[]): BenchmarkResult {
  const successfulMetrics = metrics.filter(m => m.success);
  const durations = successfulMetrics.map(m => m.duration);

  if (durations.length === 0) {
    throw new Error(`No successful operations for ${operation}`);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  // 计算标准差
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const standardDeviation = Math.sqrt(variance);

  // 计算吞吐量（操作/秒）
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const throughput = (durations.length / totalDuration) * 1000;

  return {
    operation,
    samples: durations,
    mean: Math.round(mean),
    median: Math.round(median),
    p95: Math.round(p95),
    p99: Math.round(p99),
    min: Math.round(min),
    max: Math.round(max),
    standardDeviation: Math.round(standardDeviation),
    throughput: Math.round(throughput * 100) / 100,
    successRate: (successfulMetrics.length / metrics.length) * 100,
  };
}