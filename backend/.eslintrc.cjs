// 后端ESLint配置 - 严格类型安全和质量控制
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
    // 启用类型信息
    EXPERIMENTAL_useProjectService: true,
    warnOnUnsupportedTypeScriptVersion: false,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/__tests__/**/*',
    'jest.config.ts',
    'scripts/**/*'
  ],
  rules: {
    // 类型安全 - 渐进式改进（降级为警告，允许逐步修复）
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',

    // 类型检查建议
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/prefer-readonly': 'warn',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // 变量和函数定义（保持error防止代码腐化）
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
    '@typescript-eslint/consistent-type-imports': ['warn', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false
    }],

    // 代码质量
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-destructuring': ['warn', {
      object: true,
      array: false
    }],

    // 异步处理（保持error确保Promise正确处理）
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-misused-promises': 'error',

    // 错误处理（保持error确保异常安全）
    '@typescript-eslint/no-throw-literal': 'error',
    '@typescript-eslint/prefer-promise-reject-errors': 'error',
    
    // 降低部分严格规则
    '@typescript-eslint/no-extraneous-class': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    'no-control-regex': 'warn',
    'no-useless-escape': 'warn',

    // Node.js特定规则
    'node/no-unsupported-features/es-syntax': 'off', // TypeScript处理
    'node/no-missing-import': 'off', // TypeScript处理
    'node/no-extraneous-import': 'off', // TypeScript处理
    'node/no-unpublished-import': 'off', // 不适用于monorepo
    'node/no-unpublished-require': 'off' // 不适用于monorepo
  },
  overrides: [
    {
      // 测试文件特殊规则
      files: ['**/*.test.ts', '**/*.spec.ts', 'src/__tests__/**/*'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        'no-console': 'off'
      }
    },
    {
      // 配置文件特殊规则
      files: ['*.config.js', '*.config.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-explicit-any': 'warn'
      }
    }
  ]
}