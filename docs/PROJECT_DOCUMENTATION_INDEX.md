# 项目文档索引 - LLMChat

> 📚 统一文档体系 - 确保代码与文档一致性
> 
> **版本**: v2.0.0
> **最后更新**: 2025-10-19
> **维护人**: 开发团队

## 📖 核心文档体系

### 1️⃣ 项目配置与快速开始

| 文档 | 描述 | 路径 |
|------|------|------|
| **CLAUDE.md** | Claude Code AI助手配置指南 | `/CLAUDE.md` |
| **GEMINI.md** | Gemini AI助手配置指南 | `/GEMINI.md` |
| **README.md** | 项目主文档 | `/README.md` |
| **START.md** | 快速开始指南 | `/START.md` |
| **CONFIG_QUICK_START.md** | 配置快速开始 | `/CONFIG_QUICK_START.md` |

### 2️⃣ TypeScript开发规范（前端）

| 文档 | 描述 | 路径 |
|------|------|------|
| **TYPESCRIPT_DEVELOPMENT_STANDARDS.md** | ⭐ TypeScript开发标准（主规范） | `/frontend/TYPESCRIPT_DEVELOPMENT_STANDARDS.md` |
| **TYPESCRIPT_ARCHITECTURE_STANDARDS.md** | TypeScript架构标准 | `/frontend/TYPESCRIPT_ARCHITECTURE_STANDARDS.md` |
| **TYPESCRIPT_SECURITY_STANDARDS.md** | TypeScript安全标准 | `/frontend/TYPESCRIPT_SECURITY_STANDARDS.md` |
| **UI_COMPONENT_ARCHITECTURE_STANDARDS.md** | UI组件架构标准 | `/frontend/UI_COMPONENT_ARCHITECTURE_STANDARDS.md` |

### 3️⃣ 质量保证体系

| 文档 | 描述 | 路径 |
|------|------|------|
| **QUALITY_SYSTEM_GUIDE.md** | 质量保证系统指南 | `/QUALITY_SYSTEM_GUIDE.md` |
| **TESTING_BEST_PRACTICES_GUIDE.md** | 测试最佳实践 | `/TESTING_BEST_PRACTICES_GUIDE.md` |
| **TEST_QUALITY_ASSURANCE_SYSTEM.md** | 测试质量保证系统 | `/TEST_QUALITY_ASSURANCE_SYSTEM.md` |

### 4️⃣ 安全规范

| 文档 | 描述 | 路径 |
|------|------|------|
| **SECURITY_GUIDE.md** | 安全指南 | `/SECURITY_GUIDE.md` |
| **SECURITY_CHECKLIST.md** | 安全检查清单 | `/SECURITY_CHECKLIST.md` |
| **SECURITY_BEST_PRACTICES.md** | 安全最佳实践 | `/SECURITY_BEST_PRACTICES.md` |

### 5️⃣ CI/CD与部署

| 文档 | 描述 | 路径 |
|------|------|------|
| **README_CI_CD.md** | CI/CD配置指南 | `/README_CI_CD.md` |
| **CONTINUOUS_INTEGRATION_RECOMMENDATIONS.md** | 持续集成建议 | `/CONTINUOUS_INTEGRATION_RECOMMENDATIONS.md` |
| **TROUBLESHOOTING-WINDOWS.md** | Windows环境故障排查 | `/TROUBLESHOOTING-WINDOWS.md` |

### 6️⃣ 架构设计文档

| 文档 | 描述 | 路径 |
|------|------|------|
| **UNIFIED_PROJECT_MANAGEMENT_SYSTEM.md** | 统一项目管理系统 | `/UNIFIED_PROJECT_MANAGEMENT_SYSTEM.md` |
| **FRONTEND_PERFORMANCE_OPTIMIZATION.md** | 前端性能优化 | `/FRONTEND_PERFORMANCE_OPTIMIZATION.md` |
| **TYPE_FILE_ARCHITECTURE_DIAGRAM.md** | 类型文件架构图 | `/TYPE_FILE_ARCHITECTURE_DIAGRAM.md` |
| **TYPE_FILE_REFACTOR_PLAN.md** | 类型文件重构计划 | `/TYPE_FILE_REFACTOR_PLAN.md` |

### 7️⃣ 团队协作规范

