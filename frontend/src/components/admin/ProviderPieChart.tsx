/**
 * ProviderPieChart 组件 - 提供商分布饼图
 * 使用ECharts展示各提供商的会话分布
 */

import { memo, useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 注册必需的ECharts组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  PieChart,
  CanvasRenderer,
]);

interface ProviderPieChartProps {
  data: Record<string, number> | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * 提供商分布饼图组件
 */
export const ProviderPieChart = memo(function ProviderPieChart({
  data,
  loading,
  error,
}: ProviderPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || loading || error || !data) return;

    // 初始化图表
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }

    const chart = chartInstanceRef.current;

    // 转换数据为ECharts需要的格式
    const chartData = Object.entries(data).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));

    // 配置饼图选项
    const option: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: '10%',
        top: 'center',
        textStyle: {
          color: '#666',
        },
      },
      series: [
        {
          name: '会话数',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
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
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: chartData,
        },
      ],
      color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
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
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
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

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-500">暂无数据</p>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-64" />;
});

export default ProviderPieChart;

