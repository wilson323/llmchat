# TypeScript架构标准与规范体系

> **版本**: v2.0.0  
> **创建时间**: 2025-10-19  
> **状态**: 强制执行  
> **适用范围**: 整个前端项目

---

## 🎯 核心架构原则

### 1. 单一真理源原则

**定义**: 每个类型、组件、工具只能有一个权威定义源

**实施**:
- ✅ **ui.types.ts** - UI组件类型的唯一权威源
- ✅ **types.unified.ts** - 仅作转发层，不定义新类型
- ❌ **禁止**: types.ts、Card.types.ts等冗余文件
- ❌ **禁止**: *.backup备份文件提交

**验证命令**:
```bash
# 检查冗余文件
find frontend/src -name "types.ts" -o -name "*.backup"

# 应该只返回: types.unified.ts, ui.types.ts, types.hooks.ts
```

### 2. 类型/值严格分离原则

**定义**: Interface/Type必须用`export type {}`,  Class/Const必须用`export {}`

**错误示例**:
```typescript
// ❌ 错误: Interface作为值导出
export { TypeValidator } from './validator';
// Error TS1205: Re-exporting a type when 'isolatedModules' is enabled

// ❌ 错误: Class作为类型导出  
export type { ApiErrorFactory } from './errors';
// Error TS1361: 'ApiErrorFactory' cannot be used as a value

// ✅ 正确
export type { TypeValidator } from './validator';
export { ApiErrorFactory } from './errors';
```

**检查规则**:
| 导出内容 | 正确方式 | 错误示例 |
|---------|---------|---------|
| interface | `export type {}` | `export {}` |
| type alias | `export type {}` | `export {}` |
| class | `export {}` | `export type {}` |
| const object | `export {}` | `export type {}` |
| function | `export {}` | `export type {}` |

### 3. 复合组件统一架构

**定义**: 所有复合UI组件使用子组件附加模式

**强制规范**:
```typescript
// ✅ 组件定义（Card.tsx）
const Card = attachSubComponents(CardImpl, {
  Header: CardHeader,
  Title: CardTitle,
  Content: CardContent,
});

export default Card;

// ✅ 组件使用
import Card from '@/components/ui/Card';

<Card>
  <Card.Header>
    <Card.Title>标题</Card.Title>
  </Card.Header>
  <Card.Content>内容</Card.Content>
</Card>

// ❌ 错误: Named import
import { CardHeader, CardTitle } from '@/components/ui/Card';
<CardHeader><CardTitle>...</CardTitle></CardHeader>
```

**适用组件清单**:
- Card (Header, Title, Description, Content, Footer)
- Tabs (List, Trigger, Content, Panel)
- Alert (Title, Description, Icon)
- Dialog (Header, Title, Content, Footer, Close)
- Select (Option, Group, Label, Separator)
- Dropdown (Menu, Item, Separator, Label)
- Accordion (Item, Trigger, Content)

### 4. 验证器API标准化

**RuntimeTypeValidator API规范**:
```typescript
// ✅ test() - 执行验证
const result = validator.test(data);
if (result.isValid) {
  console.log('验证通过', result.data);
}

// ✅ validate() - 添加验证器（链式调用）
const validator = new RuntimeTypeValidator()
  .validate(v => v.isString())
  .validate(v => v.minLength(5));

// ❌ 错误: validate()不用于执行验证
const result = validator.validate(data); // 错误!
```

**ValidationResult接口**:
```typescript
interface ValidationResult<T> {
  isValid: boolean;      // ✅ 使用这个
  data?: T;
  errors?: string[];
}

// ❌ 禁止使用
result.success  // 已废弃
```

### 5. 组件类型定义规范

**VirtualScroll等特殊组件**:
```typescript
// ✅ LoaderComponent必须是函数组件
<VirtualScroll
  LoaderComponent={() => <div>Loading...</div>}
  EmptyComponent={() => <div>Empty</div>}
/>

// ❌ 错误: 直接传JSX元素
<VirtualScroll
  LoaderComponent={<div>Loading...</div>}  // 类型错误!
/>
```

