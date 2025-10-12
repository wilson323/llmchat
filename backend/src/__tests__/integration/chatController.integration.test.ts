/**
 * ChatController 集成测试
 * 验证重构后的控制器与外部服务的集成
 */

import request from 'supertest';
import express from 'express';
import { createTestApp, setupTestDatabase, cleanupTestDatabase } from '../testUtils';

describe('ChatController Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let testDb: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp();

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
    await cleanupTestDatabase(testDb);
  });

  describe('ChatSessionController', () => {
    describe('GET /api/chat/sessions', () => {
      it('should return chat sessions list', async () => {
        const response = await request(app)
          .get('/api/chat/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should validate agentId parameter', async () => {
        const response = await request(app)
          .get('/api/chat/sessions')
          .query({ agentId: 'invalid-uuid' })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/chat/sessions/:sessionId', () => {
      it('should return specific chat session', async () => {
        // 首先创建一个会话
        const createResponse = await request(app)
          .post('/api/chat/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent-id',
            title: 'Test Session'
          })
          .expect(201);

        const sessionId = createResponse.body.data.id;

        // 获取会话详情
        const response = await request(app)
          .get(`/api/chat/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id', sessionId);
        expect(response.body.data).toHaveProperty('messages');
        expect(Array.isArray(response.body.data.messages)).toBe(true);
      });

      it('should return 404 for non-existent session', async () => {
        const response = await request(app)
          .get('/api/chat/sessions/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('DELETE /api/chat/sessions/:sessionId', () => {
      it('should delete chat session', async () => {
        // 创建会话
        const createResponse = await request(app)
          .post('/api/chat/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent-id',
            title: 'Test Session to Delete'
          })
          .expect(201);

        const sessionId = createResponse.body.data.id;

        // 删除会话
        const response = await request(app)
          .delete(`/api/chat/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);

        // 验证会话已删除
        await request(app)
          .get(`/api/chat/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('ChatMessageController', () => {
    let sessionId: string;

    beforeEach(async () => {
      // 为每个测试创建新的会话
      const response = await request(app)
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent-id',
          title: 'Test Message Session'
        })
        .expect(201);

      sessionId = response.body.data.id;
    });

    describe('POST /api/chat/completions', () => {
      it('should handle streaming chat completion', async () => {
        const response = await request(app)
          .post('/api/chat/completions')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .send({
            sessionId,
            messages: [
              { role: 'user', content: 'Hello, how are you?' }
            ],
            stream: true
          })
          .expect(200);

        expect(response.headers['content-type']).toMatch(/text\/event-stream/);
        expect(response.text).toContain('event: chunk');
        expect(response.text).toContain('event: end');
      });

      it('should handle non-streaming chat completion', async () => {
        const response = await request(app)
          .post('/api/chat/completions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            sessionId,
            messages: [
              { role: 'user', content: 'Hello' }
            ],
            stream: false
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('choices');
        expect(Array.isArray(response.body.data.choices)).toBe(true);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/chat/completions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // 缺少sessionId
            messages: []
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/chat/feedback', () => {
      it('should accept message feedback', async () => {
        const response = await request(app)
          .post('/api/chat/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            sessionId,
            messageId: 'test-message-id',
            feedback: {
              rating: 5,
              comment: 'Great response!'
            }
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should validate feedback data', async () => {
        const response = await request(app)
          .post('/api/chat/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            sessionId,
            messageId: 'test-message-id',
            feedback: {
              rating: 11 // 无效评分
            }
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('ChatInitController', () => {
    describe('POST /api/chat/init', () => {
      it('should initialize new chat session', async () => {
        const response = await request(app)
          .post('/api/chat/init')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent-id',
            title: 'New Test Session'
          })
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('agentId', 'test-agent-id');
        expect(response.body.data).toHaveProperty('title', 'New Test Session');
        expect(response.body.data).toHaveProperty('messages');
        expect(Array.isArray(response.body.data.messages)).toBe(true);
      });

      it('should use default title when not provided', async () => {
        const response = await request(app)
          .post('/api/chat/init')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent-id'
          })
          .expect(201);

        expect(response.body.data).toHaveProperty('title');
        expect(response.body.data.title).toBeTruthy();
      });
    });

    describe('GET /api/chat/status/:sessionId', () => {
      it('should return session status', async () => {
        // 创建会话
        const createResponse = await request(app)
          .post('/api/chat/init')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            agentId: 'test-agent-id',
            title: 'Status Test Session'
          })
          .expect(201);

        const sessionId = createResponse.body.data.id;

        // 获取状态
        const response = await request(app)
          .get(`/api/chat/status/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('sessionId', sessionId);
        expect(response.body.data).toHaveProperty('isActive', true);
        expect(response.body.data).toHaveProperty('messageCount');
        expect(response.body.data).toHaveProperty('lastActivity');
      });
    });
  });

  describe('ChatAttachmentController', () => {
    let sessionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent-id',
          title: 'Attachment Test Session'
        })
        .expect(201);

      sessionId = response.body.data.id;
    });

    describe('POST /api/chat/upload', () => {
      it('should handle file upload', async () => {
        const response = await request(app)
          .post('/api/chat/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('test file content'), 'test.txt')
          .field('sessionId', sessionId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('filename', 'test.txt');
        expect(response.body.data).toHaveProperty('mimeType', 'text/plain');
        expect(response.body.data).toHaveProperty('size');
      });

      it('should validate file size', async () => {
        // 创建超大文件缓冲区
        const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

        const response = await request(app)
          .post('/api/chat/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', largeBuffer, 'large.txt')
          .field('sessionId', sessionId)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toContain('File size exceeds');
      });

      it('should validate file type', async () => {
        const response = await request(app)
          .post('/api/chat/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('executable content'), 'malware.exe')
          .field('sessionId', sessionId)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toContain('File type not allowed');
      });
    });

    describe('GET /api/chat/attachments/:sessionId', () => {
      it('should return session attachments', async () => {
        // 先上传文件
        await request(app)
          .post('/api/chat/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('test content'), 'test.txt')
          .field('sessionId', sessionId)
          .expect(200);

        // 获取附件列表
        const response = await request(app)
          .get(`/api/chat/attachments/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.data)).toBe(true);
        if (response.body.data.length > 0) {
          expect(response.body.data[0]).toHaveProperty('id');
          expect(response.body.data[0]).toHaveProperty('filename');
        }
      });
    });

    describe('DELETE /api/chat/attachments/:attachmentId', () => {
      it('should delete attachment', async () => {
        // 上传文件
        const uploadResponse = await request(app)
          .post('/api/chat/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('test content'), 'test.txt')
          .field('sessionId', sessionId)
          .expect(200);

        const attachmentId = uploadResponse.body.data.id;

        // 删除附件
        const response = await request(app)
          .delete(`/api/chat/attachments/${attachmentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);

        // 验证附件已删除
        const listResponse = await request(app)
          .get(`/api/chat/attachments/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const attachment = listResponse.body.data.find((a: any) => a.id === attachmentId);
        expect(attachment).toBeUndefined();
      });
    });
  });

  describe('Cross-Controller Integration', () => {
    it('should handle complete chat workflow', async () => {
      // 1. 初始化会话
      const initResponse = await request(app)
        .post('/api/chat/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentId: 'test-agent-id',
          title: 'Complete Workflow Test'
        })
        .expect(201);

      const sessionId = initResponse.body.data.id;

      // 2. 上传文件
      const uploadResponse = await request(app)
        .post('/api/chat/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test document'), 'document.txt')
        .field('sessionId', sessionId)
        .expect(200);

      const attachmentId = uploadResponse.body.data.id;

      // 3. 发送消息（带附件引用）
      const messageResponse = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          messages: [
            {
              role: 'user',
              content: 'Please analyze the attached document',
              attachments: [attachmentId]
            }
          ],
          stream: false
        })
        .expect(200);

      expect(messageResponse.body).toHaveProperty('success', true);

      // 4. 提供反馈
      const feedbackResponse = await request(app)
        .post('/api/chat/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          messageId: messageResponse.body.data.choices[0].message.id,
          feedback: {
            rating: 4,
            comment: 'Good analysis'
          }
        })
        .expect(200);

      expect(feedbackResponse.body).toHaveProperty('success', true);

      // 5. 检查会话状态
      const statusResponse = await request(app)
        .get(`/api/chat/status/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.data.messageCount).toBeGreaterThan(0);
      expect(statusResponse.body.data.lastActivity).toBeTruthy();

      // 6. 获取完整会话历史
      const historyResponse = await request(app)
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.data.messages).toHaveLength(2); // user + assistant
      expect(historyResponse.body.data.attachments).toHaveLength(1);

      // 7. 清理：删除会话（应该级联删除附件）
      await request(app)
        .delete(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 验证附件也被删除
      await request(app)
        .get(`/api/chat/attachments/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 会话应该不存在
      await request(app)
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid-json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle service unavailability', async () => {
      // 模拟外部服务不可用的情况
      const response = await request(app)
        .post('/api/chat/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: 'non-existent-session-id',
          messages: [{ role: 'user', content: 'test' }],
          stream: false
        })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});