/**
 * 增强版代码分割工具
 *
 * 提供更精细化的代码分割策略，包括组件级别的懒加载和预加载
 */

import { lazy, ComponentType } from 'react';
import { LazyLoader } from '@/utils/lazyLoader';

// 组件加载状态
export enum ComponentLoadState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

// 懒加载组件配置
export interface LazyComponentConfig {
  /** 预加载策略 */
  preloadStrategy?: 'idle' | 'visible' | 'hover' | 'immediate';
  /** 缓存时间（毫秒） */
  cacheTime?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 自定义加载组件 */
  fallback?: ComponentType;
  /** 自定义错误组件 */
  errorFallback?: ComponentType<{ error?: Error; onRetry: () => void }>;
  /** 优先级（用于预加载排序） */
  priority?: number;
}

// 组件加载结果
export interface ComponentLoadResult<T = any> {
  state: ComponentLoadState;
  component?: ComponentType<T>;
  error?: Error;
  retry: () => void;
  preload: () => Promise<void>;
}

// 预注册的懒加载组件
const registeredComponents = new Map<string, {
  importFn:() => Promise<{ default: ComponentType<any> }>;
  config: LazyComponentConfig;
  loaded?: boolean;
  loadPromise?: Promise<ComponentType<any>>;
}>();

/**
 * 增强版代码分割管理器
 */
export class EnhancedCodeSplitting {
  /**
   * 注册懒加载组件
   */
  static registerComponent(
    name: string,
    importFn: () => Promise<{ default: ComponentType<any> }>,
    config: LazyComponentConfig = {},
  ): void {
    registeredComponents.set(name, {
      importFn,
      config: {
        preloadStrategy: 'idle',
        cacheTime: 5 * 60 * 1000, // 5分钟
        timeout: 10000,
        retryCount: 3,
        priority: 5,
        ...config,
      },
    });
  }

  /**
   * 创建懒加载组件
   */
  static createLazyComponent<T = any>(
    name: string,
    _config?: LazyComponentConfig,
  ): ComponentType<T> {
    const registration = registeredComponents.get(name);
    if (!registration) {
      throw new Error(`组件 ${name} 未注册`);
    }

    // 使用React.lazy创建懒加载组件
    const LazyComponent = lazy(registration.importFn);

    return LazyComponent as ComponentType<T>;
  }

