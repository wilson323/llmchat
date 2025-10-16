# LLMChat 术语表

**版本**: 1.0.0  
**创建日期**: 2025-01-16  
**状态**: 生效

---

## 文档说明

本文档定义项目中所有关键术语的**标准化表述**，确保代码、文档、沟通的一致性。

**强制要求**:
-  代码中必须使用英文术语
-  中文文档中必须使用对应的中文术语
-  禁止混用（如代码中出现中文变量名）
-  新增术语必须更新本文档

---

## 核心术语

### A

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Agent | 智能体 | AI对话智能体 | `AgentConfig`, `selectAgent()` |
| API Key | API密钥 | 外部服务认证密钥 | `OPENAI_API_KEY` |
| Authentication | 身份认证 | 用户身份验证过程 | `AuthService`, `jwtAuth` |
| Authorization | 授权 | 用户权限验证 | `rbacMiddleware` |

### C

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Chat | 聊天 | 对话功能 | `ChatWindow`, `chatStore` |
| Completion | 补全/回复 | AI生成的回复 | `/api/chat/completions` |
| Configuration | 配置 | 系统或智能体配置 | `AgentConfig`, `config.json` |
| Conversation | 会话 | 完整的对话上下文 | `Conversation` (同义词: Session) |

### E

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Endpoint | 端点 | API接口地址 | `POST /api/chat/completions` |
| Error Code | 错误代码 | 标准化错误标识 | `AUTH_INVALID_TOKEN` |

### M

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Message | 消息 | 单条对话消息 | `Message`, `ChatMessage` |
| Metrics | 指标 | 性能和业务指标 | `MetricsService` |
| Middleware | 中间件 | Express中间件 | `jwtAuth`, `rateLimiter` |

### P

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Provider | 提供商 | AI服务提供商 | `openai`, `anthropic`, `fastgpt` |
| Proxy | 代理 | 请求转发服务 | `ChatProxyService` |

### R

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Rate Limit | 速率限制 | API调用频率限制 | `rateLimiter` |
| Role | 角色 | 用户角色 | `user`, `admin` |

### S

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Session | 会话 | 对话会话 | `Session`, `SessionService` |
| Streaming | 流式 | 实时流式响应 | `SSE`, `StreamingService` |

### T

| 英文 | 中文 | 说明 | 代码示例 |
|------|------|------|---------|
| Token | 令牌 | JWT认证令牌 | `jwtToken`, `accessToken` |
| Type Safety | 类型安全 | TypeScript类型检查 | `strict: true` |

---

## 技术术语

### 架构相关

| 术语 | 说明 | 使用场景 |
|------|------|---------|
| Monorepo | 单仓多包结构 | pnpm workspace |
| SSE | Server-Sent Events | 流式响应 |
| RBAC | Role-Based Access Control | 权限系统 |
| DTO | Data Transfer Object | API数据传输 |
| Repository | 数据访问层 | 数据库操作 |

### 测试相关

| 术语 | 说明 | 使用场景 |
|------|------|---------|
| Unit Test | 单元测试 | 函数级测试 |
| Integration Test | 集成测试 | API测试 |
| E2E Test | 端到端测试 | 用户流程测试 |
| Mock | 模拟对象 | 测试隔离 |
| Coverage | 覆盖率 | 测试质量指标 |

---

## 同义词规范

**优先使用左侧术语，避免使用右侧**:

| 推荐术语 | 避免使用 | 说明 |
|---------|---------|------|
| Session | Conversation | 统一使用Session |
| Message | ChatMessage | 简化为Message |
| Provider | Vendor, Platform | 统一使用Provider |
| Agent | Bot, Assistant | 统一使用Agent |
| Configuration | Config, Settings | 完整拼写Configuration |

---

## 缩写规范

**允许使用的缩写**:
- API: Application Programming Interface
- JWT: JSON Web Token
- SSE: Server-Sent Events
- RBAC: Role-Based Access Control
- DTO: Data Transfer Object
- HTTP: HyperText Transfer Protocol

**禁止使用的缩写**（必须完整拼写）:
-  msg   message
-  cfg   config
-  auth   authentication（在变量名中可用auth）
-  repo   repository（在变量名中可用repo）

---

## 命名约定

### 代码命名

**变量/函数**: camelCase
```typescript
const userId = '123';
function sendMessage() {}
```

**类/接口**: PascalCase
```typescript
class AgentService {}
interface ChatMessage {}
```

**常量**: UPPER_SNAKE_CASE
```typescript
const MAX_MESSAGE_LENGTH = 10000;
```

**文件名**: kebab-case
```
agent-service.ts
chat-controller.ts
```

### 数据库命名

**表名**: 小写复数
```sql
CREATE TABLE users (...);
CREATE TABLE sessions (...);
```

**字段名**: snake_case
```sql
user_id, created_at, password_hash
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-01-16 | 初始版本 |

---

**维护者**: LLMChat 开发团队
