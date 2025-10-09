/**
 * Jest 测试环境设置
 *
 * 配置全局测试环境和Mock
 */

// 设置测试超时
jest.setTimeout(30000);

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
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

// 全局测试钩子
beforeAll(async () => {
  // 测试开始前的全局设置
});

afterAll(async () => {
  // 测试结束后的清理
  // 确保所有定时器被清理
  jest.clearAllTimers();
  jest.useRealTimers();
});

// 每个测试后清理
afterEach(() => {
  jest.clearAllMocks();
});