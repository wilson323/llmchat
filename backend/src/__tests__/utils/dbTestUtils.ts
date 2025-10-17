/**
 * 数据库集成测试工具
 * 为集成测试提供真实的数据库连接和事务管理
 */

import { Pool, PoolClient } from 'pg';
import { initDB, getPool, withClient } from '../../utils/db';
import logger from '../../utils/logger';

// 测试数据库配置 - 使用统一数据源
export const testDbConfig = {
  host: process.env.DB_HOST || '171.43.138.237',
  port: parseInt(process.env.DB_PORT || '5443', 10),
  database: process.env.DB_NAME?.replace(/^([^_]+)$/, '$1_test') || 'zkteco_test',
  user: process.env.DB_USER || 'username',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true',
  max: 20, // 连接池大小
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// 测试数据清理接口
export interface TestDataCleaner {
  cleanup(): Promise<void>;
}

// 数据库测试环境管理器
export class DatabaseTestEnvironment {
  private testPool: Pool | null = null;
  private isInitialized = false;
  private testDataCleaners: TestDataCleaner[] = [];

  /**
   * 初始化测试数据库环境
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('初始化测试数据库环境', {
        component: 'dbTestUtils',
        host: testDbConfig.host,
        port: testDbConfig.port,
        database: testDbConfig.database,
      });

      // 创建测试专用连接池
      this.testPool = new Pool(testDbConfig);

      // 测试连接
      const client = await this.testPool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // 初始化数据库结构
      await this.initializeDatabase();

      this.isInitialized = true;

      logger.info('测试数据库环境初始化完成', {
        component: 'dbTestUtils',
        poolSize: this.testPool?.totalCount || 0,
      });
    } catch (error) {
      logger.error('测试数据库环境初始化失败', {
        component: 'dbTestUtils',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 初始化数据库结构
   */
  private async initializeDatabase(): Promise<void> {
    if (!this.testPool) {
      throw new Error('测试连接池未初始化');
    }

    const client = await this.testPool.connect();
    try {
      // 创建必要的扩展
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

      // 创建用户表（与现有结构兼容）
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'active',
          email VARCHAR(255) UNIQUE,
          email_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 创建会话表（与现有结构兼容）
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          title TEXT,
          agent_id TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 创建消息表（与现有结构兼容）
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      logger.info('数据库表创建完成', {
        component: 'dbTestUtils',
      });

      // 等待表创建完成后再创建索引
      await this.createIndexes(client);

      logger.info('数据库结构初始化完成', {
        component: 'dbTestUtils',
      });
    } finally {
      client.release();
    }
  }

  /**
   * 创建数据库索引
   */
  private async createIndexes(client: PoolClient): Promise<void> {
    try {
      // 创建索引
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)');

      logger.info('数据库索引创建完成', {
        component: 'dbTestUtils',
      });
    } catch (error) {
      logger.warn('创建数据库索引时出现警告', {
        component: 'dbTestUtils',
        error: error instanceof Error ? error.message : String(error),
      });
      // 索引创建失败不应该阻止测试，但需要记录
    }
  }

  /**
   * 获取测试数据库连接池
   */
  getTestPool(): Pool {
    if (!this.testPool) {
      throw new Error('测试数据库环境未初始化');
    }
    return this.testPool;
  }

  /**
   * 执行数据库事务
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = this.getTestPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 清理测试数据
   */
  async cleanupTestData(): Promise<void> {
    const pool = this.getTestPool();
    const client = await pool.connect();

    try {
      // 按依赖关系顺序清理数据（从子表到父表）
      await client.query('DELETE FROM chat_messages WHERE TRUE');
      
      // 清理chat_geo_events（如果表存在）
      try {
        await client.query('DELETE FROM chat_geo_events WHERE TRUE');
      } catch (e) {
        // 表可能不存在，忽略错误
      }
      
      await client.query('DELETE FROM chat_sessions WHERE TRUE');
      
      // 清理usage_stats（如果表存在）
      try {
        await client.query('DELETE FROM usage_stats WHERE TRUE');
      } catch (e) {
        // 表可能不存在，忽略错误
      }
      
      // 清理audit_logs（如果表存在）
      try {
        await client.query('DELETE FROM audit_logs WHERE TRUE');
      } catch (e) {
        // 表可能不存在，忽略错误
      }
      
      await client.query('DELETE FROM users WHERE TRUE'); // 完全清空用户表
      
      // 清理agent_configs测试数据（如果表存在）
      try {
        await client.query('DELETE FROM agent_configs WHERE source = \'test\'');
      } catch (e) {
        // 表可能不存在，忽略错误
      }

      logger.info('测试数据清理完成', {
        component: 'dbTestUtils',
      });
    } catch (error) {
      logger.error('测试数据清理失败', {
        component: 'dbTestUtils',
        error: error instanceof Error ? error.message : String(error),
      });
      // 不抛出异常，允许测试继续
      logger.warn('测试数据清理失败，但测试将继续');
    } finally {
      client.release();
    }
  }

  /**
   * 添加测试数据清理器
   */
  addDataCleaner(cleaner: TestDataCleaner): void {
    this.testDataCleaners.push(cleaner);
  }

  /**
   * 执行所有数据清理器
   */
  async executeDataCleaners(): Promise<void> {
    for (const cleaner of this.testDataCleaners) {
      try {
        await cleaner.cleanup();
      } catch (error) {
        logger.warn('数据清理器执行失败', {
          component: 'dbTestUtils',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.testDataCleaners = [];
  }

  /**
   * 关闭测试数据库环境
   */
  async close(): Promise<void> {
    if (this.testPool) {
      await this.executeDataCleaners();
      await this.cleanupTestData();
      await this.testPool.end();
      this.testPool = null;
      this.isInitialized = false;

      logger.info('测试数据库环境已关闭', {
        component: 'dbTestUtils',
      });
    }
  }

  /**
   * 检查数据库连接状态
   */
  async checkConnection(): Promise<boolean> {
    if (!this.testPool) {
      return false;
    }

    try {
      const client = await this.testPool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    const pool = this.getTestPool();
    const client = await pool.connect();

    try {
      const [userCount, sessionCount, messageCount] = await Promise.all([
        client.query('SELECT COUNT(*) as count FROM users'),
        client.query('SELECT COUNT(*) as count FROM chat_sessions'),
        client.query('SELECT COUNT(*) as count FROM chat_messages'),
      ]);

      return {
        users: parseInt(userCount.rows[0].count),
        sessions: parseInt(sessionCount.rows[0].count),
        messages: parseInt(messageCount.rows[0].count),
        pool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
      };
    } finally {
      client.release();
    }
  }
}

// 全局测试数据库环境实例
export const testDbEnv = new DatabaseTestEnvironment();

// 测试用户数据工厂
export class TestDataFactory {
  /**
   * 创建测试用户数据（匹配实际表结构）
   */
  static createUser(overrides: Partial<any> = {}): any {
    const timestamp = Date.now();
    return {
      username: `testuser-${timestamp}`,
      password_salt: 'testsalt'.repeat(8), // 64字符
      password_hash: 'test.hashed.password.sha256',
      role: 'user',
      status: 'active',
      email: `test${timestamp}@example.com`,
      email_verified: false,
      ...overrides,
    };
  }

  /**
   * 插入测试用户（自动处理所有必需字段）
   */
  static async insertUser(client: PoolClient, userData?: Partial<any>): Promise<number> {
    const user = TestDataFactory.createUser(userData);
    
    const result = await client.query(
      `INSERT INTO users (username, password_salt, password_hash, role, status, email, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user.username, user.password_salt, user.password_hash, user.role, user.status, user.email, user.email_verified]
    );
    
    return result.rows[0].id;
  }

  /**
   * 创建测试会话数据
   */
  static createSession(overrides: Partial<any> = {}): any {
    return {
      title: `Test Session ${Date.now()}`,
      agent_id: 'test-agent-1',
      messages: [],
      ...overrides,
    };
  }

  /**
   * 创建测试消息数据
   */
  static createMessage(overrides: Partial<any> = {}): any {
    return {
      role: 'user',
      content: `Test message ${Date.now()}`,
      metadata: {},
      ...overrides,
    };
  }
}

// 数据库断言工具
export class DatabaseAssertions {
  /**
   * 断言表中的记录数量
   */
  static async assertCount(table: string, expectedCount: number): Promise<void> {
    const pool = testDbEnv.getTestPool();
    const client = await pool.connect();

    try {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      const actualCount = parseInt(result.rows[0].count);

      if (actualCount !== expectedCount) {
        throw new Error(
          `Expected ${expectedCount} records in ${table}, but found ${actualCount}`
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * 断言记录存在
   */
  static async assertExists(table: string, condition: string, values: any[] = []): Promise<void> {
    const pool = testDbEnv.getTestPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`,
        values
      );
      const count = parseInt(result.rows[0].count);

      if (count === 0) {
        throw new Error(`Expected record to exist in ${table} where ${condition}`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * 断言记录不存在
   */
  static async assertNotExists(table: string, condition: string, values: any[] = []): Promise<void> {
    const pool = testDbEnv.getTestPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`,
        values
      );
      const count = parseInt(result.rows[0].count);

      if (count > 0) {
        throw new Error(`Expected no records in ${table} where ${condition}, but found ${count}`);
      }
    } finally {
      client.release();
    }
  }
}

// Jest 测试设置和清理工具
export const dbTestSetup = {
  /**
   * 在所有测试前初始化数据库环境
   */
  beforeAll: async (): Promise<void> => {
    await testDbEnv.initialize();
  },

  /**
   * 在每个测试前清理数据
   */
  beforeEach: async (): Promise<void> => {
    await testDbEnv.cleanupTestData();
  },

  /**
   * 在所有测试后关闭数据库环境
   */
  afterAll: async (): Promise<void> => {
    await testDbEnv.close();
  },

  /**
   * 获取测试数据库连接
   */
  getClient: (): Pool => {
    return testDbEnv.getTestPool();
  },
};

export default testDbEnv;