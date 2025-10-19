/**
 * 后端性能监控仪表板组件
 * 提供实时后端性能指标展示和告警监控
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceMetrics {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  requestCount: number;
  errorRate: number;
  cacheHitRate: number;
}

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  alerts: Alert[];
}

const BackendPerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timeRange, setTimeRange] = useState<number>(300000); // 5分钟
  const [isRealTime, setIsRealTime] = useState<boolean>(true);
  const [selectedMetric, setSelectedMetric] = useState<string>('responseTime');
  const [loading, setLoading] = useState<boolean>(false);

  // 获取性能指标
  const fetchPerformanceMetrics = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/performance/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newMetrics: PerformanceMetrics = {
            timestamp: Date.now(),
            cpuUsage: data.data.memoryStats.averageHeapUsed || 0,
            memoryUsage: data.data.memoryStats.maxHeapUsed || 0,
            responseTime: data.data.averageResponseTime || 0,
            requestCount: data.data.totalRequests || 0,
            errorRate: data.data.errorRate || 0,
            cacheHitRate: data.data.cacheStats?.hitRate || 0
          };

          setMetrics(prev => {
            const updated = [...prev, newMetrics];
            // 保持最近100个数据点
            return updated.slice(-100);
          });
        }
      }
    } catch (error) {
      console.error('获取性能指标失败:', error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 获取系统健康状态
  const fetchSystemHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/performance/health');

      if (response.ok) {
        const data: SystemHealth = await response.json();
        setSystemHealth(data);

        // 更新告警列表
        if (data.alerts && data.alerts.length > 0) {
          setAlerts(data.alerts.map(alert => ({
            ...alert,
            id: `${alert.timestamp}-${Math.random()}`,
            resolved: false
          })));
        }
      }
    } catch (error) {
      console.error('获取系统健康状态失败:', error);
    }
  }, []);

  // 获取性能告警
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/performance/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.alerts) {
          setAlerts(data.data.alerts);
        }
      }
    } catch (error) {
      console.error('获取性能告警失败:', error);
    }
  }, []);

  // 清理告警
  const clearAlert = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  }, []);

  // 清理缓存
  const clearCache = useCallback(async (type: string = 'all') => {
    try {
      const response = await fetch('/api/performance/cache', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 刷新数据
          fetchPerformanceMetrics();
          fetchSystemHealth();
        }
      }
    } catch (error) {
      console.error('清理缓存失败:', error);
    }
  }, [fetchPerformanceMetrics, fetchSystemHealth]);

  // 预热缓存
  const warmupCache = useCallback(async () => {
    try {
      const response = await fetch('/api/performance/cache/warmup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          queries: [
            { key: 'system:health', query: 'SELECT 1', executor: () => Promise.resolve({}) }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 刷新数据
          fetchPerformanceMetrics();
          fetchSystemHealth();
        }
      }
    } catch (error) {
      console.error('预热缓存失败:', error);
    }
  }, [fetchPerformanceMetrics, fetchSystemHealth]);

  // 获取性能建议
  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await fetch('/api/performance/recommendations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.recommendations) {
          console.log('性能建议:', data.data.recommendations);
        }
      }
    } catch (error) {
      console.error('获取性能建议失败:', error);
    }
  }, []);

  // 初始化数据
  useEffect(() => {
    fetchPerformanceMetrics();
    fetchSystemHealth();
    fetchAlerts();
    fetchRecommendations();
  }, [fetchPerformanceMetrics, fetchSystemHealth, fetchAlerts, fetchRecommendations]);

  // 实时数据更新
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      fetchPerformanceMetrics();
      fetchSystemHealth();
      fetchAlerts();
    }, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, [isRealTime, fetchPerformanceMetrics, fetchSystemHealth, fetchAlerts]);

  // 格式化时间
  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  // 格式化内存大小
  const formatMemorySize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }, []);

  // 获取状态颜色
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'unhealthy': return '#ef4444';
      default: return '#6b7280';
    }
  }, []);

  // 获取告警颜色
  const getAlertColor = useCallback((level: string) => {
    switch (level) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }, []);

  // 过滤告警
  const activeAlerts = useMemo(() =>
    alerts.filter(alert => !alert.resolved), [alerts]
  );

  // 准备图表数据
  const chartData = useMemo(() =>
    metrics.map(metric => ({
      time: formatTime(metric.timestamp),
      responseTime: metric.responseTime,
      memoryUsage: metric.memoryUsage,
      cpuUsage: metric.cpuUsage,
      cacheHitRate: metric.cacheHitRate,
      errorRate: metric.errorRate
    }))
  , [metrics, formatTime]);

  return (
    <div className="performance-dashboard p-6 bg-gray-50 min-h-screen">
      {/* 头部控制区 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">后端性能监控仪表板</h1>

          <div className="flex items-center space-x-4">
            {/* 实时模式切换 */}
            <button
              onClick={() => setIsRealTime(!isRealTime)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isRealTime
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isRealTime ? '实时监控' : '手动刷新'}
            </button>

            {/* 手动刷新 */}
            {!isRealTime && (
              <button
                onClick={() => {
                  fetchPerformanceMetrics();
                  fetchSystemHealth();
                  fetchAlerts();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                disabled={loading}
              >
                {loading ? '加载中...' : '刷新数据'}
              </button>
            )}

            {/* 缓存操作 */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => warmupCache()}
                className="px-3 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                预热缓存
              </button>
              <button
                onClick={() => clearCache('all')}
                className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                清理缓存
              </button>
            </div>
          </div>
        </div>

        {/* 系统健康状态 */}
        {systemHealth && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: getStatusColor(systemHealth.status) }}></div>
                <span className="font-medium text-gray-900">
                  系统状态: {systemHealth.status === 'healthy' ? '健康' : systemHealth.status === 'degraded' ? '降级' : '异常'}
                </span>
                <span className="text-sm text-gray-500">
                  运行时间: {Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m
                </span>
                <span className="text-sm text-gray-500">
                  活跃连接: {systemHealth.activeConnections}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>内存: {formatMemorySize(systemHealth.memoryUsage.heapUsed)}</span>
                <span>RSS: {formatMemorySize(systemHealth.memoryUsage.rss)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 告警区域 */}
      {activeAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">性能告警</h2>
          <div className="space-y-2">
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                style={{ borderLeft: `4px solid ${getAlertColor(alert.level)}` }}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: getAlertColor(alert.level) }}></div>
                  <span className="text-sm font-medium text-gray-900">{alert.message}</span>
                  <span className="text-xs text-gray-500">
                    {formatTime(alert.timestamp)}
                  </span>
                </div>
                <button
                  onClick={() => clearAlert(alert.id)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  标记已解决
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 性能指标图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 响应时间趋势 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">响应时间趋势</h3>
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
                stroke="#3b82f6"
                strokeWidth={2}
                name="响应时间 (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 内存使用趋势 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">内存使用趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="memoryUsage"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="内存使用 (MB)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 缓存命中率 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">缓存命中率</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cacheHitRate"
                stroke="#f59e0b"
                strokeWidth={2}
                name="缓存命中率 (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 错误率 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">错误率</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="errorRate"
                fill="#ef4444"
                name="错误率 (%)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 详细指标 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">详细性能指标</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.length > 0 && (
            <>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics[metrics.length - 1]?.responseTime.toFixed(2)} ms
                </div>
                <div className="text-sm text-gray-600">当前响应时间</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatMemorySize(metrics[metrics.length - 1]?.memoryUsage)}
                </div>
                <div className="text-sm text-gray-600">当前内存使用</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {metrics[metrics.length - 1]?.cacheHitRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">缓存命中率</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackendPerformanceDashboard;