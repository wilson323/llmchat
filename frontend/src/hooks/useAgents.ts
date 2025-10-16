import { useState, useCallback, useRef } from 'react';
import { agentService } from '@/services/api';
import { useAgentStore } from '@/store/agentStore';

import { useI18n } from '@/i18n';
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

  const {
    setAgents,
    setAgentsLoading,
    setAgentsError,
    setCurrentAgent,
    currentAgent,
  } = useAgentStore();

  const fetchAgents = useCallback(async () => {
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
        const fetchedAgents = await agentService.getAgents();

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

        if (!currentAgent && agents.length > 0) {
          const firstActive = agents.find(agent => agent.status === 'active') || agents[0];
          if (firstActive) {
            setCurrentAgent(firstActive);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

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
