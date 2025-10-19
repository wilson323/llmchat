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
  rules: {
    ...baseConfig.rules,

    // React 规则
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
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
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',

    // 复杂度控制
    'complexity': ['warn', 20],
    'max-len': ['warn', {
      code: 120,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true,
      ignoreRegExpLiterals: true
    }]
  },

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
        'complexity': ['warn', 15],
        'max-params': ['warn', 4],
        'react/display-name': 'off',
        '@typescript-eslint/no-explicit-any': 'warn'
      }
    },
    {
      files: ['src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
      rules: {
        'complexity': ['warn', 10],
        '@typescript-eslint/no-explicit-any': 'warn'
      }
    },
    {
      files: ['src/utils/**/*.ts'],
      rules: {
        'complexity': ['warn', 12],
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/no-explicit-any': 'error'
      }
    }
  ]
};
