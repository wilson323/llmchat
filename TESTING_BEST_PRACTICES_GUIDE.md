# 测试最佳实践指南

## 📋 概述

本指南为LLMChat项目提供全面的测试最佳实践，确保团队开发高质量的测试代码，并建立可持续的测试文化。

## 🎯 测试原则

### 1. FIRST原则
- **F**ast: 测试应该快速执行
- **I**ndependent: 测试应该相互独立
- **R**epeatable: 测试应该可重复执行
- **S**elf-validating: 测试应该有明确的通过/失败结果
- **T**imely: 测试应该及时编写

### 2. 测试金字塔
```
    E2E Tests (5%)
   ─────────────────
  Integration Tests (25%)
 ─────────────────────────
Unit Tests (70%)
```

### 3. 测试覆盖率原则
- **关键业务逻辑**: 100%覆盖
- **核心功能**: 90%+覆盖
- **辅助功能**: 80%+覆盖
- **工具函数**: 95%+覆盖

## 🛠️ 单元测试最佳实践

### 1. 测试结构

#### AAA模式 (Arrange-Act-Assert)
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', () => {
      // Arrange - 准备测试数据
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      // Act - 执行被测试的操作
      const result = userService.createUser(userData);

      // Assert - 验证结果
      expect(result).toMatchObject({
        id: expect.any(String),
        name: userData.name,
        email: userData.email
      });
      expect(result.password).toBeUndefined(); // 密码不应返回
    });
  });
});
```

#### Given-When-Then模式
```typescript
it('should allow user to login with correct credentials', () => {
  // Given - 给定前置条件
  const credentials = { email: 'test@example.com', password: 'password123' };

  // When - 当执行某个操作时
  const loginResult = authService.login(credentials.email, credentials.password);

  // Then - 那么应该产生预期结果
  expect(loginResult.success).toBe(true);
  expect(loginResult.token).toBeDefined();
});
```

### 2. 测试命名规范

#### 描述性命名
```typescript
✅ 好的命名:
- 'should return user data when valid ID is provided'
- 'should throw error when user ID is not found'
- 'should handle concurrent user creation correctly'

❌ 不好的命名:
- 'test user'
- 'test 1'
- 'it works'
```

#### 测试文件命名
```
✅ 正确命名:
- UserService.test.ts
- ChatContainer.test.tsx
- api-integration.test.ts

❌ 错误命名:
- user_test.ts
- test_user.js
- UserSpec.ts
```

### 3. Mock和Stub的使用

#### Mock最佳实践
```typescript
// ✅ 好的Mock实践
describe('PaymentService', () => {
  let mockPaymentGateway: jest.Mocked<PaymentGateway>;
  let paymentService: PaymentService;

  beforeEach(() => {
    // 创建Mock对象
    mockPaymentGateway = {
      processPayment: jest.fn(),
      refundPayment: jest.fn(),
      getPaymentStatus: jest.fn()
    } as any;

    paymentService = new PaymentService(mockPaymentGateway);
  });

  it('should process payment successfully', async () => {
    // Arrange
    const paymentData = { amount: 100, currency: 'USD' };
    mockPaymentGateway.processPayment.mockResolvedValue({
      id: 'payment-123',
      status: 'success'
    });

    // Act
    const result = await paymentService.processPayment(paymentData);

    // Assert
    expect(result.status).toBe('success');
    expect(mockPaymentGateway.processPayment).toHaveBeenCalledWith(paymentData);
  });
});
```

#### 避免过度Mock
```typescript
// ❌ 不好的实践 - 过度Mock
describe('UserService', () => {
  it('should create user', () => {
    const mockDb = { save: jest.fn() };
    const mockEmail = { send: jest.fn() };
    const mockLogger = { info: jest.fn() };
    const mockCache = { set: jest.fn() };
    // ... 更多Mock

    // 测试逻辑变得复杂且脆弱
  });
});

