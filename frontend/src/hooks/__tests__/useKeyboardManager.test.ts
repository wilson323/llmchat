import { renderHook, act } from "@testing-library/react";
import { useKeyboardManager, appShortcuts } from "../useKeyboardManager";
import { useChatStore } from "@/store/chatStore";
import { useUIStore } from "@/store/uiStore";

// Mock the stores
jest.mock("@/store/chatStore");
jest.mock("@/store/uiStore");

describe("useKeyboardManager", () => {
  let mockChatStore: any;
  let mockUIStore: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock chat store
    mockChatStore = {
      getState: jest.fn(),
      createNewSession: jest.fn(),
      deleteSession: jest.fn(),
      switchToSession: jest.fn(),
      initializeAgentSessions: jest.fn(),
    };

    // Mock UI store
    mockUIStore = {
      getState: jest.fn(),
      setSidebarOpen: jest.fn(),
      setAgentSelectorOpen: jest.fn(),
    };

    (useChatStore as jest.Mock).mockReturnValue(mockChatStore);
    (useUIStore as jest.Mock).mockReturnValue(mockUIStore);
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
    const { result } = renderHook(() => useKeyboardManager());
    const { formatShortcut } = result.current;

    const shortcut = {
      key: "n",
      ctrlKey: true,
      action: () => {},
      description: "New session",
      category: "conversation" as const,
    };

    const formatted = formatShortcut(shortcut);
    expect(formatted).toBe("Ctrl + N");
  });
});
