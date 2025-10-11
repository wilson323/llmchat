#!/usr/bin/env node

/**
 * 修复Store mock配置问题
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const frontendDir = path.join(projectRoot, 'frontend');
let fixesApplied = 0;

console.log('🔧 修复Store mock配置问题...');

// 1. 修复useChat测试中的store mock
const useChatTestPath = path.join(frontendDir, 'src/hooks/__tests__/useChat.test.ts');
if (fs.existsSync(useChatTestPath)) {
  let content = fs.readFileSync(useChatTestPath, 'utf8');
  const originalContent = content;

  // 找到mockedMessageStore.mockReturnValue的位置，并确保getState方法被正确mock
  if (content.includes('mockedMessageStore.mockReturnValue({')) {
    // 修复messageStore mock
    content = content.replace(
      /mockedMessageStore\.mockReturnValue\(\{[\s\S]*?getState: mockMessageGetState,[\s\S]*?\}\);/,
      `mockedMessageStore.mockReturnValue({
      messages: [],
      isStreaming: false,
      streamingStatus: null,
      streamAbortController: null,
      streamBuffer: '',
      flushScheduled: false,
      addMessage: vi.fn(),
      clearMessages: vi.fn(),
      updateMessageById: vi.fn(),
      setMessageFeedback: vi.fn(),
      removeLastInteractiveMessage: vi.fn(),
      appendToBuffer: vi.fn(),
      flushBuffer: vi.fn(),
      updateLastMessage: vi.fn(),
      appendReasoningStep: vi.fn(),
      finalizeReasoning: vi.fn(),
      appendAssistantEvent: vi.fn(),
      setIsStreaming: vi.fn(),
      setStreamingStatus: vi.fn(),
      setStreamAbortController: vi.fn(),
      stopStreaming: vi.fn(),
      _scheduleFlush: vi.fn(),
      getState: mockMessageGetState,
    });`
    );

    // 修复agentStore mock
    content = content.replace(
      /mockedAgentStore\.mockReturnValue\(\{[\s\S]*?getState: mockAgentGetState,[\s\S]*?\}\);/,
      `mockedAgentStore.mockReturnValue({
      currentAgent: null,
      agents: [],
      agentsLoading: false,
      agentsError: null,
      setAgents: vi.fn(),
      setCurrentAgent: vi.fn(),
      setAgentsLoading: vi.fn(),
      setAgentsError: vi.fn(),
      getState: mockAgentGetState,
    });`
    );

    // 修复sessionStore mock
    content = content.replace(
      /mockedSessionStore\.mockReturnValue\(\{[\s\S]*?getState: mockSessionGetState,[\s\S]*?\}\);/,
      `mockedSessionStore.mockReturnValue({
      currentSession: null,
      agentSessions: {},
      createNewSession: vi.fn((agentId: string) => ({
        id: Date.now().toString(),
        title: '新对话',
        agentId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      deleteSession: vi.fn(),
      switchToSession: vi.fn(),
      renameSession: vi.fn(),
      clearCurrentAgentSessions: vi.fn(),
      initializeAgentSessions: vi.fn(),
      setAgentSessionsForAgent: vi.fn(),
      bindSessionId: vi.fn(),
      setSessionMessages: vi.fn(),
      updateSession: vi.fn(),
      updateSessionTitleIntelligently: vi.fn(),
      getSessionById: vi.fn(),
      getAgentSessions: vi.fn(),
      getCurrentSession: vi.fn(),
      getState: mockSessionGetState,
    });`
    );

    // 修复preferenceStore mock
    content = content.replace(
      /mockedPreferenceStore\.mockReturnValue\(\{[\s\S]*?getState: mockPreferenceGetState,[\s\S]*?\}\);/,
      `mockedPreferenceStore.mockReturnValue({
      preferences: {
        theme: {
          mode: 'auto' as const,
          isAutoMode: true,
          userPreference: 'auto' as const,
        },
        streamingEnabled: true,
        autoThemeSchedule: {
          enabled: true,
          lightModeStart: '06:00',
          darkModeStart: '18:00',
        },
        language: 'zh-CN' as const,
      },
      updatePreferences: vi.fn(),
      resetPreferences: vi.fn(),
      getThemeMode: vi.fn(),
      isStreamingEnabled: vi.fn(),
      getLanguage: vi.fn(),
      getState: mockPreferenceGetState,
    });`
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(useChatTestPath, content);
    fixesApplied++;
    console.log('✅ 修复 useChat.test.ts 的store mock配置');
  }
}

// 2. 修复useKeyboardManager测试中的store mock
const keyboardManagerTestPath = path.join(frontendDir, 'src/hooks/__tests__/useKeyboardManager.test.ts');
if (fs.existsSync(keyboardManagerTestPath)) {
  let content = fs.readFileSync(keyboardManagerTestPath, 'utf8');
  const originalContent = content;

  // 添加或完善chatStore mock
  if (!content.includes('useChatStore:')) {
    content = content.replace(
      '// Mock store',
      `// Mock store
vi.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({
      currentAgent: {
        id: 'test-agent-id',
        name: 'Test Agent',
        description: 'Test Description',
        model: 'test-model',
        status: 'active' as const,
        capabilities: [],
        provider: 'test-provider',
      },
      currentSession: {
        id: 'test-session-id',
        title: 'Test Session',
        agentId: 'test-agent-id',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      agentSessions: {
        'test-agent-id': [{
          id: 'test-session-id',
          title: 'Test Session',
          agentId: 'test-agent-id',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }]
      },
      createNewSession: vi.fn(),
      deleteSession: vi.fn(),
      setAgentSelectorOpen: vi.fn(),
      sidebarOpen: true,
      setSidebarOpen: vi.fn(),
    })),
  },
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      sidebarOpen: true,
      setSidebarOpen: vi.fn(),
      setAgentSelectorOpen: vi.fn(),
    })),
  },
}));`
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(keyboardManagerTestPath, content);
    fixesApplied++;
    console.log('✅ 修复 useKeyboardManager.test.ts 的store mock配置');
  }
}

// 3. 修复API测试中的axios mock问题
const apiTestPath = path.join(frontendDir, 'src/services/__tests__/api.test.ts');
if (fs.existsSync(apiTestPath)) {
  let content = fs.readFileSync(apiTestPath, 'utf8');

  // 更新axios mock，确保正确导出
  if (!content.includes('module.exports')) {
    content = content.replace(
      `vi.mock('axios', () => ({`,
      `// Mock axios module with proper interceptors
const mockAxios = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn(), clear: vi.fn() },
    response: { use: vi.fn(), clear: vi.fn() },
  },
  create: vi.fn(() => ({
    interceptors: {
      request: { use: vi.fn(), clear: vi.fn() },
      response: { use: vi.fn(), clear: vi.fn() },
    },
    defaults: {},
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  })),
  defaults: {},
};

vi.mock('axios', () => mockAxios);`
    );
  }

  fs.writeFileSync(apiTestPath, content);
  fixesApplied++;
  console.log('✅ 修复 api.test.ts 的axios mock导出');
}

console.log(`\n✅ 完成！共修复了 ${fixesApplied} 个Store mock配置问题`);