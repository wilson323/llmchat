import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@llmchat/shared-types$": "<rootDir>/../shared-types/src/index.ts",
    "^@llmchat/shared-types/(.*)$": "<rootDir>/../shared-types/src/$1",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/__tests__/**"],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  // 添加超时和性能配置
  testTimeout: 30000, // 30秒测试超时
  maxWorkers: 1, // CI环境中使用单线程避免资源竞争
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  // 强制退出避免挂起
  forceExit: true,
  detectOpenHandles: false,
};

export default config;
