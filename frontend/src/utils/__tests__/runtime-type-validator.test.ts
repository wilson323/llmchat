/**
 * 运行时类型验证器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RuntimeTypeValidator,
  createPathValidator,
  createBatchValidator,
  stringValidator,
  numberValidator,
  emailValidator,
  arrayValidator,
  objectValidatorFactory
} from '../runtime-type-validator';

describe('RuntimeTypeValidator', () => {
  describe('基本验证功能', () => {
    it('should create validator with schema', () => {
      const validator = RuntimeTypeValidator.create<string>();
      const result = validator.test('test');

      expect(result.isValid).toBe(true);
      expect(result.data).toBe('test');
    });

    it('should handle required validation', () => {
      const validator = RuntimeTypeValidator.create<string>().required();

      expect(validator.test('test').isValid).toBe(true);
      expect(validator.test(null).isValid).toBe(false);
      expect(validator.test(undefined).isValid).toBe(false);
    });

    it('should handle optional validation', () => {
      const validator = RuntimeTypeValidator.create<string>().optional();

      expect(validator.test('test').isValid).toBe(true);
      expect(validator.test(null).isValid).toBe(true);
      expect(validator.test(undefined).isValid).toBe(true);
    });

    it('should handle default values', () => {
      const validator = RuntimeTypeValidator.create<string>().default('default');

      expect(validator.test('test').data).toBe('test');
      expect(validator.test(null).data).toBe('default');
      expect(validator.test(undefined).data).toBe('default');
    });

    it('should handle type validation', () => {
      const validator = RuntimeTypeValidator.create<string>().is(
        (val: unknown): val is string => typeof val === 'string',
        'Must be a string'
      );

      expect(validator.test('test').isValid).toBe(true);
      expect(validator.test(123).isValid).toBe(false);
      expect(validator.test(123).errors).toContain('Must be a string');
    });
  });

  describe('转换功能', () => {
    it('should apply transformations', () => {
      const validator = RuntimeTypeValidator.create<string>()
        .transform(str => str.toUpperCase());

      const result = validator.test('hello');
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('HELLO');
    });

    it('should handle transformation errors', () => {
      const validator = RuntimeTypeValidator.create<string>()
        .transform(() => {
          throw new Error('Transform failed');
        });

      const result = validator.test('test');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transform error: Transform failed');
    });
  });

  describe('管道验证', () => {
    it('should chain validators with pipe', () => {
      const validator1 = RuntimeTypeValidator.create<string>().transform(str => str.trim());
      const validator2 = RuntimeTypeValidator.create<string>().transform(str => str.toUpperCase());

      const chainedValidator = validator1.pipe(validator2);
      const result = chainedValidator.test('  hello  ');

      expect(result.isValid).toBe(true);
      expect(result.data).toBe('HELLO');
    });
  });

  describe('断言功能', () => {
    it('should assert valid values', () => {
      const validator = RuntimeTypeValidator.create<string>();

      expect(() => validator.assert('test')).not.toThrow();
    });

    it('should throw assertion error for invalid values', () => {
      const validator = RuntimeTypeValidator.create<string>();

      expect(() => validator.assert(123)).toThrow('Parse failed: Type validation failed');
    });

    it('should use custom error message', () => {
      const validator = RuntimeTypeValidator.create<string>();

      expect(() => validator.assert(123, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('解析功能', () => {
    it('should parse valid values', () => {
      const validator = RuntimeTypeValidator.create<string>();

      expect(validator.parse('test')).toBe('test');
    });

    it('should throw parse error for invalid values', () => {
      const validator = RuntimeTypeValidator.create<string>();

      expect(() => validator.parse(123)).toThrow('Parse failed: Type validation failed');
    });

    it('should parse with default values', () => {
      const validator = RuntimeTypeValidator.create<string>().default('default');

      expect(validator.parse(null)).toBe('default');
      expect(validator.parse(undefined)).toBe('default');
    });
  });

  describe('异步验证', () => {
    it('should handle async validation', async () => {
      const validator = RuntimeTypeValidator.create<string>().validateAsync(async (value) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          isValid: typeof value === 'string',
          data: value,
          errors: typeof value !== 'string' ? ['Not a string'] : []
        };
      });

      const result = await validator.testAsync('test');
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('test');
    });

    it('should handle async validation errors', async () => {
      const validator = RuntimeTypeValidator.create<string>().validateAsync(async () => {
        throw new Error('Async validation failed');
      });

      const result = await validator.testAsync('test');
      expect(result.isValid).toBe(false);
    });
  });
});

describe('预定义验证器', () => {
  describe('stringValidator', () => {
    it('should validate strings', () => {
      const validator = stringValidator();

      expect(validator.test('hello').isValid).toBe(true);
      expect(validator.test(123).isValid).toBe(false);
    });
  });

  describe('numberValidator', () => {
    it('should validate numbers', () => {
      const validator = numberValidator();

      expect(validator.test(123).isValid).toBe(true);
      expect(validator.test('123').isValid).toBe(false);
    });
  });

  describe('emailValidator', () => {
    it('should validate emails', () => {
      const validator = emailValidator();

      expect(validator.test('user@example.com').isValid).toBe(true);
      expect(validator.test('invalid-email').isValid).toBe(false);
    });
  });

  describe('arrayValidator', () => {
    it('should validate arrays', () => {
      const validator = arrayValidator(stringValidator());

      expect(validator.test(['a', 'b', 'c']).isValid).toBe(true);
      expect(validator.test(['a', 123, 'c']).isValid).toBe(false);
    });

    it('should respect array constraints', () => {
      const validator = arrayValidator(stringValidator(), { minLength: 2, maxLength: 3 });

      expect(validator.test(['a', 'b']).isValid).toBe(true);
      expect(validator.test(['a']).isValid).toBe(false); // too short
      expect(validator.test(['a', 'b', 'c', 'd']).isValid).toBe(false); // too long
    });
  });

  describe('objectValidatorFactory', () => {
    it('should validate objects', () => {
      const validator = objectValidatorFactory({
        name: stringValidator().required(),
        age: numberValidator().optional(),
        email: emailValidator().required()
      });

      const validObject = {
        name: 'John',
        age: 30,
        email: 'john@example.com'
      };

      const result = validator.test(validObject);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(validObject);
    });

    it('should handle missing required properties', () => {
      const validator = objectValidatorFactory({
        name: stringValidator().required(),
        email: emailValidator().required()
      });

      const invalidObject = {
        name: 'John'
        // missing email
      };

      const result = validator.test(invalidObject);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property 'email': Type validation failed");
    });
  });
});

describe('路径验证器', () => {
  let pathValidator: ReturnType<typeof createPathValidator>;

  beforeEach(() => {
    const testObject = {
      user: {
        name: 'John',
        age: 30,
        contact: {
          email: 'john@example.com',
          phone: '123-456-7890'
        }
      },
      settings: {
        theme: 'dark',
        notifications: true
      }
    };

    pathValidator = createPathValidator(testObject);
  });

  it('should validate existing paths', () => {
    expect(() => {
      pathValidator.path('user.name', stringValidator());
    }).not.toThrow();

    expect(() => {
      pathValidator.path('user.age', numberValidator());
    }).not.toThrow();
  });

  it('should throw error for non-existent paths', () => {
    expect(() => {
      pathValidator.path('user.invalid', stringValidator());
    }).toThrow("Path 'user.invalid' does not exist");
  });

  it('should throw error for invalid path validation', () => {
    expect(() => {
      pathValidator.path('user.name', numberValidator());
    }).toThrow("Path 'user.name' validation failed: Type validation failed");
  });

  it('should get path values', () => {
    expect(pathValidator.get('user.name')).toBe('John');
    expect(pathValidator.get('user.age')).toBe(30);
    expect(pathValidator.get('settings.theme')).toBe('dark');
  });

  it('should check path existence', () => {
    expect(pathValidator.has('user.name')).toBe(true);
    expect(pathValidator.has('user.invalid')).toBe(false);
  });

  it('should safely get path values with defaults', () => {
    expect(pathValidator.safeGet('user.name', 'default')).toBe('John');
    expect(pathValidator.safeGet('user.invalid', 'default')).toBe('default');
  });
});

describe('批量验证器', () => {
  it('should validate multiple items', () => {
    const batchValidator = createBatchValidator()
      .add('string1', 'hello', stringValidator())
      .add('number1', 123, numberValidator())
      .add('email1', 'test@example.com', emailValidator());

    const result = batchValidator.getResult();
    expect(result.isValid).toBe(true);
    expect(result.data).toEqual({
      string1: 'hello',
      number1: 123,
      email1: 'test@example.com'
    });
  });

  it('should collect validation errors', () => {
    const batchValidator = createBatchValidator()
      .add('string1', 123, stringValidator()) // invalid
      .add('number1', 'hello', numberValidator()) // invalid
      .add('email1', 'test@example.com', emailValidator()); // valid

    const result = batchValidator.getResult();
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('string1');
    expect(result.errors).toHaveProperty('number1');
    expect(result.errors).not.toHaveProperty('email1');
  });

  it('should clear results', () => {
    const batchValidator = createBatchValidator()
      .add('item1', 'test', stringValidator());

    // First validation
    const result1 = batchValidator.getResult();
    expect(result1.isValid).toBe(true);

    // Clear and revalidate
    batchValidator.clear();
    expect(batchValidator.getResults()).toEqual([]);

    // Add new validation
    batchValidator.add('item2', 123, stringValidator());
    const result2 = batchValidator.getResult();
    expect(result2.isValid).toBe(false);
  });

  it('should handle async validation', async () => {
    const batchValidator = createBatchValidator();

    await batchValidator.addAsync('async1', 'test',
      RuntimeTypeValidator.create<string>().validateAsync(async (value) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { isValid: typeof value === 'string', data: value, errors: [] };
      })
    );

    const result = batchValidator.getResult();
    expect(result.isValid).toBe(true);
    expect(result.data?.async1).toBe('test');
  });
});

describe('错误处理', () => {
  it('should handle validation errors gracefully', () => {
    const validator = RuntimeTypeValidator.create<string>().is(
      (val: unknown): val is string => {
        throw new Error('Validation error');
      },
      'Custom error message'
    );

    const result = validator.test('test');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Custom error message');
  });

  it('should provide detailed error information', () => {
    const validator = RuntimeTypeValidator.create<string>()
      .required()
      .is((val: unknown): val is string => typeof val === 'string', 'Must be string')
      .transform(str => {
        if (str === 'invalid') {
          throw new Error('Transform error');
        }
        return str;
      });

    const result = validator.test('invalid');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Transform error: Transform error');
  });
});

describe('性能测试', () => {
  it('should handle large arrays efficiently', () => {
    const validator = arrayValidator(stringValidator());
    const largeArray = Array.from({ length: 1000 }, (_, i) => `item${i}`);

    const startTime = performance.now();
    const result = validator.test(largeArray);
    const endTime = performance.now();

    expect(result.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Should complete in less than 100ms
  });

  it('should handle deep object validation efficiently', () => {
    const deepValidator = objectValidatorFactory({
      level1: objectValidatorFactory({
        level2: objectValidatorFactory({
          level3: objectValidatorFactory({
            value: stringValidator().required()
          }).required()
        }).required()
      }).required()
    });

    const deepObject = {
      level1: {
        level2: {
          level3: {
            value: 'test'
          }
        }
      }
    };

    const startTime = performance.now();
    const result = deepValidator.test(deepObject);
    const endTime = performance.now();

    expect(result.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(50); // Should complete in less than 50ms
  });
});