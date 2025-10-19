# .specify/ 目录说明

本目录存放项目规范和标准文档，是LLMChat项目治理体系的核心。

---

##  目录结构

```
.specify/
 memory/
    constitution.md          # 项目宪章（核心原则、质量标准）
 standards/
     document-structure.md    # 文档职责边界定义
     ssot-index.md            # 单一真实来源索引
     change-process.md        # 文档变更流程规范
```

---

##  核心文档

### memory/constitution.md - 项目宪章
**地位**: 最高权威，所有规范的基础  
**内容**: 
- 5大核心原则（质量、安全、真实环境、文档即代码、渐进增强）
- 开发流程规范
- 质量门禁标准
- 技术债务管理

**修订**: 需要团队2/3投票通过

---

##  标准文档（standards/）

### document-structure.md - 文档职责边界
**作用**: 定义每个文档的职责范围和禁止内容  
**适用**: 所有文档编写者

### ssot-index.md - 单一真实来源索引
**作用**: 索引所有权威规范文档及其负责的领域  
**适用**: 所有开发者和文档编写者

### change-process.md - 文档变更流程
**作用**: 规范文档变更的标准流程（6步）  
**适用**: 所有需要修改规范文档的人员

---

##  使用指南

### 新成员入职
1. 必读：`memory/constitution.md`（了解项目核心原则）
2. 必读：`standards/document-structure.md`（了解文档体系）
3. 参考：`standards/ssot-index.md`（查找规范来源）

### 文档修改
1. 查看：`standards/change-process.md`（了解变更流程）
2. 检查：变更影响矩阵（确定需要同步的文档）
3. 验证：运行`npm run validate:docs`

### 快速查找
- **查项目原则？**  `memory/constitution.md`
- **查文档规范？**  `standards/document-structure.md`
- **查技术细节来源？**  `standards/ssot-index.md`
- **如何修改文档？**  `standards/change-process.md`

---

##  重要提示

### 修改原则
-  所有技术实现细节应在`.claude/specs/llmchat-platform/technical-details.md`
-  所有术语定义应在`.claude/specs/llmchat-platform/terminology.md`
-  本目录仅存放**治理规范**和**项目原则**
-  禁止在此目录存放实现细节或任务清单

### 权威性
- **constitution.md**: 最高权威，修订需团队投票
- **standards/*.md**: 标准规范，修订需架构团队批准
- **其他规范**: 按document-governance.md流程修订

---

**维护者**: LLMChat架构团队  
**版本**: 1.0.0  
**创建日期**: 2025-10-16
