;
;
import { Monitor, User } from 'lucide-react';
import { renderHook, act } from "@testing-library/react";
import { useChat } from "../useChat";
import { chatService } from "@/services/api";

// Mock the new split stores
vi.mock("@/store/messageStore");
vi.mock("@/store/agentStore");
vi.mock("@/store/sessionStore");
vi.mock("@/store/preferenceStore");

// Mock i18n
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock("@/utils/performanceMonitor", () => ({
  perfMonitor: {
    measureAsync: vi.fn((_name: string, fn: () => unknown) => fn()),
    measure: vi.fn((_name: string, fn: () => unknown) => fn()),
    getStats: vi.fn(),
  },
}));

// Mock interactive data converter
vi.mock("@/utils/interactiveDataConverter", () => ({
  convertFastGPTInteractiveData: vi.fn(),
}));

// Mock reasoning utilities
vi.mock("@/lib/reasoning", () => ({
  parseReasoningPayload: vi.fn(() => null),
}));

// Mock event utilities
vi.mock("@/lib/events", () => ({
  normalizeFastGPTEvent: vi.fn(),
}));

// Mock debug utilities
vi.mock("@/lib/debug", () => ({
  debugLog: vi.fn(),
}));

// Mock the chatService
vi.mock("@/services/api", () => ({
  chatService: {
    sendMessage: vi.fn(),
    sendStreamMessage: vi.fn(),
    retryMessage: vi.fn(),
    retryStreamMessage: vi.fn(),
  },
}));

// Import the mocked modules
import { useMessageStore } from "@/store/messageStore";
import { useSessionStore } from "@/store/sessionStore";

// Type assertions for mocked stores
const mockedMessageStore = useMessageStore as ReturnType<typeof useMessageStore>;
const mockedSessionStore = useSessionStore as ReturnType<typeof useSessionStore>;

