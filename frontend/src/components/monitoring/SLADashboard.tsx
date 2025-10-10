'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  Shield,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

import {
  UptimeCard,
  ResponseTimeCard,
  ErrorRateCard,
  ActiveAgentsCard,
} from './MetricsCard';
import { AlertList } from './AlertList';
import {
  ResponseTimeChart,
  ErrorRateChart,
  CPUUsageChart,
  MemoryUsageChart,
} from './PerformanceChart';
import { AgentStatusGrid } from './AgentStatusGrid';
import {
  acknowledgeAlert,
  resolveAlert,
  type SystemHealthMetrics,
  type PerformanceMetrics,
  type Alert,
  type AgentHealthStatus,
  type SLADashboardParams,
} from '@/services/slaApi';

const timeRanges = [
  { label: '1小时', value: '1h' },
  { label: '6小时', value: '6h' },
  { label: '24小时', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
] as const;

interface LayoutState {
  alertsExpanded: boolean;
  metricsExpanded: boolean;
  chartsExpanded: boolean;
  agentsExpanded: boolean;
}

export function SLADashboard() {
  const [timeRange, setTimeRange] = useState<SLADashboardParams['timeRange']>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [layout, setLayout] = useState<LayoutState>({
    alertsExpanded: false,
    metricsExpanded: false,
    chartsExpanded: false,
    agentsExpanded: false,
  });

  // 数据状态
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [realTimeData, setRealTimeData] = useState<{
    systemHealth: SystemHealthMetrics;
    activeAlerts: Alert[];
    recentViolations: any[];
  } | null>(null);

  // 生成模拟数据（实际应用中应该从API获取）
  const generateMockData = useCallback(() => {
    const now = new Date();
    const timestamps = Array.from({ length: 24 }, (_, index) => {
      const time = new Date(now.getTime() - (23 - index) * 60 * 60 * 1000);
      return time.toISOString();
    });

    return {
      systemHealth: {
        timestamp: now.toISOString(),
        overallStatus: 'healthy' as const,
        uptime: 99.95,
        responseTime: { avg: 325, p50: 280, p95: 680, p99: 1250 },
        errorRate: { total: 0.8, clientErrors: 0.3, serverErrors: 0.5 },
        requestCount: { total: 15420, success: 15296, failed: 124 },
        circuitBreakers: [
          { id: 'cb1', name: 'FastGPT API', state: 'CLOSED' as const, failureCount: 2, successCount: 98, lastFailureTime: null, lastSuccessTime: now.toISOString(), threshold: 5, timeout: 30000 },
          { id: 'cb2', name: 'OpenAI API', state: 'CLOSED' as const, failureCount: 1, successCount: 156, lastFailureTime: null, lastSuccessTime: now.toISOString(), threshold: 5, timeout: 30000 },
          { id: 'cb3', name: 'Anthropic API', state: 'HALF_OPEN' as const, failureCount: 4, successCount: 12, lastFailureTime: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), lastSuccessTime: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), threshold: 5, timeout: 30000 },
        ],
        agents: [
          { id: 'agent1', name: 'GPT-4', provider: 'OpenAI', status: 'online' as const, responseTime: 420, successRate: 99.2, lastCheckTime: now.toISOString(), errorCount: 8, requestCount: 1024, enabled: true },
          { id: 'agent2', name: 'Claude-3', provider: 'Anthropic', status: 'degraded' as const, responseTime: 890, successRate: 94.5, lastCheckTime: now.toISOString(), errorCount: 56, requestCount: 1024, enabled: true },
          { id: 'agent3', name: 'FastGPT', provider: 'FastGPT', status: 'online' as const, responseTime: 280, successRate: 98.8, lastCheckTime: now.toISOString(), errorCount: 12, requestCount: 1024, enabled: true },
        ] as AgentHealthStatus[],
      },
      performance: {
        cpu: timestamps.map((ts, i) => ({
          timestamp: ts,
          value: 45 + Math.sin(i * 0.5) * 15 + Math.random() * 10,
        })),
        memory: timestamps.map((ts, i) => ({
          timestamp: ts,
          value: 65 + Math.sin(i * 0.3) * 10 + Math.random() * 8,
        })),
        disk: timestamps.map((ts) => ({
          timestamp: ts,
          value: 35 + Math.random() * 5,
        })),
        network: timestamps.map((ts, i) => ({
          timestamp: ts,
          value: 120 + Math.sin(i * 0.7) * 30 + Math.random() * 20,
        })),
      },
      alerts: [
        {
          id: 'alert1',
          type: 'performance' as const,
          severity: 'warning' as const,
          title: '响应时间异常',
          description: '平均响应时间超过500ms阈值',
          source: 'system',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
          acknowledged: false,
          resolved: false,
          metadata: { current: '580ms', threshold: '500ms' },
        },
        {
          id: 'alert2',
          type: 'agent' as const,
          severity: 'error' as const,
          title: '智能体异常',
          description: 'Claude-3智能体响应缓慢，成功率低于95%',
          source: 'agent-metrics',
          timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
          acknowledged: true,
          acknowledgedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          acknowledgedBy: 'admin',
          resolved: false,
          metadata: { agentId: 'agent2', responseTime: '890ms', successRate: '94.5%' },
        },
      ],
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 模拟API调用
      const mockData = generateMockData();
      setSystemHealth(mockData.systemHealth);
      setPerformance(mockData.performance);
      setAlerts(mockData.alerts);
      setRealTimeData({
        systemHealth: mockData.systemHealth,
        activeAlerts: mockData.alerts.filter(a => !a.resolved),
        recentViolations: [],
      });
    } catch (error) {
      console.error('Failed to load SLA dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [generateMockData]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      loadData();
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // 处理告警操作
  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert,
      ));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }, []);

  const handleResolveAlert = useCallback(async (alertId: string) => {
    try {
      await resolveAlert(alertId);
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, resolved: true } : alert,
      ));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }, []);

  // 处理智能体操作
  const handleViewAgentDetails = useCallback((agentId: string) => {
    console.log('View agent details:', agentId);
    // 跳转到智能体详情页面
  }, []);

  const handleToggleAgent = useCallback((agentId: string, enabled: boolean) => {
    console.log('Toggle agent:', agentId, enabled);
    // 切换智能体状态
  }, []);

  const toggleLayout = (key: keyof LayoutState) => {
    setLayout(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* 头部控制 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">SLA监控看板</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>最后更新: {new Date().toLocaleTimeString('zh-CN')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>系统状态: {realTimeData?.systemHealth.overallStatus === 'healthy' ? '健康' : '异常'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 时间范围选择 */}
          <div className="flex items-center gap-2 bg-muted/10 rounded-lg p-1">
            {timeRanges.map(range => (
              <Button
                key={range.value}
                variant={timeRange === range.value ? 'brand' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range.value)}
                className="h-8 px-3 text-xs"
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* 自动刷新 */}
          <Button
            variant={autoRefresh ? 'brand' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="h-8 px-3 text-xs"
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', autoRefresh && 'animate-spin')} />
            {autoRefresh ? '自动' : '手动'}
          </Button>

          {/* 刷新 */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 px-3"
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {systemHealth && (
          <>
            <UptimeCard
              uptime={systemHealth.uptime}
              loading={loading}
            />
            <ResponseTimeCard
              responseTime={systemHealth.responseTime}
              loading={loading}
            />
            <ErrorRateCard
              errorRate={systemHealth.errorRate}
              loading={loading}
            />
            <ActiveAgentsCard
              activeAgents={systemHealth.agents.filter(a => a.status === 'online').length}
              totalAgents={systemHealth.agents.length}
              loading={loading}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：性能图表 */}
        <div className="space-y-6">
          {/* 图表区域 */}
          <div className="rounded-lg border border-border/20 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">性能趋势</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayout('chartsExpanded')}
                className="h-8 px-2"
              >
                {layout.chartsExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>

            <div className="space-y-4">
              {performance && (
                <>
                  <ResponseTimeChart data={performance.cpu} loading={loading} />
                  <ErrorRateChart data={performance.memory} loading={loading} />
                </>
              )}
            </div>
          </div>

          {/* 资源使用 */}
          <div className="rounded-lg border border-border/20 bg-card/50 p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">资源使用</h2>
            <div className="grid grid-cols-1 gap-4">
              {performance && (
                <>
                  <CPUUsageChart data={performance.cpu} loading={loading} />
                  <MemoryUsageChart data={performance.memory} loading={loading} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：告警和智能体状态 */}
        <div className="space-y-6">
          {/* 告警列表 */}
          <div className="rounded-lg border border-border/20 bg-card/50">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">告警中心</h2>
                {alerts.filter(a => !a.acknowledged && !a.resolved).length > 0 && (
                  <span className="bg-error text-white text-xs px-2 py-1 rounded-full">
                    {alerts.filter(a => !a.acknowledged && !a.resolved).length}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayout('alertsExpanded')}
                className="h-8 px-2"
              >
                {layout.alertsExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>

            <div className="p-4" style={{ maxHeight: layout.alertsExpanded ? '600px' : '400px' }}>
              <AlertList
                alerts={alerts}
                onAcknowledge={handleAcknowledgeAlert}
                onResolve={handleResolveAlert}
                loading={loading}
                maxHeight={layout.alertsExpanded ? '500px' : '300px'}
              />
            </div>
          </div>

          {/* 智能体状态 */}
          <div className="rounded-lg border border-border/20 bg-card/50">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold text-foreground">智能体状态</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLayout('agentsExpanded')}
                className="h-8 px-2"
              >
                {layout.agentsExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>

            <div className="p-4">
              <AgentStatusGrid
                agents={systemHealth?.agents || []}
                loading={loading}
                onRefresh={loadData}
                onViewDetails={handleViewAgentDetails}
                onToggleAgent={handleToggleAgent}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}