// 前端ESLint配置 - 使用优化后的配置系统
const frontendConfig = require('../config/eslint/frontend.cjs');

// 根据环境变量选择配置
const env = process.env.NODE_ENV || 'development';
const useDevelopmentConfig = env === 'development' || process.env.ESLINT_DEV === 'true';

if (useDevelopmentConfig) {
  // 开发环境使用宽松配置
  const devConfig = require('../config/eslint/development.cjs');
  module.exports = {
    ...devConfig,
    root: true,
    env: {
      ...devConfig.env,
      browser: true,
    },
    parserOptions: {
      ...devConfig.parserOptions,
      ecmaFeatures: {
        jsx: true
      },
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
    },
    plugins: [...devConfig.plugins, 'react', 'react-hooks'],
    extends: [
      ...devConfig.extends,
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:react/jsx-runtime'
    ],
    settings: {
      react: {
        version: 'detect',
      },
    },
    ignorePatterns: ['dist', 'node_modules', 'build', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      ...devConfig.rules,
      // 开发环境React规则
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
      '@typescript-eslint/explicit-module-boundary-types': 'off' // React组件不需要
    },
    overrides: [
      ...devConfig.overrides,
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
      }
    ]
  };
} else {
  // 生产环境使用标准前端配置
  module.exports = {
    ...frontendConfig,
    parserOptions: {
      ...frontendConfig.parserOptions,
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
    },
    ignorePatterns: ['dist', 'node_modules', 'build', '**/*.test.ts', '**/*.test.tsx']
  };
}
