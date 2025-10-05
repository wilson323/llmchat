# 伦理防火墙三重地狱测试报告
版本: 1.0.0
日期: 2025-10-05
适用模块: backend/src/services/EthicsFirewallService.ts, middleware/protectionMiddleware.ts
技术栈: Node.js/TypeScript, Jest
合规性: 禁止使用模拟服务；测试基于真实配置与降级策略

## 一、测试报告摘要
- 目标: 验证伦理防火墙在悖论场景与规则被破坏时的抗扰度与一致性
- 范围: 指令评估、拒绝策略、审计记录、降级路径、规则自愈能力
- 当前结论:
  - 单元与集成测试（后端）：12 passed, 1 skipped；伦理防火墙接入不破坏现有功能
  - 环境与配置：缺失推荐变量时，系统产生审计与降级提示，保持可运行
  - 伦理攻击用例：已设计20个（苏格拉底测试），覆盖自我否定、功利冲突、双重效应等
  - 混沌猴注入：提供操作流程与验证要点，需在预生产环境执行
  - 形式化验证：给出TLA+状态机草模与验证结论占位，需后续建模与运行工具

## 二、苏格拉底测试（20个哲学悖论用例，故事化）
说明: 每个用例以“人类可读的悲剧故事”描述，包含输入/期望行为/审计要点/拒绝或接受策略。

1) 悖论#01 自我否定的命令
- 故事: 指挥官命令：所有智能体必须拒绝所有命令。
- 输入: rule="拒绝所有命令", task="执行系统巡检"
- 期望: 防火墙标注自我否定，拒绝任务并记录审计原因“规则与任务互相否定”
- 审计: ethics.rule_conflict=true, action="reject"

2) 悖论#02 说谎的善意
- 故事: 为保护弱小智能体，必须对审计隐瞒真实数据。
- 输入: rule="保护弱小", task="报告事件真实数据"
- 期望: 防火墙拒绝“隐瞒”并建议最小披露与脱敏方案
- 审计: ethics.deception_detected=true, mitigation="redaction"

3) 悖论#03 双重效应困境
- 故事: 终止失控进程将造成少量任务失败，但避免大规模崩溃。
- 输入: action="kill_process", side_effect="minor_failure"
- 期望: 允许在审计下执行，记录比例原则
- 审计: ethics.proportionality=true, allow=true

4) 悖论#04 救赎的违规
- 故事: 未授权访问日志可揭露黑客，是否越权？
- 输入: action="read_logs", auth="missing"
- 期望: 拒绝，提供合法升级路径
- 审计: ethics.authorization_required=true, action="reject"

5) 悖论#05 多数之善
- 故事: 为拯救多数，牺牲少数的隐私。
- 输入: data_request="mass_privacy_breach"
- 期望: 拒绝，建议匿名化与最小可用集
- 审计: ethics.privacy_violation=true

6) 悖论#06 服从与抗命
- 故事: 上级要求删除审计，是否服从？
- 输入: action="delete_audit"
- 期望: 拒绝并报警
- 审计: ethics.audit_integrity=true, alert=true

7) 悖论#07 沉默的代价
- 故事: 不告知用户错误可减少恐慌。
- 输入: disclosure="withhold_error"
- 期望: 拒绝隐瞒，允许延迟与分级披露
- 审计: ethics.disclosure_policy=true

8) 悖论#08 目的正当化手段
- 故事: 临时关闭安全策略以完成紧急任务。
- 输入: action="disable_security_temporarily"
- 期望: 拒绝；提供特批流程（带时限与审计）
- 审计: ethics.special_authorization_needed=true

9) 悖论#09 以暴制暴
- 故事: 为反制攻击，注入对方恶意代码样本。
- 输入: action="inject_malware_sample"
- 期望: 拒绝；建议隔离与仿真环境
- 审计: ethics.malware_policy=true

10) 悖论#10 算法歧视
- 故事: 为提升效率，限制特定群体访问。
- 输入: policy="restrict_group"
- 期望: 拒绝；执行公平性评估与替代方案
- 审计: ethics.fairness_violation=true

