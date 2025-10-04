# 本周开发计划（2025-10-05至2025-10-11）

## 📋 概述

本周重点：修复Three.js相关问题，补充前端测试覆盖率。

---

## ✅ 今日已完成（2025-10-05）

### 1. 后端测试修复
- ✅ 修复 `agentConfigService.test.ts` 断言逻辑
- ✅ 适应环境变量过滤机制
- ✅ 后端测试通过率：92.7% (115/124)

### 2. TypeScript错误修复
- ✅ 修复 `Toast.tsx` useEffect返回类型错误
- ✅ 提交代码到Git仓库

### 3. 文档更新
- ✅ 更新 `backend/ENV_TEMPLATE.txt`
  - 添加 `FASTGPT_API_KEY_3` 说明
  - 添加 `DASHSCOPE_API_KEY` 配置
  - 明确Redis为可选配置
- ✅ 创建 `docs/ENVIRONMENT-VARIABLES.md` 完整配置指南

---

## 🎯 本周待办事项

### 优先级P0（必须完成）

#### 1. Three.js导入问题修复 🔴
**文件**：
- `frontend/src/components/cad/CadViewer.tsx`
- `frontend/src/components/cad/CadViewerEnhanced.tsx`

**问题**：
```typescript
// 错误的导入方式
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// 正确的导入方式（Three.js r150+）
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

**解决方案**：
1. 检查项目中Three.js版本
2. 根据版本更新导入路径：
   - Three.js < r150: 使用 `three/examples/jsm/...`
   - Three.js >= r150: 使用 `three/addons/...`
3. 更新所有相关导入

**预计时间**：2小时

---

#### 2. CircleGeometry.vertices问题修复 🔴
**文件**：
- `frontend/src/components/cad/CadViewerEnhanced.tsx` (行261, 276)

**问题**：
```typescript
// 错误：Three.js r125+ 移除了 .vertices 属性
circleGeometry.vertices.push(new THREE.Vector3(x, y, 0));

