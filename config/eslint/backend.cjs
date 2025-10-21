// 后端ESLint配置
const baseConfig = require('./base.cjs');

module.exports = {
  ...baseConfig,
  root: true,
  env: {
    ...baseConfig.env,
    node: true,
    jest: true,
  },
  parserOptions: {
    ...baseConfig.parserOptions,
    project: ['./tsconfig.json'],
    tsconfigRootDir: undefined, // 由backend/.eslintrc.cjs通过导入时覆盖
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/__tests__/setup.ts',
    'jest.config.ts',
    'scripts/**/*',
  ],
  rules: {
    ...baseConfig.rules,

    // 后端特定规则
    // === BLOCKER - 后端关键错误 ===
    'no-empty': ['error', { allowEmptyCatch: true }],

    // === CRITICAL - 后端类型安全 ===
    '@typescript-eslint/no-explicit-any': 'warn', // 开发阶段降级为警告，逐步修复

    // === MAJOR - 后端代码质量 ===
    'no-process-exit': 'warn', // 降级为警告
    'no-sync': 'warn', // 警告同步方法

    // 复杂度控制（后端业务逻辑可能更复杂）
    'complexity': ['warn', 20],
    'max-len': ['warn', {
      code: 100, // 后端保持100字符
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
      ignoreComments: true
    }]
  },

  overrides: [
    ...baseConfig.overrides,
    {
      files: ['src/controllers/**/*.ts'],
      rules: {
        'complexity': ['warn', 15],
        'max-params': ['warn', 5],
      }
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        'complexity': ['warn', 18],
      }
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        'complexity': ['warn', 12],
      }
    }
  ]
};
