// ESLint 9.x 扁平配置文件 - LLMChat前端项目
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // 全局配置
  {
    ignores: [
      // 构建产物
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      'node_modules/**',

      // 配置文件
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'tailwind.config.js',

      // 测试覆盖率报告
      'coverage/**',

      // 临时文件
      '.temp/**',
      '.cache/**',
      'temp/**',

      // 文档和示例
      'examples/**',
      'docs/**',
      '**/*.md',

      // 类型定义文件（通常不需要ESLint检查）
      'types/**/*.d.ts',

      // 生成的文件
      'auto-imports.d.ts',
      'components.d.ts',
    ],
  },

  // 基础JavaScript配置
  js.configs.recommended,

  // TypeScript配置
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },

    plugins: {
      '@typescript-eslint': tseslint,
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
      'import': importPlugin,
      'prettier': prettier,
    },

    rules: {
      // === BLOCKER 级别 - 阻塞开发，必须立即修复 ===

      // TypeScript基础规则
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': 'allow-with-description',
        'ts-nocheck': 'allow-with-description',
        'ts-check': 'allow-with-description',
        minimumDescriptionLength: 10,
      }],

      // JavaScript基础规则
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
        allowTaggedTemplates: true,
        enforceForJSX: true,
      }],

      // React规则
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-key': 'error',
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
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],

      // React Hooks规则
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import规则
      'import/no-unresolved': 'off', // TypeScript处理这个
      'import/named': 'error',
      'import/default': 'error',
      'import/no-absolute-path': 'error',
      'import/no-dynamic-require': 'warn',
      'import/no-self-import': 'error',
      'import/no-cycle': 'error',
      'import/no-useless-path-segments': 'error',
      'import/no-relative-packages': 'error',

      // === CRITICAL 级别 - 关键类型安全，需要尽快修复 ===

      // TypeScript类型安全
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // 异步操作
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/return-await': 'error',

      // React类型安全
      'react/prop-types': 'off', // TypeScript处理prop类型
      'react/display-name': 'warn',
      'react/jsx-uses-react': 'off', // React 17+不需要

      // === MAJOR 级别 - 代码质量，需要计划修复 ===

      // 基础代码质量
      'prefer-const': 'error',
      'no-var': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-extra-boolean-cast': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],

      // 复杂度控制
      'complexity': ['warn', 15],
      'max-depth': ['warn', 5],
      'max-params': ['warn', 6],
      'max-nested-callbacks': ['warn', 4],

      // React性能和最佳实践
      'react/jsx-no-bind': 'warn',
      'react/jsx-fragments': ['warn', 'syntax'],
      'react/jsx-pascal-case': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
      'react/no-array-index-key': 'warn',
      'react/no-redundant-should-component-update': 'warn',
      'react/forbid-prop-types': 'error',
      'react/no-typos': 'error',

      // === MINOR 级别 - 代码风格，可自动修复 ===

      // 基础风格
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

      // Prettier集成
      'prettier/prettier': 'error',

      // 长度限制
      'max-len': ['warn', {
        code: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreComments: true,
        ignoreRegExpLiterals: true,
        ignorePattern: '^import\\s.*\\sfrom\\s.+',
      }],

      // 魔数限制
      'no-magic-numbers': ['warn', {
        ignore: [
          -1, 0, 1, 2, 5, 7, 10, 100, 1000, // 常用数字
          15, 30, 60, 90, 180, 365, // 时间相关
          24, 36, 48, 72, 96, 120, 144, 168, // 小时制
          300, 500, 3000, 5000, // 毫秒相关
          80, 85, 95, 99, // 百分比
          1024, 2048, 4096, 8192, // 计算机相关
          0.1, 0.2, 0.3, 0.5, 0.8, // 小数
          3.14, 2.718, // 数学常数
        ],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        enforceConst: true,
        detectObjects: false,
        ignoreNumericLiteralTypes: true,
      }],

      // Console使用（开发环境宽松）
      'no-console': 'warn',
      'no-debugger': 'error',
    },

    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
  },

  // 测试文件配置
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-magic-numbers': 'off',
      'max-len': 'off',
      'complexity': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'react/display-name': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Storybook文件配置
  {
    files: ['**/*.stories.@(ts|tsx|js|jsx)', '**/.storybook/**/*'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react/display-name': 'off',
    },
  },

  // 配置文件
  {
    files: ['*.config.js', '*.config.ts', 'vite.config.ts', 'tailwind.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-console': 'off',
    },
  },

  // Prettier配置（必须在最后）
  prettierConfig,
];