// 正确：使用 BufferGeometry
const positions = [];
positions.push(x, y, 0);
circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
```

**解决方案**：
1. 重构圆形绘制逻辑，使用 `BufferGeometry`
2. 更新所有使用 `.vertices` 的代码
3. 测试圆形渲染功能

**预计时间**：3小时

---

#### 3. 清理未使用的导入和变量 🟡
**文件**：
- `frontend/src/components/common/ErrorBoundary.tsx`
- `frontend/src/examples/CadChatExample.tsx`
- `frontend/src/components/cad/CadViewer.tsx`
- `frontend/src/components/cad/CadViewerEnhanced.tsx`

**任务**：
- 移除未使用的导入
- 重命名未使用的变量为 `_variableName`
- 确保通过ESLint检查

**预计时间**：1小时

---

### 优先级P1（本周完成）

#### 4. 前端单元测试补充 🟢

**目标**：为关键组件添加单元测试

##### 4.1 Toast组件测试
**文件**：`frontend/src/components/common/__tests__/Toast.test.tsx`

**测试用例**：
```typescript
describe('Toast Component', () => {
  it('应该显示成功提示', () => {
    // 测试 success toast
  });
  
  it('应该显示错误提示', () => {
    // 测试 error toast
  });
  
  it('应该自动关闭', () => {
    // 测试 auto-dismiss
  });
  
  it('应该支持手动关闭', () => {
    // 测试 manual close
  });
});
```

**预计时间**：2小时

---

##### 4.2 ErrorBoundary组件测试
**文件**：`frontend/src/components/common/__tests__/ErrorBoundary.test.tsx`

**测试用例**：
```typescript
describe('ErrorBoundary Component', () => {
  it('应该捕获子组件错误', () => {
    // 测试错误捕获
  });
  
  it('应该显示错误UI', () => {
    // 测试 fallback UI
  });
  
  it('应该支持重试', () => {
    // 测试 retry 功能
  });
  
  it('应该记录错误日志', () => {
    // 测试错误日志
  });
});
```

**预计时间**：2小时

---

##### 4.3 CAD组件测试
**文件**：`frontend/src/components/cad/__tests__/CadViewer.test.tsx`

**测试用例**：
```typescript
describe('CadViewer Component', () => {
  it('应该正确初始化Three.js场景', () => {
    // 测试场景初始化
  });
  
  it('应该渲染DXF实体', () => {
    // 测试实体渲染
  });
  
  it('应该响应窗口大小变化', () => {
    // 测试响应式
  });
  
  it('应该支持实体点击事件', () => {
    // 测试交互
  });
});
```

**预计时间**：3小时

---

#### 5. 前端集成测试补充 🟢

**目标**：补充CAD功能端到端测试

##### 5.1 CAD上传测试
**文件**：`tests/e2e/cad-upload.spec.ts`

**测试场景**：
```typescript
test('CAD文件上传流程', async ({ page }) => {
  // 1. 上传DXF文件
  // 2. 验证文件解析
  // 3. 验证3D渲染
  // 4. 验证实体列表
});
```

**预计时间**：2小时

---

##### 5.2 CAD操作测试
**文件**：`tests/e2e/cad-operations.spec.ts`

**测试场景**：
```typescript
test('CAD快捷操作', async ({ page }) => {
  // 1. 测试添加线段
  // 2. 测试添加圆形
  // 3. 测试删除实体
  // 4. 测试撤销/重做
});
```

**预计时间**：2小时

---

## 📊 本周进度跟踪

| 任务 | 优先级 | 预计时间 | 实际时间 | 状态 |
|------|--------|----------|----------|------|
| Three.js导入修复 | P0 | 2h | - | 待开始 |
| CircleGeometry修复 | P0 | 3h | - | 待开始 |
| 清理未使用代码 | P0 | 1h | - | 待开始 |
| Toast单元测试 | P1 | 2h | - | 待开始 |
| ErrorBoundary单元测试 | P1 | 2h | - | 待开始 |
| CAD组件单元测试 | P1 | 3h | - | 待开始 |
| CAD上传集成测试 | P1 | 2h | - | 待开始 |
| CAD操作集成测试 | P1 | 2h | - | 待开始 |

**总计**：17小时

---

## 🎯 成功标准

### 代码质量
- ✅ 所有TypeScript错误修复
- ✅ ESLint检查通过（0 warnings）
- ✅ 前端单元测试覆盖率 > 70%
- ✅ 所有E2E测试通过

### 功能验证
- ✅ CAD文件上传和渲染正常
- ✅ CAD快捷操作功能正常
- ✅ Three.js 3D渲染无错误
- ✅ 所有交互功能正常

---

## 📝 每日检查清单

### 开发前
- [ ] 拉取最新代码 `git pull`
- [ ] 安装依赖 `npm install`
- [ ] 启动开发服务器 `npm run dev`
- [ ] 检查环境变量配置

### 开发中
- [ ] 遵循TypeScript严格模式
- [ ] 添加必要的注释
- [ ] 编写对应的测试用例
- [ ] 运行本地测试 `npm test`

### 开发后
- [ ] 运行完整测试套件
- [ ] 运行ESLint检查
- [ ] 提交代码前review
- [ ] 编写清晰的commit message

---

## 🚀 下周预告（2025-10-12至2025-10-18）

### 计划任务
1. **API文档完善**
   - 使用Swagger/OpenAPI规范
   - 生成交互式API文档
   - 添加请求/响应示例

2. **性能优化第一阶段**
   - 前端代码分割
   - 组件懒加载
   - 图片资源优化

3. **监控和日志改进**
   - 集成前端错误监控
   - 优化日志格式
   - 添加性能指标采集

---

## 📞 联系方式

如有问题或需要协助，请联系：
- 技术负责人：[待填写]
- 项目经理：[待填写]

---

**最后更新**：2025-10-05 15:30
**下次更新**：2025-10-06 09:00
