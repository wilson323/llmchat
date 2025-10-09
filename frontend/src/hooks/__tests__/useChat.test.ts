import { renderHook, act } from "@testing-library/react";
import { useChat } from "../useChat";
import { chatService } from "@/services/api";

// Mock the new split stores
jest.mock("@/store/messageStore");
jest.mock("@/store/agentStore");
jest.mock("@/store/sessionStore");
jest.mock("@/store/preferenceStore");

// Mock i18n
jest.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock performance monitor
jest.mock("@/utils/performanceMonitor", () => ({
  perfMonitor: {
    measureAsync: jest.fn((_name, fn) => fn()),
    measure: jest.fn((_name, fn) => fn()),
    getStats: jest.fn(),
  },
}));

// Mock interactive data converter
jest.mock("@/utils/interactiveDataConverter", () => ({
  convertFastGPTInteractiveData: jest.fn(),
}));

// Mock reasoning utilities
jest.mock("@/lib/reasoning", () => ({
  parseReasoningPayload: jest.fn(() => null),
}));

// Mock event utilities
jest.mock("@/lib/events", () => ({
  normalizeFastGPTEvent: jest.fn(),
}));

// Mock debug utilities
jest.mock("@/lib/debug", () => ({
  debugLog: jest.fn(),
}));

// Mock the chatService
jest.mock("@/services/api", () => ({
  chatService: {
    sendMessage: jest.fn(),
    sendStreamMessage: jest.fn(),
    retryMessage: jest.fn(),
    retryStreamMessage: jest.fn(),
  },
}));

// Import the mocked modules
import { useMessageStore } from "@/store/messageStore";
import { useAgentStore } from "@/store/agentStore";
import { useSessionStore } from "@/store/sessionStore";
import { usePreferenceStore } from "@/store/preferenceStore";

// Type assertions for mocked stores
const mockedMessageStore = useMessageStore as jest.MockedFunction<typeof useMessageStore>;
const mockedAgentStore = useAgentStore as jest.MockedFunction<typeof useAgentStore>;
const mockedSessionStore = useSessionStore as jest.MockedFunction<typeof useSessionStore>;
const mockedPreferenceStore = usePreferenceStore as jest.MockedFunction<typeof usePreferenceStore>;

// Type assertions for mocked chatService
const mockedChatService = chatService as jest.Mocked<typeof chatService>;

