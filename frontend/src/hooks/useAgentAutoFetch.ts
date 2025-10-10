import { useState } from 'react';
import { fetchAgentInfo as fetchAgentInfoApi, type FetchAgentInfoParams, type AgentInfo } from '@/services/agentsApi';

export function useAgentAutoFetch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentInfo = async (params: FetchAgentInfoParams): Promise<AgentInfo | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchAgentInfoApi(params);

      if (response.data) {
        return response.data;
      }

      throw new Error('获取智能体信息失败');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取智能体信息失败';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchAgentInfo,
    loading,
    error,
  };
}
