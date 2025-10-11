export interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversionRate: number;
  topPages: Array<{
    path: string;
    views: number;
  }>;
  trafficSources: Array<{
    source: string;
    visitors: number;
    percentage: number;
  }>;
}

export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  // 模拟API调用
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        pageViews: 125432,
        uniqueVisitors: 8934,
        bounceRate: 32.5,
        avgSessionDuration: 245,
        conversionRate: 4.2,
        topPages: [
          { path: '/dashboard', views: 3421 },
          { path: '/chat', views: 2891 },
          { path: '/agents', views: 1934 },
        ],
        trafficSources: [
          { source: 'direct', visitors: 3456, percentage: 38.7 },
          { source: 'search', visitors: 2890, percentage: 32.4 },
          { source: 'social', visitors: 1234, percentage: 13.8 },
          { source: 'referral', visitors: 1354, percentage: 15.1 },
        ],
      });
    }, 100);
  });
};

export const getAnalyticsSummary = async () => {
  const data = await getAnalyticsData();
  return {
    totalUsers: data.uniqueVisitors,
    activeUsers: Math.floor(data.uniqueVisitors * 0.6),
    totalSessions: Math.floor(data.pageViews * 0.8),
    avgSessionTime: data.avgSessionDuration,
  };
};

export const getProvinceHeatmap = async () => {
  // 模拟省份热力图数据
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { province: '北京', value: 1234, lat: 39.9042, lng: 116.4074 },
        { province: '上海', value: 987, lat: 31.2304, lng: 121.4737 },
        { province: '广东', value: 756, lat: 23.1291, lng: 113.2644 },
        { province: '江苏', value: 543, lat: 32.0617, lng: 118.7778 },
      ]);
    }, 100);
  });
};

export const listAgents = async () => {
  // 模拟智能体列表
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 'agent-1', name: 'GPT-4', type: 'openai', status: 'active' },
        { id: 'agent-2', name: 'Claude', type: 'anthropic', status: 'active' },
        { id: 'agent-3', name: 'FastGPT', type: 'fastgpt', status: 'inactive' },
      ]);
    }, 50);
  });
};