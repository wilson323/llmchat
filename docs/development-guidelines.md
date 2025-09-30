# 项目开发规范与质量保障手册

本手册面向 llmchat 项目的所有开发成员，结合现有代码库与审计结果，总结必须遵循的开发规范、质量门槛以及异常风险提示，确保各模块能够以一致、现代化且高可维护性的方式迭代。

## 1. 协作流程与分支策略
- **分支模型**：以 `main` 为稳定分支，日常开发从 `work` 或 `feature/*` 切出，禁止直接向 `main` 推送代码。
- **提交格式**：遵循 Conventional Commits，使用动词开头的小写英文短句，例如 `fix: handle sidebar retry flow`。若包含文档更新，可追加 `docs:` 前缀。
- **代码评审**：所有合并请求必须至少获得一名核心成员代码审查。提交前附带本手册要求的测试记录与截图（若修改 UI ）。
- **PR 内容**：说明背景、主要变更、影响范围及测试结论，并在涉及配置或依赖调整时提供迁移步骤。

## 2. 代码结构与命名规范
- **前端（React + Zustand）**：
  - 组件放置于 `frontend/src/components`，使用 PascalCase 文件命名；业务逻辑拆入 `hooks/` 或 `store/`，避免组件内嵌大量状态机。
  - Zustand store 拆分 slice，导出类型定义，避免出现 `chatStore` 现有的超大文件（>700 行）导致的维护困难。 【F:frontend/src/store/chatStore.ts†L1-L720】
  - 所有 API 调用集中在 `services/`，通过 `api` 实例统一处理身份、超时与错误提示。 【F:frontend/src/services/api.ts†L1-L840】
- **后端（Express）**：
  - 控制器位于 `backend/src/controllers`，仅负责请求/响应编排；业务逻辑封装在 `services/`；跨模块工具放到 `utils/`。
  - 严禁在控制器直接访问数据库连接；统一通过 `services` 或 Repository 层封装。
- **命名约定**：React 组件、类使用 PascalCase；函数、常量使用 camelCase；枚举、常量对象全大写蛇形（如 `VOICE_CALL_AGENT_ID`）。
- **类型约束**：所有公共函数导出显式 TypeScript 类型，避免在复杂对象（如 `chatService`）中出现 `any`。可通过类型别名或接口定义结构。

## 3. UI/UX 现代化要求
- **组件一致性**：使用共享的弹窗、Toast、按钮组件，禁止原生 `window.confirm` 等不符合设计体系的交互。侧栏、对话框等需与 `ChatApp` 布局协同更新。 【F:frontend/src/components/Sidebar.tsx†L1-L220】
- **响应式布局**：保证桌面端、移动端样式一致，修复现有 `ChatApp` 在桌面端无法收起侧栏的问题，采用 Tailwind 响应式类控制宽度与位移。 【F:frontend/src/components/ChatApp.tsx†L15-L32】
- **可访问性**：交互元素提供 `aria` 标签、键盘操作路径；长流程操作需要 loading 状态与错误提示。
- **流式交互**：在 `ChatContainer` 示例提示、重试流程中增加防抖与并发保护，避免多次触发造成竞态。 【F:frontend/src/components/chat/ChatContainer.tsx†L12-L308】

## 4. 安全与配置治理
- **敏感信息**：禁止在仓库提交真实 API Key、数据库凭证。现有 `config/agents.json` 与 `config/config.jsonc` 中暴露的敏感值需尽快迁移到 `.env` 并提供示例文件。 【F:config/agents.json†L1-L80】【F:config/config.jsonc†L22-L38】
- **认证流程**：删除后端数据库中的 `password_plain` 字段，统一使用加盐散列存储口令，避免明文凭证泄露风险。 【F:backend/src/utils/db.ts†L53-L170】
- **Token 存储**：`AuthService` 当前将 token 保存在内存 Map，应改用持久化方案（Redis/JWT），以适配多实例部署。 【F:backend/src/services/AuthService.ts†L41-L123】
- **速率限制**：现有 `RateLimiterMemory` 仅适用于单实例，生产环境需引入共享存储实现全局速率限制。 【F:backend/src/middleware/rateLimiter.ts†L1-L43】

## 5. 测试策略与质量门槛
- **最小要求**：每次提交前至少运行 `npm run frontend:lint` 与 `npm run backend:lint`。若命令失败，需在 PR 中说明原因并排期修复。
- **自动化测试**：
  - 后端使用 Jest，要求为控制器、服务编写单元测试，模拟数据库与外部依赖。参考 `backend/src/__tests__/agentConfigService.test.ts` 模式。 【F:backend/src/__tests__/agentConfigService.test.ts†L1-L160】
  - 前端引入 Testing Library + Vitest，重点覆盖 `useChat` 状态流、`Sidebar` 删除流程以及流式消息渲染。
- **端到端验证**：关键功能上线前需通过 Playwright 或 Cypress 编写最少的冒烟脚本，覆盖登录、发消息、历史记录检索。
- **质量门槛**：CI 中 lint、unit test、构建均需通过才可合并。若存在遗留错误（如下列异常），需要创建 issue 并列入迭代计划。

## 6. 当前已知异常与修复优先级
- **TypeScript 解析错误**：
  - `frontend/src/services/api.ts` 与 `frontend/src/store/chatStore.ts` 在 eslint 中抛出语法解析失败，需要校验文件结尾的导出/括号是否匹配。 【F:frontend/src/services/api.ts†L600-L840】【F:frontend/src/store/chatStore.ts†L260-L320】
  - `backend/src/controllers/ChatController.ts` 同样存在语法错误，导致 lint 无法通过。 【F:backend/src/controllers/ChatController.ts†L1-L80】
- **依赖兼容性**：当前 TypeScript 版本为 5.9.2，超出 `@typescript-eslint` 支持范围，需同步升级 eslint 生态或锁定 TS 版本至 `<5.4`。
- **构建产物**：仓库仍包含 `backend/dist` 目录与根级 `node_modules`，应更新 `.gitignore` 并清理冗余文件。 【F:backend/dist/index.js†L1-L40】

## 7. 日志、监控与可观测性
- 采用 `winston`、`pino` 等结构化日志库，输出 JSON 格式日志并接入集中式平台（如 Loki/Grafana）。
- 扩展 `/health` 接口检测数据库、外部 API 可用性，以支持 Kubernetes 或云平台的健康探针。 【F:backend/src/index.ts†L52-L78】
- 对关键接口添加埋点与性能指标（请求耗时、错误率），为后续容量规划提供数据。

## 8. 文档与知识沉淀
- 代码改动须同步更新 `docs/` 目录文档，包括：
  - 架构图、状态机序列图、智能体能力矩阵。
  - 配置依赖说明（`config/README.md`）。
  - 新增或调整 API 的 Swagger/OpenAPI 描述。
- 项目新成员需阅读《项目全局审计报告》与本手册，确保了解遗留风险及目标状态。 【F:docs/project-audit.md†L1-L108】

---
本规范会随着风险整改与迭代节奏持续更新。所有开发者在提交代码前需对照本手册自检，并在 PR 模板中勾选相应检查项，确保项目整体体验向现代化、高质量目标迈进。
