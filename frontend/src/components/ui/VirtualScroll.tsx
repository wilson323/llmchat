/**
 * 通用虚拟滚动组件
 * 支持动态高度和多种使用场景
 */

'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState, forwardRef } from 'react';
import type { VirtualScrollItem, VirtualScrollProps, VirtualScrollRef } from './ui.types';

// 简化的虚拟滚动实现（替代useVirtualScroll hook）
function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  estimatedItemHeight = 40
}: {
  items: T[];
  itemHeight?: number | ((item: T, index: number) => number);
  containerHeight: number;
  overscan?: number;
  estimatedItemHeight?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算项目高度
  const getItemHeight = useCallback((item: T, index: number) => {
    if (typeof itemHeight === 'function') {
      return itemHeight(item, index);
    }
    return itemHeight || estimatedItemHeight;
  }, [itemHeight, estimatedItemHeight]);

  // 计算虚拟项目
  const virtualItems = useMemo(() => {
    const result: Array<{
      index: number;
      top: number;
      height: number;
      key: string;
    }> = [];

    let currentTop = 0;
    const itemCount = items.length;

    // 找到起始索引
    let startIndex = 0;
    let accumulatedHeight = 0;

    for (let i = 0; i < itemCount; i++) {
      const height = getItemHeight(items[i], i);
      if (accumulatedHeight + height > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // 计算结束索引
    let endIndex = startIndex;
    let visibleHeight = 0;

    for (let i = startIndex; i < itemCount; i++) {
      const height = getItemHeight(items[i], i);
      if (visibleHeight > containerHeight + overscan * estimatedItemHeight) {
        break;
      }
      visibleHeight += height;
      endIndex = i;
    }

    endIndex = Math.min(itemCount - 1, endIndex + overscan);

    // 生成虚拟项目
    for (let i = startIndex; i <= endIndex; i++) {
      let top = 0;
      for (let j = 0; j < i; j++) {
        top += getItemHeight(items[j], j);
      }

      result.push({
        index: i,
        top,
        height: getItemHeight(items[i], i),
        key: `${i}`
      });
    }

    return result;
  }, [items, scrollTop, getItemHeight, overscan, estimatedItemHeight, containerHeight]);

  // 计算总高度
  const totalHeight = useMemo(() => {
    return items.reduce((total, item, index) => {
      return total + getItemHeight(item, index);
    }, 0);
  }, [items, getItemHeight]);

  // 滚动到指定索引
  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current && index >= 0 && index < items.length) {
      let top = 0;
      for (let i = 0; i < index; i++) {
        top += getItemHeight(items[i], i);
      }
      containerRef.current.scrollTop = top;
    }
  }, [items, getItemHeight]);

  // 滚动到指定偏移
  const scrollToOffset = useCallback((offset: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = offset;
    }
  }, []);

  // 滚动事件处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    virtualItems,
    totalHeight,
    containerRef,
    scrollToIndex,
    scrollToOffset,
    handleScroll
  };
}

// 定义内部实现函数
function VirtualScrollImpl(
  {
    items,
    itemKey,
    itemHeight,
    height = 400,
    className,
    style,
    renderItem,
    onScroll,
    onEndReached,
    endReachedThreshold = 50,
    overscan = 5,
    estimatedItemHeight = 40,
    emptyComponent,
    loadingComponent,
    loading = false,
    hasMore = false
  }: VirtualScrollProps,
  ref: React.Ref<HTMLDivElement>
) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout>();
  const localContainerRef = useRef<HTMLDivElement>(null);

  // 生成默认的key函数
  const defaultKeyFn = useCallback((item: any, index: number): string => {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      return String((item as any).id);
    }
    return `item-${index}`;
  }, []);

  const keyFn = itemKey || defaultKeyFn;

  // 使用内联虚拟滚动实现
  const {
    virtualItems,
    totalHeight,
    containerRef: virtualContainerRef,
    scrollToIndex: scrollToIndexInternal,
    scrollToOffset: scrollToOffsetInternal,
    handleScroll: handleVirtualScroll
  } = useVirtualScroll({
    items,
    itemHeight,
    containerHeight: height,
    overscan,
    estimatedItemHeight
  });

  // 合并refs
  const mergedRef = useCallback((element: HTMLDivElement | null) => {
    localContainerRef.current = element;
    virtualContainerRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = element;
    }
  }, [ref]);

  // 滚动事件处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setIsScrolling(true);

    // 清除之前的timeout
    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current);
    }

    // 设置新的timeout
    scrollingTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    onScroll?.({ scrollTop, scrollHeight: e.currentTarget.scrollHeight, clientHeight: e.currentTarget.clientHeight });

    // 调用内部滚动处理
    handleVirtualScroll(e);

    // 检查是否到达底部
    if (onEndReached && hasMore && !loading) {
      const { scrollHeight, clientHeight } = e.currentTarget;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - endReachedThreshold;

      if (isNearBottom) {
        onEndReached();
      }
    }
  }, [onScroll, onEndReached, hasMore, loading, endReachedThreshold, handleVirtualScroll]);

  // 暴露给父组件的方法
  React.useImperativeHandle(ref, () => ({
    element: localContainerRef.current,
    scrollToIndex: scrollToIndexInternal,
    scrollToOffset: scrollToOffsetInternal,
    getScrollTop: () => localContainerRef.current?.scrollTop || 0,
    getScrollHeight: () => localContainerRef.current?.scrollHeight || 0,
    getClientHeight: () => localContainerRef.current?.clientHeight || 0
  }), [scrollToIndexInternal, scrollToOffsetInternal]);

  // 清理timeout
  useEffect(() => {
    return () => {
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, []);

  // 渲染虚拟项
  const renderVirtualItems = useMemo(() => {
    return virtualItems.map((virtualItem) => {
      const item = items[virtualItem.index];
      if (!item) return null;

      const key = keyFn(item, virtualItem.index);

      return (
        <div
          key={key}
          style={{
            position: 'absolute',
            top: virtualItem.top,
            left: 0,
            right: 0,
            height: virtualItem.height,
            willChange: isScrolling ? 'transform' : 'auto'
          }}
        >
          {renderItem({
            item,
            index: virtualItem.index,
            style: {
              height: '100%',
              overflow: 'hidden'
            }
          })}
        </div>
      );
    });
  }, [virtualItems, items, keyFn, renderItem, isScrolling]);

  return (
    <div
      ref={mergedRef}
      className={className}
      style={{
        height,
        overflow: 'auto',
        position: 'relative',
        ...style
      }}
      onScroll={handleScroll}
    >
      {/* 占位容器 */}
      <div
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* 虚拟项 */}
        {renderVirtualItems}
      </div>

      {/* 空状态 */}
      {items.length === 0 && !loading && emptyComponent && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {emptyComponent}
        </div>
      )}

      {/* 加载状态 */}
      {loading && loadingComponent && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          {loadingComponent}
        </div>
      )}
    </div>
  );
}

// 使用forwardRef包装组件
const VirtualScroll = React.forwardRef(VirtualScrollImpl);
VirtualScroll.displayName = 'VirtualScroll';

export { VirtualScroll };