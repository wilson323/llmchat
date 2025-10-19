# LLMChat 文档治理规范 v1.0.0

## 文档职责边界

| 文档 | 职责 | 禁止 |
|------|------|------|
| constitution.md | 原则、治理 | 技术细节 |
| requirements.md | 需求、故事 | 技术实现 |
| design.md | 架构、设计 | 需求、任务 |
| tasks.md | 任务、依赖 | 需求、技术细节 |
| technical-details.md | 技术规范 | 需求、任务 |

## 单一真实来源

 **禁止**重复技术细节
 **正确**通过引用链接

## 变更影响

- 修改 requirements.md  检查 design.md, tasks.md
- 修改 design.md  检查 tasks.md
- 修改 technical-details.md  检查所有引用

## PR检查清单

- [ ] 无重复内容
- [ ] 术语符合 terminology.md
- [ ] 技术细节在 technical-details.md
- [ ] 版本号已更新
- [ ] validate:docs 通过