| 文档 | 描述 | 路径 |
|------|------|------|
| **TEAM_TECHNICAL_CONSTITUTION.md** | 团队技术规范 | `/TEAM_TECHNICAL_CONSTITUTION.md` |
| **ROOT_CAUSE_SOLUTION_RULES.md** | 根源性解决方案规则 | `/ROOT_CAUSE_SOLUTION_RULES.md` |
| **REFACTOR_EXECUTION_GUIDE.md** | 重构执行指南 | `/REFACTOR_EXECUTION_GUIDE.md` |

## 📦 归档文档（历史参考）

### TypeScript修复历史

**路径**: `/docs/archive/typescript-fixes/`

包含所有TypeScript错误修复过程的历史文档，包括：
- 阶段性修复报告（PHASE_*.md）
- 完成报告（*_COMPLETION_REPORT.md）
- 修复策略和进度跟踪文档

### 前端开发历史

**路径**: `/docs/archive/frontend-docs/`

包含前端开发过程的历史文档。

## 🗂️ 文档使用指南

### 新开发者入门顺序

1. **快速开始**: 阅读 `README.md` 和 `START.md`
2. **环境配置**: 阅读 `CLAUDE.md` 或 `GEMINI.md`（根据使用的AI助手）
3. **TypeScript规范**: 阅读 `frontend/TYPESCRIPT_DEVELOPMENT_STANDARDS.md`
4. **质量标准**: 阅读 `QUALITY_SYSTEM_GUIDE.md`
5. **安全规范**: 阅读 `SECURITY_GUIDE.md`

### 日常开发参考

- **编码时**: 参考 `TYPESCRIPT_DEVELOPMENT_STANDARDS.md`
- **组件开发**: 参考 `UI_COMPONENT_ARCHITECTURE_STANDARDS.md`
- **测试编写**: 参考 `TESTING_BEST_PRACTICES_GUIDE.md`
- **安全检查**: 参考 `SECURITY_CHECKLIST.md`
- **CI/CD配置**: 参考 `README_CI_CD.md`

### 架构决策参考

- **系统设计**: `UNIFIED_PROJECT_MANAGEMENT_SYSTEM.md`
- **类型架构**: `TYPE_FILE_ARCHITECTURE_DIAGRAM.md`
- **性能优化**: `FRONTEND_PERFORMANCE_OPTIMIZATION.md`
- **重构指南**: `REFACTOR_EXECUTION_GUIDE.md`

## 📝 文档维护规范

### 更新频率

- **配置文档**: 每次配置变更时更新
- **规范文档**: 发现新模式或问题时更新
- **架构文档**: 重大架构调整时更新
- **归档文档**: 仅保留，不再更新

### 文档命名规范

```
[类型]_[主题]_[版本].md

类型：
- README: 介绍性文档
- GUIDE: 指南类文档
- STANDARDS: 规范类文档
- CHECKLIST: 检查清单
- REPORT: 报告类文档（应归档）
- PLAN: 计划类文档
```

### 文档废弃流程

1. 确认文档已过期或被替代
2. 移动到 `docs/archive/[分类]/`
3. 更新本索引文件
4. 在新文档中注明替代关系

## 🔄 文档一致性检查

### 每月检查清单

- [ ] 所有核心文档版本号一致
- [ ] 配置示例与实际代码同步
- [ ] API文档与代码实现匹配
- [ ] 安全规范符合最新标准
- [ ] 归档目录整理有序

### 自动化检查（TODO）

- [ ] 文档链接有效性检查
- [ ] 代码示例可编译性验证
- [ ] 版本号一致性检查
- [ ] 过期文档自动归档提醒

## 📌 重要提示

⚠️ **禁止在根目录创建临时文档**
- 所有临时分析文档应在 `docs/temp/` 目录创建
- 完成后立即删除或归档

⚠️ **避免文档冗余**
- 同一主题只保留一个权威版本
- 旧版本及时归档
- 更新时间和版本号

⚠️ **保持代码与文档同步**
- 代码变更必须同步更新文档
- PR审查包含文档审查
- CI/CD集成文档检查（未来）

---

**文档维护责任**:
- 所有开发者有责任维护相关文档
- 每次PR必须检查文档一致性
- 定期进行文档清理和归档

