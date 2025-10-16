/**
 * useLazyLoad - Custom hook for lazy loading components and resources
 *
 * Features:
 * 1. Intersection Observer-based lazy loading
 * 2. Loading state management
 * 3. Error handling and retry mechanism
 * 4. Performance monitoring
 * 5. Memory leak prevention
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePerformanceMonitor } from '@/utils/performanceOptimizer';

interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  retryLimit?: number;
  retryDelay?: number;
  timeout?: number;
}

interface LazyLoadResult<T> {
  component: React.ComponentType<T> | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  isVisible: boolean;
}

/**
 * Hook for lazy loading components with Intersection Observer
 */
export function useLazyLoad<T = unknown>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  options: LazyLoadOptions = {}
): LazyLoadResult<T> {
  // Performance monitoring
  usePerformanceMonitor('useLazyLoad');

  const {
    rootMargin = '50px',
    threshold = 0.1,
    retryLimit = 3,
    retryDelay = 1000,
    timeout = 10000,
  } = options;

  const [state, setState] = useState<{
    component: React.ComponentType<T> | null;
    loading: boolean;
    error: Error | null;
    isVisible: boolean;
    retryCount: number;
  }>({
    component: null,
    loading: false,
    error: null,
    isVisible: false,
    retryCount: 0,
  });

  const containerRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback((): void => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Set up Intersection Observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setState((prev) => ({ ...prev, isVisible: true }));
          }
        });
      },
      {
        root: null,
        rootMargin,
        threshold,
      }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observerRef.current.observe(currentRef);
    }

    return cleanup;
  }, [rootMargin, threshold]);

  // Load component when visible
  useEffect(() => {
    if (state.isVisible && !state.component && !state.loading && !state.error) {
      let mounted = true;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: new Error(`Component loading timeout after ${timeout}ms`),
          }));
        }
      }, timeout);

      importFn()
        .then((module) => {
          if (mounted) {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            setState({
              component: module.default,
              loading: false,
              error: null,
              isVisible: true,
              retryCount: 0,
            });
          }
        })
        .catch((error) => {
          if (mounted) {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            setState({
              component: null,
              loading: false,
              error,
              isVisible: true,
              retryCount: state.retryCount + 1,
            });
          }
        });

      return () => {
        mounted = false;
      };
    }
    return undefined;
  }, [
    state.isVisible,
    state.component,
    state.loading,
    state.error,
    state.retryCount,
    importFn,
    timeout,
  ]);

  // Retry mechanism
  const retry = useCallback((): void => {
    if (state.retryCount < retryLimit) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        retryCount: prev.retryCount + 1,
      }));

      retryTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, isVisible: true }));
      }, retryDelay);
    }
  }, [state.retryCount, retryLimit, retryDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    component: state.component,
    loading: state.loading,
    error: state.error,
    retry,
    isVisible: state.isVisible,
  };
}

/**
 * Hook for lazy loading images
 */
export function useLazyLoadImage(
  src: string,
  options: LazyLoadOptions = {}
): {
  ref: React.RefCallback<HTMLElement>;
  loaded: boolean;
  error: boolean;
  retry: () => void;
} {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { retryLimit = 3 } = options;

  const ref = useCallback((node: HTMLElement | null) => {
    if (node) {
      imgRef.current = node as HTMLImageElement;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
            }
          });
        },
        {
          rootMargin: options.rootMargin || '50px',
          threshold: options.threshold || 0.1,
        }
      );
      observerRef.current.observe(node);
    }
  }, [options.rootMargin, options.threshold]);

  const retry = useCallback((): void => {
    if (retryCount < retryLimit && imgRef.current) {
      setRetryCount((prev) => prev + 1);
      setError(false);
      setLoaded(false);

      setTimeout(() => {
        if (imgRef.current) {
          imgRef.current.src = src;
        }
      }, 1000 * retryCount);
    }
  }, [src, retryCount, retryLimit]);

  useEffect(() => {
    if (isVisible && imgRef.current && !loaded && !error) {
      const img = imgRef.current;

      img.onload = (): void => {
        setLoaded(true);
        setError(false);
      };

      img.onerror = (): void => {
        setError(true);
        retry();
      };

      img.src = src;
    }
  }, [isVisible, src, loaded, error, retry]);

  return {
    ref,
    loaded,
    error,
    retry,
  };
}

/**
 * Hook for lazy loading data with caching
 */
export function useLazyLoadData<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: {
    cacheKey?: string;
    cacheTime?: number;
    retryLimit?: number;
    retryDelay?: number;
  } = {}
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  isValidating: boolean;
} {
  const { cacheKey, cacheTime = 300000 } = options;

  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
    isValidating: boolean;
    retryCount: number;
  }>({
    data: null,
    loading: false,
    error: null,
    isValidating: false,
    retryCount: 0,
  });

  // Cache implementation
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const fetchData = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null, isValidating: true }));

    try {
      const data = await fetchFn();

      // Cache the result
      if (cacheKey) {
        cacheRef.current.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }

      setState({
        data,
        loading: false,
        error: null,
        isValidating: false,
        retryCount: 0,
      });
    } catch (error) {
      const err = error as Error;

      setState({
        data: null,
        loading: false,
        error: err,
        isValidating: false,
        retryCount: state.retryCount + 1,
      });
    }
  }, [fetchFn, cacheKey, state.retryCount]);

  const refetch = useCallback((): void => {
    // Clear cache if exists
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    }
    fetchData();
  }, [cacheKey, fetchData]);

  // Check cache on mount and when deps change
  useEffect(() => {
    if (cacheKey) {
      const cached = cacheRef.current.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < cacheTime) {
        setState({
          data: cached.data,
          loading: false,
          error: null,
          isValidating: false,
          retryCount: 0,
        });
      } else {
        fetchData();
      }
    } else {
      fetchData();
    }
  }, [...deps, cacheKey, cacheTime, fetchData]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    isValidating: state.isValidating,
  };
}

/**
 * Hook for preloading critical resources
 */
export function usePreloadResources(): {
  preload: (resources: Array<string | (() => Promise<unknown>)>) => Promise<void>;
  isPreloaded: (resource: string | (() => unknown)) => boolean;
  preloaded: Set<string>;
} {
  const [preloaded, setPreloaded] = useState<Set<string>>(new Set());

  const preload = useCallback(async (resources: Array<string | (() => Promise<unknown>)>) => {
    const results = await Promise.allSettled(
      resources.map(resource => {
        if (typeof resource === 'string') {
          // Preload image
          const img = new Image();
          return new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = resource;
          });
        } else {
          // Preload component
          return resource().then(() => true).catch(() => false);
        }
      })
    );

    const newlyPreloaded = resources.filter((_, index) => {
      const result = results[index];
      return result && result.status === 'fulfilled' && (result as PromiseFulfilledResult<boolean>).value === true;
    });

    setPreloaded((prev) => new Set([...Array.from(prev), ...newlyPreloaded.map(r => typeof r === 'string' ? r : r.toString())]));
  }, []);

  const isPreloaded = useCallback((resource: string | (() => unknown)) => {
    return preloaded.has(typeof resource === 'string' ? resource : resource.toString());
  }, [preloaded]);

  return {
    preload,
    isPreloaded,
    preloaded,
  };
}

export default useLazyLoad;