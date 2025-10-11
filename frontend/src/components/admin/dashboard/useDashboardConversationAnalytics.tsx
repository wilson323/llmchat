import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import { getConversationSeries, getAgentComparison } from '@/services/analyticsApi';
import { listAgents } from '@/services/agentsApi';
import type { ConversationSeriesDataset, AgentComparisonDataset, AgentItem } from './types';
import { getDefaultConversationFilters } from './getDefaultConversationFilters';
import { formatDateInputValue } from './formatDateInputValue';
import { toIsoRangeFromInput } from './toIsoRangeFromInput';
import dateInputToMs from './dateInputToMs';

function useDashboardConversationAnalytics(): DashboardConversationAnalytics {
  const { t } = useI18n();
  const [filters, setFilters] = useState<ConversationAnalyticsFilters>(getDefaultConversationFilters);
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
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('获取对话趋势失败');
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
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('获取智能体对比失败');
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
      } catch (err: any) {
        if (cancelled) {
          return;
        }
        const message = err?.message || t('获取智能体列表失败');
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
    setFilters((prev) => {
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
    setFilters((prev) => ({ ...prev, agentId }));
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchSeries(), fetchComparison()]);
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