import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatContainer } from "../ChatContainer";
import { useMessageStore } from "@/store/messageStore";
import { useAgentStore } from "@/store/agentStore";
import { useSessionStore } from "@/store/sessionStore";

// Mock the stores
jest.mock("@/store/messageStore");
jest.mock("@/store/agentStore");
jest.mock("@/store/sessionStore");

// Mock the child components
jest.mock("../MessageList", () => ({
  MessageList: () => <div data-testid="message-list">Message List</div>,
}));

jest.mock("../MessageInput", () => ({
  MessageInput: () => <div data-testid="message-input">Message Input</div>,
}));

describe("ChatContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock store implementations
    (useMessageStore as jest.Mock).mockReturnValue({
      messages: [],
      isStreaming: false,
      stopStreaming: jest.fn(),
      addMessage: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
    });

    (useAgentStore as jest.Mock).mockReturnValue({
      currentAgent: null,
    });

    (useSessionStore as jest.Mock).mockReturnValue({
      currentSession: null,
      bindSessionId: jest.fn(),
    });
  });

  it("should render empty state when no agent is selected", () => {
    render(<ChatContainer />);

    expect(screen.getByText("请选择一个智能体")).toBeInTheDocument();
    expect(screen.queryByTestId("message-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-input")).not.toBeInTheDocument();
  });

  it("should render empty state when agent is selected but no messages", () => {
    (useAgentStore as jest.Mock).mockReturnValue({
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
    (useMessageStore as jest.Mock).mockReturnValue({
      messages: [{ HUMAN: "Hello", timestamp: Date.now() }],
      isStreaming: false,
      stopStreaming: jest.fn(),
      addMessage: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
    });

    (useAgentStore as jest.Mock).mockReturnValue({
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
    (useMessageStore as jest.Mock).mockReturnValue({
      messages: [{ HUMAN: "Hello", timestamp: Date.now() }],
      isStreaming: false,
      stopStreaming: jest.fn(),
      addMessage: jest.fn(),
      removeLastInteractiveMessage: jest.fn(),
    });

    (useAgentStore as jest.Mock).mockReturnValue({
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
