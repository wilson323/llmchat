/**
 * DashboardContent 组件 - 仪表板内容展示
 * 集成真实的数据分析功能
 */

'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { getDefaultConversationFilters, toIsoRangeFromInput } from '@/utils/dateUtils';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';
import AgentRankingChart from './AgentRankingChart';
import ProviderPieChart from './ProviderPieChart';
import ConversationTrendChart from './ConversationTrendChart';
import ChinaHeatmapChart from './ChinaHeatmapChart';
import { 
  getConversationSeries, 
  getAgentComparison, 
  getProvinceHeatmap,
  getSystemOverview,
  type ConversationSeriesDataset, 
  type AgentComparisonDataset,
  type ProvinceHeatmapDataset,
  type SystemOverviewData 
} from '@/services/analyticsApi';
import { listAgents, type AgentItem } from '@/services/agentsApi';
import type { ConversationAnalyticsFilters } from '@/types';

// Analytics数据的类型定义
interface DashboardAnalytics {
  filters: ConversationAnalyticsFilters;
  setDateFilter: (key: 'startDate' | 'endDate', value: string) => void;
  setAgentId: (id: string) => void;
  refresh: () => Promise<void>;
  overview: SystemOverviewData | null;
  overviewLoading: boolean;
  overviewError: string | null;
  series: ConversationSeriesDataset | null;
  seriesLoading: boolean;
  seriesError: string | null;
  comparison: AgentComparisonDataset | null;
  comparisonLoading: boolean;
  comparisonError: string | null;
  heatmap: ProvinceHeatmapDataset | null;
  heatmapLoading: boolean;
  heatmapError: string | null;
  agents: AgentItem[];
  agentsLoading: boolean;
  agentsError: string | null;
}

/**
 * Dashboard会话分析Hook - 整合了所有数据获取逻辑
 */
function useDashboardConversationAnalytics(): DashboardAnalytics {
  const { t } = useI18n();
  const [filters, setFilters] = useState(getDefaultConversationFilters());
  const [overview, setOverview] = useState<SystemOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [series, setSeries] = useState<ConversationSeriesDataset | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AgentComparisonDataset | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<ProvinceHeatmapDataset | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
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

  const fetchOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const data = await getSystemOverview();
      setOverview(data);
    } catch (err: unknown) {
      let message = t('获取系统概览失败');
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      setOverviewError(message);
      // 不显示toast，避免过多提示
    } finally {
      setOverviewLoading(false);
    }
  }, [t]);

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
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
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
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      setComparisonError(message);
      toast({ type: 'error', title: message });
    } finally {
      setComparisonLoading(false);
    }
  }, [normalizedRange.startIso, normalizedRange.endIso, t]);

  const fetchHeatmap = useCallback(async () => {
    try {
      setHeatmapLoading(true);
      setHeatmapError(null);
      const data = await getProvinceHeatmap({
        start: normalizedRange.startIso,
        end: normalizedRange.endIso,
        agentId: normalizedRange.agentId,
      });
      setHeatmap(data);
    } catch (err: unknown) {
      let message = t('获取地域分布失败');
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      setHeatmapError(message);
      // 不显示toast，避免过多提示
    } finally {
      setHeatmapLoading(false);
    }
  }, [normalizedRange.startIso, normalizedRange.endIso, normalizedRange.agentId, t]);

  const fetchAgents = useCallback(async () => {
    try {
      setAgentsLoading(true);
      setAgentsError(null);
      const data = await listAgents({ includeInactive: true });
      setAgents(data);
    } catch (err: unknown) {
      let message = t('获取智能体列表失败');
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      setAgentsError(message);
      toast({ type: 'error', title: message });
    } finally {
      setAgentsLoading(false);
    }
  }, [t]);

  const setDateFilter = useCallback((key: 'startDate' | 'endDate', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setAgentId = useCallback((agentId: string) => {
    setFilters((prev) => ({ ...prev, agentId }));
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchOverview(), fetchSeries(), fetchComparison(), fetchHeatmap(), fetchAgents()]);
  }, [fetchOverview, fetchSeries, fetchComparison, fetchHeatmap, fetchAgents]);

  // 初始数据加载
  useEffect(() => {
    void fetchOverview();
    void fetchAgents();
  }, [fetchOverview, fetchAgents]);

  // 当筛选条件变化时重新获取图表数据
  useEffect(() => {
    void fetchSeries();
    void fetchComparison();
    void fetchHeatmap();
  }, [fetchSeries, fetchComparison, fetchHeatmap]);

  return {
    filters,
    setDateFilter,
    setAgentId,
    refresh,
    overview,
    overviewLoading,
    overviewError,
    series,
    seriesLoading,
    seriesError,
    comparison,
    comparisonLoading,
    comparisonError,
    heatmap,
    heatmapLoading,
    heatmapError,
    agents,
    agentsLoading,
    agentsError,
  };
}

