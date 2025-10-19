'use client';


import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle, Clock, Pause, Play, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';


import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

import {
  MetricsCard,
  ResponseTimeCard,
} from './MetricsCard';
import {
  ResponseTimeChart,
  ErrorRateChart,
  RequestVolumeChart,
} from './PerformanceChart';
import { toast } from '@/components/ui/Toast';

interface AgentDetailsProps {
  agentId?: string;
}

interface AgentMetrics {
  id: string;
  name: string;
  provider: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  responseTime: number;
  successRate: number;
  lastCheckTime: string;
  errorCount: number;
  requestCount: number;
  enabled: boolean;
  metrics: Array<{
    timestamp: string;
    value: number;
    labels: { type: string };
  }>;
}

export function AgentDetails({ agentId: propAgentId }: AgentDetailsProps) {
  const params = useParams();
  const navigate = useNavigate();
  const agentId = propAgentId || params.id as string;

  const [loading, setLoading] = useState(true);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 生成模拟数据
  const generateMockAgentData = useCallback(() => {
    const now = new Date();
    const timestamps = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      return time.toISOString();
    });

    return {
      id: agentId,
      name: 'GPT-4 Turbo',
      provider: 'OpenAI',
      status: 'online' as const,
      responseTime: 420,
      successRate: 99.2,
      lastCheckTime: now.toISOString(),
      errorCount: 8,
      requestCount: 1024,
      enabled: true,
      metrics: [
        ...timestamps.map((ts, i) => ({
          timestamp: ts,
          value: 420 + Math.sin(i * 0.3) * 100 + Math.random() * 50,
          labels: { type: 'responseTime' },
        })),
        ...timestamps.map((ts, i) => ({
          timestamp: ts,
          value: 0.8 + Math.sin(i * 0.5) * 0.5 + Math.random() * 0.3,
          labels: { type: 'errorRate' },
        })),
        ...timestamps.map((ts, i) => ({
          timestamp: ts,
          value: 15 + Math.sin(i * 0.4) * 5 + Math.random() * 3,
          labels: { type: 'throughput' },
        })),
      ],
    };
  }, [agentId]);

  const loadAgentMetrics = useCallback(async () => {
    try {
      setLoading(true);
      // 模拟API调用
      const mockData = generateMockAgentData();
      setAgentMetrics(mockData);
    } catch (error) {
      console.error('Failed to load agent metrics:', error);
      toast({
        type: 'error',
        title: '加载失败',
        description: '无法加载智能体指标数据',
      });
    } finally {
      setLoading(false);
    }
  }, [generateMockAgentData]);

  useEffect(() => {
    if (!agentId) {
      return;
    }
    loadAgentMetrics();
  }, [agentId, loadAgentMetrics]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      loadAgentMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadAgentMetrics]);

  if (!agentId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">未指定智能体ID</p>
        </div>
      </div>
    );
  }

  if (!agentMetrics && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-error mx-auto mb-2" />
          <p className="text-foreground font-medium">智能体不存在</p>
          <p className="text-muted-foreground text-sm">请检查智能体ID是否正确</p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    online: { icon: CheckCircle, color: 'text-success bg-success/10 border-success/20', label: '在线' },
    offline: { icon: XCircle, color: 'text-error bg-error/10 border-error/20', label: '离线' },
    degraded: { icon: AlertTriangle, color: 'text-warning bg-warning/10 border-warning/20', label: '降级' },
    unknown: { icon: Clock, color: 'text-muted-foreground bg-muted/10 border-muted/20', label: '未知' },
  };

  const config = statusConfig[agentMetrics?.status || 'unknown'];
  const StatusIcon = config?.icon || Clock;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* 头部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/home/monitoring')}
            className="h-8 px-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回监控
          </Button>

          {agentMetrics && (
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                {agentMetrics.name}
                <span className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                  config?.color,
                )}>
                  <StatusIcon className="h-4 w-4" />
                  {config?.label}
                </span>
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{agentMetrics.provider}</span>
                <span>ID: {agentMetrics.id}</span>
                <span>最后检查: {new Date(agentMetrics.lastCheckTime).toLocaleString('zh-CN')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 操作按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="h-8 px-3"
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', autoRefresh && 'animate-spin')} />
            {autoRefresh ? '自动' : '手动'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAgentMetrics}
            disabled={loading}
            className="h-8 px-3"
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            刷新
          </Button>

          {agentMetrics && (
            <>
              <Button
                variant={agentMetrics.enabled ? 'destructive' : 'success'}
                size="sm"
                className="h-8 px-3"
              >
                {agentMetrics.enabled ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    停用
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    启用
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                重置
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 核心指标 */}
      {agentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ResponseTimeCard
            responseTime={{ avg: agentMetrics.responseTime, p95: agentMetrics.responseTime * 1.8 }}
            loading={loading}
          />

          <MetricsCard
            title="成功率"
            value={agentMetrics.successRate}
            unit="%"
            status={agentMetrics.successRate >= 99 ? 'success' : agentMetrics.successRate >= 95 ? 'warning' : 'error'}
            icon={<CheckCircle className="h-5 w-5 text-success" />}
            description={`总请求: ${agentMetrics.requestCount.toLocaleString()}`}
            loading={loading}
          />

          <MetricsCard
            title="错误数"
            value={agentMetrics.errorCount}
            status={agentMetrics.errorCount === 0 ? 'success' : agentMetrics.errorCount < 10 ? 'warning' : 'error'}
            icon={<XCircle className="h-5 w-5 text-error" />}
            description={`错误率: ${((agentMetrics.errorCount / agentMetrics.requestCount) * 100).toFixed(2)}%`}
            loading={loading}
          />

          <MetricsCard
            title="吞吐量"
            value={agentMetrics.metrics?.filter((m: any) => m.labels?.type === 'throughput')?.pop()?.value || 0}
            unit="req/min"
            icon={<BarChart3 className="h-5 w-5 text-brand" />}
            description="当前每分钟请求数"
            loading={loading}
            change={{
              value: 8.5,
              type: 'increase',
              period: '昨日',
            }}
          />
        </div>
      )}

      {/* 性能图表 */}
      {agentMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">响应时间趋势</h2>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="1h">1小时</option>
                <option value="6h">6小时</option>
                <option value="24h">24小时</option>
                <option value="7d">7天</option>
              </select>
            </div>
            <ResponseTimeChart data={agentMetrics.metrics?.filter((m: any) => m.labels?.type === 'responseTime') || []} loading={loading} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">错误率趋势</h2>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="1h">1小时</option>
                <option value="6h">6小时</option>
                <option value="24h">24小时</option>
                <option value="7d">7天</option>
              </select>
            </div>
            <ErrorRateChart data={agentMetrics.metrics?.filter((m: any) => m.labels?.type === 'errorRate') || []} loading={loading} />
          </div>
        </div>
      )}

      {/* 吞吐量和详细统计 */}
      {agentMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">吞吐量趋势</h2>
            <RequestVolumeChart data={agentMetrics.metrics?.filter((m: any) => m.labels?.type === 'throughput') || []} loading={loading} />
          </div>

          <div className="rounded-lg border border-border/20 bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">详细统计</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">今日请求数</div>
                  <div className="text-2xl font-bold text-foreground">
                    {agentMetrics.requestCount.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">今日错误数</div>
                  <div className="text-2xl font-bold text-error">
                    {agentMetrics.errorCount.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">平均响应时间</div>
                  <div className="text-2xl font-bold text-foreground">
                    {agentMetrics.responseTime}ms
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">成功率</div>
                  <div className="text-2xl font-bold text-success">
                    {agentMetrics.successRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">状态</span>
                  <span className={cn('font-medium', config?.color)}>
                    {config?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">提供商</span>
                  <span className="font-medium">{agentMetrics.provider}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">最后检查</span>
                  <span className="font-medium">
                    {new Date(agentMetrics.lastCheckTime).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}