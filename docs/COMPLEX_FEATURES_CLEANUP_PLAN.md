# 复杂功能清理计划

## 高优先级清理（已确认未使用）

### 1. Monitoring监控系统 (141KB, 12文件)
- 状态: App.tsx中已禁用
- AdminHome中已显示"已禁用"提示
- 建议: 完全删除monitoring目录

### 2. IAGP智能体治理平台 (35KB, 1文件)
- IAGPDashboard.tsx - 700+行复杂组件
- 无路由配置
- 建议: 删除iagp目录

### 3. Performance性能监控组件
- PerformanceMonitor.tsx (已删除)
- PerformanceDashboard.tsx (monitoring中存在)
- 建议: 删除剩余性能监控代码

## 中优先级评估（需确认）

### 4. Voice语音通话工作区 (29KB)
- VoiceCallWorkspace.tsx
- 有常量定义但无实际配置
- 建议: 如无实际智能体配置，删除

### 5. Product产品预览工作区 (25KB)
- ProductPreviewWorkspace.tsx  
- 有常量定义但无实际配置
- 建议: 如无实际智能体配置，删除

### 6. Workspace工作区 (5KB)
- AgentWorkspace.tsx
- 需检查是否是核心功能

## 低优先级优化

### 7. 代码分割系统简化
- 3个不同的代码分割工具
- componentRegistry注册大量未使用组件
- 建议: 简化为基础懒加载

### 8. CAD文件处理 (95KB)
- CadViewerEnhanced, CadUploadEnhanced等
- 需确认是否是核心业务需求
