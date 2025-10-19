// 后端开发环境ESLint配置 - 使用开发环境配置
const developmentConfig = require('../config/eslint/development.cjs');

module.exports = {
  ...developmentConfig,
  root: true,
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/__tests__/setup.ts',
    'jest.config.ts',
    'scripts/**/*'
  ]
};
