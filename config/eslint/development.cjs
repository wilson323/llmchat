// 开发环境ESLint配置 - 宽松规则确保开发不受阻
const baseConfig = require('./base.cjs');

module.exports = {
  ...baseConfig,
  root: true,
  env: {
    ...baseConfig.env,
    node: true,
    browser: true,
    jest: true,
  },
  parserOptions: {
    ...baseConfig.parserOptions,
    ecmaFeatures: {
      jsx: true
    },
    project: ['./tsconfig.json', './tsconfig.scripts.json'],
    tsconfigRootDir: __dirname,
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
  rules: {
    ...baseConfig.rules,

    // 开发环境宽松规则
    
    // React 规则
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/display-name': 'off', // 开发环境允许不设置
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

    // TypeScript 规则 - 开发阶段降级
    '@typescript-eslint/no-explicit-any': 'warn', // 开发环境降级为警告
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-optional-chain': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',

    // 异步规则宽松
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/return-await': 'off',

    // 复杂度规则宽松
    'complexity': ['warn', 25], // 开发环境提高阈值
    'max-depth': ['warn', 8],
    'max-nested-callbacks': ['warn', 6],
    'max-params': ['warn', 8],
    'max-len': ['warn', {
      code: 140, // 开发环境允许更长
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true,
      ignoreRegExpLiterals: true
    }],

    // 开发环境允许console
    'no-console': 'off',
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
        'complexity': ['warn', 20],
        'max-params': ['warn', 6],
        '@typescript-eslint/no-explicit-any': 'off' // 开发阶段组件允许any
      }
    },
    {
      files: ['src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
      rules: {
        'complexity': ['warn', 15],
        '@typescript-eslint/no-explicit-any': 'off'
      }
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        'complexity': ['warn', 15],
        '@typescript-eslint/prefer-nullish-coalescing': 'warn',
        '@typescript-eslint/prefer-optional-chain': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn' // 工具函数允许any但警告
      }
    },
    {
      files: ['src/controllers/**/*.ts'],
      rules: {
        'complexity': ['warn', 20],
        'max-params': ['warn', 6],
        '@typescript-eslint/no-explicit-any': 'warn' // 控制器允许any但警告
      }
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        'complexity': ['warn', 22],
        '@typescript-eslint/no-explicit-any': 'warn' // 服务层允许any但警告
      }
    }
  ]
};
