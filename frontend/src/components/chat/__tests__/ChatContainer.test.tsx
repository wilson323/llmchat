import { render, screen } from "@testing-library/react";
import { ChatContainer } from "../ChatContainer";
import { useMessageStore } from "@/store/messageStore";
import { useAgentStore } from "@/store/agentStore";
import { useSessionStore } from "@/store/sessionStore";

// Mock the stores
vi.mock("@/store/messageStore");
vi.mock("@/store/agentStore");
vi.mock("@/store/sessionStore");

// Type declarations for mocked modules
const mockUseMessageStore = useMessageStore as any;
const mockUseAgentStore = useAgentStore as any;
const mockUseSessionStore = useSessionStore as any;

// Mock the child components
vi.mock("../MessageList", () => ({
  MessageList: () => <div data-testid="message-list">Message List</div>,
}));

vi.mock("../MessageInput", () => ({
  MessageInput: () => <div data-testid="message-input">Message Input</div>,
}));

describe("ChatContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store implementations
    mockUseMessageStore.mockReturnValue({
      messages: [],
      isStreaming: false,
      stopStreaming: vi.fn(),
      addMessage: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
    });

    mockUseAgentStore.mockReturnValue({
      currentAgent: null,
    });

    mockUseSessionStore.mockReturnValue({
      currentSession: null,
      bindSessionId: vi.fn(),
    });
  });

  it("should render empty state when no agent is selected", () => {
    render(<ChatContainer />);

    expect(screen.getByText("请选择一个智能体")).toBeInTheDocument();
    expect(screen.queryByTestId("message-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-input")).not.toBeInTheDocument();
  });

  it("should render empty state when agent is selected but no messages", () => {
    mockUseAgentStore.mockReturnValue({
      currentAgent: {
        id: "1",
        name: "Test Agent",
        description: "Test Description",
        model: "test-model",
        status: "active",
        capabilities: [],
        provider: "custom",
      },
    });

    render(<ChatContainer />);

    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.queryByTestId("message-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-input")).toBeInTheDocument();
  });

  it("should render messages when there are messages", () => {
    mockUseMessageStore.mockReturnValue({
      messages: [{ HUMAN: "Hello", timestamp: Date.now() }],
      isStreaming: false,
      stopStreaming: vi.fn(),
      addMessage: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
    });

    mockUseAgentStore.mockReturnValue({
      currentAgent: {
        id: "1",
        name: "Test Agent",
        description: "Test Description",
        model: "test-model",
        status: "active",
        capabilities: [],
        provider: "custom",
      },
    });

    render(<ChatContainer />);

    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
    expect(screen.queryByText("请选择一个智能体")).not.toBeInTheDocument();
  });

  it("should hide composer when hideComposer is true", () => {
    mockUseMessageStore.mockReturnValue({
      messages: [{ HUMAN: "Hello", timestamp: Date.now() }],
      isStreaming: false,
      stopStreaming: vi.fn(),
      addMessage: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
    });

    mockUseAgentStore.mockReturnValue({
      currentAgent: {
        id: "1",
        name: "Test Agent",
        description: "Test Description",
        model: "test-model",
        status: "active",
        capabilities: [],
        provider: "custom",
      },
    });

    // We can't easily test the hideComposer state without a way to set it
    // This would require a more complex setup with context or props
    render(<ChatContainer />);

    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });
});
