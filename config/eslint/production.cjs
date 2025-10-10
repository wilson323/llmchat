// 生产环境ESLint配置 - 最严格模式确保代码质量
const baseConfig = require('./base.cjs');

module.exports = {
  ...baseConfig,
  rules: {
    ...baseConfig.rules,

    // === 生产环境严格规则 - 所有警告升级为错误 ===

    // 类型安全 - 严格模式
    '@typescript-eslint/no-explicit-any': 'error', // 严格禁止any
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',

    // TypeScript 严格规则
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/ban-ts-comment': ['error', {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': 'never',
      'ts-nocheck': 'never',
      'ts-check': 'allow-with-description'
    }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',

    // 异步相关规则 - 严格模式
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/return-await': 'error',

    // 复杂度控制 - 严格限制
    'complexity': ['error', 10], // 降低复杂度阈值
    'max-depth': ['error', 4],
    'max-nested-callbacks': ['error', 3],
    'max-params': ['error', 5],

    // 行长度限制 - 严格模式
    'max-len': ['error', {
      code: 100, // 降低到100字符
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
      ignoreComments: false // 生产环境注释也要控制长度
    }],

    // Magic numbers - 严格限制
    'no-magic-numbers': ['error', {
      ignore: [
        // 仅允许最基本的数学常量
        -1, 0, 1, 2, 3, 5, 7, 10, 100, 1000,
        // 基础时间单位
        60, // 秒到分钟
        24, // 小时到天
        365, // 天到年
        // 基础百分比
        50, 100,
        // 基础技术常量
        1024, 2048, 4096,
        // 基础透明度
        0.5
      ],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      enforceConst: true
    }],

    // 代码质量 - 严格模式
    'no-unused-expressions': ['error', {
      allowShortCircuit: false,
      allowTernary: false,
      allowTaggedTemplates: false
    }],

    // 生产环境禁用console
    'no-console': 'error',

    // 代码风格 - 严格模式
    'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],

    // 严格类型检查规则（生产环境启用）
    '@typescript-eslint/restrict-template-expressions': ['error', {
      allowNumber: true,
      allowBoolean: true,
      allowAny: false,
      allowNullish: false
    }],
    '@typescript-eslint/no-base-to-string': 'error',
    '@typescript-eslint/prefer-regexp-exec': 'error',

    // 潜在问题检测
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-await': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-async-promise-executor': 'error',
    'no-promise-executor-return': 'error',
    'no-nested-ternary': 'error',
    'no-unneeded-ternary': 'error',
    'no-new': 'error',
    'no-new-wrappers': 'error',
    'no-array-constructor': 'error',
    'no-void': 'error',
    'no-sequences': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'radix': 'error',
    'wrap-iife': ['error', 'inside'],
    'yoda': 'error',
    'no-shadow': 'error',
    'no-shadow-restricted-names': 'error',
    'no-undef-init': 'error',
    'no-undefined': 'error',
    'no-use-before-define': ['error', { functions: false, classes: false, variables: true }]
  },

  // 生产环境文件覆盖
  overrides: [
    ...baseConfig.overrides,
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        // 测试文件相对宽松但仍保持质量
        'no-magic-numbers': 'off',
        'max-len': 'off',
        '@typescript-eslint/no-explicit-any': 'warn', // 测试文件允许any但警告
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        'complexity': ['warn', 15], // 测试文件允许更高复杂度
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn'
      }
    },
    {
      files: ['src/config/**/*.ts', 'src/constants/**/*.ts'],
      rules: {
        // 配置和常量文件更严格
        'no-magic-numbers': 'error',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error'
      }
    }
  ]
};