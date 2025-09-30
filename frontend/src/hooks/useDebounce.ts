import { useState, useEffect, useRef } from 'react';

/**
 * 防抖Hook - 延迟执行函数，用于搜索输入等场景
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清除上一次的定时器
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调Hook - 延迟执行回调函数
 * @param callback 回调函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = ((...args: Parameters<T>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const newTimer = setTimeout(() => {
      callback(...args);
      setDebounceTimer(null);
    }, delay);

    setDebounceTimer(newTimer);
  }) as T;

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return debouncedCallback;
}

/**
 * 防抖搜索Hook - 专门用于搜索场景
 * @param initialQuery 初始搜索查询
 * @param delay 延迟时间（毫秒）
 * @returns [searchQuery, debouncedQuery, setSearchQuery, isDebouncing]
 */
export function useDebouncedSearch(
  initialQuery: string = '',
  delay: number = 300
) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(searchQuery, delay);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    if (searchQuery !== debouncedQuery) {
      setIsDebouncing(true);
    } else {
      setIsDebouncing(false);
    }
  }, [searchQuery, debouncedQuery]);

  return {
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    isDebouncing
  };
}

/**
 * 带缓存的搜索Hook - 缓存搜索结果避免重复计算
 * @param searchFn 搜索函数
 * @param cacheSize 缓存大小
 * @returns 带缓存的搜索函数
 */
export function useCachedSearch<T, R>(
  searchFn: (query: T) => Promise<R[]>,
  cacheSize: number = 10
) {
  const cache = useRef<Map<string, { results: R[]; timestamp: number }>>(new Map());
  const [loading, setLoading] = useState(false);

  const search = async (query: T): Promise<R[]> => {
    const cacheKey = String(query);

    // 检查缓存
    const cached = cache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5分钟缓存
      return cached.results;
    }

    setLoading(true);
    try {
      const results = await searchFn(query);

      // 缓存结果
      cache.current.set(cacheKey, {
        results,
        timestamp: Date.now()
      });

      // 清理过期缓存
      if (cache.current.size > cacheSize) {
        const oldestKey = cache.current.keys().next().value;
        if (oldestKey) {
          cache.current.delete(oldestKey);
        }
      }

      return results;
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    cache.current.clear();
  };

  return {
    search,
    loading,
    clearCache
  };
}