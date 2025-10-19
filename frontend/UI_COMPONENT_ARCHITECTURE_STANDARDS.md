# UI组件架构标准与规范

> **创建时间**: 2025-10-19  
> **状态**: 强制执行  
> **适用范围**: 所有前端UI组件

---

## 🎯 核心原则

### 1. 子组件附加模式 (Compound Component Pattern)

**定义**: 复杂UI组件使用子组件附加模式，通过主组件.子组件方式访问

**强制要求**:
- ✅ **必须使用**: `import Card from '@/components/ui/Card'`
- ❌ **禁止使用**: `import { CardHeader, CardTitle } from '@/components/ui/Card'`

**使用方式**:
```typescript
// ✅ 正确
import Card from '@/components/ui/Card';

<Card>
  <Card.Header>
    <Card.Title>标题</Card.Title>
  </Card.Header>
  <Card.Content>内容</Card.Content>
  <Card.Footer>底部</Card.Footer>
</Card>

// ❌ 错误
import { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
</Card>
```

---

## 📦 复合组件清单

### Card 组件
```typescript
import Card from '@/components/ui/Card';

// 可用子组件:
- Card.Header
- Card.Title
- Card.Description
- Card.Content
- Card.Footer
```

### Tabs 组件
```typescript
import Tabs from '@/components/ui/Tabs';

// 可用子组件:
- Tabs.List
- Tabs.Trigger
- Tabs.Content
- Tabs.Panel
```

### Alert 组件
```typescript
import Alert from '@/components/ui/Alert';

// 可用子组件:
- Alert.Title
- Alert.Description
- Alert.Icon
```

### Dialog 组件
```typescript
import Dialog from '@/components/ui/Dialog';

// 可用子组件:
- Dialog.Header
- Dialog.Title
- Dialog.Description
- Dialog.Content
- Dialog.Footer
- Dialog.Close
```

### Select 组件
```typescript
import Select from '@/components/ui/Select';

// 可用子组件:
- Select.Option
- Select.Group
- Select.Label
- Select.Separator
```

### Dropdown 组件
```typescript
import Dropdown from '@/components/ui/Dropdown';

// 可用子组件:
- Dropdown.Menu
- Dropdown.Item
- Dropdown.Separator
- Dropdown.Label
```

### Accordion 组件
```typescript
import Accordion from '@/components/ui/Accordion';

// 可用子组件:
- Accordion.Item
- Accordion.Trigger
- Accordion.Content
```

---

## 🔧 验证器API标准

### RuntimeTypeValidator 使用规范

**核心API**:
- `test(value)` - **执行验证** 并返回 `ValidationResult<T>`
- `validate(validator)` - **添加验证器** (链式调用)

**强制要求**:
```typescript
// ✅ 正确: 执行验证使用 test()
const result = validator.test(data);
if (result.isValid) {
  console.log('验证通过', result.data);
} else {
  console.error('验证失败', result.errors);
}

// ❌ 错误: validate() 不是用来执行验证的
const result = validator.validate(data); // 错误!
```

**ValidationResult 接口**:
```typescript
interface ValidationResult<T> {
  isValid: boolean;      // ✅ 使用这个
  success?: boolean;     // ❌ 已废弃，不要使用
  data?: T;
  errors?: string[];
  warnings?: string[];
}

// ✅ 正确
if (result.isValid) { ... }

// ❌ 错误
if (result.success) { ... }
```

---

## 🎨 组件类型定义规范

### VirtualScroll 组件类型

**LoaderComponent / EmptyComponent 必须是函数组件**:

```typescript
// ✅ 正确: 使用函数组件
<VirtualScroll
  LoaderComponent={() => <div>Loading...</div>}
  EmptyComponent={() => <div>No data</div>}
/>

// ❌ 错误: 直接传入JSX元素
<VirtualScroll
  LoaderComponent={<div>Loading...</div>}  // 类型错误!
  EmptyComponent={<div>No data</div>}
/>
```

**类型定义**:
```typescript
export interface VirtualScrollProps {
  LoaderComponent?: React.ComponentType | (() => JSX.Element);
  EmptyComponent?: React.ComponentType | (() => JSX.Element);
}
```

---

## 🔍 类型守卫函数规范

### isArrayOf 使用规范

**函数签名**:
```typescript
export function isArrayOf<T>(
  arr: unknown,
  guard: (item: unknown) => item is T
): arr is T[];
```

**正确使用**:
```typescript
// ✅ 正确
import { isArrayOf, isString } from '@/utils/type-guards';

const data: unknown = ['a', 'b', 'c'];
if (isArrayOf(data, isString)) {
  // data 现在是 string[]
  data.forEach(str => console.log(str.toUpperCase()));
}

// ❌ 错误
if (isArrayOf(data, (item) => typeof item === 'string')) {
  // 类型守卫签名不正确
}
```

---

## 🔄 事件处理器类型规范

### 统一事件处理器签名

**ChangeEventHandler**:
```typescript
export type ChangeEventHandler<T = string> = (
  value: T,
  event: React.ChangeEvent<HTMLInputElement>
) => void;

// ✅ 使用
const handleChange: ChangeEventHandler<string> = (value, event) => {
  console.log('新值:', value);
};
```

**ClickEventHandler**:
```typescript
export type ClickEventHandler<T = void> = (
  data: T,
  event: React.MouseEvent<HTMLButtonElement>
) => void;

// ✅ 使用
const handleClick: ClickEventHandler<User> = (user, event) => {
  console.log('点击用户:', user);
};
```

---

## ✅ 代码检查清单

### 提交前必须检查

- [ ] 所有复合组件使用 default import
- [ ] 子组件通过点号访问 (Card.Header)
- [ ] 验证器使用 test() 而非 validate()
- [ ] ValidationResult 使用 isValid 而非 success
- [ ] VirtualScroll 组件传入函数组件
- [ ] 类型守卫函数签名正确
- [ ] 事件处理器类型统一

### 自动化检查命令

```bash
# TypeScript 类型检查
pnpm run type-check

# ESLint 检查
pnpm run lint

# 构建验证
pnpm run build
```

---

## 🚨 常见错误与修复

### 错误1: Card组件导入错误
```typescript
// ❌ 错误
import { CardContent } from '@/components/ui/Card';
// Error: Module has no exported member 'CardContent'

// ✅ 修复
import Card from '@/components/ui/Card';
<Card.Content>...</Card.Content>
```

### 错误2: 验证器API误用
```typescript
// ❌ 错误
const result = validator.validate(state);
// Error: validate() expects a validator function

// ✅ 修复
const result = validator.test(state);
if (result.isValid) { ... }
```

### 错误3: VirtualScroll类型错误
```typescript
// ❌ 错误
LoaderComponent={<div>Loading</div>}
// Error: Type 'Element' is not assignable to type 'ComponentType'

// ✅ 修复
LoaderComponent={() => <div>Loading</div>}
```

---

## 📚 参考资源

- [React Compound Components](https://kentcdodds.com/blog/compound-components-with-react-hooks)
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [项目TypeScript配置](./tsconfig.json)

---

## 🔄 更新日志

### v1.0.0 (2025-10-19)
- 建立UI组件架构标准
- 定义验证器API使用规范
- 创建类型守卫函数规范
- 统一事件处理器类型

---

**强制执行**: 所有违反此规范的代码将无法通过CI/CD检查

