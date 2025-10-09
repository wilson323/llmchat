import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useKeyboardManager, appShortcuts, useKeyboardHelp } from "../useKeyboardManager";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";

// Mock the stores
vi.mock("@/store/chatStore");
vi.mock("@/store/uiStore");

describe("useKeyboardManager", () => {
  let mockChatStore: any;
  let mockUIStore: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock chat store
    mockChatStore = {
      getState: vi.fn(),
      createNewSession: vi.fn(),
      deleteSession: vi.fn(),
      switchToSession: vi.fn(),
      initializeAgentSessions: vi.fn(),
    };

    // Mock UI store
    mockUIStore = {
      getState: vi.fn(),
      setSidebarOpen: vi.fn(),
      setAgentSelectorOpen: vi.fn(),
    };

    const mockUseChatStore = useChatStore as any;
    const mockUseUIStore = useUIStore as any;

    mockUseChatStore.mockReturnValue(mockChatStore);
    mockUseUIStore.mockReturnValue(mockUIStore);
  });

  it("should register shortcuts correctly", () => {
    const { result } = renderHook(() => useKeyboardManager());

    act(() => {
      result.current.registerShortcuts(appShortcuts);
    });

    const shortcuts = result.current.getRegisteredShortcuts();
    expect(shortcuts).toHaveLength(10);
  });

  it("should trigger Ctrl+N shortcut to create new session", () => {
    mockChatStore.getState.mockReturnValue({
      createNewSession: mockChatStore.createNewSession,
    });

    const { result } = renderHook(() => useKeyboardManager());

    act(() => {
      result.current.registerShortcuts(appShortcuts);
    });

    // Find the Ctrl+N shortcut
    const shortcuts = result.current.getRegisteredShortcuts();
    const newSessionShortcut = shortcuts.find(
      (s) => s.key === "n" && s.ctrlKey
    );

    expect(newSessionShortcut).toBeDefined();

    // Trigger the shortcut action
    act(() => {
      newSessionShortcut?.action();
    });

    expect(mockChatStore.createNewSession).toHaveBeenCalled();
  });

  it("should trigger Ctrl+Delete shortcut to delete session", () => {
    const mockCurrentSession = { id: "test-session" };
    mockChatStore.getState.mockReturnValue({
      currentSession: mockCurrentSession,
      deleteSession: mockChatStore.deleteSession,
    });

    const { result } = renderHook(() => useKeyboardManager());

    act(() => {
      result.current.registerShortcuts(appShortcuts);
    });

    // Find the Ctrl+Delete shortcut
    const shortcuts = result.current.getRegisteredShortcuts();
    const deleteSessionShortcut = shortcuts.find(
      (s) => s.key === "Delete" && s.ctrlKey
    );

    expect(deleteSessionShortcut).toBeDefined();

    // Trigger the shortcut action
    act(() => {
      deleteSessionShortcut?.action();
    });

    expect(mockChatStore.deleteSession).toHaveBeenCalledWith(
      mockCurrentSession.id
    );
  });

  it("should trigger Alt+K shortcut to toggle sidebar", () => {
    mockUIStore.getState.mockReturnValue({
      sidebarOpen: false,
      setSidebarOpen: mockUIStore.setSidebarOpen,
    });

    const { result } = renderHook(() => useKeyboardManager());

    act(() => {
      result.current.registerShortcuts(appShortcuts);
    });

    // Find the Alt+K shortcut
    const shortcuts = result.current.getRegisteredShortcuts();
    const toggleSidebarShortcut = shortcuts.find(
      (s) => s.key === "k" && s.altKey
    );

    expect(toggleSidebarShortcut).toBeDefined();

    // Trigger the shortcut action
    act(() => {
      toggleSidebarShortcut?.action();
    });

    expect(mockUIStore.setSidebarOpen).toHaveBeenCalledWith(true);
  });

  it("should trigger Escape shortcut to close modal", () => {
    mockChatStore.getState.mockReturnValue({
      setAgentSelectorOpen: mockChatStore.setAgentSelectorOpen,
    });

    const { result } = renderHook(() => useKeyboardManager());

    act(() => {
      result.current.registerShortcuts(appShortcuts);
    });

    // Find the Escape shortcut
    const shortcuts = result.current.getRegisteredShortcuts();
    const escapeShortcut = shortcuts.find((s) => s.key === "Escape");

    expect(escapeShortcut).toBeDefined();

    // Trigger the shortcut action
    act(() => {
      escapeShortcut?.action();
    });

    expect(mockChatStore.setAgentSelectorOpen).toHaveBeenCalledWith(false);
  });

  it("should format shortcuts correctly", () => {
    const shortcuts = [
      {
        key: "n",
        ctrlKey: true,
        action: () => {},
        description: "New session",
        category: "conversation" as const,
      },
    ];

    const { result } = renderHook(() => useKeyboardHelp(shortcuts));
    const { formatShortcut } = result.current;

    const formatted = formatShortcut(shortcuts[0]);
    expect(formatted).toBe("Ctrl + N");
  });
});
