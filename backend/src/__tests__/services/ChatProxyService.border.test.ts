import { ChatProxyService } from "../../services/ChatProxyService";
import { AgentConfig } from "@/types";
import axios from "axios";

// Mock axios
jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

describe("ChatProxyService - Boundary Scenarios", () => {
  let service: ChatProxyService;
  let mockAgentConfig: AgentConfig;

  beforeEach(() => {
    service = new ChatProxyService();

    mockAgentConfig = {
      id: "test-agent",
      name: "Test Agent",
      description: "Test",
      endpoint: "http://test.com",
      apiKey: "test-key",
      model: "test-model",
      provider: "custom",
      isActive: true,
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: true,
        supportsFiles: true,
        supportsImages: false,
        streamingConfig: {
          enabled: true,
          endpoint: "same",
          statusEvents: true,
          flowNodeStatus: true,
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jest.clearAllMocks();
  });

  describe("proxyChatRequest - Edge Cases", () => {
    it("should handle network timeout", async () => {
      mockAxios.post.mockRejectedValueOnce({
        code: "ECONNABORTED",
        message: "timeout of 1000ms exceeded",
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: false };

      await expect(
        service.proxyChatRequest(mockAgentConfig, messages, options)
      ).rejects.toThrow("timeout of 1000ms exceeded");
    });

    it("should handle network error", async () => {
      mockAxios.post.mockRejectedValueOnce({
        code: "ENOTFOUND",
        message: "getaddrinfo ENOTFOUND test.com",
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: false };

      await expect(
        service.proxyChatRequest(mockAgentConfig, messages, options)
      ).rejects.toThrow("getaddrinfo ENOTFOUND test.com");
    });

    it("should handle HTTP error responses", async () => {
      mockAxios.post.mockResolvedValueOnce({
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Internal server error" },
        headers: {},
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: false };

      await expect(
        service.proxyChatRequest(mockAgentConfig, messages, options)
      ).rejects.toThrow("Agent request failed with status 500");
    });

    it("should handle invalid JSON response", async () => {
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: "invalid json response",
        headers: {},
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: false };

      await expect(
        service.proxyChatRequest(mockAgentConfig, messages, options)
      ).rejects.toThrow();
    });

    it("should handle empty response data", async () => {
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: "",
        headers: {},
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: false };

      await expect(
        service.proxyChatRequest(mockAgentConfig, messages, options)
      ).rejects.toThrow();
    });

    it("should handle missing required fields in response", async () => {
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: { message: "Hello" }, // Missing id field
        headers: {},
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: false };

      const response = await service.proxyChatRequest(
        mockAgentConfig,
        messages,
        options
      );

      // Should still return a response, even if missing some fields
      expect(response).toBeDefined();
    });
  });

  describe("proxyStreamRequest - Edge Cases", () => {
    it("should handle stream network timeout", async () => {
      mockAxios.post.mockRejectedValueOnce({
        code: "ECONNABORTED",
        message: "timeout of 1000ms exceeded",
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: true };
      const callbacks = {
        onChunk: jest.fn(),
        onEnd: jest.fn(),
        onError: jest.fn(),
      };

      await service.proxyStreamRequest(
        mockAgentConfig,
        messages,
        callbacks,
        options
      );

      // Should call onError callback
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "timeout of 1000ms exceeded",
        })
      );
    });

    it("should handle stream network error", async () => {
      mockAxios.post.mockRejectedValueOnce({
        code: "ENOTFOUND",
        message: "getaddrinfo ENOTFOUND test.com",
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: true };
      const callbacks = {
        onChunk: jest.fn(),
        onEnd: jest.fn(),
        onError: jest.fn(),
      };

      await service.proxyStreamRequest(
        mockAgentConfig,
        messages,
        callbacks,
        options
      );

      // Should call onError callback
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "getaddrinfo ENOTFOUND test.com",
        })
      );
    });

    it("should handle stream HTTP error responses", async () => {
      mockAxios.post.mockResolvedValueOnce({
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Internal server error" },
        headers: {},
      });

      const messages = [{ HUMAN: "Hello" }];
      const options = { stream: true };
      const callbacks = {
        onChunk: jest.fn(),
        onEnd: jest.fn(),
        onError: jest.fn(),
      };

      await service.proxyStreamRequest(
        mockAgentConfig,
        messages,
        callbacks,
        options
      );

      // Should call onError callback
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Agent request failed with status 500",
        })
      );
    });
  });

  describe("formatMessagesForProvider - Edge Cases", () => {
    it("should handle empty messages array", () => {
      const result = service.formatMessagesForProvider([], mockAgentConfig);

      expect(result).toEqual([]);
    });

    it("should handle messages with invalid structure", () => {
      const messages = [
        { INVALID: "Invalid message" }, // Invalid message structure
        { HUMAN: "Valid message" },
      ] as any;

      const result = service.formatMessagesForProvider(
        messages,
        mockAgentConfig
      );

      // Should filter out invalid messages
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ content: "Valid message" })
      );
    });

    it("should handle messages with empty content", () => {
      const messages = [
        { HUMAN: "" }, // Empty content
        { HUMAN: "Valid message" },
      ];

      const result = service.formatMessagesForProvider(
        messages,
        mockAgentConfig
      );

      // Should filter out empty messages
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ content: "Valid message" })
      );
    });
  });

  describe("transformResponse - Edge Cases", () => {
    it("should handle response with missing fields", () => {
      const rawResponse = {
        // Missing id and timestamp fields
        AI: "Hello response",
      };

      const result = service.transformResponse(rawResponse, mockAgentConfig);

      // Should still return a valid response with generated fields
      expect(result).toBeDefined();
      expect(result.AI).toBe("Hello response");
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("should handle response with invalid structure", () => {
      const rawResponse = "invalid response structure";

      const result = service.transformResponse(
        rawResponse as any,
        mockAgentConfig
      );

      // Should return a response with error information
      expect(result).toBeDefined();
    });
  });
});
