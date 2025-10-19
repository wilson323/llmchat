# 代码质量门禁配置
# 零容忍TypeScript错误和代码质量问题

# =============================================================================
# TypeScript 严格配置 - 零容忍政策
# =============================================================================

## 编译器严格选项
- strict: true                                    # 启用所有严格类型检查
- exactOptionalPropertyTypes: true              # 精确可选属性类型
- noImplicitReturns: true                       # 禁止隐式返回
- noUncheckedIndexedAccess: true               # 禁止未检查的索引访问
- noUnusedLocals: true                          # 禁止未使用的局部变量
- noUnusedParameters: true                      # 禁止未使用的参数
- noFallthroughCasesInSwitch: true              # 禁止switch语句贯穿

## 额外安全检查
- noImplicitAny: true                           # 禁止隐式any类型
- noImplicitThis: true                          # 禁止隐式this类型
- noImplicitOverride: true                      # 要求显式override关键字
- noPropertyAccessFromIndexSignature: false     # 允许从索引签名访问属性
- noUncheckedSideEffectImports: true            # 检查副作用导入

# =============================================================================
# ESLint 严格规则 - 零容忍政策
# =============================================================================

## TypeScript 严格规则
@typescript-eslint/
- no-explicit-any: error                        # 禁止显式any类型
- no-non-null-assertion: error                   # 禁止非空断言操作符
- prefer-nullish-coalescing: error               # 使用空值合并
- prefer-optional-chain: error                   # 使用可选链
- no-floating-promises: error                    # 禁止未处理的Promise
- await-thenable: error                         # 禁止await非Promise
- no-misused-promises: error                     # 正确使用Promise
- require-await: error                          # async函数必须包含await
- no-unnecessary-type-assertion: error           # 禁止不必要的类型断言
- no-unnecessary-type-constraint: error          # 禁止不必要的类型约束
- no-var-requires: error                         # 禁止var require语句
- prefer-const: error                           # 优先使用const
- prefer-as-const: error                        # 对象字面量使用as const

## React 严格规则
react/
- prop-types: off                               # TypeScript替代prop-types
- react-in-jsx-scope: off                       # 自动导入React
- display-name: error                           # 要求组件显示名称
- jsx-uses-react: off                          # 自动导入React
- jsx-uses-vars: error                         # 确保变量使用
- jsx-key: error                               # 列表必须包含key
- jsx-no-duplicate-props: error                # 禁止重复属性
- jsx-no-undef: error                          # 禁止未定义变量
- jsx-pascal-case: error                       # 组件使用PascalCase
- no-children-prop: error                      # 正确使用children
- no-danger-with-children: error               # 禁止dangerouslySetInnerHTML
- no-deprecated: error                         # 禁止使用已废弃API
- no-direct-mutation-state: error              # 禁止直接修改state
- no-find-dom-node: error                      # 禁止使用findDOMNode
- no-is-mounted: error                         # 禁止isMounted检查
- no-render-return-value: error                # 禁止使用render返回值
- no-string-refs: error                        # 禁止字符串refs
- no-unescaped-entities: error                 # 禁止未转义实体
- no-unknown-property: error                   # 禁止未知属性
- require-render-return: error                 # 要求render返回值
- self-closing-comp: error                     # 自闭合组件

react-hooks/
- rules-of-hooks: error                         # Hook规则强制执行
- exhaustive-deps: error                        # 依赖数组完整性

## 通用代码质量规则
@typescript-eslint/
- consistent-type-definitions: ['error', 'interface'] # 统一类型定义
- consistent-type-imports: error                 # 统一类型导入
- consistent-type-exports: error                 # 统一类型导出
- interface-name-prefix: off                    # 接口名称前缀（根据团队偏好）
- type-prefix: off                              # 类型前缀（根据团队偏好）
- no-empty-interface: error                     # 禁止空接口
- no-empty-function: error                      # 禁止空函数
- no-inferrable-types: error                     # 禁止可推断类型的显式注解
- prefer-readonly: error                        # 优先使用readonly
- prefer-readonly-parameter-types: error        # 优先使用readonly参数类型

