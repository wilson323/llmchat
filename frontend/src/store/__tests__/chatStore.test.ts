import { useChatStore } from "../chatStore";

// Reset all stores before each test
beforeEach(() => {
  useChatStore.getState().clearMessages();
  useChatStore.getState().setAgents([]);
  useChatStore.getState().setCurrentAgent(null);
  useChatStore.getState().setAgentSelectorOpen(false);
  useChatStore.getState().setSidebarOpen(false);
});

describe("chatStore", () => {
  it("should initialize with default values", () => {
    const state = useChatStore.getState();

    expect(state.agents).toEqual([]);
    expect(state.currentAgent).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.agentSelectorOpen).toBe(false);
    expect(state.sidebarOpen).toBe(false);
  });

  it("should set agents", () => {
    const agents = [
      {
        id: "1",
        name: "Agent 1",
        description: "Test agent",
        model: "model1",
        status: "active",
        capabilities: [],
        provider: "custom",
      },
      {
        id: "2",
        name: "Agent 2",
        description: "Test agent 2",
        model: "model2",
        status: "inactive",
        capabilities: [],
        provider: "custom",
      },
    ];

    useChatStore.getState().setAgents(agents);

    const state = useChatStore.getState();
    expect(state.agents).toEqual(agents);
  });

  it("should set current agent", () => {
    const agent = {
      id: "1",
      name: "Agent 1",
      description: "Test agent",
      model: "model1",
      status: "active",
      capabilities: [],
      provider: "custom",
    };

    useChatStore.getState().setCurrentAgent(agent);

    const state = useChatStore.getState();
    expect(state.currentAgent).toEqual(agent);
  });

  it("should add messages", () => {
    const message = { HUMAN: "Hello", timestamp: Date.now() };

    useChatStore.getState().addMessage(message);

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual(expect.objectContaining(message));
  });

  it("should clear messages", () => {
    const message = { HUMAN: "Hello", timestamp: Date.now() };

    useChatStore.getState().addMessage(message);
    useChatStore.getState().clearMessages();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
  });

  it("should set streaming state", () => {
    useChatStore.getState().setIsStreaming(true);

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(true);
  });

  it("should set agent selector open state", () => {
    useChatStore.getState().setAgentSelectorOpen(true);

    const state = useChatStore.getState();
    expect(state.agentSelectorOpen).toBe(true);
  });

  it("should set sidebar open state", () => {
    useChatStore.getState().setSidebarOpen(true);

    const state = useChatStore.getState();
    expect(state.sidebarOpen).toBe(true);
  });

  it("should create new session", () => {
    const agent = {
      id: "1",
      name: "Agent 1",
      description: "Test agent",
      model: "model1",
      status: "active",
      capabilities: [],
      provider: "custom",
    };
    useChatStore.getState().setCurrentAgent(agent);

    useChatStore.getState().createNewSession();

    const state = useChatStore.getState();
    expect(state.currentSession).not.toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.agentSessions[agent.id]).toHaveLength(1);
  });

  it("should switch to session", () => {
    const agent = {
      id: "1",
      name: "Agent 1",
      description: "Test agent",
      model: "model1",
      status: "active",
      capabilities: [],
      provider: "custom",
    };
    useChatStore.getState().setCurrentAgent(agent);

    // Create two sessions
    useChatStore.getState().createNewSession();
    const session1 = useChatStore.getState().currentSession;

    useChatStore.getState().createNewSession();
    const session2 = useChatStore.getState().currentSession;

    // Switch to first session
    if (session1) {
      useChatStore.getState().switchToSession(session1.id);

      const state = useChatStore.getState();
      expect(state.currentSession?.id).toBe(session1.id);
    }
  });

  it("should delete session", () => {
    const agent = {
      id: "1",
      name: "Agent 1",
      description: "Test agent",
      model: "model1",
      status: "active",
      capabilities: [],
      provider: "custom",
    };
    useChatStore.getState().setCurrentAgent(agent);

    useChatStore.getState().createNewSession();
    const session = useChatStore.getState().currentSession;

    if (session) {
      useChatStore.getState().deleteSession(session.id);

      const state = useChatStore.getState();
      expect(state.agentSessions[agent.id]).toHaveLength(0);
      expect(state.currentSession).toBeNull();
    }
  });
});
