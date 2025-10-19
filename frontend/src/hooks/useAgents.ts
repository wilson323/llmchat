import { useState, useCallback, useRef } from 'react';
import { agentService } from '@/services/api';
import { useAgentStore } from '@/store/agentStore';

import { useI18n } from '@/i18n';
import { useErrorHandler } from './useErrorHandler';
import { enhancedLogger } from '@/lib/enhancedLogger';
import {
  PRODUCT_PREVIEW_AGENT,
  PRODUCT_PREVIEW_AGENT_ID,
  VOICE_CALL_AGENT,
  VOICE_CALL_AGENT_ID,
} from '@/constants/agents';

export const useAgents = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ongoingRequestRef = useRef<Promise<void> | null>(null);
  const { t } = useI18n();
  const { handleAsyncError } = useErrorHandler();
  
  // 记录Hook初始化
  enhancedLogger.hookExecution('useAgents', 'init');

  const {
    setAgents,
    setAgentsLoading,
    setAgentsError,
    setCurrentAgent,
    currentAgent,
  } = useAgentStore();

  const fetchAgents = useCallback(async () => {
    // 记录获取智能体列表操作
    enhancedLogger.userAction('fetchAgents');
    
    if (ongoingRequestRef.current) {
      return ongoingRequestRef.current;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setAgentsLoading(true);
    setError(null);
    setAgentsError(null);

    const request = (async () => {
      try {
        // 记录服务调用开始
        enhancedLogger.serviceCall('agentService', 'getAgents');
        
        const startTime = enhancedLogger.startTimer('getAgents');
        const fetchedAgents = await agentService.getAgents();
        enhancedLogger.endTimer('getAgents', startTime, 'Get Agents');

        const hasProductPreview = fetchedAgents.some((agent) => agent.id === PRODUCT_PREVIEW_AGENT_ID);
        const hasVoiceCall = fetchedAgents.some((agent) => agent.id === VOICE_CALL_AGENT_ID);
        const agents = [
          ...fetchedAgents,
          ...(hasProductPreview ? [] : [PRODUCT_PREVIEW_AGENT]),
          ...(hasVoiceCall ? [] : [VOICE_CALL_AGENT]),
        ];

        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        setAgents(agents);
        
        // 记录状态更新
        enhancedLogger.stateUpdate('agentStore', 'setAgents', {
          agentCount: agents.length,
        });

        if (!currentAgent && agents.length > 0) {
          const firstActive = agents.find(agent => agent.status === 'active') || agents[0];
          if (firstActive) {
            setCurrentAgent(firstActive);
            
            // 记录状态更新
            enhancedLogger.stateUpdate('agentStore', 'setCurrentAgent', {
              agentId: firstActive.id,
            });
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          enhancedLogger.info('Agent fetch cancelled');
          return;
        }

        handleAsyncError(err);
        
        // 记录错误
        enhancedLogger.error('Failed to fetch agents', err as Error);
        
        const errorMessage = err instanceof Error ? err.message : t('获取智能体列表失败');
        setError(errorMessage);
        setAgentsError(errorMessage);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setLoading(false);
        setAgentsLoading(false);
      }
    })();

    ongoingRequestRef.current = request;
    request.finally(() => {
      if (ongoingRequestRef.current === request) {
        ongoingRequestRef.current = null;
      }
    }).catch(() => undefined);

    return request;
  }, [currentAgent, setAgents, setAgentsLoading, setAgentsError, setCurrentAgent, t]);

  return {
    loading,
    error,
    fetchAgents,
  };
};
