/**
 * ChatService 单元测试
 * 
 * 测试范围：
 * - 消息处理
 * - 流式响应
 * - 会话管理
 * - 消息搜索
 * - 缓存策略
 * 
 * 覆盖率目标：≥90%
 */

import { ChatService } from '@/services/ChatService';
import { createTestSession, createTestMessage, createTestConversation } from '../../helpers/testUtils';
import { createMockFastGPTClient } from '../../mocks/fastgpt.mock';
import { createMockRedisClient } from '../../mocks/redis.mock';
import { createMockPool } from '../../mocks/database.mock';

// Mock外部依赖
jest.mock('@/clients/FastGPTClient');
jest.mock('ioredis');
jest.mock('@/utils/db');

describe('ChatService', () => {
  let chatService: ChatService;
  let mockFastGPT: any;
  let mockRedis: any;
  let mockPool: any;
  
  beforeEach(() => {
    mockFastGPT = createMockFastGPTClient();
    mockRedis = createMockRedisClient();
    mockPool = createMockPool();
    
    chatService = new ChatService();
    (chatService as any).fastgptClient = mockFastGPT;
    (chatService as any).redis = mockRedis;
    (chatService as any).pool = mockPool;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('processMessage', () => {
    it('should process text messages successfully', async () => {
      // Arrange
      const testSession = createTestSession();
      const userMessage = '你好';
      const aiResponse = '你好！我是AI助手';
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: aiResponse
          }
        }]
      });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act
      const result = await chatService.processMessage({
        sessionId: testSession.id,
        message: userMessage,
        userId: testSession.userId,
        agentId: testSession.agentId
      });
      
      // Assert
      expect(result).toHaveProperty('content', aiResponse);
      expect(mockFastGPT.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: userMessage
          })
        ])
      );
      
      // 验证消息被保存到数据库
      expect(mockPool.query).toHaveBeenCalled();
    });
    
    it('should handle attachments', async () => {
      // Arrange
      const testSession = createTestSession();
      const message = '分析这张图片';
      const attachment = {
        type: 'image',
        url: 'http://example.com/image.jpg'
      };
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: '这是一张风景图片'
          }
        }]
      });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act
      const result = await chatService.processMessage({
        sessionId: testSession.id,
        message,
        userId: testSession.userId,
        agentId: testSession.agentId,
        attachments: [attachment]
      });
      
      // Assert
      expect(mockFastGPT.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.any(String)
          })
        ])
      );
    });
    
    it('should save messages to database', async () => {
      // Arrange
      const testSession = createTestSession();
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      });
      
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'user-msg' }] })  // 保存用户消息
        .mockResolvedValueOnce({ rows: [{ id: 'ai-msg' }] });    // 保存AI消息
      
      // Act
      await chatService.processMessage({
        sessionId: testSession.id,
        message: 'Test',
        userId: testSession.userId,
        agentId: testSession.agentId
      });
      
      // Assert
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      
      // 验证保存用户消息
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining(['user', 'Test'])
      );
      
      // 验证保存AI消息
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining(['assistant', 'Response'])
      );
    });
    
    it('should cache responses', async () => {
      // Arrange
      const testSession = createTestSession();
      const message = 'What is AI?';
      const cacheKey = `chat:${testSession.agentId}:${message}`;
      
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'AI is...' }
        }]
      });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act
      await chatService.processMessage({
        sessionId: testSession.id,
        message,
        userId: testSession.userId,
        agentId: testSession.agentId
      });
      
      // Assert
      expect(mockRedis.get).toHaveBeenCalledWith(expect.stringContaining(cacheKey));
      expect(mockRedis.set).toHaveBeenCalled();
    });
    
    it('should handle FastGPT API errors', async () => {
      // Arrange
      const testSession = createTestSession();
      
      mockFastGPT.chat = jest.fn().mockRejectedValue(
        new Error('FastGPT API timeout')
      );
      
      // Act & Assert
      await expect(chatService.processMessage({
        sessionId: testSession.id,
        message: 'Test',
        userId: testSession.userId,
        agentId: testSession.agentId
      })).rejects.toThrow('FastGPT API timeout');
    });
    
    it('should retry on transient failures', async () => {
      // Arrange
      const testSession = createTestSession();
      
      mockFastGPT.chat = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          choices: [{
            message: { role: 'assistant', content: 'Success' }
          }]
        });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act
      const result = await chatService.processMessage({
        sessionId: testSession.id,
        message: 'Test',
        userId: testSession.userId,
        agentId: testSession.agentId
      });
      
      // Assert
      expect(result.content).toBe('Success');
      expect(mockFastGPT.chat).toHaveBeenCalledTimes(3); // 2次失败 + 1次成功
    });
  });
  
  describe('streamResponse', () => {
    it('should stream SSE responses correctly', async () => {
      // Arrange
      const testSession = createTestSession();
      const chunks: string[] = [];
      
      mockFastGPT.chatStream = jest.fn().mockImplementation(async function* () {
        yield { content: 'Hello' };
        yield { content: ' World' };
        yield { content: '!' };
      });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act
      for await (const chunk of chatService.streamResponse({
        sessionId: testSession.id,
        message: 'Test',
        userId: testSession.userId,
        agentId: testSession.agentId
      })) {
        chunks.push(chunk.content);
      }
      
      // Assert
      expect(chunks).toEqual(['Hello', ' World', '!']);
    });
    
    it('should handle stream interruption', async () => {
      // Arrange
      mockFastGPT.chatStream = jest.fn().mockImplementation(async function* () {
        yield { content: 'Start' };
        throw new Error('Stream interrupted');
      });
      
      // Act & Assert
      const generator = chatService.streamResponse({
        sessionId: 'session-123',
        message: 'Test',
        userId: 'user-123',
        agentId: 'default-agent'
      });
      
      await expect(generator.next()).resolves.toEqual({
        value: expect.objectContaining({ content: 'Start' }),
        done: false
      });
      
      await expect(generator.next()).rejects.toThrow('Stream interrupted');
    });
    
    it('should save complete response after streaming', async () => {
      // Arrange
      mockFastGPT.chatStream = jest.fn().mockImplementation(async function* () {
        yield { content: 'Part 1' };
        yield { content: 'Part 2' };
      });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act
      const chunks = [];
      for await (const chunk of chatService.streamResponse({
        sessionId: 'session-123',
        message: 'Test',
        userId: 'user-123',
        agentId: 'default-agent'
      })) {
        chunks.push(chunk.content);
      }
      
      // Assert
      // 验证完整内容被保存
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining([
          expect.stringContaining('Part 1Part 2')
        ])
      );
    });
  });
  
  describe('getMessages', () => {
    it('should retrieve messages with pagination', async () => {
      // Arrange
      const testSession = createTestSession();
      const messages = createTestConversation(testSession.id, 10);
      
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: messages.slice(0, 5) })  // 第一页
        .mockResolvedValueOnce({ rows: [{ count: 10 }] });       // 总数
      
      // Act
      const result = await chatService.getMessages(testSession.id, {
        page: 1,
        pageSize: 5
      });
      
      // Assert
      expect(result.messages).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });
    
    it('should filter by date range', async () => {
      // Arrange
      const testSession = createTestSession();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: []
      });
      
      // Act
      await chatService.getMessages(testSession.id, {
        startDate,
        endDate
      });
      
      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $'),
        expect.arrayContaining([startDate, endDate])
      );
    });
    
    it('should search by keyword', async () => {
      // Arrange
      const testSession = createTestSession();
      const keyword = 'important';
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [
          createTestMessage({ content: 'This is important' }),
          createTestMessage({ content: 'Another important message' })
        ]
      });
      
      // Act
      const result = await chatService.getMessages(testSession.id, {
        keyword
      });
      
      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([`%${keyword}%`])
      );
    });
  });
  
  describe('createSession', () => {
    it('should create session with default settings', async () => {
      // Arrange
      const userId = 'user-123';
      const agentId = 'default-agent';
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{
          id: 'session-123',
          user_id: userId,
          agent_id: agentId,
          title: '新对话',
          created_at: new Date()
        }]
      });
      
      // Act
      const result = await chatService.createSession({
        userId,
        agentId,
        title: '新对话'
      });
      
      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId', userId);
      expect(result).toHaveProperty('agentId', agentId);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sessions'),
        expect.arrayContaining([userId, agentId])
      );
    });
    
    it('should generate default title if not provided', async () => {
      // Arrange
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{
          id: 'session-123',
          title: '新对话 1'
        }]
      });
      
      // Act
      const result = await chatService.createSession({
        userId: 'user-123',
        agentId: 'default-agent'
      });
      
      // Assert
      expect(result.title).toMatch(/新对话/);
    });
    
    it('should handle database errors', async () => {
      // Arrange
      mockPool.query = jest.fn().mockRejectedValue(
        new Error('Database error')
      );
      
      // Act & Assert
      await expect(chatService.createSession({
        userId: 'user-123',
        agentId: 'default-agent'
      })).rejects.toThrow('Database error');
    });
  });
  
  describe('switchAgent', () => {
    it('should update session agent', async () => {
      // Arrange
      const testSession = createTestSession();
      const newAgentId = 'new-agent';
      
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [testSession] })  // 验证会话存在
        .mockResolvedValueOnce({ rows: [{ ...testSession, agentId: newAgentId }] }); // 更新
      
      // Act
      const result = await chatService.switchAgent(testSession.id, newAgentId);
      
      // Assert
      expect(result.session.agentId).toBe(newAgentId);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions'),
        expect.arrayContaining([newAgentId, testSession.id])
      );
    });
    
    it('should preserve message history', async () => {
      // Arrange
      const testSession = createTestSession();
      const messages = createTestConversation(testSession.id, 5);
      
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [testSession] })
        .mockResolvedValueOnce({ rows: [{ agent_id: 'new-agent' }] })
        .mockResolvedValueOnce({ rows: messages }); // 获取消息历史
      
      // Act
      const result = await chatService.switchAgent(testSession.id, 'new-agent');
      
      // Assert
      expect(result).toHaveProperty('messagesCount', 5);
    });
    
    it('should reject invalid agent', async () => {
      // Arrange
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [createTestSession()] })
        .mockRejectedValueOnce(new Error('Agent not found'));
      
      // Act & Assert
      await expect(chatService.switchAgent('session-123', 'invalid-agent'))
        .rejects.toThrow('Agent not found');
    });
  });
  
  describe('searchMessages', () => {
    it('should search by keyword', async () => {
      // Arrange
      const keyword = 'TypeScript';
      const matches = [
        createTestMessage({ content: 'TypeScript is great' }),
        createTestMessage({ content: 'Learning TypeScript' })
      ];
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: matches
      });
      
      // Act
      const result = await chatService.searchMessages({
        userId: 'user-123',
        keyword
      });
      
      // Assert
      expect(result.messages).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([`%${keyword}%`])
      );
    });
    
    it('should filter by agent', async () => {
      // Arrange
      const agentId = 'specific-agent';
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: []
      });
      
      // Act
      await chatService.searchMessages({
        userId: 'user-123',
        agentId
      });
      
      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_id'),
        expect.arrayContaining([agentId])
      );
    });
    
    it('should rank results by relevance', async () => {
      // Arrange
      const keyword = 'test';
      const messages = [
        createTestMessage({ content: 'test test test' }),      // 高相关性
        createTestMessage({ content: 'this is a test' }),      // 中相关性
        createTestMessage({ content: 'maybe related test' })   // 低相关性
      ];
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: messages
      });
      
      // Act
      const result = await chatService.searchMessages({
        userId: 'user-123',
        keyword
      });
      
      // Assert: 结果应该按相关性排序
      expect(result.messages[0].content).toContain('test test test');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle database connection loss', async () => {
      // Arrange
      mockPool.query = jest.fn().mockRejectedValue(
        new Error('ECONNREFUSED')
      );
      
      // Act & Assert
      await expect(chatService.processMessage({
        sessionId: 'session-123',
        message: 'Test',
        userId: 'user-123',
        agentId: 'default-agent'
      })).rejects.toThrow('ECONNREFUSED');
    });
    
    it('should handle Redis cache failures gracefully', async () => {
      // Arrange
      mockRedis.get = jest.fn().mockRejectedValue(new Error('Redis error'));
      mockRedis.set = jest.fn().mockRejectedValue(new Error('Redis error'));
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      });
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'msg-123' }]
      });
      
      // Act: Redis失败不应该影响主功能
      const result = await chatService.processMessage({
        sessionId: 'session-123',
        message: 'Test',
        userId: 'user-123',
        agentId: 'default-agent'
      });
      
      // Assert
      expect(result).toHaveProperty('content', 'Response');
    });
    
    it('should handle empty AI responses', async () => {
      // Arrange
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: '' }
        }]
      });
      
      // Act & Assert
      await expect(chatService.processMessage({
        sessionId: 'session-123',
        message: 'Test',
        userId: 'user-123',
        agentId: 'default-agent'
      })).rejects.toThrow('Empty response');
    });
  });
  
  describe('Performance', () => {
    it('should handle large conversation history', async () => {
      // Arrange
      const testSession = createTestSession();
      const largeHistory = createTestConversation(testSession.id, 100);
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: largeHistory
      });
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      });
      
      // Act
      const startTime = Date.now();
      await chatService.processMessage({
        sessionId: testSession.id,
        message: 'Test',
        userId: testSession.userId,
        agentId: testSession.agentId
      });
      const duration = Date.now() - startTime;
      
      // Assert: 应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // <1秒
    });
    
    it('should limit context window', async () => {
      // Arrange
      const testSession = createTestSession();
      const largeHistory = createTestConversation(testSession.id, 200);
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: largeHistory
      });
      
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      });
      
      // Act
      await chatService.processMessage({
        sessionId: testSession.id,
        message: 'Test',
        userId: testSession.userId,
        agentId: testSession.agentId
      });
      
      // Assert: 传递给API的消息应该被限制
      const calledMessages = mockFastGPT.chat.mock.calls[0][0];
      expect(calledMessages.length).toBeLessThanOrEqual(50); // 最多50条上下文
    });
  });
});

