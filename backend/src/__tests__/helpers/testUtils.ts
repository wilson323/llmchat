/**
 * 测试工具函数库
 * 
 * 提供：
 * - 测试用户创建
 * - JWT Token生成
 * - 测试数据生成
 * - 断言辅助函数
 */

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * 测试用户数据
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  passwordHash: string;
  isAdmin: boolean;
  emailVerified: boolean;
}

/**
 * 创建测试用户
 */
export async function createTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
  const password = 'Test123!@#';
  const passwordHash = await bcrypt.hash(password, 10);
  
  return {
    id: uuidv4(),
    email: `test-${Date.now()}@example.com`,
    password,
    passwordHash,
    isAdmin: false,
    emailVerified: true,
    ...overrides
  };
}

/**
 * 创建管理员用户
 */
export async function createAdminUser(overrides?: Partial<TestUser>): Promise<TestUser> {
  return createTestUser({
    isAdmin: true,
    email: `admin-${Date.now()}@example.com`,
    ...overrides
  });
}

/**
 * 生成JWT Token
 */
export function generateToken(userId: string, options?: { expiresIn?: string; isAdmin?: boolean }): string {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-purposes-only';
  
  return jwt.sign(
    {
      userId,
      isAdmin: options?.isAdmin ?? false
    },
    secret,
    {
      expiresIn: options?.expiresIn ?? '1h'
    } as jwt.SignOptions
  );
}

/**
 * 生成过期的Token
 */
export function generateExpiredToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-purposes-only';
  
  return jwt.sign(
    { userId },
    secret,
    { expiresIn: '-1h' } // 已过期
  );
}

/**
 * 生成无效的Token
 */
export function generateInvalidToken(): string {
  return 'invalid.token.string';
}

/**
 * 测试会话数据
 */
export interface TestSession {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建测试会话
 */
export function createTestSession(overrides?: Partial<TestSession>): TestSession {
  return {
    id: uuidv4(),
    userId: uuidv4(),
    agentId: 'default-agent',
    title: '测试会话',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * 测试消息数据
 */
export interface TestMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

/**
 * 创建测试消息
 */
export function createTestMessage(overrides?: Partial<TestMessage>): TestMessage {
  return {
    id: uuidv4(),
    sessionId: uuidv4(),
    role: 'user',
    content: '测试消息内容',
    createdAt: new Date(),
    ...overrides
  };
}

/**
 * 创建一组测试消息
 */
export function createTestConversation(sessionId: string, messageCount = 5): TestMessage[] {
  const messages: TestMessage[] = [];
  
  for (let i = 0; i < messageCount; i++) {
    messages.push(createTestMessage({
      sessionId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `消息 ${i + 1}`
    }));
  }
  
  return messages;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout || 5000;
  const interval = options?.interval || 100;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await delay(interval);
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * 断言错误类型
 */
export function assertErrorType(error: any, expectedType: string): void {
  expect(error).toBeInstanceOf(Error);
  expect(error.constructor.name).toBe(expectedType);
}

/**
 * 断言错误消息包含文本
 */
export function assertErrorMessage(error: any, expectedMessage: string): void {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain(expectedMessage);
}

/**
 * 断言API响应格式
 */
export function assertApiResponse(response: any, expectedStatus: number, expectedData?: any): void {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('code');
  expect(response.body).toHaveProperty('message');
  
  if (expectedData) {
    expect(response.body.data).toMatchObject(expectedData);
  }
}

/**
 * 生成随机字符串
 */
export function randomString(length = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机邮箱
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@example.com`;
}

/**
 * 生成强密码
 */
export function generateStrongPassword(): string {
  return `Test${randomString(8)}!@#123`;
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(pool: any, userId?: string): Promise<void> {
  try {
    if (userId) {
      await pool.query('DELETE FROM chat_sessions WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  } catch (error) {
    // 忽略清理错误
    console.warn('Cleanup warning:', error);
  }
}

/**
 * Mock环境变量
 */
export function mockEnv(vars: Record<string, string>): void {
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * 恢复环境变量
 */
export function restoreEnv(originalEnv: NodeJS.ProcessEnv): void {
  Object.keys(process.env).forEach(key => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  Object.entries(originalEnv).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * 测试数据生成器
 */
export const testDataGenerator = {
  user: createTestUser,
  admin: createAdminUser,
  session: createTestSession,
  message: createTestMessage,
  conversation: createTestConversation,
  token: generateToken,
  expiredToken: generateExpiredToken,
  invalidToken: generateInvalidToken
};

/**
 * 断言辅助函数集合
 */
export const assertions = {
  errorType: assertErrorType,
  errorMessage: assertErrorMessage,
  apiResponse: assertApiResponse
};

