import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AgentHealthStatus } from '@/services/slaApi';

interface AgentStatusGridProps {
  agents: AgentHealthStatus[];
  loading?: boolean;
  onRefresh?: () => void;
  onViewDetails?: (agentId: string) => void;
  onToggleAgent?: (agentId: string, enabled: boolean) => void;
}

const statusConfig = {
  online: {
    icon: CheckCircle,
    color: 'text-success bg-success/10 border-success/20',
    label: '在线',
    pulse: false
  },
  offline: {
    icon: XCircle,
    color: 'text-error bg-error/10 border-error/20',
    label: '离线',
    pulse: false
  },
  degraded: {
    icon: AlertCircle,
    color: 'text-warning bg-warning/10 border-warning/20',
    label: '降级',
    pulse: true
  },
  unknown: {
    icon: Clock,
    color: 'text-muted-foreground bg-muted/10 border-muted/20',
    label: '未知',
    pulse: false
  }
};

export function AgentStatusGrid({
  agents,
  loading = false,
  onRefresh,
  onViewDetails,
  onToggleAgent
}: AgentStatusGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getPerformanceGrade = (responseTime: number, successRate: number) => {
    if (responseTime < 500 && successRate >= 99) return { grade: 'A', color: 'text-success' };
    if (responseTime < 1000 && successRate >= 95) return { grade: 'B', color: 'text-warning' };
    if (responseTime < 2000 && successRate >= 90) return { grade: 'C', color: 'text-error' };
    return { grade: 'D', color: 'text-error' };
  };

  const AgentCard = ({ agent, index }: { agent: AgentHealthStatus; index: number }) => {
    const config = statusConfig[agent.status];
    const StatusIcon = config.icon;
    const performance = getPerformanceGrade(agent.responseTime, agent.successRate);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          'relative rounded-lg border bg-card/50 backdrop-blur-sm p-4 transition-all duration-200',
          'hover:shadow-md hover:border-border/80 focus-within:ring-2 focus-within:ring-[var(--focus-ring)]',
          config.color
        )}
      >
        {/* 状态指示器 */}
        {config.pulse && (
          <div className="absolute top-2 right-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <StatusIcon className="h-4 w-4" />
            </motion.div>
          </div>
        )}

        <div className="space-y-3">
          {/* 头部信息 */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">
                {agent.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {agent.provider}
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                  config.color
                )}>
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </span>
              </div>
            </div>
          </div>

          {/* 性能指标 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">响应时间</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{agent.responseTime}ms</span>
                <div className={cn('text-xs font-bold', performance.color)}>
                  {performance.grade}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">成功率</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{agent.successRate.toFixed(1)}%</span>
                {agent.successRate >= 99 && (
                  <TrendingUp className="h-3 w-3 text-success" />
                )}
                {agent.successRate < 95 && (
                  <TrendingDown className="h-3 w-3 text-error" />
                )}
              </div>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>请求: {agent.requestCount.toLocaleString()}</span>
              {agent.errorCount > 0 && (
                <span className="text-error">错误: {agent.errorCount}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(agent.lastCheckTime), {
                  addSuffix: true,
                  locale: zhCN
                })}
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails?.(agent.id)}
              className="h-7 px-2 text-xs flex-1"
              aria-label={`查看 ${agent.name} 详情`}
            >
              <Eye className="h-3 w-3 mr-1" />
              详情
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleAgent?.(agent.id, !agent.enabled)}
              className="h-7 px-2 text-xs"
              aria-label={`${agent.enabled ? '禁用' : '启用'} ${agent.name}`}
            >
              {agent.enabled ? (
                <XCircle className="h-3 w-3 text-error" />
              ) : (
                <CheckCircle className="h-3 w-3 text-success" />
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 头部控制 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">智能体状态</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>总计: {agents.length}</span>
            <span>在线: {agents.filter(a => a.status === 'online').length}</span>
            <span>离线: {agents.filter(a => a.status === 'offline').length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex items-center bg-muted/10 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'brand' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-7 px-3 text-xs"
            >
              网格
            </Button>
            <Button
              variant={viewMode === 'list' ? 'brand' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-7 px-3 text-xs"
            >
              列表
            </Button>
          </div>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-3"
            aria-label="刷新智能体状态"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!loading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Activity className="h-12 w-12 mb-3" />
          <p className="text-sm font-medium">暂无智能体</p>
          <p className="text-xs">请先配置智能体</p>
        </div>
      )}

      {/* 智能体列表 */}
      {!loading && agents.length > 0 && (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
        }>
          {agents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}