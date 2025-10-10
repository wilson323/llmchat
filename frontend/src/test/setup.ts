/**
 * Vitest 测试环境设置
 *
 * 此文件在所有测试运行前执行，用于配置全局测试环境
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// 每个测试后自动清理 DOM
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia（用于主题切换等功能）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // 已废弃
    removeListener: vi.fn(), // 已废弃
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver（用于虚拟滚动等功能）
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver（用于响应式组件）
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock Element.scrollIntoView（jsdom 不支持）
Element.prototype.scrollIntoView = vi.fn();

// Mock console 方法（减少测试输出噪音）
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    error: vi.fn(), // Mock console.error
    warn: vi.fn(),  // Mock console.warn
  };
}
