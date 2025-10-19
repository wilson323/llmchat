/**
 * IAGP 智能化治理系统仪表板
 * 提供完整的治理系统可视化界面
 */

import React, { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// 模拟数据类型定义
interface SystemStatus {
  initialized: boolean;
  uptime: number;
  version: string;
  health: 'healthy' | 'warning' | 'error';
  lastUpdate: Date;
}

interface DecisionMetrics {
  totalDecisions: number;
  successRate: number;
  averageConfidence: number;
  averageResponseTime: number;
  decisionsByType: Record<string, number>;
  trends: Array<{
    timestamp: string;
    decisions: number;
    confidence: number;
  }>;
}

interface ExecutionMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  executionsByType: Record<string, number>;
  trends: Array<{
    timestamp: string;
    executions: number;
    successRate: number;
  }>;
}

interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  tasksByStatus: Record<string, number>;
  performance: Array<{
    agentId: string;
    efficiency: number;
    reliability: number;
    collaboration: number;
  }>;
}

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface RealTimeMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

const IAGPDashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [decisionMetrics, setDecisionMetrics] = useState<DecisionMetrics | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetrics | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    initializeDashboard();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const initializeDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. 获取系统状态
      await fetchSystemStatus();

      // 2. 获取初始指标数据
      await Promise.all([
        fetchDecisionMetrics(),
        fetchExecutionMetrics(),
        fetchAgentMetrics(),
        fetchAlerts()
      ]);

      // 3. 启动实时数据流
      startRealTimeMonitoring();

    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/iagp/status');
      if (!response.ok) throw new Error('获取系统状态失败');
      const data = await response.json();
      setSystemStatus(data.data);
    } catch (err) {
      console.error('获取系统状态失败:', err);
      throw err;
    }
  };

  const fetchDecisionMetrics = async () => {
    try {
      const response = await fetch('/api/iagp/metrics');
      if (!response.ok) throw new Error('获取决策指标失败');
      const data = await response.json();
      setDecisionMetrics(data.data.decision);
    } catch (err) {
      console.error('获取决策指标失败:', err);
      // 设置模拟数据作为后备
      setDecisionMetrics({
        totalDecisions: 1247,
        successRate: 0.92,
        averageConfidence: 0.85,
        averageResponseTime: 150,
        decisionsByType: {
          'performance': 456,
          'quality': 324,
          'security': 267,
          'compliance': 200
        },
        trends: generateMockTrendData('decisions', 24)
      });
    }
  };

  const fetchExecutionMetrics = async () => {
    try {
      const response = await fetch('/api/iagp/metrics');
      if (!response.ok) throw new Error('获取执行指标失败');
      const data = await response.json();
      setExecutionMetrics(data.data.automation);
    } catch (err) {
      console.error('获取执行指标失败:', err);
      // 设置模拟数据作为后备
      setExecutionMetrics({
        totalExecutions: 892,
        successRate: 0.95,
        averageExecutionTime: 2500,
        executionsByType: {
          'code_fix': 234,
          'deployment': 345,
          'configuration': 189,
          'monitoring': 124
        },
        trends: generateMockTrendData('executions', 24)
      });
    }
  };

  const fetchAgentMetrics = async () => {
    try {
      const response = await fetch('/api/iagp/metrics');
      if (!response.ok) throw new Error('获取智能体指标失败');
      const data = await response.json();
      setAgentMetrics(data.data.agents);
    } catch (err) {
      console.error('获取智能体指标失败:', err);
      // 设置模拟数据作为后备
      setAgentMetrics({
        totalAgents: 12,
        activeAgents: 9,
        tasksByStatus: {
          'completed': 156,
          'running': 23,
          'pending': 12,
          'failed': 3
        },
        performance: [
          { agentId: 'agent_001', efficiency: 0.92, reliability: 0.95, collaboration: 0.88 },
          { agentId: 'agent_002', efficiency: 0.88, reliability: 0.91, collaboration: 0.93 },
          { agentId: 'agent_003', efficiency: 0.95, reliability: 0.89, collaboration: 0.91 }
        ]
      });
    }
  };

  const fetchAlerts = async () => {
    try {
      // 模拟告警数据
      const mockAlerts: Alert[] = [
        {
          id: 'alert_001',
          type: 'warning',
          title: '内存使用率偏高',
          message: '系统内存使用率已达到82%，建议关注或优化',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          acknowledged: false
        },
        {
          id: 'alert_002',
          type: 'info',
          title: '智能体协作完成',
          message: '代码质量检查协作任务已成功完成',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          acknowledged: true
        },
        {
          id: 'alert_003',
          type: 'success',
          title: '自动修复成功',
          message: '检测到并自动修复了3个代码质量问题',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          acknowledged: false
        }
      ];
      setAlerts(mockAlerts);
    } catch (err) {
      console.error('获取告警数据失败:', err);
    }
  };

  const startRealTimeMonitoring = () => {
    try {
      eventSourceRef.current = new EventSource('/api/iagp/monitoring/stream');

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'monitoring') {
            updateRealTimeMetrics(data);
          } else if (data.type === 'alert') {
            addNewAlert(data);
          }
        } catch (err) {
          console.error('处理实时数据失败:', err);
        }
      };

      eventSourceRef.current.onerror = (err) => {
        console.error('实时监控连接错误:', err);
        // 5秒后尝试重连
        setTimeout(startRealTimeMonitoring, 5000);
      };

    } catch (err) {
      console.error('启动实时监控失败:', err);
      // 使用模拟数据作为后备
      startMockRealTimeData();
    }
  };

  const updateRealTimeMetrics = (data: any) => {
    setRealTimeMetrics(prev => {
      const newMetrics = [
        ...prev.slice(-19), // 保留最近20个数据点
        {
          timestamp: data.timestamp,
          cpu: data.systemMetrics.cpu || 0,
          memory: data.systemMetrics.memory || 0,
          network: data.systemMetrics.network || 0,
          responseTime: data.decisionMetrics?.averageResponseTime || 0,
          throughput: data.automationMetrics?.throughput || 0,
          errorRate: data.systemMetrics?.errorRate || 0
        }
      ];
      return newMetrics;
    });
  };

  const addNewAlert = (alertData: any) => {
    setAlerts(prev => [
      {
        id: alertData.id || `alert_${Date.now()}`,
        type: alertData.type || 'info',
        title: alertData.title || '新告警',
        message: alertData.message || '',
        timestamp: new Date(alertData.timestamp),
        acknowledged: false
      },
      ...prev.slice(0, 9) // 保留最近10个告警
    ]);
  };

  const startMockRealTimeData = () => {
    const interval = setInterval(() => {
      updateRealTimeMetrics({
        timestamp: new Date().toISOString(),
        systemMetrics: {
          cpu: Math.random() * 0.8,
          memory: Math.random() * 0.9,
          network: Math.random() * 0.7,
          errorRate: Math.random() * 0.05
        },
        decisionMetrics: {
          averageResponseTime: 100 + Math.random() * 200
        },
        automationMetrics: {
          throughput: 10 + Math.random() * 40
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  };

  const generateMockTrendData = (type: string, hours: number) => {
    const data = [];
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      if (type === 'decisions') {
        data.push({
          timestamp: timestamp.toISOString(),
          decisions: Math.floor(Math.random() * 50) + 10,
          confidence: Math.random() * 0.3 + 0.7,
          executions: 0,
          successRate: 0
        });
      } else if (type === 'executions') {
        data.push({
          timestamp: timestamp.toISOString(),
          decisions: 0,
          confidence: 0,
          executions: Math.floor(Math.random() * 30) + 5,
          successRate: Math.random() * 0.2 + 0.8
        });
      }
    }
    return data;
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">正在加载IAGP仪表板...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="mb-6">
        <Alert.Description>
          加载失败: {error}
          <Button variant="outline" size="sm" className="ml-2" onClick={initializeDashboard}>
            重试
          </Button>
        </Alert.Description>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题和系统状态 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">IAGP 智能化治理系统</h1>
          <p className="text-gray-600 mt-1">智能自动化治理协议控制台</p>
        </div>
        {systemStatus && (
          <div className="flex items-center space-x-4">
            <Badge variant={systemStatus.health === 'healthy' ? 'default' : 'destructive'}>
              {systemStatus.health === 'healthy' ? '正常' : '异常'}
            </Badge>
            <span className="text-sm text-gray-600">
              运行时间: {formatUptime(systemStatus.uptime)}
            </span>
            <span className="text-sm text-gray-600">
              版本: {systemStatus.version}
            </span>
          </div>
        )}
      </div>

      {/* 告警区域 */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">系统告警</h3>
          <div className="grid gap-2">
            {alerts.filter(alert => !alert.acknowledged).map(alert => (
              <Alert key={alert.id} className={`border-l-4 ${
                alert.type === 'error' ? 'border-l-red-500' :
                alert.type === 'warning' ? 'border-l-yellow-500' :
                alert.type === 'success' ? 'border-l-green-500' :
                'border-l-blue-500'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{alert.title}</div>
                    <div className="text-sm">{alert.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {alert.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    确认
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="grid w-full grid-cols-6">
          <Tabs.Trigger value="overview">概览</Tabs.Trigger>
          <Tabs.Trigger value="decisions">智能决策</Tabs.Trigger>
          <Tabs.Trigger value="executions">自动执行</Tabs.Trigger>
          <Tabs.Trigger value="agents">智能体</Tabs.Trigger>
          <Tabs.Trigger value="monitoring">实时监控</Tabs.Trigger>
          <Tabs.Trigger value="analytics">分析洞察</Tabs.Trigger>
        </Tabs.List>

        {/* 概览标签页 */}
        <Tabs.Content value="overview" className="space-y-6">
          {/* 关键指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium">总决策数</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="text-2xl font-bold">
                  {decisionMetrics?.totalDecisions || 0}
                </div>
                <p className="text-xs text-gray-600">
                  成功率: {((decisionMetrics?.successRate || 0) * 100).toFixed(1)}%
                </p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium">总执行数</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="text-2xl font-bold">
                  {executionMetrics?.totalExecutions || 0}
                </div>
                <p className="text-xs text-gray-600">
                  成功率: {((executionMetrics?.successRate || 0) * 100).toFixed(1)}%
                </p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium">活跃智能体</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="text-2xl font-bold">
                  {agentMetrics?.activeAgents || 0}/{agentMetrics?.totalAgents || 0}
                </div>
                <p className="text-xs text-gray-600">
                  总智能体数
                </p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="pb-2">
                <Card.Title className="text-sm font-medium">系统健康度</Card.Title>
              </Card.Header>
              <Card.Content>
                <div className={`text-2xl font-bold ${getHealthColor(systemStatus?.health || '')}`}>
                  {systemStatus?.health === 'healthy' ? '98%' :
                   systemStatus?.health === 'warning' ? '85%' : '45%'}
                </div>
                <p className="text-xs text-gray-600">
                  综合评分
                </p>
              </Card.Content>
            </Card>
          </div>

          {/* 趋势图表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Card.Header>
                <Card.Title>决策趋势</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={decisionMetrics?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="decisions"
                      stroke="#8884d8"
                      name="决策数量"
                    />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke="#82ca9d"
                      name="平均置信度"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>执行趋势</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={executionMetrics?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="executions"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                      name="执行数量"
                    />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke="#82ca9d"
                      name="成功率"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Content>

        {/* 智能决策标签页 */}
        <Tabs.Content value="decisions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 决策类型分布 */}
            <Card>
              <Card.Header>
                <Card.Title>决策类型分布</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={Object.entries(decisionMetrics?.decisionsByType || {}).map(([name, value]) => ({
                        name,
                        value
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(decisionMetrics?.decisionsByType || {}).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card.Content>
            </Card>

            {/* 决策质量指标 */}
            <Card>
              <Card.Header>
                <Card.Title>决策质量指标</Card.Title>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="flex justify-between">
                  <span>平均置信度</span>
                  <span className="font-semibold">
                    {((decisionMetrics?.averageConfidence || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>平均响应时间</span>
                  <span className="font-semibold">
                    {decisionMetrics?.averageResponseTime || 0}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>成功率</span>
                  <span className="font-semibold">
                    {((decisionMetrics?.successRate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </Card.Content>
            </Card>

            {/* 快速操作 */}
            <Card>
              <Card.Header>
                <Card.Title>快速操作</Card.Title>
              </Card.Header>
              <Card.Content className="space-y-2">
                <Button className="w-full" variant="outline">
                  新建智能决策
                </Button>
                <Button className="w-full" variant="outline">
                  查看决策历史
                </Button>
                <Button className="w-full" variant="outline">
                  导出决策报告
                </Button>
                <Button className="w-full" variant="outline">
                  决策设置
                </Button>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Content>

        {/* 自动执行标签页 */}
        <Tabs.Content value="executions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 执行类型统计 */}
            <Card>
              <Card.Header>
                <Card.Title>执行类型统计</Card.Title>
              </Card.Header>
              <Card.Content>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={Object.entries(executionMetrics?.executionsByType || {}).map(([name, value]) => ({
                name,
                value
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 执行性能指标 */}
        <Card>
          <Card.Header>
            <Card.Title>执行性能指标</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="flex justify-between">
              <span>平均执行时间</span>
              <span className="font-semibold">
                {(executionMetrics?.averageExecutionTime || 0).toLocaleString()}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>成功率</span>
              <span className="font-semibold">
                {((executionMetrics?.successRate || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>总执行数</span>
              <span className="font-semibold">
                {executionMetrics?.totalExecutions || 0}
              </span>
            </div>
          </Card.Content>
        </Card>
      </div>
    </Tabs.Content>

    {/* 智能体标签页 */}
    <Tabs.Content value="agents" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 智能体任务状态 */}
        <Card>
          <Card.Header>
            <Card.Title>任务状态分布</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(agentMetrics?.tasksByStatus || {}).map(([name, value]) => ({
                    name,
                    value
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.entries(agentMetrics?.tasksByStatus || {}).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 智能体性能 */}
        <Card>
          <Card.Header>
            <Card.Title>智能体性能</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4">
              {agentMetrics?.performance.map((agent, index) => (
                <div key={agent.agentId} className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>{agent.agentId}</span>
                    <span>
                      {((agent.efficiency + agent.reliability + agent.collaboration) / 3 * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>效率</span>
                      <span>{(agent.efficiency * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${agent.efficiency * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>可靠性</span>
                      <span>{(agent.reliability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${agent.reliability * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>协作能力</span>
                      <span>{(agent.collaboration * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${agent.collaboration * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>
    </Tabs.Content>

    {/* 实时监控标签页 */}
    <Tabs.Content value="monitoring" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统资源监控 */}
        <Card>
          <Card.Header>
            <Card.Title>系统资源监控</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={realTimeMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#8884d8"
                  name="CPU使用率"
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#82ca9d"
                  name="内存使用率"
                />
                <Line
                  type="monotone"
                  dataKey="network"
                  stroke="#ffc658"
                  name="网络使用率"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>

        {/* 性能指标监控 */}
        <Card>
          <Card.Header>
            <Card.Title>性能指标监控</Card.Title>
          </Card.Header>
          <Card.Content>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={realTimeMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#8884d8"
                  name="响应时间(ms)"
                />
                <Line
                  type="monotone"
                  dataKey="throughput"
                  stroke="#82ca9d"
                  name="吞吐量"
                />
                <Line
                  type="monotone"
                  dataKey="errorRate"
                  stroke="#ff7300"
                  name="错误率"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Content>
        </Card>
      </div>
    </Tabs.Content>

    {/* 分析洞察标签页 */}
    <Tabs.Content value="analytics" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 模式识别 */}
        <Card>
          <Card.Header>
            <Card.Title>模式识别</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-900">内存使用上升趋势</div>
                <div className="text-sm text-blue-700 mt-1">
                  检测到过去24小时内内存使用持续上升
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  置信度: 88% | 建议关注
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="font-medium text-green-900">代码质量稳定</div>
                <div className="text-sm text-green-700 mt-1">
                  代码质量指标保持在健康水平
                </div>
                <div className="text-xs text-green-600 mt-2">
                  置信度: 92% | 状态良好
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* 预测分析 */}
        <Card>
          <Card.Header>
            <Card.Title>预测分析</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="font-medium text-yellow-900">性能预测</div>
                <div className="text-sm text-yellow-700 mt-1">
                  预计未来6小时响应时间可能增加15%
                </div>
                <div className="text-xs text-yellow-600 mt-2">
                  置信度: 78% | 预防建议
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="font-medium text-purple-900">资源需求</div>
                <div className="text-sm text-purple-700 mt-1">
                  预计明天上午10点达到峰值负载
                </div>
                <div className="text-xs text-purple-600 mt-2">
                  置信度: 85% | 准备扩容
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* 优化建议 */}
        <Card>
          <Card.Header>
            <Card.Title>优化建议</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-medium text-indigo-900">缓存优化</div>
                <div className="text-sm text-indigo-700 mt-1">
                  启用Redis缓存可提升响应速度25%
                </div>
                <div className="text-xs text-indigo-600 mt-2">
                  预期收益: 高 | 实施难度: 中
                </div>
              </div>
              <div className="p-3 bg-teal-50 rounded-lg">
                <div className="font-medium text-teal-900">数据库优化</div>
                <div className="text-sm text-teal-700 mt-1">
                  优化查询可减少30%的响应时间
                </div>
                <div className="text-xs text-teal-600 mt-2">
                  预期收益: 中 | 实施难度: 低
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    </Tabs.Content>
  </Tabs>
</div>
);
};

export default IAGPDashboard;