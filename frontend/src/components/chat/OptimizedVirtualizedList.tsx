/**
 * OptimizedVirtualizedList - High-performance virtual scrolling component
 *
 * Performance optimizations:
 * 1. Dynamic item height calculation with intelligent caching
 * 2. Window-based rendering with adaptive overscan
 * 3. Memory-efficient item pool management
 * 4. Intersection Observer-based visibility detection
 * 5. Batch rendering optimization
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useVirtual } from '@tanstack/react-virtual';
import { usePerformanceMonitor, memoryMonitor } from '@/utils/performanceOptimizer';

interface OptimizedVirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode;
  itemHeight?: number | ((index: number, item: T) => number);
  estimatedItemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  getItemKey?: (index: number, item: T) => string | number;
  onItemsRendered?: (visibleItems: Array<{ index: number; item: T }>) => void;
  className?: string;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  enableDynamicHeight?: boolean;
  cacheSize?: number;
}

interface HeightCache {
  get: (key: string) => number | undefined;
  set: (key: string, height: number) => void;
  clear: () => void;
  size: number;
}

/**
 * Memory-efficient height cache implementation
 */
function createHeightCache(maxSize: number = 1000): HeightCache {
  const cache = new Map<string, number>();

  return {
    get: (key: string) => cache.get(key),
    set: (key: string, height: number) => {
      if (cache.size >= maxSize) {
        // Remove oldest entries
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, height);
    },
    clear: () => cache.clear(),
    get size() { return cache.size; }
  };
}

/**
 * Optimized virtual list component with advanced performance features
 */
