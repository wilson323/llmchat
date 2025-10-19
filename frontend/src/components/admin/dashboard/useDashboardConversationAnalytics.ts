/**
 * Dashboard 会话分析 Hook
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import { getConversationSeries, getAgentComparison } from '@/services/analyticsApi';
import { listAgents } from '@/services/agentsApi';
import type {
  ConversationAnalyticsFilters,
  DashboardConversationAnalytics,
  ConversationSeriesDataset,
  AgentComparisonDataset,
} from '@/types';
// 从agentsApi导入AgentItem类型而不是从types导入
import type { AgentItem } from '@/services/agentsApi';

// 工具函数
const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoRangeFromInput = (dateInput: string, isEnd: boolean): string => {
  const d = new Date(dateInput);
  if (isEnd) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
};

const getDefaultConversationFilters = (): ConversationAnalyticsFilters => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: formatDateInputValue(startOfMonth),
    endDate: formatDateInputValue(now),
    agentId: 'all',
  };
};

export const useDashboardConversationAnalytics = (): DashboardConversationAnalytics => {
  const { t } = useI18n();
  const [filters, setFilters] = useState(getDefaultConversationFilters());
  const [series, setSeries] = useState<ConversationSeriesDataset | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AgentComparisonDataset | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const normalizedRange = useMemo(() => {
    return {
      startIso: toIsoRangeFromInput(filters.startDate, false),
      endIso: toIsoRangeFromInput(filters.endDate, true),
      agentId: filters.agentId === 'all' ? null : filters.agentId,
    };
  }, [filters]);

  const fetchSeries = useCallback(async () => {
    try {
      setSeriesLoading(true);
      setSeriesError(null);
      const data = await getConversationSeries({
        start: normalizedRange.startIso,
        end: normalizedRange.endIso,
        agentId: normalizedRange.agentId,
      });
      setSeries(data);
    } catch (err: unknown) {
      let message = t('获取对话趋势失败');
      if (err && typeof err === 'object') {
        if ('response' in err && err.response && typeof err.response === 'object' && 'data' in err.response) {
          const responseData = err.response.data as { message?: string };
          message = String(responseData?.message) || message;
        } else if ('message' in err) {
          message = String(err.message);
        }
      } else if (typeof err === 'string') {
        message = err;
      }
      setSeriesError(message);
      toast({ type: 'error', title: message });
    } finally {
      setSeriesLoading(false);
    }
  }, [normalizedRange.startIso, normalizedRange.endIso, normalizedRange.agentId, t]);

  const fetchComparison = useCallback(async () => {
    try {
      setComparisonLoading(true);
      setComparisonError(null);
      const data = await getAgentComparison({
        start: normalizedRange.startIso,
        end: normalizedRange.endIso,
      });
      setComparison(data);
    } catch (err: unknown) {
      let message = t('获取智能体对比失败');
      if (err && typeof err === 'object') {
        if ('response' in err && err.response && typeof err.response === 'object' && 'data' in err.response) {
          const responseData = err.response.data as { message?: string };
          message = String(responseData?.message) || message;
        } else if ('message' in err) {
          message = String(err.message);
        }
      } else if (typeof err === 'string') {
        message = err;
      }
      setComparisonError(message);
      toast({ type: 'error', title: message });
    } finally {
      setComparisonLoading(false);
    }
  }, [normalizedRange.startIso, normalizedRange.endIso, t]);

  const fetchAgents = useCallback(async () => {
    try {
      setAgentsLoading(true);
      setAgentsError(null);
      const data = await listAgents({ includeInactive: true });
      setAgents(data);
    } catch (err: unknown) {
      let message = t('获取智能体列表失败');
      if (err && typeof err === 'object') {
        if ('response' in err && err.response && typeof err.response === 'object' && 'data' in err.response) {
          const responseData = err.response.data as { message?: string };
          message = String(responseData?.message) || message;
        } else if ('message' in err) {
          message = String(err.message);
        }
      } else if (typeof err === 'string') {
        message = err;
      }
      setAgentsError(message);
      toast({ type: 'error', title: message });
    } finally {
      setAgentsLoading(false);
    }
  }, [t]);

  const setDateFilter = useCallback((key: 'startDate' | 'endDate', value: string) => {
    setFilters((prev: ConversationAnalyticsFilters) => ({ ...prev, [key]: value }));
  }, []);

  const setAgentId = useCallback((agentId: string) => {
    setFilters((prev: ConversationAnalyticsFilters) => ({ ...prev, agentId }));
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchSeries(), fetchComparison(), fetchAgents()]);
  }, [fetchSeries, fetchComparison, fetchAgents]);

  // 初始数据加载
  useEffect(() => {
    void fetchSeries();
    void fetchComparison();
    void fetchAgents();
  }, []);

  // 当筛选条件变化时重新获取数据
  useEffect(() => {
    void fetchSeries();
    void fetchComparison();
  }, [fetchSeries, fetchComparison]);

  return {
    filters,
    setDateFilter,
    setAgentId,
    refresh,
    series,
    seriesLoading,
    seriesError,
    comparison,
    comparisonLoading,
    comparisonError,
    agents,
    agentsLoading,
    agentsError,
  };
};
