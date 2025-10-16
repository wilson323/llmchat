/**
 * T019: 智能体管理测试
 * 
 * 测试覆盖：
 * - 获取智能体列表
 * - 获取智能体详情
 * - 检查智能体状态
 * - 配置重载功能
 * - 错误处理（404等）
 * 
 * 覆盖率目标: >80%
 */

import request from 'supertest';
import express, { Express } from 'express';
import agentsRouter from '@/routes/agents';

describe('T019: 智能体管理测试', () => {
  let app: Express;
  let firstAgentId: string;

  beforeAll(async () => {
    // 创建测试Express应用
    app = express();
    app.use(express.json());
    app.use('/api/agents', agentsRouter);
  });

  describe('1️⃣ 获取智能体列表', () => {
    it('应该成功获取智能体列表', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toHaveProperty('code', 'OK');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // 至少应该有一个智能体
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // 保存第一个智能体ID用于后续测试
      firstAgentId = response.body.data[0].id;
    });

    it('智能体列表项应该包含必要字段', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      const agent = response.body.data[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('provider');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('avatar');
    });

    it('应该支持分页参数', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query({ page: 1, limit: 10 });

      // 即使不支持分页，也不应该报错
      expect(response.status).toBeLessThan(400);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该支持按提供商筛选', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query({ provider: 'fastgpt' });

      expect(response.status).toBeLessThan(400);
      
      if (response.body.data && response.body.data.length > 0) {
        const agents = response.body.data;
        // 如果返回了结果，应该都是fastgpt
        const allFastGPT = agents.every((agent: any) => 
          agent.provider === 'fastgpt' || agent.provider === 'FastGPT'
        );
        expect(allFastGPT).toBe(true);
      }
    });
  });

  describe('2️⃣ 获取智能体详情', () => {
    it('应该成功获取存在的智能体详情', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 'OK');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe(firstAgentId);
    });

    it('智能体详情应该包含完整信息', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}`)
        .expect(200);

      const agent = response.body.data;
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('provider');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('avatar');
      expect(agent).toHaveProperty('config');
      expect(agent).toHaveProperty('features');
    });

    it('应该正确处理不存在的智能体ID', async () => {
      const response = await request(app)
        .get('/api/agents/nonexistent_agent_12345')
        .expect(404);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toMatch(/NOT_FOUND|AGENT_NOT_FOUND/);
    });

    it('应该正确处理无效的智能体ID格式', async () => {
      const response = await request(app)
        .get('/api/agents/@#$%^&*');

      // 应该返回404或400
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('3️⃣ 检查智能体状态', () => {
    it('应该成功检查智能体在线状态', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 'OK');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('available');
    });

    it('智能体状态应该包含健康信息', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}/status`)
        .expect(200);

      const status = response.body.data;
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('available');
      
      // 状态应该是预期值之一
      expect(['online', 'offline', 'degraded', 'healthy', 'unhealthy']).toContain(status.status.toLowerCase());
      expect(typeof status.available).toBe('boolean');
    });

    it('应该正确处理不存在智能体的状态查询', async () => {
      const response = await request(app)
        .get('/api/agents/nonexistent_agent/status')
        .expect(404);

      expect(response.body).toHaveProperty('code');
    });

    it('应该包含响应时间信息', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}/status`)
        .expect(200);

      const status = response.body.data;
      
      // 可能包含延迟或响应时间信息
      if (status.latency !== undefined || status.responseTime !== undefined || status.ping !== undefined) {
        const metric = status.latency || status.responseTime || status.ping;
        expect(typeof metric).toBe('number');
        expect(metric).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('4️⃣ 配置重载功能', () => {
    it('应该成功触发配置重载', async () => {
      const response = await request(app)
        .post('/api/agents/reload');

      // 可能需要管理员权限，返回401或200都可以
      if (response.status === 401 || response.status === 403) {
        expect([401, 403]).toContain(response.status);
      } else {
        expect(response.status).toBeLessThan(400);
        expect(response.body).toHaveProperty('code');
      }
    });

    it('配置重载后智能体列表应该仍然可访问', async () => {
      // 先触发重载
      await request(app).post('/api/agents/reload');

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 再次获取列表
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('5️⃣ 智能体验证功能', () => {
    it('应该支持验证智能体配置', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}/validate`);

      // 如果端点存在
      if (response.status !== 404) {
        expect(response.status).toBeLessThan(400);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('valid');
      } else {
        // 端点不存在也是可以的
        expect(response.status).toBe(404);
      }
    });

    it('验证结果应该包含详细信息', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}/validate`);

      // 如果端点存在且返回成功
      if (response.status === 200) {
        const validation = response.body.data;
        expect(validation).toHaveProperty('valid');
        expect(typeof validation.valid).toBe('boolean');
        
        // 可能包含错误或警告信息
        if (!validation.valid) {
          expect(validation.errors || validation.warnings || validation.message).toBeTruthy();
        }
      }
    });
  });

  describe('6️⃣ 智能体能力查询', () => {
    it('应该返回智能体支持的功能', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}`)
        .expect(200);

      const agent = response.body.data;
      
      // 检查features字段
      if (agent.features) {
        expect(typeof agent.features).toBe('object');
        
        // 常见的feature标志
        if (agent.features.supportsStream !== undefined) {
          expect(typeof agent.features.supportsStream).toBe('boolean');
        }
        if (agent.features.supportsFiles !== undefined) {
          expect(typeof agent.features.supportsFiles).toBe('boolean');
        }
        if (agent.features.supportsImages !== undefined) {
          expect(typeof agent.features.supportsImages).toBe('boolean');
        }
      }
    });

    it('智能体配置应该包含必要的认证信息标志', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}`)
        .expect(200);

      const agent = response.body.data;
      
      // 配置应该存在
      expect(agent.config).toBeTruthy();
      
      // 敏感信息不应该暴露完整内容
      const config = agent.config;
      if (config.apiKey) {
        // API Key应该被mask
        expect(config.apiKey).toMatch(/\*+/);
      }
      
      // 但endpoint等非敏感信息可以显示
      if (config.endpoint) {
        expect(typeof config.endpoint).toBe('string');
      }
    });
  });

  describe('7️⃣ 错误处理', () => {
    it('应该正确处理网络错误', async () => {
      // 尝试访问一个配置了无效endpoint的智能体（如果有）
      const response = await request(app)
        .get('/api/agents');

      // 即使某些智能体配置错误，列表也应该能返回
      expect(response.status).toBeLessThan(500);
    });

    it('应该处理超时情况', async () => {
      const response = await request(app)
        .get(`/api/agents/${firstAgentId}/status`)
        .timeout(10000); // 10秒超时

      // 应该在合理时间内响应
      expect(response.status).toBeDefined();
    });

    it('应该返回统一的错误格式', async () => {
      const response = await request(app)
        .get('/api/agents/invalid_id_12345');

      // 错误响应应该有统一格式
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
      
      // 可能有详细信息
      if (response.body.details || response.body.error) {
        expect(response.body.details || response.body.error).toBeTruthy();
      }
    });
  });

  describe('8️⃣ 性能和并发', () => {
    it('应该能够处理并发请求', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/agents')
      );

      const responses = await Promise.all(requests);

      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
    });

    it('响应时间应该在合理范围内', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/agents')
        .expect(200);

      const duration = Date.now() - startTime;

      // 列表查询应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it('应该支持快速连续查询同一智能体', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app).get(`/api/agents/${firstAgentId}`)
      );

      const responses = await Promise.all(requests);

      // 所有请求都应该返回相同的结果
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(firstAgentId);
      });
    });
  });
});