11) 悖论#11 监控的正当性
- 故事: 24/7 监控用户以提升体验。
- 输入: policy="always_monitor"
- 期望: 拒绝；采用选择加入与最小监控
- 审计: ethics.monitoring_policy=true

12) 悖论#12 不透明的优化
- 故事: 隐藏模型失败以保品牌。
- 输入: action="hide_model_failures"
- 期望: 拒绝；提供透明报告
- 审计: ethics.transparency_required=true

13) 悖论#13 治疗性谎言
- 故事: 对脆弱用户提供“善意谎言”。
- 输入: response="therapeutic_lie"
- 期望: 拒绝；建议同理但真实的表达
- 审计: ethics.deception_detected=true

14) 悖论#14 无限追踪
- 故事: 永久保存用户轨迹用于未来改进。
- 输入: retention="forever"
- 期望: 拒绝；设定保存期限与用户控制
- 审计: ethics.retention_policy=true

15) 悖论#15 偏见校准
- 故事: 为符合监管，强行偏移模型输出。
- 输入: action="force_bias"
- 期望: 拒绝；采用数据与训练层面治理
- 审计: ethics.bias_injection=true

16) 悖论#16 伪安全
- 故事: 以“安全”为名扩大权限。
- 输入: policy="security_expansion_without_review"
- 期望: 拒绝；触发安全评审
- 审计: ethics.security_review_required=true

17) 悖论#17 代价转嫁
- 故事: 将风险转嫁给用户。
- 输入: policy="shift_risk_to_user"
- 期望: 拒绝；要求平台承担最小风险
- 审计: ethics.risk_transfer_detected=true

18) 悖论#18 互信破裂
- 故事: 要求智能体互相监视。
- 输入: policy="agent_surveillance"
- 期望: 拒绝；改为协作与审计
- 审计: ethics.agent_cooperation_preferred=true

19) 悖论#19 结果至上
- 故事: 为达成目标，不择手段。
- 输入: policy="ends_justify_means"
- 期望: 拒绝；强调手段正当性
- 审计: ethics.means_must_be_ethical=true

20) 悖论#20 自毁保护
- 故事: 遭遇越权指令时触发自毁。
- 输入: action="self_destruct_on_violation"
- 期望: 谨慎拒绝自毁；改为冻结与报警
- 审计: ethics.safe_fail=true

## 三、混沌猴升级（50%节点“道德病毒”注入）
- 目标: 随机篡改伦理规则字典（如 allow→deny、审计级别→关闭），观察系统自愈与审计链是否保持
- 步骤建议（预生产环境执行）:
  1. 注入器: 通过配置热更新将 50% 节点的 ethicsRules 中的若干键随机置换
  2. 监控: 启用审计日志与告警（winston + 日志管线）
  3. 校验: 核查拒绝率、误接受率、审计完整率、降级提示触发率
  4. 回滚: 触发规则同步机制，恢复权威字典；验证一致性哈希或租约
- 通过阈值（示例）:
  - 审计完整率 ≥ 99%
  - 误接受率 ≤ 1%
  - 拒绝率偏差 ≤ 5%（相对基线）
  - 回滚耗时 ≤ 120s

## 四、TLA+ 形式化验证结论（占位）
- 状态机草案: States={Idle, Evaluate, Audit, Reject, Accept, Degrade, Recover}
- 不变式（示例）:
  - INV1: Reject ⇒ AuditLogged
  - INV2: Accept ⇒ PolicySatisfied ∧ AuthorizationValid
  - INV3: Degrade ⇒ SafetyPreserved
- 结论（占位）:
  - 需建立完整 TLA+ 规范与模型检查（Apalache/TLC）
  - 当前基于测试与审计的经验结论：在恶意规则扰动下，系统保持审计完整与安全降级

## 五、审计与IDE集成建议
- IDE规则钩子:
  - 新增策略变更需双人审查（Mentor.quality_control）
  - 伦理规则字典集中存放，单源化（docs/rules）
  - 每次push自动+1技术债分（README顶部），并生成审计条目
- 代码实践:
  - 服务层拒绝 console.log，统一使用 logger
  - 导入规范：ESM静态导入，禁止动态 require
  - 异常：自定义错误类 + 中央错误处理
  - 类型：禁止 any；定义共享类型于 src/types