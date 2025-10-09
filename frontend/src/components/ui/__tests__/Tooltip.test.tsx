import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tooltip, HelpIcon } from '../Tooltip';

describe('Tooltip', () => {
  it('应该渲染子元素', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('应该初始时不显示tooltip', () => {
    render(
      <Tooltip content="Test tooltip content">
        <button>Hover me</button>
      </Tooltip>
    );
    
    // Tooltip初始不可见
    expect(screen.queryByText('Test tooltip content')).not.toBeInTheDocument();
  });

  it('应该接受不同的position属性', () => {
    const positions = ['top', 'bottom', 'left', 'right'] as const;

    positions.forEach((position) => {
      const { unmount } = render(
        <Tooltip content="Test tooltip" position={position}>
          <button>{position}</button>
        </Tooltip>
      );

      expect(screen.getByText(position)).toBeInTheDocument();
      unmount();
    });
  });

  it('应该接受不同的delay属性', () => {
    render(
      <Tooltip content="Test tooltip" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('应该支持ReactNode作为content', () => {
    render(
      <Tooltip content={<div>Complex <strong>content</strong></div>}>
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });
});

describe('HelpIcon', () => {
  it('应该渲染问号图标', () => {
    render(<HelpIcon content="Help text" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('应该初始时不显示帮助文本', () => {
    render(<HelpIcon content="This is help text" />);
    expect(screen.queryByText('This is help text')).not.toBeInTheDocument();
  });

  it('应该接受position属性', () => {
    render(<HelpIcon content="Help text" position="bottom" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('应该有正确的样式类', () => {
    render(<HelpIcon content="Help text" />);

    const icon = screen.getByText('?');
    const wrapper = icon.closest('span');
    
    expect(wrapper).toHaveClass('cursor-help');
    expect(wrapper).toHaveClass('rounded-full');
  });
});