// Type assertions for mocked chatService
const mockedChatService = chatService as typeof chatService;

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock message store
    mockedMessageStore.mockReturnValue({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: vi.fn(),
      clearMessages: vi.fn(),
      updateMessageById: vi.fn(),
      setMessageFeedback: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
      appendToBuffer: vi.fn(),
      flushBuffer: vi.fn(),
      updateLastMessage: vi.fn(),
      appendReasoningStep: vi.fn(),
      finalizeReasoning: vi.fn(),
      appendAssistantEvent: vi.fn(),
      setIsStreaming: vi.fn(),
      setStreamingStatus: vi.fn(),
      setStreamAbortController: vi.fn(),
      stopStreaming: vi.fn(),
      _scheduleFlush: vi.fn(),
      getState: vi.fn(),
    });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current).toEqual({
      sendMessage: expect.any(Function),
      continueInteractiveSelect: expect.any(Function),
      continueInteractiveForm: expect.any(Function),
      retryMessage: expect.any(Function),
    });
  });

  it("should send message", async () => {
    const mockResponse = {
      id: "response-1",
      object: "chat.completion",
      created: Date.now(),
      model: "test-model",
      choices: [{
        index: 0,
        message: {
          id: "response-1",
          role: "assistant" as const,
          content: "Hello! How can I help you?",
          timestamp: Date.now(),
        },
        finish_reason: "stop",
      }],
    };

    mockedChatService.sendMessage.mockResolvedValue(mockResponse);
    mockedChatService.sendStreamMessage.mockResolvedValue(undefined);

    const mockAddMessage = vi.fn();
    const mockCreateNewSession = vi.fn();

    // Update the message store mock to include addMessage
    const mockMessageGetState = vi.fn(() => ({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: mockAddMessage,
      clearMessages: vi.fn(),
      updateMessageById: vi.fn(),
      setMessageFeedback: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
      appendToBuffer: vi.fn(),
      flushBuffer: vi.fn(),
      updateLastMessage: vi.fn(),
      appendReasoningStep: vi.fn(),
      finalizeReasoning: vi.fn(),
      appendAssistantEvent: vi.fn(),
      setIsStreaming: vi.fn(),
      setStreamingStatus: vi.fn(),
      setStreamAbortController: vi.fn(),
      stopStreaming: vi.fn(),
      _scheduleFlush: vi.fn(),
    }));

    const mockSessionGetState = vi.fn(() => ({
      currentSession: null,
      agentSessions: {},
      createNewSession: mockCreateNewSession,
      deleteSession: vi.fn(),
      switchToSession: vi.fn(),
      renameSession: vi.fn(),
      clearCurrentAgentSessions: vi.fn(),
      initializeAgentSessions: vi.fn(),
      setAgentSessionsForAgent: vi.fn(),
      bindSessionId: vi.fn(),
      setSessionMessages: vi.fn(),
      updateSession: vi.fn(),
      updateSessionTitleIntelligently: vi.fn(),
      getSessionById: vi.fn(),
      getAgentSessions: vi.fn(),
      getCurrentSession: vi.fn(),
    }));

    mockedMessageStore.mockImplementation(() => ({
      ...mockedMessageStore.mock.results[0].value,
      getState: mockMessageGetState,
    }));

    mockedSessionStore.mockImplementation(() => ({
      ...mockedSessionStore.mock.results[0].value,
      getState: mockSessionGetState,
    }));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mockAddMessage).toHaveBeenCalledTimes(2); // User message + assistant message placeholder
    expect(mockCreateNewSession).toHaveBeenCalled();
  });

  it("should handle streaming message", async () => {
    mockedChatService.sendStreamMessage.mockResolvedValue(undefined);

    const mockAddMessage = vi.fn();
    const mockCreateNewSession = vi.fn();
    const mockSetIsStreaming = vi.fn();
    const mockSetStreamingStatus = vi.fn();
    const mockSetStreamAbortController = vi.fn();
    const mockAppendToBuffer = vi.fn();

    const mockMessageGetState = vi.fn(() => ({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: mockAddMessage,
      clearMessages: vi.fn(),
      updateMessageById: vi.fn(),
      setMessageFeedback: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
      appendToBuffer: mockAppendToBuffer,
      flushBuffer: vi.fn(),
      updateLastMessage: vi.fn(),
      appendReasoningStep: vi.fn(),
      finalizeReasoning: vi.fn(),
      appendAssistantEvent: vi.fn(),
      setIsStreaming: mockSetIsStreaming,
      setStreamingStatus: mockSetStreamingStatus,
      setStreamAbortController: mockSetStreamAbortController,
      stopStreaming: vi.fn(),
      _scheduleFlush: vi.fn(),
    }));

    const mockSessionGetState = vi.fn(() => ({
      currentSession: null,
      agentSessions: {},
      createNewSession: mockCreateNewSession,
      deleteSession: vi.fn(),
      switchToSession: vi.fn(),
      renameSession: vi.fn(),
      clearCurrentAgentSessions: vi.fn(),
      initializeAgentSessions: vi.fn(),
      setAgentSessionsForAgent: vi.fn(),
      bindSessionId: vi.fn(),
      setSessionMessages: vi.fn(),
      updateSession: vi.fn(),
      updateSessionTitleIntelligently: vi.fn(),
      getSessionById: vi.fn(),
      getAgentSessions: vi.fn(),
      getCurrentSession: vi.fn(),
    }));

    mockedMessageStore.mockImplementation(() => ({
      ...mockedMessageStore.mock.results[0].value,
      getState: mockMessageGetState,
    }));

    mockedSessionStore.mockImplementation(() => ({
      ...mockedSessionStore.mock.results[0].value,
      getState: mockSessionGetState,
    }));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mockedChatService.sendStreamMessage).toHaveBeenCalledWith(
      'test-agent-id',
      expect.any(Array),
      expect.objectContaining({
        onChunk: expect.any(Function),
        onStatus: expect.any(Function),
        onInteractive: expect.any(Function),
        onChatId: expect.any(Function),
        onReasoning: expect.any(Function),
        onEvent: expect.any(Function),
      }),
      expect.any(Object)
    );
  });

  it("should retry message", async () => {
    const mockResponse = {
      id: "response-1",
      object: "chat.completion",
      created: Date.now(),
      model: "test-model",
      choices: [{
        index: 0,
        message: {
          id: "response-1",
          role: "assistant" as const,
          content: "Hello! How can I help you?",
          timestamp: Date.now(),
        },
        finish_reason: "stop",
      }],
    };

    mockedChatService.retryMessage.mockResolvedValue(mockResponse);

    const mockSessionGetState = vi.fn(() => ({
      currentSession: {
        id: 'test-session-id',
        title: 'Test Session',
        agentId: 'test-agent-id',
        messages: [{ id: 'message-1', AI: 'Previous content', timestamp: Date.now() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      agentSessions: {
        'test-agent-id': [{
          id: 'test-session-id',
          title: 'Test Session',
          agentId: 'test-agent-id',
          messages: [{ id: 'message-1', AI: 'Previous content', timestamp: Date.now() }],
          createdAt: new Date(),
          updatedAt: new Date(),
        }]
      },
      createNewSession: vi.fn(),
      deleteSession: vi.fn(),
      switchToSession: vi.fn(),
      renameSession: vi.fn(),
      clearCurrentAgentSessions: vi.fn(),
      initializeAgentSessions: vi.fn(),
      setAgentSessionsForAgent: vi.fn(),
      bindSessionId: vi.fn(),
      setSessionMessages: vi.fn(),
      updateSession: vi.fn(),
      updateSessionTitleIntelligently: vi.fn(),
      getSessionById: vi.fn(),
      getAgentSessions: vi.fn(),
      getCurrentSession: vi.fn(),
    }));

    const mockMessageGetState = vi.fn(() => ({
      messages: [{ id: 'message-1', AI: 'Previous content', timestamp: Date.now() }],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: vi.fn(),
      clearMessages: vi.fn(),
      updateMessageById: vi.fn(),
      setMessageFeedback: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
      appendToBuffer: vi.fn(),
      flushBuffer: vi.fn(),
      updateLastMessage: vi.fn(),
      appendReasoningStep: vi.fn(),
      finalizeReasoning: vi.fn(),
      appendAssistantEvent: vi.fn(),
      setIsStreaming: vi.fn(),
      setStreamingStatus: vi.fn(),
      setStreamAbortController: vi.fn(),
      stopStreaming: vi.fn(),
      _scheduleFlush: vi.fn(),
    }));

    mockedMessageStore.mockImplementation(() => ({
      ...mockedMessageStore.mock.results[0].value,
      getState: mockMessageGetState,
    }));

    mockedSessionStore.mockImplementation(() => ({
      ...mockedSessionStore.mock.results[0].value,
      getState: mockSessionGetState,
    }));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.retryMessage("message-1");
    });

    expect(mockedChatService.retryMessage).toHaveBeenCalledWith(
      'test-agent-id',
      'test-session-id',
      "message-1",
      { detail: true }
    );
  });

  it("should continue interactive select", async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({});
    mockedChatService.sendMessage = mockSendMessage;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.continueInteractiveSelect("Option 1");
    });

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it("should continue interactive form", async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({});
    const formData = { field1: "value1", field2: "value2" };

    mockedChatService.sendMessage = mockSendMessage;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.continueInteractiveForm(formData);
    });

    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(formData));
  });
});
});