import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  container: HTMLElement | null;
  initialFocus?: HTMLElement | null;
  restoreFocus?: HTMLElement | null;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * 焦点捕获Hook - 确保焦点在模态对话框内循环
 * 支持键盘导航和Escape键关闭功能
 */
export const useFocusTrap = ({
  container,
  initialFocus,
  restoreFocus,
  onEscape,
  enabled = true
}: UseFocusTrapOptions) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  // 获取所有可聚焦元素
  const getFocusableElements = (element: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      'area[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];

    return Array.from(
      element.querySelectorAll(focusableSelectors.join(', '))
    ) as HTMLElement[];
  };

  // 获取第一个可聚焦元素
  const getFirstFocusableElement = (): HTMLElement | null => {
    return focusableElementsRef.current[0] || null;
  };

  // 获取最后一个可聚焦元素
  const getLastFocusableElement = (): HTMLElement | null => {
    const elements = focusableElementsRef.current;
    return elements[elements.length - 1] || null;
  };

  // 处理Tab键循环
  const handleTabKey = (event: KeyboardEvent) => {
    if (!container) return;

    const focusableElements = focusableElementsRef.current;
    if (focusableElements.length === 0) return;

    const firstElement = getFirstFocusableElement();
    const lastElement = getLastFocusableElement();

    if (!firstElement || !lastElement) return;

    // Shift+Tab：向前循环
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    }
    // Tab：向后循环
    else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  // 处理Escape键
  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
    }
  };

  // 处理键盘事件
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return;

    switch (event.key) {
      case 'Tab':
        handleTabKey(event);
        break;
      case 'Escape':
        handleEscapeKey(event);
        break;
    }
  };

  // 捕获焦点
  const trapFocus = () => {
    if (!container || !enabled) return;

    // 保存当前焦点元素
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 获取可聚焦元素
    focusableElementsRef.current = getFocusableElements(container);

    // 设置初始焦点
    if (initialFocus) {
      initialFocus.focus();
    } else {
      const firstFocusable = getFirstFocusableElement();
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    // 添加键盘事件监听
    document.addEventListener('keydown', handleKeyDown, true);
  };

  // 释放焦点
  const releaseFocus = () => {
    // 移除键盘事件监听
    document.removeEventListener('keydown', handleKeyDown, true);

    // 恢复之前的焦点
    if (restoreFocus) {
      restoreFocus.focus();
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }

    // 清理引用
    previousActiveElement.current = null;
    focusableElementsRef.current = [];
  };

  // 监听容器变化，更新可聚焦元素列表
  useEffect(() => {
    if (!container || !enabled) return;

    // 创建MutationObserver监听DOM变化
    const observer = new MutationObserver(() => {
      focusableElementsRef.current = getFocusableElements(container);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'aria-hidden']
    });

    return () => {
      observer.disconnect();
    };
  }, [container, enabled]);

  // 启用/禁用焦点捕获
  useEffect(() => {
    if (enabled && container) {
      trapFocus();
    } else {
      releaseFocus();
    }

    return () => {
      releaseFocus();
    };
  }, [enabled, container, initialFocus]);

  return {
    trapFocus,
    releaseFocus,
    getFirstFocusableElement,
    getLastFocusableElement,
    focusableElements: focusableElementsRef.current
  };
};