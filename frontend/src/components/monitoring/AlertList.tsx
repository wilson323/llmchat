import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Bell,
  Clock,
  User,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/services/slaApi';
import { toast } from '@/components/ui/Toast';

interface AlertListProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  loading?: boolean;
  showFilters?: boolean;
  maxHeight?: string;
}

const severityColors = {
  info: 'border-info/20 bg-info/5 text-info',
  warning: 'border-warning/20 bg-warning/5 text-warning',
  error: 'border-error/20 bg-error/5 text-error',
  critical: 'border-error/30 bg-error/10 text-error animate-pulse'
};

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  critical: XCircle
};

const typeColors = {
  system: 'bg-blue-500/10 text-blue-600 border-blue-200',
  agent: 'bg-green-500/10 text-green-600 border-green-200',
  performance: 'bg-orange-500/10 text-orange-600 border-orange-200',
  security: 'bg-red-500/10 text-red-600 border-red-200'
};

export function AlertList({
  alerts,
  onAcknowledge,
  onResolve,
  loading = false,
  showFilters = true,
  maxHeight = '400px'
}: AlertListProps) {
  const [filter, setFilter] = useState<{
    severity?: string;
    type?: string;
    acknowledged?: boolean;
  }>({});
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // 过滤告警
  const filteredAlerts = alerts.filter(alert => {
    if (filter.severity && alert.severity !== filter.severity) return false;
    if (filter.type && alert.type !== filter.type) return false;
    if (filter.acknowledged !== undefined && alert.acknowledged !== filter.acknowledged) return false;
    return true;
  });

  const handleAcknowledge = async (alertId: string) => {
    try {
      onAcknowledge?.(alertId);
      toast({
        type: 'success',
        title: '告警已确认',
        description: '告警已标记为已确认'
      });
    } catch (error) {
      toast({
        type: 'error',
        title: '操作失败',
        description: '无法确认告警，请稍后重试'
      });
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      onResolve?.(alertId);
      toast({
        type: 'success',
        title: '告警已解决',
        description: '告警已标记为已解决'
      });
    } catch (error) {
      toast({
        type: 'error',
        title: '操作失败',
        description: '无法解决告警，请稍后重试'
      });
    }
  };

  const toggleExpanded = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {/* 过滤器 */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 bg-card/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">严重程度:</span>
            <select
              value={filter.severity || ''}
              onChange={(e) => setFilter(prev => ({
                ...prev,
                severity: e.target.value || undefined
              }))}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="">全部</option>
              <option value="critical">紧急</option>
              <option value="error">错误</option>
              <option value="warning">警告</option>
              <option value="info">信息</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">类型:</span>
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter(prev => ({
                ...prev,
                type: e.target.value || undefined
              }))}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="">全部</option>
              <option value="system">系统</option>
              <option value="agent">智能体</option>
              <option value="performance">性能</option>
              <option value="security">安全</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">状态:</span>
            <select
              value={filter.acknowledged === undefined ? '' : filter.acknowledged.toString()}
              onChange={(e) => setFilter(prev => ({
                ...prev,
                acknowledged: e.target.value === '' ? undefined : e.target.value === 'true'
              }))}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="">全部</option>
              <option value="false">未确认</option>
              <option value="true">已确认</option>
            </select>
          </div>
        </div>
      )}

      {/* 告警列表 */}
      <div
        className="space-y-2 overflow-y-auto"
        style={{ maxHeight }}
        role="region"
        aria-label="告警列表"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Bell className="h-6 w-6 text-muted-foreground" />
            </motion.div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-2 text-success" />
            <p className="text-sm font-medium">暂无告警</p>
            <p className="text-xs">系统运行正常</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredAlerts.map((alert) => {
              const SeverityIcon = severityIcons[alert.severity];
              const isExpanded = expandedAlerts.has(alert.id);

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    'rounded-lg border p-4 transition-all duration-200',
                    'hover:shadow-md focus-within:ring-2 focus-within:ring-[var(--focus-ring)]',
                    severityColors[alert.severity],
                    alert.resolved && 'opacity-60'
                  )}
                  role="article"
                  aria-labelledby={`alert-title-${alert.id}`}
                >
                  <div className="flex items-start gap-3">
                    {/* 状态图标 */}
                    <div className="flex-shrink-0 mt-1">
                      <SeverityIcon className="h-5 w-5" />
                    </div>

                    {/* 主要内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3
                            id={`alert-title-${alert.id}`}
                            className="font-medium text-foreground flex items-center gap-2"
                          >
                            {alert.title}
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                              typeColors[alert.type]
                            )}>
                              {alert.type === 'system' && '系统'}
                              {alert.type === 'agent' && '智能体'}
                              {alert.type === 'performance' && '性能'}
                              {alert.type === 'security' && '安全'}
                            </span>
                            {alert.acknowledged && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                <CheckCircle className="h-3 w-3" />
                                已确认
                              </span>
                            )}
                            {alert.resolved && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                                <CheckCircle className="h-3 w-3" />
                                已解决
                              </span>
                            )}
                          </h3>

                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {alert.description}
                          </p>

                          {/* 元数据 */}
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(alert.timestamp), {
                                addSuffix: true,
                                locale: zhCN
                              })}
                            </div>

                            {alert.source && (
                              <div className="flex items-center gap-1">
                                <span>来源: {alert.source}</span>
                              </div>
                            )}

                            {alert.acknowledgedBy && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                确认人: {alert.acknowledgedBy}
                              </div>
                            )}
                          </div>

                          {/* 详细信息 */}
                          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                            <button
                              onClick={() => toggleExpanded(alert.id)}
                              className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              aria-expanded={isExpanded}
                              aria-controls={`alert-details-${alert.id}`}
                            >
                              <ChevronDown className={cn(
                                'h-3 w-3 transition-transform',
                                isExpanded && 'rotate-180'
                              )} />
                              {isExpanded ? '收起' : '展开'}详细信息
                            </button>
                          )}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!alert.acknowledged && !alert.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAcknowledge(alert.id)}
                              className="h-8 px-2 text-xs"
                              aria-label={`确认告警: ${alert.title}`}
                            >
                              确认
                            </Button>
                          )}
                          {!alert.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResolve(alert.id)}
                              className="h-8 px-2 text-xs"
                              aria-label={`解决告警: ${alert.title}`}
                            >
                              解决
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 详细信息展开区域 */}
                      <AnimatePresence>
                        {isExpanded && alert.metadata && (
                          <motion.div
                            id={`alert-details-${alert.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">详细信息:</h4>
                              <div className="grid grid-cols-1 gap-2 text-xs">
                                {Object.entries(alert.metadata).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="font-medium text-muted-foreground min-w-0">
                                      {key}:
                                    </span>
                                    <span className="text-foreground break-all">
                                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* 统计信息 */}
        {!loading && filteredAlerts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>显示 {filteredAlerts.length} 条告警</span>
              <span>共 {alerts.length} 条告警</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}