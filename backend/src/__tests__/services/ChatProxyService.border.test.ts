/**
 * ChatProxyService 边界场景测试
 * 测试各种异常情况和边界条件
 */

import { ChatProxyService } from "../../services/ChatProxyService";
import { AgentConfigService } from "../../services/AgentConfigService";
import { ChatMessage, AgentConfig } from "@/types";
import {
  createMockHTTPClient,
  createTestAgentConfig,
  createTestMessages,
  createChatProxyServiceWithMockHTTP,
  createChatProxyServiceWithCustomAgent,
  createTimeoutError,
  createNetworkError,
  createHTTPErrorResponse,
  createInvalidHTTPResponse,
  createSuccessResponse,
  mockAgentConfigService,
  clearAllMocks,
  expectMockCalled,
  expectErrorMessageContains,
} from '../utils/ChatProxyTestUtils';

describe("ChatProxyService - Boundary Scenarios", () => {
  let service: ChatProxyService;
  let mockHTTPClient: any;
  let mockAgentService: AgentConfigService;
  let mockAgentConfig: AgentConfig;

  beforeEach(() => {
    mockHTTPClient = createMockHTTPClient();
    mockAgentConfig = createTestAgentConfig();

    // 创建服务时直接传入Mock配置
    service = createChatProxyServiceWithMockHTTP(mockHTTPClient, mockAgentConfig);
    mockAgentService = new AgentConfigService("/mock/config/path");

    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  describe("sendMessage - Edge Cases", () => {
    it("should handle network timeout", async () => {
      // 设置 Mock 返回超时错误
      mockHTTPClient.post.mockRejectedValueOnce(createTimeoutError());

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).rejects.toThrow("timeout of 1000ms exceeded");

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle network error", async () => {
      // 设置 Mock 返回网络错误
      mockHTTPClient.post.mockRejectedValueOnce(createNetworkError());

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).rejects.toThrow("getaddrinfo ENOTFOUND test.com");

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle HTTP error responses", async () => {
      // 设置 Mock 返回 HTTP 错误
      mockHTTPClient.post.mockResolvedValueOnce(
        createHTTPErrorResponse(500, "Internal Server Error", { error: "Internal server error" })
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).rejects.toThrow();

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle invalid JSON response", async () => {
      // 设置 Mock 返回无效结构（不符合ChatProxy期望的格式）
      mockHTTPClient.post.mockResolvedValueOnce(
        createInvalidHTTPResponse("invalid json response")
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).rejects.toThrow();

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle empty response data", async () => {
      // 设置 Mock 返回空数据（没有choices字段）
      mockHTTPClient.post.mockResolvedValueOnce(
        createInvalidHTTPResponse({})
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).rejects.toThrow();

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle missing required fields in response", async () => {
      // 设置 Mock 返回部分字段的数据
      mockHTTPClient.post.mockResolvedValueOnce(
        createSuccessResponse({ message: "Hello" })
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      const response = await service.sendMessage(mockAgentConfig.id, messages, options);

      // 应该仍然返回响应，即使缺少某些字段
      expect(response).toBeDefined();
      expectMockCalled(mockHTTPClient.post, 1);
    });
  });

  describe("sendStreamMessage - Edge Cases", () => {
    it("should handle stream network timeout", async () => {
      // 设置 Mock 返回超时错误
      mockHTTPClient.post.mockRejectedValueOnce(createTimeoutError());

      const messages = createTestMessages("Hello");
      const options = { stream: true };
      const mockOnChunk = jest.fn();
      const mockOnStatus = jest.fn();

      await expect(
        service.sendStreamMessage(mockAgentConfig.id, messages, mockOnChunk, mockOnStatus, options)
      ).rejects.toThrow("timeout of 1000ms exceeded");

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle stream network error", async () => {
      // 设置 Mock 返回网络错误
      mockHTTPClient.post.mockRejectedValueOnce(createNetworkError());

      const messages = createTestMessages("Hello");
      const options = { stream: true };
      const mockOnChunk = jest.fn();
      const mockOnStatus = jest.fn();

      await expect(
        service.sendStreamMessage(mockAgentConfig.id, messages, mockOnChunk, mockOnStatus, options)
      ).rejects.toThrow("getaddrinfo ENOTFOUND test.com");

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle stream HTTP error responses", async () => {
      // 设置 Mock 返回 HTTP 错误
      mockHTTPClient.post.mockResolvedValueOnce(
        createHTTPErrorResponse(500, "Internal Server Error", { error: "Internal server error" })
      );

      const messages = createTestMessages("Hello");
      const options = { stream: true };
      const mockOnChunk = jest.fn();
      const mockOnStatus = jest.fn();

      await expect(
        service.sendStreamMessage(mockAgentConfig.id, messages, mockOnChunk, mockOnStatus, options)
      ).rejects.toThrow();

      expectMockCalled(mockHTTPClient.post, 1);
    });
  });

  describe("Message Format Handling - Edge Cases", () => {
    it("should handle empty messages array", async () => {
      // 设置 Mock 返回成功响应
      mockHTTPClient.post.mockResolvedValueOnce(
        createSuccessResponse({ message: "Response for empty messages" })
      );

      const messages: ChatMessage[] = [];
      const options = { stream: false };

      // 这应该在没有错误的情况下工作
      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).resolves.toBeDefined();

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle messages with invalid structure", async () => {
      // 设置 Mock 返回成功响应
      mockHTTPClient.post.mockResolvedValueOnce(
        createSuccessResponse({ message: "Response" })
      );

      const messages = createTestMessages("Valid message");
      const options = { stream: false };

      // 这应该与有效消息一起工作
      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).resolves.toBeDefined();

      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle messages with empty content", async () => {
      // 设置 Mock 返回成功响应
      mockHTTPClient.post.mockResolvedValueOnce(
        createSuccessResponse({ message: "Response" })
      );

      const messages = createTestMessages(""); // 空内容
      const options = { stream: false };

      // 这应该与空内容消息一起工作
      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).resolves.toBeDefined();

      expectMockCalled(mockHTTPClient.post, 1);
    });
  });

  describe("Response Handling - Edge Cases", () => {
    it("should handle response with missing fields", async () => {
      // 设置 Mock 返回最小数据的成功响应
      mockHTTPClient.post.mockResolvedValueOnce(
        createSuccessResponse({ message: "Hello response" })
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      const response = await service.sendMessage(mockAgentConfig.id, messages, options);

      // 应该仍然返回有效响应
      expect(response).toBeDefined();
      expectMockCalled(mockHTTPClient.post, 1);
    });

    it("should handle response with invalid structure", async () => {
      // 设置 Mock 返回一个会导致解析失败的结构
      mockHTTPClient.post.mockResolvedValueOnce(
        createInvalidHTTPResponse({ invalid: "structure" })
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(mockAgentConfig.id, messages, options)
      ).rejects.toThrow();

      expectMockCalled(mockHTTPClient.post, 1);
    });
  });

  describe("Agent Configuration Edge Cases", () => {
    it("should handle non-existent agent", async () => {
      // 创建一个新的服务实例，专门测试智能体不存在的情况
      const mockHTTPClient2 = createMockHTTPClient();
      const service2 = createChatProxyServiceWithCustomAgent(
        mockHTTPClient2,
        jest.fn().mockResolvedValue(null)
      );

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service2.sendMessage("non-existent-agent", messages, options)
      ).rejects.toThrow("智能体不存在: non-existent-agent");
    });

    it("should handle inactive agent", async () => {
      // 创建非活跃的智能体配置
      const inactiveAgent = createTestAgentConfig({ isActive: false });
      const mockHTTPClient2 = createMockHTTPClient();
      const service2 = createChatProxyServiceWithMockHTTP(mockHTTPClient2, inactiveAgent);

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service2.sendMessage(inactiveAgent.id, messages, options)
      ).rejects.toThrow("智能体未激活");
    });

    it("should handle agent with invalid configuration", async () => {
      // 创建无效配置的智能体
      const invalidAgent = createTestAgentConfig({
        endpoint: "", // 空端点
        apiKey: "",  // 空密钥
      });
      mockAgentConfigService(mockAgentService, invalidAgent);

      const messages = createTestMessages("Hello");
      const options = { stream: false };

      await expect(
        service.sendMessage(invalidAgent.id, messages, options)
      ).rejects.toThrow();
    });
  });
});