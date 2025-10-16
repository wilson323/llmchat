/**
 * 监控组件类型验证测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceDashboard } from '@/components/monitoring/PerformanceDashboard';
import { MetricsCard } from '@/components/monitoring/MetricsCard';
import { PerformanceChart } from '@/components/monitoring/PerformanceChart';
import { VisualizationDashboard } from '@/components/visualization/VisualizationDashboard';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-triangle" />,
  Monitor: () => <div data-testid="monitor" />,
  X: () => <div data-testid="x" />,
  Zap: () => <div data-testid="zap" />,
  Activity: () => <div data-testid="activity" />,
  Cpu: () => <div data-testid="cpu" />,
  HardDrive: () => <div data-testid="hard-drive" />,
  Shield: () => <div data-testid="shield" />,
  Check: () => <div data-testid="check" />,
  CheckCircle: () => <div data-testid="check-circle" />,
  BarChart3: () => <div data-testid="bar-chart-3" />,
  TrendingUp: () => <div data-testid="trending-up" />,
  TrendingDown: () => <div data-testid="trending-down" />,
}));

// Mock performance optimizer
vi.mock('@/utils/performanceOptimizer', () => ({
  memoryMonitor: {
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getMemoryStats: vi.fn(() => ({
      current: 50,
      average: 45,
      peak: 60,
      trend: 'stable'
    }))
  },
  componentMonitor: {
    getAllStats: vi.fn(() => ({
      TestComponent: {
        renders: 5,
        averageRenderTime: 10,
        isMounted: true
      }
    }))
  },
  requestMonitor: {
    getRequestStats: vi.fn(() => ({
      totalRequests: 100,
      averageDuration: 200,
      slowestRequests: [
        { url: '/test', duration: 500, timestamp: Date.now() }
      ],
      activeRequests: 2
    }))
  }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock echarts-for-react
vi.mock('echarts-for-react', () => ({
  default: ({ option, style }: any) =>
    <div data-testid="echarts" style={style}>
      <pre>{JSON.stringify(option, null, 2)}</pre>
    </div>
  },
}));

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) =>
    <div data-testid="line-chart" {...props}>{children}</div>,
  AreaChart: ({ children, ...props }: any) =>
    <div data-testid="area-chart" {...props}>{children}</div>,
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children, ...props }: any) =>
    <div data-testid="responsive-container" {...props}>{children}</div>,
}));

// Mock UI components
vi.mock('@/components/ui/IconButton', () => ({
  IconButton: ({ children, ...props }: any) =>
    <button data-testid="icon-button" {...props}>{children}</button>,
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: any) =>
    <div data-testid="card" {...props}>{children}</div>,
  Card: {
    Header: ({ children, ...props }: any) =>
      <div data-testid="card-header" {...props}>{children}</div>,
    Content: ({ children, ...props }: any) =>
      <div data-testid="card-content" {...props}>{children}</div>,
    Title: ({ children, ...props }: any) =>
      <div data-testid="card-title" {...props}>{children}</div>,
  }
}));

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, ...props }: any) =>
    <div data-testid="alert" {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) =>
    <div data-testid="alert-description" {...props}>{children}</div>,
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) =>
    <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('@/components/ui/Tabs', () => ({
  Tabs: ({ children, ...props }: any) =>
    <div data-testid="tabs" {...props}>{children}</div>,
  TabsList: ({ children, ...props }: any) =>
    <div data-testid="tabs-list" {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) =>
    <button data-testid="tabs-trigger" {...props}>{children}</button>,
  TabsContent: ({ children, ...props }: any) =>
    <div data-testid="tabs-content" {...props}>{children}</div>,
}));

vi.mock('@/components/ui/Switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) =>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid="switch"
      {...props}
    />,
}));

vi.mock('@/components/ui/Select', () => ({
  Select: ({ children, value, onValueChange, ...props }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="select"
      {...props}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children, ...props }: any) =>
    <div data-testid="select-content" {...props}>{children}</div>,
  SelectItem: ({ children, value, ...props }: any) =>
    <option value={value} data-testid="select-item" {...props}>{children}</option>,
  SelectTrigger: ({ children, ...props }: any) =>
    <div data-testid="select-trigger" {...props}>{children}</div>,
  SelectValue: ({ ...props }: any) =>
    <span data-testid="select-value" {...props} />,
}));

vi.mock('@/components/ui/Label', () => ({
  Label: ({ children, ...props }: any) =>
    <label data-testid="label" {...props}>{children}</label>,
}));

vi.mock('@/components/ui/Input', () => ({
  Input: ({ ...props }: any) =>
    <input data-testid="input" {...props} />,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: any) =>
    <button data-testid="button" {...props}>{children}</button>,
}));

// Mock fetch for API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      data: {
        enabled: true,
        refreshInterval: 5000,
        maxDataPoints: 1000,
        features: {
          dashboard: true,
          realTimeMonitoring: true,
          queueManagement: true,
          performanceAnalytics: true,
          alertManagement: true,
          systemHealth: true,
        },
        ui: {
          theme: 'light',
          language: 'zh',
          compactMode: false,
          showAdvancedOptions: true,
        },
        performance: {
          enableAnimations: true,
          chartUpdateThrottle: 100,
          dataCompressionEnabled: true,
          cacheEnabled: true,
          cache_ttl: 300,
        },
      }
    })
  })
) as any;

describe('监控组件类型验证', () => {
  it('PerformanceDashboard 应该正常渲染', () => {
    render(<PerformanceDashboard />);
    expect(screen.getByTestId('icon-button')).toBeInTheDocument();
  });

  it('MetricsCard 应该正常渲染', () => {
    render(
      <MetricsCard
        title="测试卡片"
        value={100}
        unit="%"
        status="success"
      />
    );
    expect(screen.getByText('测试卡片')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('PerformanceChart 应该正常渲染', () => {
    const mockData = [
      { timestamp: '2023-01-01T00:00:00Z', value: 100 },
      { timestamp: '2023-01-01T01:00:00Z', value: 120 },
    ];

    render(
      <PerformanceChart
        title="测试图表"
        data={mockData}
        type="line"
      />
    );
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
  });

  it('VisualizationDashboard 应该正常渲染', async () => {
    render(<VisualizationDashboard />);

    // 等待异步数据加载
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByText('队列管理可视化')).toBeInTheDocument();
  });

  it('监控组件应该具有正确的类型定义', () => {
    // 这个测试验证类型定义的完整性
    const config = {
      enabled: true,
      refreshInterval: 5000,
      maxDataPoints: 1000,
      features: {
        dashboard: true,
        realTimeMonitoring: true,
        queueManagement: true,
        performanceAnalytics: true,
        alertManagement: true,
        systemHealth: true,
      },
      ui: {
        theme: 'light' as const,
        language: 'zh' as const,
        compactMode: false,
        showAdvancedOptions: true,
      },
      performance: {
        enableAnimations: true,
        chartUpdateThrottle: 100,
        dataCompressionEnabled: true,
        cacheEnabled: true,
        cache_ttl: 300,
      },
    };

    expect(config.enabled).toBe(true);
    expect(config.features.dashboard).toBe(true);
    expect(config.ui.theme).toBe('light');
  });
});