---

## 🚫 严格禁止的模式

### 1. 冗余文件
```bash
# ❌ 禁止创建
src/components/ui/types.ts
src/components/ui/Card.types.ts
src/components/ui/*.backup

# ✅ 仅允许
src/components/ui/ui.types.ts
src/components/ui/types.unified.ts
```

### 2. 重复导出
```typescript
// ❌ 错误
export class MyClass { }

export { MyClass };  // 重复导出!

// ✅ 正确
export class MyClass { }
// 定义处已导出，无需重复
```

### 3. Mixed Export
```typescript
// ❌ 错误
export {
  MyInterface,      // interface
  MyClass,          // class
  myFunction        // function
} from './module';

// ✅ 正确
export type { MyInterface } from './module';
export { MyClass, myFunction } from './module';
```

### 4. UI对象等冗余结构
```typescript
// ❌ 错误（index.ts中的冗余）
export const UI = {
  Card: Card,
  Button: Button,
  // ... 50个组件
};

// ✅ 正确
// 直接导出组件，无需包装对象
export { default as Card } from './Card';
export { default as Button } from './Button';
```

---

## ✅ 代码审查检查清单

### 提交前必须检查

#### 文件层面
- [ ] 无冗余的types.ts文件
- [ ] 无.backup备份文件
- [ ] 无重复的类型定义

#### 导入导出层面
- [ ] 复合组件使用default export
- [ ] 子组件通过点号访问
- [ ] Interface使用`export type {}`
- [ ] Class使用`export {}`
- [ ] 无重复的导出语句

#### API使用层面
- [ ] 验证器使用test()执行
- [ ] ValidationResult使用isValid
- [ ] VirtualScroll传入函数组件
- [ ] 事件处理器签名统一

### 自动化检查命令

```bash
# 1. TypeScript类型检查（目标：0错误）
pnpm run type-check

# 2. ESLint代码质量检查
pnpm run lint

# 3. 构建验证
pnpm run build

# 4. 查找冗余文件
find frontend/src -name "*.backup" -o -name "types.ts" | grep -v "ui.types.ts\|types.unified.ts\|types.hooks.ts"
```

---

## 📈 错误修复优先级

### P0 - 架构性错误（必须立即修复）
- TS2484 - 重复导出冲突
- TS2323 - 重复声明  
- TS1361 - 作为值使用
- TS1205 - Re-exporting类型

**特征**: 影响编译，阻止构建

### P1 - 接口性错误（优先修复）
- TS2339 - 属性不存在
- TS2322 - 类型不匹配
- TS2305 - 模块无导出成员

**特征**: 影响类型安全，容易引发运行时错误

### P2 - 兼容性错误（逐步修复）
- TS2345 - 参数类型不匹配
- TS2304 - 无法找到名称

**特征**: 局部问题，不影响整体架构

---

## 🛠️ 修复方法论

### 1. 识别错误模式
```bash
# 按错误类型分组统计
pnpm run type-check 2>&1 | Select-String "error TS" | Group-Object { $_ -replace '.*error TS(\d+):.*','$1' } | Sort-Object Count -Descending
```

### 2. 批量修复相同模式
- 使用全局替换处理相同错误
- 一次修复一类问题
- 每次修复后验证错误数

### 3. 根治性解决
- 不满足于修复表面错误
- 追溯到架构层面的根源
- 建立规范防止问题复现

---

## 📚 参考资源

- [UI组件架构标准](./UI_COMPONENT_ARCHITECTURE_STANDARDS.md)
- [TypeScript配置](./tsconfig.json)
- [项目开发规范](../CLAUDE.md)

---

**最后更新**: 2025-10-19  
**维护者**: 开发团队