describe("useChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock message store
    mockedMessageStore.mockReturnValue({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: jest.fn(),
      clearMessages: jest.fn(),
      updateMessageById: jest.fn(),
      setMessageFeedback: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
      appendToBuffer: jest.fn(),
      flushBuffer: jest.fn(),
      updateLastMessage: jest.fn(),
      appendReasoningStep: jest.fn(),
      finalizeReasoning: jest.fn(),
      appendAssistantEvent: jest.fn(),
      setIsStreaming: jest.fn(),
      setStreamingStatus: jest.fn(),
      setStreamAbortController: jest.fn(),
      stopStreaming: jest.fn(),
      _scheduleFlush: jest.fn(),
    });

    // Mock agent store
    mockedAgentStore.mockReturnValue({
      currentAgent: null,
      agents: [],
      agentsLoading: false,
      agentsError: null,
      setAgents: jest.fn(),
      setCurrentAgent: jest.fn(),
      setAgentsLoading: jest.fn(),
      setAgentsError: jest.fn(),
    });

    // Mock session store
    mockedSessionStore.mockReturnValue({
      currentSession: null,
      agentSessions: {},
      createNewSession: jest.fn((agentId: string) => ({
        id: Date.now().toString(),
        title: '新对话',
        agentId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      deleteSession: jest.fn(),
      switchToSession: jest.fn(),
      renameSession: jest.fn(),
      clearCurrentAgentSessions: jest.fn(),
      initializeAgentSessions: jest.fn(),
      setAgentSessionsForAgent: jest.fn(),
      bindSessionId: jest.fn(),
      setSessionMessages: jest.fn(),
      updateSession: jest.fn(),
      updateSessionTitleIntelligently: jest.fn(),
      getSessionById: jest.fn(),
      getAgentSessions: jest.fn(),
      getCurrentSession: jest.fn(),
    });

    // Mock preference store
    mockedPreferenceStore.mockReturnValue({
      preferences: {
        theme: {
          mode: 'auto' as const,
          isAutoMode: true,
          userPreference: 'auto' as const,
        },
        streamingEnabled: true,
        autoThemeSchedule: {
          enabled: true,
          lightModeStart: '06:00',
          darkModeStart: '18:00',
        },
        language: 'zh-CN' as const,
      },
      updatePreferences: jest.fn(),
      resetPreferences: jest.fn(),
      getThemeMode: jest.fn(),
      isStreamingEnabled: jest.fn(),
      getLanguage: jest.fn(),
    });

    // Setup default mock return values for getState methods
    const mockMessageGetState = jest.fn(() => ({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: jest.fn(),
      clearMessages: jest.fn(),
      updateMessageById: jest.fn(),
      setMessageFeedback: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
      appendToBuffer: jest.fn(),
      flushBuffer: jest.fn(),
      updateLastMessage: jest.fn(),
      appendReasoningStep: jest.fn(),
      finalizeReasoning: jest.fn(),
      appendAssistantEvent: jest.fn(),
      setIsStreaming: jest.fn(),
      setStreamingStatus: jest.fn(),
      setStreamAbortController: jest.fn(),
      stopStreaming: jest.fn(),
      _scheduleFlush: jest.fn(),
    }));

    const mockAgentGetState = jest.fn(() => ({
      currentAgent: {
        id: 'test-agent-id',
        name: 'Test Agent',
        description: 'Test Description',
        model: 'test-model',
        status: 'active' as const,
        capabilities: [],
        provider: 'test-provider',
      },
      agents: [],
      agentsLoading: false,
      agentsError: null,
      setAgents: jest.fn(),
      setCurrentAgent: jest.fn(),
      setAgentsLoading: jest.fn(),
      setAgentsError: jest.fn(),
    }));

    const mockSessionGetState = jest.fn(() => ({
      currentSession: null,
      agentSessions: {},
      createNewSession: jest.fn((agentId: string) => ({
        id: Date.now().toString(),
        title: '新对话',
        agentId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      deleteSession: jest.fn(),
      switchToSession: jest.fn(),
      renameSession: jest.fn(),
      clearCurrentAgentSessions: jest.fn(),
      initializeAgentSessions: jest.fn(),
      setAgentSessionsForAgent: jest.fn(),
      bindSessionId: jest.fn(),
      setSessionMessages: jest.fn(),
      updateSession: jest.fn(),
      updateSessionTitleIntelligently: jest.fn(),
      getSessionById: jest.fn(),
      getAgentSessions: jest.fn(),
      getCurrentSession: jest.fn(),
    }));

    const mockPreferenceGetState = jest.fn(() => ({
      preferences: {
        theme: {
          mode: 'auto' as const,
          isAutoMode: true,
          userPreference: 'auto' as const,
        },
        streamingEnabled: true,
        autoThemeSchedule: {
          enabled: true,
          lightModeStart: '06:00',
          darkModeStart: '18:00',
        },
        language: 'zh-CN' as const,
      },
      updatePreferences: jest.fn(),
      resetPreferences: jest.fn(),
      getThemeMode: jest.fn(),
      isStreamingEnabled: jest.fn(),
      getLanguage: jest.fn(),
    }));

    // Override the getState methods for all stores
    mockedMessageStore.mockImplementation(() => ({
      ...mockedMessageStore.mock.results[0].value,
      getState: mockMessageGetState,
    }));

    mockedAgentStore.mockImplementation(() => ({
      ...mockedAgentStore.mock.results[0].value,
      getState: mockAgentGetState,
    }));

    mockedSessionStore.mockImplementation(() => ({
      ...mockedSessionStore.mock.results[0].value,
      getState: mockSessionGetState,
    }));

    mockedPreferenceStore.mockImplementation(() => ({
      ...mockedPreferenceStore.mock.results[0].value,
      getState: mockPreferenceGetState,
    }));
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

    const mockAddMessage = jest.fn();
    const mockCreateNewSession = jest.fn();

    // Update the message store mock to include addMessage
    const mockMessageGetState = jest.fn(() => ({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: mockAddMessage,
      clearMessages: jest.fn(),
      updateMessageById: jest.fn(),
      setMessageFeedback: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
      appendToBuffer: jest.fn(),
      flushBuffer: jest.fn(),
      updateLastMessage: jest.fn(),
      appendReasoningStep: jest.fn(),
      finalizeReasoning: jest.fn(),
      appendAssistantEvent: jest.fn(),
      setIsStreaming: jest.fn(),
      setStreamingStatus: jest.fn(),
      setStreamAbortController: jest.fn(),
      stopStreaming: jest.fn(),
      _scheduleFlush: jest.fn(),
    }));

    const mockSessionGetState = jest.fn(() => ({
      currentSession: null,
      agentSessions: {},
      createNewSession: mockCreateNewSession,
      deleteSession: jest.fn(),
      switchToSession: jest.fn(),
      renameSession: jest.fn(),
      clearCurrentAgentSessions: jest.fn(),
      initializeAgentSessions: jest.fn(),
      setAgentSessionsForAgent: jest.fn(),
      bindSessionId: jest.fn(),
      setSessionMessages: jest.fn(),
      updateSession: jest.fn(),
      updateSessionTitleIntelligently: jest.fn(),
      getSessionById: jest.fn(),
      getAgentSessions: jest.fn(),
      getCurrentSession: jest.fn(),
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

    const mockAddMessage = jest.fn();
    const mockCreateNewSession = jest.fn();
    const mockSetIsStreaming = jest.fn();
    const mockSetStreamingStatus = jest.fn();
    const mockSetStreamAbortController = jest.fn();
    const mockAppendToBuffer = jest.fn();

    const mockMessageGetState = jest.fn(() => ({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: mockAddMessage,
      clearMessages: jest.fn(),
      updateMessageById: jest.fn(),
      setMessageFeedback: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
      appendToBuffer: mockAppendToBuffer,
      flushBuffer: jest.fn(),
      updateLastMessage: jest.fn(),
      appendReasoningStep: jest.fn(),
      finalizeReasoning: jest.fn(),
      appendAssistantEvent: jest.fn(),
      setIsStreaming: mockSetIsStreaming,
      setStreamingStatus: mockSetStreamingStatus,
      setStreamAbortController: mockSetStreamAbortController,
      stopStreaming: jest.fn(),
      _scheduleFlush: jest.fn(),
    }));

    const mockSessionGetState = jest.fn(() => ({
      currentSession: null,
      agentSessions: {},
      createNewSession: mockCreateNewSession,
      deleteSession: jest.fn(),
      switchToSession: jest.fn(),
      renameSession: jest.fn(),
      clearCurrentAgentSessions: jest.fn(),
      initializeAgentSessions: jest.fn(),
      setAgentSessionsForAgent: jest.fn(),
      bindSessionId: jest.fn(),
      setSessionMessages: jest.fn(),
      updateSession: jest.fn(),
      updateSessionTitleIntelligently: jest.fn(),
      getSessionById: jest.fn(),
      getAgentSessions: jest.fn(),
      getCurrentSession: jest.fn(),
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

    const mockSessionGetState = jest.fn(() => ({
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
      createNewSession: jest.fn(),
      deleteSession: jest.fn(),
      switchToSession: jest.fn(),
      renameSession: jest.fn(),
      clearCurrentAgentSessions: jest.fn(),
      initializeAgentSessions: jest.fn(),
      setAgentSessionsForAgent: jest.fn(),
      bindSessionId: jest.fn(),
      setSessionMessages: jest.fn(),
      updateSession: jest.fn(),
      updateSessionTitleIntelligently: jest.fn(),
      getSessionById: jest.fn(),
      getAgentSessions: jest.fn(),
      getCurrentSession: jest.fn(),
    }));

    const mockMessageGetState = jest.fn(() => ({
      messages: [{ id: 'message-1', AI: 'Previous content', timestamp: Date.now() }],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: jest.fn(),
      clearMessages: jest.fn(),
      updateMessageById: jest.fn(),
      setMessageFeedback: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
      appendToBuffer: jest.fn(),
      flushBuffer: jest.fn(),
      updateLastMessage: jest.fn(),
      appendReasoningStep: jest.fn(),
      finalizeReasoning: jest.fn(),
      appendAssistantEvent: jest.fn(),
      setIsStreaming: jest.fn(),
      setStreamingStatus: jest.fn(),
      setStreamAbortController: jest.fn(),
      stopStreaming: jest.fn(),
      _scheduleFlush: jest.fn(),
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
    const mockSendMessage = jest.fn().mockResolvedValue({});
    mockedChatService.sendMessage = mockSendMessage;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.continueInteractiveSelect("Option 1");
    });

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it("should continue interactive form", async () => {
    const mockSendMessage = jest.fn().mockResolvedValue({});
    const formData = { field1: "value1", field2: "value2" };

    mockedChatService.sendMessage = mockSendMessage;

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.continueInteractiveForm(formData);
    });

    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(formData));
  });
});