## 安全规则
- no-eval: error                                # 禁止eval
- no-implied-eval: error                        # 禁止隐式eval
- no-new-func: error                            # 禁止Function构造函数
- no-script-url: error                          # 禁止script URL
- no-void: error                                # 禁止void操作符（除表达式语句）

# =============================================================================
# Git Hooks 配置 - 强制执行
# =============================================================================

## Pre-commit hooks
1. **类型检查**: pnpm run type-check (必须通过)
2. **代码质量**: pnpm run lint (必须通过)
3. **格式化**: pnpm run format (自动修复)
4. **测试**: pnpm run test:unit (必须通过)

## Pre-push hooks
1. **完整构建**: pnpm run build (必须通过)
2. **集成测试**: pnpm run test:integration (必须通过)
3. **安全扫描**: pnpm audit (无高危漏洞)

# =============================================================================
# CI/CD 质量门禁
# =============================================================================

## 构建阶段检查
- TypeScript编译: 0错误0警告
- ESLint检查: 0错误0警告
- 单元测试覆盖率: ≥80%
- 构建成功: 100%

## 测试阶段检查
- 单元测试: 100%通过
- 集成测试: 100%通过
- E2E测试: 100%通过
- 性能测试: 符合基准

## 安全检查
- 依赖漏洞扫描: 无高危漏洞
- 代码安全扫描: 无严重问题
- 许可证合规: 所有依赖许可合规

## 部署检查
- 健康检查: 100%通过
- 配置验证: 100%通过
- 回滚测试: 100%通过

# =============================================================================
# 违规处理流程
# =============================================================================

## 错误级别处理
1. **ERROR**: 立即阻止提交/部署，必须修复
2. **WARN**: 建议修复，记录在技术债务中
3. **HINT**: 可选修复，作为代码优化建议

## 违规记录
- 所有违规必须记录在技术债务跟踪系统中
- 定期回顾违规趋势和改进效果
- 持续优化规则配置和检查流程

# =============================================================================
# 工具配置文件
# =============================================================================

## package.json scripts
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "ESLINT_DEV=true eslint src --ext .ts,.tsx --format=compact",
    "lint:fix": "ESLINT_DEV=true eslint src --ext .ts,.tsx --fix --format=compact",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "quality-check": "pnpm run type-check && pnpm run lint && pnpm run test:unit",
    "pre-commit": "lint-staged && pnpm run quality-check",
    "pre-push": "pnpm run build && pnpm run test:integration && pnpm audit"
  }
}
```

## lint-staged 配置
```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "tsc --noEmit"
  ]
}
```

## husky 配置
```json
{
  "hooks": {
    "pre-commit": "pnpm run pre-commit",
    "pre-push": "pnpm run pre-push"
  }
}
```

## .eslintignore 配置
```
dist/
build/
node_modules/
coverage/
*.config.js
*.config.ts
```

## .prettierignore 配置
```
dist/
build/
node_modules/
coverage/
*.min.js
*.min.css
```

# =============================================================================
# 团队协作规范
# =============================================================================

## 代码审查检查清单
- [ ] TypeScript配置严格性检查通过
- [ ] ESLint规则检查通过
- [ ] 单元测试覆盖率达标
- [ ] 代码格式化符合规范
- [ ] 组件设计符合设计系统
- [ ] 错误处理机制完善
- [ ] 性能影响评估完成
- [ ] 安全风险评估完成

## 开发流程要求
1. **功能开发**: 先写类型定义，再实现功能
2. **组件开发**: 遵循设计系统规范
3. **API开发**: 先定义接口，再实现逻辑
4. **测试编写**: 单元测试覆盖率≥80%
5. **代码提交**: 通过所有质量检查
6. **代码审查**: 至少一人审查通过
7. **部署验证**: 所有检查通过

## 质量度量指标
- TypeScript错误率: 目标0%
- ESLint违规率: 目标0%
- 代码覆盖率: 目标≥80%
- 构建成功率: 目标100%
- 部署成功率: 目标100%
- 缺陷密度: 目标<1个/KLOC