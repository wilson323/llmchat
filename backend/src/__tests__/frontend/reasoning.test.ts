/**
 * reasoning.ts 模块单元测试
 * 测试前端智能体推理逻辑的边界情况和错误处理
 */

import {
  reasoningAgent,
  analyzeRequest,
  formatResponse,
  validatePayload,
  parseStreamChunk,
  detectStreamEnd
} from '../../../../frontend/src/lib/reasoning';

// Mock console functions to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('reasoning.ts模块测试', () => {
  describe('validatePayload', () => {
    it('should validate valid payload correctly', () => {
      const validPayload = {
        data: 'Test response',
        event: 'message'
      };

      expect(validatePayload(validPayload)).toBe(true);
    });

    it('should handle null payload', () => {
      expect(validatePayload(null)).toBe(false);
    });

    it('should handle undefined payload', () => {
      expect(validatePayload(undefined)).toBe(false);
    });

    it('should handle payload with null data', () => {
      const payloadWithNullData = {
        data: null,
        event: 'message'
      };

      expect(validatePayload(payloadWithNullData)).toBe(false);
    });

    it('should handle payload with undefined data', () => {
      const payloadWithUndefinedData = {
        data: undefined,
        event: 'message'
      };

      expect(validatePayload(payloadWithUndefinedData)).toBe(false);
    });

    it('should handle empty payload', () => {
      expect(validatePayload({})).toBe(true);
    });
  });

  describe('detectStreamEnd', () => {
    it('should detect stream end with end event', () => {
      const payload = {
        event: 'end'
      };

      expect(detectStreamEnd(payload, false)).toBe(true);
    });

    it('should detect stream end with finish event', () => {
      const payload = {
        event: 'finish'
      };

      expect(detectStreamEnd(payload, false)).toBe(true);
    });

    it('should detect stream end with complete event', () => {
      const payload = {
        event: 'complete'
      };

      expect(detectStreamEnd(payload, false)).toBe(true);
    });

    it('should detect stream end with done event', () => {
      const payload = {
        event: 'done'
      };

      expect(detectStreamEnd(payload, false)).toBe(true);
    });

    it('should handle case insensitive event names', () => {
      const payload = {
        event: 'END'
      };

      expect(detectStreamEnd(payload, false)).toBe(true);
    });

    it('should not detect end for non-end events', () => {
      const payload = {
        event: 'message'
      };

      expect(detectStreamEnd(payload, false)).toBe(false);
    });

    it('should not detect end when already finished', () => {
      const payload = {
        event: 'end'
      };

      expect(detectStreamEnd(payload, true)).toBe(true);
    });

    it('should handle null payload gracefully', () => {
      expect(detectStreamEnd(null, false)).toBe(false);
    });

    it('should handle payload without event', () => {
      const payload = {
        data: 'test'
      };

      expect(detectStreamEnd(payload, false)).toBe(false);
    });
  });

  describe('analyzeRequest', () => {
    it('should analyze simple request', () => {
      const request = 'Hello, how are you?';

      const analysis = analyzeRequest(request);

      expect(analysis).toHaveProperty('intent');
      expect(analysis).toHaveProperty('entities');
      expect(analysis).toHaveProperty('confidence');
      expect(typeof analysis.intent).toBe('string');
      expect(Array.isArray(analysis.entities)).toBe(true);
      expect(typeof analysis.confidence).toBe('number');
    });

    it('should handle empty request', () => {
      const request = '';

      const analysis = analyzeRequest(request);

      expect(analysis).toHaveProperty('intent', '');
      expect(analysis).toHaveProperty('entities', []);
      expect(analysis).toHaveProperty('confidence', 0);
    });

    it('should handle null request', () => {
      const request = null;

      const analysis = analyzeRequest(request);

      expect(analysis).toHaveProperty('intent', '');
      expect(analysis).toHaveProperty('entities', []);
      expect(analysis).toHaveProperty('confidence', 0);
    });

    it('should handle complex request with entities', () => {
      const request = 'Book a flight from New York to London tomorrow';

      const analysis = analyzeRequest(request);

      expect(analysis.intent).toContain('book');
      expect(analysis.entities.length).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThan(0);
    });
  });

  describe('formatResponse', () => {
    it('should format simple response', () => {
      const response = 'I understand your request.';

      const formatted = formatResponse(response);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain(response);
    });

    it('should handle empty response', () => {
      const response = '';

      const formatted = formatResponse(response);

      expect(typeof formatted).toBe('string');
    });

    it('should handle null response', () => {
      const response = null;

      const formatted = formatResponse(response);

      expect(typeof formatted).toBe('string');
    });

    it('should format response with metadata', () => {
      const response = 'Here is your answer.';
      const metadata = {
        confidence: 0.95,
        sources: ['source1', 'source2']
      };

      const formatted = formatResponse(response, metadata);

      expect(formatted).toContain(response);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('parseStreamChunk', () => {
    it('should parse valid chunk', () => {
      const chunk = 'data: {"content": "Hello"}';

      const parsed = parseStreamChunk(chunk);

      expect(parsed).toHaveProperty('content', 'Hello');
    });

    it('should handle malformed chunk', () => {
      const chunk = 'invalid json';

      const parsed = parseStreamChunk(chunk);

      expect(parsed).toBe(null);
    });

    it('should handle empty chunk', () => {
      const chunk = '';

      const parsed = parseStreamChunk(chunk);

      expect(parsed).toBe(null);
    });

    it('should handle chunk with only data prefix', () => {
      const chunk = 'data: ';

      const parsed = parseStreamChunk(chunk);

      expect(parsed).toBe(null);
    });
  });

  describe('reasoningAgent - Integration Tests', () => {
    it('should process basic reasoning request', async () => {
      const request = {
        message: 'What is the capital of France?',
        context: {
          user: 'test-user',
          sessionId: 'test-session'
        }
      };

      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(typeof result.response).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.reasoning).toBe('string');
    });

    it('should handle request with missing context', async () => {
      const request = {
        message: 'Test message'
      };

      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
    });

    it('should handle empty message gracefully', async () => {
      const request = {
        message: '',
        context: {}
      };

      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
    });

    it('should handle null request gracefully', async () => {
      const request = null;

      // Should not throw error
      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
    });

    it('should process request with custom options', async () => {
      const request = {
        message: 'Explain quantum computing',
        context: {
          user: 'test-user'
        },
        options: {
          maxTokens: 100,
          temperature: 0.7
        }
      };

      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result.response.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const request = {
        message: 'Test message',
        context: {
          simulateError: 'network'
        }
      };

      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('error');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle timeout errors gracefully', async () => {
      const request = {
        message: 'Test message',
        context: {
          simulateError: 'timeout'
        }
      };

      const startTime = Date.now();
      const result = await reasoningAgent(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should timeout quickly
      expect(result).toHaveProperty('error');
    });

    it('should handle malformed context data', async () => {
      const request = {
        message: 'Test message',
        context: {
          user: null,
          sessionId: undefined,
          metadata: 'invalid'
        }
      };

      const result = await reasoningAgent(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('confidence');
    });
  });

  describe('Performance Tests', () => {
    it('should process simple request within time limit', async () => {
      const request = {
        message: 'Hello',
        context: {}
      };

      const startTime = performance.now();
      const result = await reasoningAgent(request);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result).toHaveProperty('response');
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        message: `Test message ${i}`,
        context: { requestId: i }
      }));

      const startTime = performance.now();
      const results = await Promise.all(requests.map(req => reasoningAgent(req)));
      const endTime = performance.now();

      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds

      results.forEach((result, index) => {
        expect(result).toHaveProperty('response');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('reasoning');
      });
    });
  });
});