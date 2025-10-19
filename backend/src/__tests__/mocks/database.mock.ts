// 数据库模拟工具
export const mockDatabase = {
  query: jest.fn(),
  transaction: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),

  // 模拟用户数据
  users: [
    {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],

  // 模拟智能体数据
  agents: [
    {
      id: 'test-agent-id',
      name: 'Test Agent',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      api_key: 'test-key',
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
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
};