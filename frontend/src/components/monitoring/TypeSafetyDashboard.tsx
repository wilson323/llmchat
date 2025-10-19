import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

// 导入服务
import { typeScriptPerformanceService } from '@/services/TypeScriptPerformanceService';
import { performanceTrendAnalyzer } from '@/services/PerformanceTrendAnalyzer';
import { performanceDataCache } from '@/services/PerformanceDataCache';
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
  ComposedChart
} from 'recharts';

interface TypeSafetyMetrics {
  timestamp: string;
  overall: number;
  typescript: {
    errors: number;
    warnings: number;
    passed: boolean;
    compileTime: number; // 编译时间(ms)
    typeCheckTime: number; // 类型检查时间(ms)
    filesCount: number; // 文件数量
    linesOfCode: number; // 代码行数
  };
  eslint: {
    errors: number;
    warnings: number;
    passed: boolean;
    fixTime: number; // 修复时间(ms)
  };
  coverage: {
    percentage: number;
    passed: boolean;
    coveredLines: number; // 覆盖的行数
    totalLines: number; // 总行数
  };
  regression: {
    passed: boolean;
    changes: number;
    breakingChanges: number; // 破坏性变更
  };
  performance: {
    ideResponseTime: number; // IDE响应时间(ms)
    memoryUsage: number; // 内存使用(MB)
    buildTime: number; // 构建时间(ms)
    bundleSize: number; // 包大小(KB)
  };
}

interface TypeSafetyTrend {
  date: string;
  coverage: number;
  errors: number;
  score: number;
  compileTime: number;
  buildTime: number;
  ideResponseTime: number;
  memoryUsage: number;
}

interface TypeSafetyViolation {
  type: string;
  file: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  environment: string;
}

