/**
 * Mock模块统一导出
 * 
 * 集中管理所有测试Mock，便于引用和维护
 */

// FastGPT Mock
export * from './fastgpt.mock';

// Redis Mock
export * from './redis.mock';

// Database Mock
export * from './database.mock';

/**
 * 重置所有Mock
 */
export function resetAllMocks(): void {
  const { resetAllRedisMocks } = require('./redis.mock');
  const { resetAllDatabaseMocks } = require('./database.mock');
  
  resetAllRedisMocks();
  resetAllDatabaseMocks();
  
  // 清除Jest Mock调用记录
  jest.clearAllMocks();
}