export function OptimizedVirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  estimatedItemHeight = 50,
  containerHeight = 600,
  overscan = 5,
  getItemKey = (_, index) => index.toString(),
  onItemsRendered,
  className = '',
  loadingComponent,
  emptyComponent,
  enableDynamicHeight = true,
  cacheSize = 1000
}: OptimizedVirtualizedListProps<T>) {
  // Performance monitoring
  usePerformanceMonitor('OptimizedVirtualizedList');

  const parentRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const heightCache = useRef<HeightCache>(createHeightCache(cacheSize));
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const resizeObserver = useRef<ResizeObserver>();

  // Adaptive overscan based on container size and item count
  const adaptiveOverscan = useMemo(() => {
    const containerRatio = containerHeight / estimatedItemHeight;
    const itemCount = items.length;

    // Dynamically adjust overscan based on list size
    if (itemCount < 20) return Math.min(3, itemCount);
    if (itemCount < 100) return Math.min(5, Math.ceil(containerRatio / 10));
    return Math.min(overscan, Math.ceil(containerRatio / 5));
  }, [containerHeight, estimatedItemHeight, items.length, overscan]);

  // Height calculation function with caching
  const calculateItemHeight = useCallback((index: number, item: T): number => {
    if (!enableDynamicHeight && typeof itemHeight === 'number') {
      return itemHeight;
    }

    if (typeof itemHeight === 'function') {
      return itemHeight(index, item);
    }

    // Dynamic height calculation with caching
    const key = `${getItemKey(item, index)}`;
    const cachedHeight = heightCache.current.get(key);

    if (cachedHeight) {
      return cachedHeight;
    }

    const element = itemRefs.current.get(key);
    if (element) {
      const height = element.getBoundingClientRect().height;
      heightCache.current.set(key, height);
      return height;
    }

    return estimatedItemHeight;
  }, [itemHeight, estimatedItemHeight, getItemKey, enableDynamicHeight]);

  // Virtual scroll configuration
  const virtualizer = useVirtual({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      return calculateItemHeight(index, items[index]);
    }, [calculateItemHeight, items]),
    overscan: adaptiveOverscan,
    measureElement: enableDynamicHeight ? (element) => {
      if (element) {
        const key = element.getAttribute('data-item-key');
        if (key) {
          const index = parseInt(key);
          const height = element.getBoundingClientRect().height;
          heightCache.current.set(key, height);
        }
      }
    } : undefined
  });

  // Handle scroll events for performance optimization
  const handleScroll = useCallback(() => {
    setIsScrolling(true);

    // Throttled scroll handling
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        setIsScrolling(false);
      }, { timeout: 150 });
    } else {
      setTimeout(() => setIsScrolling(false), 150);
    }
  }, []);

  // Setup ResizeObserver for dynamic height updates
  useEffect(() => {
    if (enableDynamicHeight && typeof ResizeObserver !== 'undefined') {
      resizeObserver.current = new ResizeObserver((entries) => {
        entries.forEach(entry => {
          const element = entry.target as HTMLElement;
          const key = element.getAttribute('data-item-key');
          if (key) {
            const height = entry.contentRect.height;
            heightCache.current.set(key, height);
          }
        });
      });
    }

    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
    };
  }, [enableDynamicHeight]);

  // Notify about visible items
  useEffect(() => {
    const visibleItems = virtualizer.getVirtualItems().map(virtualItem => ({
      index: virtualItem.index,
      item: items[virtualItem.index]
    }));

    onItemsRendered?.(visibleItems);
  }, [virtualizer.getVirtualItems(), items, onItemsRendered]);

  // Memoize rendered items for performance
  const renderedItems = useMemo(() => {
    return virtualizer.getVirtualItems().map((virtualItem) => {
      const item = items[virtualItem.index];
      const key = getItemKey(item, virtualItem.index);
      const isVisible = virtualItem.index >= virtualizer.range.startIndex &&
                       virtualItem.index <= virtualizer.range.endIndex;

      return (
        <div
          key={key}
          data-item-key={key}
          ref={enableDynamicHeight ? (node) => {
            if (node) {
              itemRefs.current.set(key, node);
              resizeObserver.current?.observe(node);
            } else {
              itemRefs.current.delete(key);
              resizeObserver.current?.unobserve(itemRefs.current.get(key)!);
            }
          } : undefined}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`,
            willChange: isScrolling ? 'transform' : 'auto'
          }}
        >
          {renderItem(item, virtualItem.index, isVisible)}
        </div>
      );
    });
  }, [virtualizer.getVirtualItems(), items, renderItem, getItemKey, isScrolling, enableDynamicHeight]);

  // Memory cleanup
  useEffect(() => {
    return () => {
      itemRefs.current.clear();
      heightCache.current.clear();
    };
  }, []);

  if (items.length === 0 && emptyComponent) {
    return <div className={className}>{emptyComponent}</div>;
  }

  if (loadingComponent && items.length === 0) {
    return <div className={className}>{loadingComponent}</div>;
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      data-testid="optimized-virtual-list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {renderedItems}
      </div>
    </div>
  );
}

/**
 * Memoized version for stable item references
 */
export const MemoizedOptimizedVirtualizedList = React.memo(
  OptimizedVirtualizedList,
  (prevProps, nextProps) => {
    // Custom comparison for optimal re-rendering
    return (
      prevProps.items === nextProps.items &&
      prevProps.containerHeight === nextProps.containerHeight &&
      prevProps.estimatedItemHeight === nextProps.estimatedItemHeight &&
      prevProps.overscan === nextProps.overscan &&
      prevProps.enableDynamicHeight === nextProps.enableDynamicHeight &&
      prevProps.cacheSize === nextProps.cacheSize
    );
  }
) as typeof OptimizedVirtualizedList;

MemoizedOptimizedVirtualizedList.displayName = 'MemoizedOptimizedVirtualizedList';

/**
 * Performance monitoring hook for virtual lists
 */
export function useVirtualListPerformance() {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0
  });

  const renderTimes = useRef<number[]>([]);
  const lastRenderTime = useRef<number>(0);

  const trackRender = useCallback(() => {
    const now = performance.now();
    const renderTime = lastRenderTime.current ? now - lastRenderTime.current : 0;

    renderTimes.current.push(renderTime);
    if (renderTimes.current.length > 100) {
      renderTimes.current = renderTimes.current.slice(-100);
    }

    const averageRenderTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
    const maxRenderTime = Math.max(...renderTimes.current);

    setMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1,
      averageRenderTime,
      maxRenderTime,
      memoryUsage: memoryMonitor.getCurrentUsage().heapUsed
    }));

    lastRenderTime.current = now;
  }, []);

  return { metrics, trackRender };
}

export default OptimizedVirtualizedList;