/**
 * AgentService 单元测试
 * 
 * 测试范围：
 * - 智能体同步
 * - 配置验证
 * - 配置加载
 * - 状态检查
 * 
 * 覆盖率目标：≥90%
 */

import { AgentService } from '@/services/AgentService';
import { createMockFastGPTClient } from '../../mocks/fastgpt.mock';
import { createMockRedisClient } from '../../mocks/redis.mock';

jest.mock('@/clients/FastGPTClient');
jest.mock('ioredis');

describe('AgentService', () => {
  let agentService: AgentService;
  let mockFastGPT: any;
  let mockRedis: any;
  
  beforeEach(() => {
    mockFastGPT = createMockFastGPTClient();
    mockRedis = createMockRedisClient();
    
    agentService = new AgentService();
    (agentService as any).fastgptClient = mockFastGPT;
    (agentService as any).redis = mockRedis;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('syncAgents', () => {
    it('should sync agents from FastGPT', async () => {
      // Arrange
      const mockAgents = [
        { id: 'agent-1', name: '助手1', status: 'active' },
        { id: 'agent-2', name: '助手2', status: 'active' }
      ];
      
      mockFastGPT.getAgentList = jest.fn().mockResolvedValue(mockAgents);
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      // Act
      const result = await agentService.syncAgents();
      
      // Assert
      expect(result.synced).toBe(2);
      expect(mockFastGPT.getAgentList).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });
    
    it('should update local cache', async () => {
      // Arrange
      const agents = [{ id: 'agent-1', name: '助手1' }];
      mockFastGPT.getAgentList = jest.fn().mockResolvedValue(agents);
      mockRedis.set = jest.fn().mockResolvedValue('OK');
      
      // Act
      await agentService.syncAgents();
      
      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        'agents:list',
        JSON.stringify(agents),
        'EX',
        expect.any(Number)
      );
    });
    
    it('should handle FastGPT API errors', async () => {
      // Arrange
      mockFastGPT.getAgentList = jest.fn().mockRejectedValue(
        new Error('FastGPT API error')
      );
      
      // Act & Assert
      await expect(agentService.syncAgents()).rejects.toThrow('FastGPT API error');
    });
  });
  
  describe('validateConfig', () => {
    it('should validate required fields', () => {
      // Arrange
      const validConfig = {
        id: 'agent-123',
        name: '助手',
        endpoint: 'http://example.com',
        apiKey: 'key-123',
        model: 'FastAI-4k'
      };
      
      // Act & Assert
      expect(() => agentService.validateConfig(validConfig)).not.toThrow();
    });
    
    it('should reject missing required fields', () => {
      // Arrange
      const invalidConfig = {
        id: 'agent-123',
        name: '助手'
        // 缺少endpoint, apiKey, model
      };
      
      // Act & Assert
      expect(() => agentService.validateConfig(invalidConfig as any))
        .toThrow('Missing required fields');
    });
    
    it('should validate endpoint format', () => {
      // Arrange
      const invalidConfig = {
        id: 'agent-123',
        name: '助手',
        endpoint: 'not-a-url',
        apiKey: 'key-123',
        model: 'FastAI-4k'
      };
      
      // Act & Assert
      expect(() => agentService.validateConfig(invalidConfig))
        .toThrow('Invalid endpoint URL');
    });
    
    it('should validate temperature range', () => {
      // Arrange
      const invalidConfig = {
        id: 'agent-123',
        name: '助手',
        endpoint: 'http://example.com',
        apiKey: 'key-123',
        model: 'FastAI-4k',
        temperature: 3.0 // 无效（应该0-2）
      };
      
      // Act & Assert
      expect(() => agentService.validateConfig(invalidConfig))
        .toThrow('Temperature must be between 0 and 2');
    });
  });
  
  describe('checkStatus', () => {
    it('should check agent availability', async () => {
      // Arrange
      const agentId = 'agent-123';
      mockFastGPT.chat = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'OK' } }]
      });
      
      // Act
      const result = await agentService.checkStatus(agentId);
      
      // Assert
      expect(result.available).toBe(true);
      expect(result).toHaveProperty('responseTime');
      expect(result.responseTime).toBeGreaterThan(0);
    });
    
    it('should detect unavailable agents', async () => {
      // Arrange
      mockFastGPT.chat = jest.fn().mockRejectedValue(
        new Error('Connection timeout')
      );
      
      // Act
      const result = await agentService.checkStatus('agent-123');
      
      // Assert
      expect(result.available).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });
});

