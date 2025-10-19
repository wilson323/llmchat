# UI组件库使用指南

## 概述

本UI组件库基于React 18 + TypeScript构建，提供了一套完整的、类型安全的UI组件，支持主题系统和可访问性标准。

## 特性

- ✅ **TypeScript类型安全** - 完整的类型定义和类型检查
- ✅ **子组件架构** - 支持子组件模式，如 `Card.Header`、`Card.Content`
- ✅ **Ref类型兼容** - 完整的ref转发和类型支持
- ✅ **主题系统** - 支持亮色/暗色主题和自定义主题
- ✅ **可访问性** - 符合WCAG标准的可访问性支持
- ✅ **响应式设计** - 移动端优先的响应式布局
- ✅ **现代化样式** - 基于Tailwind CSS的现代化样式系统

## 快速开始

### 基本导入

```typescript
// 推荐的导入方式
import { Card, Button, Input } from '@/components/ui';
import type { CardProps, ButtonProps } from '@/components/ui';

// 或者使用命名空间导入
import { UI } from '@/components/ui';
const { Card, Button } = UI;
```

### 基本使用

```typescript
import React from 'react';
import { Card, Button, Input } from '@/components/ui';
import type { CardProps, ButtonProps } from '@/components/ui';

export function MyComponent() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>用户登录</Card.Title>
      </Card.Header>
      <Card.Content>
        <Input placeholder="请输入用户名" />
        <Input type="password" placeholder="请输入密码" />
      </Card.Content>
    </Card>
  );
}
```

## 组件详细说明

### Card组件

Card组件支持子组件模式，提供灵活的布局结构。

```typescript
import { Card } from '@/components/ui';

// 基本使用
<Card>
  <Card.Header>
    <Card.Title>卡片标题</Card.Title>
  </Card.Header>
  <Card.Content>
    卡片内容
  </Card.Content>
  <Card.Footer>
    <Button>确认</Button>
  </Card.Footer>
</Card>

// 带属性的Card
<Card hoverable clickable onClick={() => console.log('clicked')}>
  <Card.Title>可点击的卡片</Card.Title>
  <Card.Content>点击查看详情</Card.Content>
</Card>
```

#### Card属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `string` | - | 卡片标题（简化用法） |
| `hoverable` | `boolean` | `false` | 是否悬停效果 |
| `clickable` | `boolean` | `false` | 是否可点击 |
| `onClick` | `() => void` | - | 点击回调 |

### Button组件

Button组件支持多种变体、尺寸和状态。

```typescript
import { Button } from '@/components/ui';

// 基本使用
<Button>默认按钮</Button>
<Button variant="secondary">次要按钮</Button>
<Button variant="destructive">危险按钮</Button>
<Button variant="outline">轮廓按钮</Button>
<Button variant="ghost">幽灵按钮</Button>

// 不同尺寸
<Button size="sm">小按钮</Button>
<Button size="md">中按钮</Button>
<Button size="lg">大按钮</Button>

// 带图标
<Button leftIcon={<PlusIcon />}>添加</Button>
<Button rightIcon={<ArrowIcon />}>下一步</Button>

// 加载状态
<Button loading>加载中...</Button>

// 块级按钮
<Button block>全宽按钮</Button>
```

#### Button属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `'primary' \| 'secondary' \| 'destructive' \| 'outline' \| 'ghost' \| 'link'` | `'primary'` | 按钮变体 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'icon'` | `'md'` | 按钮尺寸 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `block` | `boolean` | `false` | 是否块级 |
| `leftIcon` | `React.ReactNode` | - | 左侧图标 |
| `rightIcon` | `React.ReactNode` | - | 右侧图标 |

### Input组件

Input组件提供丰富的输入控制选项。

```typescript
import { Input } from '@/components/ui';

// 基本使用
<Input placeholder="请输入内容" />

// 带标签
<Input label="用户名" placeholder="请输入用户名" required />

// 错误状态
<Input label="邮箱" placeholder="请输入邮箱" error="邮箱格式不正确" />

// 帮助文本
<Input label="密码" placeholder="请输入密码" helperText="密码至少8个字符" />

// 带前缀和后缀
<Input
  prefix={<UserIcon />}
  suffix={<EyeIcon />}
  placeholder="搜索用户"
/>

// 可清空
<Input allowClear placeholder="可清空的输入框" />
```

