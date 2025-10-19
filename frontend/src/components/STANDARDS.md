# 组件类型统一标准和导入导出规范

## 📋 目录

- [组件命名规范](#组件命名规范)
- [组件文件结构](#组件文件结构)
- [类型定义规范](#类型定义规范)
- [导入导出规范](#导入导出规范)
- [事件处理器规范](#事件处理器规范)
- [Hook 使用规范](#hook-使用规范)
- [类型安全最佳实践](#类型安全最佳实践)

## 🏷️ 组件命名规范

### 组件名称
- 使用 **PascalCase** 命名组件
- 组件名称应该清晰描述其功能
- 避免使用缩写，除非是广泛认知的缩写
- UI组件应该包含其功能描述

```tsx
// ✅ 正确
const MessageInput = () => { ... };
const UserProfileCard = () => { ... };
const LoadingSpinner = () => { ... };

// ❌ 错误
const MsgInp = () => { ... };
const UserProfCard = () => { ... };
const LoadSpin = () => { ... };
```

### Props 接口命名
- Props 接口名称应该与组件名称对应
- 使用 `Props` 后缀
- 如果有多个相关接口，使用描述性前缀

```tsx
// ✅ 正确
interface ButtonProps { ... }
interface CardHeaderProps { ... }
interface ChatContainerProps { ... }

// ❌ 错误
interface ButtonI { ... }
interface CardHeaderType { ... }
interface ChatContainerType { ... }
```

## 📁 组件文件结构

### 基础组件结构
```
ComponentName/
├── index.ts          # 导出文件
├── ComponentName.tsx # 主组件文件
├── ComponentName.test.tsx # 测试文件
├── ComponentName.stories.tsx # Storybook文件（可选）
├── hooks/            # 相关Hook
├── utils/            # 工具函数
├── types.ts          # 类型定义（如果复杂）
└── styles/           # 样式文件（如果需要）
```

### 简单组件结构
对于简单组件，可以使用单文件结构：
```
ComponentName.tsx
```

### 示例文件结构

```tsx
// Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';

// Button/Button.tsx
import React from 'react';
import type { ButtonProps } from './types';

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...);
Button.displayName = 'Button';

// Button/types.ts
export interface ButtonProps extends BaseButtonProps {
  // 组件特定props
}

// Button/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';
```

## 📝 类型定义规范

### Props 接口定义
- 使用 `interface` 而不是 `type` 定义对象类型
- 继承基础Props接口
- 为所有可选属性提供注释
- 使用 JSDoc 注释描述复杂属性

```tsx
// ✅ 正确
interface ButtonProps extends BaseButtonProps {
  /** 按钮变体类型 */
  variant?: 'primary' | 'secondary' | 'outline';
  /** 是否禁用按钮 */
  disabled?: boolean;
  /** 点击事件处理器 */
  onClick?: ClickEventHandler<void>;
  /** 按钮图标 */
  icon?: React.ReactNode;
}

// ❌ 错误
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
};
```

### 事件处理器类型
- 使用统一的事件处理器类型
- 优先使用项目定义的类型而非原生React类型
- 为复杂事件处理器提供泛型支持

```tsx
// ✅ 正确
import type { ClickEventHandler, ChangeEventHandler } from '@/types/event-handlers';

interface InputProps {
  onClick?: ClickEventHandler<void>;
  onChange?: ChangeEventHandler<string>;
}

// ❌ 错误
interface InputProps {
  onClick?: (event: React.MouseEvent) => void;
  onChange?: (event: React.ChangeEvent) => void;
}
```

### 泛型组件
- 为可复用组件提供泛型支持
- 使用描述性的泛型参数名称
- 提供默认泛型约束

```tsx
// ✅ 正确
interface VirtualListProps<T = unknown> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}

export const VirtualList = <T = unknown>({ items, renderItem }: VirtualListProps<T>) => {
  // 实现
};

// ❌ 错误
interface VirtualListProps {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
}
```

## 📦 导入导出规范

### 导入顺序
1. React 相关导入
2. 第三方库导入
3. 项目内部类型导入
4. 项目内部组件导入
5. 工具函数导入
6. 样式文件导入

```tsx
// ✅ 正确
import React, { forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import type { ButtonProps } from './types';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import './Button.css';

// ❌ 错误（导入顺序混乱）
import './Button.css';
import { cn } from '@/lib/utils';
import React, { forwardRef, useState } from 'react';
import type { ButtonProps } from './types';
import { useTheme } from '@/hooks/useTheme';
import { clsx } from 'clsx';
```

### 导出规范
- 使用命名导出而非默认导出（除非有特殊原因）
- 组件应该使用 `export const` 导出
- 类型应该使用 `export type` 导出
- 提供统一的导出文件

```tsx
// ✅ 正确
// Button/Button.tsx
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...);

// Button/types.ts
export type { ButtonProps };

// Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './types';

// ❌ 错误
// Button/Button.tsx
const Button = React.forwardRef(...);
export default Button;

// Button/types.ts
export interface ButtonProps { ... }
```

### 重新导出
- 使用 `export { }` 语法重新导出
- 为重新导出的组件提供别名（如果需要）
- 避免使用 `export *` 重新导出所有内容

```tsx
// ✅ 正确
export { Button } from './Button';
export { IconButton } from './IconButton';
export type { ButtonProps, IconButtonProps } from './types';

// ❌ 错误
export * from './Button';
export * from './IconButton';
```

## 🎯 事件处理器规范

### 统一事件处理器类型
- 使用项目定义的统一事件处理器类型
- 支持多种签名模式
- 提供自动适配功能

```tsx
// ✅ 正确
import type { ClickEventHandler, ChangeEventHandler } from '@/types/event-handlers';
import { createClickHandler, createChangeHandler } from '@/utils/eventHandlers.unified';

interface Props {
  onClick?: ClickEventHandler<void>;
  onChange?: ChangeEventHandler<string>;
}

const Component = ({ onClick, onChange }: Props) => {
  const handleClick = createClickHandler(onClick);
  const handleChange = createChangeHandler(onChange);

  return (
    <button onClick={handleClick} onChange={handleChange}>
      Click me
    </button>
  );
};

// ❌ 错误
interface Props {
  onClick?: (event: React.MouseEvent) => void;
  onChange?: (value: string, event: React.ChangeEvent) => void;
}
```

### 事件处理器命名
- 使用 `handle` 前缀
- 事件处理器应该描述动作和对象
- 避免使用 `on` 前缀（留给props）

```tsx
// ✅ 正确
const handleSubmit = (event: FormEvent) => { ... };
const handleInputChange = (value: string) => { ... };
const handleButtonClick = (data: any, event: MouseEvent) => { ... };

// ❌ 错误
const onSubmit = (event: FormEvent) => { ... };
const onInputChange = (value: string) => { ... };
const onClick = (data: any, event: MouseEvent) => { ... };
```

## 🪝 Hook 使用规范

### Hook 命名
- 使用 `use` 前缀
- Hook 名称应该清晰描述其功能
- 避免使用过于简单的名称

```tsx
// ✅ 正确
const useVirtualScroll = () => { ... };
const useThemeToggle = () => { ... };
const useKeyboardShortcuts = () => { ... };

// ❌ 错误
const useData = () => { ... };
const useHook = () => { ... };
const useStuff = () => { ... };
```

### Hook 返回值类型
- 为Hook提供明确的返回值类型
- 使用元组返回多个值时，提供类型注解
- 返回对象时，使用接口定义

```tsx
// ✅ 正确
interface UseThemeResult {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const useTheme = (): UseThemeResult => { ... };

const useCounter = (): [number, (value: number) => void] => { ... };

// ❌ 错误
const useTheme = () => {
  return { theme: 'light', toggleTheme: () => {} };
};
```

### Hook 参数类型
- 为Hook参数提供类型定义
- 使用选项对象而非多个参数
- 提供合理的默认值

```tsx
// ✅ 正确
interface UseFetchOptions {
  url: string;
  method?: 'GET' | 'POST';
  body?: any;
  headers?: Record<string, string>;
}

const useFetch = (options: UseFetchOptions) => { ... };

// ❌ 错误
const useFetch = (url: string, method?: string, body?: any, headers?: any) => { ... };
```

## 🔒 类型安全最佳实践

### 严格类型检查
- 启用 TypeScript 严格模式
- 避免使用 `any` 类型
- 使用类型守卫和类型谓词

```tsx
// ✅ 正确
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const processValue = (value: unknown) => {
  if (isString(value)) {
    return value.toUpperCase(); // TypeScript 知道 value 是 string
  }
  return String(value);
};

// ❌ 错误
const processValue = (value: any) => {
  return value.toUpperCase();
};
```

### 避免类型断言
- 优先使用类型守卫而非类型断言
- 如果必须使用断言，使用 `as` 关键字
- 避免使用双重断言

```tsx
// ✅ 正确
const element = document.getElementById('my-element');
if (element && element instanceof HTMLButtonElement) {
  element.click(); // TypeScript 知道 element 是 HTMLButtonElement
}

// ❌ 错误
const element = document.getElementById('my-element') as HTMLButtonElement;
element.click(); // 可能在运行时出错
```

### 组件 Props 验证
- 使用 PropTypes 或 Zod 进行运行时验证
- 为复杂 Props 提供默认值
- 使用 React 的 `defaultProps`（如果使用类组件）

```tsx
// ✅ 正确
interface Props {
  name: string;
  age?: number;
  onAction?: (data: any) => void;
}

const Component: React.FC<Props> = ({ name, age = 18, onAction }) => {
  // 实现
};

// ❌ 错误
const Component = ({ name, age, onAction }) => {
  // 没有类型定义，容易出现运行时错误
};
```

## 📚 代码示例

### 完整组件示例

```tsx
// Button/Button.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { ButtonProps } from './types';
import { createClickHandler } from '@/utils/eventHandlers.unified';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 rounded-md px-3',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, onClick, children, ...props }, ref) => {
    const handleClick = createClickHandler(onClick);

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

```tsx
// Button/types.ts
import type { BaseButtonProps } from '@/components/ui/types.unified';
import type { VariantProps } from 'class-variance-authority';

export interface ButtonProps
  extends BaseButtonProps,
    VariantProps<typeof buttonVariants> {
  // 组件特定属性
}
```

```tsx
// Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './types';
```

## 🔄 迁移指南

### 从现有代码迁移
1. **检查组件类型定义** - 确保所有组件都有正确的Props接口
2. **更新导入语句** - 按照新的导入规范重新组织导入
3. **替换事件处理器** - 使用统一的事件处理器类型
4. **添加类型注解** - 为所有Hook和函数添加返回值类型
5. **更新导出语句** - 使用命名导出和统一的导出文件

### 验证类型安全
1. 运行 TypeScript 编译器检查类型错误
2. 使用 ESLint 检查代码规范
3. 运行测试确保功能正常
4. 检查生成的类型声明文件

## 📝 检查清单

在提交代码前，请确保：

- [ ] 组件使用 PascalCase 命名
- [ ] Props 接口使用 `Props` 后缀
- [ ] 导入语句按照规范顺序排列
- [ ] 使用命名导出而非默认导出
- [ ] 事件处理器使用统一类型
- [ ] Hook 返回值有明确的类型注解
- [ ] 避免使用 `any` 类型
- [ ] 提供完整的 JSDoc 注释
- [ ] 组件有正确的 displayName
- [ ] 测试文件使用正确的命名和结构

遵循这些规范将确保代码的一致性、可维护性和类型安全性。