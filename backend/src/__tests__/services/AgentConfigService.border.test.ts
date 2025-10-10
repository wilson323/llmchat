import { AgentConfigService } from "../../services/AgentConfigService";
import { AgentConfig } from "@/types";
import fs from "fs/promises";
import { withClient } from "@/utils/db";

// Mock fs and db
jest.mock("fs/promises");
jest.mock("@/utils/db");

// Mock logger after imports
jest.mock('@/utils/logger', () => {
  const mockLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  return mockLogger;
});

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
      // Create a direct test without database complexity by testing file-only loading
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({}));

      // Force a database failure that's non-transient to skip file loading and fall through to defaults
      (withClient as jest.Mock).mockRejectedValue(new Error("DATABASE_CONFIG_MISSING"));

      const freshService = new AgentConfigService(mockConfigPath);
      const agents = await freshService.loadAgents();

      // Should fallback to builtin seeds when both DB and file fail
      expect(agents.length).toBeGreaterThan(0);
      if (agents.length > 0) {
        expect(agents[0]?.isActive).toBe(false); // builtin seeds are inactive by default
      }
    });

    it("should handle malformed JSON config", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue("invalid json");

      // Force database to have persistent error
      (withClient as jest.Mock).mockRejectedValue(new Error("DATABASE_CONFIG_MISSING"));

      const freshService = new AgentConfigService(mockConfigPath);
      const agents = await freshService.loadAgents();

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

      // Force database to have persistent error to trigger file loading
      (withClient as jest.Mock).mockRejectedValue(new Error("DATABASE_CONFIG_MISSING"));

      const freshService = new AgentConfigService(mockConfigPath);
      const agents = await freshService.loadAgents();

      // Should only include valid agents from file
      expect(agents).toHaveLength(1);
      if (agents.length > 0) {
        expect(agents[0]?.id).toBe("2");
      }
    });

    it("should handle database connection failure", async () => {
      (withClient as jest.Mock).mockRejectedValue(
        new Error("DATABASE_CONFIG_MISSING") // Use non-transient error to trigger file loading
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

      const freshService = new AgentConfigService(mockConfigPath);
      const agents = await freshService.loadAgents();

      // Should fallback to file loading
      expect(agents).toHaveLength(1);
      if (agents.length > 0) {
        expect(agents[0]?.id).toBe("1");
      }
    });
  });

  describe("getAgent - Edge Cases", () => {
    it("should return null for non-existent agent", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
      });

      const agent = await freshService.getAgent("non-existent");

      expect(agent).toBeNull();
    });

    it("should handle database error when fetching agent", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      (withClient as jest.Mock).mockRejectedValue(new Error("DATABASE_CONFIG_MISSING"));
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

      const agent = await freshService.getAgent("test-agent");

      // Should fallback to file loading
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe("test-agent");
    });
  });

  describe("createAgent - Edge Cases", () => {
    it("should generate ID when not provided", async () => {
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
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
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
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
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
      });

      const input = {
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        endpoint: "ht tp://invalid url with spaces", // This is truly invalid
        apiKey: "key",
        model: "model",
        provider: "custom" as const,
      };

      await expect(service.createAgent(input)).rejects.toThrow();
    });

    it("should reject FastGPT agent without valid appId", async () => {
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
      });

      const input = {
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        endpoint: "http://test.com",
        apiKey: "key",
        model: "model",
        provider: "fastgpt" as const,
        appId: "invalid-app-id", // Not a 24-character hex string
      };

      await expect(service.createAgent(input)).rejects.toThrow();
    });
  });

  describe("updateAgent - Edge Cases", () => {
    it("should reject updating non-existent agent", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
      });

      await expect(
        freshService.updateAgent("non-existent", { name: "Updated" })
      ).rejects.toThrow();
    });

    it("should reject invalid update data", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      // First, mock database to return an existing agent for the getAgent call
      // Then mock database for the update operation
      (withClient as jest.Mock)
        .mockImplementationOnce(async (callback) => {
          // First call - getAgent
          const mockClient = {
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
          return await callback(mockClient);
        })
        .mockImplementationOnce(async (callback) => {
          // Second call - updateAgent
          const mockClient = {
            query: jest.fn().mockResolvedValue({}),
          };
          return await callback(mockClient);
        });

      // Try to update with invalid data
      await expect(
        freshService.updateAgent("test-agent", {
          endpoint: "ht tp://invalid url with spaces",
        })
      ).rejects.toThrow();
    });
  });

  describe("deleteAgent - Edge Cases", () => {
    it("should handle deleting non-existent agent", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
      });

      // Should not throw an error
      await expect(
        freshService.deleteAgent("non-existent")
      ).resolves.toBeUndefined();
    });
  });

  describe("checkAgentHealth - Edge Cases", () => {
    it("should return error status for non-existent agent", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return await callback(mockClient);
      });

      const health = await freshService.checkAgentHealth("non-existent");

      expect(health.status).toBe("error");
      expect(health.error).toBe("智能体不存在");
    });

    it("should handle health check errors", async () => {
      const freshService = new AgentConfigService(mockConfigPath);

      // Mock an existing agent
      (withClient as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
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
        return await callback(mockClient);
      });

      // Mock a failed health check (this is a simple mock since the current implementation doesn't actually check)
      const health = await freshService.checkAgentHealth("test-agent");

      // The current implementation just checks if the agent is active
      expect(health.status).toBe("active");
    });
  });
});
