
import { Activity, AlertTriangle, BarChart3, CheckCircle, Shield, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MetricsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  status?: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  description?: string;
  loading?: boolean;
  className?: string;
  trend?: number[];
  onClick?: () => void;
}

const statusColors = {
  success: 'text-success bg-success/10 border-success/20',
  warning: 'text-warning bg-warning/10 border-warning/20',
  error: 'text-error bg-error/10 border-error/20',
  info: 'text-info bg-info/10 border-info/20',
};

const statusIcons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Activity,
};

export function MetricsCard({
  title,
  value,
  unit,
  change,
  status = 'info',
  icon,
  description,
  loading = false,
  className,
  trend,
  onClick,
}: MetricsCardProps) {
  const StatusIcon = statusIcons[status];

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card/50 backdrop-blur-sm p-6 transition-all duration-200 hover:shadow-lg',
        'hover:border-border/80 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2',
        status && statusColors[status],
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={onClick ? `${title}: ${formatValue(value)}${unit || ''}` : undefined}
      >
      {/* 状态指示器 */}
      {status && (
        <div className="absolute top-4 right-4">
          <StatusIcon className="h-4 w-4" />
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Activity className="h-6 w-6 text-muted-foreground" />
          </motion.div>
        </div>
      )}

      <div className="space-y-3">
        {/* 标题和图标 */}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/50">
              {icon}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          </div>
        </div>

        {/* 数值和单位 */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            {formatValue(value)}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground">{unit}</span>
          )}
        </div>

        {/* 变化趋势 */}
        {change && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium',
              change.type === 'increase' ? 'text-success' : 'text-error',
            )}>
              {change.type === 'increase' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(change.value).toFixed(1)}%</span>
            </div>
            <span className="text-xs text-muted-foreground">
              vs {change.period}
            </span>
          </div>
        )}

        {/* 趋势迷你图 */}
        {trend && trend.length > 0 && (
          <div className="h-12 flex items-end gap-1">
            {trend.map((value, index) => (
              <motion.div
                key={index}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={cn(
                  'flex-1 rounded-t-sm min-h-[2px]',
                  value > 0 ? 'bg-success/60' : 'bg-error/60',
                )}
                style={{
                  height: `${Math.abs(value) * 100}%`,
                  transformOrigin: 'bottom',
                }}
              />
            ))}
          </div>
        )}

        {/* 描述 */}
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// 预定义的指标卡片组件
export function UptimeCard({ uptime, loading }: { uptime: number; loading?: boolean }) {
  return (
    <MetricsCard
      title="系统可用性"
      value={uptime}
      unit="%"
      status={uptime >= 99.9 ? 'success' : uptime >= 99 ? 'warning' : 'error'}
      icon={<Shield className="h-5 w-5 text-success" />}
      description="过去30天系统运行时间"
      {...(loading !== undefined && { loading })}
    />
  );
}

export function ResponseTimeCard({ responseTime, loading }: {
  responseTime: { avg: number; p95: number };
  loading?: boolean;
}) {
  return (
    <MetricsCard
      title="平均响应时间"
      value={responseTime.avg}
      unit="ms"
      status={responseTime.avg < 500 ? 'success' : responseTime.avg < 1000 ? 'warning' : 'error'}
      icon={<Zap className="h-5 w-5 text-info" />}
      description={`P95: ${responseTime.p95}ms`}
      {...(loading !== undefined && { loading })}
    />
  );
}

export function ErrorRateCard({ errorRate, loading }: {
  errorRate: { total: number; serverErrors: number };
  loading?: boolean;
}) {
  return (
    <MetricsCard
      title="错误率"
      value={errorRate.total}
      unit="%"
      status={errorRate.total < 1 ? 'success' : errorRate.total < 5 ? 'warning' : 'error'}
      icon={<AlertTriangle className="h-5 w-5 text-warning" />}
      description={`服务器错误: ${errorRate.serverErrors}%`}
      {...(loading !== undefined && { loading })}
    />
  );
}

export function RequestCountCard({ requestCount, loading }: {
  requestCount: { total: number; success: number };
  loading?: boolean;
}) {
  return (
    <MetricsCard
      title="请求总数"
      value={requestCount.total}
      icon={<BarChart3 className="h-5 w-5 text-brand" />}
      description={`成功: ${requestCount.success.toLocaleString()}`}
      {...(loading !== undefined && { loading })}
      change={{
        value: 12.5,
        type: 'increase',
        period: '昨日',
      }}
    />
  );
}

export function ActiveAgentsCard({ activeAgents, totalAgents, loading }: {
  activeAgents: number;
  totalAgents: number;
  loading?: boolean;
}) {
  const percentage = totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0;

  return (
    <MetricsCard
      title="在线智能体"
      value={activeAgents}
      unit={`/${totalAgents}`}
      status={percentage >= 90 ? 'success' : percentage >= 70 ? 'warning' : 'error'}
      icon={<Activity className="h-5 w-5 text-info" />}
      description={`${percentage.toFixed(1)}% 在线率`}
      {...(loading !== undefined && { loading })}
    />
  );
}