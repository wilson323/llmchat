# 单一真实来源索引（SSOT Index）

## 技术实现细节

**权威来源**: `.claude/specs/llmchat-platform/technical-details.md`

**包含内容**:
- JWT配置（算法、过期时间、Payload结构、密钥管理）
- 密码安全（哈希算法、Salt Rounds、强度要求）
- 数据库配置（连接池参数、索引策略、迁移规范）
- 缓存策略（Redis TTL配置、缓存键命名）
- 性能指标（响应时间P50/P95/P99、并发能力）
- 监控配置（Prometheus指标、日志级别、轮转策略）

**引用方式**:
```markdown
JWT配置详见 [技术规范详细说明](technical-details.md#1-认证与安全)
```

---

## 术语定义

**权威来源**: `.claude/specs/llmchat-platform/terminology.md`

**包含内容**:
- 核心术语中英对照（Agent/智能体、Provider/提供商等）
- 代码命名规范（camelCase、PascalCase、UPPER_SNAKE_CASE）
- 状态术语定义（pending、active、inactive、error、done）

**使用规范**:
- 代码中：统一使用英文术语
- 文档中：首次出现使用"术语(Term)"格式
- 禁止混用

---

## API错误代码

**权威来源**: `.claude/specs/llmchat-platform/api-error-codes.md`

**包含内容**:
- 标准错误响应格式
- HTTP状态码使用规范（400, 401, 403, 404, 409, 422, 429, 500, 502, 503）
- 36个错误代码（AUTH_*, USER_*, AGENT_*, CHAT_*, SYS_*, VALIDATION_*）

**引用方式**:
```typescript
// 代码中
throw new ApiError(404, 'AGENT_NOT_FOUND', '智能体不存在');

// 文档中
错误处理参考 [API错误代码](api-error-codes.md)
```

---

## 架构设计

**权威来源**: `.claude/specs/llmchat-platform/phase1-implementation-guide.md`

**包含内容**:
- 系统架构图（Mermaid格式）
- 模块设计和职责
- 接口定义
- 数据模型
- 技术决策理由

---

## 项目原则

**权威来源**: `.specify/memory/constitution.md`

**包含内容**:
- 5大核心原则（质量、安全、真实环境、文档即代码、渐进增强）
- 开发流程规范
- 质量门禁标准
- 技术债务管理

---

**更新频率**:
- 技术细节：中频（技术栈变更时）
- 术语表：低频（新概念引入时）
- 错误代码：中频（新API端点时）
- 宪章：极低频（需团队投票）

**维护者**: LLMChat架构团队  
**版本**: 1.0.0  
**创建日期**: 2025-10-16
