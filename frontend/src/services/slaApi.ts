import { api } from './api';

// SLA监控相关类型定义

export interface SystemHealthMetrics {
  timestamp: string;
  overallStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  uptime: number; // 运行时间百分比
  responseTime: {
    avg: number; // 平均响应时间(ms)
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: {
    total: number; // 总错误率百分比
    clientErrors: number;
    serverErrors: number;
  };
  requestCount: {
    total: number;
    success: number;
    failed: number;
  };
  circuitBreakers: CircuitBreakerStatus[];
  agents: AgentHealthStatus[];
}

export interface CircuitBreakerStatus {
  id: string;
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  threshold: number;
  timeout: number;
}

export interface AgentHealthStatus {
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
}

export interface SLAMetrics {
  period: string; // 时间段
  availability: number; // 可用性百分比
  avgResponseTime: number; // 平均响应时间
  slaCompliance: number; // SLA达成率
  violations: SLAViolation[];
}

export interface SLAViolation {
  id: string;
  type: 'response_time' | 'availability' | 'error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  occurredAt: string;
  resolvedAt?: string;
  impact: string;
  value: number;
  threshold: number;
}

export interface Alert {
  id: string;
  type: 'system' | 'agent' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface PerformanceMetrics {
  cpu: TimeSeriesData[];
  memory: TimeSeriesData[];
  disk: TimeSeriesData[];
  network: TimeSeriesData[];
}

export interface SLADashboardParams {
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  refreshInterval?: number; // 刷新间隔(秒)
}

export interface SLADashboardData {
  summary: SystemHealthMetrics;
  slaMetrics: SLAMetrics;
  performance: PerformanceMetrics;
  alerts: Alert[];
  lastUpdated: string;
}

// API函数
export async function getSystemHealth(): Promise<SystemHealthMetrics> {
  const { data } = await api.get<{ data: SystemHealthMetrics }>(
    '/admin/sla/health'
  );
  return data.data;
}

export async function getSLAMetrics(params: { timeRange: string }): Promise<SLAMetrics> {
  const { data } = await api.get<{ data: SLAMetrics }>(
    '/admin/sla/metrics',
    { params }
  );
  return data.data;
}

export async function getPerformanceMetrics(params: {
  timeRange: string;
  metrics: string[]
}): Promise<PerformanceMetrics> {
  const { data } = await api.get<{ data: PerformanceMetrics }>(
    '/admin/sla/performance',
    { params }
  );
  return data.data;
}

export async function getAlerts(params: {
  timeRange?: string;
  severity?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: Alert[]; total: number }> {
  const { data } = await api.get<{ data: { alerts: Alert[]; total: number } }>(
    '/admin/sla/alerts',
    { params }
  );
  return data.data;
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await api.post(`/admin/sla/alerts/${alertId}/acknowledge`);
}

export async function resolveAlert(alertId: string): Promise<void> {
  await api.post(`/admin/sla/alerts/${alertId}/resolve`);
}

export async function getSLADashboard(params: SLADashboardParams): Promise<SLADashboardData> {
  const queryParams = {
    timeRange: params.timeRange,
    ...(params.refreshInterval && { refreshInterval: params.refreshInterval })
  };

  const { data } = await api.get<{ data: SLADashboardData }>(
    '/admin/sla/dashboard',
    { params: queryParams }
  );
  return data.data;
}

export async function getAgentMetrics(agentId: string, timeRange: string): Promise<AgentHealthStatus & { metrics: TimeSeriesData[] }> {
  const { data } = await api.get<{ data: AgentHealthStatus & { metrics: TimeSeriesData[] } }>(
    `/admin/sla/agents/${agentId}/metrics`,
    { params: { timeRange } }
  );
  return data.data;
}

export async function getRealTimeMetrics(): Promise<{
  systemHealth: SystemHealthMetrics;
  activeAlerts: Alert[];
  recentViolations: SLAViolation[];
}> {
  const { data } = await api.get<{
    data: {
      systemHealth: SystemHealthMetrics;
      activeAlerts: Alert[];
      recentViolations: SLAViolation[];
    }
  }>(
    '/admin/sla/realtime'
  );
  return data.data;
}