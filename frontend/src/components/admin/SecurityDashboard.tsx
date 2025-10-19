/**
 * 安全监控仪表板组件
 *
 * 提供实时的安全状态监控和威胁分析
 * 集成所有安全防护系统的监控功能
 */

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Eye,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';

import {
  getSecurityMetrics,
  securityMonitor,
  ThreatLevel
} from '@/utils/securityMonitor';

import {
  cspManager
} from '@/utils/contentSecurityPolicy';

import {
  getSecurityStatus
} from '@/utils/securityInit';

interface SecurityDashboardProps {
  className?: string;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ className }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [cspReports, setCspReports] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 获取威胁等级的颜色
  const getThreatLevelColor = (level: ThreatLevel): string => {
    switch (level) {
      case ThreatLevel.LOW:
        return 'text-green-600 bg-green-50';
      case ThreatLevel.MEDIUM:
        return 'text-yellow-600 bg-yellow-50';
      case ThreatLevel.HIGH:
        return 'text-orange-600 bg-orange-50';
      case ThreatLevel.CRITICAL:
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // 获取系统健康状态的颜色
  const getHealthColor = (health: string): string => {
    switch (health) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // 刷新数据
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const newMetrics = getSecurityMetrics();
      const newCspReports = cspManager.getViolationReports();
      const newSecurityEvents = securityMonitor.getEvents({ limit: 50 });

      setMetrics(newMetrics);
      setCspReports(newCspReports);
      setSecurityEvents(newSecurityEvents);
    } catch (error) {
      console.error('刷新安全数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化数据
  useEffect(() => {
    refreshData();

    // 设置自动刷新
    const interval = setInterval(refreshData, 30000); // 30秒刷新一次

    return () => {
      clearInterval(interval);
    };
  }, []);

  // 导出安全报告
  const exportSecurityReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      securityStatus: getSecurityStatus(),
      metrics,
      cspReports,
      recentEvents: securityEvents,
      protectionRules: securityMonitor.getProtectionRules()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 解除IP封锁
  const unblockIP = (ip: string) => {
    // 这里需要实现解除IP封锁的逻辑
    console.log('解除IP封锁:', ip);
    refreshData();
  };

  // 解决安全事件
  const resolveEvent = (eventId: string) => {
    securityMonitor.resolveEvent(eventId, '手动解决');
    refreshData();
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">加载安全数据...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">安全监控中心</h1>
            <p className="text-sm text-gray-600">实时安全状态监控和威胁分析</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportSecurityReport}
          >
            <Download className="w-4 h-4 mr-2" />
            导出报告
          </Button>
        </div>
      </div>

      {/* 系统状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">系统健康状态</p>
              <p className={`text-2xl font-bold ${getHealthColor(metrics.systemHealth)}`}>
                {metrics.systemHealth === 'healthy' ? '正常' :
                 metrics.systemHealth === 'warning' ? '警告' : '危险'}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${
              metrics.systemHealth === 'healthy' ? 'bg-green-100' :
              metrics.systemHealth === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {metrics.systemHealth === 'healthy' ?
                <CheckCircle className="w-6 h-6 text-green-600" /> :
                metrics.systemHealth === 'warning' ?
                <AlertTriangle className="w-6 h-6 text-yellow-600" /> :
                <XCircle className="w-6 h-6 text-red-600" />
              }
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总安全事件</p>
              <p className="text-2xl font-bold">{metrics.totalEvents}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已阻止请求</p>
              <p className="text-2xl font-bold">{metrics.blockedRequests}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃攻击者</p>
              <p className="text-2xl font-bold">{metrics.topAttackers?.length || 0}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* 事件类型分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">事件类型分布</h2>
          <div className="space-y-3">
            {Object.entries(metrics.eventsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(Number(count) / metrics.totalEvents) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{String(count)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 威胁等级分布 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">威胁等级分布</h2>
          <div className="space-y-3">
            {Object.entries(metrics.eventsByLevel).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getThreatLevelColor(level as ThreatLevel)}`}>
                    {level}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        level === 'critical' ? 'bg-red-600' :
                        level === 'high' ? 'bg-orange-600' :
                        level === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${(Number(count) / metrics.totalEvents) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{String(count)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 顶级攻击者 */}
      {metrics.topAttackers && metrics.topAttackers.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">顶级攻击者</h2>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              查看详情
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    攻击次数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后活动
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.topAttackers.map((attacker: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {attacker.ip}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge variant={attacker.count > 10 ? 'destructive' : 'secondary'}>
                        {attacker.count}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(attacker.lastSeen).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockIP(attacker.ip)}
                      >
                        解除封锁
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 最近安全事件 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">最近安全事件</h2>
          <Button variant="outline" size="sm">
            查看全部
          </Button>
        </div>
        <div className="space-y-3">
          {securityEvents.slice(0, 10).map((event, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getThreatLevelColor(event.threatLevel)}`}>
                    {event.threatLevel.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium capitalize">
                    {event.eventType.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {event.content}
                </p>
                {event.ip && (
                  <p className="text-xs text-gray-500 mt-1">
                    IP: {event.ip}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {event.blocked && (
                  <Badge variant="destructive">已阻止</Badge>
                )}
                {event.resolved && (
                  <Badge variant="secondary">已解决</Badge>
                )}
                {!event.resolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resolveEvent(event.id)}
                  >
                    标记解决
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* CSP违规报告 */}
      {cspReports.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">CSP违规报告</h2>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              配置CSP
            </Button>
          </div>
          <div className="space-y-3">
            {cspReports.slice(0, 5).map((report, index) => (
              <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      违规指令: {report.effectiveDirective}
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      阻止的URI: {report.blockedURI}
                    </p>
                    <p className="text-xs text-yellow-600">
                      文档URI: {report.documentURI}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {report.disposition === 'enforce' ? '强制' : '报告'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};