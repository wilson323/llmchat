/**
 * 通用虚拟滚动组件
 * 支持动态高度和多种使用场景
 */

'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import type { VirtualScrollItem, VirtualScrollProps, VirtualScrollRef } from './ui.types';

export const VirtualScroll = React.forwardRef<HTMLDivElement, VirtualScrollProps>(function VirtualScroll<T = unknown>({
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
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout>();

  // 生成默认的key函数
  const defaultKeyFn = useCallback((item: T, index: number): string => {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      return String((item as any).id);
    }
    return `item-${index}`;
  }, []);

  const keyFn = itemKey || defaultKeyFn;

  // 使用虚拟滚动hook
  const {
    virtualItems,
    totalHeight,
    scrollToIndex,
    scrollToOffset
  } = useVirtualScroll({
    items,
    itemHeight,
    containerHeight: height,
    overscan,
    estimatedItemHeight
  });

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

    onScroll?.(scrollTop);

    // 检查是否到达底部
    if (onEndReached && hasMore && !loading) {
      const { scrollHeight, clientHeight } = e.currentTarget;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - endReachedThreshold;

      if (isNearBottom) {
        onEndReached();
      }
    }
  }, [onScroll, onEndReached, hasMore, loading, endReachedThreshold]);

  // 暴露给父组件的方法
  React.useImperativeHandle(ref, () => ({
    element: containerRef.current,
    scrollToIndex,
    scrollToOffset,
    getScrollTop: () => containerRef.current?.scrollTop || 0,
    getScrollHeight: () => containerRef.current?.scrollHeight || 0,
    getClientHeight: () => containerRef.current?.clientHeight || 0
  }), [scrollToIndex, scrollToOffset]);

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
      ref={containerRef}
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
});

VirtualScroll.displayName = 'VirtualScroll';