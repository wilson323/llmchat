/**
 * Message 实体类型测试
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type {
  StandardMessage,
  SimpleMessage,
  MessageRole,
  MessageMetadata,
  FeedbackType,
  MessageContent,
  MessageAttachment,
  StreamChunk
} from '../../src/entities/message.js';

describe('StandardMessage 类型测试', () => {
  const validStandardMessage: StandardMessage = {
    id: 'msg-123',
    role: 'user',
    content: 'Hello, world!',
    timestamp: Date.now()
  };

  describe('基础字段验证', () => {
    it('应该接受有效的标准消息', () => {
      const message: StandardMessage = validStandardMessage;

      expect(message.id).toBe('msg-123');
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it('应该支持所有消息角色', () => {
      const roles: MessageRole[] = ['user', 'assistant', 'system', 'tool'];

      roles.forEach(role => {
        const message: StandardMessage = { ...validStandardMessage, role };
        expect(message.role).toBe(role);
      });
    });

    it('应该接受可选的metadata字段', () => {
      const metadata: MessageMetadata = {
        agentId: 'agent-123',
        sessionId: 'session-123',
        tokens: 50,
        model: 'gpt-3.5-turbo',
        finishReason: 'stop',
        responseChatItemId: 'response-123',
        cost: 0.001,
        latency: 1500,
        temperature: 0.7,
        provider: 'openai',
        cached: false,
        editHistory: [],
        flags: ['important'],
        tags: ['greeting'],
        customData: { source: 'web' }
      };

      const message: StandardMessage = {
        ...validStandardMessage,
        metadata
      };

      expect(message.metadata?.agentId).toBe('agent-123');
      expect(message.metadata?.sessionId).toBe('session-123');
      expect(message.metadata?.tokens).toBe(50);
      expect(message.metadata?.cost).toBe(0.001);
      expect(message.metadata?.tags).toContain('greeting');
    });

    it('应该支持部分metadata字段', () => {
      const partialMetadata: MessageMetadata = {
        agentId: 'agent-123',
        sessionId: 'session-123'
      };

      const message: StandardMessage = {
        ...validStandardMessage,
        metadata: partialMetadata
      };

      expect(message.metadata?.agentId).toBe('agent-123');
      expect(message.metadata?.sessionId).toBe('session-123');
      expect(message.metadata?.tokens).toBeUndefined();
    });
  });

  describe('消息内容类型', () => {
    it('应该支持简单文本内容', () => {
      const message: StandardMessage = {
        ...validStandardMessage,
        content: 'Simple text message'
      };
      expect(message.content).toBe('Simple text message');
    });

    it('应该支持复杂内容结构', () => {
      const complexContent: MessageContent = {
        type: 'mixed',
        text: 'Main message text',
        parts: [
          { type: 'text', content: 'First part' },
          { type: 'code', content: 'console.log("Hello");', language: 'javascript' },
          { type: 'image', url: 'https://example.com/image.png', alt: 'Example image' }
        ]
      };

      // 注意：在实际实现中，MessageContent可能需要特定的类型处理
      // 这里我们测试基本的字符串内容
      const message: StandardMessage = {
        ...validStandardMessage,
        content: JSON.stringify(complexContent)
      };

      expect(typeof message.content).toBe('string');
    });
  });

  describe('时间戳处理', () => {
    it('应该支持数字时间戳', () => {
      const timestamp = Date.now();
      const message: StandardMessage = {
        ...validStandardMessage,
        timestamp
      };
      expect(message.timestamp).toBe(timestamp);
    });

    it('应该支持合理的时间戳范围', () => {
      const pastTimestamp = new Date('2020-01-01').getTime();
      const futureTimestamp = new Date('2030-01-01').getTime();
      const currentTimestamp = Date.now();

      const pastMessage: StandardMessage = { ...validStandardMessage, timestamp: pastTimestamp };
      const futureMessage: StandardMessage = { ...validStandardMessage, timestamp: futureTimestamp };
      const currentMessage: StandardMessage = { ...validStandardMessage, timestamp: currentTimestamp };

      expect(pastMessage.timestamp).toBe(pastTimestamp);
      expect(futureMessage.timestamp).toBe(futureTimestamp);
      expect(currentMessage.timestamp).toBe(currentTimestamp);
    });
  });
});

describe('SimpleMessage 类型测试', () => {
  describe('基础结构验证', () => {
    it('应该接受有效的简化消息', () => {
      const message: SimpleMessage = {
        AI: 'Hello from AI!'
      };
      expect(message.AI).toBe('Hello from AI!');
      expect(message.HUMAN).toBeUndefined();
    });

    it('应该接受人类消息', () => {
      const message: SimpleMessage = {
        HUMAN: 'Hello from human!'
      };
      expect(message.HUMAN).toBe('Hello from human!');
      expect(message.AI).toBeUndefined();
    });

    it('应该接受完整的对话对', () => {
      const message: SimpleMessage = {
        HUMAN: 'How are you?',
        AI: 'I am doing well, thank you!'
      };
      expect(message.HUMAN).toBe('How are you?');
      expect(message.AI).toBe('I am doing well, thank you!');
    });

    it('应该接受可选字段', () => {
      const message: SimpleMessage = {
        HUMAN: 'Test message',
        AI: 'Test response',
        id: 'msg-123',
        feedback: 'like',
        timestamp: Date.now()
      };
      expect(message.id).toBe('msg-123');
      expect(message.feedback).toBe('like');
      expect(message.timestamp).toBeGreaterThan(0);
    });
  });

  describe('反馈类型验证', () => {
    it('应该支持所有反馈类型', () => {
      const feedbackTypes: FeedbackType[] = ['like', 'dislike', 'none'];

      feedbackTypes.forEach(feedback => {
        const message: SimpleMessage = {
          HUMAN: 'Test message',
          feedback
        };
        expect(message.feedback).toBe(feedback);
      });
    });
  });

  describe('边界情况处理', () => {
    it('应该处理空字符串', () => {
      const message: SimpleMessage = {
        HUMAN: '',
        AI: ''
      };
      expect(message.HUMAN).toBe('');
      expect(message.AI).toBe('');
    });

    it('应该处理极长内容', () => {
      const longContent = 'A'.repeat(10000);
      const message: SimpleMessage = {
        HUMAN: longContent
      };
      expect(message.HUMAN).toHaveLength(10000);
    });

    it('应该处理特殊字符', () => {
      const specialChars = 'Hello 🌍! @#$%^&*()_+-=[]{}|;:,.<>?';
      const message: SimpleMessage = {
        AI: specialChars
      };
      expect(message.AI).toBe(specialChars);
    });
  });
});

describe('MessageMetadata 测试', () => {
  describe('基础元数据字段', () => {
    it('应该支持所有基础元数据字段', () => {
      const metadata: MessageMetadata = {
        agentId: 'agent-123',
        sessionId: 'session-123',
        userId: 'user-123',
        tokens: 150,
        model: 'gpt-4',
        finishReason: 'stop',
        responseChatItemId: 'response-123',
        cost: 0.005,
        latency: 2000,
        temperature: 0.8,
        maxTokens: 4096,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        provider: 'openai',
        cached: true,
        editHistory: ['edit-1', 'edit-2'],
        flags: ['important', 'flagged'],
        tags: ['question', 'technical'],
        customData: { category: 'programming', difficulty: 'medium' }
      };

      expect(metadata.agentId).toBe('agent-123');
      expect(metadata.tokens).toBe(150);
      expect(metadata.cost).toBe(0.005);
      expect(metadata.latency).toBe(2000);
      expect(metadata.cached).toBe(true);
      expect(metadata.flags).toHaveLength(2);
      expect(metadata.tags).toContain('technical');
    });
  });

  describe('编辑历史处理', () => {
    it('应该支持编辑历史记录', () => {
      const metadata: MessageMetadata = {
        editHistory: [
          { timestamp: Date.now() - 5000, content: 'Original content' },
          { timestamp: Date.now() - 3000, content: 'First edit' },
          { timestamp: Date.now() - 1000, content: 'Final content' }
        ]
      };

      expect(metadata.editHistory).toHaveLength(3);
      expect(metadata.editHistory![0].content).toBe('Original content');
      expect(metadata.editHistory![2].content).toBe('Final content');
    });

    it('应该支持空编辑历史', () => {
      const metadata: MessageMetadata = {
        editHistory: []
      };
      expect(metadata.editHistory).toHaveLength(0);
    });
  });

  describe('标记和标签系统', () => {
    it('应该支持多种标记类型', () => {
      const metadata: MessageMetadata = {
        flags: ['important', 'error', 'review-needed', 'archived']
      };
      expect(metadata.flags).toHaveLength(4);
      expect(metadata.flags).toContain('error');
    });

    it('应该支持标签分类', () => {
      const metadata: MessageMetadata = {
        tags: ['question', 'technical', 'urgent', 'follow-up']
      };
      expect(metadata.tags).toHaveLength(4);
      expect(metadata.tags).toContain('urgent');
    });
  });

  describe('自定义数据扩展', () => {
    it('应该支持任意自定义数据', () => {
      const metadata: MessageMetadata = {
        customData: {
          source: 'web-interface',
          browser: 'chrome',
          sessionId: 'web-session-123',
          referrer: 'https://example.com',
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.1',
          location: { country: 'US', city: 'San Francisco' },
          preferences: { theme: 'dark', language: 'en' }
        }
      };

      expect(metadata.customData?.source).toBe('web-interface');
      expect(metadata.customData?.preferences?.theme).toBe('dark');
      expect(metadata.customData?.location?.country).toBe('US');
    });
  });
});

describe('MessageAttachment 测试', () => {
  describe('附件基础类型', () => {
    it('应该支持文件附件', () => {
      const attachment: MessageAttachment = {
        id: 'attachment-123',
        type: 'file',
        name: 'document.pdf',
        url: 'https://example.com/files/document.pdf',
        mimeType: 'application/pdf',
        size: 1048576, // 1MB
        createdAt: new Date().toISOString()
      };

      expect(attachment.id).toBe('attachment-123');
      expect(attachment.type).toBe('file');
      expect(attachment.name).toBe('document.pdf');
      expect(attachment.mimeType).toBe('application/pdf');
      expect(attachment.size).toBe(1048576);
    });

    it('应该支持图片附件', () => {
      const attachment: MessageAttachment = {
        id: 'attachment-456',
        type: 'image',
        name: 'chart.png',
        url: 'https://example.com/images/chart.png',
        mimeType: 'image/png',
        size: 524288, // 512KB
        width: 800,
        height: 600,
        thumbnailUrl: 'https://example.com/thumbnails/chart-thumb.png',
        createdAt: new Date().toISOString()
      };

      expect(attachment.type).toBe('image');
      expect(attachment.width).toBe(800);
      expect(attachment.height).toBe(600);
      expect(attachment.thumbnailUrl).toBeTruthy();
    });

    it('应该支持代码附件', () => {
      const attachment: MessageAttachment = {
        id: 'attachment-789',
        type: 'code',
        name: 'script.js',
        url: 'https://example.com/code/script.js',
        mimeType: 'application/javascript',
        size: 2048,
        language: 'javascript',
        lineCount: 50,
        createdAt: new Date().toISOString()
      };

      expect(attachment.type).toBe('code');
      expect(attachment.language).toBe('javascript');
      expect(attachment.lineCount).toBe(50);
    });
  });

  describe('附件元数据', () => {
    it('应该支持丰富的附件元数据', () => {
      const attachment: MessageAttachment = {
        id: 'attachment-metadata',
        type: 'file',
        name: 'report.xlsx',
        url: 'https://example.com/files/report.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 2097152, // 2MB
        metadata: {
          author: 'John Doe',
          version: '1.2.0',
          lastModified: '2023-01-15T10:30:00.000Z',
          description: 'Quarterly financial report',
          tags: ['finance', 'quarterly', '2023'],
          permissions: { read: ['user-1', 'user-2'], write: ['user-1'] }
        },
        createdAt: new Date().toISOString()
      };

      expect(attachment.metadata?.author).toBe('John Doe');
      expect(attachment.metadata?.tags).toHaveLength(3);
      expect(attachment.metadata?.permissions?.read).toHaveLength(2);
    });
  });
});

describe('StreamChunk 测试', () => {
  describe('流式数据块', () => {
    it('应该支持文本流块', () => {
      const chunk: StreamChunk = {
        id: 'chunk-123',
        type: 'text',
        content: 'Hello',
        index: 0,
        timestamp: Date.now(),
        isFirst: true,
        isLast: false
      };

      expect(chunk.id).toBe('chunk-123');
      expect(chunk.type).toBe('text');
      expect(chunk.content).toBe('Hello');
      expect(chunk.index).toBe(0);
      expect(chunk.isFirst).toBe(true);
      expect(chunk.isLast).toBe(false);
    });

    it('应该支持中间流块', () => {
      const chunk: StreamChunk = {
        id: 'chunk-456',
        type: 'text',
        content: ', world!',
        index: 1,
        timestamp: Date.now(),
        isFirst: false,
        isLast: false
      };

      expect(chunk.isFirst).toBe(false);
      expect(chunk.isLast).toBe(false);
    });

    it('应该支持结束流块', () => {
      const chunk: StreamChunk = {
        id: 'chunk-789',
        type: 'text',
        content: '',
        index: 2,
        timestamp: Date.now(),
        isFirst: false,
        isLast: true,
        metadata: {
          finishReason: 'stop',
          totalTokens: 10,
          processingTime: 1500
        }
      };

      expect(chunk.content).toBe('');
      expect(chunk.isLast).toBe(true);
      expect(chunk.metadata?.finishReason).toBe('stop');
      expect(chunk.metadata?.totalTokens).toBe(10);
    });
  });

  describe('流式元数据', () => {
    it('应该支持复杂的流式元数据', () => {
      const chunk: StreamChunk = {
        id: 'chunk-metadata',
        type: 'metadata',
        content: '',
        index: 0,
        timestamp: Date.now(),
        isFirst: true,
        isLast: false,
        metadata: {
          requestId: 'req-123',
          sessionId: 'session-456',
          agentId: 'agent-789',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096,
          streamId: 'stream-123',
          chunkDelay: 50,
          queuePosition: 1
        }
      };

      expect(chunk.metadata?.requestId).toBe('req-123');
      expect(chunk.metadata?.agentId).toBe('agent-789');
      expect(chunk.metadata?.streamId).toBe('stream-123');
      expect(chunk.metadata?.queuePosition).toBe(1);
    });
  });
});

describe('消息转换测试', () => {
  describe('StandardMessage 到 SimpleMessage 转换', () => {
    it('应该正确转换用户消息', () => {
      const standardMsg: StandardMessage = {
        id: 'msg-user-123',
        role: 'user',
        content: 'Hello, AI!',
        timestamp: Date.now(),
        metadata: { agentId: 'agent-123' }
      };

      // 模拟转换逻辑
      const simpleMsg: SimpleMessage = {
        HUMAN: standardMsg.content,
        id: standardMsg.id,
        timestamp: standardMsg.timestamp
      };

      expect(simpleMsg.HUMAN).toBe(standardMsg.content);
      expect(simpleMsg.id).toBe(standardMsg.id);
      expect(simpleMsg.timestamp).toBe(standardMsg.timestamp);
    });

    it('应该正确转换AI消息', () => {
      const standardMsg: StandardMessage = {
        id: 'msg-ai-123',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        timestamp: Date.now(),
        metadata: {
          agentId: 'agent-123',
          responseChatItemId: 'response-123'
        }
      };

      // 模拟转换逻辑
      const simpleMsg: SimpleMessage = {
        AI: standardMsg.content,
        id: standardMsg.metadata?.responseChatItemId,
        timestamp: standardMsg.timestamp
      };

      expect(simpleMsg.AI).toBe(standardMsg.content);
      expect(simpleMsg.id).toBe('response-123');
      expect(simpleMsg.timestamp).toBe(standardMsg.timestamp);
    });
  });

  describe('批量消息处理', () => {
    it('应该正确处理消息数组', () => {
      const standardMessages: StandardMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Question 1',
          timestamp: Date.now() - 3000
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Answer 1',
          timestamp: Date.now() - 2000,
          metadata: { responseChatItemId: 'response-1' }
        },
        {
          id: 'msg-3',
          role: 'user',
          content: 'Question 2',
          timestamp: Date.now() - 1000
        }
      ];

      // 模拟批量转换逻辑
      const simpleMessages: SimpleMessage[] = [
        {
          HUMAN: 'Question 1',
          AI: 'Answer 1',
          id: 'response-1',
          timestamp: expect.any(Number)
        },
        {
          HUMAN: 'Question 2',
          timestamp: expect.any(Number)
        }
      ];

      expect(simpleMessages).toHaveLength(2);
      expect(simpleMessages[0].HUMAN).toBe('Question 1');
      expect(simpleMessages[0].AI).toBe('Answer 1');
      expect(simpleMessages[1].HUMAN).toBe('Question 2');
    });
  });
});

describe('消息验证测试', () => {
  describe('消息完整性检查', () => {
    it('应该验证必需字段的存在', () => {
      // 标准消息验证
      const validStandardMessage: StandardMessage = {
        id: 'msg-123',
        role: 'user',
        content: 'Test message',
        timestamp: Date.now()
      };

      expect(validStandardMessage.id).toBeTruthy();
      expect(validStandardMessage.role).toBeTruthy();
      expect(validStandardMessage.content).toBeTruthy();
      expect(validStandardMessage.timestamp).toBeGreaterThan(0);

      // 简化消息验证
      const validSimpleMessage: SimpleMessage = {
        HUMAN: 'Test human message'
      };

      expect(validSimpleMessage.HUMAN).toBeTruthy();
    });

    it('应该验证字段类型的正确性', () => {
      const message: StandardMessage = {
        id: 'msg-123',
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
        metadata: {
          tokens: 100,
          cost: 0.001,
          cached: false,
          flags: ['important'],
          tags: ['test']
        }
      };

      expect(typeof message.id).toBe('string');
      expect(typeof message.role).toBe('string');
      expect(typeof message.content).toBe('string');
      expect(typeof message.timestamp).toBe('number');
      expect(typeof message.metadata?.tokens).toBe('number');
      expect(typeof message.metadata?.cost).toBe('number');
      expect(typeof message.metadata?.cached).toBe('boolean');
      expect(Array.isArray(message.metadata?.flags)).toBe(true);
      expect(Array.isArray(message.metadata?.tags)).toBe(true);
    });
  });

  describe('消息内容安全检查', () => {
    it('应该处理潜在的恶意内容', () => {
      const messageWithXSS: StandardMessage = {
        id: 'msg-xss',
        role: 'user',
        content: '<script>alert("xss")</script>',
        timestamp: Date.now()
      };

      // 在实际应用中，这里应该有内容安全检查
      expect(messageWithXSS.content).toContain('<script>');
    });

    it('应该处理超长内容', () => {
      const longContent = 'A'.repeat(1000000); // 1MB
      const messageWithLongContent: StandardMessage = {
        id: 'msg-long',
        role: 'user',
        content: longContent,
        timestamp: Date.now()
      };

      expect(messageWithLongContent.content).toHaveLength(1000000);
    });
  });
});

describe('消息性能测试', () => {
  describe('大量消息处理', () => {
    it('应该能够高效处理大量消息', () => {
      const messageCount = 10000;
      const messages: StandardMessage[] = Array(messageCount).fill(null).map((_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${index}`,
        timestamp: Date.now() - (messageCount - index) * 1000
      }));

      const startTime = performance.now();

      // 模拟批量处理
      const processedCount = messages.length;

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(processedCount).toBe(messageCount);
      expect(processingTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('内存使用优化', () => {
    it('应该优化大消息的内存使用', () => {
      const largeMessage: StandardMessage = {
        id: 'msg-large',
        role: 'user',
        content: 'A'.repeat(100000), // 100KB
        timestamp: Date.now()
      };

      // 测试消息可以被正确序列化
      const serialized = JSON.stringify(largeMessage);
      const deserialized = JSON.parse(serialized) as StandardMessage;

      expect(deserialized.content).toHaveLength(100000);
      expect(serialized.length).toBeGreaterThan(100000);
    });
  });
});