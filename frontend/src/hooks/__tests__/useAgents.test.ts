/**
 * useAgents Hook错误处理测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgents } from '../useAgents';
import { logger } from '@/lib/logger';
import { enhancedLogger } from '@/lib/enhancedLogger';

// Mock依赖
vi.mock('@/lib/logger', () => {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  
  return {
    logger: mockLogger,
  };
});

vi.mock('@/lib/enhancedLogger', () => {
  const mockEnhancedLogger = {
    userAction: vi.fn(),
    serviceCall: vi.fn(),
    stateUpdate: vi.fn(),
    hookExecution: vi.fn(),
    error: vi.fn(),
    startTimer: vi.fn().mockReturnValue(123456),
    endTimer: vi.fn(),
  };
  
  return {
    enhancedLogger: mockEnhancedLogger,
  };
});

vi.mock('@/services/api', () => {
  return {
    agentService: {
      getAgents: vi.fn(),
    },
  };
});

vi.mock('@/store/agentStore', () => {
  return {
    useAgentStore: () => ({
      setAgents: vi.fn(),
      setAgentsLoading: vi.fn(),
      setAgentsError: vi.fn(),
      setCurrentAgent: vi.fn(),
      currentAgent: null,
    }),
  };
});

vi.mock('@/i18n', () => {
  return {
    useI18n: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          '获取智能体列表失败': 'Failed to fetch agents',
        };
        return translations[key] || key;
      },
    }),
  };
});

vi.mock('@/constants/agents', () => {
  return {
    PRODUCT_PREVIEW_AGENT: { id: 'product-preview', name: 'Product Preview' },
    PRODUCT_PREVIEW_AGENT_ID: 'product-preview',
    VOICE_CALL_AGENT: { id: 'voice-call', name: 'Voice Call' },
    VOICE_CALL_AGENT_ID: 'voice-call',
  };
});

describe('useAgents', () => {
  beforeEach(() => {
    // 清空所有mock调用
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复所有mock
    vi.restoreAllMocks();
  });

  describe('fetchAgents', () => {
    it('应该在获取智能体列表时记录用户行为', async () => {
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        await result.current.fetchAgents();
      });
      
      expect(enhancedLogger.userAction).toHaveBeenCalledWith('fetchAgents');
    });

    it('应该在调用服务时记录服务调用', async () => {
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        await result.current.fetchAgents();
      });
      
      expect(enhancedLogger.serviceCall).toHaveBeenCalledWith(
        'agentService',
        'getAgents'
      );
    });

    it('应该在获取智能体成功时记录性能日志', async () => {
      // 模拟成功响应
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1', status: 'active' },
        { id: 'agent-2', name: 'Agent 2', status: 'inactive' },
      ];
      
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        await result.current.fetchAgents();
      });
      
      expect(enhancedLogger.startTimer).toHaveBeenCalledWith('getAgents');
      expect(enhancedLogger.endTimer).toHaveBeenCalledWith(
        'getAgents',
        123456,
        'Get Agents'
      );
    });

    it('应该在设置智能体时记录状态更新', async () => {
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        await result.current.fetchAgents();
      });
      
      expect(enhancedLogger.stateUpdate).toHaveBeenCalledWith(
        'agentStore',
        'setAgents',
        expect.objectContaining({
          agentCount: expect.any(Number),
        })
      );
    });

    it('应该在设置当前智能体时记录状态更新', async () => {
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        await result.current.fetchAgents();
      });
      
      // 验证是否调用了状态更新
      expect(enhancedLogger.stateUpdate).toHaveBeenCalled();
    });

    it('应该在获取智能体失败时记录错误日志', async () => {
      const error = new Error('网络错误');
      
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        try {
          await result.current.fetchAgents();
        } catch (err) {
          // 忽略错误
        }
      });
      
      expect(enhancedLogger.error).toHaveBeenCalledWith(
        'Failed to fetch agents',
        error
      );
    });

    it('应该在取消操作时记录信息日志', async () => {
      const abortError = new Error('操作已取消');
      abortError.name = 'AbortError';
      
      const { result } = renderHook(() => useAgents());
      
      await act(async () => {
        try {
          await result.current.fetchAgents();
        } catch (err) {
          // 忽略错误
        }
      });
      
      expect(enhancedLogger.info).toHaveBeenCalledWith('Agent fetch cancelled');
    });
  });

  describe('Hook初始化', () => {
    it('应该在Hook初始化时记录执行日志', () => {
      renderHook(() => useAgents());
      
      expect(enhancedLogger.hookExecution).toHaveBeenCalledWith(
        'useAgents',
        'init'
      );
    });
  });
});