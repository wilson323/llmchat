/**
 * 组件注册表
 *
 * 统一管理所有需要懒加载的组件配置
 */

import { EnhancedCodeSplitting } from './enhancedCodeSplitting';


// 基础页面组件 - 高优先级
const pageComponents = {
  // 主要页面
  'ChatApp': {
    importFn: () => import('@/components/ChatApp'),
    priority: 10,
    preloadStrategy: 'immediate' as const,
    cacheTime: 10 * 60 * 1000, // 10分钟
  },

  // 工作区组件
  'AgentWorkspace': {
    importFn: () => import('@/components/workspace/AgentWorkspace'),
    priority: 9,
    preloadStrategy: 'idle' as const,
    cacheTime: 15 * 60 * 1000,
  },

  // 管理后台
  'AdminHome': {
    importFn: () => import('@/components/admin/AdminHome'),
    priority: 7,
    preloadStrategy: 'idle' as const,
    cacheTime: 10 * 60 * 1000,
  },

  // 登录页面
  'LoginPage': {
    importFn: () => import('@/components/admin/LoginPage'),
    priority: 8,
    preloadStrategy: 'hover' as const,
    cacheTime: 20 * 60 * 1000,
  },
};

// 功能组件 - 中等优先级
const featureComponents = {
  // 产品预览工作区
  'ProductPreviewWorkspace': {
    importFn: () => import('@/components/product/ProductPreviewWorkspace'),
    priority: 6,
    preloadStrategy: 'visible' as const,
    cacheTime: 8 * 60 * 1000,
  },

  // 语音通话工作区
  'VoiceCallWorkspace': {
    importFn: () => import('@/components/voice/VoiceCallWorkspace'),
    priority: 6,
    preloadStrategy: 'visible' as const,
    cacheTime: 8 * 60 * 1000,
  },

  // CAD查看器
  'CadViewerEnhanced': {
    importFn: () => import('@/components/cad/CadViewerEnhanced'),
    priority: 4,
    preloadStrategy: 'idle' as const,
    cacheTime: 15 * 60 * 1000,
  },

  // CAD上传器
  'CadUploadEnhanced': {
    importFn: () => import('@/components/cad/CadUploadEnhanced'),
    priority: 4,
    preloadStrategy: 'hover' as const,
    cacheTime: 12 * 60 * 1000,
  },
};

// 图表和数据可视化组件 - 低优先级，按需加载
const chartComponents = {
  // ECharts组件
  'EChartsComponents': {
    importFn: () => import('@/components/charts/EChartsComponents').then(m => ({ default: m.EChartsComponents || m.default || m })),
    priority: 2,
    preloadStrategy: 'idle' as const,
    cacheTime: 20 * 60 * 1000,
  },

  // 性能监控仪表板
  'PerformanceDashboard': {
    importFn: () => import('@/components/monitoring/PerformanceDashboard'),
    priority: 3,
    preloadStrategy: 'idle' as const,
    cacheTime: 10 * 60 * 1000,
  },
};

// 高级功能组件 - 最低优先级
const advancedComponents = {
  // 图片画廊
  'ImageGallery': {
    importFn: () => import('@/components/ui/ImageGallery'),
    priority: 1,
    preloadStrategy: 'hover' as const,
    cacheTime: 15 * 60 * 1000,
  },

  // 虚拟滚动组件
  'VirtualScroll': {
    importFn: () => import('@/components/ui/VirtualScroll'),
    priority: 1,
    preloadStrategy: 'idle' as const,
    cacheTime: 12 * 60 * 1000,
  },
};

/**
 * 初始化组件注册表
 */
export function initializeComponentRegistry(): void {
  console.log('🔧 初始化组件注册表...');

  // 注册基础页面组件
  Object.entries(pageComponents).forEach(([name, config]) => {
    EnhancedCodeSplitting.registerComponent(name, config.importFn, {
      priority: config.priority,
      preloadStrategy: config.preloadStrategy,
      cacheTime: config.cacheTime,
    });
  });

  // 注册功能组件
  Object.entries(featureComponents).forEach(([name, config]) => {
    EnhancedCodeSplitting.registerComponent(name, config.importFn, {
      priority: config.priority,
      preloadStrategy: config.preloadStrategy,
      cacheTime: config.cacheTime,
    });
  });

  // 注册图表组件
  Object.entries(chartComponents).forEach(([name, config]) => {
    EnhancedCodeSplitting.registerComponent(name, config.importFn, {
      priority: config.priority,
      preloadStrategy: config.preloadStrategy,
      cacheTime: config.cacheTime,
    });
  });

  // 注册高级功能组件
  Object.entries(advancedComponents).forEach(([name, config]) => {
    EnhancedCodeSplitting.registerComponent(name, config.importFn, {
      priority: config.priority,
      preloadStrategy: config.preloadStrategy,
      cacheTime: config.cacheTime,
    });
  });

  console.log(`✅ 组件注册表初始化完成，共注册 ${
    Object.keys(pageComponents).length +
    Object.keys(featureComponents).length +
    Object.keys(chartComponents).length +
    Object.keys(advancedComponents).length
  } 个组件`);
}

/**
 * 获取特定类别的组件列表
 */
export function getComponentsByCategory(category: 'pages' | 'features' | 'charts' | 'advanced'): string[] {
  switch (category) {
    case 'pages':
      return Object.keys(pageComponents);
    case 'features':
      return Object.keys(featureComponents);
    case 'charts':
      return Object.keys(chartComponents);
    case 'advanced':
      return Object.keys(advancedComponents);
    default:
      return [];
  }
}

/**
 * 预加载特定类别的组件
 */
export async function preloadComponentsByCategory(category: 'pages' | 'features' | 'charts' | 'advanced'): Promise<void> {
  const componentNames = getComponentsByCategory(category);
  console.log(`🚀 预加载 ${category} 类别组件:`, componentNames);
  await EnhancedCodeSplitting.preloadComponents(componentNames, 'priority');
}

/**
 * 预加载关键组件（高优先级）
 */
export async function preloadCriticalComponents(): Promise<void> {
  const criticalComponents = [
    'ChatApp',
    'AgentWorkspace',
    'LoginPage',
  ];

  console.log('🎯 预加载关键组件:', criticalComponents);
  await EnhancedCodeSplitting.preloadComponents(criticalComponents, 'priority');
}

/**
 * 基于用户角色的组件预加载
 */
export async function preloadComponentsByRole(role: 'admin' | 'user' | 'guest'): Promise<void> {
  const roleComponents = {
    admin: ['AdminHome', 'PerformanceDashboard', 'EChartsComponents'],
    user: ['AgentWorkspace', 'ProductPreviewWorkspace', 'VoiceCallWorkspace'],
    guest: ['ChatApp', 'LoginPage'],
  };

  const components = roleComponents[role] || roleComponents.guest;
  console.log(`👤 预加载 ${role} 角色组件:`, components);
  await EnhancedCodeSplitting.preloadComponents(components, 'priority');
}

/**
 * 获取组件配置信息
 */
export function getComponentConfig(name: string) {
  const allConfigs = { ...pageComponents, ...featureComponents, ...chartComponents, ...advancedComponents };
  return allConfigs[name as keyof typeof allConfigs];
}

/**
 * 检查组件是否存在
 */
export function hasComponent(name: string): boolean {
  const allConfigs = { ...pageComponents, ...featureComponents, ...chartComponents, ...advancedComponents };
  return name in allConfigs;
}

// 导出所有配置
export {
  pageComponents,
  featureComponents,
  chartComponents,
  advancedComponents,
};