/**
 * 键盘快捷键功能测试
 *
 * 这是一个简单的逻辑测试，验证快捷键管理器的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardManager, useKeyboardHelp, KeyboardShortcut } from '@/hooks/useKeyboardManager';

describe('useKeyboardManager', () => {
  let mockDispatchEvent: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock DOM APIs
    mockDispatchEvent = vi.spyOn(document, 'dispatchEvent');

    // Mock querySelector for our tests
    Object.defineProperty(document, 'querySelector', {
      writable: true,
      value: vi.fn(() => null)
    });

    // Mock window.confirm
    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: vi.fn(() => true)
    });
  });

  afterEach(() => {
    mockDispatchEvent.mockRestore();
  });

  it('应该正确注册和执行快捷键', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: mockAction,
        description: '新建',
        category: 'navigation'
      }
    ];

    renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true
    }));

    expect(mockAction).not.toHaveBeenCalled();

    // 模拟 Ctrl+N 键盘事件
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      bubbles: true
    });

    act(() => {
      document.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('应该正确格式化快捷键显示', () => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: () => {},
        description: '新建',
        category: 'navigation'
      },
      {
        key: 'h',
        altKey: true,
        action: () => {},
        description: '帮助',
        category: 'accessibility'
      },
      {
        key: 'Delete',
        ctrlKey: true,
        shiftKey: true,
        action: () => {},
        description: '删除',
        category: 'editing'
      }
    ];

    const { result } = renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true
    }));

    const registered = result.current.getRegisteredShortcuts();
    expect(registered).toHaveLength(3);
  });

  it('应该支持按类别获取快捷键', () => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: () => {},
        description: '新建',
        category: 'navigation'
      },
      {
        key: 'e',
        ctrlKey: true,
        action: () => {},
        description: '编辑',
        category: 'editing'
      },
      {
        key: 'h',
        altKey: true,
        action: () => {},
        description: '帮助',
        category: 'accessibility'
      }
    ];

    const { result } = renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true
    }));

    const navigationShortcuts = result.current.getShortcutsByCategory('navigation');
    const editingShortcuts = result.current.getShortcutsByCategory('editing');
    const accessibilityShortcuts = result.current.getShortcutsByCategory('accessibility');

    expect(navigationShortcuts).toHaveLength(1);
    expect(editingShortcuts).toHaveLength(1);
    expect(accessibilityShortcuts).toHaveLength(1);

    expect(navigationShortcuts[0].description).toBe('新建');
    expect(editingShortcuts[0].description).toBe('编辑');
    expect(accessibilityShortcuts[0].description).toBe('帮助');
  });

  it('应该在输入框中跳过某些快捷键', () => {
    const mockAction1 = vi.fn();
    const mockAction2 = vi.fn();

    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: mockAction1,
        description: '新建',
        category: 'navigation'
      },
      {
        key: 'Escape',
        action: mockAction2,
        description: '关闭',
        category: 'accessibility'
      }
    ];

    // 模拟在输入框中的场景
    const mockInput = document.createElement('input');
    Object.defineProperty(document, 'activeElement', {
      writable: true,
      value: mockInput
    });

    renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true
    }));

    // Ctrl+N 应该在输入框中被跳过
    const ctrlNEvent = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      bubbles: true
    });

    act(() => {
      document.dispatchEvent(ctrlNEvent);
    });

    expect(mockAction1).not.toHaveBeenCalled();

    // Escape 应该仍然工作（accessibility 类别）
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true
    });

    act(() => {
      document.dispatchEvent(escapeEvent);
    });

    expect(mockAction2).toHaveBeenCalledTimes(1);
  });

  it('应该支持动态启用/禁用快捷键', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: mockAction,
        description: '新建',
        category: 'navigation'
      }
    ];

    const { result } = renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true
    }));

    // 禁用快捷键
    act(() => {
      result.current.setDisabled(true);
    });

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      ctrlKey: true,
      bubbles: true
    });

    act(() => {
      document.dispatchEvent(event);
    });

    expect(mockAction).not.toHaveBeenCalled();

    // 重新启用快捷键
    act(() => {
      result.current.setDisabled(false);
    });

    act(() => {
      document.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('应该正确处理快捷键冲突', () => {
    const mockAction1 = vi.fn();
    const mockAction2 = vi.fn();
    const mockConflictHandler = vi.fn();

    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: mockAction1,
        description: '新建1',
        category: 'navigation'
      },
      {
        key: 'n',
        ctrlKey: true,
        action: mockAction2,
        description: '新建2',
        category: 'navigation'
      }
    ];

    renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true,
      onConflict: mockConflictHandler
    }));

    expect(mockConflictHandler).toHaveBeenCalledTimes(1);
  });
});

describe('useKeyboardHelp', () => {
  it('应该正确格式化快捷键显示', () => {
    const shortcuts = [
      {
        key: 'n',
        ctrlKey: true,
        action: () => {},
        description: '新建',
        category: 'navigation' as const
      },
      {
        key: 'h',
        altKey: true,
        action: () => {},
        description: '帮助',
        category: 'accessibility' as const
      },
      {
        key: 'Delete',
        ctrlKey: true,
        shiftKey: true,
        action: () => {},
        description: '删除',
        category: 'editing' as const
      }
    ];

    const { result } = renderHook(() => useKeyboardHelp(shortcuts));

    const { formatShortcut } = result.current;

    expect(formatShortcut(shortcuts[0])).toBe('Ctrl + N');
    expect(formatShortcut(shortcuts[1])).toBe('Alt + H');
    expect(formatShortcut(shortcuts[2])).toBe('Ctrl + Shift + delete');
  });

  it('应该按类别组织帮助内容', () => {
    const shortcuts = [
      {
        key: 'n',
        ctrlKey: true,
        action: () => {},
        description: '新建',
        category: 'navigation' as const
      },
      {
        key: 'e',
        ctrlKey: true,
        action: () => {},
        description: '编辑',
        category: 'editing' as const
      },
      {
        key: 'h',
        altKey: true,
        action: () => {},
        description: '帮助',
        category: 'accessibility' as const
      }
    ];

    const { result } = renderHook(() => useKeyboardManager({
      shortcuts,
      enabled: true
    }));

    const helpContent = result.current.getShortcutsByCategory('navigation');
    expect(helpContent).toHaveLength(1);
    expect(helpContent[0].description).toBe('新建');
  });
});