/**
 * 增强版代码分割Hook
 *
 * 提供更强大的代码分割功能，包括智能预加载、性能监控等
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SimpleCodeSplitting } from '@/utils/simpleCodeSplitting';

// 组件加载状态
export enum ComponentState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}

// Hook配置选项
export interface UseEnhancedCodeSplittingOptions {
  /** 是否自动预加载 */
  autoPreload?: boolean;
  /** 预加载延迟（毫秒） */
  preloadDelay?: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 自定义缓存策略 */
  cacheStrategy?: 'memory' | 'localStorage' | 'none';
  /** 预加载策略 */
  preloadStrategy?: 'immediate' | 'idle' | 'visible' | 'hover';
}

// Hook返回值
export interface UseEnhancedCodeSplittingReturn {
  /** 组件状态 */
  state: ComponentState;
  /** 组件是否已加载 */
  isLoaded: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否有错误 */
  hasError: boolean;
  /** 错误信息 */
  error: Error | undefined;
  /** 加载时间（毫秒） */
  loadTime: number;
  /** 重试加载 */
  retry: () => Promise<void>;
  /** 预加载组件 */
  preload: () => Promise<void>;
  /** 清除缓存 */
  clearCache: () => void;
  /** 获取性能统计 */
  getStats: () => {
    loadTime: number;
    retryCount: number;
    cacheHit: boolean;
  };
}

/**
 * 增强版代码分割Hook
 */
export function useEnhancedCodeSplitting(
  componentName: string,
  options: UseEnhancedCodeSplittingOptions = {},
): UseEnhancedCodeSplittingReturn {
  const {
    autoPreload = true,
    preloadDelay = 1000,
    enablePerformanceMonitoring = true,
    // cacheStrategy = 'memory', // 暂时未使用
    preloadStrategy = 'idle',
  } = options;

  const [state, setState] = useState(ComponentState.IDLE);
  const [error, setError] = useState<Error | undefined>();
  const [loadTime, setLoadTime] = useState<number | undefined>();
  const [retryCount, setRetryCount] = useState(0);

  const mountedRef = useRef<boolean>(false);
  const loadStartTimeRef = useRef<number>(0);

  // 获取组件加载状态
  const getComponentState = useCallback((): ComponentState => {
    if (SimpleCodeSplitting.isLoaded(componentName)) {
      return ComponentState.LOADED;
    }
    return ComponentState.IDLE;
  }, [componentName]);

  // 加载组件
  const loadComponent = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) {
      return;
    }

    const currentState = getComponentState();
    if (currentState === ComponentState.LOADED || currentState === ComponentState.LOADING) {
      return;
    }

    setState(ComponentState.LOADING);
    setError(undefined);
    loadStartTimeRef.current = performance.now();

    try {
      await SimpleCodeSplitting.preloadComponent(componentName);

      const loadDuration = performance.now() - loadStartTimeRef.current;
      setLoadTime(loadDuration);
      setState(ComponentState.LOADED);

      if (enablePerformanceMonitoring) {
        console.log(`📊 组件 ${componentName} 加载性能:`, {
          loadTime: loadDuration,
          retryCount,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      setState(ComponentState.ERROR);
      console.warn(`❌ 组件 ${componentName} 加载失败:`, error);
    }
  }, [componentName, getComponentState, enablePerformanceMonitoring, retryCount]);

  // 重试加载
  const retry = useCallback(async (): Promise<void> => {
    setRetryCount(prev => prev + 1);
    await loadComponent();
  }, [loadComponent]);

  // 预加载组件
  const preload = useCallback(async (): Promise<void> => {
    await SimpleCodeSplitting.preloadComponent(componentName);
  }, [componentName]);

  // 清除缓存
  const clearCache = useCallback((): void => {
    SimpleCodeSplitting.clearCache(componentName);
    setState(ComponentState.IDLE);
    setError(undefined);
    setLoadTime(undefined);
  }, [componentName]);

  // 获取性能统计
  const getStats = useCallback((): { loadTime: number; retryCount: number; cacheHit: boolean } => {
    return {
      loadTime: loadTime || 0,
      retryCount,
      cacheHit: SimpleCodeSplitting.isLoaded(componentName),
    };
  }, [loadTime, retryCount, componentName]);

  // 自动预加载
  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    if (autoPreload && preloadStrategy === 'immediate') {
      loadComponent();
    } else if (autoPreload && preloadStrategy === 'idle') {
      const timer = setTimeout(() => {
        loadComponent();
      }, preloadDelay);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [autoPreload, preloadDelay, preloadStrategy, loadComponent]);

  // 监听组件状态变化
  useEffect(() => {
    const currentState = getComponentState();
    if (currentState !== state) {
      setState(currentState);
    }
  }, [getComponentState, state]);

  // 设置挂载状态
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    state,
    isLoaded: state === ComponentState.LOADED,
    isLoading: state === ComponentState.LOADING,
    hasError: state === ComponentState.ERROR,
    error,
    loadTime: loadTime || 0,
    retry,
    preload,
    clearCache,
    getStats,
  };
}