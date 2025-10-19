/**
 * 性能监控仪表板组件
 * 提供实时性能监控和可视化展示
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  api: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  database: {
    connectionPool: {
      active: number;
      idle: number;
      total: number;
      waiting: number;
    };
    queryStats: {
      queriesPerSecond: number;
      averageQueryTime: number;
      slowQueries: number;
      cacheHitRate: number;
    };
  };
  cache: {
    hitRate: number;
    missRate: number;
    size: number;
    evictions: number;
    memoryUsage: number;
  };
}

interface PerformanceAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

interface PerformanceOverview {
  status: 'healthy' | 'warning' | 'critical';
  summary: any;
  current: PerformanceMetrics | null;
  alerts: {
    active: PerformanceAlert[];
    count: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

const PerformanceDashboard: React.FC = () => {
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(60); // 分钟
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // 颜色配置
  const colors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4'
  };

  const severityColors = {
    low: colors.info,
    medium: colors.warning,
    high: colors.danger,
    critical: '#7c2d12'
  };

  // 获取性能概览
  const fetchOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/performance-monitoring/overview', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setOverview(data.data);
      } else {
        throw new Error(data.error || '获取数据失败');
      }
    } catch (err) {
      console.error('获取性能概览失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    }
  }, []);

  // 获取性能指标
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/performance-monitoring/metrics?minutes=${selectedTimeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setMetrics(data.data.history || []);
      } else {
        throw new Error(data.error || '获取指标失败');
      }
    } catch (err) {
      console.error('获取性能指标失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    }
  }, [selectedTimeRange]);

  // 获取告警信息
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/performance-monitoring/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAlerts(data.data.alerts || []);
      } else {
        throw new Error(data.error || '获取告警失败');
      }
    } catch (err) {
      console.error('获取告警信息失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    }
  }, []);

  // 解决告警
  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/performance-monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // 重新获取告警列表
        await fetchAlerts();
        await fetchOverview();
      } else {
        throw new Error(data.error || '解决告警失败');
      }
    } catch (err) {
      console.error('解决告警失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 格式化内存大小
  const formatMemory = (size: number) => {
    if (size < 1024) return `${size} MB`;
    return `${(size / 1024).toFixed(2)} GB`;
  };

  // 格式化运行时间
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return colors.success;
      case 'warning': return colors.warning;
      case 'critical': return colors.danger;
      default: return colors.info;
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return '健康';
      case 'warning': return '警告';
      case 'critical': return '严重';
      default: return '未知';
    }
  };

  // 准备图表数据
  const prepareChartData = () => {
    return metrics.map(metric => ({
      time: formatTime(metric.timestamp),
      cpu: metric.cpu.usage,
      memory: (metric.memory.used / metric.memory.total) * 100,
      responseTime: metric.api.averageResponseTime,
      errorRate: metric.api.errorRate,
      cacheHitRate: metric.cache.hitRate,
      databaseConnections: metric.database.connectionPool.total
    }));
  };

  // 准备告警分布数据
  const prepareAlertDistribution = () => {
    const distribution = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution).map(([severity, count]) => ({
      name: severity === 'low' ? '低' :
            severity === 'medium' ? '中' :
            severity === 'high' ? '高' : '严重',
      value: count,
      color: severityColors[severity as keyof typeof severityColors]
    }));
  };

  // 初始化数据
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchOverview(),
          fetchMetrics(),
          fetchAlerts()
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [fetchOverview, fetchMetrics, fetchAlerts]);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchOverview();
        fetchMetrics();
        fetchAlerts();
      }, 5000); // 每5秒刷新一次

      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      return undefined;
    }
  }, [autoRefresh, fetchOverview, fetchMetrics, fetchAlerts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载性能数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">
          <h3 className="text-lg font-medium mb-2">加载失败</h3>
          <p>{error}</p>
          <Button
            onClick={() => {
              setError(null);
              fetchOverview();
              fetchMetrics();
              fetchAlerts();
            }}
            className="mt-4"
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>暂无性能数据</p>
      </div>
    );
  }

  const chartData = prepareChartData();
  const alertDistribution = prepareAlertDistribution();

  return (
    <div className="space-y-6">
      {/* 头部控制栏 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">性能监控仪表板</h1>
          <div className={`px-3 py-1 rounded-full text-sm font-medium text-white`}
               style={{ backgroundColor: getStatusColor(overview.status) }}>
            {getStatusText(overview.status)}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value={15}>最近15分钟</option>
            <option value={60}>最近1小时</option>
            <option value={180}>最近3小时</option>
            <option value={360}>最近6小时</option>
          </select>

          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'primary' : 'secondary'}
            size="sm"
          >
            {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
          </Button>

          <Button
            onClick={() => {
              fetchOverview();
              fetchMetrics();
              fetchAlerts();
            }}
            variant="secondary"
            size="sm"
          >
            刷新
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <Card.Header>
            <Card.Title className="text-sm font-medium text-gray-600">系统状态</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <span className={`text-lg font-semibold`} style={{ color: getStatusColor(overview.status) }}>
                {getStatusText(overview.status)}
              </span>
              <div className="text-sm text-gray-500">
                运行时间: {formatUptime(overview.uptime)}
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="text-sm font-medium text-gray-600">活跃告警</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-red-600">
                {overview.alerts.count}
              </span>
              <div className="text-sm text-gray-500">
                总告警数
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="text-sm font-medium text-gray-600">CPU使用率</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-blue-600">
                {overview.current?.cpu.usage.toFixed(1)}%
              </span>
              <div className="text-sm text-gray-500">
                负载: {overview.current?.cpu.loadAverage[0]?.toFixed(2)}
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="text-sm font-medium text-gray-600">内存使用率</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-green-600">
                {overview.current ? ((overview.current.memory.used / overview.current.memory.total) * 100).toFixed(1) : 0}%
              </span>
              <div className="text-sm text-gray-500">
                {overview.current ? formatMemory(overview.current.memory.used) : '0 MB'}
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* 性能图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU和内存使用率 */}
        <Card>
          <Card.Header>
            <Card.Title>CPU和内存使用率</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke={colors.primary}
                  name="CPU使用率 (%)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke={colors.success}
                  name="内存使用率 (%)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* API响应时间和错误率 */}
        <Card>
          <Card.Header>
            <Card.Title>API性能</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke={colors.warning}
                  name="响应时间 (ms)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="errorRate"
                  stroke={colors.danger}
                  name="错误率 (%)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 缓存命中率和数据库连接 */}
        <Card>
          <Card.Header>
            <Card.Title>缓存和数据库</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cacheHitRate"
                  stroke={colors.info}
                  name="缓存命中率 (%)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="databaseConnections"
                  stroke={colors.success}
                  name="数据库连接数"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 告警分布 */}
        <Card>
          <Card.Header>
            <Card.Title>告警分布</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={alertDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {alertDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>
      </div>

      {/* 告警列表 */}
      <Card>
        <Card.Header>
          <Card.Title>活跃告警</Card.Title>
        </Card.Header>
        <Card.Content>
          {alerts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>暂无活跃告警</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  style={{ borderColor: severityColors[alert.severity] + '40' }}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: severityColors[alert.severity] }}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{alert.message}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => resolveAlert(alert.id)}
                    variant="secondary"
                    size="sm"
                  >
                    解决
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;