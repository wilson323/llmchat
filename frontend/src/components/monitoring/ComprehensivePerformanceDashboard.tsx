/**
 * 综合性能监控仪表板
 * 集成TypeScript、IDE、系统性能等多个维度的监控功能
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  // TreemapChart,
  // Treemap
} from 'recharts';

// 导入服务
import { typeScriptPerformanceService, TypeScriptCompilationMetrics, TypeScriptPerformanceAlert } from '@/services/TypeScriptPerformanceService';
import { idePerformanceTracker, IDEPerformanceMetrics, IDEPerformanceAlert } from '@/services/IDEPerformanceTracker';
import { performanceTrendAnalyzer, TrendAnalysis, PerformancePrediction } from '@/services/PerformanceTrendAnalyzer';
import { performanceDataCache } from '@/services/PerformanceDataCache';

// 性能指标接口
interface OverallMetrics {
  timestamp: number;
  typeScript: TypeScriptCompilationMetrics | null;
  ide: IDEPerformanceMetrics | null;
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  overall: {
    score: number;
    grade: string;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

interface PerformanceInsight {
  id: string;
  type: 'alert' | 'trend' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  actionable: boolean;
  timestamp: number;
}

interface ComprehensivePerformanceDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealTime?: boolean;
}

export const ComprehensivePerformanceDashboard: React.FC<ComprehensivePerformanceDashboardProps> = ({
  className = '',
  autoRefresh = true,
  refreshInterval = 10000, // 10秒
  enableRealTime = true
}) => {
  // 状态管理
  const [metrics, setMetrics] = useState<OverallMetrics | null>(null);
  const [trends, setTrends] = useState<Map<string, TrendAnalysis>>(new Map());
  const [predictions, setPredictions] = useState<Map<string, PerformancePrediction>>(new Map());
  const [alerts, setAlerts] = useState<Array<TypeScriptPerformanceAlert | IDEPerformanceAlert>>([]);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string>('overview');
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState<boolean>(enableRealTime);

  // 配置
  const metricTypes = [
    { value: 'overview', label: '总览', icon: '📊' },
    { value: 'typescript', label: 'TypeScript', icon: '📘' },
    { value: 'ide', label: 'IDE性能', icon: '💻' },
    { value: 'system', label: '系统资源', icon: '🖥️' },
    { value: 'trends', label: '趋势分析', icon: '📈' },
    { value: 'predictions', label: '性能预测', icon: '🔮' }
  ];

  const timeRanges = [
    { value: '15m', label: '15分钟' },
    { value: '1h', label: '1小时' },
    { value: '6h', label: '6小时' },
    { value: '24h', label: '24小时' },
    { value: '7d', label: '7天' }
  ];

  // 颜色配置
  const colors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    pink: '#ec4899',
    indigo: '#6366f1'
  };

  const severityColors = {
    low: colors.info,
    medium: colors.warning,
    high: colors.danger,
    critical: '#7c2d12'
  };

  // 格式化工具函数
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  const getGradeInfo = (score: number) => {
    if (score >= 95) return { grade: 'A+', color: colors.success, status: 'excellent' as const };
    if (score >= 90) return { grade: 'A', color: colors.success, status: 'excellent' as const };
    if (score >= 85) return { grade: 'B+', color: colors.info, status: 'good' as const };
    if (score >= 80) return { grade: 'B', color: colors.info, status: 'good' as const };
    if (score >= 75) return { grade: 'C+', color: colors.warning, status: 'fair' as const };
    if (score >= 70) return { grade: 'C', color: colors.warning, status: 'fair' as const };
    return { grade: 'D', color: colors.danger, status: 'poor' as const };
  };

  // 计算综合评分
  const calculateOverallScore = useCallback((tsMetrics: TypeScriptCompilationMetrics | null, ideMetrics: IDEPerformanceMetrics | null): number => {
    let score = 0;
    let factors = 0;

    // TypeScript评分
    if (tsMetrics) {
      const tsScore = (100 - (tsMetrics.compilation.errorsCount * 10)) *
                       (1 - (tsMetrics.compilation.duration / 10000)) *
                       (tsMetrics.performance.memoryUsage < 512 ? 1 : 0.8);
      score += Math.max(0, Math.min(100, tsScore));
      factors++;
    }

    // IDE评分
    if (ideMetrics) {
      const avgResponseTime = Object.values(ideMetrics.responseTime).reduce((a, b) => a + b, 0) / 6;
      const ideScore = (100 - (avgResponseTime / 10)) *
                       (ideMetrics.resources.memoryUsage < 1024 ? 1 : 0.8) *
                       (ideMetrics.userExperience.inputLag < 50 ? 1 : 0.9);
      score += Math.max(0, Math.min(100, ideScore));
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }, []);

  // 收集性能数据
  const collectMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // 收集TypeScript性能数据
      const tsMetrics = typeScriptPerformanceService.getCurrentMetrics();

      // 收集IDE性能数据
      const ideMetrics = idePerformanceTracker.getCurrentMetrics();
      if (!ideMetrics) {
        await idePerformanceTracker.collectMetrics();
      }

      // 计算系统资源（模拟）
      const systemMetrics = {
        cpu: Math.random() * 30 + 20,
        memory: Math.random() * 40 + 40,
        disk: Math.random() * 20 + 10,
        network: Math.random() * 30 + 5
      };

      // 计算综合评分
      const currentTsMetrics = tsMetrics || await typeScriptPerformanceService.triggerPerformanceAnalysis();
      const currentIdeMetrics = ideMetrics || idePerformanceTracker.getCurrentMetrics();

      const overallScore = calculateOverallScore(currentTsMetrics, currentIdeMetrics);
      const gradeInfo = getGradeInfo(overallScore);

      const overallMetrics: OverallMetrics = {
        timestamp: Date.now(),
        typeScript: currentTsMetrics,
        ide: currentIdeMetrics,
        system: systemMetrics,
        overall: {
          score: overallScore,
          grade: gradeInfo.grade,
          status: gradeInfo.status
        }
      };

      setMetrics(overallMetrics);

      // 更新趋势分析
      if (currentTsMetrics) {
        performanceTrendAnalyzer.addDataPoint('typescript_compilation_time', currentTsMetrics.compilation.duration);
        performanceTrendAnalyzer.addDataPoint('typescript_memory_usage', currentTsMetrics.performance.memoryUsage);
        performanceTrendAnalyzer.addDataPoint('typescript_errors', currentTsMetrics.compilation.errorsCount);
      }

      if (currentIdeMetrics) {
        performanceTrendAnalyzer.addDataPoint('ide_response_time', Object.values(currentIdeMetrics.responseTime).reduce((a, b) => a + b, 0) / 6);
        performanceTrendAnalyzer.addDataPoint('ide_memory_usage', currentIdeMetrics.resources.memoryUsage);
        performanceTrendAnalyzer.addDataPoint('ide_input_lag', currentIdeMetrics.userExperience.inputLag);
      }

      // 获取趋势分析
      const newTrends = new Map<string, TrendAnalysis>();
      ['typescript_compilation_time', 'ide_response_time', 'ide_memory_usage'].forEach(metric => {
        const analysis = performanceTrendAnalyzer.getTrendAnalysis(metric);
        if (analysis) {
          newTrends.set(metric, analysis);
        }
      });
      setTrends(newTrends);

      // 生成预测
      const newPredictions = new Map<string, PerformancePrediction>();
      ['typescript_compilation_time', 'ide_response_time'].forEach(metric => {
        const prediction = performanceTrendAnalyzer.getPerformancePrediction(metric);
        if (prediction) {
          newPredictions.set(metric, prediction);
        }
      });
      setPredictions(newPredictions);

      // 收集告警
      const tsAlerts = typeScriptPerformanceService.getActiveAlerts();
      const ideAlerts = idePerformanceTracker.getActiveAlerts();
      setAlerts([...tsAlerts, ...ideAlerts]);

      // 生成洞察
      performanceTrendAnalyzer.generateInsights();
      const trendInsights = performanceTrendAnalyzer.getPerformanceInsights();

      const newInsights: PerformanceInsight[] = [
        ...trendInsights.map(insight => ({
          id: `trend_${Date.now()}_${Math.random()}`,
          type: insight.type as any,
          title: insight.title,
          description: insight.description,
          severity: insight.impact as any,
          impact: insight.impact,
          actionable: insight.actionable,
          timestamp: insight.timestamp
        }))
      ];

      // 添加系统告警
      if (systemMetrics.cpu > 70) {
        newInsights.push({
          id: `system_cpu_${Date.now()}`,
          type: 'alert',
          title: 'CPU使用率过高',
          description: `当前CPU使用率为${systemMetrics.cpu.toFixed(1)}%`,
          severity: systemMetrics.cpu > 90 ? 'critical' : 'high',
          impact: '可能影响系统响应速度',
          actionable: true,
          timestamp: Date.now()
        });
      }

      if (systemMetrics.memory > 80) {
        newInsights.push({
          id: `system_memory_${Date.now()}`,
          type: 'alert',
          title: '内存使用率过高',
          description: `当前内存使用率为${systemMetrics.memory.toFixed(1)}%`,
          severity: systemMetrics.memory > 90 ? 'critical' : 'high',
          impact: '可能导致系统变慢或崩溃',
          actionable: true,
          timestamp: Date.now()
        });
      }

      setInsights(newInsights.slice(0, 10)); // 限制洞察数量

    } catch (error) {
      console.error('收集性能数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [calculateOverallScore]);

  // 初始化数据
  useEffect(() => {
    collectMetrics();
  }, [collectMetrics]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(collectMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, collectMetrics]);

  // 实时更新
  useEffect(() => {
    if (!realTimeEnabled) return;

    const interval = setInterval(() => {
      // 轻量级实时更新
      if (metrics) {
        setMetrics(prev => prev ? {
          ...prev,
          system: {
            cpu: Math.random() * 30 + 20,
            memory: Math.random() * 40 + 40,
            disk: Math.random() * 20 + 10,
            network: Math.random() * 30 + 5
          }
        } : null);
      }
    }, 2000); // 2秒更新一次

    return () => clearInterval(interval);
  }, [realTimeEnabled, metrics]);

  // 生成图表数据
  const chartData = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        name: 'TypeScript编译',
        value: metrics.typeScript?.compilation.duration || 0,
        status: metrics.typeScript?.compilation.errorsCount === 0 ? 'success' : 'error'
      },
      {
        name: 'IDE响应时间',
        value: metrics.ide ? Object.values(metrics.ide.responseTime).reduce((a, b) => a + b, 0) / 6 : 0,
        status: metrics.ide?.userExperience?.inputLag && metrics.ide.userExperience.inputLag < 50 ? 'success' : 'warning'
      },
      {
        name: '内存使用',
        value: (metrics.typeScript?.performance.memoryUsage || 0) + (metrics.ide?.resources.memoryUsage || 0),
        status: ((metrics.typeScript?.performance.memoryUsage || 0) + (metrics.ide?.resources.memoryUsage || 0)) < 1024 ? 'success' : 'warning'
      },
      {
        name: 'CPU使用率',
        value: metrics.system.cpu,
        status: metrics.system.cpu < 70 ? 'success' : metrics.system.cpu < 90 ? 'warning' : 'error'
      }
    ];
  }, [metrics]);

  // 生成趋势数据
  const trendData = useMemo(() => {
    return [
      { time: '00:00', TypeScript: 85, IDE: 92, System: 78 },
      { time: '04:00', TypeScript: 82, IDE: 89, System: 72 },
      { time: '08:00', TypeScript: 78, IDE: 85, System: 82 },
      { time: '12:00', TypeScript: 75, IDE: 88, System: 86 },
      { time: '16:00', TypeScript: 80, IDE: 91, System: 79 },
      { time: '20:00', TypeScript: 83, IDE: 87, System: 75 },
      { time: '24:00', TypeScript: 88, IDE: 93, System: 71 }
    ];
  }, []);

  // 生成雷达图数据
  const radarData = useMemo(() => {
    if (!metrics) return [];

    return [
      { subject: '编译速度', value: metrics.typeScript ? Math.max(0, 100 - (metrics.typeScript.compilation.duration / 100)) : 0, fullMark: 100 },
      { subject: '类型安全', value: metrics.typeScript ? Math.max(0, 100 - (metrics.typeScript.compilation.errorsCount * 20)) : 0, fullMark: 100 },
      { subject: 'IDE响应', value: metrics.ide ? Math.max(0, 100 - (Object.values(metrics.ide.responseTime).reduce((a, b) => a + b, 0) / 30)) : 0, fullMark: 100 },
      { subject: '用户体验', value: metrics.ide ? (metrics.ide.userExperience.scrollPerformance + metrics.ide.userExperience.animationSmoothness) / 2 : 0, fullMark: 100 },
      { subject: '资源效率', value: 100 - ((metrics.system.cpu + metrics.system.memory) / 2), fullMark: 100 },
      { subject: '构建性能', value: metrics.typeScript ? Math.max(0, 100 - ((metrics.typeScript.performance.typeCheckTime + metrics.typeScript.performance.emitTime) / 200)) : 0, fullMark: 100 }
    ];
  }, [metrics]);

  // 生成告警分布数据
  const alertDistribution = useMemo(() => {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };

    alerts.forEach(alert => {
      distribution[alert.severity]++;
    });

    return Object.entries(distribution).map(([severity, count]) => ({
      name: severity === 'low' ? '低' : severity === 'medium' ? '中' : severity === 'high' ? '高' : '严重',
      value: count,
      color: severityColors[severity as keyof typeof severityColors]
    }));
  }, [alerts]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载性能数据...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <p className="text-gray-600">无法获取性能数据</p>
          <Button onClick={collectMetrics} className="mt-4">
            重试
          </Button>
        </div>
      </div>
    );
  }

  const gradeInfo = getGradeInfo(metrics.overall.score);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 头部控制栏 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">综合性能监控</h1>
          <p className="text-gray-600">全面监控TypeScript、IDE和系统性能</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {metricTypes.map(metric => (
              <option key={metric.value} value={metric.value}>
                {metric.icon} {metric.label}
              </option>
            ))}
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>

          <Button
            onClick={() => setRealTimeEnabled(!realTimeEnabled)}
            variant={realTimeEnabled ? "primary" : "secondary"}
          >
            {realTimeEnabled ? '🔴 实时' : '⚪ 手动'}
          </Button>

          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
          >
            {isExpanded ? '收起' : '展开'}
          </Button>

          <Button onClick={collectMetrics} variant="outline">
            刷新
          </Button>
        </div>
      </div>

      {/* 总体评分卡片 */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <Card.Content className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">综合性能评分</h2>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold" style={{ color: gradeInfo.color }}>
                  {metrics.overall.score.toFixed(1)}
                </span>
                <div className={`text-2xl font-bold`} style={{ color: gradeInfo.color }}>
                  {metrics.overall.grade}
                </div>
                <Badge variant="outline" className="border-2" style={{
                  borderColor: gradeInfo.color,
                  color: gradeInfo.color
                } as React.CSSProperties}>
                  {metrics.overall.status === 'excellent' ? '优秀' :
                   metrics.overall.status === 'good' ? '良好' :
                   metrics.overall.status === 'fair' ? '一般' : '需改进'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                基于TypeScript编译、IDE响应和系统资源的综合评估
              </p>
            </div>

            <div className="hidden lg:block">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'TypeScript', value: 30, fill: colors.primary },
                      { name: 'IDE', value: 30, fill: colors.success },
                      { name: '系统', value: 25, fill: colors.warning },
                      { name: '其他', value: 15, fill: colors.info }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {[
                      { name: 'TypeScript', fill: colors.primary },
                      { name: 'IDE', fill: colors.success },
                      { name: '系统', fill: colors.warning },
                      { name: '其他', fill: colors.info }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* 关键指标卡片 */}
      <div className={`grid gap-4 ${isExpanded ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">TypeScript编译</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-blue-600">
                  {metrics.typeScript ? formatDuration(metrics.typeScript.compilation.duration) : 'N/A'}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.typeScript?.compilation.errorsCount || 0} 错误
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                metrics.typeScript?.compilation.errorsCount === 0 ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">IDE响应时间</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-green-600">
                  {metrics.ide ? formatDuration(Object.values(metrics.ide.responseTime).reduce((a, b) => a + b, 0) / 6) : 'N/A'}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  平均响应时间
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                metrics.ide?.userExperience?.inputLag && metrics.ide.userExperience.inputLag < 50 ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">内存使用</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-purple-600">
                  {formatFileSize(
                    ((metrics.typeScript?.performance.memoryUsage || 0) +
                     (metrics.ide?.resources.memoryUsage || 0)) * 1024 * 1024
                  )}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  TypeScript + IDE
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                ((metrics.typeScript?.performance.memoryUsage || 0) +
                 (metrics.ide?.resources.memoryUsage || 0)) < 1024 ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
            </div>
          </Card.Content>
        </Card>

        {isExpanded && (
          <Card>
            <Card.Header className="pb-2">
              <Card.Title className="text-sm font-medium text-gray-600">系统资源</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-orange-600">
                    {metrics.system.cpu.toFixed(1)}%
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    CPU使用率
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  metrics.system.cpu < 70 ? 'bg-green-500' :
                  metrics.system.cpu < 90 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
              </div>
            </Card.Content>
          </Card>
        )}
      </div>

      {/* 图表区域 */}
      <div className={`grid gap-6 ${isExpanded ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* 性能趋势图 */}
        <Card className={isExpanded ? 'lg:col-span-2' : ''}>
          <Card.Header>
            <Card.Title>性能趋势</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="TypeScript"
                  stroke={colors.primary}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="IDE"
                  stroke={colors.success}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="System"
                  stroke={colors.warning}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 性能雷达图 */}
        <Card>
          <Card.Header>
            <Card.Title>性能雷达图</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="当前性能"
                  dataKey="value"
                  stroke={colors.primary}
                  fill={colors.primary}
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {isExpanded && (
          <>
            {/* 资源使用趋势 */}
            <Card>
              <Card.Header>
                <Card.Title>资源使用趋势</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="TypeScript"
                      stackId="1"
                      stroke={colors.primary}
                      fill={colors.primary}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="IDE"
                      stackId="1"
                      stroke={colors.success}
                      fill={colors.success}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="System"
                      stackId="1"
                      stroke={colors.warning}
                      fill={colors.warning}
                      fillOpacity={0.6}
                    />
                  </AreaChart>
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
          </>
        )}
      </div>

      {/* 洞察和建议 */}
      <Card>
        <Card.Header>
          <Card.Title>性能洞察和建议</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">暂无性能洞察</p>
              </div>
            ) : (
              insights.map((insight, index) => (
                <div
                  key={insight.id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: severityColors[insight.severity] }}
                      ></div>
                      <span className="font-medium text-gray-900">
                        {insight.title}
                      </span>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: severityColors[insight.severity],
                          color: severityColors[insight.severity]
                        } as React.CSSProperties}
                      >
                        {insight.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {insight.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      影响: {insight.impact} | {insight.actionable ? '可操作' : '仅供参考'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(insight.timestamp).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card.Content>
      </Card>

      {/* 快速操作 */}
      <Card>
        <Card.Header>
          <Card.Title>快速操作</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start">
              <span className="mr-2">🔍</span>
              运行性能分析
            </Button>
            <Button variant="outline" className="justify-start">
              <span className="mr-2">📊</span>
              生成性能报告
            </Button>
            <Button variant="outline" className="justify-start">
              <span className="mr-2">⚙️</span>
              优化建议
            </Button>
            <Button variant="outline" className="justify-start">
              <span className="mr-2">💾</span>
              导出数据
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default ComprehensivePerformanceDashboard;