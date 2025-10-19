/**
 * 类型安全监控仪表板
 * 提供实时类型安全状态监控和可视化展示
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { format } from 'date-fns';

// 类型定义
interface DashboardData {
  summary: TypeSafetySummary;
  trends: TrendData[];
  violations: ViolationData[];
  metrics: MetricsData;
  recommendations: Recommendation[];
}

interface TypeSafetySummary {
  overallScore: number;
  grade: string;
  passedChecks: number;
  totalChecks: number;
  lastUpdated: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

interface TrendData {
  date: string;
  score: number;
  coverage: number;
  errors: number;
  warnings: number;
}

interface ViolationData {
  category: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface MetricsData {
  compilationErrors: number;
  lintErrors: number;
  lintWarnings: number;
  typeCoverage: number;
  anyTypeUsage: number;
  typeComplexity: number;
  consistencyScore: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  estimatedEffort: string;
}

interface DashboardProps {
  data?: DashboardData;
  refreshInterval?: number;
  onRefresh?: () => void;
}

/**
 * 类型安全仪表板组件
 */
export const TypeSafetyDashboard: React.FC<DashboardProps> = ({
  data: initialData,
  refreshInterval = 30000, // 30秒刷新
  onRefresh
}) => {
  const [data, setData] = useState<DashboardData | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'violations' | 'metrics'>('overview');

  // 颜色配置
  const colors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#8b5cf6',
    gray: '#6b7280'
  };

  const severityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626'
  };

  const statusColors = {
    excellent: '#10b981',
    good: '#3b82f6',
    warning: '#f59e0b',
    critical: '#ef4444'
  };

  // 模拟数据获取
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 这里应该调用实际的API获取数据
      // 为演示目的，使用模拟数据
      const mockData: DashboardData = await generateMockData();
      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据获取失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成模拟数据
  const generateMockData = async (): Promise<DashboardData> => {
    // 生成趋势数据
    const trends: TrendData[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: format(date, 'yyyy-MM-dd'),
        score: Math.max(60, Math.min(100, 85 + Math.random() * 15 - Math.random() * 10)),
        coverage: Math.max(50, Math.min(95, 70 + Math.random() * 25)),
        errors: Math.floor(Math.random() * 5),
        warnings: Math.floor(Math.random() * 20)
      });
    }

    // 生成违规数据
    const violations: ViolationData[] = [
      {
        category: 'TypeScript编译错误',
        count: Math.floor(Math.random() * 3),
        severity: 'critical',
        description: '类型不匹配、缺少类型声明等'
      },
      {
        category: 'ESLint类型规则',
        count: Math.floor(Math.random() * 10),
        severity: 'high',
        description: 'any类型使用、类型安全违规等'
      },
      {
        category: '类型覆盖率不足',
        count: Math.floor(Math.random() * 5),
        severity: 'medium',
        description: '类型定义覆盖率低于要求'
      },
      {
        category: '类型一致性',
        count: Math.floor(Math.random() * 8),
        severity: 'low',
        description: '类型定义风格不一致'
      }
    ];

    // 生成指标数据
    const metrics: MetricsData = {
      compilationErrors: Math.floor(Math.random() * 3),
      lintErrors: Math.floor(Math.random() * 10),
      lintWarnings: Math.floor(Math.random() * 25),
      typeCoverage: Math.max(50, Math.min(95, 70 + Math.random() * 25)),
      anyTypeUsage: Math.floor(Math.random() * 15),
      typeComplexity: Math.floor(Math.random() * 20),
      consistencyScore: Math.max(60, Math.min(100, 75 + Math.random() * 25))
    };

    // 计算总体评分
    const compilationScore = metrics.compilationErrors === 0 ? 30 : 0;
    const lintingScore = Math.max(0, 25 - metrics.lintErrors * 2.5);
    const coverageScore = (metrics.typeCoverage / 100) * 25;
    const consistencyScore = (metrics.consistencyScore / 100) * 20;
    const overallScore = Math.round(compilationScore + lintingScore + coverageScore + consistencyScore);

    let status: TypeSafetySummary['status'];
    if (overallScore >= 90) status = 'excellent';
    else if (overallScore >= 80) status = 'good';
    else if (overallScore >= 70) status = 'warning';
    else status = 'critical';

    const summary: TypeSafetySummary = {
      overallScore,
      grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : 'D',
      passedChecks: 4 - (metrics.compilationErrors > 0 ? 1 : 0) - (metrics.lintErrors > 0 ? 1 : 0),
      totalChecks: 4,
      lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      status
    };

    // 生成改进建议
    const recommendations: Recommendation[] = [];

    if (metrics.compilationErrors > 0) {
      recommendations.push({
        id: 'fix-compile-errors',
        title: '修复TypeScript编译错误',
        description: `发现 ${metrics.compilationErrors} 个编译错误，需要优先修复`,
        priority: 'critical',
        category: '编译问题',
        estimatedEffort: `${metrics.compilationErrors * 2}小时`
      });
    }

    if (metrics.typeCoverage < 70) {
      recommendations.push({
        id: 'improve-coverage',
        title: '提高类型覆盖率',
        description: `当前类型覆盖率为 ${metrics.typeCoverage}%，建议提高到70%以上`,
        priority: 'high',
        category: '类型覆盖',
        estimatedEffort: `${Math.ceil((70 - metrics.typeCoverage) * 0.5)}小时`
      });
    }

    if (metrics.anyTypeUsage > 5) {
      recommendations.push({
        id: 'reduce-any-usage',
        title: '减少any类型使用',
        description: `发现 ${metrics.anyTypeUsage} 处any类型使用，建议替换为具体类型`,
        priority: 'medium',
        category: '类型安全',
        estimatedEffort: `${Math.ceil(metrics.anyTypeUsage * 0.3)}小时`
      });
    }

    return {
      summary,
      trends,
      violations,
      metrics,
      recommendations
    };
  };

  // 初始化数据获取
  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [initialData]);

  // 自动刷新
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData();
        onRefresh?.();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, onRefresh]);

  // 刷新数据
  const handleRefresh = () => {
    fetchData();
    onRefresh?.();
  };

  // 手动刷新
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载类型安全数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-lg font-semibold mb-2">加载失败</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">暂无数据</p>
      </div>
    );
  }

  // 概览标签页
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* 总体状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总体评分</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.overallScore}/100</p>
              <p className="text-sm text-gray-500">等级: {data.summary.grade}</p>
            </div>
            <div className="text-3xl" style={{ color: statusColors[data.summary.status] }}>
              {data.summary.status === 'excellent' && '🟢'}
              {data.summary.status === 'good' && '🔵'}
              {data.summary.status === 'warning' && '🟡'}
              {data.summary.status === 'critical' && '🔴'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">检查通过率</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.summary.passedChecks}/{data.summary.totalChecks}
          </p>
          <p className="text-sm text-gray-500">
            {Math.round((data.summary.passedChecks / data.summary.totalChecks) * 100)}%
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">类型覆盖率</p>
          <p className="text-2xl font-bold text-gray-900">{data.metrics.typeCoverage}%</p>
          <p className="text-sm text-gray-500">目标: 85%</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">最后更新</p>
          <p className="text-lg font-semibold text-gray-900">
            {new Date(data.summary.lastUpdated).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-500">
            {new Date(data.summary.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* 指标雷达图 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">类型安全指标</h3>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={[
            {
              subject: '编译检查',
              value: data.metrics.compilationErrors === 0 ? 100 : 0,
              fullMark: 100
            },
            {
              subject: 'ESLint检查',
              value: Math.max(0, 100 - data.metrics.lintErrors * 10),
              fullMark: 100
            },
            {
              subject: '类型覆盖',
              value: data.metrics.typeCoverage,
              fullMark: 100
            },
            {
              subject: '类型安全',
              value: Math.max(0, 100 - data.metrics.anyTypeUsage * 5),
              fullMark: 100
            },
            {
              subject: '一致性',
              value: data.metrics.consistencyScore,
              fullMark: 100
            }
          ]}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar
              name="当前状态"
              dataKey="value"
              stroke={colors.primary}
              fill={colors.primary}
              fillOpacity={0.6}
            />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 改进建议 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">改进建议</h3>
        <div className="space-y-3">
          {data.recommendations.map(rec => (
            <div
              key={rec.id}
              className="border rounded-lg p-4 border-l-4"
              style={{ borderLeftColor: severityColors[rec.priority] }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="text-xs text-gray-500">类别: {rec.category}</span>
                    <span className="text-xs text-gray-500">预计工时: {rec.estimatedEffort}</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full text-white`}
                  style={{ backgroundColor: severityColors[rec.priority] }}
                >
                  {rec.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 趋势标签页
  const TrendsTab = () => (
    <div className="space-y-6">
      {/* 时间范围选择 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">时间范围</h3>
          <div className="flex space-x-2">
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setSelectedTimeRange(range)}
                className={`px-4 py-2 rounded ${
                  selectedTimeRange === range
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '7d' ? '7天' : range === '30d' ? '30天' : '90天'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 评分趋势图 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">评分趋势</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[60, 100]} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="score"
              stroke={colors.primary}
              name="总体评分"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 覆盖率和错误趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">类型覆盖率趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[50, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="coverage"
                stroke={colors.success}
                name="覆盖率"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">错误趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="errors"
                stroke={colors.danger}
                name="错误数"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="warnings"
                stroke={colors.warning}
                name="警告数"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  // 违规标签页
  const ViolationsTab = () => (
    <div className="space-y-6">
      {/* 违规统计饼图 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">违规分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.violations}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, count }) => `${category}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.violations.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={severityColors[entry.severity]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">严重程度分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              {
                severity: 'Critical',
                count: data.violations.filter(v => v.severity === 'critical').reduce((sum, v) => sum + v.count, 0),
                fill: severityColors.critical
              },
              {
                severity: 'High',
                count: data.violations.filter(v => v.severity === 'high').reduce((sum, v) => sum + v.count, 0),
                fill: severityColors.high
              },
              {
                severity: 'Medium',
                count: data.violations.filter(v => v.severity === 'medium').reduce((sum, v) => sum + v.count, 0),
                fill: severityColors.medium
              },
              {
                severity: 'Low',
                count: data.violations.filter(v => v.severity === 'low').reduce((sum, v) => sum + v.count, 0),
                fill: severityColors.low
              }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="severity" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 违规详情列表 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">违规详情</h3>
        <div className="space-y-3">
          {data.violations.map((violation, index) => (
            <div
              key={index}
              className="border rounded-lg p-4"
              style={{ borderLeftColor: severityColors[violation.severity], borderLeftWidth: '4px' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{violation.category}</h4>
                  <p className="text-sm text-gray-600 mt-1">{violation.description}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full text-white`}
                    style={{ backgroundColor: severityColors[violation.severity] }}
                  >
                    {violation.severity}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">{violation.count} 项</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 指标标签页
  const MetricsTab = () => (
    <div className="space-y-6">
      {/* 详细指标网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">编译错误</p>
          <p className={`text-2xl font-bold ${
            data.metrics.compilationErrors === 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {data.metrics.compilationErrors}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.metrics.compilationErrors === 0 ? '无错误' : '需要修复'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">ESLint错误</p>
          <p className={`text-2xl font-bold ${
            data.metrics.lintErrors === 0 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {data.metrics.lintErrors}
          </p>
          <p className="text-xs text-gray-500 mt-1">类型规则违规</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">ESLint警告</p>
          <p className="text-2xl font-bold text-yellow-600">
            {data.metrics.lintWarnings}
          </p>
          <p className="text-xs text-gray-500 mt-1">建议处理</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">any类型使用</p>
          <p className={`text-2xl font-bold ${
            data.metrics.anyTypeUsage <= 5 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {data.metrics.anyTypeUsage}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.metrics.anyTypeUsage <= 5 ? '使用合理' : '建议减少'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">类型复杂度</p>
          <p className={`text-2xl font-bold ${
            data.metrics.typeComplexity <= 10 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {data.metrics.typeComplexity}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.metrics.typeComplexity <= 10 ? '简单' : '复杂'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">一致性评分</p>
          <p className={`text-2xl font-bold ${
            data.metrics.consistencyScore >= 80 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {data.metrics.consistencyScore}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.metrics.consistencyScore >= 80 ? '良好' : '需改进'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">类型覆盖率</p>
          <p className={`text-2xl font-bold ${
            data.metrics.typeCoverage >= 70 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {data.metrics.typeCoverage}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            目标: 85%
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">总体状态</p>
          <div className="flex items-center mt-2">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: statusColors[data.summary.status] }}
            ></div>
            <p className="text-lg font-semibold capitalize">{data.summary.status}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            评分: {data.summary.overallScore}/100
          </p>
        </div>
      </div>

      {/* 指标对比 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">指标达标情况</h3>
        <div className="space-y-4">
          {[
            {
              name: 'TypeScript编译',
              current: data.metrics.compilationErrors === 0 ? 100 : 0,
              target: 100,
              status: data.metrics.compilationErrors === 0 ? 'success' : 'error'
            },
            {
              name: 'ESLint检查',
              current: Math.max(0, 100 - data.metrics.lintErrors * 10),
              target: 90,
              status: data.metrics.lintErrors === 0 ? 'success' : 'warning'
            },
            {
              name: '类型覆盖率',
              current: data.metrics.typeCoverage,
              target: 85,
              status: data.metrics.typeCoverage >= 70 ? 'success' : 'error'
            },
            {
              name: '类型安全',
              current: Math.max(0, 100 - data.metrics.anyTypeUsage * 5),
              target: 90,
              status: data.metrics.anyTypeUsage <= 5 ? 'success' : 'warning'
            }
          ].map((metric, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-32 text-sm font-medium text-gray-700">{metric.name}</div>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metric.status === 'success' ? 'bg-green-500' :
                      metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, metric.current)}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-sm text-gray-600 w-16 text-right">
                {metric.current}% / {metric.target}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">类型安全监控仪表板</h1>
              {data && (
                <div className="ml-4 flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: statusColors[data.summary.status] }}
                  ></div>
                  <span className="text-sm text-gray-600 capitalize">{data.summary.status}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
              >
                🔄 刷新
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 标签页导航 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: '概览', icon: '📊' },
                { id: 'trends', label: '趋势', icon: '📈' },
                { id: 'violations', label: '违规', icon: '⚠️' },
                { id: 'metrics', label: '指标', icon: '📏' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 标签页内容 */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'trends' && <TrendsTab />}
        {activeTab === 'violations' && <ViolationsTab />}
        {activeTab === 'metrics' && <MetricsTab />}
      </div>
    </div>
  );
};

export default TypeSafetyDashboard;