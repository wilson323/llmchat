# React 组件开发标准

## 📋 概述

本文档定义了 LLMChat 前端项目中 React 组件的开发标准，包括组件设计原则、类型定义、状态管理、性能优化和最佳实践。所有组件必须遵循这些标准以确保代码质量、可维护性和一致性。

## 🎯 组件设计原则

### 1. 单一职责原则
每个组件只负责一个明确的功能，避免功能过于复杂。

```typescript
// ✅ 正确 - 单一职责
interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'md', onClick }) => {
  return (
    <img
      src={user.avatar}
      alt={user.name}
      className={`avatar avatar-${size}`}
      onClick={onClick}
    />
  );
};

// ❌ 错误 - 职责过多
interface UserCardProps {
  user: User;
  onEdit?: () => void;
  onDelete?: () => void;
  onSendMessage?: () => void;
  showSettings?: boolean;
  theme?: 'light' | 'dark';
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onDelete,
  onSendMessage,
  showSettings,
  theme
}) => {
  // 包含头像、信息、编辑、删除、发消息、设置等多种功能
  // 违反单一职责原则
};
```

### 2. 组合优于继承
使用组件组合而非继承来复用代码。

```typescript
// ✅ 正确 - 使用组合
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return <div className={`card ${className || ''}`}>{children}</div>;
};

interface CardHeaderProps {
  children: React.ReactNode;
}

const CardHeader: React.FC<CardHeaderProps> = ({ children }) => {
  return <div className="card-header">{children}</div>;
};

// 使用组合
<Card>
  <CardHeader>
    <h2>Card Title</h2>
  </CardHeader>
  <div className="card-body">
    Card content
  </div>
</Card>

// ❌ 错误 - 使用继承
interface BaseCardProps {
  title: string;
  children: React.ReactNode;
}

interface UserCardProps extends BaseCardProps {
  user: User;
}

const UserCard: React.FC<UserCardProps> = ({ title, user, children }) => {
  // 继承方式不够灵活
};
```

### 3. 明确的 Props 接口
所有组件 Props 必须有明确的类型定义和文档。

```typescript
// ✅ 正确 - 明确的 Props 定义
interface ButtonProps {
  /**
   * 按钮内容
   */
  children: React.ReactNode;
  /**
   * 按钮变体样式
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /**
   * 按钮大小
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean;
  /**
   * 加载状态
   * @default false
   */
  loading?: boolean;
  /**
   * 点击事件处理器
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * 自定义 CSS 类名
   */
  className?: string;
  /**
   * 自定义数据属性
   */
  'data-testid'?: string;
}

// ❌ 错误 - Props 定义不明确
const Button = (props: any) => {
  // 使用 any 类型，缺少类型安全
};
```

## 📝 组件结构标准

### 1. 组件文件结构

```
components/
├── ui/
│   ├── Button/
│   │   ├── index.ts          # 导出文件
│   │   ├── Button.tsx        # 组件实现
│   │   ├── Button.test.tsx   # 组件测试
│   │   ├── Button.stories.tsx # Storybook 故事
│   │   └── Button.module.css # 样式文件
│   └── Input/
│       ├── index.ts
│       ├── Input.tsx
│       ├── Input.test.tsx
│       ├── Input.stories.tsx
│       └── Input.module.css
└── features/
    ├── UserProfile/
    │   ├── index.ts
    │   ├── UserProfile.tsx
    │   ├── UserProfile.test.tsx
    │   ├── components/        # 子组件
    │   │   ├── UserAvatar/
    │   │   └── UserInfo/
    │   └── hooks/            # 特定 hooks
    │       └── useUserProfile.ts
```

### 2. 组件实现模板

```typescript
// Button.tsx
import React from 'react';
import cn from 'classnames';
import styles from './Button.module.css';

/**
 * Button 组件 Props 接口
 */
export interface ButtonProps {
  /**
   * 按钮内容
   */
  children: React.ReactNode;
  /**
   * 按钮变体
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /**
   * 按钮大小
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean;
  /**
   * 加载状态
   * @default false
   */
  loading?: boolean;
  /**
   * 点击事件处理器
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * 自定义类名
   */
  className?: string;
  /**
   * 测试 ID
   */
  'data-testid'?: string;
}

/**
 * Button 组件
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className,
  'data-testid': testId,
}) => {
  // 组合 CSS 类名
  const buttonClassName = cn(
    styles.button,
    styles[variant],
    styles[size],
    {
      [styles.disabled]: disabled,
      [styles.loading]: loading,
    },
    className
  );

  // 事件处理器
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      className={buttonClassName}
      disabled={disabled || loading}
      onClick={handleClick}
      data-testid={testId}
      type="button"
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : null}
      <span className={styles.content}>{children}</span>
    </button>
  );
};

// 默认导出
export default Button;
```

