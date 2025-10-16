/**
 * 通用虚拟滚动组件
 * 支持动态高度和多种使用场景
 */

'use client';
;
import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
// import { performanceAnalyzer } from '@/utils/performanceAnalysis'; // 已删除，使用原生性能API

export interface VirtualScrollItem<T = unknown> {
  index: number;
  data: T | undefined;
  key?: string;
  height?: number;
}

export interface VirtualScrollProps<T = unknown> {
  // 数据相关
  items: T[];
  itemKey?: (item: T, index: number) => string;
  itemHeight?: number | ((item: T, index: number) => number);

  // 容器相关
  height?: number;
  className?: string;
  style?: React.CSSProperties;

  // 渲染相关
  renderItem: (item: VirtualScrollItem<T>) => React.ReactNode;
  onScroll?: (scrollTop: number) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;

  // 性能相关
  overscan?: number;
  estimatedItemHeight?: number;

  // 其他
  emptyComponent?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  loading?: boolean;
  hasMore?: boolean;
}

// 定义虚拟滚动器的ref类型
export interface VirtualScrollRef {
  scrollToItem: (index: number) => void;
  scrollToTop: () => void;
  getScrollTop: () => number;
  getContainer: () => HTMLDivElement | null;
}

export const VirtualScroll = React.forwardRef<HTMLDivElement, VirtualScrollProps>(function VirtualScroll<T = unknown>({
  items,
  itemKey = (_item, index) => index.toString(),
  itemHeight,
  height = 400,
  className = '',
  style = {},
  renderItem,
  onScroll,
  onEndReached,
  endReachedThreshold = 100,
  overscan = 5,
  estimatedItemHeight = 50,
  emptyComponent,
  loadingComponent,
  loading = false,
  hasMore = true,
}: VirtualScrollProps<T>, ref: React.ForwardedRef<HTMLDivElement>) {
  const [_scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // 计算项目高度函数
  const getItemHeight = useCallback((index: number) => {
    if (typeof itemHeight === 'function') {
      const item = items[index];
      if (item === undefined) return estimatedItemHeight;
      return itemHeight(item, index);
    }
    if (typeof itemHeight === 'number') {
      return itemHeight;
    }
    return estimatedItemHeight;
  }, [items, itemHeight, estimatedItemHeight]);

  // 虚拟滚动计算
  const {
    virtualItems,
    totalHeight,
    scrollToIndex,
    scrollToTop,
  } = useVirtualScroll({
    itemHeight: getItemHeight,
    containerHeight: height,
    itemCount: items.length,
    overscan,
  });

  // 虚拟项目数据
  const virtualItemsData = useMemo(() => {
    return virtualItems.map(({ index, key, start, size }) => {
      const item = items[index];
      return {
        index,
        key: key || (item !== undefined ? itemKey(item, index) : `virtual-${index}`),
        data: item,
        height: size,
        start,
      };
    });
  }, [virtualItems, items, itemKey]);

  // 滚动处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);

    // 检查是否滚动到底部
    if (onEndReached && hasMore && !loading) {
      const { scrollHeight, clientHeight } = e.currentTarget;
      const distanceFromBottom = scrollHeight - clientHeight - newScrollTop;

      if (distanceFromBottom <= endReachedThreshold) {
        // 防抖处理
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          onEndReached();
        }, 100);
      }
    }
  }, [onScroll, onEndReached, hasMore, loading, endReachedThreshold]);

  // 滚动到指定项目
  const scrollToItem = useCallback((index: number) => {
    scrollToIndex(index);
  }, [scrollToIndex]);

  // 滚动到顶部
  const scrollToTopAction = useCallback(() => {
    scrollToTop();
  }, [scrollToTop]);

  // 暴露滚动控制方法
  React.useImperativeHandle(ref, () => {
    const container = containerRef.current;
    if (container) {
      // Add custom methods to the container element
      const extendedContainer: any = container;
      extendedContainer.scrollToItem = scrollToItem;
      extendedContainer.scrollToTop = scrollToTopAction;
      extendedContainer.getScrollTop = () => extendedContainer.scrollTop || 0;
      extendedContainer.getContainer = () => extendedContainer;
      return extendedContainer;
    }
    return document.createElement('div'); // Return empty div as fallback
  }, [scrollToItem, scrollToTopAction]);

  // 性能监控
  let startMeasure: () => void;
  let endMeasure: () => number | undefined;

  if (true) { // 总是启用性能监控
    startMeasure = () => performance.mark('virtual-scroll-start');
    endMeasure = () => {
      try {
        performance.mark('virtual-scroll-end');
        performance.measure('VirtualScroll', 'virtual-scroll-start', 'virtual-scroll-end');
        const measures = performance.getEntriesByName('VirtualScroll');
        return measures[measures.length - 1]?.duration;
      } catch (error) {
        console.warn('性能测量失败:', error);
        return undefined;
      }
    };
  }

  useEffect(() => {
    if (true) { // 总是启用性能监控
      startMeasure();

      return () => {
        const duration = endMeasure();
        if (duration !== undefined) {
          console.log(`VirtualScroll 渲染耗时: ${duration.toFixed(2)}ms, 项目数: ${items.length}`);
        }
      };
    }
  }, [items.length, startMeasure, endMeasure]);

  // 渲染内容
  if (items.length === 0 && !loading) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
        style={{ height, ...style }}
        >
        {emptyComponent || (
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium">暂无数据</div>
            <div className="text-sm mt-2">请稍后再试</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height, ...style }}
      onScroll={handleScroll}
      >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItemsData.map((item) => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: item.start,
              left: 0,
              right: 0,
              height: item.height,
            }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border/50">
          {loadingComponent || (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3" />
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// 高阶组件版本
export function withVirtualScroll<T = unknown>(
  Component: React.ComponentType<{ item: VirtualScrollItem<T> }>,
) {
  const WrappedComponent = React.memo(function WithVirtualScroll({ items, ...props }: any) {
    return (
      <VirtualScroll
        items={items}
        renderItem={(item: any) => <Component item={item} {...props} />}
        {...props}
      />
    );
  });

  WrappedComponent.displayName = `withVirtualScroll(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook版本，用于获取虚拟滚动控制
export function useVirtualScrollControl() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToItem = useCallback((index: number) => {
    const container = containerRef.current;
    if (container) {
      const _items = container.querySelectorAll('[data-virtual-item]');
      const targetItem = _items[index];
      if (targetItem) {
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  const scrollToTop = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  return {
    containerRef,
    scrollToItem,
    scrollToTop,
    scrollToBottom,
  };
}

// 添加显示的类型声明
VirtualScroll.displayName = 'VirtualScroll';

export default VirtualScroll;