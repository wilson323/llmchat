import { useEffect, useRef, useMemo } from 'react';

interface VirtualScrollOptions {
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  itemCount: number;
  overscan?: number;
}

interface VirtualScrollResult {
  virtualItems: Array<{
    index: number;
    start: number;
    size: number;
    key: string;
  }>;
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
}

export function useVirtualScroll({
  itemHeight,
  containerHeight,
  itemCount,
  overscan = 5,
}: VirtualScrollOptions): VirtualScrollResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  // 计算项目高度
  const getItemHeight = (index: number) => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
  };

  // 计算总高度
  const totalHeight = useMemo(() => {
    let height = 0;
    for (let i = 0; i < itemCount; i++) {
      height += getItemHeight(i);
    }
    return height;
  }, [itemCount, itemHeight]);

  // 计算位置映射
  const positionMap = useMemo(() => {
    const map = new Map<number, { start: number; size: number }>();
    let currentPos = 0;

    for (let i = 0; i < itemCount; i++) {
      const size = getItemHeight(i);
      map.set(i, { start: currentPos, size });
      currentPos += size;
    }

    return map;
  }, [itemCount, itemHeight]);

  // 计算可见项目
  const virtualItems = useMemo(() => {
    const scrollTop = scrollTopRef.current;
    let startIndex = 0;
    let endIndex = 0;

    // 找到第一个可见项目
    for (let i = 0; i < itemCount; i++) {
      const itemPos = positionMap.get(i)!;
      if (itemPos.start + itemPos.size > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // 找到最后一个可见项目
    for (let i = startIndex; i < itemCount; i++) {
      const itemPos = positionMap.get(i)!;
      if (itemPos.start > scrollTop + containerHeight) {
        endIndex = Math.min(itemCount - 1, i + overscan);
        break;
      }
      endIndex = i;
    }

    // 确保至少有一些项目被渲染
    if (endIndex === 0 && startIndex === 0 && itemCount > 0) {
      endIndex = Math.min(itemCount - 1, overscan * 2);
    }

    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const itemPos = positionMap.get(i);
      if (itemPos) {
        items.push({
          index: i,
          start: itemPos.start,
          size: itemPos.size,
          key: `virtual-item-${i}`,
        });
      }
    }

    return items;
  }, [positionMap, containerHeight, itemCount, overscan]);

  // 滚动到指定索引
  const scrollToIndex = (index: number) => {
    if (!containerRef.current) {
      return;
    }

    const itemPos = positionMap.get(index);
    if (itemPos) {
      containerRef.current.scrollTop = itemPos.start;
    }
  };

  // 滚动到顶部
  const scrollToTop = () => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTop = 0;
  };

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      scrollTopRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return {
    virtualItems,
    totalHeight,
    containerRef,
    scrollToIndex,
    scrollToTop,
  };
}