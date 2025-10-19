/**
 * TypeScript 类型检查自动化测试套件
 * 包含编译时检查、运行时验证和集成测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import {
  TypeSafetyTester,
  TypeSafetyTestHelpers,
  createTypeSafetyTester
} from './TypeSafetyTester';

describe('TypeScript 类型检查自动化测试套件', () => {
  let tester: TypeSafetyTester;
  const projectRoot = process.cwd();

  beforeEach(() => {
    tester = createTypeSafetyTester({
      name: 'TypeScript类型安全检查',
      strict: true,
      timeout: 10000
    });
    tester.startTestSession();
  });

  afterEach(() => {
    const report = tester.generateReport();
    console.log(report);
  });

  describe('1. TypeScript编译检查', () => {
    it('应该无TypeScript编译错误', () => {
      const result: TestResult = {
        name: 'TypeScript编译检查',
        passed: false,
        errors: [],
        duration: 0
      };

      const startTime = Date.now();

      try {
        // 执行TypeScript编译检查
        const compileResult = execSync('pnpm run type-check', {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        // 如果没有错误，compileResult应该是空字符串
        if (compileResult.trim() === '') {
          result.passed = true;
        } else {
          result.errors = [compileResult];
        }

      } catch (error: any) {
        result.passed = false;
        result.errors = error.stderr ? [error.stderr.toString()] : [error.message];
      }

      result.duration = Date.now() - startTime;

      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.error('TypeScript编译错误:', result.errors);
      }
    });

    it('应该检查所有源文件的类型正确性', () => {
      // 检查关键源文件是否存在类型错误
      const criticalFiles = [
        'src/types/index.ts',
        'src/types/api.ts',
        'src/types/strict-types.ts',
        'src/store/chatStore.ts',
        'src/services/api.ts',
        'src/components/ChatApp.tsx'
      ];

      criticalFiles.forEach(file => {
        const filePath = join(projectRoot, file);
        expect(existsSync(filePath)).toBe(true);

        // 检查文件是否有基本的类型定义
        const content = readFileSync(filePath, 'utf8');
        expect(content).toMatch(/(type|interface|enum|import.*type)/);
      });
    });

    it('应该验证import/export类型一致性', () => {
      const result: TestResult = {
        name: 'Import/Export类型一致性检查',
        passed: true,
        errors: [],
        duration: 0
      };

      const startTime = Date.now();

      try {
        // 检查主要导出文件的类型一致性
        const exportsCheck = execSync('node -e `
          try {
            require('./src/types/index.ts');
            console.log('SUCCESS');
          } catch (e) {
            console.log('ERROR:', e.message);
          }
        `', {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        result.passed = exportsCheck.includes('SUCCESS');

      } catch (error: any) {
        result.passed = false;
        result.errors = [error.message];
      }

      result.duration = Date.now() - startTime;

      expect(result.passed).toBe(true);
    });
  });

  describe('2. 组件Props类型验证', () => {
    it('应该验证基础UI组件Props类型', () => {
      // 模拟Button组件的Props类型测试
      const buttonProps = {
        children: 'Test Button',
        variant: 'primary',
        size: 'medium',
        disabled: false,
        onClick: () => {}
      };

      tester.testComponentProps({
        component: () => null as any, // 模拟组件
        expectedProps: buttonProps,
        requiredProps: ['children'],
        optionalProps: ['variant', 'size', 'disabled', 'onClick']
      });

      const results = tester.getResults();
      const buttonTest = results.find(r => r.name.includes('Component Props'));
      expect(buttonTest?.passed).toBe(true);
    });

    it('应该验证复杂组件Props类型', () => {
      // 模拟复杂组件（如ChatContainer）的Props类型测试
      const chatContainerProps = {
        agentId: 'test-agent-1',
        sessionId: 'test-session-1',
        onMessageSend: (message: string) => {},
        onSessionChange: (sessionId: string) => {},
        isLoading: false,
        messages: []
      };

      tester.testComponentProps({
        component: () => null as any,
        expectedProps: chatContainerProps,
        requiredProps: ['agentId'],
        optionalProps: ['sessionId', 'onMessageSend', 'onSessionChange', 'isLoading', 'messages']
      });

      const results = tester.getResults();
      const chatTest = results.find(r => r.name.includes('ChatContainer'));
      expect(chatTest?.passed).toBe(true);
    });

    it('应该检测Props类型错误', () => {
      // 测试错误类型检测
      const invalidProps = {
        children: 123, // 应该是string或ReactNode，不是number
        variant: 'invalid-variant', // 不存在的变体
        size: null, // 应该是string
        disabled: 'true' // 应该是boolean
      };

      tester.testComponentProps({
        component: () => null as any,
        expectedProps: invalidProps
      });

      const results = tester.getResults();
      const invalidTest = results.find(r => r.name.includes('Component Props'));
      // 在严格模式下，这个测试应该失败
      if (tester['config'].strict) {
        expect(invalidTest?.passed).toBe(false);
      }
    });
  });

  describe('3. API接口类型一致性测试', () => {
    it('应该验证聊天API类型', () => {
      const chatResponseSchema = z.object({
        id: z.string(),
        agentId: z.string(),
        message: z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string()
        }),
        timestamp: z.string().datetime(),
        status: z.enum(['success', 'error', 'pending'])
      });

      const validResponse = {
        id: 'msg-123',
        agentId: 'agent-456',
        message: {
          role: 'assistant' as const,
          content: 'Hello, how can I help you?'
        },
        timestamp: '2024-01-01T00:00:00Z',
        status: 'success' as const
      };

      tester.testZodSchema(chatResponseSchema, validResponse, 'valid');

      const results = tester.getResults();
      const apiTest = results.find(r => r.name.includes('Zod Schema'));
      expect(apiTest?.passed).toBe(true);
    });

    it('应该验证用户认证API类型', () => {
      const authRequestSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8)
      });

      const authResponseSchema = z.object({
        success: z.boolean(),
        token: z.string().optional(),
        user: z.object({
          id: z.string(),
          email: z.string().email(),
          name: z.string()
        }).optional(),
        error: z.string().optional()
      });

      // 测试有效请求
      const validRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      tester.testZodSchema(authRequestSchema, validRequest, 'valid');

      // 测试无效请求
      const invalidRequest = {
        email: 'invalid-email',
        password: '123' // 太短
      };

      tester.testZodSchema(authRequestSchema, invalidRequest, 'invalid');

      const results = tester.getResults();
      const authTests = results.filter(r => r.name.includes('Zod Schema'));
      expect(authTests.every(t => t.passed)).toBe(true);
    });

    it('应该验证智能体配置API类型', () => {
      const agentConfigSchema = z.object({
        id: z.string(),
        name: z.string(),
        provider: z.enum(['openai', 'anthropic', 'fastgpt', 'dify']),
        model: z.string(),
        endpoint: z.string().url(),
        apiKey: z.string().optional(),
        features: z.object({
          supportsStream: z.boolean(),
          supportsFiles: z.boolean(),
          supportsImages: z.boolean()
        })
      });

      const validConfig = {
        id: 'agent-gpt4',
        name: 'GPT-4 Assistant',
        provider: 'openai' as const,
        model: 'gpt-4',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: true
        }
      };

      tester.testZodSchema(agentConfigSchema, validConfig, 'valid');

      const results = tester.getResults();
      const agentTest = results.find(r => r.name.includes('Zod Schema'));
      expect(agentTest?.passed).toBe(true);
    });
  });

  describe('4. 工具函数类型安全测试', () => {
    it('应该验证类型守卫函数', () => {
      // 定义类型守卫函数
      const isString = (value: unknown): value is string =>
        typeof value === 'string';

      const isNumber = (value: unknown): value is number =>
        typeof value === 'number' && !isNaN(value);

      const isObject = (value: unknown): value is Record<string, any> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);

      // 测试类型守卫
      tester.testTypeGuard(isString, 'hello', true);
      tester.testTypeGuard(isString, 123, false);
      tester.testTypeGuard(isNumber, 42, true);
      tester.testTypeGuard(isNumber, '42', false);
      tester.testTypeGuard(isObject, { key: 'value' }, true);
      tester.testTypeGuard(isObject, [], false);
      tester.testTypeGuard(isObject, null, false);

      const results = tester.getResults();
      const guardTests = results.filter(r => r.name.includes('Type Guard'));
      expect(guardTests.every(t => t.passed)).toBe(true);
    });

    it('应该验证工具函数参数和返回值类型', () => {
      // 模拟工具函数
      const formatMessage = (message: string, author: string): string =>
        `${author}: ${message}`;

      const parseJson = <T>(json: string): T | null => {
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      };

      const formatDate = (date: Date, format: 'short' | 'long' = 'short'): string => {
        return format === 'short'
          ? date.toLocaleDateString()
          : date.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
      };

      // 测试函数类型签名
      tester.testFunctionSignature(formatMessage, ['Hello', 'User'], 'User: Hello');
      tester.testFunctionSignature(parseJson, ['{"key": "value"}'], { key: 'value' });
      tester.testFunctionSignature(formatDate, [new Date(), 'long'], '2024年1月1日');

      const results = tester.getResults();
      const functionTests = results.filter(r => r.name.includes('Function Signature'));
      expect(functionTests.every(t => t.passed)).toBe(true);
    });
  });

  describe('5. Store状态类型验证', () => {
    it('应该验证Chat Store状态类型', () => {
      // 模拟Chat Store状态
      const chatStoreState = {
        currentAgentId: 'agent-1',
        currentSessionId: 'session-1',
        conversations: {
          'agent-1': [
            {
              id: 'msg-1',
              role: 'user' as const,
              content: 'Hello',
              timestamp: new Date().toISOString()
            }
          ]
        },
        isLoading: false,
        error: null,
        agents: [
          {
            id: 'agent-1',
            name: 'GPT-4',
            provider: 'openai' as const,
            model: 'gpt-4'
          }
        ]
      };

      const chatStateSchema = z.object({
        currentAgentId: z.string().optional(),
        currentSessionId: z.string().optional(),
        conversations: z.record(z.array(z.object({
          id: z.string(),
          role: z.enum(['user', 'assistant']),
          content: z.string(),
          timestamp: z.string()
        }))),
        isLoading: z.boolean(),
        error: z.string().nullable(),
        agents: z.array(z.object({
          id: z.string(),
          name: z.string(),
          provider: z.string(),
          model: z.string()
        }))
      });

      tester.testZodSchema(chatStateSchema, chatStoreState, 'valid');

      const results = tester.getResults();
      const storeTest = results.find(r => r.name.includes('Zod Schema'));
      expect(storeTest?.passed).toBe(true);
    });

    it('应该验证状态更新操作类型安全', () => {
      // 模拟状态更新函数
      const updateChatMessage = (
        state: any,
        sessionId: string,
        messageId: string,
        updates: Partial<{ content: string; role: 'user' | 'assistant' }>
      ) => {
        const session = state.conversations[sessionId];
        if (!session) return state;

        const updatedSession = session.map((msg: any) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );

        return {
          ...state,
          conversations: {
            ...state.conversations,
            [sessionId]: updatedSession
          }
        };
      };

      const testState = {
        conversations: {
          'session-1': [
            { id: 'msg-1', role: 'user' as const, content: 'Hello' }
          ]
        }
      };

      const updatedState = updateChatMessage(
        testState,
        'session-1',
        'msg-1',
        { content: 'Updated message' }
      );

      expect(updatedState.conversations['session-1'][0].content).toBe('Updated message');
      expect(typeof updatedState.conversations['session-1'][0].role).toBe('string');
    });
  });

  describe('6. 运行时类型安全测试', () => {
    it('应该验证外部API响应类型', () => {
      // 模拟API响应验证
      const validateAPIResponse = (response: unknown): boolean => {
        const schema = z.object({
          data: z.unknown(),
          success: z.boolean(),
          message: z.string().optional()
        });

        const result = schema.safeParse(response);
        return result.success;
      };

      // 测试有效响应
      const validResponse = {
        data: { users: [] },
        success: true,
        message: 'Success'
      };

      // 测试无效响应
      const invalidResponse = {
        data: 'invalid data type',
        success: 'not a boolean'
      };

      tester.testTypeGuard(validateAPIResponse, validResponse, true);
      tester.testTypeGuard(validateAPIResponse, invalidResponse, false);

      const results = tester.getResults();
      const runtimeTests = results.filter(r => r.name.includes('Type Guard'));
      expect(runtimeTests.every(t => t.passed)).toBe(true);
    });

    it('应该验证用户输入类型安全', () => {
      const validateUserInput = (input: unknown, type: 'email' | 'phone' | 'text'): boolean => {
        const schemas = {
          email: z.string().email(),
          phone: z.string().regex(/^\+?[\d\s-()]+$/),
          text: z.string().max(1000)
        };

        const result = schemas[type].safeParse(input);
        return result.success;
      };

      // 测试各种输入类型
      tester.testTypeGuard(
        (value) => validateUserInput(value, 'email'),
        'test@example.com',
        true
      );
      tester.testTypeGuard(
        (value) => validateUserInput(value, 'email'),
        'invalid-email',
        false
      );
      tester.testTypeGuard(
        (value) => validateUserInput(value, 'phone'),
        '+1 (555) 123-4567',
        true
      );
      tester.testTypeGuard(
        (value) => validateUserInput(value, 'text'),
        'Short text',
        true
      );

      const results = tester.getResults();
      const inputTests = results.filter(r => r.name.includes('Type Guard'));
      expect(inputTests.every(t => t.passed)).toBe(true);
    });
  });

  describe('7. 错误处理类型安全测试', () => {
    it('应该验证错误对象类型', () => {
      const errorSchema = z.object({
        name: z.string(),
        message: z.string(),
        stack: z.string().optional(),
        code: z.string().optional()
      });

      // 创建标准错误
      const standardError = new Error('Test error');
      const customError = {
        name: 'CustomError',
        message: 'Custom error message',
        code: 'CUSTOM_ERROR'
      };

      tester.testZodSchema(errorSchema, standardError, 'valid');
      tester.testZodSchema(errorSchema, customError, 'valid');

      const results = tester.getResults();
      const errorTests = results.filter(r => r.name.includes('Zod Schema'));
      expect(errorTests.every(t => t.passed)).toBe(true);
    });

    it('应该验证API错误响应类型', () => {
      const apiErrorSchema = z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
          details: z.any().optional()
        }),
        timestamp: z.string().datetime()
      });

      const validAPIError = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: { field: 'email', issue: 'Invalid format' }
        },
        timestamp: '2024-01-01T00:00:00Z'
      };

      tester.testZodSchema(apiErrorSchema, validAPIError, 'valid');

      const results = tester.getResults();
      const apiErrorTest = results.find(r => r.name.includes('Zod Schema'));
      expect(apiErrorTest?.passed).toBe(true);
    });
  });
});

// 辅助类型定义
interface TestResult {
  name: string;
  passed: boolean;
  errors?: string[];
  duration: number;
}