// 后端ESLint配置 - 使用优化的共享配置
const backendConfig = require('../config/eslint/backend.cjs');

module.exports = {
  ...backendConfig,
  parserOptions: {
    ...backendConfig.parserOptions,
    tsconfigRootDir: __dirname, // 设置为backend目录
  },
};
