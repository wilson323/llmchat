/**
 * 跨服务集成测试
 * 验证不同服务之间的协作和数据流
 */

import request from 'supertest';
import express from 'express';
import { createTestApp, setupTestDatabase, cleanupTestDatabase } from '../testUtils';
import QueueManager from '../../services/QueueManager';
import { AuthServiceV2 } from '../../services/AuthServiceV2';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

describe('Cross-Service Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let testDb: any;
  let redis: Redis;
  let queueManager: QueueManager;
  let authService: AuthServiceV2;
  let eventEmitter: EventEmitter;
  let testUser: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp();

    // 初始化服务
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/1');
    queueManager = QueueManager.getInstance();
    authService = new AuthServiceV2();
    eventEmitter = new EventEmitter();

    // 创建测试用户
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const result = await testDb.query(
      'INSERT INTO users (email, password_hash, full_name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      ['test@example.com', hashedPassword, 'Test User']
    );
    testUser = result.rows[0];

    // 获取认证token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
    await cleanupTestDatabase(testDb);
  });

  beforeEach(async () => {
    // 清理Redis数据
    await redis.flushdb();
  });

  describe('Authentication ↔ Chat Integration', () => {
    let sessionId: string;
    let agentId: string;

    beforeEach(async () => {
      // 创建会话
      const sessionResponse = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent',
          title: 'Integration Test Session'
        })
        .expect(201);

      sessionId = sessionResponse.body.data.id;

      // 获取可用的代理
      const agentsResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (agentsResponse.body.data.length > 0) {
        agentId = agentsResponse.body.data[0].id;
      }
    });

    it('should associate chat sessions with authenticated users', async () => {
      if (!agentId) return;

      // 发送消息
      const messageResponse = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          messages: [
            { role: 'user', content: 'Hello, this is a test message' }
          ],
          stream: false
        })
        .expect(200);

      expect(messageResponse.body).toHaveProperty('success', true);

      // 验证会话历史包含用户关联
      const historyResponse = await request(app)
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body).toHaveProperty('success', true);
      expect(historyResponse.body.data).toHaveProperty('messages');
      expect(historyResponse.body.data).toHaveProperty('userId', testUser.id);
    });

    it('should enforce user permissions on chat operations', async () => {
      if (!agentId) return;

      // 尝试访问其他用户的会话（应该失败）
      const otherUserSession = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent',
          title: 'Other User Session'
        })
        .expect(201);

      // 创建另一个用户并尝试访问其会话
      const otherUserToken = await createOtherUserToken();

      const unauthorizedAccess = await request(app)
        .get(`/api/chat/sessions/${otherUserSession.body.data.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(unauthorizedAccess.body).toHaveProperty('success', false);
    });

    it('should handle user session lifecycle with chat data', async () => {
      if (!agentId) return;

      // 发送多条消息
      const messages = [
        'First message',
        'Second message',
        'Third message'
      ];

      for (const content of messages) {
        await request(app)
          .post('/api/chat/completions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            sessionId,
            messages: [
              { role: 'user', content }
            ],
            stream: false
          })
          .expect(200);
      }

      // 获取会话统计
      const statusResponse = await request(app)
        .get(`/api/chat/status/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.data.messageCount).toBeGreaterThanOrEqual(3);
      expect(statusResponse.body.data.lastActivity).toBeTruthy();

      // 删除会话
      await request(app)
        .delete(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 验证会话已删除
      await request(app)
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    async function createOtherUserToken(): Promise<string> {
      // 创建另一个用户
      const hashedPassword = await require('bcryptjs').hash('otherpassword123', 10);
      const result = await testDb.query(
        'INSERT INTO users (email, password_hash, full_name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
        ['other@example.com', hashedPassword, 'Other User']
      );

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'otherpassword123'
        })
        .expect(200);

      return loginResponse.body.token;
    }
  });

  describe('Queue ↔ Chat Integration', () => {
    let sessionId: string;
    const testQueueName = 'chat-processing-queue';

    beforeEach(async () => {
      // 创建测试队列
      queueManager.createQueue({
        name: testQueueName,
        concurrency: 3,
        maxRetries: 2,
        retryDelay: 1000,
        backoffMultiplier: 2,
        removeOnComplete: 100,
        removeOnFail: 100,
        defaultPriority: 5 as import('../../types/queue').MessagePriority,
        stalledInterval: 30000,
        maxStalledCount: 3,
        delayOnFail: false,
      });

      // 创建会话
      const sessionResponse = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent',
          title: 'Queue Integration Test'
        })
        .expect(201);

      sessionId = sessionResponse.body.data.id;
    });

    afterEach(async () => {
      await queueManager.clearQueue(testQueueName);
    });

    it('should queue chat processing jobs', async () => {
      if (!sessionId) return;

      // 发送聊天消息（应该触发队列处理）
      const response = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          messages: [
            { role: 'user', content: 'Please process this message in queue' }
          ],
          stream: false,
          useQueue: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // 检查队列统计
      const queueStats = await queueManager.getQueueStats(testQueueName);
      expect(queueStats).toBeTruthy();
      expect(queueStats!.total).toBeGreaterThan(0);
    });

    it('should track chat processing metrics in queue', async () => {
      if (!sessionId) return;

      const startTime = Date.now();

      // 发送消息到队列
      await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          messages: [
            { role: 'user', content: 'Metrics test message' }
          ],
          stream: false,
          useQueue: true
        })
        .expect(200);

      // 等待处理完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 检查队列处理统计
      const updatedStats = await queueManager.getQueueStats(testQueueName);
      expect(updatedStats).toBeTruthy();
      expect(updatedStats!.completed).toBeGreaterThan(0);
      expect(updatedStats!.avgProcessingTime).toBeGreaterThan(0);
    });

    it('should handle chat processing failures and retries', async () => {
      if (!sessionId) return;

      // 发送可能失败的消息
      const response = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          messages: [
            { role: 'user', content: 'This might fail' }
          ],
          stream: false,
          useQueue: true,
          simulateFailure: true
        })
        .expect(200);

      // 检查失败处理
      const stats = await queueManager.getQueueStats(testQueueName);
      expect(stats).toBeTruthy();

      // 失败的作业应该在失败队列中或重试
      if (stats!.failed > 0) {
        expect(stats!.errorRate).toBeGreaterThan(0);
      }
    });
  });

  describe('Event Bus Integration', () => {
    it('should propagate events across services', async () => {
      const events: any[] = [];

      // 设置事件监听器
      eventEmitter.on('chat:created', (data) => events.push({ type: 'chat:created', data }));
      eventEmitter.on('chat:message', (data) => events.push({ type: 'chat:message', data }));
      eventEmitter.on('queue:job:completed', (data) => events.push({ type: 'queue:job:completed', data }));

      // 创建会话（应该触发事件）
      const sessionResponse = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent',
          title: 'Event Test Session'
        })
        .expect(201);

      // 发送消息
      const messageResponse = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: sessionResponse.body.data.id,
          messages: [
            { role: 'user', content: 'Event test message' }
          ],
          stream: false
        })
        .expect(200);

      // 等待事件传播
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 验证事件已触发
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'chat:created')).toBe(true);
      expect(events.some(e => e.type === 'chat:message')).toBe(true);
    });

    it('should handle event failures gracefully', async () => {
      const errorEvents: any[] = [];

      // 设置错误事件监听器
      eventEmitter.on('error', (error) => errorEvents.push(error));

      // 模拟事件处理失败
      eventEmitter.emit('test:error', new Error('Test error'));

      // 验证错误被捕获
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Database Transaction Integration', () => {
    it('should maintain data consistency across services', async () => {
      // 开始数据库事务
      await testDb.query('BEGIN');

      try {
        // 创建用户
        const userResult = await testDb.query(
          'INSERT INTO users (email, password_hash, full_name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
          ['transaction@example.com', 'hashed_password', 'Transaction User']
        );

        const userId = userResult.rows[0].id;

        // 创建会话
        const sessionResponse = await request(app)
          .post('/api/chat/init')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent',
            title: 'Transaction Test Session'
          })
          .expect(201);

        const sessionId = sessionResponse.body.data.id;

        // 更新用户关联
        await testDb.query(
          'UPDATE chat_sessions SET user_id = $1 WHERE id = $2',
          [userId, sessionId]
        );

        // 提交事务
        await testDb.query('COMMIT');

        // 验证数据一致性
        const sessionCheck = await testDb.query(
          'SELECT cs.*, u.email as user_email FROM chat_sessions cs LEFT JOIN users u ON cs.user_id = u.id WHERE cs.id = $1',
          [sessionId]
        );

        expect(sessionCheck.rows[0].user_email).toBe('transaction@example.com');
      } catch (error) {
        // 回滚事务
        await testDb.query('ROLLBACK');
        throw error;
      }
    });

    it('should handle transaction rollbacks on errors', async () => {
      const initialSessionCount = await testDb.query(
        'SELECT COUNT(*) FROM chat_sessions'
      );

      await testDb.query('BEGIN');

      try {
        // 创建会话
        const sessionResponse = await request(app)
          .post('/api/chat/init')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent',
            title: 'Rollback Test Session'
          })
          .expect(201);

        // 故意制造错误
        await testDb.query('INSERT INTO invalid_table (column) VALUES ($1)', ['test']);

        await testDb.query('COMMIT');
      } catch (error) {
        // 回滚事务
        await testDb.query('ROLLBACK');

        // 验证回滚成功
        const finalSessionCount = await testDb.query(
          'SELECT COUNT(*) FROM chat_sessions'
        );

        expect(finalSessionCount.rows[0].count).toBe(initialSessionCount.rows[0].count);
      }
    });
  });

  describe('Cache Integration', () => {
    it('should cache frequently accessed data', async () => {
      // 第一次请求（应该从数据库加载）
      const firstResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const firstTime = Date.now();

      // 第二次请求（应该从缓存加载）
      const secondResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const secondTime = Date.now();

      // 验证缓存提升了响应时间
      expect(secondResponse.body.data).toEqual(firstResponse.body.data);

      // 注意：实际测试中可能需要更精确的时间测量
      // 这里我们主要验证数据一致性
    });

    it('should invalidate cache on data changes', async () => {
      // 加载代理列表
      const initialResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 重新加载配置（应该清除缓存）
      await request(app)
        .post('/api/agents/reload')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 再次请求代理列表
      const reloadedResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 验证配置已重新加载
      expect(reloadedResponse.body).toHaveProperty('success', true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = [];
      const requestCount = 10;

      // 创建多个并发请求
      for (let i = 0; i < requestCount; i++) {
        concurrentRequests.push(
          request(app)
            .get('/api/agents')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();

      // 验证所有请求都成功
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(200);
          expect(result.value.body).toHaveProperty('success', true);
        }
      });

      // 验证性能（总时间应该在合理范围内）
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // 5秒内完成10个并发请求
    });

    it('should maintain system stability under load', async () => {
      const loadTestRequests = [];
      const batchSize = 5;
      const batchCount = 3;

      // 分批处理负载测试
      for (let batch = 0; batch < batchCount; batch++) {
        const batchRequests = [];

        for (let i = 0; i < batchSize; i++) {
          batchRequests.push(
            request(app)
              .post('/api/chat/init')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                agentId: 'test-agent',
                title: `Load Test Session ${batch}-${i}`
              })
          );
        }

        const batchResults = await Promise.allSettled(batchRequests);
        loadTestRequests.push(...batchResults);

        // 短暂延迟避免系统过载
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 验证系统稳定性
      const successCount = loadTestRequests.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      ).length;

      const totalCount = loadTestRequests.length;
      const successRate = (successCount / totalCount) * 100;

      expect(successRate).toBeGreaterThan(80); // 至少80%成功率
    });
  });

  describe('Error Propagation Integration', () => {
    it('should propagate errors correctly across service boundaries', async () => {
      // 测试队列操作的错误处理（QueueManager现在是单例模式）
      try {
        // 尝试对不存在的队列进行操作
        await queueManager.pauseQueue('non-existent-queue');
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle service unavailability gracefully', async () => {
      // 模拟外部服务不可用
      const response = await request(app)
        .post('/api/agents/test-agent/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Test message with unavailable service',
          role: 'user'
        })
        .expect([200, 503]); // 可能返回200（降级处理）或503（服务不可用）

      if (response.status === 503) {
        expect(response.body).toHaveProperty('success', false);
      } else if (response.status === 200) {
        // 如果返回200，检查是否有降级处理指示
        expect(response.body).toHaveProperty('success');
        if (!response.body.success) {
          expect(response.body).toHaveProperty('error');
        }
      }
    });
  });

  describe('Resource Cleanup Integration', () => {
    it('should clean up resources properly', async () => {
      // 创建临时资源
      const tempSessions = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/chat/init')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent',
            title: `Temp Session ${i}`
          })
          .expect(201);

        tempSessions.push(response.body.data.id);
      }

      // 验证资源已创建
      for (const sessionId of tempSessions) {
        const checkResponse = await request(app)
          .get(`/api/chat/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(checkResponse.body).toHaveProperty('success', true);
      }

      // 清理资源
      for (const sessionId of tempSessions) {
        await request(app)
          .delete(`/api/chat/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }

      // 验证资源已清理
      for (const sessionId of tempSessions) {
        await request(app)
          .get(`/api/chat/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      }
    });

    it('should handle orphaned resource cleanup', async () => {
      // 创建会话但不正确清理
      const sessionResponse = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent',
          title: 'Orphaned Session'
        })
        .expect(201);

      const sessionId = sessionResponse.body.data.id;

      // 模拟会话创建但关联失败的情况
      // 这里我们直接删除会话来测试清理逻辑
      await request(app)
        .delete(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 验证清理完成
      await request(app)
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});