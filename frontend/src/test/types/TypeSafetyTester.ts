/**
 * TypeScript 类型安全测试框架
 * 提供全面的类型安全测试工具和断言函数
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import type {
  ComponentType,
  ReactNode,
  PropsWithChildren,
  ReactElement
} from 'react';

// 类型安全测试核心类型定义
export interface TypeSafetyTestConfig {
  /** 测试名称 */
  name: string;
  /** 测试描述 */
  description?: string;
  /** 是否启用严格模式 */
  strict?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 自定义断言函数 */
  customAssertions?: TypeAssertion[];
}

export interface TypeAssertion<T = any> {
  /** 断言名称 */
  name: string;
  /** 断言函数 */
  assert: (value: T) => boolean;
  /** 错误消息 */
  message?: string;
}

export interface ComponentTypeTest<T = {}> {
  /** 组件类型 */
  component: ComponentType<T>;
  /** 期望的Props类型 */
  expectedProps: Record<keyof T, any>;
  /** 必需的Props */
  requiredProps?: (keyof T)[];
  /** 可选的Props */
  optionalProps?: (keyof T)[];
}

export interface APITypeTest {
  /** API端点 */
  endpoint: string;
  /** 请求类型 */
  requestType?: z.ZodType;
  /** 响应类型 */
  responseType: z.ZodType;
  /** 测试数据 */
  testData?: any;
}

/**
 * 类型安全测试器主类
 */
export class TypeSafetyTester {
  private config: TypeSafetyTestConfig;
  private testResults: TestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(config: TypeSafetyTestConfig) {
    this.config = {
      strict: true,
      timeout: 5000,
      ...config
    };
  }

  /**
   * 开始测试会话
   */
  startTestSession(): void {
    this.startTime = Date.now();
    this.testResults = [];
    console.log(`🧪 开始类型安全测试: ${this.config.name}`);
  }

  /**
   * 结束测试会话
   */
  endTestSession(): TestSessionSummary {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;

    const summary: TestSessionSummary = {
      testName: this.config.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration,
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.passed).length,
      failedTests: this.testResults.filter(r => !r.passed).length,
      results: this.testResults
    };