#### Input属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | `string` | - | 标签文本 |
| `error` | `string` | - | 错误信息 |
| `helperText` | `string` | - | 帮助文本 |
| `required` | `boolean` | `false` | 是否必填 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `readonly` | `boolean` | `false` | 是否只读 |
| `allowClear` | `boolean` | `false` | 是否显示清除按钮 |
| `prefix` | `React.ReactNode` | - | 前缀元素 |
| `suffix` | `React.ReactNode` | - | 后缀元素 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 输入框尺寸 |
| `state` | `'default' \| 'success' \| 'warning' \| 'error'` | `'default'` | 输入状态 |

### Modal组件

Modal组件提供完整的对话框功能。

```typescript
import { Modal, Button } from '@/components/ui';
import { useState } from 'react';

export function ModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>打开对话框</Button>
      <Modal
        open={isOpen}
        title="确认删除"
        description="此操作不可恢复，确认删除吗？"
        onConfirm={() => {
          console.log('确认删除');
          setIsOpen(false);
        }}
        onClose={() => setIsOpen(false)}
        destructive
      />
    </>
  );
}
```

#### Modal属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `open` | `boolean` | - | 是否打开 |
| `title` | `React.ReactNode` | - | 标题 |
| `description` | `React.ReactNode` | - | 描述内容 |
| `onConfirm` | `() => void \| Promise<void>` | - | 确认回调 |
| `onClose` | `() => void` | - | 关闭回调 |
| `destructive` | `boolean` | `false` | 是否为危险操作 |
| `closable` | `boolean` | `true` | 是否可关闭 |
| `mask` | `boolean` | `true` | 是否显示遮罩 |
| `maskClosable` | `boolean` | `true` | 点击遮罩是否关闭 |
| `keyboard` | `boolean` | `true` | 是否支持键盘操作 |

### Select组件

Select组件支持下拉选择功能。

```typescript
import { Select } from '@/components/ui';
import { useState } from 'react';

export function SelectExample() {
  const [value, setValue] = useState('option1');

  return (
    <Select
      value={value}
      onValueChange={setValue}
      placeholder="请选择选项"
      label="选择项"
    >
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="option1">选项1</Select.Item>
        <Select.Item value="option2">选项2</Select.Item>
        <Select.Item value="option3">选项3</Select.Item>
      </Select.Content>
    </Select>
  );
}
```

#### Select属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `string` | - | 当前值 |
| `onValueChange` | `(value: string) => void` | - | 值变化回调 |
| `placeholder` | `string` | - | 占位符 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `label` | `string` | - | 标签 |
| `error` | `string` | - | 错误信息 |
| `searchable` | `boolean` | `false` | 是否可搜索 |
| `allowClear` | `boolean` | `false` | 是否可清空 |

### Tabs组件

Tabs组件提供标签页功能。

```typescript
import { Tabs } from '@/components/ui';
import { useState } from 'react';

export function TabsExample() {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Trigger value="tab1">标签1</Tabs.Trigger>
        <Tabs.Trigger value="tab2">标签2</Tabs.Trigger>
        <Tabs.Trigger value="tab3">标签3</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tab1">
        内容1
      </Tabs.Content>
      <Tabs.Content value="tab2">
        内容2
      </Tabs.Content>
      <Tabs.Content value="tab3">
        内容3
      </Tabs.Content>
    </Tabs>
  );
}
```

#### Tabs属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `string` | - | 当前激活标签 |
| `onValueChange` | `(value: string) => void` | - | 标签变化回调 |
| `defaultValue` | `string` | - | 默认激活标签 |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | 标签方向 |
| `variant` | `'default' \| 'underline' \| 'pills' \| 'enclosed'` | `'default'` | 标签样式 |
| `activationMode` | `'automatic' \| 'manual'` | `'automatic'` | 激活模式 |

### Toast组件

Toast组件提供通知功能。

```typescript
import { ToastProvider, useToast, Button } from '@/components/ui';

function App() {
  const { toast, success, error, warning, info } = useToast();

  return (
    <div>
      <Button onClick={() => toast('基本通知')}>基本通知</Button>
      <Button onClick={() => success('成功操作')}>成功通知</Button>
      <Button onClick={() => error('错误信息')}>错误通知</Button>
      <Button onClick={() => warning('警告信息')}>警告通知</Button>
      <Button onClick={() => info('信息提示')}>信息通知</Button>

      <ToastProvider position="top-right" />
    </div>
  );
}
```

