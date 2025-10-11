import { render, screen } from "@testing-library/react";
import { VirtualizedMessageList } from "../VirtualizedMessageList";
import { ChatMessage } from "@/types";

// Mock the useChatStore hook
vi.mock("@/store/chatStore", () => ({
  useChatStore: () => ({
    currentAgent: null,
    streamingStatus: null,
  }),
}));

// Mock the useI18n hook
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Helper function to generate test messages
const generateMessages = (count: number): ChatMessage[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    AI: undefined,
    HUMAN: `Test message ${i}`,
    timestamp: Date.now() + i,
  }));
};

describe("VirtualizedMessageList Performance", () => {
  beforeEach(() => {
    // Mock window dimensions
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  it("renders 100 messages efficiently", () => {
    const messages = generateMessages(100);
    const startTime = performance.now();

    render(
      <VirtualizedMessageList
        messages={messages}
        isStreaming={false}
        onInteractiveSelect={vi.fn()}
        onInteractiveFormSubmit={vi.fn()}
        onRetryMessage={vi.fn()}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in less than 50ms
    expect(renderTime).toBeLessThan(50);

    // Should only render visible items (much less than 100)
    const messageItems = screen.queryAllByRole("article");
    expect(messageItems.length).toBeLessThan(50);
  });

  it("renders 500 messages efficiently", () => {
    const messages = generateMessages(500);
    const startTime = performance.now();

    render(
      <VirtualizedMessageList
        messages={messages}
        isStreaming={false}
        onInteractiveSelect={vi.fn()}
        onInteractiveFormSubmit={vi.fn()}
        onRetryMessage={vi.fn()}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in less than 100ms
    expect(renderTime).toBeLessThan(100);

    // Should only render visible items (much less than 500)
    const messageItems = screen.queryAllByRole("article");
    expect(messageItems.length).toBeLessThan(100);
  });

  it("renders 1000 messages efficiently", () => {
    const messages = generateMessages(1000);
    const startTime = performance.now();

    render(
      <VirtualizedMessageList
        messages={messages}
        isStreaming={false}
        onInteractiveSelect={vi.fn()}
        onInteractiveFormSubmit={vi.fn()}
        onRetryMessage={vi.fn()}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in less than 200ms
    expect(renderTime).toBeLessThan(200);

    // Should only render visible items (much less than 1000)
    const messageItems = screen.queryAllByRole("article");
    expect(messageItems.length).toBeLessThan(150);
  });
});
