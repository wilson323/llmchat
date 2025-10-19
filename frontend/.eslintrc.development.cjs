// 前端开发环境ESLint配置 - 使用开发环境配置
const developmentConfig = require('../config/eslint/development.cjs');

module.exports = {
  ...developmentConfig,
  root: true,
  ignorePatterns: [
    'dist',
    'node_modules',
    'build',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx'
  ]
};
