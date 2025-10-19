/**
 * 聊天服务测试（核心功能）
 * 测试范围：非流式聊天、流式聊天、会话管理
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

// 测试配置
const TEST_USER = {
  username: 'admin',
  password: 'admin123',
};

let authToken: string;
let agentId: string;

test.describe.skip('聊天服务测试套件（依赖外部FastGPT服务）', () => {
  // 准备：登录获取token和agentId
  test.beforeAll(async ({ request }) => {
    // 登录
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: TEST_USER,
    });
    const loginResult = await loginResponse.json();
    authToken = loginResult.data.token;

    // 获取第一个智能体ID
    const agentsResponse = await request.get(`${API_URL}/agents`);
    const agentsResult = await agentsResponse.json();
    agentId = agentsResult.data[0].id;

    console.log(`✅ 测试准备完成 - AgentID: ${agentId}`);
  });

  /**
   * 测试1: 非流式聊天
   */
  test.skip('✅ 非流式聊天 - POST /api/chat/completions (stream=false) - 依赖外部服务', async ({ request }) => {
    const response = await request.post(`${API_URL}/chat/completions`, {
      data: {
        agentId,
        messages: [
          {
            role: 'user',
            content: '你好，请简短回复一句话',
          },
        ],
        stream: false,
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveProperty('content');
    expect(result.data.content.length).toBeGreaterThan(0);

    console.log(`✅ 非流式聊天成功 - 回复长度: ${result.data.content.length}字符`);
  });

  /**
   * 测试2: 流式聊天（基础验证）
   */
  test.skip('✅ 流式聊天 - POST /api/chat/completions (stream=true) - 依赖外部服务', async ({ request }) => {
    const response = await request.post(`${API_URL}/chat/completions`, {
      data: {
        agentId,
        messages: [
          {
            role: 'user',
            content: '说"测试成功"',
          },
        ],
        stream: true,
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status()).toBe(200);

    // 验证SSE响应头
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/event-stream');

    console.log('✅ 流式聊天响应正常（SSE格式）');
  });

  /**
   * 测试3: 缺少agentId应返回400
   */
  test('❌ 缺少agentId - 应返回400', async ({ request }) => {
    const response = await request.post(`${API_URL}/chat/completions`, {
      data: {
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status()).toBe(400);

    const result = await response.json();
    expect(result.code).toBe('VALIDATION_ERROR');

    console.log('✅ 缺少agentId正确返回400');
  });

  /**
   * 测试4: 未认证请求应返回401
   */
  test('❌ 未认证请求 - 应返回401', async ({ request }) => {
    const response = await request.post(`${API_URL}/chat/completions`, {
      data: {
        agentId,
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
      },
      // 不带Authorization header
    });

    expect(response.status()).toBe(401);

    console.log('✅ 未认证请求正确返回401');
  });

  /**
   * 测试5: 不存在的智能体应返回404
   */
  test('❌ 不存在的智能体 - 应返回404', async ({ request }) => {
    const response = await request.post(`${API_URL}/chat/completions`, {
      data: {
        agentId: 'nonexistent-agent-id-12345',
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status()).toBe(404);

    const result = await response.json();
    expect(result.code).toBe('NOT_FOUND');

    console.log('✅ 不存在的智能体正确返回404');
  });
});

