# TypeScript开发规范 - 确保代码质量

## 🔴 强制性规范

### 1. 组件导出规范
```typescript
// ✅ 正确：统一使用default export
const ComponentName: React.FC<ComponentProps> = (props) => {
  return <div>...</div>;
};

export default ComponentName;

// ❌ 禁止：mixed export patterns
export const ComponentName = ...; // 不允许
export { ComponentName }; // 不允许，除非是额外工具函数
```

### 2. 导入规范
```typescript
// ✅ 正确：组件使用default import
import ComponentName from '@/components/ComponentName';

// ✅ 正确：工具函数使用named import
import { utilityFunction } from '@/utils/utility';

// ❌ 禁止：组件使用named import
import { ComponentName } from '@/components/ComponentName';
```

### 3. UI组件规范
```typescript
// ✅ 正确：UI组件必须正确附加子组件
import Card from '@/components/ui/Card';
// 使用：Card.Header, Card.Content, Card.Title

// ✅ UI组件结构
const Card = React.forwardRef<HTMLDivElement, CardProps>((props, ref) => {
  return <div ref={ref} {...props} />;
});

// 必须附加子组件
Card.Header = CardHeader;
Card.Content = CardContent;
Card.Title = CardTitle;

export default Card;
```

### 4. 类型定义规范
```typescript
// ✅ 正确：接口必须与实际使用完全匹配
interface ProvinceHeatmapDataset {
  province: string;
  value: number;
  lat: number;
  lng: number;
  data?: Array<{
    date: string;
    value: number;
    requestCount?: number; // 可选字段必须明确标记
  }>;
  generatedAt?: string; // 可选字段
}

// ✅ 使用时必须检查可选字段
const count = dataset.data?.length || 0;
const date = dataset.generatedAt ? new Date(dataset.generatedAt) : new Date();
```

### 5. 工具函数规范
```typescript
// ✅ 正确：单一职责，明确签名
export function toIsoRangeFromInput(value: string, endOfDay: boolean): string {
  // 实现逻辑
}

// ❌ 禁止：重复定义不同版本的函数
// 同一功能只允许一个标准实现
```

## 🔧 开发流程规范

### 1. 渐进式开发流程
```bash
# 每次修改后必须执行的检查
pnpm run type-check  # 1. 类型检查
pnpm run lint       # 2. 代码质量
pnpm test           # 3. 测试验证
pnpm run build      # 4. 构建验证

# 任何一步失败都必须立即修复，不允许继续开发
```

### 2. 组件开发检查清单
- [ ] 组件使用default export
- [ ] 导入语句符合规范
- [ ] 类型定义完整且匹配
- [ ] 可选属性正确处理
- [ ] UI组件子组件正确使用
- [ ] 无未使用的导入/变量
- [ ] 通过TypeScript严格检查

### 3. 服务函数开发规范
```typescript
// ✅ 明确的函数签名
export const listAgents = async (options?: {
  includeInactive?: boolean
}): Promise<AgentItem[]> => {
  // 实现
};

// ✅ 使用时参数匹配
const agents = await listAgents({ includeInactive: true });
```

## 🚫 零容忍政策

### 以下情况严格禁止提交：
1. **TypeScript编译错误**：哪怕只有1个错误
2. **ESLint严重警告**：影响代码质量的问题
3. **测试失败**：任何测试不通过
4. **构建失败**：无法正确构建
5. **类型不匹配**：接口与使用不一致
6. **导入导出不规范**：违反统一规范

### 违规后果：
- **立即阻止提交**：质量门禁100%拦截
- **强制重构**：不只是修复，要重新设计
- **记录问题**：在CLAUDE.md中记录问题和解决方案
- **改进规范**：更新开发规范防止重现

## 📋 Claude Code开发约束

### AI开发必须遵守的规则：
1. **每次创建组件时**：必须使用default export
2. **每次导入时**：必须确认导出方式
3. **每次使用类型时**：必须检查接口定义
4. **每次修改后**：必须运行type-check验证
5. **遇到类型错误时**：必须从根本上解决问题，不是简单注释

### 开发前检查：
- [ ] 确认要导入的组件的导出方式
- [ ] 确认要使用的类型的完整定义
- [ ] 确认要调用的函数的正确签名
- [ ] 准备好处理可选属性的逻辑

### 开发中检查：
- [ ] 每个文件保存后立即运行类型检查
- [ ] 出现错误立即分析根本原因
- [ ] 不允许累积类型错误
- [ ] 不允许绕过类型检查

## 🔄 持续改进机制

### 每周代码审查：
1. **检查导入导出一致性**
2. **验证类型定义准确性**
3. **确认UI组件正确使用**
4. **审查工具函数重复问题**

### 每月重构：
1. **消除重复代码**
2. **统一接口定义**
3. **优化组件结构**
4. **更新开发规范**

### 问题追踪：
- 每次类型错误都要记录在案
- 分析错误模式和根本原因
- 更新规范防止类似问题
- 培训团队成员避免重复错误

---

**执行要求**：
- ✅ 严格遵守此规范
- ✅ 任何违反都必须立即修复
- ✅ 持续更新和完善规范
- ✅ 确保0类型错误的目标