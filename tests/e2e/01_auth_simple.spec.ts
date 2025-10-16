/**
 * 认证系统核心功能测试（简化版）
 * 测试范围：登录、Token验证
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

const TEST_USER = {
  username: 'admin',
  password: 'admin123',
};

test.describe('认证系统核心测试', () => {
  /**
   * 测试1: 用户登录成功
   */
  test('✅ 用户登录 - 有效凭证', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveProperty('token');
    expect(result.data).toHaveProperty('user');
    expect(result.data.token.length).toBeGreaterThan(200);
    expect(result.data.user.username).toBe(TEST_USER.username);

    console.log(`✅ 登录成功 - Token长度: ${result.data.token.length}`);
  });

  /**
   * 测试2: 无效凭证登录失败
   */
  test('❌ 用户登录 - 无效凭证应返回401', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: 'wrong-password',
      },
    });

    expect(response.status()).toBe(401);

    const result = await response.json();
    expect(result.code).toBe('INVALID_CREDENTIALS');

    console.log('✅ 无效凭证正确拒绝');
  });

  /**
   * 测试3: Token验证 - verify端点
   */
  test('✅ Token验证 - /api/auth/verify', async ({ request }) => {
    // 先登录获取token
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });
    const loginResult = await loginResponse.json();
    const token = loginResult.data.token;

    // 验证token
    const verifyResponse = await request.get(`${API_URL}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(verifyResponse.status()).toBe(200);

    const result = await verifyResponse.json();
    expect(result.code).toBe('SUCCESS');
    expect(result.data.valid).toBe(true);

    console.log('✅ Token验证通过');
  });

  /**
   * 测试4: 无效Token应被拒绝
   */
  test('❌ 无效Token - 应返回401', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/verify`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    expect(response.status()).toBe(401);

    console.log('✅ 无效Token正确拒绝');
  });

  /**
   * 测试5: 缺少Token应被拒绝
   */
  test('❌ 缺少Token - 应返回401', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/verify`);

    expect(response.status()).toBe(401);

    console.log('✅ 缺少Token正确拒绝');
  });
});

