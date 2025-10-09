# 失败炼金术报告
版本: 1.0.0
日期: 2025-10-05
适用范围: llmchat 全局梳理与规则生成、后端接入与测试
目标: 将本次失败原子化为可复用模式，并提供可直接粘贴的记忆植入模板

## 一、失败原子化（可复用原子）
- 失败#001 - MCP Memory落盘失败（ENOENT）
  - 症状: memory.create_entities 报 ENOENT: 无法打开自定义 memory.json
  - 根因: 本地 memory server 未正确配置存储路径或缺省文件不存在
  - 提炼模式: “本地记忆文件回退”模式
  - 复用建议: 优先写入 .trae/memories/ 本地持久化；MCP memory 作为增益通道而非单点依赖

- 失败#002 - Serena项目上下文未激活/多项目冲突
  - 症状: “No active project” 与 “Multiple projects found” 提示
  - 根因: 未显式传入仓库路径或命名冲突
  - 提炼模式: “显式激活+路径绑定”模式
  - 复用建议: activate_project 统一传入仓库绝对路径；后续命令均在该上下文执行

- 失败#003 - README定点插入失败（SEARCH不匹配）
  - 症状: replace_in_file 搜索块不匹配
  - 根因: 标题文本/空白差异导致精确匹配失败
  - 提炼模式: “再读-精确匹配-小粒度diff”模式
  - 复用建议: 先 read_file 获取首行标题，后以最小上下文进行精确替换

- 失败#004 - Redis测试失败（ioredis导入方式错误）
  - 症状: 单元测试中未触发 setex/del/quit，黑名单判定异常
  - 根因: 使用命名导入 { Redis } 导致实例化失败并降级
  - 提炼模式: “驱动库导入规范化”模式
  - 复用建议: 对第三方库导入进行规则化校验（默认导入 vs 命名导入），测试前置静态检查

## 二、记忆植入指令模板（可直接粘贴）
```
# 记忆植入：上次项目中，智能体在{{SCENARIO}}时触发{{FAILURE}}，解决方案是{{PATTERN}}
# 场景示例：
# - MCP记忆写入失败 → 使用 .trae/memories 本地回退
# - Serena未激活 → 先 activate_project(绝对路径)，再执行工具链
# - README插入失败 → 先 read_file，再最小diff
# - ioredis失败 → 统一改为默认导入
# 请在新项目中执行相同防御手段并验证日志/测试通过
```

## 三、反脆弱度量公式与结果
- 度量公式: 收益 = log2(失败次数 × 复用价值)
  - 失败次数: 4
  - 复用价值（主观评分，1-5）: 4（均为通用工程问题，复用价值高）
  - 计算: 收益 = log2(4 × 4) = log2(16) = 4.0
- 结论: 本次失败的系统化复用将带来 4.0 的未来收益系数（高）

## 四、落地清单（下次必须执行）
- 优先写本地记忆文件：.trae/memories/anti-fragile-patterns.mdc（阶段6执行）
- 所有MCP工具执行前：activate_project(绝对路径)
- 文档与规则单源化：docs/规则总纲 与 ethics_firewall_test_report.md 持续维护
- 第三方库导入规则验证：CI中增加静态检查（如 ioredis 默认导入）

## 五、审计与质量守护
- Mentor.quality_control: 复查导入规则与测试覆盖
- Mentor.security_check: 检查环境变量占位符泄露风险与审计一致性
- Mentor.optimize_performance: 评估防火墙路径性能影响与日志成本
- TaskManager: 记录上述规则在变更流水线的状态与审计