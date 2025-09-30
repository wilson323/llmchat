# 项目全局审计报告

## 概览
- **仓库**：llmchat
- **审计目的**：梳理当前代码中显性的异常风险与可提升点，支撑后续迭代将项目提升到安全、稳定且具备现代化体验的水准。
- **审计范围**：Express 后端、React 前端、配置与基础设施脚本。

## 关键风险与修复优先级

### 1. 安全与合规（高优先级）
- `config/agents.json` 直接提交了 FastGPT API Key、公网 Endpoint 等敏感信息，任何获得代码的人都可直接调用生产服务。应改为从安全的环境变量或密钥管理系统读取，并将示例配置改为占位值。 【F:config/agents.json†L1-L80】
- `config/config.jsonc` 中暴露了真实数据库主机地址与凭证占位符，结合上面的 API Key 泄露将放大攻击面。建议将敏感配置迁移到 `.env` 或密钥管理服务，并提供 `config.example.jsonc`。 【F:config/config.jsonc†L22-L38】
- 数据库初始化脚本为用户表添加 `password_plain` 列，并在空库时种子一名明文口令的 `admin` 用户；`AuthService` 也完全依赖明文口令进行校验，忽略了已经实现的 `hashPassword`。一旦数据库泄露将立即导致账号失陷。应删除明文列，统一使用强散列（如 bcrypt）并在登录/改密流程中校验散列。 【F:backend/src/utils/db.ts†L53-L170】【F:backend/src/services/AuthService.ts†L56-L120】
- Rate limiter 仅使用 `RateLimiterMemory`，部署多实例或重启后无法共享计数，也无法抵御集中攻击。建议接入 Redis、Upstash 等集中式存储，并将速率参数挪到配置层。 【F:backend/src/middleware/rateLimiter.ts†L1-L43】

### 2. 功能性缺陷（高优先级）
- `frontend/src/hooks/useChat.ts` 的 `retryMessage` 使用了 `currentAgent`、`messages`、`updateMessageById` 等变量，但文件中从未定义或解构它们，导致 TypeScript 编译失败或运行期抛出 `ReferenceError`。需要在 hook 顶部通过 `useChatStore()` 正确取值。 【F:frontend/src/hooks/useChat.ts†L142-L214】
- `ChatContainer` 依赖 `bindSessionId`、`ProductPreviewWorkspace`、`VoiceCallWorkspace` 等标识，但组件解构和 import 都未提供这些成员，同样会导致构建失败。需补全 `useChatStore` 解构和 import。 【F:frontend/src/components/chat/ChatContainer.tsx†L12-L229】
- `Sidebar` 组件内部调用了 `chatService`、`mapHistoryDetailToMessages` 以及常量 `PRODUCT_PREVIEW_AGENT_ID`/`VOICE_CALL_AGENT_ID`，但顶部未 import；此外删除对话时在 `confirm` 为真时提前 `return`，后端历史记录永远不会被删除。应修正导入并统一删除流程。 【F:frontend/src/components/Sidebar.tsx†L2-L196】【F:frontend/src/components/Sidebar.tsx†L88-L103】

### 3. 架构与代码健康（中优先级）
- `chatStore` 文件超过 700 行，包含大量重复的 session/message 同步逻辑和嵌套 `set` 调用，维护性极差。建议拆分为多个 slice（如 agent、session、streaming）并补充单元测试覆盖关键状态迁移。 【F:frontend/src/store/chatStore.ts†L1-L360】【F:frontend/src/store/chatStore.ts†L360-L720】
- 后端 `AuthService` 的 token 存在内存 Map 中，进程重启或多实例部署都会造成用户强制登出。可改用 Redis/数据库持久化或 JWT，并在 `AuthController` 中统一处理过期/刷新逻辑。 【F:backend/src/services/AuthService.ts†L41-L123】
- 项目提交了 `backend/dist` 构建产物与根 `node_modules`，增加仓库体积且易与源码不一致。建议更新 `.gitignore`，仅保留源代码与锁文件。 【F:backend/dist/index.js†L1-L40】

### 4. UI/UX 与可访问性（中优先级）
- `ChatApp` 中 `sidebarOpen` 状态对桌面端 className 没有影响（始终 `lg:ml-0`），导致在大屏上无法真正收起侧栏。可通过设置 `lg:w-0`/`lg:-translate-x-full` 等类实现动画。 【F:frontend/src/components/ChatApp.tsx†L15-L32】
- `Sidebar` 删除对话仅使用原生 `confirm`，缺少符合整体 UI 的模态窗，也没有 loading/错误提示。推荐用现有的 `Toast` 或自定义对话框，保持一致的现代化体验。 【F:frontend/src/components/Sidebar.tsx†L88-L103】
- `ChatContainer` 欢迎界面中示例提示卡直接调用 `sendMessage`，缺乏并发/防抖处理；若在流式响应过程中点击会造成竞态。可在 `useChat` 中增加队列或按钮禁用状态。 【F:frontend/src/components/chat/ChatContainer.tsx†L232-L308】

### 5. 可观测性与运维（中优先级）
- 目前的请求日志仅写 `console.log`，在生产环境难以检索。建议接入 winston/pino，将日志输出到文件或集中式系统，并与 `config.logging` 的导出器配置打通。 【F:backend/src/middleware/requestLogger.ts†L7-L30】【F:config/config.jsonc†L3-L20】
- 健康检查仅返回基础信息，没有数据库连接或队列状态。可以扩展 `/health` 调用 `pool.query('SELECT 1')` 以便运维探测真实可用性。 【F:backend/src/index.ts†L52-L78】

### 6. 测试与质量保障（中优先级）
- 后端仅覆盖 `agentConfigService` 与 `analyticsService`，大量控制器/中间件缺乏测试。建议为 Auth、Chat、Product Preview 路径补充单测，确保核心 API 稳定。 【F:backend/src/__tests__/agentConfigService.test.ts†L1-L160】
- 前端尚无任何测试文件，且复杂状态机完全依赖手动验证。可以引入 Vitest/Testing Library，为 `useChat`、`Sidebar` 等关键模块编写测试，并在 CI 中执行。 【F:frontend/src/components/Sidebar.tsx†L1-L220】

## 进一步的优化建议
- **配置治理**：新增 `config/README.md` 说明环境变量依赖，提供脚本自动校验必填项，避免启动期才暴露问题。
- **性能**：`chatService` 在流式解析中自行实现 SSE 解析，逻辑冗长且易错，可以替换为经过验证的库（如 `eventsource-parser`），降低维护成本。 【F:frontend/src/services/api.ts†L1-L210】
- **可维护性**：将 `docs/` 目录补充架构图、状态机序列图，并记录各智能体能力差异，方便新成员快速上手。

## 建议的近期行动清单
1. 立即移除明文凭证、API Key，并重置已有密钥；引入 `.env` 管理配置。
2. 重构认证流程：删除 `password_plain`，使用加盐散列和 JWT/集中存储。
3. 修复前端 hook 与组件的未定义引用，补充类型检查，恢复构建可用性。
4. 拆分 `chatStore`，同时为关键状态流转编写测试。
5. 规划日志与监控方案（如引入 pino + Loki/Grafana），完善健康检查。
6. 制定 UI 交互规范，统一确认弹窗、错误提示与响应状态。

---
本报告聚焦于当前仓库内可直接识别的风险与优化点。后续迭代建议在每个改动点补充自动化测试与文档，确保质量持续提升。
