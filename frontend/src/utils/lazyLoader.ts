/**
 * 简化的懒加载工具
 *
 * 提供基础的懒加载功能，避免复杂的依赖问题
 */

// 加载状态枚举
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

// 加载结果接口
export interface LoadResult<T = any> {
  state: LoadingState;
  data?: T;
  error?: Error;
  retry?: () => void;
}

// 组件缓存
const componentCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

/**
 * 懒加载工具类
 */
export class LazyLoader {
  /**
   * 创建懒加载组件
   */
  static createLazyComponent<T = any>(
    importFn: () => Promise<{ default: T }>,
    componentName: string,
    options: {
      cacheTime?: number;
      retryCount?: number;
      timeout?: number;
    } = {},
  ): () => Promise<T> {
    const {
      cacheTime = CACHE_DURATION,
      retryCount = 3,
      timeout = 10000,
    } = options;

    return async (): Promise<T> => {
      // 检查缓存
      const cached = componentCache.get(componentName);
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        return cached.data;
      }

      // 加载组件
      let lastError: Error;

      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          // 超时控制
          const result = await Promise.race([
            importFn(),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('加载超时')), timeout);
            }),
          ]);

          const data = result.default;

          // 缓存结果
          componentCache.set(componentName, {
            data,
            timestamp: Date.now(),
          });

          // 清理过期缓存
          LazyLoader.cleanupCache();

          return data;
        } catch (error) {
          lastError = error as Error;
          console.warn(`组件 ${componentName} 加载尝试 ${attempt + 1} 失败:`, error);

          if (attempt === retryCount) {
            throw lastError;
          }

          // 指数退避延迟
          const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError!;
    };
  }

  /**
   * 预加载组件
   */
  static async preloadComponent<T = any>(
    importFn: () => Promise<{ default: T }>,
    componentName: string,
  ): Promise<void> {
    try {
      await this.createLazyComponent(importFn, componentName)();
      console.log(`✅ 预加载成功: ${componentName}`);
    } catch (error) {
      console.warn(`❌ 预加载失败: ${componentName}`, error);
    }
  }

  /**
   * 批量预加载
   */
  static async preloadComponents(
    components: Array<{
      importFn: () => Promise<{ default: any }>;
      name: string;
      priority?: number;
    }>,
  ): Promise<void> {
    // 按优先级排序
    const sortedComponents = components.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // 分批预加载
    const batchSize = 2;
    for (let i = 0; i < sortedComponents.length; i += batchSize) {
      const batch = sortedComponents.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(({ importFn, name }) => this.preloadComponent(importFn, name)),
      );

      // 批次间延迟
      if (i + batchSize < sortedComponents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * 清理过期缓存
   */
  static cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, cached] of componentCache.entries()) {
      if (now - cached.timestamp > CACHE_DURATION) {
        componentCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.debug(`清理了 ${cleanedCount} 个过期缓存项`);
    }
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): {
    size: number;
    items: Array<{ name: string; age: number }>;
  } {
    const now = Date.now();
    const items = Array.from(componentCache.entries()).map(([name, cached]) => ({
      name,
      age: now - cached.timestamp,
    }));

    return {
      size: componentCache.size,
      items,
    };
  }

  /**
   * 清空所有缓存
   */
  static clearCache(): void {
    componentCache.clear();
    console.log('已清空所有组件缓存');
  }

  /**
   * 检查组件是否已缓存
   */
  static isCached(componentName: string): boolean {
    const cached = componentCache.get(componentName);
    if (!cached) {
return false;
}

    return Date.now() - cached.timestamp < CACHE_DURATION;
  }
}

export default LazyLoader;