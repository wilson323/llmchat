/**
 * Jest 测试环境设置
 *
 * 配置全局测试环境和Mock
 */

// 设置测试超时 (30 seconds)
jest.setTimeout(30 * 1000);

// Mock console方法减少测试噪音
global.console = {
  ...console,
  // 保留error和warn用于调试，但静默log
  log: jest.fn(),
  error: console.error,
  warn: console.warn,
};

// Mock process.env以避免环境变量问题
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/postgres';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_DB = '1'; // 使用DB 1用于测试，避免污染生产数据
process.env.DB_POOL_MAX = '20'; // 测试环境使用较小的连接池
process.env.DB_POOL_MIN = '2';

// 全局测试钩子
beforeAll(async () => {
  // 测试开始前的全局设置
  // 注意：不在这里初始化数据库，让每个测试自行决定
});

afterAll(async () => {
  // 测试结束后的清理
  // 确保所有定时器被清理
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // 清理可能的数据库连接
  try {
    const { getPool } = require('@/utils/db');
    const pool = getPool();
    if (pool) {
      await pool.end();
    }
  } catch (error) {
    // 忽略清理错误
  }
});

// 每个测试后清理
afterEach(() => {
  jest.clearAllMocks();
});

// 添加一个虚拟测试以满足Jest要求
describe('Test Environment Setup', () => {
  it('should set up test environment correctly', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBe('test-jwt-secret-key-for-testing-purposes-only');
    expect(jest.isMockFunction(global.console.log)).toBe(true);
  });
});