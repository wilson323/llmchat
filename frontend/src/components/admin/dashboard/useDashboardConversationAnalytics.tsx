import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import { getConversationSeries, getAgentComparison } from '@/services/analyticsApi';
import { listAgents } from '@/services/agentsApi';
import type { ConversationSeriesDataset, AgentComparisonDataset, AgentItem } from './types';
import { getDefaultConversationFilters } from './getDefaultConversationFilters';

// 类型定义
interface ConversationAnalyticsFilters {
  startDate: string;
  endDate: string;
  agentId: string;
}

interface DashboardConversationAnalytics {
  filters: ConversationAnalyticsFilters;
  setDateFilter: (key: 'startDate' | 'endDate', value: string) => void;
  setAgentId: (agentId: string) => void;
  refresh: () => Promise<void>;
  series: ConversationSeriesDataset | null;
  seriesLoading: boolean;
  seriesError: string | null;
  comparison: AgentComparisonDataset | null;
  comparisonLoading: boolean;
  comparisonError: string | null;
  agents: AgentItem[];
  agentsLoading: boolean;
  agentsError: string | null;
}
import { toIsoRangeFromInput } from './toIsoRangeFromInput';
import dateInputToMs from './dateInputToMs';

function useDashboardConversationAnalytics(): DashboardConversationAnalytics {
  const { t } = useI18n();
  const [filters, setFilters] = useState(getDefaultConversationFilters());
  const [series, setSeries] = useState<ConversationSeriesDataset | null>(null);
  const [seriesLoading, setSeriesLoading] = useState<boolean>(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AgentComparisonDataset | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState<boolean>(false);
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
          message = String(err.response.data?.message) || message;
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
          message = String(err.response.data?.message) || message;
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

  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    void (async () => {
      try {
        const list = await listAgents({ includeInactive: true });
        if (cancelled) {
          return;
        }
        setAgents(list);
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        let message = t('获取智能体列表失败');
        if (err && typeof err === 'object') {
          if ('message' in err) {
            message = String(err.message);
          }
        } else if (typeof err === 'string') {
          message = err;
        }
        toast({ type: 'error', title: message });
      } finally {
        if (!cancelled) {
          setAgentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    void fetchComparison();
  }, [fetchComparison]);

  const setDateFilter = useCallback((key: 'startDate' | 'endDate', value: string) => {
    if (!value) {
      return;
    }
    setFilters((prev: any) => {
      const next: ConversationAnalyticsFilters = { ...prev, [key]: value } as ConversationAnalyticsFilters;
      const startMs = dateInputToMs(next.startDate);
      const endMs = dateInputToMs(next.endDate);
      if (startMs > endMs) {
        if (key === 'startDate') {
          next.endDate = next.startDate;
        } else {
          next.startDate = next.endDate;
        }
      }
      return next;
    });
  }, []);

  const setAgentId = useCallback((agentId: string) => {
    setFilters((prev: any) => ({ ...prev, agentId }));
  }, []);

  const refresh = useCallback((): Promise<void> => {
    return Promise.all([fetchSeries(), fetchComparison()]).then(() => {});
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
}

export default useDashboardConversationAnalytics;