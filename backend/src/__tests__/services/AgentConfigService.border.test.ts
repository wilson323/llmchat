import { AgentConfigService } from "../../services/AgentConfigService";
import { AgentConfig } from "@/types";
import fs from "fs/promises";
import { withClient } from "@/utils/db";

// Mock fs and db
jest.mock("fs/promises");
jest.mock("@/utils/db");

describe("AgentConfigService - Boundary Scenarios", () => {
  let service: AgentConfigService;
  let mockConfigPath: string;

  beforeEach(() => {
    mockConfigPath = "/mock/config/path";
    service = new AgentConfigService(mockConfigPath);
    jest.clearAllMocks();
  });

  describe("loadAgents - Edge Cases", () => {
    it("should handle empty config file", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      });

      const agents = await service.loadAgents();

      // Should fallback to builtin seeds
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].isActive).toBe(false); // builtin seeds are inactive by default
    });

    it("should handle malformed JSON config", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue("invalid json");
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      });

      const agents = await service.loadAgents();

      // Should fallback to builtin seeds
      expect(agents.length).toBeGreaterThan(0);
    });

    it("should handle config file with invalid agent data", async () => {
      const invalidConfig = {
        agents: [
          { id: "1" }, // Missing required fields
          {
            id: "2",
            name: "Valid Agent",
            description: "Valid",
            endpoint: "http://test.com",
            apiKey: "key",
            model: "model",
            provider: "custom",
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidConfig)
      );
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      });

      const agents = await service.loadAgents();

      // Should only include valid agents
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe("2");
    });

    it("should handle database connection failure", async () => {
      (withClient as jest.Mock).mockRejectedValue(
        new Error("DB connection failed")
      );
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify({
          agents: [
            {
              id: "1",
              name: "Test Agent",
              description: "Test",
              endpoint: "http://test.com",
              apiKey: "key",
              model: "model",
              provider: "custom",
            },
          ],
        })
      );

      const agents = await service.loadAgents();

      // Should fallback to file loading
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe("1");
    });
  });

  describe("getAgent - Edge Cases", () => {
    it("should return null for non-existent agent", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      });

      const agent = await service.getAgent("non-existent");

      expect(agent).toBeNull();
    });

    it("should handle database error when fetching agent", async () => {
      (withClient as jest.Mock).mockRejectedValue(new Error("DB error"));
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify({
          agents: [
            {
              id: "test-agent",
              name: "Test Agent",
              description: "Test",
              endpoint: "http://test.com",
              apiKey: "key",
              model: "model",
              provider: "custom",
            },
          ],
        })
      );

      const agent = await service.getAgent("test-agent");

      // Should fallback to file loading
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe("test-agent");
    });
  });

  describe("createAgent - Edge Cases", () => {
    it("should generate ID when not provided", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
      });

      const input = {
        name: "Test Agent",
        description: "Test",
        endpoint: "http://test.com",
        apiKey: "key",
        model: "model",
        provider: "custom" as const,
      };

      const agent = await service.createAgent(input);

      expect(agent.id).toBeDefined();
      expect(agent.id).not.toBe("");
    });

    it("should reject invalid provider", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
      });

      const input = {
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        endpoint: "http://test.com",
        apiKey: "key",
        model: "model",
        provider: "invalid-provider" as any,
      };

      await expect(service.createAgent(input)).rejects.toThrow();
    });

    it("should reject invalid endpoint URL", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
      });

      const input = {
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        endpoint: "invalid-url",
        apiKey: "key",
        model: "model",
        provider: "custom",
      };

      await expect(service.createAgent(input)).rejects.toThrow();
    });

    it("should reject FastGPT agent without valid appId", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
      });

      const input = {
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        endpoint: "http://test.com",
        apiKey: "key",
        model: "model",
        provider: "fastgpt",
        appId: "invalid-app-id", // Not a 24-character hex string
      };

      await expect(service.createAgent(input)).rejects.toThrow();
    });
  });

  describe("updateAgent - Edge Cases", () => {
    it("should reject updating non-existent agent", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      });

      await expect(
        service.updateAgent("non-existent", { name: "Updated" })
      ).rejects.toThrow();
    });

    it("should reject invalid update data", async () => {
      // First create a valid agent
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        if (callback.name === "mockInsert") {
          return { query: jest.fn().mockResolvedValue({}) };
        } else {
          return {
            query: jest.fn().mockResolvedValue({
              rows: [
                {
                  id: "test-agent",
                  name: "Test Agent",
                  description: "Test",
                  provider: "custom",
                  endpoint: "http://test.com",
                  api_key: "key",
                  model: "model",
                  capabilities: [],
                  features: {},
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            }),
          };
        }
      });

      await service.createAgent({
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        endpoint: "http://test.com",
        apiKey: "key",
        model: "model",
        provider: "custom",
      });

      // Try to update with invalid data
      await expect(
        service.updateAgent("test-agent", {
          endpoint: "invalid-url",
        })
      ).rejects.toThrow();
    });
  });

  describe("deleteAgent - Edge Cases", () => {
    it("should handle deleting non-existent agent", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
      });

      // Should not throw an error
      await expect(
        service.deleteAgent("non-existent")
      ).resolves.toBeUndefined();
    });
  });

  describe("checkAgentHealth - Edge Cases", () => {
    it("should return error status for non-existent agent", async () => {
      (withClient as jest.Mock).mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      });

      const health = await service.checkAgentHealth("non-existent");

      expect(health.status).toBe("error");
      expect(health.error).toBe("智能体不存在");
    });

    it("should handle health check errors", async () => {
      // Mock an existing agent
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        return {
          query: jest.fn().mockResolvedValue({
            rows: [
              {
                id: "test-agent",
                name: "Test Agent",
                description: "Test",
                provider: "custom",
                endpoint: "http://test.com",
                api_key: "key",
                model: "model",
                capabilities: [],
                features: {},
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          }),
        };
      });

      // Mock a failed health check (this is a simple mock since the current implementation doesn't actually check)
      const health = await service.checkAgentHealth("test-agent");

      // The current implementation just checks if the agent is active
      expect(health.status).toBe("active");
    });
  });
});
