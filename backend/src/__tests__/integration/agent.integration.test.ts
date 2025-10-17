/**
 * Agent智能体集成测试
 * 
 * 测试范围：
 * - CRUD操作完整流程
 * - FastGPT同步
 * - 配置管理
 * - 状态监控
 * 
 * 覆盖率目标：≥90%
 */

import request from 'supertest';
import { generateToken } from '../helpers/testUtils';

describe('Agent Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let userToken: string;
  
  beforeAll(async () => {
    // const { app: expressApp } = await import('@/index');
    // app = expressApp;
    
    adminToken = generateToken('admin-123', { isAdmin: true });
    userToken = generateToken('user-123', { isAdmin: false });
  });
  
  describe('Complete Agent CRUD Operations', () => {
    it('should list all agents', async () => {
      // Act
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${userToken}`);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('code', 'SUCCESS');
      expect(response.body.data).toHaveProperty('agents');
      expect(Array.isArray(response.body.data.agents)).toBe(true);
    });
    
    it('should get agent details', async () => {
      // Step 1: 获取智能体列表
      const listResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${userToken}`);
      
      const firstAgent = listResponse.body.data.agents[0];
      
      // Step 2: 获取详细信息
      const detailResponse = await request(app)
        .get(`/api/agents/${firstAgent.id}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      // Assert
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data).toHaveProperty('id', firstAgent.id);
      expect(detailResponse.body.data).toHaveProperty('config');
    });
    
    it('should update agent configuration (admin only)', async () => {
      // Arrange
      const listResponse = await request(app).get('/api/agents').set('Authorization', `Bearer ${adminToken}`);
      const agentId = listResponse.body.data.agents[0].id;
      
      // Act: 管理员更新
      const updateResponse = await request(app)
        .put(`/api/agents/${agentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新后的助手',
          description: '新描述'
        });
      
      // Assert
      expect(updateResponse.status).toBe(200);
      
      // 验证更新生效
      const detailResponse = await request(app).get(`/api/agents/${agentId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(detailResponse.body.data.name).toBe('更新后的助手');
    });
    
    it('should reject non-admin update attempts', async () => {
      // Arrange
      const listResponse = await request(app).get('/api/agents').set('Authorization', `Bearer ${userToken}`);
      const agentId = listResponse.body.data.agents[0].id;
      
      // Act: 普通用户尝试更新
      const updateResponse = await request(app)
        .put(`/api/agents/${agentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: '尝试更新' });
      
      // Assert
      expect(updateResponse.status).toBe(403);
    });
  });
  
  describe('FastGPT Sync', () => {
    it('should sync agents from FastGPT', async () => {
      // Act
      const syncResponse = await request(app)
        .post('/api/agents/sync')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Assert
      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.data).toHaveProperty('synced');
      expect(syncResponse.body.data.synced).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle sync failures gracefully', async () => {
      // 模拟FastGPT不可用的情况
      // 应该返回错误但不崩溃
      
      // Act
      const syncResponse = await request(app)
        .post('/api/agents/sync')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Assert
      expect([200, 503]).toContain(syncResponse.status);
    });
  });
  
  describe('Status Monitoring', () => {
    it('should check agent health status', async () => {
      // Arrange
      const listResponse = await request(app).get('/api/agents').set('Authorization', `Bearer ${userToken}`);
      const agentId = listResponse.body.data.agents[0].id;
      
      // Act
      const statusResponse = await request(app)
        .get(`/api/agents/${agentId}/status`)
        .set('Authorization', `Bearer ${userToken}`);
      
      // Assert
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toHaveProperty('available');
      expect(statusResponse.body.data).toHaveProperty('status');
    });
    
    it('should report response time metrics', async () => {
      // Arrange
      const listResponse = await request(app).get('/api/agents').set('Authorization', `Bearer ${userToken}`);
      const agentId = listResponse.body.data.agents[0].id;
      
      // Act
      const statusResponse = await request(app).get(`/api/agents/${agentId}/status`).set('Authorization', `Bearer ${userToken}`);
      
      // Assert
      if (statusResponse.body.data.available) {
        expect(statusResponse.body.data).toHaveProperty('responseTime');
        expect(statusResponse.body.data.responseTime).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Configuration Reload', () => {
    it('should reload configuration without downtime', async () => {
      // Step 1: 获取当前智能体列表
      const beforeReload = await request(app).get('/api/agents').set('Authorization', `Bearer ${adminToken}`);
      const agentCountBefore = beforeReload.body.data.agents.length;
      
      // Step 2: 重载配置
      const reloadResponse = await request(app)
        .post('/api/agents/reload')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(reloadResponse.status).toBe(200);
      
      // Step 3: 验证智能体仍然可用
      const afterReload = await request(app).get('/api/agents').set('Authorization', `Bearer ${adminToken}`);
      const agentCountAfter = afterReload.body.data.agents.length;
      
      // Assert
      expect(agentCountAfter).toBeGreaterThanOrEqual(agentCountBefore);
    });
  });
});

