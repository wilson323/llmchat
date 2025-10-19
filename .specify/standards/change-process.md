# 文档变更流程规范

## 变更前检查清单

### 第1步: 确定变更范围

**问题清单**:
- [ ] 这是需求变更、设计调整还是任务修正？
- [ ] 需要修改哪些文档？
- [ ] 是否涉及技术细节变更？
- [ ] 是否引入新术语？

---

### 第2步: 影响分析

**使用变更影响矩阵**:

| 如果修改... | 必须检查... | 检查内容 |
|------------|-----------|---------|
| requirements.md | phase1-implementation-guide.md, tasks.md | 需求变更是否影响设计和任务 |
| phase1-implementation-guide.md | tasks.md | 设计调整是否改变任务分解 |
| tasks.md | requirements.md | 任务覆盖是否仍然完整 |
| technical-details.md | **所有引用它的文档** | 技术参数变更的全局影响 |
| terminology.md | **所有文档** | 术语变更需全局替换 |
| api-error-codes.md | 所有API相关文档和代码 | 错误代码变更影响API |

---

### 第3步: 执行变更

#### 技术细节变更流程

**场景**: 修改JWT过期时间从1小时改为2小时

1. **修改权威来源**:
   -  编辑 `technical-details.md`
   - 更新: `过期时间: 1小时`  `过期时间: 2小时`

2. **无需修改其他文档**（因为都是引用）:
   - requirements.md: 引用未变
   - tasks.md: 引用未变

3. **仅需更新代码**:
   - backend/src/services/JWTService.ts

**节省工作量**: 70%（只需改1处vs原来3处）

---

#### 术语变更流程

**场景**: 将"会话"统一改为"对话"

1. **修改权威来源**:
   -  编辑 `terminology.md`
   - 更新术语表

2. **全局查找替换**:
   ```bash
   # 使用VSCode全局搜索
   搜索: "会话"
   替换: "对话"
   范围: .claude/specs/**/*.md
   ```

3. **验证一致性**:
   ```bash
   npm run validate:docs:consistency
   ```

---

### 第4步: 验证变更

#### 自动化验证
```bash
# 运行所有验证
npm run validate:docs

# 或单独运行
npm run validate:docs:consistency   # 一致性
npm run validate:docs:coverage      # 覆盖率
npm run validate:docs:references    # 引用链接
```

#### 人工审查
- [ ] 变更在文档职责范围内
- [ ] 无新增重复内容
- [ ] 术语使用符合terminology.md
- [ ] 技术细节在technical-details.md（或已引用）
- [ ] 版本号已更新

---

### 第5步: 提交变更

#### Git工作流
```bash
# 1. 添加变更
git add .claude/specs/llmchat-platform/*.md .specify/**/*.md

# 2. 提交（自动触发Pre-commit Hook验证）
git commit -m "docs: 修改XXX规范

- 变更内容描述
- 影响范围
- 验证结果
"

# 3. 推送（自动触发GitHub Actions）
git push
```

#### Commit Message规范
```
docs(specs): 简短描述变更（50字符内）

详细说明：
- 变更内容：...
- 变更原因：...
- 影响范围：...
- 验证方式：...

相关文档：
- requirements.md (新增NFR-007)
- tasks.md (新增T050)
```

---

### 第6步: PR审查

#### PR创建
- 使用 `.github/PULL_REQUEST_TEMPLATE.md`
- 填写所有检查清单
- 附上自动化验证结果

#### 审查重点
- [ ] GitHub Actions全部通过
- [ ] 变更影响已分析
- [ ] 相关文档已同步
- [ ] 无新增重复内容
- [ ] 术语使用一致

---

## 紧急变更流程

**适用场景**: 生产环境问题需要立即修复

**简化流程**:
1. 直接修改文档
2. 提交时使用 `git commit --no-verify`（跳过Hook）
3. 事后24小时内补充完整验证和文档同步

**标记**: Commit message加 `[HOTFIX]` 前缀

---

**版本**: 1.0.0  
**创建日期**: 2025-10-16  
**维护者**: LLMChat流程团队
