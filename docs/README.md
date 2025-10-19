# 项目文档索引

本目录包含LLMChat项目的所有技术文档和开发指南。文档按功能和重要性组织，便于快速查找和参考。

## 📚 核心文档

### 快速开始
- **[CONFIG_QUICK_START.md](CONFIG_QUICK_START.md)** - 快速配置指南
- **[QUICK_START_GUIDE.md](QUICK_START_GUIDE.md)** - 项目快速启动指南

### 开发规范
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - 完整开发规范和最佳实践
- **[CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md)** - 代码审查完整指南
- **[CODE_QUALITY_STANDARDS.md](CODE_QUALITY_STANDARDS.md)** - 代码质量标准

### 项目文档
- **[PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md)** - 项目规格说明
- **[AGENTS_ARCHITECTURE.md](AGENTS_ARCHITECTURE.md)** - 智能体架构设计
- **[AGENT_GUIDE.md](AGENT_GUIDE.md)** - 智能体使用指南
- **[TASK_LIST.md](TASK_LIST.md)** - 项目任务列表

### 质量保证
- **[QUALITY_SYSTEM_GUIDE.md](QUALITY_SYSTEM_GUIDE.md)** - 质量体系指南
- **[QUALITY_ASSURANCE_IMPLEMENTATION_COMPLETE.md](QUALITY_ASSURANCE_IMPLEMENTATION_COMPLETE.md)** - 质量保证实施完成报告

### 测试文档
- **[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)** - 快速测试指南
- **[TEST-LOGIN-FLOW.md](TEST-LOGIN-FLOW.md)** - 登录流程测试

### 故障排除
- **[troubleshooting/BACKEND_STARTUP_DIAGNOSTIC.md](troubleshooting/BACKEND_STARTUP_DIAGNOSTIC.md)** - 后端启动诊断
- **[TROUBLESHOOTING-WINDOWS.md](TROUBLESHOOTING-WINDOWS.md)** - Windows环境故障排除

### 性能优化
- **[FRONTEND_PERFORMANCE_OPTIMIZATION.md](FRONTEND_PERFORMANCE_OPTIMIZATION.md)** - 前端性能优化

## 📂 文档分类

### 按功能分类

#### 开发相关
- 开发规范和最佳实践
- 代码审查指南
- 质量标准

#### 配置相关
- 快速配置指南
- 环境配置说明

#### 测试相关
- 测试策略
- 测试指南
- 登录流程测试

#### 架构相关
- 项目规格
- 智能体架构
- 系统设计

### 按重要性分类

#### 必读文档（P0）
1. DEVELOPMENT_GUIDE.md - 开发必读
2. CODE_REVIEW_GUIDE.md - 代码审查必读
3. CONFIG_QUICK_START.md - 配置必读
4. QUICK_START_GUIDE.md - 启动必读

#### 重要文档（P1）
1. CODE_QUALITY_STANDARDS.md
2. PROJECT_SPECIFICATION.md
3. AGENTS_ARCHITECTURE.md
4. QUALITY_SYSTEM_GUIDE.md

#### 参考文档（P2）
1. 故障排除文档
2. 性能优化文档
3. 其他技术文档

## 📦 归档文档

历史文档和已完成阶段的报告归档在 `archive/` 目录中：

### archive/2025-phase2/
此目录包含2025年Phase 2阶段的所有完成报告：
- 配置统一相关文档
- 执行报告和完成总结
- E2E测试相关报告
- Phase完成报告（P0, P1, P2）
- 代码审计和清理日志
- ESLint优化相关报告

**归档策略**: 
- 已完成阶段的报告定期归档
- 保持主文档目录整洁
- 归档文档按年份和阶段组织
- 重要历史参考文档保留可访问性

## 🔍 文档搜索指南

### 如何快速找到所需文档？

1. **开发问题** → 查看 `DEVELOPMENT_GUIDE.md`
2. **代码审查** → 查看 `CODE_REVIEW_GUIDE.md`
3. **配置问题** → 查看 `CONFIG_QUICK_START.md`
4. **启动问题** → 查看 `QUICK_START_GUIDE.md`
5. **故障排除** → 查看 `troubleshooting/` 目录
6. **历史报告** → 查看 `archive/` 目录

### 关键词索引

- **TypeScript**: DEVELOPMENT_GUIDE.md
- **React**: DEVELOPMENT_GUIDE.md
- **测试**: QUICK_TEST_GUIDE.md, TEST-LOGIN-FLOW.md
- **性能**: FRONTEND_PERFORMANCE_OPTIMIZATION.md
- **智能体**: AGENTS_ARCHITECTURE.md, AGENT_GUIDE.md
- **质量**: QUALITY_SYSTEM_GUIDE.md, CODE_QUALITY_STANDARDS.md

## 📝 文档维护

### 更新原则
- 代码变更同步更新相关文档
- 新功能需要添加文档说明
- 定期review和更新文档内容
- 保持文档的准确性和及时性

### 文档规范
- 使用Markdown格式
- 包含清晰的标题层级
- 提供代码示例
- 添加目录和索引
- 标注最后更新时间

### 归档规则
- 每个阶段完成后归档相关报告
- 归档文档按时间和阶段组织
- 保留重要历史文档的可访问性
- 定期清理过时的临时文档

## 🔗 相关链接

- **项目根目录**: [../README.md](../README.md)
- **后端文档**: [../backend/README.md](../backend/README.md)
- **前端文档**: [../frontend/README.md](../frontend/README.md)
- **配置目录**: [../config/](../config/)

## 📞 获取帮助

如果您在文档中找不到所需信息：
1. 检查归档文档是否有相关历史信息
2. 查看项目Wiki（如有）
3. 联系项目维护团队
4. 提交文档改进建议

---

**文档组织原则**:
- 核心文档放在docs根目录
- 历史文档归档到archive子目录
- 专题文档放在对应子目录（如troubleshooting）
- 保持目录结构清晰简洁

*最后更新: 2025年10月*
*维护者: 技术团队*