    console.log(`✅ 类型安全测试完成: ${summary.passedTests}/${summary.totalTests} 通过 (${duration}ms)`);
    return summary;
  }

  /**
   * 测试组件Props类型安全
   */
  testComponentProps<T>(test: ComponentTypeTest<T>): void {
    const result: TestResult = {
      name: `Component Props: ${test.component.name || 'Anonymous'}`,
      passed: true,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // 检查必需Props
      if (test.requiredProps) {
        test.requiredProps.forEach(prop => {
          if (!(prop in test.expectedProps)) {
            result.passed = false;
            result.errors!.push(`Required prop '${String(prop)}' not found in expected props`);
          }
        });
      }

      // 验证Props类型
      Object.entries(test.expectedProps).forEach(([key, value]) => {
        if (this.config.strict && value === undefined) {
          result.passed = false;
          result.errors!.push(`Prop '${key}' is undefined in strict mode`);
        }
      });

      // 运行自定义断言
      if (this.config.customAssertions) {
        this.config.customAssertions.forEach(assertion => {
          if (!assertion.assert(test.expectedProps)) {
            result.passed = false;
            result.errors!.push(assertion.message || `Custom assertion '${assertion.name}' failed`);
          }
        });
      }

    } catch (error) {
      result.passed = false;
      result.errors = [error instanceof Error ? error.message : String(error)];
    }

    result.duration = Date.now() - startTime;
    this.testResults.push(result);
  }

  /**
   * 测试API类型一致性
   */
  testAPIType(test: APITypeTest): void {
    const result: TestResult = {
      name: `API Type: ${test.endpoint}`,
      passed: true,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // 验证请求类型
      if (test.requestType && test.testData) {
        const requestValidation = test.requestType.safeParse(test.testData);
        if (!requestValidation.success) {
          result.passed = false;
          result.errors!.push(`Request type validation failed: ${requestValidation.error.message}`);
        }
      }

      // 验证响应类型
      if (test.testData) {
        const responseValidation = test.responseType.safeParse(test.testData);
        if (!responseValidation.success) {
          result.passed = false;
          result.errors!.push(`Response type validation failed: ${responseValidation.error.message}`);
        }
      }

    } catch (error) {
      result.passed = false;
      result.errors = [error instanceof Error ? error.message : String(error)];
    }

    result.duration = Date.now() - startTime;
    this.testResults.push(result);
  }

  /**
   * 测试函数类型签名
   */
  testFunctionSignature<T extends (...args: any) => any>(
    fn: T,
    expectedArgs: any[],
    expectedResult: any
  ): void {
    const result: TestResult = {
      name: `Function Signature: ${fn.name || 'Anonymous'}`,
      passed: true,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // 检查函数类型
      if (typeof fn !== 'function') {
        result.passed = false;
        result.errors!.push('Provided value is not a function');
        return;
      }

      // 尝试调用函数
      const actualResult = fn(...expectedArgs);

      // 验证返回值类型
      if (typeof expectedResult !== typeof actualResult) {
        result.passed = false;
        result.errors!.push(
          `Return type mismatch: expected ${typeof expectedResult}, got ${typeof actualResult}`
        );
      }

    } catch (error) {
      result.passed = false;
      result.errors = [error instanceof Error ? error.message : String(error)];
    }

    result.duration = Date.now() - startTime;
    this.testResults.push(result);
  }

  /**
   * 测试类型守卫函数
   */
  testTypeGuard<T>(
    typeGuard: (value: unknown) => value is T,
    testValue: unknown,
    expectedResult: boolean
  ): void {
    const result: TestResult = {
      name: `Type Guard: ${typeGuard.name || 'Anonymous'}`,
      passed: true,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      const actualResult = typeGuard(testValue);

      if (actualResult !== expectedResult) {
        result.passed = false;
        result.errors!.push(
          `Type guard result mismatch: expected ${expectedResult}, got ${actualResult}`
        );
      }

      // 如果类型守卫返回true，确保类型被正确缩小
      if (actualResult) {
        // 这里我们只能模拟类型缩小的验证
        // 实际的类型缩小需要在编译时验证
      }

    } catch (error) {
      result.passed = false;
      result.errors = [error instanceof Error ? error.message : String(error)];
    }

    result.duration = Date.now() - startTime;
    this.testResults.push(result);
  }

  /**
   * 测试Zod Schema类型安全
   */
  testZodSchema<T>(
    schema: z.ZodType<T>,
    testValue: unknown,
    expectedResult: 'valid' | 'invalid'
  ): void {
    const result: TestResult = {
      name: `Zod Schema: ${schema.constructor.name}`,
      passed: true,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      const validation = schema.safeParse(testValue);

      if (expectedResult === 'valid' && !validation.success) {
        result.passed = false;
        result.errors!.push(`Expected valid value, but validation failed: ${validation.error.message}`);
      } else if (expectedResult === 'invalid' && validation.success) {
        result.passed = false;
        result.errors!.push('Expected invalid value, but validation passed');
      }

    } catch (error) {
      result.passed = false;
      result.errors = [error instanceof Error ? error.message : String(error)];
    }

    result.duration = Date.now() - startTime;
    this.testResults.push(result);
  }

  /**
   * 获取测试结果
   */
  getResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * 生成测试报告
   */
  generateReport(): string {
    const summary = this.endTestSession();

    let report = `# 类型安全测试报告\n\n`;
    report += `## 测试概览\n`;
    report += `- 测试名称: ${summary.testName}\n`;
    report += `- 总测试数: ${summary.totalTests}\n`;
    report += `- 通过测试: ${summary.passedTests}\n`;
    report += `- 失败测试: ${summary.failedTests}\n`;
    report += `- 执行时间: ${summary.duration}ms\n`;
    report += `- 成功率: ${((summary.passedTests / summary.totalTests) * 100).toFixed(2)}%\n\n`;

    if (summary.failedTests > 0) {
      report += `## 失败测试详情\n`;
      summary.results
        .filter(r => !r.passed)
        .forEach(result => {
          report += `### ${result.name}\n`;
          report += `- 错误: ${result.errors?.join(', ')}\n`;
          report += `- 耗时: ${result.duration}ms\n\n`;
        });
    }

    return report;
  }
}

// 支持类型定义
export interface TestResult {
  name: string;
  passed: boolean;
  errors?: string[];
  duration: number;
}

export interface TestSessionSummary {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
}

// 预定义的类型断言
export const commonTypeAssertions: Record<string, TypeAssertion> = {
  isNotNull: {
    name: 'isNotNull',
    assert: (value) => value !== null && value !== undefined,
    message: 'Value should not be null or undefined'
  },
  isString: {
    name: 'isString',
    assert: (value) => typeof value === 'string',
    message: 'Value should be a string'
  },
  isNumber: {
    name: 'isNumber',
    assert: (value) => typeof value === 'number' && !isNaN(value),
    message: 'Value should be a valid number'
  },
  isBoolean: {
    name: 'isBoolean',
    assert: (value) => typeof value === 'boolean',
    message: 'Value should be a boolean'
  },
  isObject: {
    name: 'isObject',
    assert: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    message: 'Value should be an object'
  },
  isArray: {
    name: 'isArray',
    assert: (value) => Array.isArray(value),
    message: 'Value should be an array'
  }
};

// 便捷的测试工厂函数
export function createTypeSafetyTester(config: TypeSafetyTestConfig): TypeSafetyTester {
  return new TypeSafetyTester(config);
}

// 全局类型安全测试助手
export const TypeSafetyTestHelpers = {
  createTester: createTypeSafetyTester,
  assertions: commonTypeAssertions,

  // 创建常用的组件类型测试
  createComponentTest: <T>(
    component: ComponentType<T>,
    expectedProps: Record<keyof T, any>
  ): ComponentTypeTest<T> => ({
    component,
    expectedProps
  }),

  // 创建常用的API类型测试
  createAPITest: (
    endpoint: string,
    responseType: z.ZodType,
    testData?: any
  ): APITypeTest => ({
    endpoint,
    responseType,
    testData
  })
};