// ✅ 好的实践 - 只Mock外部依赖
describe('UserService', () => {
  it('should create user', () => {
    // 只Mock真正的外部依赖
    const mockDb = { save: jest.fn().mockResolvedValue({ id: 1 }) };
    const userService = new UserService(mockDb);

    const result = userService.createUser(userData);

    expect(result).resolves.toMatchObject({ id: 1 });
  });
});
```

### 4. 边界条件测试

```typescript
describe('StringUtils', () => {
  describe('truncate', () => {
    it('should handle empty string', () => {
      expect(StringUtils.truncate('', 10)).toBe('');
    });

    it('should handle null input', () => {
      expect(StringUtils.truncate(null as any, 10)).toBe('');
    });

    it('should handle string shorter than limit', () => {
      expect(StringUtils.truncate('short', 10)).toBe('short');
    });

    it('should handle string exactly at limit', () => {
      expect(StringUtils.truncate('exactly', 7)).toBe('exactly');
    });

    it('should handle string longer than limit', () => {
      expect(StringUtils.truncate('very long string', 5)).toBe('very...');
    });

    it('should handle zero limit', () => {
      expect(StringUtils.truncate('anything', 0)).toBe('');
    });

    it('should handle negative limit', () => {
      expect(StringUtils.truncate('anything', -1)).toBe('');
    });
  });
});
```

## 🔄 集成测试最佳实践

### 1. 数据库集成测试

#### 使用测试数据库
```typescript
describe('UserRepository Integration', () => {
  let testDb: Database;
  let userRepository: UserRepository;

  beforeAll(async () => {
    // 创建测试数据库
    testDb = await createTestDatabase();
    userRepository = new UserRepository(testDb);
  });

  afterAll(async () => {
    // 清理测试数据库
    await testDb.close();
  });

  beforeEach(async () => {
    // 每个测试前清理数据
    await testDb.clear();
  });

  it('should save and retrieve user', async () => {
    // Arrange
    const userData = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    // Act
    const savedUser = await userRepository.save(userData);
    const retrievedUser = await userRepository.findById(savedUser.id);

    // Assert
    expect(retrievedUser).toMatchObject(userData);
  });
});
```

#### 事务管理
```typescript
it('should handle transaction rollback', async () => {
  await testDb.transaction(async (trx) => {
    // 第一个操作成功
    await userRepository.save({ name: 'User 1' }, trx);

    // 第二个操作失败
    await userRepository.save({ email: 'invalid-email' }, trx);
  });

  // 验证事务回滚，没有数据被保存
  const users = await userRepository.findAll();
  expect(users).toHaveLength(0);
});
```

### 2. API集成测试

#### 使用SuperTest
```typescript
describe('User API Integration', () => {
  let app: Express;
  let testDb: Database;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createApp(testDb);
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('POST /api/users', () => {
    it('should create user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: userData.name,
        email: userData.email
      });
      expect(response.body.password).toBeUndefined();
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = { name: '', email: 'invalid-email' };

      const response = await request(app)
        .post('/api/users')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });
});
```

### 3. 外部服务集成测试

#### 使用Mock服务
```typescript
describe('EmailService Integration', () => {
  let mockEmailServer: MockEmailServer;
  let emailService: EmailService;

  beforeAll(async () => {
    mockEmailServer = new MockEmailServer();
    await mockEmailServer.start();

    emailService = new EmailService({
      host: 'localhost',
      port: mockEmailServer.port
    });
  });

  afterAll(async () => {
    await mockEmailServer.stop();
  });

  it('should send email successfully', async () => {
    const emailData = {
      to: 'test@example.com',
      subject: 'Test Email',
      body: 'This is a test email'
    };

    await emailService.send(emailData);

    const sentEmails = mockEmailServer.getEmails();
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]).toMatchObject(emailData);
  });
});
```

## 🌐 端到端测试最佳实践

### 1. 使用Playwright

#### 基本E2E测试结构
```typescript
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should register new user successfully', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill registration form
    await page.fill('[data-testid=name-input]', 'John Doe');
    await page.fill('[data-testid=email-input]', 'john@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.fill('[data-testid=confirm-password-input]', 'password123');

    // Submit form
    await page.click('[data-testid=register-button]');

    // Verify successful registration
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
    await expect(page).toHaveURL('/dashboard');
  });
});
```

#### 页面对象模式
```typescript
// pages/RegistrationPage.ts
export class RegistrationPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/register');
  }

  async fillForm(userData: {
    name: string;
    email: string;
    password: string;
  }) {
    await this.page.fill('[data-testid=name-input]', userData.name);
    await this.page.fill('[data-testid=email-input]', userData.email);
    await this.page.fill('[data-testid=password-input]', userData.password);
    await this.page.fill('[data-testid=confirm-password-input]', userData.password);
  }

  async submit() {
    await this.page.click('[data-testid=register-button]');
  }

  async getSuccessMessage() {
    return this.page.locator('[data-testid=success-message]');
  }
}

// 使用页面对象
test('should register new user successfully', async ({ page }) => {
  const registrationPage = new RegistrationPage(page);

  await registrationPage.navigate();
  await registrationPage.fillForm({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123'
  });
  await registrationPage.submit();

  await expect(await registrationPage.getSuccessMessage()).toBeVisible();
});
```

### 2. 测试数据管理

#### 使用工厂模式
```typescript
// factories/UserFactory.ts
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return {
      id: faker.datatype.uuid(),
      name: faker.name.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      createdAt: new Date(),
      ...overrides
    };
  }

  static createForRegistration(overrides: Partial<User> = {}) {
    return this.create({
      email: faker.internet.email(),
      password: 'TestPassword123!',
      ...overrides
    });
  }
}

