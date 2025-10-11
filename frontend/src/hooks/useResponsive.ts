/**
 * 响应式设计 Hook
 * 提供基于屏幕尺寸的响应式断点检测
 */

import { useState, useEffect } from 'react';

/**
 * 响应式断点定义
 * 基于 Tailwind CSS 默认断点，并针对移动端优化
 */
export const breakpoints = {
  // 移动端（超小屏幕）
  xs: 0,
  // 移动端（小屏幕）
  sm: 640,
  // 平板端（中等屏幕）
  md: 768,
  // 桌面端（大屏幕）
  lg: 1024,
  // 桌面端（超大屏幕）
  xl: 1280,
  // 桌面端（2K屏幕）
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * 设备类型枚举
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * 响应式状态接口
 */
export interface ResponsiveState {
  /** 当前屏幕宽度 */
  width: number;
  /** 当前屏幕高度 */
  height: number;
  /** 当前激活的断点 */
  breakpoint: Breakpoint;
  /** 设备类型 */
  deviceType: DeviceType;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 是否为平板端 */
  isTablet: boolean;
  /** 是否为桌面端 */
  isDesktop: boolean;
  /** 是否为触摸设备 */
  isTouchDevice: boolean;
  /** 是否处于横屏模式 */
  isLandscape: boolean;
  /** 是否处于竖屏模式 */
  isPortrait: boolean;
}

/**
 * 获取当前断点
 */
function getCurrentBreakpoint(width: number): Breakpoint {
  if (width >= breakpoints['2xl']) {
    return '2xl';
  }
  if (width >= breakpoints.xl) {
    return 'xl';
  }
  if (width >= breakpoints.lg) {
    return 'lg';
  }
  if (width >= breakpoints.md) {
    return 'md';
  }
  if (width >= breakpoints.sm) {
    return 'sm';
  }
  return 'xs';
}

/**
 * 获取设备类型
 */
function getDeviceType(width: number): DeviceType {
  if (width < breakpoints.md) {
    return 'mobile';
  }
  if (width < breakpoints.lg) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * 检测是否为触摸设备
 */
function checkIsTouchDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * 获取初始响应式状态
 */
function getInitialState(): ResponsiveState {
  if (typeof window === 'undefined') {
    // SSR 环境默认返回桌面端状态
    return {
      width: 1920,
      height: 1080,
      breakpoint: 'xl',
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      isLandscape: true,
      isPortrait: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const breakpoint = getCurrentBreakpoint(width);
  const deviceType = getDeviceType(width);
  const isTouchDevice = checkIsTouchDevice();
  const isLandscape = width > height;

  return {
    width,
    height,
    breakpoint,
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTouchDevice,
    isLandscape,
    isPortrait: !isLandscape,
  };
}

/**
 * 响应式设计 Hook
 *
 * @param debounceTime - 防抖延迟时间（毫秒），默认 150ms
 * @returns 响应式状态对象
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isMobile, isTablet, breakpoint } = useResponsive();
 *
 *   return (
 *     <div>
 *       {isMobile && <MobileView />}
 *       {isTablet && <TabletView />}
 *       {!isMobile && !isTablet && <DesktopView />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useResponsive(debounceTime: number = 150): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(getInitialState);

  useEffect(() => {
    // SSR 环境不执行
    if (typeof window === 'undefined') {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      // 防抖处理
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const breakpoint = getCurrentBreakpoint(width);
        const deviceType = getDeviceType(width);
        const isLandscape = width > height;

        setState({
          width,
          height,
          breakpoint,
          deviceType,
          isMobile: deviceType === 'mobile',
          isTablet: deviceType === 'tablet',
          isDesktop: deviceType === 'desktop',
          isTouchDevice: checkIsTouchDevice(),
          isLandscape,
          isPortrait: !isLandscape,
        });
      }, debounceTime);
    };

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);

    // 监听设备方向变化（移动设备）
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleResize);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleResize);
      }
    };
  }, [debounceTime]);

  return state;
}

/**
 * 媒体查询 Hook
 *
 * @param query - 媒体查询字符串
 * @returns 是否匹配媒体查询
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 *   const isLargeScreen = useMediaQuery('(min-width: 1024px)');
 *
 *   return <div>{prefersDark ? 'Dark Mode' : 'Light Mode'}</div>;
 * }
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // 现代浏览器使用 addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // 旧版浏览器兼容
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

/**
 * 断点条件匹配 Hook
 *
 * @param minBreakpoint - 最小断点（包含）
 * @param maxBreakpoint - 最大断点（包含），可选
 * @returns 是否在指定断点范围内
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isMobileOrTablet = useBreakpoint('xs', 'md');
 *   const isDesktop = useBreakpoint('lg');
 *
 *   return <div>{isDesktop ? 'Desktop View' : 'Mobile/Tablet View'}</div>;
 * }
 * ```
 */
export function useBreakpoint(
  minBreakpoint: Breakpoint,
  maxBreakpoint?: Breakpoint,
): boolean {
  const { breakpoint } = useResponsive();

  const currentValue = breakpoints[breakpoint];
  const minValue = breakpoints[minBreakpoint];
  const maxValue = maxBreakpoint ? breakpoints[maxBreakpoint] : Infinity;

  return currentValue >= minValue && currentValue <= maxValue;
}
