# Qoder开发工具包

Qoder是一个集成Speckit规范的开发工具包，旨在帮助开发者遵循LLMChat项目的开发规则和质量标准。

## 📁 目录结构

```
.qoder/
├── config.json          # Qoder配置文件
├── development-rules.md # 开发规则文档（集成Speckit）
├── rules-validator.js   # 规则验证脚本
└── README.md           # 本文件
```

## 🚀 快速开始

### 1. 验证项目合规性

运行以下命令验证项目是否符合Qoder和Speckit开发规则：

```bash
# 验证所有规则
pnpm run qoder:validate

# 仅验证基本规则
pnpm run qoder:validate:rules

# 仅验证Speckit文档
pnpm run qoder:validate:speckit
```

### 2. 查看开发规则

查看集成Speckit的开发规则：

```bash
# 在编辑器中打开开发规则文档
code .qoder/development-rules.md
```

## 📋 开发规则概览

### TypeScript架构规范

- 单一真理源原则
- 类型/值严格分离
- P0错误零容忍政策
- UI组件开发规范

### Speckit规范集成

- 文档职责边界（需求、设计、任务）
- 单一真实来源原则
- 文档同步规则
- 自动化验证工具

### 企业级代码安全准则

- 严格禁止危险操作（正则表达式替换、脚本批量修改等）
- 安全替代方案（AST优先修复、手动代码修改等）
- 安全检查和验证机制

### 质量门禁

- TypeScript编译零错误
- 测试覆盖率要求
- 代码审查标准

## 🛠️ 配置说明

### config.json

主要配置文件，包含：

1. **developmentRules**: 开发规则配置
   - TypeScript规则
   - Speckit集成规则
   - 企业级安全准则

2. **qualityGates**: 质量门禁配置
   - TypeScript P0错误定义
   - 测试覆盖率要求

3. **codeStandards**: 代码标准
   - 命名规范
   - 组件模式

4. **automation**: 自动化配置
   - 预提交钩子
   - CI集成

## 🧪 验证工具

### rules-validator.js

自动验证脚本，检查：

1. TypeScript架构规范合规性
2. Speckit文档结构完整性
3. 企业级安全准则合规性
4. 质量门禁配置
5. 代码标准配置
6. 自动化配置

## 📚 相关文档

- [开发规则文档](development-rules.md) - 详细的开发规则说明
- [Speckit规范](../.specify/) - Speckit规范文档
- [团队技术宪法](../TEAM_TECHNICAL_CONSTITUTION.md) - 团队技术原则
- [TypeScript架构标准](../frontend/TYPESCRIPT_ARCHITECTURE_STANDARDS.md) -
  TypeScript架构标准
- [项目配置指南](../CLAUDE.md) - 项目配置和开发指南

## 🎯 最佳实践

### 开发流程

1. **开始开发前**
   - 运行 `pnpm run qoder:validate` 确保环境合规
   - 查看 `development-rules.md` 了解规则要求

2. **编码过程中**
   - 遵循TypeScript架构规范
   - 保持Speckit文档同步
   - 运行质量检查命令
   - 严格遵守企业级安全准则

3. **提交代码前**
   - 运行 `pnpm run qoder:validate` 确保合规
   - 运行所有测试
   - 确保TypeScript编译无错误
   - 确保无企业级安全违规

### 文档维护

1. **需求变更**
   - 更新 `.claude/specs/llmchat-platform/requirements.md`
   - 同步更新设计和任务文档
   - 运行验证工具确保一致性

2. **技术细节变更**
   - 仅更新 `.claude/specs/llmchat-platform/technical-details.md`
   - 其他文档通过引用方式使用技术细节

### 企业级安全实践

1. **代码修改**
   - 所有源代码修改必须手动进行
   - 禁止使用脚本批量修改代码
   - 禁止使用正则表达式替换代码

2. **安全替代方案**
   - 使用AST优先修复方法
   - 使用TypeScript编译器API进行精确操作
   - 使用专门的配置解析库

## ⚠️ 注意事项

1. **禁止绕过验证**
   - 所有代码提交必须通过规则验证
   - 不得手动修改验证脚本绕过检查

2. **保持同步**
   - Speckit文档变更后立即运行验证
   - 定期更新Qoder配置以匹配项目变化

3. **及时反馈**
   - 发现规则问题及时反馈给架构团队
   - 提出规则改进建议

4. **企业级安全**
   - 严格遵守企业级代码安全准则
   - 禁止任何危险操作
   - 所有代码修改必须手动进行

---

**维护者**: LLMChat开发团队  
**版本**: 1.0.0  
**创建日期**: 2025-10-19
