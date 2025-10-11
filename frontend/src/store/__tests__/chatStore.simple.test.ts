import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@/store/chatStore';

describe('chatStore (Simplified)', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      currentAgent: null,
      currentSession: null,
      agentSessions: {},
    });
  });

  it('should initialize with empty state', () => {
    const state = useChatStore.getState();
    expect(state.currentAgent).toBeNull();
    expect(state.currentSession).toBeNull();
    expect(state.agentSessions).toEqual({});
  });

  it('should set current agent', () => {
    const testAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test Description',
      model: 'test-model',
      status: 'active' as const,
      capabilities: [],
      provider: 'test-provider',
    };

    useChatStore.setState({ currentAgent: testAgent });
    const state = useChatStore.getState();
    expect(state.currentAgent).toEqual(testAgent);
  });
});
