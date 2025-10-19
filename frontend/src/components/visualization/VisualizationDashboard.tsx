/**
 * 队列管理可视化仪表板组件
 * 支持参数化配置和生产环境控制
 */


import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { SafeAccess } from '@/utils/SafeAccess';

interface VisualizationConfig {
  enabled: boolean;
  refreshInterval: number;
  maxDataPoints: number;
  features: {
    dashboard: boolean;
    realTimeMonitoring: boolean;
    queueManagement: boolean;
    performanceAnalytics: boolean;
    alertManagement: boolean;
    systemHealth: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'zh' | 'en';
    compactMode: boolean;
    showAdvancedOptions: boolean;
  };
  performance: {
    enableAnimations: boolean;
    chartUpdateThrottle: number;
    dataCompressionEnabled: boolean;
    cacheEnabled: boolean;
    cache_ttl: number;
  };
}

interface DashboardData {
  summary: {
    queues: {
      total: number;
      totalJobs: number;
      waitingJobs: number;
      activeJobs: number;
      avgThroughput: number;
    };
    system: {
      cpu: number;
      memoryUsage: number;
      eventLoopDelay: number;
      uptime: number;
    };
    redis: {
      connections: number;
      successRate: number;
    };
  };
  config: VisualizationConfig;
  timestamp: number;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

interface RealtimeUpdate {
  timestamp: number;
  type: 'queue' | 'system' | 'performance' | 'alert';
  data: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const VisualizationDashboard: React.FC = () => {
  // 状态管理
  const [config, setConfig] = useState<VisualizationConfig | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [realtimeData, setRealtimeData] = useState<RealtimeUpdate[]>([]);
  const [chartData, setChartData] = useState<Record<string, ChartData>>({});

  // 检查功能是否启用
  const isFeatureEnabled = useCallback((feature: keyof VisualizationConfig['features']) => {
    return SafeAccess.getBoolean(config, 'enabled') && SafeAccess.getBoolean(config, ['features', feature]);
  }, [config]);

  // 获取可视化配置
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/visualization/config');
      const result = await response.json();
      if (result.success) {
        setConfig(result.data);
      } else {
        setError('Failed to load configuration');
      }
    } catch (err) {
      setError('Failed to connect to visualization service');
    }
  }, []);

  // 获取仪表板数据
  const fetchDashboardData = useCallback(async () => {
    if (!isFeatureEnabled('dashboard')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/visualization/dashboard');
      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [isFeatureEnabled]);

  // 获取图表数据
  const fetchChartData = useCallback(async (type: string, metric: string) => {
    if (!isFeatureEnabled('performanceAnalytics')) {
      return;
    }

    try {
      const response = await fetch(`/api/visualization/charts/data?type=${type}&metric=${metric}&timeRange=${selectedTimeRange}`);
      const result = await response.json();
      if (result.success) {
        setChartData(prev => ({
          ...prev,
          [`${type}_${metric}`]: result.data.chartData,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
    }
  }, [isFeatureEnabled, selectedTimeRange]);

  // 更新配置
  const updateConfig = useCallback(async (updates: Partial<VisualizationConfig>) => {
    try {
      const response = await fetch('/api/visualization/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (result.success) {
        setConfig(result.data);
      } else {
        setError(result.error || 'Failed to update configuration');
      }
    } catch (err) {
      setError('Failed to update configuration');
    }
  }, []);

  // 应用预设配置
  const applyPreset = useCallback(async (preset: 'production' | 'development' | 'minimal') => {
    try {
      const response = await fetch('/api/visualization/presets/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preset }),
      });
      const result = await response.json();
      if (result.success) {
        setConfig(result.data.config);
      } else {
        setError(result.error || 'Failed to apply preset');
      }
    } catch (err) {
      setError('Failed to apply preset');
    }
  }, []);

  // 设置实时更新
  const setupRealtimeUpdates = useCallback(() => {
    if (!isFeatureEnabled('realTimeMonitoring')) {
      return () => {}; // 返回空的清理函数
    }

    const eventSource = new EventSource('/api/visualization/realtime');

    eventSource.onmessage = (event) => {
      try {
        const update: RealtimeUpdate = JSON.parse(event.data);
        setRealtimeData(prev => [...prev.slice(-100), update]); // 保留最近100条更新
      } catch (err) {
        console.error('Failed to parse realtime update:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('Realtime updates disconnected');
    };

    return () => {
      eventSource.close();
    };
  }, [isFeatureEnabled]);

  // 初始化
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 配置加载后获取数据
  useEffect(() => {
    if (config) {
      fetchDashboardData();
    }
  }, [config, fetchDashboardData]);

  // 设置实时更新
  useEffect(() => {
    if (config && config.enabled) {
      const cleanup = setupRealtimeUpdates();
      return cleanup;
    }
    return undefined;
  }, [config, setupRealtimeUpdates]);

  // 定期刷新数据
  useEffect(() => {
    if (!SafeAccess.getBoolean(config, 'enabled')) {
      return;
    }

    const interval = setInterval(() => {
      fetchDashboardData();
    }, SafeAccess.getNumber(config, 'refreshInterval', 5000));

    return () => clearInterval(interval);
  }, [config, fetchDashboardData]);

  // 获取图表数据
  useEffect(() => {
    if (SafeAccess.getBoolean(config, 'enabled')) {
      fetchChartData('queue', 'waitingJobs');
      fetchChartData('queue', 'activeJobs');
      fetchChartData('system', 'cpu');
      fetchChartData('system', 'memoryUsage');
      fetchChartData('redis', 'connections');
    }
  }, [config, fetchChartData]);

  // 渲染配置面板
  const renderConfigPanel = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">可视化配置</h3>
        <Button
          variant="outline"
          onClick={() => setIsConfigMode(false)}
        >
          完成配置
        </Button>
      </div>

      {/* 基本配置 */}
      <Card>
        <Card.Header>
          <Card.Title>基本配置</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={SafeAccess.getBoolean(config, 'enabled', false)}
              onCheckedChange={(enabled: boolean) => updateConfig({ enabled })}
            />
            <Label htmlFor="enabled">启用可视化</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="refreshInterval">刷新间隔 (ms)</Label>
              <Input
                id="refreshInterval"
                type="number"
                value={SafeAccess.getNumber(config, 'refreshInterval', 5000)}
                onChange={(e) => updateConfig({ refreshInterval: parseInt(e.target.value) })}
                min="1000"
                max="300000"
              />
            </div>
            <div>
              <Label htmlFor="maxDataPoints">最大数据点</Label>
              <Input
                id="maxDataPoints"
                type="number"
                value={SafeAccess.getNumber(config, 'maxDataPoints', 1000)}
                onChange={(e) => updateConfig({ maxDataPoints: parseInt(e.target.value) })}
                min="10"
                max="10000"
              />
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* 功能开关 */}
      <Card>
        <Card.Header>
          <Card.Title>功能开关</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4">
          {Object.entries(SafeAccess.getObject(config, 'features', {})).map(([key, value]: [string, boolean]) => (
            <div key={key} className="flex items-center space-x-2">
              <Switch
                id={key}
                checked={value}
                onCheckedChange={(checked: boolean) =>
                  updateConfig({
                    features: {
                      dashboard: SafeAccess.getBoolean(config, ['features', 'dashboard'], true),
                      realTimeMonitoring: SafeAccess.getBoolean(config, ['features', 'realTimeMonitoring'], true),
                      queueManagement: SafeAccess.getBoolean(config, ['features', 'queueManagement'], true),
                      performanceAnalytics: SafeAccess.getBoolean(config, ['features', 'performanceAnalytics'], true),
                      alertManagement: SafeAccess.getBoolean(config, ['features', 'alertManagement'], true),
                      systemHealth: SafeAccess.getBoolean(config, ['features', 'systemHealth'], true),
                      ...SafeAccess.getObject(config, 'features', {}),
                      [key]: checked,
                    },
                  })
                }
              />
              <Label htmlFor={key}>
                {key === 'dashboard' && '仪表板'}
                {key === 'realTimeMonitoring' && '实时监控'}
                {key === 'queueManagement' && '队列管理'}
                {key === 'performanceAnalytics' && '性能分析'}
                {key === 'alertManagement' && '告警管理'}
                {key === 'systemHealth' && '系统健康'}
              </Label>
            </div>
          ))}
        </Card.Content>
      </Card>

      {/* 预设配置 */}
      <Card>
        <Card.Header>
          <Card.Title>预设配置</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => applyPreset('production')}
            >
              生产环境
            </Button>
            <Button
              variant="outline"
              onClick={() => applyPreset('development')}
            >
              开发环境
            </Button>
            <Button
              variant="outline"
              onClick={() => applyPreset('minimal')}
            >
              最小配置
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );

  // 渲染状态卡片
  const renderStatusCards = () => {
    if (!dashboardData) {
      return null;
    }

    const { summary } = dashboardData;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 队列状态 */}
        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium">队列状态</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">总队列</span>
                <span className="font-semibold">{summary.queues.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">等待任务</span>
                <Badge variant="secondary">{summary.queues.waitingJobs}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">活跃任务</span>
                <Badge variant="default">{summary.queues.activeJobs}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">平均吞吐</span>
                <span className="text-sm">{summary.queues.avgThroughput.toFixed(1)}/min</span>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* 系统状态 */}
        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium">系统状态</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">CPU使用</span>
                <Badge variant={summary.system.cpu > 80 ? 'destructive' : 'secondary'}>
                  {summary.system.cpu.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">内存使用</span>
                <Badge variant={summary.system.memoryUsage > 80 ? 'destructive' : 'secondary'}>
                  {summary.system.memoryUsage.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">事件延迟</span>
                <span className="text-sm">{summary.system.eventLoopDelay.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">运行时间</span>
                <span className="text-sm">{Math.floor(summary.system.uptime / 3600)}h</span>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Redis状态 */}
        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium">Redis状态</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">连接数</span>
                <Badge variant="secondary">{summary.redis.connections}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">成功率</span>
                <Badge variant={summary.redis.successRate < 95 ? 'destructive' : 'secondary'}>
                  {summary.redis.successRate.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* 实时更新状态 */}
        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium">实时状态</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">实时更新</span>
                <Badge variant={isFeatureEnabled('realTimeMonitoring') ? 'default' : 'secondary'}>
                  {isFeatureEnabled('realTimeMonitoring') ? '已启用' : '已禁用'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">更新数</span>
                <span className="text-sm">{realtimeData.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">最后更新</span>
                <span className="text-sm">
                  {realtimeData.length > 0
                    ? new Date(realtimeData[realtimeData.length - 1]!.timestamp).toLocaleTimeString()
                    : '无'
                  }
                </span>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  };

  // 渲染图表
  const renderCharts = () => {
    if (!isFeatureEnabled('performanceAnalytics')) {
      return (
        <Alert>
          <Alert.Description>
            性能分析功能已禁用。请在配置中启用以查看图表。
          </Alert.Description>
        </Alert>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 队列任务图表 */}
        <Card>
          <Card.Header>
            <Card.Title>队列任务趋势</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SafeAccess.getArray(chartData, ['queue_waitingJobs', 'labels'], []).map((label, index) => ({
                  time: label,
                  waiting: SafeAccess.getNumber(chartData, ['queue_waitingJobs', 'datasets', 0, 'data', index], 0),
                  active: SafeAccess.getNumber(chartData, ['queue_activeJobs', 'datasets', 0, 'data', index], 0),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="waiting" stroke={COLORS[0]} name="等待任务" />
                  <Line type="monotone" dataKey="active" stroke={COLORS[1]} name="活跃任务" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card.Content>
        </Card>

        {/* 系统性能图表 */}
        <Card>
          <Card.Header>
            <Card.Title>系统性能</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SafeAccess.getArray(chartData, ['system_cpu', 'labels'], []).map((label, index) => ({
                  time: label,
                  cpu: SafeAccess.getNumber(chartData, ['system_cpu', 'datasets', 0, 'data', index], 0),
                  memory: SafeAccess.getNumber(chartData, ['system_memoryUsage', 'datasets', 0, 'data', index], 0),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="cpu" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} name="CPU %" />
                  <Area type="monotone" dataKey="memory" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} name="内存 %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  };

  // 主渲染
  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">加载可视化配置中...</div>
      </div>
    );
  }

  if (!SafeAccess.getBoolean(config, 'enabled')) {
    return (
      <div className="space-y-4">
        <Alert>
          <Alert.Description>
            可视化功能已禁用。请联系管理员启用此功能。
          </Alert.Description>
        </Alert>
        {renderConfigPanel()}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Alert.Description>{error}</Alert.Description>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部控制 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">队列管理可视化</h2>
        <div className="flex items-center space-x-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5分钟</SelectItem>
              <SelectItem value="1h">1小时</SelectItem>
              <SelectItem value="6h">6小时</SelectItem>
              <SelectItem value="24h">24小时</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setIsConfigMode(!isConfigMode)}
          >
            {isConfigMode ? '完成配置' : '配置'}
          </Button>
          <Button onClick={fetchDashboardData}>
            刷新数据
          </Button>
        </div>
      </div>

      {/* 配置模式 */}
      {isConfigMode ? (
        renderConfigPanel()
      ) : (
        <Tabs defaultValue="dashboard" className="space-y-4">
          <Tabs.List>
            <Tabs.Trigger value="dashboard">仪表板</Tabs.Trigger>
            {isFeatureEnabled('queueManagement') && (
              <Tabs.Trigger value="queues">队列管理</Tabs.Trigger>
            )}
            {isFeatureEnabled('performanceAnalytics') && (
              <Tabs.Trigger value="performance">性能分析</Tabs.Trigger>
            )}
            {isFeatureEnabled('systemHealth') && (
              <Tabs.Trigger value="system">系统健康</Tabs.Trigger>
            )}
          </Tabs.List>

          <Tabs.Content value="dashboard" className="space-y-4">
            {renderStatusCards()}
            {renderCharts()}
          </Tabs.Content>

          {/* 其他标签页内容可以根据需要添加 */}
          <Tabs.Content value="queues">
            <Card>
              <Card.Header>
                <Card.Title>队列管理</Card.Title>
              </Card.Header>
              <Card.Content>
                <p>队列管理功能正在开发中...</p>
              </Card.Content>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="performance">
            <Card>
              <Card.Header>
                <Card.Title>性能分析</Card.Title>
              </Card.Header>
              <Card.Content>
                <p>性能分析功能正在开发中...</p>
              </Card.Content>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="system">
            <Card>
              <Card.Header>
                <Card.Title>系统健康</Card.Title>
              </Card.Header>
              <Card.Content>
                <p>系统健康功能正在开发中...</p>
              </Card.Content>
            </Card>
          </Tabs.Content>
        </Tabs>
      )}
    </div>
  );
};

export default VisualizationDashboard;