export default memo(function DashboardContent({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const analytics = useDashboardConversationAnalytics();

  return (
    <div className="dashboard-content">
      {/* 欢迎区域 */}
      <div className="welcome-banner">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">欢迎使用 LLMChat 管理后台</h1>
        <p className="text-gray-600 dark:text-gray-300">这里是您的系统概览和数据分析中心</p>
      </div>

      {/* 统计卡片网格 */}
      <div className="dashboard-grid">
        {/* 总会话数 */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">总会话数</p>
              <p className="text-2xl font-bold text-blue-600">
                {analytics.overviewLoading ? '...' : analytics.overview?.total_sessions?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-500">
                今日: {analytics.overview?.sessions_today || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 总用户数 */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">总用户数</p>
              <p className="text-2xl font-bold text-green-600">
                {analytics.overviewLoading ? '...' : analytics.overview?.total_users?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-500">
                1小时活跃: {analytics.overview?.active_sessions_1h || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 智能体数量 */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">智能体数量</p>
              <p className="text-2xl font-bold text-purple-600">
                {analytics.overviewLoading ? '...' : analytics.overview?.total_agents || '0'}
              </p>
              <p className="text-xs text-gray-500">
                {analytics.agents.filter(a => a.isActive).length} 个活跃
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 消息总数（自研） */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">消息数（自研）</p>
              <p className="text-2xl font-bold text-orange-600">
                {analytics.overviewLoading ? '...' : analytics.overview?.self_hosted_messages?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-500">
                今日: {analytics.overview?.messages_today || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* 对话趋势图 */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-foreground mb-2">对话趋势</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">最近7天的对话数量变化</p>
          <ConversationTrendChart
            data={analytics.series}
            loading={analytics.seriesLoading}
            error={analytics.seriesError}
          />
        </div>

        {/* 智能体排行榜 */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-foreground mb-2">智能体排行榜</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Top 5智能体使用情况</p>
          <AgentRankingChart
            data={analytics.overview?.top_agents || null}
            loading={analytics.overviewLoading}
            error={analytics.overviewError}
          />
        </div>

        {/* 提供商分布 */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-foreground mb-2">提供商分布</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">各提供商的会话占比</p>
          <ProviderPieChart
            data={analytics.overview?.provider_distribution || null}
            loading={analytics.overviewLoading}
            error={analytics.overviewError}
          />
        </div>

        {/* 地域分布热力图 */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-foreground mb-2">地域分布</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">用户地理位置热力图</p>
          <ChinaHeatmapChart
            data={analytics.heatmap}
            loading={analytics.heatmapLoading}
            error={analytics.heatmapError}
          />
            </div>
          </div>

      {/* 服务器状态 */}
      <div className="admin-card">
        <h3 className="text-lg font-semibold text-foreground mb-2">服务器状态</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">系统资源使用情况</p>
        <div className="server-status-grid">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU使用率</span>
              <span className="text-sm font-bold text-blue-600">23%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill bg-blue-600" style={{ width: '23%' }}></div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">内存使用率</span>
              <span className="text-sm font-bold text-green-600">67%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill bg-green-600" style={{ width: '67%' }}></div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">磁盘空间</span>
              <span className="text-sm font-bold text-yellow-600">45%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill bg-yellow-600" style={{ width: '45%' }}></div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">网络延迟</span>
              <span className="text-sm font-bold text-purple-600">12ms</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill bg-purple-600" style={{ width: '12%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});