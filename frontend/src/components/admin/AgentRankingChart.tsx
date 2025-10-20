/**
 * AgentRankingChart 组件 - 智能体使用排行榜
 * 展示Top智能体的使用情况
 */

import { memo } from 'react';
import type { SystemOverviewTopAgent } from '@/services/analyticsApi';

interface AgentRankingChartProps {
  data: SystemOverviewTopAgent[] | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * 智能体排行榜组件
 */
export const AgentRankingChart = memo(function AgentRankingChart({
  data,
  loading,
  error,
}: AgentRankingChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-500">暂无数据</p>
      </div>
    );
  }

  const maxSessions = Math.max(...data.map(agent => agent.sessions));

  return (
    <div className="space-y-3 p-2">
      {data.map((agent, index) => {
        const percentage = maxSessions > 0 ? (agent.sessions / maxSessions) * 100 : 0;
        const colors = [
          'bg-yellow-500',   // 第1名 - 金色
          'bg-gray-400',     // 第2名 - 银色
          'bg-amber-700',    // 第3名 - 铜色
          'bg-blue-500',     // 其他 - 蓝色
          'bg-purple-500',   // 其他 - 紫色
        ];
        const barColor = colors[Math.min(index, colors.length - 1)];

        return (
          <div key={agent.agent_name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300 w-6">
                  #{index + 1}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {agent.agent_name}
                </span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {agent.provider}
                </span>
              </div>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {agent.sessions.toLocaleString()}
              </span>
            </div>
            <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full ${barColor} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default AgentRankingChart;

