/**
 * 智能体管理系统测试
 * 测试范围：列表、详情、状态检查
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

test.describe('智能体管理测试套件', () => {
  /**
   * 测试1: 获取智能体列表
   */
  test('✅ 获取智能体列表 - GET /api/agents', async ({ request }) => {
    const response = await request.get(`${API_URL}/agents`);

    expect(response.status()).toBe(200);

    const result = await response.json();
    
    // 验证返回数据结构
    expect(result).toHaveProperty('code');
    expect(result.code).toBe('OK');
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    // 验证智能体数据结构
    const firstAgent = result.data[0];
    expect(firstAgent).toHaveProperty('id');
    expect(firstAgent).toHaveProperty('name');
    expect(firstAgent).toHaveProperty('provider');

    console.log(`✅ 智能体列表 - 总数: ${result.data.length}`);
    console.log(`   第一个智能体: ${firstAgent.name} (${firstAgent.provider})`);
  });

  /**
   * 测试2: 获取特定智能体详情
   */
  test('✅ 获取智能体详情 - GET /api/agents/:id', async ({ request }) => {
    // 先获取列表
    const listResponse = await request.get(`${API_URL}/agents`);
    const listResult = await listResponse.json();
    const firstAgentId = listResult.data[0].id;

    // 获取详情
    const response = await request.get(`${API_URL}/agents/${firstAgentId}`);

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.code).toBe('OK');
    expect(result).toHaveProperty('data');
    expect(result.data.id).toBe(firstAgentId);
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('endpoint');

    console.log(`✅ 智能体详情 - ID: ${firstAgentId}, 名称: ${result.data.name}`);
  });

  /**
   * 测试3: 检查智能体状态
   */
  test('✅ 检查智能体状态 - GET /api/agents/:id/status', async ({ request }) => {
    // 先获取列表
    const listResponse = await request.get(`${API_URL}/agents`);
    const listResult = await listResponse.json();
    const firstAgentId = listResult.data[0].id;

    // 检查状态
    const response = await request.get(`${API_URL}/agents/${firstAgentId}/status`);

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.code).toBe('OK');
    expect(result.data).toHaveProperty('status');
    expect(result.data.status).toMatch(/^(active|inactive|available|unavailable|error)$/);

    console.log(`✅ 智能体状态 - ID: ${firstAgentId}, 状态: ${result.data.status}`);
  });

  /**
   * 测试4: 智能体不存在应返回404
   */
  test('❌ 不存在的智能体 - 应返回404', async ({ request }) => {
    const response = await request.get(`${API_URL}/agents/nonexistent-agent-id-12345`);

    expect(response.status()).toBe(404);

    const result = await response.json();
    expect(result).toHaveProperty('code');

    console.log('✅ 不存在的智能体正确返回404');
  });

  /**
   * 测试5: 验证智能体配置完整性
   */
  test('✅ 智能体配置完整性验证', async ({ request }) => {
    const response = await request.get(`${API_URL}/agents`);
    const result = await response.json();

    // 验证所有智能体都有必需字段
    result.data.forEach((agent: any, index: number) => {
      expect(agent.id, `Agent ${index} should have id`).toBeTruthy();
      expect(agent.name, `Agent ${index} should have name`).toBeTruthy();
      expect(agent.provider, `Agent ${index} should have provider`).toBeTruthy();
    });

    console.log(`✅ 配置完整性 - ${result.data.length}个智能体全部验证通过`);
  });
});

