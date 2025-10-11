/**
 * DashboardContent 组件 - 仪表板内容展示
 */

'use client';

import { memo } from 'react';
import Card from '@/components/ui/Card';

// 简化的数据卡片组件
function ConversationsTrendCard({ analytics: _analytics }: { analytics: any }) {
  return (
    <Card>
      <Card.Content>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">--</div>
          <div className="text-sm text-gray-600">对话趋势</div>
          <div className="text-xs text-gray-500 mt-1">数据加载中...</div>
        </div>
      </Card.Content>
    </Card>
  );
}

function AgentComparisonCard({ analytics: _analytics }: { analytics: any }) {
  return (
    <Card>
      <Card.Content>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">--</div>
          <div className="text-sm text-gray-600">智能体对比</div>
          <div className="text-xs text-gray-500 mt-1">数据加载中...</div>
        </div>
      </Card.Content>
    </Card>
  );
}

function DashboardHeatmapCard() {
  return (
    <Card>
      <Card.Content>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">--</div>
          <div className="text-sm text-gray-600">地域分布</div>
          <div className="text-xs text-gray-500 mt-1">数据加载中...</div>
        </div>
      </Card.Content>
    </Card>
  );
}

function ConversationSummaryCard({ analytics: _analytics }: { analytics: any }) {
  return (
    <Card>
      <Card.Content>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">--</div>
          <div className="text-sm text-gray-600">对话摘要</div>
          <div className="text-xs text-gray-500 mt-1">数据加载中...</div>
        </div>
      </Card.Content>
    </Card>
  );
}

function ServerParamsCard() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">CPU使用率</span>
        <span className="text-sm font-medium">--</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">内存使用率</span>
        <span className="text-sm font-medium">--</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">磁盘空间</span>
        <span className="text-sm font-medium">--</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">网络延迟</span>
        <span className="text-sm font-medium">--</span>
      </div>
    </div>
  );
}

function useDashboardConversationAnalytics() {
  // 简化的分析数据，实际应该从API获取
  return {
    filters: { startDate: '', endDate: '', agentId: '' },
    setDateFilter: () => {},
    setAgentId: () => {},
    refresh: async () => {},
    series: null,
    seriesLoading: false,
    seriesError: null,
    comparison: null,
    comparisonLoading: false,
    comparisonError: null,
    agents: [],
    agentsLoading: false,
  };
}

export default memo(function DashboardContent({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const analytics = useDashboardConversationAnalytics();

  return (
    <main className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          <div className="lg:col-span-4">
            <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <ConversationsTrendCard analytics={analytics} />
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <AgentComparisonCard analytics={analytics} />
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <DashboardHeatmapCard />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <ConversationSummaryCard analytics={analytics} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">服务器参数</h3>
              <ServerParamsCard />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
});