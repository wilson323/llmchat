/**
 * 简化版代码分割工具
 *
 * 提供基础的懒加载和预加载功能，避免复杂的类型问题
 */

import { lazy } from 'react';
import type React from 'react';

// 简化的组件加载配置
export interface SimpleLazyConfig {
  /** 预加载策略 */
  preloadStrategy?: 'immediate' | 'idle' | 'hover';
  /** 优先级（1-10，数字越大优先级越高） */
  priority?: number;
  /** 是否显示加载进度 */
  showProgress?: boolean;
}

// 已注册的组件
const registeredComponents = new Map<string, {
  importFn:() => Promise<{ default: React.ComponentType<any> }>;
  config: SimpleLazyConfig;
  loaded?: boolean;
}>();

/**
 * 简化版代码分割管理器
 */
export class SimpleCodeSplitting {
  /**
   * 注册组件
   */
  static registerComponent(
    name: string,
    importFn: () => Promise<{ default: React.ComponentType<any> }>,
    config: SimpleLazyConfig = {},
  ): void {
    registeredComponents.set(name, {
      importFn,
      config: {
        preloadStrategy: 'idle',
        priority: 5,
        showProgress: false,
        ...config,
      },
    });
  }

  /**
   * 创建懒加载组件
   */
  static createLazyComponent<T = any>(
    name: string,
    _config?: SimpleLazyConfig, // 暂时未使用配置
  ): React.ComponentType<T> {
    const registration = registeredComponents.get(name);
    if (!registration) {
      throw new Error(`组件 ${name} 未注册`);
    }

    // 使用React.lazy创建懒加载组件
    const LazyComponent = lazy(registration.importFn);

    // 标记为已加载
    if (!registration.loaded) {
      registration.loaded = true;
    }

    return LazyComponent as React.ComponentType<T>;
  }

  /**
   * 预加载组件
   */
  static async preloadComponent(name: string): Promise<void> {
    const registration = registeredComponents.get(name);
    if (!registration) {
      console.warn(`组件 ${name} 未注册`);
      return;
    }

    if (registration.loaded) {
      console.log(`📦 组件 ${name} 已加载`);
      return;
    }

    try {
      console.log(`🚀 开始预加载组件: ${name}`);
      await registration.importFn();
      registration.loaded = true;
      console.log(`✅ 组件预加载成功: ${name}`);
    } catch (error) {
      console.warn(`❌ 组件预加载失败: ${name}`, error);
    }
  }

  /**
   * 批量预加载
   */
  static async preloadComponents(names: string[]): Promise<void> {
    console.log(`🚀 批量预加载组件: ${names.join(', ')}`);
    await Promise.allSettled(
      names.map(name => this.preloadComponent(name)),
    );
  }

  /**
   * 基于优先级的预加载
   */
  static async preloadByPriority(): Promise<void> {
    const components = Array.from(registeredComponents.entries())
      .filter(([_, registration]) => !registration.loaded)
      .map(([name, registration]) => ({
        name,
        priority: registration.config.priority || 5,
      }))
      .sort((a, b) => b.priority - a.priority);

    if (components.length > 0) {
      const names = components.map(c => c.name);
      await this.preloadComponents(names);
    }
  }

  /**
   * 基于策略的智能预加载
   */
  static setupSmartPreloading(): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.preloadByPriority();
      });
    } else {
      // 降级方案
      setTimeout(() => {
        this.preloadByPriority();
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
    const checkRouteChange = () => {
      const path = window.location.pathname;

      // 基于路径的预加载策略
      if (path.includes('/admin')) {
        this.preloadComponent('AdminHome');
      } else if (path.includes('/chat')) {
        this.preloadComponent('AgentWorkspace');
      } else if (path.includes('/product')) {
        this.preloadComponent('ProductPreviewWorkspace');
      } else if (path.includes('/voice')) {
        this.preloadComponent('VoiceCallWorkspace');
      }
    };

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
   * 获取组件统计
   */
  static getStats(): {
    total: number;
    loaded: number;
    loading: number;
    components: Array<{
      name: string;
      loaded: boolean;
      priority: number;
      preloadStrategy: string;
    }>;
  } {
    const components = Array.from(registeredComponents.entries()).map(([name, registration]) => ({
      name,
      loaded: !!registration.loaded,
      priority: registration.config.priority || 5,
      preloadStrategy: registration.config.preloadStrategy || 'idle',
    }));

    return {
      total: components.length,
      loaded: components.filter(c => c.loaded).length,
      loading: components.filter(c => !c.loaded).length,
      components,
    };
  }

  /**
   * 清除组件缓存
   */
  static clearCache(name?: string): void {
    if (name) {
      const registration = registeredComponents.get(name);
      if (registration) {
        registration.loaded = false;
      }
    } else {
      registeredComponents.forEach(registration => {
        registration.loaded = false;
      });
    }
  }

  /**
   * 检查组件是否已加载
   */
  static isLoaded(name: string): boolean {
    const registration = registeredComponents.get(name);
    return !!registration?.loaded;
  }

  /**
   * 获取已注册的组件列表
   */
  static getRegisteredComponents(): string[] {
    return Array.from(registeredComponents.keys());
  }
}

export default SimpleCodeSplitting;