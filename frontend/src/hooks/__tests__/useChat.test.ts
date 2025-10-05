import { renderHook, act } from "@testing-library/react";
import { useChat } from "../useChat";
import { useChatStore } from "@/store/chatStore";
import { chatService } from "@/services/api";

// Mock the chatService
jest.mock("@/services/api", () => ({
  chatService: {
    sendMessage: jest.fn(),
    sendStreamMessage: jest.fn(),
    retryMessage: jest.fn(),
    retryStreamMessage: jest.fn(),
  },
}));

// Mock the chat store
jest.mock("@/store/chatStore");

describe("useChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock chat store implementation
    (useChatStore as jest.Mock).mockReturnValue({
      getState: () => ({
        messages: [],
        isStreaming: false,
        setIsStreaming: jest.fn(),
        addMessage: jest.fn(),
        updateLastMessage: jest.fn(),
        stopStreaming: jest.fn(),
      }),
    });
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingStatus).toBeNull();
  });

  it("should send message", async () => {
    const mockResponse = {
      id: "response-1",
      AI: "Hello! How can I help you?",
      timestamp: Date.now(),
    };

    (chatService.sendMessage as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      undefined,
      [{ HUMAN: "Hello" }],
      { detail: true }
    );
  });

  it("should handle streaming message", async () => {
    const mockCallbacks = {
      onChunk: jest.fn(),
      onStatus: jest.fn(),
      onInteractive: jest.fn(),
      onChatId: jest.fn(),
      onReasoning: jest.fn(),
      onEvent: jest.fn(),
    };

    (chatService.sendStreamMessage as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendStreamMessage("Hello", mockCallbacks);
    });

    expect(chatService.sendStreamMessage).toHaveBeenCalledWith(
      undefined,
      [{ HUMAN: "Hello" }],
      expect.objectContaining({
        onChunk: expect.any(Function),
        onStatus: expect.any(Function),
        onInteractive: expect.any(Function),
        onChatId: expect.any(Function),
        onReasoning: expect.any(Function),
        onEvent: expect.any(Function),
      }),
      { detail: true }
    );
  });

  it("should retry message", async () => {
    const mockResponse = {
      id: "response-1",
      AI: "Hello! How can I help you?",
      timestamp: Date.now(),
    };

    (chatService.retryMessage as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.retryMessage("message-1");
    });

    expect(chatService.retryMessage).toHaveBeenCalledWith(
      undefined,
      undefined,
      "message-1",
      { detail: true }
    );
  });

  it("should stop streaming", () => {
    const mockStopStreaming = jest.fn();

    (useChatStore as jest.Mock).mockReturnValue({
      getState: () => ({
        messages: [],
        isStreaming: true,
        setIsStreaming: jest.fn(),
        addMessage: jest.fn(),
        updateLastMessage: jest.fn(),
        stopStreaming: mockStopStreaming,
      }),
    });

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.stopStreaming();
    });

    expect(mockStopStreaming).toHaveBeenCalled();
  });
});
