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
    project: ['./tsconfig.json', './tsconfig.scripts.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/__tests__/setup.ts',
    'jest.config.ts',
    'scripts/**/*'
  ],
  rules: {
    ...baseConfig.rules,

    // 后端特定规则

    // === BLOCKER - 后端关键错误 ===
    'no-empty': ['error', { allowEmptyCatch: true }],

    // === CRITICAL - 后端类型安全 ===
    // 后端数据处理更严格
    '@typescript-eslint/no-explicit-any': 'error', // 后端严格要求

    // === MAJOR - 后端代码质量 ===
    // 后端API相关的特定规则
    'no-process-exit': 'error',
    'no-sync': 'warn', // 警告同步方法

    // 复杂度控制（后端业务逻辑可能更复杂）
    'complexity': ['warn', 20], // 后端允许更高复杂度

    // 行长度限制（后端可能需要更长的错误消息）
    'max-len': ['warn', {
      code: 100, // 后端保持100字符
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
      ignoreComments: true
    }],

    // Magic numbers - 后端业务相关的数字
    'no-magic-numbers': ['warn', {
      ignore: [
        -1, 0, 1, 2, 5, 7, 10, 100, 1000,
        // HTTP状态码
        200, 201, 204, 400, 401, 403, 404, 500, 502, 503,
        // 时间相关
        15, 30, 60, 90, 180, 300, 600, 900, 1800, 3600, 7200, 86400,
        24, 48, 72, 168, // 小时/天
        // 数据库相关
        255, 65535, // 字符串长度限制
        2147483647, // 32位整数最大值
        // 系统配置
        3000, 5000, 8080, 3001, 5432, 3306, 6379, // 端口
        0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 2.0, 3.0 // 小数倍率
      ],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      enforceConst: true
    }]
  },

  // 后端特定文件覆盖
  overrides: [
    ...baseConfig.overrides,
    {
      files: ['src/migrations/**/*.sql', 'src/scripts/**/*.ts'],
      rules: {
        'no-magic-numbers': 'off',
        'max-len': 'off',
        'complexity': 'off'
      }
    },
    {
      files: ['src/controllers/**/*.ts'],
      rules: {
        'complexity': ['warn', 15], // 控制器复杂度限制更严格
        'max-params': ['warn', 5], // 控制器参数限制更严格
        '@typescript-eslint/no-explicit-any': 'error' // 控制器禁用any
      }
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        'complexity': ['warn', 18], // 服务层允许更高复杂度
        '@typescript-eslint/no-explicit-any': 'error' // 服务层禁用any
      }
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        'complexity': ['warn', 12], // 工具函数复杂度限制严格
        '@typescript-eslint/prefer-nullish-coalescing': 'error', // 工具函数要求使用空值合并
        '@typescript-eslint/prefer-optional-chain': 'error' // 工具函数要求使用可选链
      }
    }
  ]
};