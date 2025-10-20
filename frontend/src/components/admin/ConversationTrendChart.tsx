/**
 * ConversationTrendChart 组件 - 对话趋势折线图
 * 使用ECharts展示会话数量随时间的变化趋势
 */

import { memo, useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ConversationSeriesDataset } from '@/services/analyticsApi';

// 注册必需的ECharts组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  CanvasRenderer,
]);

interface ConversationTrendChartProps {
  data: ConversationSeriesDataset | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * 对话趋势折线图组件
 */
export const ConversationTrendChart = memo(function ConversationTrendChart({
  data,
  loading,
  error,
}: ConversationTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || loading || error || !data) return;

    // 初始化图表
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }

    const chart = chartInstanceRef.current;

    // 提取日期和总数
    const dates = data.buckets.map(bucket => bucket.date.split('T')[0]);
    const totals = data.buckets.map(bucket => bucket.total);

    // 配置折线图选项
    const option: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
      },
      legend: {
        data: ['会话数'],
        textStyle: {
          color: '#666',
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
        data: dates,
        axisLabel: {
          color: '#666',
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#666',
        },
      },
      series: [
        {
          name: '会话数',
          type: 'line',
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ]),
          },
          itemStyle: {
            color: '#3b82f6',
          },
          data: totals,
        },
      ],
    };

    chart.setOption(option);

    // 响应式处理
    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [data, loading, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.buckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-500">暂无数据</p>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-64" />;
});

export default ConversationTrendChart;

