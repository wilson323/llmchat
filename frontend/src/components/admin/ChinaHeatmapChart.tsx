/**
 * ChinaHeatmapChart 组件 - 中国地图热力图
 * 使用ECharts展示地理分布数据
 */

import { memo, useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { MapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ProvinceHeatmapDataset } from '@/services/analyticsApi';

// 注册必需的ECharts组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  MapChart,
  CanvasRenderer,
]);

interface ChinaHeatmapChartProps {
  data: ProvinceHeatmapDataset | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * 中国地图热力图组件
 */
export const ChinaHeatmapChart = memo(function ChinaHeatmapChart({
  data,
  loading,
  error,
}: ChinaHeatmapChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const mapLoadedRef = useRef(false);

  useEffect(() => {
    if (!chartRef.current) return;

    // 加载中国地图GeoJSON数据
    const loadChinaMap = async () => {
      if (mapLoadedRef.current) return;

      try {
        const response = await fetch('/maps/china.json');
        if (!response.ok) {
          throw new Error('地图数据加载失败');
        }
        const chinaMap = await response.json();
        echarts.registerMap('china', chinaMap);
        mapLoadedRef.current = true;
      } catch (err) {
        console.error('加载中国地图数据失败:', err);
      }
    };

    void loadChinaMap();
  }, []);

  useEffect(() => {
    if (!chartRef.current || loading || error || !data || !mapLoadedRef.current) return;

    // 初始化图表
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }

    const chart = chartInstanceRef.current;

    // 转换数据为ECharts格式
    const mapData = data.points.map(point => ({
      name: point.province,
      value: point.count,
    }));

    // 计算数据范围
    const values = mapData.map(item => item.value);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 1);

    // 配置地图选项
    const option: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.value) {
            return `${params.name}<br/>会话数: ${params.value.toLocaleString()}`;
          }
          return `${params.name}<br/>暂无数据`;
        },
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        text: ['高', '低'],
        realtime: false,
        calculable: true,
        inRange: {
          color: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
        },
        textStyle: {
          color: '#666',
        },
      },
      series: [
        {
          name: '会话分布',
          type: 'map',
          map: 'china',
          roam: true,
          emphasis: {
            label: {
              show: true,
            },
            itemStyle: {
              areaColor: '#fbbf24',
            },
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
          },
          data: mapData,
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
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-sm text-gray-500">暂无数据</p>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full h-96" />;
});

export default ChinaHeatmapChart;

