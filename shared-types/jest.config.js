/**
 * Jest 配置文件
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

/** @type {import('jest').Config} */
export default {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],

  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        // 使用专门的测试 tsconfig
        configFile: 'tsconfig.test.json'
      }
    }]
  },

  // 模块名映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // 模块路径映射
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // 覆盖率收集
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts'
  ],

  // 覆盖率报告
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // 覆盖率输出目录
  coverageDirectory: 'coverage',

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // 静默模式（减少输出）
  verbose: true,

  // 测试超时
  testTimeout: 30000,

  // 并发执行
  maxWorkers: '50%',

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 错误时退出
  bail: false,

  // 报告器
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],

  // 全局变量
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },

  // 监视模式忽略模式
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],

  // 强制退出
  forceExit: false,

  // 检测打开的句柄
  detectOpenHandles: false,

  // 检测泄漏
  detectLeaks: false,

  // 错误时的覆盖率收集
  collectCoverageOnlyFrom: null,

  // 最大工作进程数
  maxConcurrency: 5,

  // 通知
  notify: false,
  notifyMode: 'failure-change',

  // 项目配置
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    }
  ]
};