/**
 * 监控组件类型声明
 */

// 性能监控相关类型
export interface MemoryStats {
  current: number;
  average: number;
  peak: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface RequestStats {
  totalRequests: number;
  averageDuration: number;
  slowestRequests: Array<{
    url: string;
    duration: number;
    timestamp: number;
  }>;
  activeRequests: number;
}

export interface ComponentStats {
  [componentName: string]: {
    renders: number;
    averageRenderTime: number;
    isMounted: boolean;
  };
}

export interface PerformanceStats {
  memory: MemoryStats | null;
  requests: RequestStats | null;
  components: ComponentStats | null;
}

// 图表相关类型
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

export interface RealtimeUpdate {
  timestamp: number;
  type: 'queue' | 'system' | 'performance' | 'alert';
  data: any;
}

// 可视化配置类型
export interface VisualizationConfig {
  enabled: boolean;
  refreshInterval: number;
  maxDataPoints: number;
  features: {
    dashboard: boolean;
    realTimeMonitoring: boolean;
    queueManagement: boolean;
    performanceAnalytics: boolean;
    alertManagement: boolean;
    systemHealth: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'zh' | 'en';
    compactMode: boolean;
    showAdvancedOptions: boolean;
  };
  performance: {
    enableAnimations: boolean;
    chartUpdateThrottle: number;
    dataCompressionEnabled: boolean;
    cacheEnabled: boolean;
    cache_ttl: number;
  };
}

export interface DashboardData {
  summary: {
    queues: {
      total: number;
      totalJobs: number;
      waitingJobs: number;
      activeJobs: number;
      avgThroughput: number;
    };
    system: {
      cpu: number;
      memoryUsage: number;
      eventLoopDelay: number;
      uptime: number;
    };
    redis: {
      connections: number;
      successRate: number;
    };
  };
  config: VisualizationConfig;
  timestamp: number;
}

// ECharts 相关类型
export interface EChartsSeriesOption {
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

export interface EChartsOption {
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
  series: EChartsSeriesOption[];
}