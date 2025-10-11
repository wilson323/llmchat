/**
 * 代码分割React Hook
 *
 * 提供简单易用的Hook来管理组件懒加载和代码分割
 */

import { useState, useEffect, useCallback } from 'react';

// 定义组件加载状态
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}

// 定义加载结果类型
export interface LoadResult<T> {
  state: LoadingState;
  data?: T;
  error?: Error;
  retry: () => Promise<void>;
}

// 简化的配置接口
interface ComponentLoaderConfig {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * 使用代码分割的Hook
 */
export function useCodeSplitting<T>(
  importFn: () => Promise<any>,
  componentName: string,
  config: ComponentLoaderConfig = {}
): LoadResult<T> {
  const [loadResult, setLoadResult] = useState<LoadResult<T>>({
    state: LoadingState.IDLE,
    retry: () => Promise.resolve(),
  });

  const loadComponent = useCallback(async () => {
    setLoadResult({ state: LoadingState.LOADING, retry: loadComponent });

    try {
      const module = await importFn();
      const component = module.default || module;

      setLoadResult({
        state: LoadingState.LOADED,
        data: component,
        retry: loadComponent,
      });
    } catch (error) {
      const err = error as Error;
      setLoadResult({
        state: LoadingState.ERROR,
        error: err,
        retry: loadComponent,
      });
    }
  }, [importFn]);

  // 自动加载组件
  useEffect(() => {
    loadComponent();
  }, [loadComponent]);

  return loadResult;
}