### 3. 组件导出标准

```typescript
// index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';

// 如果有多个组件
export { Button, Input, Select } from './components';
export type {
  ButtonProps,
  InputProps,
  SelectProps
} from './components';

// 默认导出主要组件
export { default as Button } from './Button';
```

## 🎨 样式处理规范

### 1. CSS 模块化

```typescript
// Button.module.css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  outline: none;
}

.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* 变体样式 */
.primary {
  background-color: var(--color-primary);
  color: var(--color-white);
}

.primary:hover:not(.disabled) {
  background-color: var(--color-primary-dark);
}

.secondary {
  background-color: var(--color-secondary);
  color: var(--color-white);
}

.outline {
  background-color: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

/* 尺寸样式 */
.sm {
  padding: 6px 12px;
  font-size: 14px;
}

.md {
  padding: 8px 16px;
  font-size: 16px;
}

.lg {
  padding: 12px 24px;
  font-size: 18px;
}

/* 状态样式 */
.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  position: relative;
  color: transparent;
}

.spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

### 2. 样式组合工具

```typescript
// utils/cn.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 组合 CSS 类名工具函数
 * 合并 clsx 和 tailwind-merge 的功能
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 使用示例
const className = cn(
  'base-class',
  {
    'conditional-class': condition,
    'another-class': anotherCondition,
  },
  'additional-class',
  props.className
);
```

### 3. 主题系统

```typescript
// contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('auto');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const updateTheme = () => {
      let resolvedTheme: 'light' | 'dark';

      if (mode === 'auto') {
        const hour = new Date().getHours();
        resolvedTheme = hour >= 6 && hour < 18 ? 'light' : 'dark';
      } else {
        resolvedTheme = mode;
      }

      setTheme(resolvedTheme);
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    };

    updateTheme();

    if (mode === 'auto') {
      const interval = setInterval(updateTheme, 60000); // 每分钟检查
      return () => clearInterval(interval);
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
```

## 🔧 组件状态管理

### 1. 本地状态管理

```typescript
// ✅ 正确 - 使用 useState 和类型
interface CounterProps {
  initialValue?: number;
  onValueChange?: (value: number) => void;
}

const Counter: React.FC<CounterProps> = ({
  initialValue = 0,
  onValueChange
}) => {
  const [count, setCount] = useState<number>(initialValue);

  const increment = () => {
    const newCount = count + 1;
    setCount(newCount);
    onValueChange?.(newCount);
  };

  const decrement = () => {
    const newCount = count - 1;
    setCount(newCount);
    onValueChange?.(newCount);
  };

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
};

// ✅ 复杂状态使用 useReducer
interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

type TodoAction =
  | { type: 'ADD'; text: string }
  | { type: 'TOGGLE'; id: string }
  | { type: 'DELETE'; id: string }
  | { type: 'UPDATE'; id: string; text: string };

const todoReducer = (state: Todo[], action: TodoAction): Todo[] => {
  switch (action.type) {
    case 'ADD':
      return [...state, {
        id: Date.now().toString(),
        text: action.text,
        completed: false
      }];
    case 'TOGGLE':
      return state.map(todo =>
        todo.id === action.id
          ? { ...todo, completed: !todo.completed }
          : todo
      );
    case 'DELETE':
      return state.filter(todo => todo.id !== action.id);
    case 'UPDATE':
      return state.map(todo =>
        todo.id === action.id
          ? { ...todo, text: action.text }
          : todo
      );
    default:
      return state;
  }
};

const TodoList: React.FC = () => {
  const [todos, dispatch] = useReducer(todoReducer, []);
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim()) {
      dispatch({ type: 'ADD', text: inputValue.trim() });
      setInputValue('');
    }
  };

  return (
    <div>
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
      />
      <button onClick={handleAdd}>Add Todo</button>

      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => dispatch({ type: 'TOGGLE', id: todo.id })}
            />
            <span className={todo.completed ? 'completed' : ''}>
              {todo.text}
            </span>
            <button onClick={() => dispatch({ type: 'DELETE', id: todo.id })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### 2. 自定义 Hooks

```typescript
// hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

/**
 * 本地存储 Hook
 * @param key 存储键
 * @param initialValue 初始值
 * @returns [value, setValue]
 */
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // 获取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // 设置值的函数
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // 允许传入函数来更新值
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

/**
 * 防抖 Hook
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// hooks/useAsync.ts
import { useState, useEffect, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * 异步操作 Hook
 * @param asyncFunction 异步函数
 * @returns [state, execute]
 */
function useAsync<T, Args extends any[]>(
  asyncFunction: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const data = await asyncFunction(...args);
        setState({ data, loading: false, error: null });
      } catch (error) {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [asyncFunction]
  );

  return [state, execute] as const;
}
```

### 3. Context 使用

```typescript
// contexts/UserContext.tsx
import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

type UserAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' };

const initialState: UserState = {
  user: null,
  isAuthenticated: false,
  loading: false,
};

const userReducer = (state: UserState, action: UserAction): UserState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true };
    case 'LOGIN_SUCCESS':
      return {
        user: action.payload,
        isAuthenticated: true,
        loading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        user: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'LOGOUT':
      return initialState;
    default:
      return state;
  }
};

const UserContext = createContext<{
  state: UserState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
} | null>(null);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  const login = async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const user = await authService.login(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error instanceof Error ? error.message : 'Login failed'
      });
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <UserContext.Provider value={{ state, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
```

## 🎯 性能优化

### 1. 组件记忆化

```typescript
// ✅ 正确 - 使用 React.memo
interface UserProfileProps {
  user: User;
  onUpdate: (user: User) => void;
}

const UserProfile = React.memo<UserProfileProps>(({ user, onUpdate }) => {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <button onClick={() => onUpdate(user)}>
        Update
      </button>
    </div>
  );
});

// 自定义比较函数
const areEqual = (prevProps: UserProfileProps, nextProps: UserProfileProps) => {
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.email === nextProps.user.email
  );
};

const OptimizedUserProfile = React.memo(UserProfile, areEqual);

// ✅ 正确 - 使用 useMemo
interface ExpensiveComponentProps {
  data: number[];
  filter: string;
}

const ExpensiveComponent: React.FC<ExpensiveComponentProps> = ({ data, filter }) => {
  // 记忆化计算结果
  const filteredData = useMemo(() => {
    console.log('Filtering data...');
    return data.filter(item => item.toString().includes(filter));
  }, [data, filter]);

  // 记忆化计算总和
  const sum = useMemo(() => {
    console.log('Calculating sum...');
    return filteredData.reduce((acc, item) => acc + item, 0);
  }, [filteredData]);

  return (
    <div>
      <p>Filtered count: {filteredData.length}</p>
      <p>Sum: {sum}</p>
    </div>
  );
};

// ✅ 正确 - 使用 useCallback
interface ButtonListProps {
  items: string[];
  onItemClick: (item: string) => void;
}

const ButtonList: React.FC<ButtonListProps> = ({ items, onItemClick }) => {
  // 记忆化事件处理器
  const handleClick = useCallback((item: string) => {
    onItemClick(item);
  }, [onItemClick]);

  return (
    <div>
      {items.map(item => (
        <button
          key={item}
          onClick={() => handleClick(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
};
```

### 2. 虚拟化长列表

```typescript
// components/VirtualizedList.tsx
import React, { useMemo, useCallback } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = items.length * itemHeight;

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleRange.startIndex * itemHeight}px)`,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={visibleRange.startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleRange.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 3. 代码分割和懒加载

```typescript
// 路由级别的代码分割
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';

// 懒加载组件
const HomePage = lazy(() => import('./pages/HomePage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const AppRouter = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/user/:id" element={<UserPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  </Suspense>
);

// 组件级别的懒加载
import { lazy } from 'react';

const HeavyComponent = lazy(() =>
  import('./components/HeavyComponent').then(module => ({
    default: module.HeavyComponent
  }))
);

const ParentComponent = () => {
  const [showHeavy, setShowHeavy] = useState(false);

  return (
    <div>
      <button onClick={() => setShowHeavy(true)}>
        Load Heavy Component
      </button>

      {showHeavy && (
        <Suspense fallback={<div>Loading...</div>}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
};
```

## 🧪 测试标准

### 1. 组件测试模板

```typescript
// Button.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button-secondary');
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not trigger click when disabled', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('loading');
    expect(button).toBeDisabled();
  });

  it('has correct data-testid', () => {
    render(<Button data-testid="test-button">Test</Button>);
    expect(screen.getByTestId('test-button')).toBeInTheDocument();
  });
});
```

### 2. 集成测试

```typescript
// UserProfile.integration.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserProvider } from '../contexts/UserContext';
import UserProfile from '../UserProfile';

// 模拟 API
jest.mock('../services/userService', () => ({
  updateUser: jest.fn(),
}));

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <UserProvider>
      {component}
    </UserProvider>
  );
};

describe('UserProfile Integration', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  };

  it('updates user profile correctly', async () => {
    const { updateUser } = require('../services/userService');
    updateUser.mockResolvedValue(mockUser);

    renderWithProvider(<UserProfile user={mockUser} />);

    const nameInput = screen.getByLabelText(/name/i);
    const saveButton = screen.getByRole('button', { name: /save/i });

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Jane Doe');
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        ...mockUser,
        name: 'Jane Doe',
      });
    });
  });
});
```

## 📋 组件检查清单

### 开发阶段

- [ ] 组件遵循单一职责原则
- [ ] Props 接口定义完整且有文档
- [ ] 使用 TypeScript 严格类型
- [ ] 实现了无障碍支持（ARIA 属性）
- [ ] 添加了适当的错误边界处理
- [ ] 考虑了性能优化（memo/useMemo/useCallback）
- [ ] 样式使用 CSS 模块或 styled-components

### 代码审查

- [ ] 组件命名清晰且一致
- [ ] Props 类型定义准确
- [ ] 状态管理合理
- [ ] 副作用处理正确（useEffect）
- [ ] 事件处理器命名清晰
- [ ] 组件可复用性良好
- [ ] 无不必要的嵌套和复杂性

### 测试阶段

- [ ] 单元测试覆盖核心功能
- [ ] 集成测试验证组件交互
- [ ] 无障碍测试通过
- [ ] 性能测试（如需要）
- [ ] 视觉回归测试（如需要）
- [ ] 边界情况测试

## 🚨 常见问题与解决方案

### 问题 1: 组件过度渲染

**原因**: 缺少适当的记忆化或 props 不稳定

**解决方案**:
```typescript
// ❌ 问题代码
const Parent = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
      <ExpensiveComponent data={someData} />
    </div>
  );
};

// ✅ 解决方案
const Parent = () => {
  const [count, setCount] = useState(0);

  const memoizedData = useMemo(() => someData, [someDataDependency]);

  return (
    <div>
      <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
      <ExpensiveComponent data={memoizedData} />
    </div>
  );
};
```

### 问题 2: Props 拖影（Prop Drilling）

**原因**: 深层组件需要访问顶层状态

**解决方案**:
```typescript
// ❌ 问题代码 - Props 拖影
const App = () => {
  const [theme, setTheme] = useState('light');
  return (
    <Page theme={theme} setTheme={setTheme} />
  );
};

const Page = ({ theme, setTheme }) => (
  <Section theme={theme} setTheme={setTheme} />
);

// ... 继续传递

// ✅ 解决方案 - 使用 Context
const ThemeContext = createContext();

const App = () => {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Page />
    </ThemeContext.Provider>
  );
};
```

### 问题 3: 状态不一致

**原因**: 多个组件管理相关状态但不同步

**解决方案**:
```typescript
// ✅ 解决方案 - 集中状态管理
const useTodoState = () => {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = useCallback((text: string) => {
    setTodos(prev => [...prev, {
      id: Date.now().toString(),
      text,
      completed: false
    }]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  }, []);

  return { todos, addTodo, toggleTodo };
};
```

## 📚 扩展阅读

- [React 官方文档](https://react.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Testing Library 文档](https://testing-library.com/docs/react-testing-library/intro/)
- [Storybook 文档](https://storybook.js.org/)

---

本标准会随着项目发展持续更新。如有疑问或建议，请联系开发团队。

最后更新: 2025-10-18