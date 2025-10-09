# 🔍 路由注册审计报告

## 📋 发现的问题

### 问题：多个路由文件未注册到主应用

**影响**：前端调用这些API时会返回404错误

## 🗂️ 路由文件清单

### ✅ 已注册的路由
1. `health.ts` → `/health` ✅
2. `auth.ts` → `/api/auth` ✅
3. `agents.ts` → `/api/agents` ✅
4. `chat.ts` → `/api/chat` ✅
5. `cad.ts` → `/api/cad` ✅
6. `admin.ts` → `/api/admin` ✅ **刚修复**

### ❌ 未注册的路由
1. `audit.ts` - 审计日志路由 ❌
2. `difySession.ts` - Dify会话管理路由 ❌
3. `productPreview.ts` - 产品预览路由 ❌
4. `sessionRoutes.ts` - 会话路由 ❌

## 🔍 详细分析

### 1. audit.ts
```typescript
// backend/src/routes/audit.ts
export default router;
```

**应该注册为**：`/api/audit`

**用途**：审计日志查询和管理

### 2. difySession.ts
```typescript
// backend/src/routes/difySession.ts
export default router;
```

**应该注册为**：`/api/dify/sessions`

**用途**：Dify智能体的会话管理

### 3. productPreview.ts
```typescript
// backend/src/routes/productPreview.ts
export const productPreviewRoutes: RouterType = router;
```

**应该注册为**：`/api/product-preview`

**用途**：产品预览功能

### 4. sessionRoutes.ts
```typescript
// backend/src/routes/sessionRoutes.ts
export default router;
```

**应该注册为**：`/api/sessions`

**用途**：通用会话管理

## 🎯 修复计划

### 立即修复（高优先级）
1. ✅ `admin.ts` - 已修复
2. 检查前端是否使用了未注册的路由
3. 注册必要的路由

### 需要确认的问题
1. 这些路由是否还在使用？
2. 是否是废弃的代码？
3. 前端是否依赖这些路由？

## 📝 建议的修复代码

```typescript
// backend/src/index.ts

// 添加导入
import auditRouter from './routes/audit';
import difySessionRouter from './routes/difySession';
import { productPreviewRoutes } from './routes/productPreview';
import sessionRouter from './routes/sessionRoutes';

// 添加路由注册
app.use('/api/audit', auditRouter);
app.use('/api/dify/sessions', difySessionRouter);
app.use('/api/product-preview', productPreviewRoutes);
app.use('/api/sessions', sessionRouter);
```

## 🔍 前端使用情况检查

需要检查前端是否调用了这些API：
- `/api/audit/*`
- `/api/dify/sessions/*`
- `/api/product-preview/*`
- `/api/sessions/*`

## ⚠️ 风险评估

**低风险**：
- 如果前端没有使用这些路由，可以暂时不注册
- 可以作为技术债务，后续清理

**中风险**：
- 如果前端使用了但没有错误提示，可能是功能降级
- 需要检查前端错误处理逻辑

**高风险**：
- 如果是关键功能路由未注册，会导致功能完全不可用
- 需要立即修复
