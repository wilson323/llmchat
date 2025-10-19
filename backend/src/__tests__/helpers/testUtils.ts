// 基础测试工具
export interface TestUtils {
  createMockUser: () => any;
  createMockAgent: () => any;
  cleanupTestData: () => Promise<void>;
}

export const testUtils: TestUtils = {
  createMockUser: () => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  createMockAgent: () => ({
    id: 'test-agent-id',
    name: 'Test Agent',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: 'test-key',
    features: {
      supportsChatId: true,
      supportsStream: true,
      supportsDetail: true,
      supportsFiles: false,
      supportsImages: false,
      streamingConfig: {
        enabled: true,
        endpoint: 'same',
        statusEvents: false,
        flowNodeStatus: false
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),

  cleanupTestData: async () => {
    // 清理测试数据
  }
};