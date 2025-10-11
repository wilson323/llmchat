/**
 * AnalyticsPanel 组件 - 数据分析面板
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { formatDateInputValue, toIsoRangeFromInput } from '@/utils/dateUtils';
import { getProvinceHeatmap, listAgents } from '@/services/analytics';
import type { ProvinceHeatmapDataset, AnalyticsFilters, AgentItem } from '@/types/admin';

// 简化的热力图可视化组件
function HeatmapVisualization({ dataset, loading, height }: {
  dataset?: ProvinceHeatmapDataset | null;
  loading?: boolean;
  height?: number;
}) {
  if (!dataset) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border">
        <div className="text-gray-500">
          {loading ? '正在加载数据...' : '暂无数据，请先查询'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg border p-4" style={{ height: height || 400 }}>
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="text-lg font-medium mb-2">省域分布热力图</div>
          <div className="text-sm">共 {dataset.data.length} 个省份</div>
          <div className="text-xs text-gray-500 mt-1">
            更新时间: {new Date(dataset.generatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// 简化的热力图摘要组件
function HeatmapSummary({ dataset }: { dataset?: ProvinceHeatmapDataset | null }) {
  if (!dataset || !dataset.data.length) {
    return (
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="text-sm text-blue-600">暂无数据摘要</div>
      </div>
    );
  }

  const totalRequests = dataset.data.reduce((sum, item) => sum + (item.requestCount || 0), 0);
  const activeProvinces = dataset.data.filter(item => (item.requestCount || 0) > 0).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="text-2xl font-bold text-blue-600">{totalRequests.toLocaleString()}</div>
        <div className="text-sm text-blue-600">总请求数</div>
      </div>
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <div className="text-2xl font-bold text-green-600">{activeProvinces}</div>
        <div className="text-sm text-green-600">活跃省份</div>
      </div>
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <div className="text-2xl font-bold text-purple-600">
          {totalRequests > 0 ? Math.round(totalRequests / activeProvinces) : 0}
        </div>
        <div className="text-sm text-purple-600">平均请求数</div>
      </div>
    </div>
  );
}

export default function AnalyticsPanel() {
  const initialFilters = useMemo<AnalyticsFilters>(() => {
    const now = new Date();
    const day = formatDateInputValue(now);
    return { startDate: day, endDate: day, agentId: 'all' };
  }, []);

  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [dataset, setDataset] = useState<ProvinceHeatmapDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentOptions, setAgentOptions] = useState<AgentItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const fetchDataset = useCallback(async (target: AnalyticsFilters) => {
    if (!target.startDate || !target.endDate) {
      const message = '请选择起止日期';
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const startIso = toIsoRangeFromInput(target.startDate, false);
      const endIso = toIsoRangeFromInput(target.endDate, true);
      const data = await getProvinceHeatmap({
        start: startIso,
        end: endIso,
        agentId: target.agentId === 'all' ? undefined : target.agentId,
      });
      setDataset(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || '获取数据失败';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApply = useCallback(() => {
    void fetchDataset(filters);
  }, [fetchDataset, filters]);

  const handleReset = useCallback(() => {
    setFilters(initialFilters);
    void fetchDataset(initialFilters);
  }, [fetchDataset, initialFilters]);

  useEffect(() => {
    void fetchDataset(initialFilters);
  }, [fetchDataset, initialFilters]);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoadingAgents(true);
        const list = await listAgents({ includeInactive: true });
        setAgentOptions(list);
      } catch (err) {
        console.warn('[AnalyticsPanel] load agents failed:', err);
      } finally {
        setLoadingAgents(false);
      }
    };
    void loadAgents();
  }, []);

  const onStartChange = (value: string) => {
    setFilters((prev) => {
      const next: AnalyticsFilters = { ...prev, startDate: value };
      if (value && prev.endDate && value > prev.endDate) {
        next.endDate = value;
      }
      return next;
    });
  };

  const onEndChange = (value: string) => {
    setFilters((prev) => {
      const next: AnalyticsFilters = { ...prev, endDate: value };
      if (value && prev.startDate && value < prev.startDate) {
        next.startDate = value;
      }
      return next;
    });
  };

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-6">
          <Card.Header>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">数据分析</h3>
              <p className="text-sm text-gray-600">按省份查看不同时间段与智能体的请求热点分布</p>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-700">开始日期</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    max={filters.endDate || undefined}
                    onChange={(e) => onStartChange(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-700">结束日期</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    min={filters.startDate || undefined}
                    onChange={(e) => onEndChange(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-700">智能体</label>
                  <select
                    value={filters.agentId}
                    onChange={(e) => setFilters((prev) => ({ ...prev, agentId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loadingAgents}
                  >
                    <option value="all">全部智能体</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.id}
                        {agent.status === 'inactive' ? ' · 未激活' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleApply} disabled={loading}>
                  {loading ? '加载中...' : '查询'}
                </Button>
                <Button variant="ghost" onClick={handleReset} disabled={loading}>
                  重置
                </Button>
                {dataset && (
                  <span className="text-xs text-gray-500">
                    数据更新时间：{new Date(dataset.generatedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <HeatmapVisualization dataset={dataset} loading={loading} height={420} />
          </Card.Content>
        </Card>

        <div className="mt-6">
          <HeatmapSummary dataset={dataset} />
        </div>
      </div>
    </main>
  );
}