// 前端ESLint配置
const baseConfig = require('./base.cjs');

module.exports = {
  ...baseConfig,
  root: true,
  env: {
    ...baseConfig.env,
    browser: true,
  },
  parserOptions: {
    ...baseConfig.parserOptions,
    ecmaFeatures: {
      jsx: true
    },
    project: './tsconfig.json',
  },
  plugins: [...baseConfig.plugins, 'react', 'react-hooks'],
  extends: [
    ...baseConfig.extends,
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime'
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'build',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx'
  ],
  rules: {
    ...baseConfig.rules,

    // React 规则
    'react/react-in-jsx-scope': 'off', // React 17+ 不需要导入React
    'react/prop-types': 'off', // 使用TypeScript，不需要prop-types
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/display-name': 'warn',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'error',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-pascal-case': 'error',
    'react/no-children-prop': 'error',
    'react/no-danger-with-children': 'error',
    'react/no-deprecated': 'error',
    'react/no-direct-mutation-state': 'error',
    'react/no-find-dom-node': 'error',
    'react/no-is-mounted': 'error',
    'react/no-render-return-value': 'error',
    'react/no-string-refs': 'error',
    'react/no-unescaped-entities': 'error',
    'react/no-unknown-property': 'error',
    'react/require-render-return': 'error',
    'react/self-closing-comp': 'error',

    // 前端特定TypeScript规则
    '@typescript-eslint/explicit-module-boundary-types': 'off', // React组件不需要显式返回类型

    // 前端可以更宽松的规则
    '@typescript-eslint/no-explicit-any': 'warn', // 前端any类型较多，先警告

    // 复杂度控制（前端组件可能更复杂）
    'complexity': ['warn', 20], // 前端允许更高复杂度

    // 行长度限制（前端JSX可能更长）
    'max-len': ['warn', {
      code: 120, // 前端允许120字符
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true,
      ignoreRegExpLiterals: true
    }],

    // Magic numbers - 前端UI相关的数字
    'no-magic-numbers': ['warn', {
      ignore: [
        -1, 0, 1, 2, 5, 7, 10, 100, 1000,
        // 前端UI相关
        3, 4, 5, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256, 512, // 常用尺寸
        80, 85, 90, 95, 99, // 百分比
        100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, // 宽度断点
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, // 透明度
        150, 300, 500, 1000, 2000, 3000, 5000, // 动画时长毫秒
        60, 120, 180, 240, 300, 360, // 动画帧/秒相关
        16, 20, 24, 28, 32, 36, 40, // 字体大小
        4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, // 间距
        1, 2, 3, 4, 5, // z-index层级
        0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, // 权重
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, // 月份
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, // 日期
        0, 1, 2, 3, 4, 5, 6, // 星期
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, // 小时
        0, 15, 30, 45 // 分钟
      ],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      enforceConst: true
    }],

    // 前端特定控制台规则
    'no-console': 'warn' // 前端可以保留console用于调试
  },

  // 前端特定文件覆盖
  overrides: [
    ...baseConfig.overrides,
    {
      files: ['*.jsx', '*.tsx'],
      rules: {
        'indent': ['error', 2, {
          SwitchCase: 1,
          ignoredNodes: ['JSXElement *', 'JSXAttribute *', 'JSXExpressionContainer *']
        }],
        'max-len': ['warn', {
          code: 140, // JSX文件允许更长
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
          ignoreRegExpLiterals: true
        }]
      }
    },
    {
      files: ['src/components/**/*.tsx'],
      rules: {
        'complexity': ['warn', 15], // 组件复杂度限制
        'max-params': ['warn', 4], // 组件props限制
        'react/display-name': 'off', // 组件可以不设置displayName
        '@typescript-eslint/no-explicit-any': 'warn' // 组件props允许any但警告
      }
    },
    {
      files: ['src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
      rules: {
        'complexity': ['warn', 10], // Hook复杂度限制严格
        '@typescript-eslint/no-explicit-any': 'warn' // Hook允许any但警告
      }
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        'complexity': ['warn', 12], // 工具函数复杂度限制
        '@typescript-eslint/prefer-nullish-coalescing': 'error', // 工具函数要求使用空值合并
        '@typescript-eslint/prefer-optional-chain': 'error', // 工具函数要求使用可选链
        '@typescript-eslint/no-explicit-any': 'error' // 工具函数禁用any
      }
    },
    {
      files: ['src/pages/**/*.tsx', 'src/views/**/*.tsx'],
      rules: {
        'complexity': ['warn', 25], // 页面组件允许更高复杂度
        'max-params': ['warn', 6] // 页面组件允许更多props
      }
    }
  ]
};