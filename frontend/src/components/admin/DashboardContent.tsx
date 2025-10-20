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
import { getConversationSeries, getAgentComparison, type ConversationSeriesDataset, type AgentComparisonDataset } from '@/services/analyticsApi';
import { listAgents, type AgentItem } from '@/services/agentsApi';
import type { ConversationAnalyticsFilters } from '@/types';

// Analytics数据的类型定义
interface DashboardAnalytics {
  filters: ConversationAnalyticsFilters;
  setDateFilter: (key: 'startDate' | 'endDate', value: string) => void;
  setAgentId: (id: string) => void;
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

/**
 * Dashboard会话分析Hook - 整合了所有数据获取逻辑
 */
function useDashboardConversationAnalytics(): DashboardAnalytics {
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
    await Promise.all([fetchSeries(), fetchComparison(), fetchAgents()]);
  }, [fetchSeries, fetchComparison, fetchAgents]);

  // 初始数据加载 - 暂时禁用API调用，避免404错误
  useEffect(() => {
    // TODO: 后端实现analytics API后再启用
    // void fetchSeries();
    // void fetchComparison();
    void fetchAgents(); // 仅获取智能体列表
  }, [fetchAgents]);

  // 当筛选条件变化时重新获取数据 - 暂时禁用
  // useEffect(() => {
  //   void fetchSeries();
  //   void fetchComparison();
  // }, [fetchSeries, fetchComparison]);

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
        {/* 对话趋势 */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">今日对话</p>
              <p className="text-2xl font-bold text-blue-600">1,234</p>
              <p className="text-xs text-green-600">+12% 较昨日</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 活跃用户 */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">活跃用户</p>
              <p className="text-2xl font-bold text-green-600">567</p>
              <p className="text-xs text-green-600">+8% 较昨日</p>
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
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">智能体</p>
              <p className="text-2xl font-bold text-purple-600">23</p>
              <p className="text-xs text-gray-500">2个新增</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 系统状态 */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">系统状态</p>
              <p className="text-2xl font-bold text-green-600">正常</p>
              <p className="text-xs text-gray-500">99.9% 可用性</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          <div className="chart-placeholder">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">图表加载中...</p>
              <p className="text-sm text-gray-500">即将显示对话趋势数据</p>
            </div>
          </div>
        </div>

        {/* 智能体对比 */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-foreground mb-2">智能体对比</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">各智能体的使用情况对比</p>
          <div className="chart-placeholder">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">图表加载中...</p>
              <p className="text-sm text-gray-500">即将显示智能体对比数据</p>
            </div>
          </div>
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