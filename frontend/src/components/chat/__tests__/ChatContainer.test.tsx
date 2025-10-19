/**
 * ChatContainer 组件测试
 * 测试聊天容器组件的核心功能
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ChatContainer } from "../ChatContainer";
import { useChatStore } from "@/store/chatStore";
import { useAgentStore } from "@/store/agentStore";

// Mock the stores
vi.mock("@/store/chatStore");
vi.mock("@/store/agentStore");

// Type declarations for mocked modules
const mockUseChatStore = useChatStore as any;
const mockUseAgentStore = useAgentStore as any;

// Mock the child components
vi.mock("../MessageList", () => ({
  default: ({ messages, isLoading }: any) => (
    <div data-testid="message-list">
      {isLoading && <div data-testid="loading">Loading...</div>}
      {messages.map((msg: any, index: number) => (
        <div key={index} data-testid="message">{msg.content}</div>
      ))}
    </div>
  )
}));

vi.mock("../MessageInput", () => ({
  default: ({ onSendMessage, disabled }: any) => (
    <div data-testid="message-input">
      <button
        data-testid="send-button"
        onClick={() => onSendMessage('Test message')}
        disabled={disabled}
      >
        Send
      </button>
    </div>
  )
}));

describe("ChatContainer", () => {
  const mockChatStore = {
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ],
    isLoading: false,
    streaming: false,
    currentSession: { id: 'session-1', title: 'Test Session' },
    addMessage: vi.fn(),
    clearMessages: vi.fn(),
    setLoading: vi.fn(),
    setStreaming: vi.fn()
  };

  const mockAgentStore = {
    agents: [
      {
        id: 'agent-1',
        name: 'Test Agent',
        provider: 'openai',
        status: 'active'
      }
    ],
    currentAgent: {
      id: 'agent-1',
      name: 'Test Agent',
      provider: 'openai',
      status: 'active'
    },
    setCurrentAgent: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatStore.mockReturnValue(mockChatStore);
    mockUseAgentStore.mockReturnValue(mockAgentStore);
  });

  it("should render empty state when no agent is selected", () => {
    mockUseAgentStore.mockReturnValue({
      ...mockAgentStore,
      currentAgent: null
    });

    render(<ChatContainer />);

    expect(screen.getByText("请选择一个智能体")).toBeInTheDocument();
    expect(screen.queryByTestId("message-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-input")).not.toBeInTheDocument();
  });

  it("should render chat interface when agent is selected", () => {
    render(<ChatContainer />);

    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.queryByText("请选择一个智能体")).not.toBeInTheDocument();
  });

  it("should display messages correctly", () => {
    render(<ChatContainer />);

    const messages = screen.getAllByTestId("message");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveTextContent("Hello");
    expect(messages[1]).toHaveTextContent("Hi there!");
  });

  it("should show loading state", () => {
    mockUseChatStore.mockReturnValue({
      ...mockChatStore,
      isLoading: true
    });

    render(<ChatContainer />);

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("should disable input when streaming", () => {
    mockUseChatStore.mockReturnValue({
      ...mockChatStore,
      streaming: true
    });

    render(<ChatContainer />);

    const sendButton = screen.getByTestId("send-button");
    expect(sendButton).toBeDisabled();
  });

  it("should handle message sending", async () => {
    render(<ChatContainer />);

    const sendButton = screen.getByTestId("send-button");
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockChatStore.addMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Test message'
      });
    });
  });

  it("should handle empty message list", () => {
    mockUseChatStore.mockReturnValue({
      ...mockChatStore,
      messages: []
    });

    render(<ChatContainer />);

    const messages = screen.queryAllByTestId("message");
    expect(messages).toHaveLength(0);
  });

  it("should display session title", () => {
    render(<ChatContainer />);

    expect(screen.getByText("Test Session")).toBeInTheDocument();
  });

  it("should handle agent switching", () => {
    const { rerender } = render(<ChatContainer />);

    // Switch to different agent
    mockUseAgentStore.mockReturnValue({
      ...mockAgentStore,
      currentAgent: {
        id: 'agent-2',
        name: 'New Agent',
        provider: 'fastgpt',
        status: 'active'
      }
    });

    rerender(<ChatContainer />);

    expect(screen.getByText("New Agent")).toBeInTheDocument();
  });

  it("should handle keyboard shortcuts", () => {
    render(<ChatContainer />);

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    // Verify shortcut handling
    expect(mockChatStore.addMessage).toHaveBeenCalled();
  });

  it("should handle error states", () => {
    mockUseChatStore.mockReturnValue({
      ...mockChatStore,
      error: "Connection failed"
    });

    render(<ChatContainer />);

    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });

  describe("边界情况", () => {
    it("should handle network connection errors", () => {
      mockUseChatStore.mockReturnValue({
        ...mockChatStore,
        error: "Network connection failed",
        isLoading: false
      });

      render(<ChatContainer />);

      expect(screen.getByText("Network connection failed")).toBeInTheDocument();
      const retryButton = screen.getByText("重试");
      expect(retryButton).toBeInTheDocument();
    });

    it("should handle large message lists", () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`
      }));

      mockUseChatStore.mockReturnValue({
        ...mockChatStore,
        messages: manyMessages
      });

      render(<ChatContainer />);

      const messages = screen.getAllByTestId("message");
      expect(messages).toHaveLength(100);
    });

    it("should handle session switching", async () => {
      const { rerender } = render(<ChatContainer />);

      // Switch session
      mockUseChatStore.mockReturnValue({
        ...mockChatStore,
        currentSession: { id: 'session-2', title: 'New Session' },
        messages: []
      });

      rerender(<ChatContainer />);

      expect(screen.getByText("New Session")).toBeInTheDocument();
      const messages = screen.queryAllByTestId("message");
      expect(messages).toHaveLength(0);
    });
  });

  describe("性能测试", () => {
    it("should render within reasonable time", () => {
      const startTime = performance.now();

      render(<ChatContainer />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100); // 应该在100ms内完成渲染
    });

    it("should handle rapid state changes", () => {
      const { rerender } = render(<ChatContainer />);

      // 快速切换状态
      for (let i = 0; i < 10; i++) {
        mockUseChatStore.mockReturnValue({
          ...mockChatStore,
          isLoading: i % 2 === 0,
          streaming: i % 3 === 0
        });
        rerender(<ChatContainer />);
      }

      // 组件应该能够处理快速的状态变化
      expect(screen.getByTestId("message-list")).toBeInTheDocument();
    });
  });

  describe("可访问性测试", () => {
    it("should have proper ARIA labels", () => {
      render(<ChatContainer />);

      expect(screen.getByRole("main")).toHaveAttribute("aria-label", "聊天界面");
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-label", "消息输入框");
    });

    it("should support keyboard navigation", () => {
      render(<ChatContainer />);

      const input = screen.getByRole("textbox");
      input.focus();

      expect(input).toHaveFocus();

      fireEvent.keyDown(input, { key: "Tab" });
      // 验证焦点正确移动
    });

    it("should announce screen reader messages", () => {
      mockUseChatStore.mockReturnValue({
        ...mockChatStore,
        messages: [
          { role: "assistant", content: "This is an important message" }
        ]
      });

      render(<ChatContainer />);

      const message = screen.getByText("This is an important message");
      expect(message).toHaveAttribute("aria-live", "polite");
    });
  });
});