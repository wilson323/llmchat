import { api, agentService, chatService } from "../api";
import { Agent } from "@/types";

// Mock axios
jest.mock("axios");
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  defaults: {
    baseURL: "/api",
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  },
};

describe("api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create axios instance with correct config", () => {
    expect(api.defaults.baseURL).toBe("/api");
    expect(api.defaults.timeout).toBe(30000);
    expect(api.defaults.headers["Content-Type"]).toBe("application/json");
  });

  describe("agentService", () => {
    it("should fetch agents", async () => {
      const mockAgents: Agent[] = [
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

      mockAxios.get.mockResolvedValue({ data: { data: mockAgents } });

      const agents = await agentService.getAgents();

      expect(agents).toEqual(mockAgents);
      expect(mockAxios.get).toHaveBeenCalledWith("/agents");
    });

    it("should fetch single agent", async () => {
      const mockAgent: Agent = {
        id: "1",
        name: "Agent 1",
        description: "Test agent",
        model: "model1",
        status: "active",
        capabilities: [],
        provider: "custom",
      };

      mockAxios.get.mockResolvedValue({ data: { data: mockAgent } });

      const agent = await agentService.getAgent("1");

      expect(agent).toEqual(mockAgent);
      expect(mockAxios.get).toHaveBeenCalledWith("/agents/1");
    });
  });

  describe("chatService", () => {
    it("should send message", async () => {
      const mockResponse = {
        id: "response-1",
        AI: "Hello! How can I help you?",
        timestamp: Date.now(),
      };

      mockAxios.post.mockResolvedValue({ data: { data: mockResponse } });

      const response = await chatService.sendMessage("agent-1", [
        { role: "user", content: "Hello", id: "user-1", timestamp: Date.now() },
      ]);

      expect(response).toEqual(mockResponse);
      expect(mockAxios.post).toHaveBeenCalledWith("/chat/completions", {
        agentId: "agent-1",
        messages: [{ HUMAN: "Hello" }],
        stream: false,
      });
    });

    it("should list chat histories", async () => {
      const mockHistories = [
        { id: "chat-1", title: "Chat 1", updatedAt: new Date().toISOString() },
        { id: "chat-2", title: "Chat 2", updatedAt: new Date().toISOString() },
      ];

      mockAxios.get.mockResolvedValue({ data: { data: mockHistories } });

      const histories = await chatService.listHistories("agent-1");

      expect(histories).toEqual(mockHistories);
      expect(mockAxios.get).toHaveBeenCalledWith("/chat/history", {
        params: { agentId: "agent-1" },
      });
    });

    it("should delete chat history", async () => {
      mockAxios.delete.mockResolvedValue({ data: {} });

      await chatService.deleteHistory("agent-1", "chat-1");

      expect(mockAxios.delete).toHaveBeenCalledWith("/chat/history/chat-1", {
        params: { agentId: "agent-1" },
      });
    });
  });
});