// 在E2E测试中使用
test('should login with existing user', async ({ page }) => {
  const user = UserFactory.createForRegistration();

  // 首先注册用户
  await registerUser(page, user);

  // 然后登录
  await login(page, user.email, user.password);

  await expect(page.locator('[data-testid=dashboard]')).toBeVisible();
});
```

### 3. 等待和同步策略

#### 使用Playwright的自动等待
```typescript
test('should handle dynamic content loading', async ({ page }) => {
  await page.goto('/dashboard');

  // Playwright自动等待元素可见
  await expect(page.locator('[data-testid=user-profile]')).toBeVisible();

  // 等待网络请求完成
  await page.waitForResponse(response =>
    response.url().includes('/api/user/profile') &&
    response.status() === 200
  );

  // 等待特定条件
  await page.waitForFunction(() =>
    window.appState?.isLoaded === true
  );
});
```

## 🔧 测试工具和配置

### 1. Jest配置最佳实践

#### 基础配置
```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/test/**'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000
};
```

#### 测试环境设置
```typescript
// src/__tests__/setup.ts
import 'jest-extended';

// 全局测试设置
beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});

// 全局Mock
jest.mock('./src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// 测试工具
global.createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides
});
```

### 2. Vitest配置最佳实践

#### 前端测试配置
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.*',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 3. 测试数据管理

#### 测试数据库设置
```typescript
// helpers/testDatabase.ts
export class TestDatabase {
  private static instance: Database;

  static async getInstance(): Promise<Database> {
    if (!this.instance) {
      this.instance = await Database.connect({
        host: 'localhost',
        port: 5433,
        database: 'test_llmchat',
        username: 'test_user',
        password: 'test_password'
      });
    }
    return this.instance;
  }

  static async reset(): Promise<void> {
    const db = await this.getInstance();
    await db.truncateAllTables();
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null as any;
    }
  }
}
```

## 📊 测试报告和监控

### 1. 覆盖率报告

#### 生成详细报告
```bash
# 生成HTML覆盖率报告
npm run test:coverage

# 生成LCOV格式报告
npm run test:coverage:lcov

# 上传到Codecov
npm run test:coverage:upload
```

#### 覆盖率配置
```json
{
  "coverage": {
    "reporter": ["html", "lcov", "text-summary"],
    "exclude": [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "src/**/__tests__/**"
    ],
    "threshold": {
      "global": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### 2. 测试性能监控

#### 性能基准测试
```typescript
describe('Performance Tests', () => {
  it('should process 1000 users within time limit', async () => {
    const users = Array.from({ length: 1000 }, (_, i) =>
      UserFactory.create({ name: `User ${i}` })
    );

    const startTime = performance.now();

    const results = await Promise.all(
      users.map(user => userService.processUser(user))
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000); // 5秒内完成
    expect(results).toHaveLength(1000);
  });
});
```

### 3. 测试质量指标

#### 质量检查脚本
```typescript
// scripts/checkTestQuality.ts
interface QualityMetrics {
  coverage: number;
  testCount: number;
  averageTestTime: number;
  flakyTests: string[];
}

export async function checkTestQuality(): Promise<QualityMetrics> {
  const coverage = await getCoverageReport();
  const testResults = await getTestResults();

  return {
    coverage: coverage.total.lines.pct,
    testCount: testResults.numTotalTests,
    averageTestTime: testResults.avgTestTime,
    flakyTests: identifyFlakyTests(testResults)
  };
}

export function validateQuality(metrics: QualityMetrics): boolean {
  return (
    metrics.coverage >= 80 &&
    metrics.averageTestTime < 1000 &&
    metrics.flakyTests.length === 0
  );
}
```

## 🚨 常见陷阱和解决方案

### 1. 测试陷阱

#### 异步测试陷阱
```typescript
// ❌ 错误 - 没有等待异步操作
it('should create user', () => {
  userService.createUser(userData);
  expect(userRepository.findById(1)).resolves.toBeDefined();
});

// ✅ 正确 - 使用async/await
it('should create user', async () => {
  await userService.createUser(userData);
  const user = await userRepository.findById(1);
  expect(user).toBeDefined();
});
```

#### 时间相关测试陷阱
```typescript
// ❌ 错误 - 使用真实时间
it('should calculate age', () => {
  const user = { birthDate: new Date('1990-01-01') };
  const age = calculateAge(user.birthDate);
  expect(age).toBe(new Date().getFullYear() - 1990);
});

// ✅ 正确 - 使用固定时间
it('should calculate age', () => {
  const fixedDate = new Date('2023-01-01');
  jest.useFakeTimers().setSystemTime(fixedDate);

  const user = { birthDate: new Date('1990-01-01') };
  const age = calculateAge(user.birthDate);

  expect(age).toBe(33);
  jest.useRealTimers();
});
```

#### 随机数据陷阱
```typescript
// ❌ 错误 - 使用随机数据导致测试不稳定
it('should validate email format', () => {
  const randomEmail = faker.internet.email();
  expect(validateEmail(randomEmail)).toBe(true);
});

// ✅ 正确 - 使用固定的测试数据
it('should validate email format', () => {
  const validEmails = [
    'test@example.com',
    'user.name@domain.co.uk',
    'user+tag@example.org'
  ];

  validEmails.forEach(email => {
    expect(validateEmail(email)).toBe(true);
  });
});
```

### 2. 性能陷阱

#### 过度Mock陷阱
```typescript
// ❌ 错误 - 过度Mock导致测试脆弱
describe('UserService', () => {
  it('should create user', () => {
    const mockDb = { save: jest.fn() };
    const mockEmail = { send: jest.fn() };
    const mockLogger = { info: jest.fn() };
    const mockCache = { set: jest.fn() };
    const mockEventBus = { emit: jest.fn() };

    // 当实现改变时，所有Mock都需要更新
  });
});

// ✅ 正确 - 只Mock外部依赖
describe('UserService', () => {
  it('should create user', () => {
    const mockDb = { save: jest.fn().mockResolvedValue({ id: 1 }) };
    const userService = new UserService(mockDb);

    const result = userService.createUser(userData);

    expect(result).resolves.toMatchObject({ id: 1 });
  });
});
```

#### 测试数据泄漏陷阱
```typescript
// ❌ 错误 - 测试之间共享状态
let sharedUser: User;

describe('UserService', () => {
  it('should create user', () => {
    sharedUser = userService.createUser(userData);
    expect(sharedUser.id).toBeDefined();
  });

  it('should update user', () => {
    sharedUser.name = 'Updated Name';
    const updatedUser = userService.updateUser(sharedUser);
    expect(updatedUser.name).toBe('Updated Name');
  });
});

// ✅ 正确 - 每个测试独立
describe('UserService', () => {
  it('should create user', () => {
    const user = userService.createUser(userData);
    expect(user.id).toBeDefined();
  });

  it('should update user', () => {
    const user = userService.createUser(userData);
    user.name = 'Updated Name';
    const updatedUser = userService.updateUser(user);
    expect(updatedUser.name).toBe('Updated Name');
  });
});
```

## 📚 持续学习和改进

### 1. 测试策略演进

#### 从基础到高级
1. **基础阶段**: 单元测试覆盖
2. **中级阶段**: 集成测试和Mock策略
3. **高级阶段**: E2E测试和性能测试
4. **专家阶段**: 测试架构和工具开发

#### 测试驱动开发(TDD)
```typescript
// 1. 先写失败的测试
it('should calculate discount for premium user', () => {
  const user = { type: 'premium', registrationDate: new Date('2020-01-01') };
  const discount = calculateDiscount(user, 100);

  expect(discount).toBe(20); // 20% discount
});

// 2. 实现最小功能
function calculateDiscount(user: User, amount: number): number {
  if (user.type === 'premium') {
    return amount * 0.2;
  }
  return 0;
}

// 3. 重构和优化
function calculateDiscount(user: User, amount: number): number {
  const baseDiscount = user.type === 'premium' ? 0.2 : 0;
  const loyaltyDiscount = calculateLoyaltyDiscount(user.registrationDate);

  return amount * (baseDiscount + loyaltyDiscount);
}
```

### 2. 团队协作

#### 代码审查检查清单
- [ ] 测试覆盖率是否达标
- [ ] 测试是否遵循命名规范
- [ ] 是否有不必要的Mock
- [ ] 是否测试边界条件
- [ ] 测试是否独立且可重复

#### 知识分享
- 定期测试最佳实践分享会
- 测试工具和技巧培训
- 代码审查中的测试指导
- 新成员测试培训计划

### 3. 工具和技术更新

#### 新工具评估
- 定期评估新的测试工具
- 试点新的测试框架
- 跟踪行业最佳实践
- 参与开源测试项目

#### 技术债务管理
- 定期重构旧测试
- 更新过时的测试工具
- 优化慢速测试
- 移除重复的测试代码

---

**总结**:
本指南提供了全面的测试最佳实践，涵盖了从单元测试到端到端测试的各个方面。通过遵循这些实践，团队可以建立高质量、可维护的测试套件，确保代码质量和系统稳定性。

**记住**: 好的测试不是一次性任务，而是需要持续改进和优化的过程。定期回顾和更新测试策略，保持与项目发展同步。

**下一步行动**:
1. 在项目中实施这些最佳实践
2. 定期回顾和更新测试策略
3. 持续学习和改进测试技能
4. 分享知识和经验，提升团队整体测试水平