// FastGPT 模拟工具
export const mockFastGPTResponse = {
  choices: [
    {
      message: {
        role: 'assistant',
        content: 'This is a mock response from FastGPT'
      },
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 15,
    total_tokens: 25
  }
};

export const mockFastGPTStream = {
  on: jest.fn(),
  pipe: jest.fn(),
  destroy: jest.fn()
};