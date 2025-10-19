// 生产环境ESLint配置 - 严格规则确保代码质量
const baseConfig = require('./base.cjs');

module.exports = {
  ...baseConfig,
  root: true,
  env: {
    ...baseConfig.env,
    node: true,
    browser: true,
  },
  parserOptions: {
    ...baseConfig.parserOptions,
    ecmaFeatures: {
      jsx: true
    },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: [...baseConfig.plugins, 'react', 'react-hooks'],
  extends: [
    ...baseConfig.extends,
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    ...baseConfig.rules,

    // 生产环境严格规则
    // === CRITICAL 级别升级为 error ===
    '@typescript-eslint/no-explicit-any': 'error', // 生产环境禁用any
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',

    // === React 规则 ===
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error', // 生产环境严格检查依赖
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

    // TypeScript 严格规则
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',

    // 异步规则严格
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/return-await': 'error',

    // 复杂度严格控制
    'complexity': ['error', 12], // 生产环境严格控制复杂度
    'max-depth': ['error', 4],
    'max-nested-callbacks': ['error', 3],
    'max-params': ['error', 5],
    'max-len': ['error', {
      code: 100, // 生产环境控制行长度
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true,
      ignoreRegExpLiterals: true
    }],

    // 生产环境禁用console
    'no-console': 'error',
  },

  overrides: [
    ...baseConfig.overrides,
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
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
    },
    {
      files: ['*.jsx', '*.tsx'],
      rules: {
        'indent': ['error', 2, {
          SwitchCase: 1,
          ignoredNodes: ['JSXElement *', 'JSXAttribute *', 'JSXExpressionContainer *']
        }]
      }
    },
    {
      files: ['src/components/**/*.tsx'],
      rules: {
        'complexity': ['error', 10], // 组件严格控制复杂度
        'max-params': ['error', 4],
        '@typescript-eslint/no-explicit-any': 'error' // 生产环境组件禁用any
      }
    },
    {
      files: ['src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
      rules: {
        'complexity': ['error', 8], // Hook严格控制复杂度
        '@typescript-eslint/no-explicit-any': 'error' // 生产环境Hook禁用any
      }
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        'complexity': ['error', 8], // 工具函数严格控制复杂度
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/no-explicit-any': 'error' // 生产环境工具函数禁用any
      }
    },
    {
      files: ['src/controllers/**/*.ts'],
      rules: {
        'complexity': ['error', 12], // 控制器严格控制复杂度
        'max-params': ['error', 4],
        '@typescript-eslint/no-explicit-any': 'error' // 生产环境控制器禁用any
      }
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        'complexity': ['error', 15], // 服务层允许适度复杂度
        '@typescript-eslint/no-explicit-any': 'error' // 生产环境服务层禁用any
      }
    }
  ]
};
