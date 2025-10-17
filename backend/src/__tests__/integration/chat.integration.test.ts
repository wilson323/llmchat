/**
 * Chat聊天集成测试
 * 
 * 测试范围：
 * - 完整聊天流程
 * - 多会话管理
 * - 消息持久化
 * - 智能体切换
 * 
 * 覆盖率目标：≥90%
 */

import request from 'supertest';
import { Pool } from 'pg';
import { createTestUser, generateToken, cleanupTestData } from '../helpers/testUtils';
import { app } from '@/index';
import { dbTestSetup } from '../utils/dbTestUtils';

describe('Chat Integration Tests', () => {
  let testUserId: string | null = null;
  let authToken: string | null = null;
  let pool: Pool;
  
  beforeAll(async () => {
    await dbTestSetup.beforeAll();
    pool = dbTestSetup.getClient();
  });
  
  beforeEach(async () => {
    await dbTestSetup.beforeEach();
  });
  
  afterEach(async () => {
    if (testUserId) {
      await cleanupTestData(pool, testUserId);
      testUserId = null;
    }
  });
  
  afterAll(async () => {
    await dbTestSetup.afterAll();
  });
  
  describe('Complete Chat Flow', () => {
    it('should create session and send messages', async () => {
      // Step 1: 创建测试用户并登录
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      // Step 2: 创建会话
      const createSessionResponse = await request(app)
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'default-agent',
          title: '测试会话'
        });
      
      expect(createSessionResponse.status).toBe(201);
      const sessionId = createSessionResponse.body.data.id;
      
      // Step 3: 发送第一条消息
      const message1Response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          message: '你好',
          agentId: 'default-agent'
        });
      
      expect(message1Response.status).toBe(200);
      expect(message1Response.body.data).toHaveProperty('content');
      
      // Step 4: 发送第二条消息
      const message2Response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          message: '介绍一下你自己',
          agentId: 'default-agent'
        });
      
      expect(message2Response.status).toBe(200);
      
      // Step 5: 获取消息历史
      const historyResponse = await request(app)
        .get(`/api/chat/sessions/${sessionId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.data.messages.length).toBeGreaterThanOrEqual(4); // 2用户 + 2AI
    });
    
    it('should handle streaming responses', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      const sessionResponse = await request(app)
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'default-agent',
          title: '流式测试'
        });
      
      const sessionId = sessionResponse.body.data.id;
      
      // Act: 发送流式请求
      const streamResponse = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          message: '写一首诗',
          agentId: 'default-agent',
          stream: true
        });
      
      // Assert
      expect(streamResponse.status).toBe(200);
      expect(streamResponse.headers['content-type']).toContain('text/event-stream');
    });
  });
  
  describe('Multiple Sessions Management', () => {
    it('should handle multiple concurrent sessions', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      // Act: 创建3个会话
      const sessions = await Promise.all([
        request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'agent-1' }),
        request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'agent-2' }),
        request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'agent-3' })
      ]);
      
      // Assert
      expect(sessions[0].status).toBe(201);
      expect(sessions[1].status).toBe(201);
      expect(sessions[2].status).toBe(201);
      
      // 验证会话列表
      const listResponse = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(listResponse.body.data.sessions.length).toBeGreaterThanOrEqual(3);
    });
    
    it('should isolate messages between sessions', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      // 创建两个会话
      const session1 = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'agent-1' });
      const session2 = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'agent-2' });
      
      const session1Id = session1.body.data.id;
      const session2Id = session2.body.data.id;
      
      // Act: 在两个会话中发送不同消息
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId: session1Id, message: 'Session 1 message', agentId: 'agent-1' });
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId: session2Id, message: 'Session 2 message', agentId: 'agent-2' });
      
      // Assert: 验证消息隔离
      const session1Messages = await request(app).get(`/api/chat/sessions/${session1Id}/messages`).set('Authorization', `Bearer ${authToken}`);
      const session2Messages = await request(app).get(`/api/chat/sessions/${session2Id}/messages`).set('Authorization', `Bearer ${authToken}`);
      
      const session1Content = session1Messages.body.data.messages.map((m: any) => m.content).join('');
      const session2Content = session2Messages.body.data.messages.map((m: any) => m.content).join('');
      
      expect(session1Content).toContain('Session 1 message');
      expect(session1Content).not.toContain('Session 2 message');
      
      expect(session2Content).toContain('Session 2 message');
      expect(session2Content).not.toContain('Session 1 message');
    });
  });
  
  describe('Message Persistence', () => {
    it('should persist messages across requests', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      const sessionResponse = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'default-agent' });
      const sessionId = sessionResponse.body.data.id;
      
      // Act: 发送消息
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: '消息1', agentId: 'default-agent' });
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: '消息2', agentId: 'default-agent' });
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: '消息3', agentId: 'default-agent' });
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 从数据库直接查询
      const dbMessages = await pool.query(
        'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      );
      
      // Assert
      expect(dbMessages.rows.length).toBeGreaterThanOrEqual(6); // 3用户 + 3AI
    });
    
    it('should maintain message order', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      const sessionResponse = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'default-agent' });
      const sessionId = sessionResponse.body.data.id;
      
      // Act: 按顺序发送
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: 'First', agentId: 'default-agent' });
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: 'Second', agentId: 'default-agent' });
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: 'Third', agentId: 'default-agent' });
      
      // 获取历史
      const historyResponse = await request(app).get(`/api/chat/sessions/${sessionId}/messages`).set('Authorization', `Bearer ${authToken}`);
      
      // Assert: 验证顺序
      const messages = historyResponse.body.data.messages;
      const userMessages = messages.filter((m: any) => m.role === 'user');
      
      expect(userMessages[0].content).toBe('First');
      expect(userMessages[1].content).toBe('Second');
      expect(userMessages[2].content).toBe('Third');
    });
  });
  
  describe('Agent Switching', () => {
    it('should switch agent mid-conversation', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      const sessionResponse = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'agent-1' });
      const sessionId = sessionResponse.body.data.id;
      
      // Step 1: 发送消息给agent-1
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: 'Hello agent 1', agentId: 'agent-1' });
      
      // Step 2: 切换智能体
      const switchResponse = await request(app)
        .put(`/api/chat/sessions/${sessionId}/agent`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ agentId: 'agent-2' });
      
      expect(switchResponse.status).toBe(200);
      
      // Step 3: 发送消息给agent-2
      const message2Response = await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: 'Hello agent 2', agentId: 'agent-2' });
      
      expect(message2Response.status).toBe(200);
      
      // Step 4: 验证会话信息
      const sessionInfo = await request(app).get(`/api/chat/sessions/${sessionId}`).set('Authorization', `Bearer ${authToken}`);
      
      expect(sessionInfo.body.data.agentId).toBe('agent-2');
    });
  });
  
  describe('Performance', () => {
    it('should handle rapid message sending', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      const sessionResponse = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'default-agent' });
      const sessionId = sessionResponse.body.data.id;
      
      // Act: 快速发送10条消息
      const startTime = Date.now();
      const messagePromises = Array(10).fill(null).map((_, i) =>
        request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: `Message ${i}`, agentId: 'default-agent' })
      );
      
      const responses = await Promise.all(messagePromises);
      const duration = Date.now() - startTime;
      
      // Assert
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(8); // 至少80%成功
      expect(duration).toBeLessThan(5000); // <5秒完成
    });
  });
  
  describe('Error Scenarios', () => {
    it('should handle unauthorized session access', async () => {
      // Arrange
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [user1.id, user1.email, user1.passwordHash, true]
      );
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [user2.id, user2.email, user2.passwordHash, true]
      );
      
      testUserId = user1.id;
      const user1Token = generateToken(user1.id);
      const user2Token = generateToken(user2.id);
      
      // User1创建会话
      const sessionResponse = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${user1Token}`).send({ agentId: 'default-agent' });
      const sessionId = sessionResponse.body.data.id;
      
      // Act: User2尝试访问User1的会话
      const unauthorizedResponse = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ sessionId, message: 'Unauthorized', agentId: 'default-agent' });
      
      // Assert
      expect(unauthorizedResponse.status).toBe(403);
      
      // Cleanup user2
      await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
    });
    
    it('should handle malformed message content', async () => {
      // Arrange
      const testUser = await createTestUser();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.email, testUser.passwordHash, true]
      );
      testUserId = testUser.id;
      authToken = generateToken(testUser.id);
      
      const sessionResponse = await request(app).post('/api/chat/sessions').set('Authorization', `Bearer ${authToken}`).send({ agentId: 'default-agent' });
      const sessionId = sessionResponse.body.data.id;
      
      // Act: 发送各种恶意内容
      const xssResponse = await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: '<script>alert("XSS")</script>', agentId: 'default-agent' });
      
      const sqlResponse = await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${authToken}`).send({ sessionId, message: "'; DROP TABLE messages; --", agentId: 'default-agent' });
      
      // Assert: 应该正常处理（清理或拒绝）
      expect([200, 400]).toContain(xssResponse.status);
      expect([200, 400]).toContain(sqlResponse.status);
      
      // 验证数据库未被破坏
      const messagesCheck = await pool.query('SELECT COUNT(*) FROM messages');
      expect(messagesCheck.rows[0].count).toBeDefined();
    });
  });
});