#### Toast属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `string` | - | 通知标题 |
| `description` | `string` | - | 通知描述 |
| `type` | `'success' \| 'error' \| 'warning' \| 'info'` | `'info'` | 通知类型 |
| `duration` | `number` | `3000` | 持续时间(ms) |
| `closable` | `boolean` | `true` | 是否可关闭 |
| `action` | `{ label: string; onClick: () => void }` | - | 操作按钮 |
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'top-right'` | 位置 |

## 主题系统

### 使用主题

```typescript
import { ThemeProvider, useTheme } from '@/components/theme';

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <YourApp />
    </ThemeProvider>
  );
}

function YourComponent() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <p>当前主题: {theme.mode}</p>
      <Button onClick={() => setTheme(theme.mode === 'light' ? 'dark' : 'light')}>
        切换主题
      </Button>
    </div>
  );
}
```

### 自定义主题

```typescript
import { cn } from '@/lib/utils';

// 扩展主题
const customTheme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    // ...
  },
  spacing: {
    sm: '0.5rem',
    md: '1rem',
    // ...
  },
};
```

## 最佳实践

### 1. 组件导入

```typescript
// ✅ 推荐：按需导入
import { Card, Button } from '@/components/ui';
import type { CardProps } from '@/components/ui';

// ✅ 推荐：命名空间导入
import { UI } from '@/components/ui';
const { Card, Button } = UI;

// ❌ 不推荐：全量导入
import * as UI from '@/components/ui';
```

### 2. 类型使用

```typescript
// ✅ 推荐：明确类型
interface MyComponentProps {
  title: string;
  onConfirm: () => void;
}

// ✅ 推荐：继承组件类型
interface ExtendedCardProps extends CardProps {
  extraProp: string;
}
```

### 3. 子组件使用

```typescript
// ✅ 推荐：使用子组件模式
<Card>
  <Card.Header>
    <Card.Title>标题</Card.Title>
  </Card.Header>
  <Card.Content>内容</Card.Content>
</Card>

// ❌ 不推荐：混合使用
<Card title="标题">
  <div>内容</div>
</Card>
```

### 4. Ref使用

```typescript
// ✅ 推荐：正确使用ref
const MyComponent = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Input ref={inputRef} />
  );
};

// ✅ 推荐：类型安全的ref
const buttonRef = useRef<HTMLButtonElement>(null);
```

## 故障排除

### 常见问题

1. **TypeScript类型错误**
   - 确保正确导入类型：`import type { ComponentProps } from '@/components/ui'`
   - 检查是否使用了正确的属性名

2. **子组件不显示**
   - 确保正确导入子组件：`import { Card, Card.Header } from '@/components/ui'`
   - 检查子组件的使用方式

3. **样式不生效**
   - 确保Tailwind CSS正确配置
   - 检查CSS类名是否正确

4. **主题切换不工作**
   - 确保ThemeProvider正确包裹应用
   - 检查主题配置

## 开发指南

### 添加新组件

1. 创建组件文件：`ComponentName.tsx`
2. 创建类型定义：`ComponentName.types.ts`
3. 实现组件逻辑
4. 添加到统一导出文件：`index.ts`

### 组件开发规范

1. **TypeScript严格模式**：所有组件都必须使用严格的TypeScript类型
2. **ForwardRef支持**：所有组件都必须支持ref转发
3. **可访问性**：所有组件都必须符合可访问性标准
4. **文档注释**：所有公开的API都必须有详细的JSDoc注释
5. **测试覆盖**：所有组件都必须有对应的测试文件

### 贡献指南

1. Fork项目
2. 创建功能分支
3. 编写代码和测试
4. 更新文档
5. 提交Pull Request

## 版本历史

- **v1.0.0**: 初始版本，包含核心UI组件
- 支持TypeScript严格模式
- 完整的子组件架构
- 主题系统集成
- 可访问性支持

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交Issue：[GitHub Issues](https://github.com/your-repo/issues)
- 发送邮件：your-email@example.com

---

*最后更新：2024年*