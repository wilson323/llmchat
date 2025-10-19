// 基础ESLint配置 - 共享规则和标准
module.exports = {
  // 环境配置
  env: {
    es2021: true,
  },

  // 解析器配置
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },

  // 插件配置
  plugins: ['@typescript-eslint'],

  // 基础扩展
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],

  // 核心规则分级
  rules: {
    // === BLOCKER 级别 - 阻塞开发，必须立即修复 ===
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-unreachable': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-useless-constructor': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true,
      allowTaggedTemplates: true
    }],

    // === CRITICAL 级别 - 关键类型安全，需要尽快修复 ===
    '@typescript-eslint/no-explicit-any': 'warn', // 开发阶段降级，生产需修复
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',

    // === MAJOR 级别 - 代码质量，需要计划修复 ===
    'prefer-const': 'error',
    'no-var': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-extra-boolean-cast': 'error',
    'no-extra-semi': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],

    // === MINOR 级别 - 代码风格，可自动修复 ===
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': ['error', { before: false, after: true }],
    'comma-style': ['error', 'last'],
    'computed-property-spacing': ['error', 'never'],
    'func-call-spacing': ['error', 'never'],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'linebreak-style': ['error', 'unix'],
    'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'semi-spacing': ['error', { before: false, after: true }],
    'space-before-blocks': ['error', 'always'],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', { words: true, nonwords: false }],
    'spaced-comment': ['error', 'always'],
    'no-useless-rename': 'error',

    // === 复杂度和最佳实践 ===
    'complexity': ['warn', 15], // 适度提高阈值
    'max-depth': ['warn', 5],
    'max-len': ['warn', {
      code: 120, // 提高到120字符
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true,
      ignoreRegExpLiterals: true
    }],
    'max-nested-callbacks': ['warn', 4],
    'max-params': ['warn', 6],
    'no-magic-numbers': ['warn', {
      ignore: [
        -1, 0, 1, 2, 5, 7, 10, 100, 1000, // 常用数字
        15, 30, 60, 90, 180, 365, // 时间相关
        24, 36, 48, 72, 96, 120, 144, 168, // 小时制
        300, 500, 3000, 5000, // 毫秒相关
        80, 85, 95, 99, // 百分比
        1024, 2048, 4096, 8192, // 计算机相关
        0.1, 0.2, 0.3, 0.5, 0.8 // 小数
      ],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      enforceConst: true
    }],

    // === TypeScript 特定规则（渐进式启用）===
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/ban-ts-comment': ['warn', {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': 'allow-with-description',
      'ts-nocheck': 'allow-with-description',
      'ts-check': 'allow-with-description'
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // 异步相关规则（适度宽松）
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/await-thenable': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/return-await': 'warn',

    // 可选链和空值合并（推荐使用但非强制）
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',

    // 暂时禁用的严格检查（未来逐步启用）
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/no-base-to-string': 'off',
    '@typescript-eslint/prefer-regexp-exec': 'off',

    // 控制台使用（开发环境宽松）
    'no-console': 'warn'
  },

  // 测试文件覆盖
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'max-len': 'off',
        'complexity': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/ban-ts-comment': 'off'
      }
    }
  ]
};