interface TypeSafetyDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const TypeSafetyDashboard: React.FC<TypeSafetyDashboardProps> = ({
  className = '',
  autoRefresh = true,
  refreshInterval = 30000 // 30秒
}) => {
  const [metrics, setMetrics] = useState<TypeSafetyMetrics | null>(null);
  const [trends, setTrends] = useState<TypeSafetyTrend[]>([]);
  const [violations, setViolations] = useState<TypeSafetyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('7d');
  const [selectedMetric, setSelectedMetric] = useState<string>('overview');
  const [realTimeMode, setRealTimeMode] = useState<boolean>(false);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // 环境配置
  const environments = [
    { value: 'all', label: '全部环境' },
    { value: 'development', label: 'Development' },
    { value: 'staging', label: 'Staging' },
    { value: 'production', label: 'Production' }
  ];

  // 时间范围配置
  const timeRanges = [
    { value: '1d', label: '1天' },
    { value: '7d', label: '7天' },
    { value: '30d', label: '30天' },
    { value: '90d', label: '90天' }
  ];

  // 指标类型配置
  const metricTypes = [
    { value: 'overview', label: '总览', icon: '📊' },
    { value: 'typescript', label: 'TypeScript', icon: '📘' },
    { value: 'eslint', label: 'ESLint', icon: '🔍' },
    { value: 'coverage', label: '覆盖率', icon: '📈' },
    { value: 'performance', label: '性能', icon: '⚡' },
    { value: 'regression', label: '回归', icon: '🔄' }
  ];

  // 颜色配置
  const severityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6'
  };

  const statusColors = {
    passed: '#10b981',
    failed: '#ef4444',
    warning: '#f59e0b'
  };

  // 获取类型安全指标
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // 尝试从缓存获取数据
      const cacheKey = `typesafety_metrics_${selectedEnvironment}_${selectedTimeRange}`;
      const cachedData = await performanceDataCache.get<TypeSafetyMetrics>(cacheKey);

      if (cachedData) {
        setMetrics(cachedData);
        console.log('从缓存加载类型安全数据');
      }

      // 从TypeScript性能服务获取最新数据
      const tsMetrics = typeScriptPerformanceService.getCurrentMetrics();

      if (tsMetrics) {
        const enhancedMetrics: TypeSafetyMetrics = {
          timestamp: new Date(tsMetrics.timestamp).toISOString(),
          overall: calculateOverallScore(tsMetrics),
          typescript: {
            errors: tsMetrics.compilation.errorsCount,
            warnings: tsMetrics.compilation.warningsCount,
            passed: tsMetrics.compilation.errorsCount === 0,
            compileTime: tsMetrics.compilation.duration,
            typeCheckTime: tsMetrics.performance.typeCheckTime,
            filesCount: tsMetrics.compilation.filesCount,
            linesOfCode: tsMetrics.compilation.linesOfCode
          },
          eslint: {
            errors: 0, // 可以从其他服务获取
            warnings: 5,
            passed: true,
            fixTime: 820
          },
          coverage: {
            percentage: 89, // 可以从覆盖率服务获取
            passed: false,
            coveredLines: Math.floor(tsMetrics.compilation.linesOfCode * 0.89),
            totalLines: tsMetrics.compilation.linesOfCode
          },
          regression: {
            passed: true,
            changes: 3,
            breakingChanges: 0
          },
          performance: {
            ideResponseTime: 125,
            memoryUsage: tsMetrics.performance.memoryUsage,
            buildTime: tsMetrics.build.totalTime,
            bundleSize: tsMetrics.build.bundleSize
          }
        };

        setMetrics(enhancedMetrics);

        // 缓存数据
        await performanceDataCache.set(cacheKey, enhancedMetrics, 60000, ['typesafety', 'metrics'], {
          environment: selectedEnvironment,
          timeRange: selectedTimeRange
        });

        // 添加到趋势分析器
        performanceTrendAnalyzer.addDataPoint('typescript_overall_score', enhancedMetrics.overall);
        performanceTrendAnalyzer.addDataPoint('typescript_compile_time', enhancedMetrics.typescript.compileTime);
        performanceTrendAnalyzer.addDataPoint('typescript_memory_usage', enhancedMetrics.performance.memoryUsage);
        performanceTrendAnalyzer.addDataPoint('typescript_build_time', enhancedMetrics.performance.buildTime);

        console.log('从TypeScript性能服务获取数据');
      }

      // 如果没有实时数据，使用模拟数据
      if (!tsMetrics) {
        const mockMetrics: TypeSafetyMetrics = {
          timestamp: new Date().toISOString(),
          overall: 92,
          typescript: {
            errors: 0,
            warnings: 2,
            passed: true,
            compileTime: 2450,
            typeCheckTime: 1850,
            filesCount: 156,
            linesOfCode: 12580
          },
          eslint: {
            errors: 0,
            warnings: 5,
            passed: true,
            fixTime: 820
          },
          coverage: {
            percentage: 89,
            passed: false,
            coveredLines: 11200,
            totalLines: 12580
          },
          regression: {
            passed: true,
            changes: 3,
            breakingChanges: 0
          },
          performance: {
            ideResponseTime: 125,
            memoryUsage: 256,
            buildTime: 8900,
            bundleSize: 1024
          }
        };

        setMetrics(mockMetrics);

        // 添加模拟数据到趋势分析器
        performanceTrendAnalyzer.addDataPoint('typescript_overall_score', mockMetrics.overall);
        performanceTrendAnalyzer.addDataPoint('typescript_compile_time', mockMetrics.typescript.compileTime);
      }

      // 获取趋势数据
      const trendAnalysis = performanceTrendAnalyzer.getTrendAnalysis('typescript_overall_score');
      if (trendAnalysis) {
        const enhancedTrends: TypeSafetyTrend[] = [];

        // 生成趋势数据
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);

          enhancedTrends.push({
            date: date.toISOString().split('T')[0],
            coverage: 85 + Math.random() * 5,
            errors: Math.floor(Math.random() * 3),
            score: 82 + Math.random() * 10,
            compileTime: 2400 + Math.random() * 800,
            buildTime: 8900 + Math.random() * 3500,
            ideResponseTime: 120 + Math.random() * 60,
            memoryUsage: 250 + Math.random() * 70
          });
        }

        setTrends(enhancedTrends);
      }

      // 获取违规项（从TypeScript服务）
      const tsAlerts = typeScriptPerformanceService.getActiveAlerts();
      const enhancedViolations: TypeSafetyViolation[] = tsAlerts.map(alert => ({
        type: alert.type,
        file: alert.title,
        message: alert.message,
        severity: alert.severity as 'critical' | 'high' | 'medium' | 'low',
        environment: 'development'
      }));

      // 添加一些模拟违规项
      if (enhancedViolations.length === 0) {
        enhancedViolations.push(
          {
            type: 'coverage_error',
            file: 'src/components/chat/MessageItem.tsx',
            message: '类型覆盖率低于阈值',
            severity: 'high',
            environment: 'production'
          },
          {
            type: 'eslint_warning',
            file: 'src/hooks/useOptimizedChat.ts',
            message: '未使用的变量',
            severity: 'medium',
            environment: 'development'
          }
        );
      }

      setViolations(enhancedViolations);

    } catch (error) {
      console.error('获取类型安全指标失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, selectedTimeRange]);

  // 计算综合评分
  const calculateOverallScore = (tsMetrics: any): number => {
    if (!tsMetrics) return 0;

    let score = 100;

    // 根据错误数扣分
    score -= tsMetrics.compilation.errorsCount * 10;

    // 根据警告数扣分
    score -= tsMetrics.compilation.warningsCount * 2;

    // 根据编译时间扣分
    score -= Math.min(20, (tsMetrics.compilation.duration / 1000) * 2);

    // 根据内存使用扣分
    if (tsMetrics.performance.memoryUsage > 512) {
      score -= (tsMetrics.performance.memoryUsage - 512) / 50;
    }

    return Math.max(0, Math.min(100, score));
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchMetrics();
  };

  // 订阅TypeScript性能服务
  const subscribeToServices = useCallback(() => {
    if (realTimeMode) {
      typeScriptPerformanceService.subscribe(
        'type-safety-dashboard',
        (metrics) => {
          // 实时更新数据
          console.log('收到TypeScript性能更新:', metrics);
          fetchMetrics();
        },
        (alert) => {
          console.log('收到TypeScript性能告警:', alert);
          // 可以添加告警通知逻辑
        },
        (trend) => {
          console.log('收到TypeScript性能趋势:', trend);
          // 可以更新趋势图表
        }
      );
    }
  }, [realTimeMode, fetchMetrics]);

  // 获取状态徽章
  const getStatusBadge = (passed: boolean, warnings = 0) => {
    if (!passed) {
      return <Badge variant="destructive">失败</Badge>;
    }
    if (warnings > 0) {
      return <Badge variant="secondary">警告</Badge>;
    }
    return <Badge variant="default">通过</Badge>;
  };

  // 获取严重程度徽章
  const getSeverityBadge = (severity: string) => {
    const color = severityColors[severity as keyof typeof severityColors];
    return (
      <Badge
        variant="outline"
        style={{
          borderColor: color,
          color: color,
          fontWeight: 'bold'
        }}
      >
        {severity.toUpperCase()}
      </Badge>
    );
  };

  // 格式化时间
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // 格式化文件大小
  const formatFileSize = (kb: number): string => {
    if (kb < 1024) return `${kb}KB`;
    return `${(kb / 1024).toFixed(2)}MB`;
  };

  // 格式化内存大小
  const formatMemory = (mb: number): string => {
    if (mb < 1024) return `${mb}MB`;
    return `${(mb / 1024).toFixed(2)}GB`;
  };

  // 获取性能等级
  const getPerformanceGrade = (score: number): { grade: string; color: string } => {
    if (score >= 95) return { grade: 'A+', color: '#10b981' };
    if (score >= 90) return { grade: 'A', color: '#22c55e' };
    if (score >= 85) return { grade: 'B+', color: '#84cc16' };
    if (score >= 80) return { grade: 'B', color: '#eab308' };
    if (score >= 75) return { grade: 'C+', color: '#f59e0b' };
    if (score >= 70) return { grade: 'C', color: '#f97316' };
    return { grade: 'D', color: '#ef4444' };
  };

  // 计算性能指标趋势
  const calculateTrend = (data: number[]): { trend: 'up' | 'down' | 'stable'; percentage: number } => {
    if (data.length < 2) return { trend: 'stable', percentage: 0 };

    const recent = data.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, data.length);
    const previous = data.slice(-6, -3).reduce((a, b) => a + b, 0) / Math.min(3, data.length);

    if (previous === 0) return { trend: 'stable', percentage: 0 };

    const percentage = ((recent - previous) / previous) * 100;
    const trend = percentage > 2 ? 'up' : percentage < -2 ? 'down' : 'stable';

    return { trend, percentage: Math.abs(percentage) };
  };

  // 计算违规项统计
  const getViolationStats = () => {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    violations.forEach(violation => {
      stats[violation.severity as keyof typeof stats]++;
    });

    return Object.entries(stats).map(([severity, count]) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: count,
      color: severityColors[severity as keyof typeof severityColors]
    }));
  };

  // 过滤违规项
  const filteredViolations = violations.filter(violation => {
    if (selectedEnvironment !== 'all' && violation.environment !== selectedEnvironment) {
      return false;
    }
    return true;
  });

  // 组件挂载时获取数据
  useEffect(() => {
    fetchMetrics();
    subscribeToServices();
  }, [fetchMetrics, subscribeToServices]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMetrics]);

  // 订阅服务状态变化
  useEffect(() => {
    subscribeToServices();
  }, [realTimeMode, subscribeToServices]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载类型安全数据...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <p className="text-gray-600">无法获取类型安全数据</p>
          <Button onClick={handleRefresh} className="mt-4">
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 头部控制栏 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">类型安全监控</h2>
          <p className="text-gray-600">实时监控前端项目的类型安全状态和性能指标</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
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
            value={selectedEnvironment}
            onChange={(e) => setSelectedEnvironment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {environments.map(env => (
              <option key={env.value} value={env.value}>{env.label}</option>
            ))}
          </select>

          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>

          <Button
            onClick={() => setRealTimeMode(!realTimeMode)}
            variant={realTimeMode ? "primary" : "secondary"}
          >
            {realTimeMode ? '🔴 实时' : '⚪ 手动'}
          </Button>

          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
          >
            {isExpanded ? '收起' : '展开'}
          </Button>

          <Button onClick={handleRefresh} variant="outline">
            刷新
          </Button>
        </div>
      </div>

      {/* 总体指标卡片 */}
      <div className={`grid gap-6 ${isExpanded ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">总体评分</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-gray-900">{metrics.overall}</span>
                <div className={`text-sm font-bold mt-1`} style={{ color: getPerformanceGrade(metrics.overall).color }}>
                  {getPerformanceGrade(metrics.overall).grade}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${
                metrics.overall >= 90 ? 'bg-green-500' :
                metrics.overall >= 80 ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.overall >= 90 ? '优秀' : metrics.overall >= 80 ? '良好' : '需改进'}
            </p>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">TypeScript</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {metrics.typescript.errors}
                </span>
                <span className="text-sm text-gray-500 ml-1">错误</span>
              </div>
              {getStatusBadge(metrics.typescript.passed)}
            </div>
            {metrics.typescript.warnings > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {metrics.typescript.warnings} 警告
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              编译: {formatDuration(metrics.typescript.compileTime)}
            </p>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">ESLint</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {metrics.eslint.errors}
                </span>
                <span className="text-sm text-gray-500 ml-1">错误</span>
              </div>
              {getStatusBadge(metrics.eslint.passed, metrics.eslint.warnings)}
            </div>
            {metrics.eslint.warnings > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {metrics.eslint.warnings} 警告
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              修复: {formatDuration(metrics.eslint.fixTime)}
            </p>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="pb-2">
            <Card.Title className="text-sm font-medium text-gray-600">类型覆盖率</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">
                {metrics.coverage.percentage}%
              </span>
              {getStatusBadge(metrics.coverage.passed)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.coverage.coveredLines}/{metrics.coverage.totalLines} 行
            </p>
            <p className="text-xs text-gray-500 mt-1">
              目标: ≥90%
            </p>
          </Card.Content>
        </Card>

        {isExpanded && (
          <>
            <Card>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium text-gray-600">编译性能</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">
                    {formatDuration(metrics.performance.buildTime)}
                  </span>
                  <div className={`text-xs font-medium ${
                    metrics.performance.buildTime < 10000 ? 'text-green-600' :
                    metrics.performance.buildTime < 20000 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.performance.buildTime < 10000 ? '优秀' :
                     metrics.performance.buildTime < 20000 ? '良好' : '需优化'}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  构建时间
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  包大小: {formatFileSize(metrics.performance.bundleSize)}
                </p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium text-gray-600">IDE响应</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-green-600">
                    {metrics.performance.ideResponseTime}ms
                  </span>
                  <div className={`text-xs font-medium ${
                    metrics.performance.ideResponseTime < 100 ? 'text-green-600' :
                    metrics.performance.ideResponseTime < 200 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.performance.ideResponseTime < 100 ? '流畅' :
                     metrics.performance.ideResponseTime < 200 ? '一般' : '卡顿'}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  响应时间
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  内存: {formatMemory(metrics.performance.memoryUsage)}
                </p>
              </Card.Content>
            </Card>
          </>
        )}
      </div>

      {/* 图表区域 */}
      <div className={`grid gap-6 ${isExpanded ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {/* 趋势图 */}
        <Card className={isExpanded ? 'lg:col-span-2' : ''}>
          <Card.Header>
            <Card.Title>类型安全与性能趋势</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="coverage"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="覆盖率 (%)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="评分"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="compileTime"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="编译时间 (ms)"
                  strokeDasharray="5 5"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ideResponseTime"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="IDE响应 (ms)"
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 违规项分布 */}
        <Card>
          <Card.Header>
            <Card.Title>违规项分布</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getViolationStats()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {getViolationStats().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-4">
              {getViolationStats().map((stat) => (
                <div key={stat.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    {stat.name}: {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>

        {isExpanded && (
          <>
            {/* 性能雷达图 */}
            <Card>
              <Card.Header>
                <Card.Title>性能雷达图</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={trends.slice(-1)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="当前状态"
                      dataKey="value"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </Card.Content>
            </Card>

            {/* 构建和内存趋势 */}
            <Card>
              <Card.Header>
                <Card.Title>构建与内存趋势</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="buildTime"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                      name="构建时间 (s)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="memoryUsage"
                      stroke="#06b6d4"
                      fill="#06b6d4"
                      fillOpacity={0.3}
                      name="内存使用 (MB)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card.Content>
            </Card>

            {/* 性能指标对比 */}
            <Card>
              <Card.Header>
                <Card.Title>性能指标对比</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: '编译时间', value: metrics.typescript.compileTime, max: 5000, unit: 'ms' },
                    { name: '类型检查', value: metrics.typescript.typeCheckTime, max: 3000, unit: 'ms' },
                    { name: 'IDE响应', value: metrics.performance.ideResponseTime, max: 200, unit: 'ms' },
                    { name: '构建时间', value: metrics.performance.buildTime, max: 15000, unit: 'ms' },
                    { name: 'ESLint修复', value: metrics.eslint.fixTime, max: 2000, unit: 'ms' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `${formatDuration(value)}`,
                        props.payload.unit
                      ]}
                    />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Content>
            </Card>
          </>
        )}
      </div>

      {/* 违规项详情 */}
      <Card>
        <Card.Header>
          <Card.Title>违规项详情</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            {filteredViolations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">暂无违规项</p>
              </div>
            ) : (
              filteredViolations.map((violation, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getSeverityBadge(violation.severity)}
                      <span className="text-sm font-medium text-gray-900">
                        {violation.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {violation.environment}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {violation.message}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {violation.file}
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-4">
                    <Button variant="outline" size="sm">
                      查看详情
                    </Button>
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
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => typeScriptPerformanceService.triggerPerformanceAnalysis()}
            >
              <span className="mr-2">🔍</span>
              运行性能分析
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={async () => {
                const recommendations = await typeScriptPerformanceService.getOptimizationRecommendations();
                console.log('优化建议:', recommendations);
                // 可以显示建议的UI
              }}
            >
              <span className="mr-2">💡</span>
              优化建议
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                const data = performanceDataCache.exportData();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `typesafety-metrics-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <span className="mr-2">📤</span>
              导出数据
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                performanceDataCache.clear();
                fetchMetrics();
              }}
            >
              <span className="mr-2">🗑️</span>
              清除缓存
            </Button>
          </div>

          {isExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  performanceTrendAnalyzer.generateInsights();
                  // 可以显示洞察的UI
                }}
              >
                <span className="mr-2">🧠</span>
                生成洞察
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={async () => {
                  await performanceDataCache.syncToCloud();
                  // 可以显示同步状态
                }}
              >
                <span className="mr-2">☁️</span>
                同步到云端
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  // 可以打开设置面板
                  console.log('打开设置面板');
                }}
              >
                <span className="mr-2">⚙️</span>
                设置
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  // 可以显示帮助信息
                  console.log('显示帮助信息');
                }}
              >
                <span className="mr-2">❓</span>
                帮助
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default TypeSafetyDashboard;