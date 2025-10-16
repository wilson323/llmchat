'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useResponsive } from '@/hooks/useResponsive';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useI18n } from '@/i18n';
import type { SessionStats } from '@/services/sessionApi';

interface SessionStatsChartProps {
  stats: SessionStats;
  loading?: boolean;
}

export function SessionStatsChart({ stats, loading }: SessionStatsChartProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { isMobile, isTablet } = useResponsive();

  // 图表主题配置
  const chartTheme = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      backgroundColor: 'transparent',
      textStyle: {
        color: isDark ? '#e5e7eb' : '#374151',
      },
      grid: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
      },
      legend: {
        textStyle: {
          color: isDark ? '#e5e7eb' : '#374151',
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#e5e7eb' : '#374151',
        },
      },
    };
  }, [theme]);

  // 按日期统计图表配置
  const dateChartOption = useMemo(() => {
    const dates = stats.sessionsByDate.map(item => item.date);
    const counts = stats.sessionsByDate.map(item => item.count);

    return {
      title: {
        text: t('按日期统计'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold' as any,
          color: chartTheme.textStyle.color,
        },
      },
      tooltip: {
        trigger: 'axis' as const,
        ...chartTheme.tooltip,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
        ...chartTheme.grid,
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: dates,
        axisLine: {
          lineStyle: {
            color: chartTheme.grid.borderColor,
          },
        },
        axisLabel: {
          color: chartTheme.textStyle.color,
        },
      },
      yAxis: {
        type: 'value' as const,
        axisLine: {
          lineStyle: {
            color: chartTheme.grid.borderColor,
          },
        },
        axisLabel: {
          color: chartTheme.textStyle.color,
        },
        splitLine: {
          lineStyle: {
            color: chartTheme.grid.borderColor,
          },
        },
      },
      series: [
        {
          name: t('会话数量'),
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 3,
            color: '#3b82f6',
          },
          itemStyle: {
            color: '#3b82f6',
          },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: 'rgba(59, 130, 246, 0.3)'
                },
                {
                  offset: 1,
                  color: 'rgba(59, 130, 246, 0.05)'
                }
              ]
            }
          },
          data: counts,
        },
      ],
    };
  }, [stats, t, chartTheme]);

  // 按智能体统计图表配置
  const agentChartOption = useMemo(() => {
    const agents = stats.sessionsByAgent.map(item => item.agentName || item.agentId);
    const sessionCounts = stats.sessionsByAgent.map(item => item.sessionCount);
    const messageCounts = stats.sessionsByAgent.map(item => item.messageCount);

    return {
      title: {
        text: t('按智能体统计'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold' as any,
          color: chartTheme.textStyle.color,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        ...chartTheme.tooltip,
      },
      legend: {
        data: [t('会话数量'), t('消息数量')],
        top: 30,
        ...chartTheme.legend,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
        ...chartTheme.grid,
      },
      xAxis: {
        type: 'category' as const,
        data: agents,
        axisLine: {
          lineStyle: {
            color: chartTheme.grid.borderColor,
          },
        },
        axisLabel: {
          color: chartTheme.textStyle.color,
          interval: 0,
          rotate: agents.length > 6 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value' as const,
        axisLine: {
          lineStyle: {
            color: chartTheme.grid.borderColor,
          },
        },
        axisLabel: {
          color: chartTheme.textStyle.color,
        },
        splitLine: {
          lineStyle: {
            color: chartTheme.grid.borderColor,
          },
        },
      },
      series: [
        {
          name: t('会话数量'),
          type: 'bar' as const,
          data: sessionCounts,
          itemStyle: {
            color: '#10b981',
          },
          emphasis: {
            itemStyle: {
              color: '#059669',
            },
          },
        },
        {
          name: t('消息数量'),
          type: 'bar' as const,
          data: messageCounts,
          itemStyle: {
            color: '#f59e0b',
          },
          emphasis: {
            itemStyle: {
              color: '#d97706',
            },
          },
        },
      ],
    };
  }, [stats, t, chartTheme]);

  // 热门标签图表配置
  const tagChartOption = useMemo(() => {
    const tags = stats.topTags.map(item => item.tag);
    const counts = stats.topTags.map(item => item.count);

    return {
      title: {
        text: t('热门标签'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold' as any,
          color: chartTheme.textStyle.color,
        },
      },
      tooltip: {
        trigger: 'item' as const,
        ...chartTheme.tooltip,
      },
      series: [
        {
          name: t('标签使用次数'),
          type: 'pie' as const,
          radius: ['40%', '70%'],
          center: ['50%', '60%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: chartTheme.backgroundColor,
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold' as any,
              color: chartTheme.textStyle.color,
            },
          },
          labelLine: {
            show: false,
          },
          data: tags.map((tag, index) => ({
            value: counts[index],
            name: tag,
            itemStyle: {
              color: [
                '#3b82f6',
                '#10b981',
                '#f59e0b',
                '#ef4444',
                '#8b5cf6',
                '#ec4899',
                '#06b6d4',
                '#84cc16',
              ][index % 8],
            },
          })),
        },
      ],
    };
  }, [stats, t, chartTheme]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`grid gap-6 ${
          isMobile ? 'grid-cols-1' :
          isTablet ? 'grid-cols-1 lg:grid-cols-2' :
          'grid-cols-1 lg:grid-cols-3'
        }`}
        >
        {[1, 2, 3].map((index) => (
          <div key={index} className="bg-card border border-border rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-64 bg-muted rounded" />
            </div>
          </div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`grid gap-6 ${
        isMobile ? 'grid-cols-1' :
        isTablet ? 'grid-cols-1 lg:grid-cols-2' :
        'grid-cols-1 lg:grid-cols-3'
      }`}
      >
      {/* 按日期统计图表 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
      >
        <ReactECharts
          option={dateChartOption as any}
          style={{ height: '300px' }}
          theme={chartTheme}
          notMerge={true}
          lazyUpdate={true}
        />
      </motion.div>

      {/* 按智能体统计图表 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
      >
        <ReactECharts
          option={agentChartOption as any}
          style={{ height: '300px' }}
          theme={chartTheme}
          notMerge={true}
          lazyUpdate={true}
        />
      </motion.div>

      {/* 热门标签图表 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
      >
        <ReactECharts
          option={tagChartOption as any}
          style={{ height: '300px' }}
          theme={chartTheme}
          notMerge={true}
          lazyUpdate={true}
        />
      </motion.div>
    </motion.div>
  );
}