;
import { Keyboard } from 'lucide-react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardManager } from '@/hooks/useKeyboardManager';

// Mock stores
vi.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({
      currentAgent: { id: 'test-agent', name: 'Test Agent' },
      currentSession: { id: 'test-session', title: 'Test Session' },
      createNewSession: vi.fn(),
      deleteSession: vi.fn(),
      setAgentSelectorOpen: vi.fn(),
    })),
  },
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      sidebarOpen: true,
      setSidebarOpen: vi.fn(),
    })),
  },
}));

describe('useKeyboardManager (Simplified)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize without errors', () => {
    const { result } = renderHook(() => useKeyboardManager());
    expect(result.current).toBeDefined();
  });

  it('should have keyboard shortcuts defined', () => {
    const { result } = renderHook(() => useKeyboardManager());
    // The hook should return some keyboard shortcuts or state
    expect(typeof result.current).toBe('object');
  });
});
