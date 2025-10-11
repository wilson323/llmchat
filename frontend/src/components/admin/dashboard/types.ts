/**
 * Dashboard 相关类型定义
 */

import type { ConversationSeriesDataset, AgentComparisonDataset } from '@/services/analyticsApi';
import type { AgentItem } from '@/services/agentsApi';

export type ConversationAnalyticsFilters = {
  startDate: string;
  endDate: string;
  agentId: string;
};

export type DashboardConversationAnalytics = {
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
};