# 项目文档索引

本目录包含LLMChat项目的所有技术文档和开发指南。文档按功能和重要性组织，便于快速查找和参考。

> 📖 **文档总览**: 查看 [../DOCUMENT_INDEX.md](../DOCUMENT_INDEX.md) 获取完整的文档导航

## 📚 核心文档

### 开发规范
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - 完整开发规范和最佳实践 ⭐⭐⭐⭐⭐
- **[CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md)** - 代码审查完整指南 ⭐⭐⭐⭐
- **[CODE_QUALITY_STANDARDS.md](CODE_QUALITY_STANDARDS.md)** - 代码质量标准 ⭐⭐⭐⭐

### 部署和安全
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - 部署指南 ⭐⭐⭐⭐
- **[SECURITY_GUIDE.md](SECURITY_GUIDE.md)** - 安全指南 ⭐⭐⭐⭐⭐

### 项目分析
- **[GLOBAL_CONSISTENCY_ANALYSIS.md](GLOBAL_CONSISTENCY_ANALYSIS.md)** - 全局一致性深度分析 ⭐⭐⭐⭐⭐

### 架构文档
- **[PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md)** - 项目规格说明 ⭐⭐⭐⭐
- **[AGENTS_ARCHITECTURE.md](AGENTS_ARCHITECTURE.md)** - 智能体架构设计 ⭐⭐⭐⭐
- **[AGENT_GUIDE.md](AGENT_GUIDE.md)** - 智能体使用指南 ⭐⭐⭐
- **[DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md)** - 数据库迁移指南 ⭐⭐⭐⭐
- **[ARCHITECTURE_DATA_STORAGE.md](ARCHITECTURE_DATA_STORAGE.md)** - 数据存储架构 ⭐⭐⭐⭐

### API文档
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - API接口文档 ⭐⭐⭐⭐

### 用户文档
- **[USER_GUIDE.md](USER_GUIDE.md)** - 用户使用指南 ⭐⭐⭐

### 故障排除
- **[troubleshooting/](troubleshooting/)** - 故障排除专题文档

## 📂 文档分类

### 按重要性分类

#### 必读文档（P0）⭐⭐⭐⭐⭐
1. **[../CONSTITUTION.md](../CONSTITUTION.md)** - 项目宪法（管理原则）
2. **[../CLAUDE.md](../CLAUDE.md)** - AI助手开发规范
3. **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - 开发规范
4. **[CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md)** - 代码审查

#### 重要文档（P1）⭐⭐⭐⭐
1. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - 部署指南
2. **[SECURITY_GUIDE.md](SECURITY_GUIDE.md)** - 安全指南
3. **[CODE_QUALITY_STANDARDS.md](CODE_QUALITY_STANDARDS.md)** - 质量标准
4. **[PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md)** - 项目规格
5. **[AGENTS_ARCHITECTURE.md](AGENTS_ARCHITECTURE.md)** - 智能体架构
6. **[DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md)** - 数据库迁移

#### 参考文档（P2）⭐⭐⭐
1. **[AGENT_GUIDE.md](AGENT_GUIDE.md)** - 智能体使用
2. **[USER_GUIDE.md](USER_GUIDE.md)** - 用户指南
3. **[troubleshooting/](troubleshooting/)** - 故障排除
4. **[archive/](archive/)** - 历史归档

## 📦 归档文档

历史文档和已完成阶段的报告归档在 `archive/` 目录中：

### archive/2025-11/ ✅ 最新归档
**归档内容**:
- 各阶段完成报告（PHASE系列）
- P0任务报告和执行总结
- TypeScript修复报告
- 优化和性能分析报告
- 已整合的安全、测试、配置文档
- 临时执行指令和状态报告

**归档日期**: 2025-11-11

### archive/2025-10/
**归档内容**: Phase 2阶段的历史报告

### archive/frontend-docs/
**归档内容**: TypeScript修复过程文档

**归档策略**: 
- ✅ 已完成阶段的报告立即归档
- ✅ 保持根目录和docs目录整洁
- ✅ 归档文档按年月组织
- ✅ 重要历史文档保留可访问性
- ✅ 内容已整合的文档及时归档

## 🔍 文档搜索指南

### 如何快速找到所需文档？

1. **项目原则** → 查看 `../CONSTITUTION.md`
2. **AI开发配置** → 查看 `../CLAUDE.md`
3. **项目说明** → 查看 `../README.md`
4. **质量体系** → 查看 `../QUALITY_SYSTEM_GUIDE.md`
5. **开发问题** → 查看 `DEVELOPMENT_GUIDE.md`
6. **代码审查** → 查看 `CODE_REVIEW_GUIDE.md`
7. **部署运维** → 查看 `DEPLOYMENT_GUIDE.md`
8. **安全规范** → 查看 `SECURITY_GUIDE.md`
9. **故障排除** → 查看 `troubleshooting/` 目录
10. **历史报告** → 查看 `archive/` 目录

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
