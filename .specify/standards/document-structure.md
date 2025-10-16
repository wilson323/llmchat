# 规范文档结构标准

## 文档职责边界

### requirements.md - 需求规范
**职责**: WHAT（做什么）
**内容**:
- 功能需求（FR-xxx）
- 非功能需求（NFR-xxx）
- 用户故事（US-xxx）
- 验收标准
- 性能指标（必须量化）

**禁止内容**:
- 实现细节（如具体代码）
- 工具选择（在technical-details.md）
- 任务分解（在tasks.md）

### design.md / phase1-implementation-guide.md - 设计方案
**职责**: HOW（怎么做）
**内容**:
- 系统架构图
- 模块设计
- 接口定义
- 技术选型理由
- 数据模型

**禁止内容**:
- 需求描述（已在requirements.md）
- 任务清单（已在tasks.md）

### tasks.md - 任务清单
**职责**: WHO + WHEN（谁做、何时做）
**内容**:
- 任务分解
- 依赖关系
- 时间估算
- 优先级
- 验收标准

**禁止内容**:
- 需求定义（已在requirements.md）
- 技术实现细节（引用technical-details.md）

### technical-details.md - 技术规范（单一真实来源）
**职责**: 技术参数的权威定义
**内容**:
- JWT配置参数
- 密码哈希参数
- 数据库连接参数
- 缓存TTL配置
- 性能阈值

**引用方式**: 其他文档使用`[详见技术规范](technical-details.md#section)`

### terminology.md - 术语表（单一真实来源）
**职责**: 术语的权威定义
**内容**:
- 中英术语对照表
- 代码命名规范
- 状态术语定义

**引用方式**: 文档首次使用术语时引用此表

### api-error-codes.md - 错误代码（单一真实来源）
**职责**: 错误代码的权威定义
**内容**:
- 错误响应格式
- HTTP状态码映射
- 错误代码清单
- 错误处理最佳实践

**引用方式**: 代码中使用错误代码时参考此文档

---

## 文档同步规则

### 变更影响矩阵

| 修改文档 | 必须检查 | 原因 |
|---------|---------|------|
| requirements.md | design.md, tasks.md | 需求变更影响设计和任务 |
| design.md | tasks.md | 设计调整可能改变任务分解 |
| technical-details.md | 所有引用它的文档 | 技术参数是单一来源 |
| terminology.md | 所有文档 | 术语变更影响全局 |

### 同步检查点

**阶段1: 需求确认后**
- [ ] requirements.md完成
- [ ] design.md设计对齐
- [ ] tasks.md覆盖100%需求

**阶段2: 设计评审后**
- [ ] design.md锁定
- [ ] tasks.md依赖关系明确
- [ ] 技术选型写入technical-details.md

**阶段3: 开发开始前**
- [ ] 所有文档版本号同步
- [ ] 所有引用链接有效
- [ ] 运行自动化验证工具

---

## 质量门禁

### 文档提交前检查
- [ ] 技术细节未重复（必须引用technical-details.md）
- [ ] 术语使用一致（参考terminology.md）
- [ ] 错误代码已定义（参考api-error-codes.md）
- [ ] 模糊术语已量化（如"快速"  "P95<200ms"）
- [ ] 运行`npm run validate:docs`通过

### PR合并前检查
- [ ] GitHub Actions文档验证通过
- [ ] 至少1人审查文档一致性
- [ ] 变更影响已评估
- [ ] 相关文档已同步更新

---

**版本**: 1.0.0  
**创建日期**: 2025-10-16  
**维护者**: LLMChat架构团队
