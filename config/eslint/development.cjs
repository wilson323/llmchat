// 开发环境ESLint配置 - 宽松模式确保开发不受阻
const baseConfig = require('./base.cjs');

module.exports = {
  ...baseConfig,
  rules: {
    ...baseConfig.rules,

    // 开发阶段降级规则 - 从error降为warn或off
    '@typescript-eslint/no-explicit-any': 'off', // 开发阶段允许any
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',

    // 异步相关规则开发阶段宽松
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/return-await': 'off',

    // TypeScript 严格规则开发阶段宽松
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-optional-chain': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',

    // 复杂度要求开发阶段更宽松
    'complexity': ['warn', 25], // 大幅提高复杂度阈值
    'max-depth': ['warn', 8],
    'max-nested-callbacks': ['warn', 6],
    'max-params': ['warn', 8],

    // 代码质量规则保持但允许更多例外
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true,
      allowTaggedTemplates: true
    }],

    // 开发阶段允许console用于调试
    'no-console': 'off',

    // 开发阶段暂时禁用Magic Numbers规则，避免配置冲突
    'no-magic-numbers': 'off',

    // 保持基础的代码风格规则（可自动修复）
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': ['error', { before: false, after: true }],
    'comma-style': ['error', 'last'],
    'computed-property-spacing': ['error', 'never'],
    'func-call-spacing': ['error', 'never'],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'linebreak-style': ['error', 'unix'],
    'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 1, maxEOF: 1 }], // 开发允许更多空行
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

    // 保持关键的错误检测规则
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
    'prefer-const': 'error',
    'no-var': 'error'
  },

  // 开发环境文件覆盖
  overrides: [
    ...baseConfig.overrides,
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        // 测试文件几乎禁用所有规则
        'no-magic-numbers': 'off',
        'max-len': 'off',
        'complexity': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'eqeqeq': 'off',
        'curly': 'off',
        'prefer-const': 'off',
        'no-var': 'off',
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['*.stories.tsx', 'storybook/**/*'],
      rules: {
        // Storybook文件宽松规则
        'no-magic-numbers': 'off',
        'max-len': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off'
      }
    }
  ]
};