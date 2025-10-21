import { api } from './api';

export interface ProvinceHeatmapPoint {
  province: string;
  count: number;
}

export interface ProvinceHeatmapSummary {
  overseas: number;
  local: number;
  unknown: number;
}

export interface ProvinceHeatmapDataset {
  start: string;
  end: string;
  agentId: string | null;
  total: number;
  points: ProvinceHeatmapPoint[];
  summary: ProvinceHeatmapSummary;
  generatedAt: string;
}

export interface ProvinceHeatmapParams {
  start: string;
  end: string;
  agentId?: string | null;
}

export interface ConversationSeriesBucket {
  date: string;
  total: number;
  byAgent: Array<{ agentId: string; count: number }>;
}

export interface ConversationSeriesAgentTotal {
  agentId: string;
  name: string;
  isActive: boolean;
  count: number;
}

export interface ConversationSeriesDataset {
  start: string;
  end: string;
  agentId: string | null;
  granularity: 'day';
  buckets: ConversationSeriesBucket[];
  total: number;
  agentTotals: ConversationSeriesAgentTotal[];
  generatedAt: string;
}

export interface ConversationSeriesParams {
  start: string;
  end: string;
  agentId?: string | null;
}

export interface AgentComparisonDataset {
  start: string;
  end: string;
  totals: ConversationSeriesAgentTotal[];
  total: number;
  generatedAt: string;
}

export interface AgentComparisonParams {
  start: string;
  end: string;
}

export async function getProvinceHeatmap(
  params: ProvinceHeatmapParams,
): Promise<ProvinceHeatmapDataset> {
  const query = {
    start: params.start,
    end: params.end,
    ...(params.agentId ? { agentId: params.agentId } : {}),
  };
  const { data } = await api.get<{ data: ProvinceHeatmapDataset }>(
    '/admin/analytics/province-heatmap',
    { params: query },
  );
  return data.data;
}

export async function getConversationSeries(
  params: ConversationSeriesParams,
): Promise<ConversationSeriesDataset> {
  const query = {
    start: params.start,
    end: params.end,
    ...(params.agentId ? { agentId: params.agentId } : {}),
  };
  const { data } = await api.get<{ data: ConversationSeriesDataset }>(
    '/admin/analytics/conversations/series',
    { params: query },
  );
  return data.data;
}

export async function getAgentComparison(
  params: AgentComparisonParams,
): Promise<AgentComparisonDataset> {
  const { data } = await api.get<{ data: AgentComparisonDataset }>(
    '/admin/analytics/conversations/agents',
    { params },
  );
  return data.data;
}

// ==================== 系统概览 API ====================

export interface SystemOverviewTopAgent {
  agent_name: string;
  provider: string;
  sessions: number;
}

export interface SystemOverviewData {
  total_agents: number;
  total_sessions: number;
  total_users: number;
  sessions_today: number;
  active_sessions_1h: number;
  self_hosted_messages: number;
  messages_today: number;
  top_agents: SystemOverviewTopAgent[];
  provider_distribution: Record<string, number>;
  updated_at: string;
}

export async function getSystemOverview(): Promise<SystemOverviewData> {
  const { data } = await api.get<{ data: SystemOverviewData }>('/admin/analytics/overview');
  return data.data;
}
