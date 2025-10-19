/**
 * 类型守卫工具库测试
 * 
 * @module type-guards.test
 */

import { describe, it, expect } from 'vitest';
import {
  isDefined,
  isOfType,
  getOrDefault,
  filterDefined,
  isArrayOf,
  filterByType,
  assertDefined,
  assertType,
  isString,
  isNumber,
  isBoolean,
  isObject,
  hasProperty,
  safeJsonParse,
  createEnumGuard,
} from '../type-guards';

describe('type-guards', () => {
  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isOfType', () => {
    const isPositive = (val: unknown): val is number => {
      return typeof val === 'number' && val > 0;
    };

    it('should return true for matching type', () => {
      expect(isOfType(42, isPositive)).toBe(true);
    });

    it('should return false for non-matching type', () => {
      expect(isOfType(-1, isPositive)).toBe(false);
      expect(isOfType('42', isPositive)).toBe(false);
    });
  });

  describe('getOrDefault', () => {
    interface TestObj {
      value?: number;
      text?: string;
    }

    it('should return value if defined', () => {
      const obj: TestObj = { value: 42 };
      expect(getOrDefault(obj, 'value', 0)).toBe(42);
    });

    it('should return default if undefined', () => {
      const obj: TestObj = {};
      expect(getOrDefault(obj, 'value', 0)).toBe(0);
    });
  });

  describe('filterDefined', () => {
    it('should filter out null and undefined', () => {
      const input = [1, null, 2, undefined, 3];
      const output = filterDefined(input);
      expect(output).toEqual([1, 2, 3]);
    });

    it('should keep falsy values except null/undefined', () => {
      const input = [0, '', false, null, undefined];
      const output = filterDefined(input);
      expect(output).toEqual([0, '', false]);
    });
  });

  describe('isArrayOf', () => {
    const isNum = (val: unknown): val is number => typeof val === 'number';

    it('should return true for array of matching type', () => {
      expect(isArrayOf([1, 2, 3], isNum)).toBe(true);
    });

    it('should return false if not array', () => {
      expect(isArrayOf('not array', isNum)).toBe(false);
      expect(isArrayOf(null, isNum)).toBe(false);
    });

    it('should return false if any element does not match', () => {
      expect(isArrayOf([1, '2', 3], isNum)).toBe(false);
    });
  });

  describe('filterByType', () => {
    const isNum = (val: unknown): val is number => typeof val === 'number';

    it('should filter elements by type', () => {
      const mixed = [1, 'text', 2, null, 3, undefined, 'more'];
      const numbers = filterByType(mixed, isNum);
      expect(numbers).toEqual([1, 2, 3]);
    });
  });

  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined('')).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
    });

    it('should throw for null and undefined', () => {
      expect(() => assertDefined(null)).toThrow('Value must be defined');
      expect(() => assertDefined(undefined)).toThrow('Value must be defined');
    });

    it('should throw with custom message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('assertType', () => {
    const isPositive = (val: unknown): val is number => {
      return typeof val === 'number' && val > 0;
    };

    it('should not throw for matching type', () => {
      expect(() => assertType(42, isPositive)).not.toThrow();
    });

    it('should throw for non-matching type', () => {
      expect(() => assertType(-1, isPositive)).toThrow('Value does not match expected type');
    });

    it('should throw with custom message', () => {
      expect(() => assertType('text', isPositive, 'Must be positive number')).toThrow('Must be positive number');
    });
  });

  describe('primitive type guards', () => {
    describe('isString', () => {
      it('should identify strings', () => {
        expect(isString('text')).toBe(true);
        expect(isString('')).toBe(true);
        expect(isString(42)).toBe(false);
        expect(isString(null)).toBe(false);
      });
    });

    describe('isNumber', () => {
      it('should identify numbers', () => {
        expect(isNumber(42)).toBe(true);
        expect(isNumber(0)).toBe(true);
        expect(isNumber(-1)).toBe(true);
        expect(isNumber(3.14)).toBe(true);
      });

      it('should return false for NaN', () => {
        expect(isNumber(NaN)).toBe(false);
      });

      it('should return false for non-numbers', () => {
        expect(isNumber('42')).toBe(false);
        expect(isNumber(null)).toBe(false);
      });
    });

    describe('isBoolean', () => {
      it('should identify booleans', () => {
        expect(isBoolean(true)).toBe(true);
        expect(isBoolean(false)).toBe(true);
        expect(isBoolean(0)).toBe(false);
        expect(isBoolean(null)).toBe(false);
      });
    });

    describe('isObject', () => {
      it('should identify objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ key: 'value' })).toBe(true);
      });

      it('should return false for null, arrays, primitives', () => {
        expect(isObject(null)).toBe(false);
        expect(isObject([])).toBe(false);
        expect(isObject('string')).toBe(false);
        expect(isObject(42)).toBe(false);
      });
    });
  });

  describe('hasProperty', () => {
    it('should identify objects with specific property', () => {
      const obj = { id: '123', name: 'Test' };
      expect(hasProperty(obj, 'id')).toBe(true);
      expect(hasProperty(obj, 'name')).toBe(true);
    });

    it('should return false for missing property', () => {
      const obj = { id: '123' };
      expect(hasProperty(obj, 'name')).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasProperty(null, 'id')).toBe(false);
      expect(hasProperty('string', 'length')).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key":"value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should return default for invalid JSON', () => {
      const defaultValue = { fallback: true };
      const result = safeJsonParse('invalid json', defaultValue);
      expect(result).toBe(defaultValue);
    });

    it('should return default for null/undefined', () => {
      const defaultValue = { fallback: true };
      expect(safeJsonParse(null, defaultValue)).toBe(defaultValue);
      expect(safeJsonParse(undefined, defaultValue)).toBe(defaultValue);
    });
  });

  describe('createEnumGuard', () => {
    type Status = 'active' | 'inactive' | 'pending';
    const statusValues: readonly Status[] = ['active', 'inactive', 'pending'];
    const isStatus = createEnumGuard(statusValues);

    it('should validate enum values', () => {
      expect(isStatus('active')).toBe(true);
      expect(isStatus('inactive')).toBe(true);
      expect(isStatus('pending')).toBe(true);
    });

    it('should reject non-enum values', () => {
      expect(isStatus('invalid')).toBe(false);
      expect(isStatus('')).toBe(false);
      expect(isStatus(null)).toBe(false);
      expect(isStatus(123)).toBe(false);
    });
  });
});
