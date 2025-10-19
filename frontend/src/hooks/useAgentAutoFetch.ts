import { useState } from 'react';
// 修复导入错误，使用正确的类型
import { fetchAgentInfo as fetchAgentInfoApi, type AgentInfo } from '@/services/agentsApi';

// 定义FetchAgentInfoParams类型
interface FetchAgentInfoParams {
  provider: 'fastgpt' | 'dify';
  endpoint: string;
  apiKey: string;
  appId?: string;
}

export function useAgentAutoFetch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentInfo = async (params: FetchAgentInfoParams): Promise<AgentInfo | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchAgentInfoApi(params);

      // 修复属性访问错误
      if ('data' in response && response.data) {
        return response.data;
      }

      throw new Error('获取智能体信息失败');
    } catch (err) {
      const errorMessage: string = err instanceof Error ? err.message : '获取智能体信息失败';
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
