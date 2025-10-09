import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageList } from '../MessageList';
import { ChatMessage } from '@/types';

// Mock dependencies
vi.mock('@/store/chatStore', () => ({
  useChatStore: () => ({
    currentAgent: { id: 'test-agent', name: 'Test Agent', provider: 'openai' },
    streamingStatus: null,
  }),
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key, // 简单返回 key 作为翻译
  }),
}));

vi.mock('../VirtualizedMessageList', () => ({
  VirtualizedMessageList: ({ messages }: { messages: ChatMessage[] }) => (
    <div data-testid="virtualized-list">虚拟化列表 ({messages.length} 条消息)</div>
  ),
}));

describe('MessageList', () => {
  it('空消息列表应正确渲染', () => {
    render(<MessageList messages={[]} />);
    
    // 应该渲染消息区域
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByLabelText('聊天消息区域')).toBeInTheDocument();
  });

  it('少量消息应使用普通渲染（非虚拟化）', () => {
    const messages: ChatMessage[] = [
      { id: '1', HUMAN: '你好', timestamp: Date.now() },
      { id: '2', AI: '您好，有什么可以帮您？', timestamp: Date.now() },
    ];

    render(<MessageList messages={messages} />);
    
    // 应该渲染消息
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getByText('您好，有什么可以帮您？')).toBeInTheDocument();
    
    // 不应该使用虚拟化列表
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
  });

  it('大量消息（>20条）应使用虚拟化渲染', () => {
    const messages: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`,
      HUMAN: i % 2 === 0 ? `消息 ${i}` : undefined,
      AI: i % 2 === 1 ? `回复 ${i}` : undefined,
      timestamp: Date.now(),
    }));

    render(<MessageList messages={messages} />);
    
    // 应该使用虚拟化列表
    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    expect(screen.getByText('虚拟化列表 (25 条消息)')).toBeInTheDocument();
  });

  it('流式状态应显示加载指示器', () => {
    const messages: ChatMessage[] = [
      { id: '1', HUMAN: '请介绍一下自己', timestamp: Date.now() },
      { id: '2', AI: '我是', timestamp: Date.now() },
    ];

    render(<MessageList messages={messages} isStreaming={true} />);
    
    // 应该显示流式加载指示器
    expect(screen.getByText('正在生成回答...')).toBeInTheDocument();
  });

  it('应该正确标记消息角色（无障碍）', () => {
    const messages: ChatMessage[] = [
      { id: '1', HUMAN: '用户消息', timestamp: Date.now() },
      { id: '2', AI: 'AI回复', timestamp: Date.now() },
    ];

    render(<MessageList messages={messages} />);
    
    // 应该有正确的 ARIA 标签
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveAttribute('aria-label', '用户消息');
    expect(articles[1]).toHaveAttribute('aria-label', 'AI回复');
  });

  it('应该处理回调函数', () => {
    const onRetry = vi.fn();
    const onInteractiveSelect = vi.fn();
    
    const messages: ChatMessage[] = [
      { id: '1', HUMAN: '测试消息', timestamp: Date.now() },
    ];

    render(
      <MessageList
        messages={messages}
        onRetryMessage={onRetry}
        onInteractiveSelect={onInteractiveSelect}
      />
    );
    
    // 回调应该正确传递（通过 MessageItem）
    expect(onRetry).not.toHaveBeenCalled(); // 仅渲染时不调用
  });

  it('边界条件：空 AI 消息应正确处理', () => {
    const messages: ChatMessage[] = [
      { id: '1', AI: '', timestamp: Date.now() },
    ];

    render(<MessageList messages={messages} />);
    
    // 不应该崩溃，应该渲染（即使内容为空）
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('边界条件：无 id 的消息应使用 index 作为 key', () => {
    const messages: ChatMessage[] = [
      { HUMAN: '消息1', timestamp: Date.now() },
      { AI: '回复1', timestamp: Date.now() },
    ];

    const { container } = render(<MessageList messages={messages} />);
    
    // 应该正常渲染（不崩溃）
    expect(container.querySelectorAll('[role="article"]')).toHaveLength(2);
  });
});
