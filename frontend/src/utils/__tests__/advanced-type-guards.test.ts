/**
 * 高级类型守卫测试
 */

import { describe, it, expect } from 'vitest';
import {
  createObjectGuard,
  createObjectValidator,
  createArrayGuard,
  createArrayValidator,
  createUnionGuard,
  createLiteralGuard,
  createNullableGuard,
  createRecordGuard,
  createCachedGuard,
  createLazyGuard,
  createEnumGuard,
  isUUID,
  isEmail,
  isURL,
  isDateString,
  isTimestamp,
  isBase64
} from '../advanced-type-guards';

describe('高级类型守卫', () => {
  describe('createObjectGuard', () => {
    interface User {
      id: string;
      name: string;
      age?: number;
      email: string;
    }

    const isUser = createObjectGuard<User>({
      id: { validator: isString, required: true },
      name: { validator: isString, required: true },
      age: { validator: (val: unknown): val is number => typeof val === 'number', required: false },
      email: { validator: isEmail, required: true }
    });

    it('should validate complete valid object', () => {
      const validUser = {
        id: '123',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      expect(isUser(validUser)).toBe(true);
    });

    it('should validate object without optional property', () => {
      const validUser = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      expect(isUser(validUser)).toBe(true);
    });

    it('should reject object missing required property', () => {
      const invalidUser = {
        id: '123',
        name: 'John Doe'
        // missing email
      };

      expect(isUser(invalidUser)).toBe(false);
    });

    it('should reject object with invalid property type', () => {
      const invalidUser = {
        id: '123',
        name: 'John Doe',
        age: 'thirty', // should be number
        email: 'john@example.com'
      };

      expect(isUser(invalidUser)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isUser(null)).toBe(false);
      expect(isUser(undefined)).toBe(false);
      expect(isUser('string')).toBe(false);
      expect(isUser(123)).toBe(false);
      expect(isUser([])).toBe(false);
    });
  });

  describe('createObjectValidator', () => {
    interface Product {
      id: string;
      name: string;
      price: number;
      inStock?: boolean;
    }

    const productValidator = createObjectValidator<Product>({
      id: { validator: isString, required: true },
      name: { validator: isString, required: true },
      price: { validator: (val: unknown): val is number => typeof val === 'number', required: true },
      inStock: { validator: (val: unknown): val is boolean => typeof val === 'boolean', required: false, defaultValue: true }
    });

    it('should return valid result for complete object', () => {
      const product = {
        id: 'p1',
        name: 'Product 1',
        price: 99.99,
        inStock: false
      };

      const result = productValidator(product);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(product);
      expect(result.errors).toBeUndefined();
    });

    it('should provide default values for missing optional properties', () => {
      const product = {
        id: 'p1',
        name: 'Product 1',
        price: 99.99
      };

      const result = productValidator(product);
      expect(result.isValid).toBe(true);
      expect(result.data?.inStock).toBe(true);
    });

    it('should return errors for invalid object', () => {
      const invalidProduct = {
        id: 'p1',
        name: 'Product 1'
        // missing price
      };

      const result = productValidator(invalidProduct);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Required property \'price\' is missing');
    });
  });

  describe('createArrayGuard', () => {
    it('should validate array of strings', () => {
      const isStringArray = createArrayGuard(isString);
      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
    });

    it('should reject array with invalid elements', () => {
      const isStringArray = createArrayGuard(isString);
      expect(isStringArray(['a', 123, 'c'])).toBe(false);
    });

    it('should respect length constraints', () => {
      const isStringArray = createArrayGuard(isString, { minLength: 2, maxLength: 4 });
      expect(isStringArray(['a', 'b'])).toBe(true);
      expect(isStringArray(['a'])).toBe(false); // too short
      expect(isStringArray(['a', 'b', 'c', 'd', 'e'])).toBe(false); // too long
    });

    it('should respect exact length constraint', () => {
      const isStringArray = createArrayGuard(isString, { exactLength: 3 });
      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
      expect(isStringArray(['a', 'b'])).toBe(false);
      expect(isStringArray(['a', 'b', 'c', 'd'])).toBe(false);
    });

    it('should handle empty array constraint', () => {
      const isStringArray = createArrayGuard(isString, { allowEmpty: false });
      expect(isStringArray([])).toBe(false);
      expect(isStringArray(['a'])).toBe(true);
    });

    it('should reject non-array values', () => {
      const isStringArray = createArrayGuard(isString);
      expect(isStringArray(null)).toBe(false);
      expect(isStringArray(undefined)).toBe(false);
      expect(isStringArray('string')).toBe(false);
      expect(isStringArray({})).toBe(false);
    });
  });

  describe('createArrayValidator', () => {
    it('should validate array with detailed results', () => {
      const validator = createArrayValidator(
        (value: unknown) => ({
          isValid: typeof value === 'number' && value > 0,
          data: value as number,
          errors: typeof value !== 'number' ? ['Not a number'] : value <= 0 ? ['Not positive'] : []
        })
      );

      const result = validator([1, 2, 3]);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should provide detailed error information', () => {
      const validator = createArrayValidator(isString);

      const result = validator([1, 'valid', 2]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Element at index 0: Type validation failed');
      expect(result.errors).toContain('Element at index 2: Type validation failed');
    });
  });

  describe('createUnionGuard', () => {
    it('should validate union of string and number', () => {
      const isStringOrNumber = createUnionGuard([isString, (val: unknown): val is number => typeof val === 'number']);

      expect(isStringOrNumber('hello')).toBe(true);
      expect(isStringOrNumber(123)).toBe(true);
      expect(isStringOrNumber(true)).toBe(false);
    });
  });

  describe('createLiteralGuard', () => {
    it('should validate literal values', () => {
      const isTheme = createLiteralGuard(['light', 'dark', 'auto'] as const);

      expect(isTheme('light')).toBe(true);
      expect(isTheme('dark')).toBe(true);
      expect(isTheme('auto')).toBe(true);
      expect(isTheme('invalid')).toBe(false);
    });
  });

  describe('createNullableGuard', () => {
    it('should validate nullable values', () => {
      const isNullableString = createNullableGuard(isString);

      expect(isNullableString('hello')).toBe(true);
      expect(isNullableString(null)).toBe(true);
      expect(isNullableString(undefined)).toBe(true);
      expect(isNullableString(123)).toBe(false);
    });
  });

  describe('createRecordGuard', () => {
    it('should validate record with string keys and number values', () => {
      const isStringNumberRecord = createRecordGuard((val: unknown): val is number => typeof val === 'number');

      expect(isStringNumberRecord({ a: 1, b: 2 })).toBe(true);
      expect(isStringNumberRecord({ a: '1', b: 2 })).toBe(false);
    });
  });

  describe('createCachedGuard', () => {
    it('should cache validation results', () => {
      let callCount = 0;
      const expensiveValidator = (val: unknown): val is string => {
        callCount++;
        return typeof val === 'string';
      };

      const cachedValidator = createCachedGuard(expensiveValidator, 2);

      // First call
      expect(cachedValidator('test')).toBe(true);
      expect(callCount).toBe(1);

      // Second call (should use cache)
      expect(cachedValidator('test')).toBe(true);
      expect(callCount).toBe(1);

      // Different value
      expect(cachedValidator('test2')).toBe(true);
      expect(callCount).toBe(2);

      // Original value should still be in cache
      expect(cachedValidator('test')).toBe(true);
      expect(callCount).toBe(2);
    });
  });

  describe('createLazyGuard', () => {
    it('should create validator lazily', () => {
      let factoryCalled = false;
      const lazyValidator = createLazyGuard(() => {
        factoryCalled = true;
        return (val: unknown): val is string => typeof val === 'string';
      });

      expect(factoryCalled).toBe(false);

      // First call should create the validator
      expect(lazyValidator('test')).toBe(true);
      expect(factoryCalled).toBe(true);

      // Subsequent calls should use the created validator
      expect(lazyValidator('test')).toBe(true);
      expect(factoryCalled).toBe(1);
    });
  });
});

describe('预定义验证器', () => {
  describe('isUUID', () => {
    it('should validate UUID strings', () => {
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUUID('550e8400e29b41d4a716446655440000')).toBe(true); // without dashes
      expect(isUUID('invalid-uuid')).toBe(false);
      expect(isUUID(123)).toBe(false);
    });
  });

  describe('isEmail', () => {
    it('should validate email addresses', () => {
      expect(isEmail('user@example.com')).toBe(true);
      expect(isEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isEmail('invalid-email')).toBe(false);
      expect(isEmail('user@')).toBe(false);
      expect(isEmail('@domain.com')).toBe(false);
    });
  });

  describe('isURL', () => {
    it('should validate URLs', () => {
      expect(isURL('https://example.com')).toBe(true);
      expect(isURL('http://localhost:3000')).toBe(true);
      expect(isURL('ftp://files.example.com')).toBe(true);
      expect(isURL('not-a-url')).toBe(false);
      expect(isURL('www.example.com')).toBe(false);
    });
  });

  describe('isDateString', () => {
    it('should validate date strings', () => {
      expect(isDateString('2023-10-18T10:00:00.000Z')).toBe(true);
      expect(isDateString('2023-10-18')).toBe(true);
      expect(isDateString('invalid-date')).toBe(false);
      expect(isDateString(123)).toBe(false);
    });
  });

  describe('isTimestamp', () => {
    it('should validate timestamps', () => {
      const now = Date.now();
      expect(isTimestamp(now)).toBe(true);
      expect(isTimestamp(now - 86400000)).toBe(true); // yesterday
      expect(isTimestamp(now + 86400000)).toBe(true); // tomorrow (within allowed range)
      expect(isTimestamp(0)).toBe(false);
      expect(isTimestamp(-1)).toBe(false);
      expect(isTimestamp('123')).toBe(false);
    });
  });

  describe('isBase64', () => {
    it('should validate base64 strings', () => {
      expect(isBase64('SGVsbG8gV29ybGQ=')).toBe(true);
      expect(isBase64('VGVzdA==')).toBe(true);
      expect(isBase64('Invalid!')).toBe(false);
      expect(isBase64('SGVsbG8')).toBe(false); // not padded correctly
      expect(isBase64(123)).toBe(false);
    });
  });
});

describe('createEnumGuard', () => {
  it('should validate enum values', () => {
    type Status = 'active' | 'inactive' | 'pending';
    const isStatus = createEnumGuard(['active', 'inactive', 'pending'] as const);

    expect(isStatus('active')).toBe(true);
    expect(isStatus('inactive')).toBe(true);
    expect(isStatus('pending')).toBe(true);
    expect(isStatus('invalid')).toBe(false);
    expect(isStatus(123)).toBe(false);
  });
});