  /**
   * 带重试的组件加载
   */
  private static async loadComponentWithRetry<T>(
    name: string,
    importFn: () => Promise<{ default: T }>,
    config: LazyComponentConfig,
  ): Promise<T> {
    const {
      timeout = 10000,
      retryCount = 3,
      cacheTime = 5 * 60 * 1000,
    } = config;

    // 检查缓存
    if (LazyLoader.isCached(name)) {
      console.log(`📦 从缓存加载组件: ${name}`);
      const cached = LazyLoader.createLazyComponent(importFn, name, { cacheTime })();
      return cached;
    }

    let lastError: Error;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // 超时控制
        const result = await Promise.race([
          importFn(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`组件 ${name} 加载超时`)), timeout);
          }),
        ]);

        // 标记已加载
        const registration = registeredComponents.get(name);
        if (registration) {
          registration.loaded = true;
        }

        console.log(`✅ 组件加载成功: ${name} (尝试 ${attempt + 1})`);
        return result.default;

      } catch (error) {
        lastError = error as Error;
        console.warn(`❌ 组件 ${name} 加载失败 (尝试 ${attempt + 1}):`, error);

        if (attempt === retryCount) {
          break;
        }

        // 指数退避延迟
        const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * 预加载组件
   */
  static async preloadComponent(name: string): Promise<void> {
    const registration = registeredComponents.get(name);
    if (!registration) {
      console.warn(`组件 ${name} 未注册，无法预加载`);
      return;
    }

    if (registration.loaded) {
      console.log(`📦 组件 ${name} 已加载`);
      return;
    }

    if (registration.loadPromise) {
      console.log(`⏳ 组件 ${name} 正在加载中`);
      return;
    }

    console.log(`🚀 开始预加载组件: ${name}`);
    registration.loadPromise = this.loadComponentWithRetry(
      name,
      registration.importFn,
      registration.config,
    );

    try {
      await registration.loadPromise;
      console.log(`✅ 组件预加载成功: ${name}`);
    } catch (error) {
      console.warn(`❌ 组件预加载失败: ${name}`, error);
      registration.loadPromise = undefined;
    }
  }

  /**
   * 批量预加载组件
   */
  static async preloadComponents(
    componentNames?: string[],
    strategy: 'priority' | 'parallel' = 'priority',
  ): Promise<void> {
    const componentsToPreload = componentNames || Array.from(registeredComponents.keys());

    if (strategy === 'priority') {
      // 按优先级排序预加载
      const sortedComponents = componentsToPreload
        .map(name => ({
          name,
          priority: registeredComponents.get(name)?.config.priority || 5,
        }))
        .sort((a, b) => b.priority - a.priority);

      for (const { name } of sortedComponents) {
        try {
          await this.preloadComponent(name);
        } catch (error) {
          console.warn(`预加载组件 ${name} 失败:`, error);
        }
      }
    } else {
      // 并行预加载
      await Promise.allSettled(
        componentsToPreload.map(name => this.preloadComponent(name)),
      );
    }
  }

  /**
   * 基于策略的智能预加载
   */
  static setupSmartPreloading(): void {
    // 浏览器空闲时预加载高优先级组件
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const highPriorityComponents = Array.from(registeredComponents.entries())
          .filter(([_, config]) => (config.config.priority || 5) >= 7)
          .map(([name]) => name);

        console.log('🎯 智能预加载高优先级组件:', highPriorityComponents);
        this.preloadComponents(highPriorityComponents, 'priority');
      });
    } else {
      // 降级方案：延迟预加载
      setTimeout(() => {
        this.preloadComponents(undefined, 'priority');
      }, 2000);
    }
  }

  /**
   * 基于用户行为的预加载
   */
  static setupBehavioralPreloading(): void {
    // 鼠标悬停预加载
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      const preloadTarget = target.closest('[data-preload-component]');

      if (preloadTarget) {
        const componentName = preloadTarget.getAttribute('data-preload-component');
        if (componentName) {
          this.preloadComponent(componentName);
        }
      }
    });

    // 路由变化预加载
    let currentPath = window.location.pathname;
    const checkRouteChange = () => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        currentPath = newPath;
        this.preloadByRoute(newPath);
      }
    };

    // 监听路由变化
    window.addEventListener('popstate', checkRouteChange);
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      checkRouteChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      checkRouteChange();
    };
  }

  /**
   * 根据路径预加载组件
   */
  private static preloadByRoute(path: string): void {
    const routeComponentMap: Record<string, string[]> = {
      '/admin': ['AdminHome', 'AdminDashboard'],
      '/chat': ['AgentWorkspace', 'ChatInterface'],
      '/product': ['ProductPreviewWorkspace', 'ProductViewer'],
      '/voice': ['VoiceCallWorkspace', 'VoiceInterface'],
    };

    // 查找匹配的路由
    for (const [route, components] of Object.entries(routeComponentMap)) {
      if (path.startsWith(route)) {
        console.log(`🛣️ 路由变化预加载: ${route} -> ${components}`);
        this.preloadComponents(components, 'parallel');
        break;
      }
    }
  }

  /**
   * 获取已注册组件列表
   */
  static getRegisteredComponents(): string[] {
    return Array.from(registeredComponents.keys());
  }

  /**
   * 获取组件加载状态
   */
  static getComponentLoadState(name: string): 'idle' | 'loading' | 'loaded' | 'error' {
    const registration = registeredComponents.get(name);
    if (!registration) {
return 'idle';
}

    if (registration.loaded) {
return 'loaded';
}
    if (registration.loadPromise) {
return 'loading';
}
    return 'idle';
  }

  /**
   * 清除组件缓存
   */
  static clearComponentCache(name?: string): void {
    if (name) {
      LazyLoader.clearCache();
      const registration = registeredComponents.get(name);
      if (registration) {
        registration.loaded = false;
        registration.loadPromise = undefined;
      }
    } else {
      LazyLoader.clearCache();
      registeredComponents.forEach(registration => {
        registration.loaded = false;
        registration.loadPromise = undefined;
      });
    }
  }

  /**
   * 获取代码分割统计信息
   */
  static getStats(): {
    totalRegistered: number;
    loadedCount: number;
    loadingCount: number;
    idleCount: number;
    components: Array<{
      name: string;
      state: string;
      priority: number;
    }>;
  } {
    const components = Array.from(registeredComponents.entries()).map(([name, reg]) => ({
      name,
      state: this.getComponentLoadState(name),
      priority: reg.config.priority || 5,
    }));

    return {
      totalRegistered: components.length,
      loadedCount: components.filter(c => c.state === 'loaded').length,
      loadingCount: components.filter(c => c.state === 'loading').length,
      idleCount: components.filter(c => c.state === 'idle').length,
      components,
    };
  }
}

export default EnhancedCodeSplitting;