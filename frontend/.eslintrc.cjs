// ESLint配置 - 已迁移到扁平配置 (eslint.config.js)
// 此文件保留用于向后兼容，实际配置请查看 eslint.config.js

console.warn('ESLint配置已迁移到 eslint.config.js，请使用新的扁平配置格式');
console.warn('运行 pnpm lint 将自动使用新的配置文件');

// 导入新配置以保持兼容性
try {
  const newConfig = require('./eslint.config.js');
  module.exports = newConfig;
} catch (error) {
  console.error('无法加载新的ESLint配置:', error.message);

  // 回退到基础配置
  module.exports = {
    env: {
      browser: true,
      es2021: true,
      node: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: './tsconfig.json',
    },
    plugins: [
      'react',
      'react-hooks',
      '@typescript-eslint',
    ],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  };
}
