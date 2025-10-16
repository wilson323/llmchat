/**
 * 数据库Mock - 用于测试的数据库操作模拟
 * 
 * 提供：
 * - 常用数据库操作Mock
 * - 事务Mock
 * - 查询构建器Mock
 */

import { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Mock查询结果
 */
export const mockQueryResults = {
  select: (rows: any[] = []): QueryResult => ({
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: []
  }),
  
  insert: (row: any): QueryResult => ({
    rows: [row],
    command: 'INSERT',
    rowCount: 1,
    oid: 0,
    fields: []
  }),
  
  update: (rowCount = 1): QueryResult => ({
    rows: [],
    command: 'UPDATE',
    rowCount,
    oid: 0,
    fields: []
  }),
  
  delete: (rowCount = 1): QueryResult => ({
    rows: [],
    command: 'DELETE',
    rowCount,
    oid: 0,
    fields: []
  }),
  
  empty: (): QueryResult => ({
    rows: [],
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    fields: []
  })
};

/**
 * Mock数据库客户端
 */
export class MockDatabaseClient {
  private inTransaction = false;
  private shouldFail = false;
  
  /**
   * 执行查询
   */
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (this.shouldFail) {
      throw new Error('Database Error: Query failed');
    }
    
    // 根据SQL类型返回不同结果
    if (sql.includes('SELECT')) {
      return mockQueryResults.select([]);
    } else if (sql.includes('INSERT')) {
      return mockQueryResults.insert({ id: '123' });
    } else if (sql.includes('UPDATE')) {
      return mockQueryResults.update();
    } else if (sql.includes('DELETE')) {
      return mockQueryResults.delete();
    }
    
    return mockQueryResults.empty();
  }
  
  /**
   * 开始事务
   */
  async begin(): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Database Error: BEGIN failed');
    }
    this.inTransaction = true;
  }
  
  /**
   * 提交事务
   */
  async commit(): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Database Error: COMMIT failed');
    }
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    this.inTransaction = false;
  }
  
  /**
   * 回滚事务
   */
  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    this.inTransaction = false;
  }
  
  /**
   * 释放连接
   */
  async release(): Promise<void> {
    // Mock: 无需实际操作
  }
  
  /**
   * 设置失败模式
   */
  setFailMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  /**
   * 检查是否在事务中
   */
  isInTransaction(): boolean {
    return this.inTransaction;
  }
}

/**
 * Mock连接池
 */
export class MockPool {
  private shouldFail = false;
  private totalCount = 10;
  private idleCount = 8;
  private waitingCount = 0;
  
  /**
   * 获取连接
   */
  async connect(): Promise<MockDatabaseClient> {
    if (this.shouldFail) {
      throw new Error('Pool Error: Cannot get connection');
    }
    
    this.idleCount--;
    return new MockDatabaseClient();
  }
  
  /**
   * 执行查询
   */
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (this.shouldFail) {
      throw new Error('Pool Error: Query failed');
    }
    
    const client = new MockDatabaseClient();
    return client.query(sql, params);
  }
  
  /**
   * 结束连接池
   */
  async end(): Promise<void> {
    this.idleCount = 0;
    this.totalCount = 0;
  }
  
  /**
   * 获取池状态
   */
  get stats() {
    return {
      totalCount: this.totalCount,
      idleCount: this.idleCount,
      waitingCount: this.waitingCount
    };
  }
  
  /**
   * 设置失败模式
   */
  setFailMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  /**
   * 重置Mock状态
   */
  reset(): void {
    this.shouldFail = false;
    this.totalCount = 10;
    this.idleCount = 8;
    this.waitingCount = 0;
  }
}

/**
 * 创建Mock Pool
 */
export function createMockPool(): MockPool {
  return new MockPool();
}

/**
 * Jest Mock工厂函数
 */
export const mockPoolFactory = {
  query: jest.fn().mockResolvedValue(mockQueryResults.empty()),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue(mockQueryResults.empty()),
    release: jest.fn().mockResolvedValue(undefined)
  }),
  end: jest.fn().mockResolvedValue(undefined)
};

/**
 * 重置所有数据库Mock
 */
export function resetAllDatabaseMocks(): void {
  Object.values(mockPoolFactory).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}

