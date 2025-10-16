import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { cn } from '@/lib/utils';
import { TimeSeriesData } from '@/services/slaApi';

// ECharts系列类型定义
interface SeriesOption {
  name: string;
  type: 'line' | 'bar' | 'area';
  data: number[];
  smooth?: boolean;
  symbol?: string;
  symbolSize?: number;
  lineStyle?: {
    width: number;
    color: string;
    type?: string;
  };
  itemStyle?: {
    color: string;
  };
  areaStyle?: {
    color?: string | {
      type: string;
      x: number;
      y: number;
      x2: number;
      y2: number;
      colorStops?: Array<{
        offset: number;
        color: string;
        opacity?: number;
      }>;
    };
    opacity?: number;
  };
  emphasis?: {
    disabled: boolean;
  };
}

interface ChartOption {
  title: {
    text: string;
    left: string;
    textStyle: {
      fontSize: number;
      fontWeight: string;
      color: string;
    };
  };
  tooltip: {
    trigger: string;
    backgroundColor: string;
    borderColor: string;
    textStyle: {
      color: string;
    };
    formatter: (params: any) => string;
  };
  grid: {
    left: string;
    right: string;
    bottom: string;
    containLabel: boolean;
  };
  xAxis: {
    type: string;
    boundaryGap: boolean;
    data: string[];
    axisLine: {
      lineStyle: {
        color: string;
      };
    };
    axisLabel: {
      color: string;
      fontSize: number;
      formatter: (value: string) => string;
    };
  };
  yAxis: {
    type: string;
    axisLine: {
      lineStyle: {
        color: string;
      };
    };
    axisLabel: {
      color: string;
      fontSize: number;
      formatter: (value: number) => string;
    };
    splitLine: {
      lineStyle: {
        color: string;
        opacity: number;
      };
    };
  };
  series: SeriesOption[];
}

interface PerformanceChartProps {
  title: string;
  data: TimeSeriesData[];
  type?: 'line' | 'bar' | 'area';
  height?: string | number;
  loading?: boolean;
  error?: string;
  unit?: string;
  threshold?: {
    value: number;
    label: string;
    color: string;
  };
  className?: string;
}

export function PerformanceChart({
  title,
  data,
  type = 'line',
  height = 300,
  loading = false,
  error,
  unit,
  threshold,
  className,
}: PerformanceChartProps) {
  const chartOption = useMemo((): ChartOption | null => {
    if (!data || data.length === 0) {
      return null;
    }

    const timestamps = data.map(item => item.timestamp);
    const values = data.map(item => item.value);

    const baseOption: ChartOption = {
      title: {
        text: title,
        left: 'left',
        textStyle: {
          fontSize: 14,
          fontWeight: 'normal',
          color: 'var(--foreground)',
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--background)',
        borderColor: 'var(--border)',
        textStyle: {
          color: 'var(--foreground)',
        },
        formatter: (params: any) => {
          const param = Array.isArray(params) ? params[0] : params;
          const time = new Date(param.name).toLocaleString('zh-CN');
          const value = param.value;
          return `
            <div style="padding: 8px;">
              <div style="margin-bottom: 4px; font-weight: bold;">${time}</div>
              <div>${param.seriesName}: ${value}${unit || ''}</div>
            </div>
          `;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timestamps,
        axisLine: {
          lineStyle: {
            color: 'var(--border)',
          },
        },
        axisLabel: {
          color: 'var(--muted-foreground)',
          fontSize: 11,
          formatter: (value: string) => {
            const date = new Date(value);
            return date.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            });
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: 'var(--border)',
          },
        },
        axisLabel: {
          color: 'var(--muted-foreground)',
          fontSize: 11,
          formatter: (value: number) => `${value}${unit || ''}`,
        },
        splitLine: {
          lineStyle: {
            color: 'var(--border)',
            opacity: 0.3,
          },
        },
      },
      series: [],
    };

    // 主数据系列
    const series: any = {
      name: title,
      type: type === 'area' ? 'line' : type,
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: 'var(--brand)',
      },
      itemStyle: {
        color: 'var(--brand)',
      },
      areaStyle: type === 'area' ? {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            {
              offset: 0,
              color: 'var(--brand)',
            },
            {
              offset: 1,
              color: 'var(--brand)',
              opacity: 0.1,
            },
          ],
        },
      } : undefined,
    };

    baseOption.series = [series];

    // 添加阈值线
    if (threshold) {
      const thresholdSeries: SeriesOption = {
        name: threshold.label,
        type: 'line',
        data: Array(values.length).fill(threshold.value),
        lineStyle: {
          color: threshold.color,
          type: 'dashed',
          width: 2,
        },
        itemStyle: {
          color: threshold.color,
        },
        symbol: 'none',
        emphasis: {
          disabled: true,
        },
      };
      baseOption.series.push(thresholdSeries);
    }

    return baseOption;
  }, [data, title, type, unit, threshold]);

  if (error) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-lg border border-error/20 bg-error/5 p-6',
        className,
      )}>
        <div className="text-center">
          <div className="text-error text-sm font-medium">加载失败</div>
          <div className="text-muted-foreground text-xs mt-1">{error}</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-lg border border-border/20 bg-card/50 p-6',
        className,
      )} style={{ height }}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  if (!chartOption) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-lg border border-border/20 bg-card/50 p-6',
        className,
      )} style={{ height }}>
        <div className="text-center">
          <div className="text-muted-foreground text-sm">暂无数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border/20 bg-card/50', className)}>
      <ReactECharts
        option={chartOption as any}
        style={{ height }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}

// 预定义的性能图表组件
export function ResponseTimeChart({ data, loading }: {
  data: TimeSeriesData[];
  loading?: boolean;
}) {
  return (
    <PerformanceChart
      title="响应时间趋势"
      data={data}
      type="area"
      unit="ms"
      height={200}
      {...(loading !== undefined && { loading })}
      threshold={{
        value: 1000,
        label: '阈值 (1000ms)',
        color: '#ef4444',
      }}
    />
  );
}

export function ErrorRateChart({ data, loading }: {
  data: TimeSeriesData[];
  loading?: boolean;
}) {
  return (
    <PerformanceChart
      title="错误率趋势"
      data={data}
      type="line"
      unit="%"
      height={200}
      {...(loading !== undefined && { loading })}
      threshold={{
        value: 5,
        label: '阈值 (5%)',
        color: '#f59e0b',
      }}
    />
  );
}

export function RequestVolumeChart({ data, loading }: {
  data: TimeSeriesData[];
  loading?: boolean;
}) {
  return (
    <PerformanceChart
      title="请求量趋势"
      data={data}
      type="bar"
      unit="req/s"
      height={200}
      {...(loading !== undefined && { loading })}
    />
  );
}

export function CPUUsageChart({ data, loading }: {
  data: TimeSeriesData[];
  loading?: boolean;
}) {
  return (
    <PerformanceChart
      title="CPU使用率"
      data={data}
      type="area"
      unit="%"
      height={200}
      {...(loading !== undefined && { loading })}
      threshold={{
        value: 80,
        label: '阈值 (80%)',
        color: '#f59e0b',
      }}
    />
  );
}

export function MemoryUsageChart({ data, loading }: {
  data: TimeSeriesData[];
  loading?: boolean;
}) {
  return (
    <PerformanceChart
      title="内存使用率"
      data={data}
      type="area"
      unit="%"
      height={200}
      {...(loading !== undefined && { loading })}
      threshold={{
        value: 85,
        label: '阈值 (85%)',
        color: '#ef4444',
      }}
    />
  );
}