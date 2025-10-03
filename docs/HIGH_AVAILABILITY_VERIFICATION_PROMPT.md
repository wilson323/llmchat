# LLMChat 企业级高可用 & 低延时核查提示词

> 用途：用于指导高级别的代码审计 / 架构评估智能体，全面核实 LLMChat 项目是否达到企业级高可用、低延时与最佳实践要求。

请严格按照以下步骤执行，逐条给出结论、证据与整改建议：

1. **总体背景理解**
   - 阅读 `README.md`、`docs/ARCHITECTURE_DATA_STORAGE.md`、`docs/ENTERPRISE_AUDIT_REPORT.md` 等资料，形成对 LLMChat 业务目标、双端技术栈（React 18 + Vite + Tailwind + Zustand 前端 / Express + Node.js + PostgreSQL + Redis 后端）以及多智能体切换能力的完整认识。
   - 梳理前后端的部署模式（`npm run dev`、`npm run build`、`docker-compose.dev.yml`）与运行时依赖，确认环境变量、配置文件（`config/config.jsonc`、`config/agents.json`）的敏感信息加载策略。

2. **可用性与容错审计**
   - 检查后端 `backend/src` 中的健康检查（`GET /health`）、优雅关闭、连接池管理、Redis/数据库重连、限流（`rate-limiter-flexible`）和日志体系，确认是否实现多实例/横向扩展友好策略。
   - 审核中间件与错误处理实现（`middleware/errorHandler.ts` 等），验证是否覆盖重试、幂等、熔断、超时、告警、死信队列等高可用保障；指出缺失的部分并优先级排序。
   - 审查后台任务（Webhooks、SSE、语音流等）在异常/网络抖动场景下的恢复与回滚方案。

3. **低延时优化评估**
   - 分析前端渲染路径、状态管理（Zustand）、网络层（Axios 拦截器、SSE 流式处理）、Tailwind 动态加载策略，评估首屏渲染、实时对话和语音通话的延时控制措施；提供 Lighthouse / Web Vitals / 自定义性能监控建议。
   - 审阅后端请求链路（中间件顺序、缓存策略、批量请求、连接池、流式输出等），确认是否存在阻塞点或 N+1 查询，并建议使用性能基线（如 p95/p99 时延）与 APM 工具（OpenTelemetry、Jaeger、Elastic APM）。

4. **基础设施与部署最佳实践**
   - 核查项目的 CI/CD（`docs/CI_CD_GUIDE.md`、`docker-compose.dev.yml`）、日志聚合、安全基线（Helmet CSP、CORS、安全头、依赖扫描）、基础设施即代码等是否符合企业级规范；标出缺失或需要加强的 DevSecOps 能力。
   - 评估环境配置（`.env.example`、`config/agents.json`）的密钥管理、分层环境（dev/staging/prod）、蓝绿/灰度策略、灾备演练（RPO/RTO）以及多地域部署能力。

5. **功能完整性与智能体切换验证**
   - 对照 `docs/FASTGPT_AGENT_SETUP.md`、`docs/fastgpt-interface-analysis.md` 等，确认多智能体配置、热切换、fallback 策略、调用链追踪以及权限控制是否达到最佳实践。
   - 验证语音电话、图像生成等高级功能在异常情况下的体验保障（断线重连、重试、并发冲突处理）。

6. **输出要求**
   - 给出一份结构化报告：`结论概述`、`关键指标表`（SLA、可用性、延时、容量、弹性）、`风险矩阵`、`改进路线图（按 T+7/T+30/T+90）`。
   - 对每项发现引用仓库内文件、代码行、配置或文档为证据；如需推测，说明假设与验证手段。
   - 以最终结论总结 LLMChat 当前是否达到“企业级高可用低延时”标准，并给出通过/待整改判定。

> **可选扩展**：如发现监控或压测数据缺失，请补充推荐的 SLA 指标、压测脚本、混沌工程计划，以满足持续验证要求。
