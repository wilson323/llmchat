/**
 * SafeAccess工具类测试用例
 * 验证可选属性安全访问功能的正确性
 */

import {
  SafeAccess,
  isNullOrUndefined,
  isValidString,
  isValidNumber,
  isValidArray,
  isValidObject,
  isValidDate,
  isValidBoolean,
  safeGet,
  safeGetString,
  safeGetNumber,
  safeGetBoolean,
  safeGetArray,
  safeGetObject,
  safeGetDate,
  validateString,
  validateNumber,
  validateArray,
  safeExecute,
  safeExecuteAsync,
  safeParseJSON,
  safeParseNumber,
  safeParseInt,
  deepFreeze,
  deepClone,
  createReadonlyProxy,
} from '../SafeAccess';

describe('SafeAccess', () => {
  describe('类型守卫函数', () => {
    describe('isNullOrUndefined', () => {
      it('应该正确识别null和undefined', () => {
        expect(isNullOrUndefined(null)).toBe(true);
        expect(isNullOrUndefined(undefined)).toBe(true);
        expect(isNullOrUndefined('')).toBe(false);
        expect(isNullOrUndefined(0)).toBe(false);
        expect(isNullOrUndefined(false)).toBe(false);
        expect(isNullOrUndefined({})).toBe(false);
        expect(isNullOrUndefined([])).toBe(false);
      });
    });

    describe('isValidString', () => {
      it('应该正确识别有效字符串', () => {
        expect(isValidString('hello')).toBe(true);
        expect(isValidString('0')).toBe(true);
        expect(isValidString('false')).toBe(true);
        expect(isValidString('')).toBe(false);
        expect(isValidString(null)).toBe(false);
        expect(isValidString(undefined)).toBe(false);
        expect(isValidString(123)).toBe(false);
        expect(isValidString({})).toBe(false);
        expect(isValidString([])).toBe(false);
      });
    });

    describe('isValidNumber', () => {
      it('应该正确识别有效数字', () => {
        expect(isValidNumber(0)).toBe(true);
        expect(isValidNumber(123)).toBe(true);
        expect(isValidNumber(-456)).toBe(true);
        expect(isValidNumber(3.14)).toBe(true);
        expect(isValidNumber(Infinity)).toBe(false);
        expect(isValidNumber(-Infinity)).toBe(false);
        expect(isValidNumber(NaN)).toBe(false);
        expect(isValidNumber('123')).toBe(false);
        expect(isValidNumber(null)).toBe(false);
        expect(isValidNumber(undefined)).toBe(false);
      });
    });

    describe('isValidArray', () => {
      it('应该正确识别有效数组', () => {
        expect(isValidArray([])).toBe(true);
        expect(isValidArray([1, 2, 3])).toBe(true);
        expect(isValidArray(['a', 'b', 'c'])).toBe(true);
        expect(isValidArray([])).toBe(true);
        expect(isValidArray({})).toBe(false);
        expect(isValidArray(null)).toBe(false);
        expect(isValidArray(undefined)).toBe(false);
        expect(isValidArray('123')).toBe(false);
      });
    });

    describe('isValidObject', () => {
      it('应该正确识别有效对象', () => {
        expect(isValidObject({})).toBe(true);
        expect(isValidObject({ a: 1 })).toBe(true);
        expect(isValidObject(null)).toBe(false);
        expect(isValidObject(undefined)).toBe(false);
        expect(isValidObject([])).toBe(false);
        expect(isValidObject('string')).toBe(false);
        expect(isValidObject(123)).toBe(false);
      });
    });

    describe('isValidDate', () => {
      it('应该正确识别有效日期', () => {
        const validDate = new Date();
        const invalidDate = new Date('invalid');

        expect(isValidDate(validDate)).toBe(true);
        expect(isValidDate(invalidDate)).toBe(false);
        expect(isValidDate(null)).toBe(false);
        expect(isValidDate(undefined)).toBe(false);
        expect(isValidDate('2023-01-01')).toBe(false);
        expect(isValidDate(123)).toBe(false);
      });
    });

    describe('isValidBoolean', () => {
      it('应该正确识别有效布尔值', () => {
        expect(isValidBoolean(true)).toBe(true);
        expect(isValidBoolean(false)).toBe(true);
        expect(isValidBoolean(null)).toBe(false);
        expect(isValidBoolean(undefined)).toBe(false);
        expect(isValidBoolean(1)).toBe(false);
        expect(isValidBoolean(0)).toBe(false);
        expect(isValidBoolean('true')).toBe(false);
        expect(isValidBoolean('false')).toBe(false);
      });
    });
  });

  describe('安全访问函数', () => {
    const testObject = {
      name: 'John',
      age: 30,
      profile: {
        email: 'john@example.com',
        settings: {
          theme: 'dark',
          notifications: true,
          preferences: {
            language: 'zh-CN',
            items: ['item1', 'item2']
          }
        }
      },
      scores: [85, 92, 78],
      metadata: {
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: new Date('2023-12-31T23:59:59Z')
      }
    };

    describe('safeGet', () => {
      it('应该安全获取嵌套属性', () => {
        expect(safeGet(testObject, 'name')).toBe('John');
        expect(safeGet(testObject, 'profile.email')).toBe('john@example.com');
        expect(safeGet(testObject, 'profile.settings.theme')).toBe('dark');
        expect(safeGet(testObject, 'profile.settings.preferences.language')).toBe('zh-CN');
      });

      it('应该处理不存在的路径', () => {
        expect(safeGet(testObject, 'nonexistent', 'default')).toBe('default');
        expect(safeGet(testObject, 'profile.nonexistent', 'default')).toBe('default');
        expect(safeGet(testObject, 'profile.settings.nonexistent.deep', 'default')).toBe('default');
      });

      it('应该支持数组路径', () => {
        expect(safeGet(testObject, ['profile', 'settings', 'theme'])).toBe('dark');
        expect(safeGet(testObject, ['scores', 1])).toBe(92);
        expect(safeGet(testObject, ['profile', 'settings', 'preferences', 'items', 0])).toBe('item1');
      });

      it('应该处理null/undefined对象', () => {
        expect(safeGet(null, 'path', 'default')).toBe('default');
        expect(safeGet(undefined, 'path', 'default')).toBe('default');
        expect(safeGet(null, ['deep', 'path'], 'default')).toBe('default');
      });
    });

    describe('safeGetString', () => {
      it('应该安全获取字符串属性', () => {
        expect(safeGetString(testObject, 'name')).toBe('John');
        expect(safeGetString(testObject, 'profile.email')).toBe('john@example.com');
        expect(safeGetString(testObject, 'profile.settings.theme')).toBe('dark');
      });

      it('应该返回默认值', () => {
        expect(safeGetString(testObject, 'nonexistent')).toBe('');
        expect(safeGetString(testObject, 'nonexistent', 'default')).toBe('default');
        expect(safeGetString(testObject, 'age', 'default')).toBe('default'); // age是数字
      });
    });

    describe('safeGetNumber', () => {
      it('应该安全获取数字属性', () => {
        expect(safeGetNumber(testObject, 'age')).toBe(30);
      });

      it('应该返回默认值', () => {
        expect(safeGetNumber(testObject, 'nonexistent')).toBe(0);
        expect(safeGetNumber(testObject, 'nonexistent', 100)).toBe(100);
        expect(safeGetNumber(testObject, 'name', 100)).toBe(100); // name是字符串
      });
    });

    describe('safeGetBoolean', () => {
      it('应该安全获取布尔属性', () => {
        expect(safeGetBoolean(testObject, 'profile.settings.notifications')).toBe(true);
      });

      it('应该返回默认值', () => {
        expect(safeGetBoolean(testObject, 'nonexistent')).toBe(false);
        expect(safeGetBoolean(testObject, 'nonexistent', true)).toBe(true);
        expect(safeGetBoolean(testObject, 'name', true)).toBe(true); // name是字符串
      });
    });

    describe('safeGetArray', () => {
      it('应该安全获取数组属性', () => {
        expect(safeGetArray(testObject, 'scores')).toEqual([85, 92, 78]);
        expect(safeGetArray(testObject, 'profile.settings.preferences.items')).toEqual(['item1', 'item2']);
      });

      it('应该返回默认值', () => {
        expect(safeGetArray(testObject, 'nonexistent')).toEqual([]);
        expect(safeGetArray(testObject, 'nonexistent', ['default'])).toEqual(['default']);
        expect(safeGetArray(testObject, 'name', ['default'])).toEqual(['default']); // name是字符串
      });
    });

    describe('safeGetObject', () => {
      it('应该安全获取对象属性', () => {
        expect(safeGetObject(testObject, 'profile')).toEqual(testObject.profile);
        expect(safeGetObject(testObject, 'profile.settings')).toEqual(testObject.profile.settings);
      });

      it('应该返回默认值', () => {
        expect(safeGetObject(testObject, 'nonexistent')).toEqual({});
        expect(safeGetObject(testObject, 'nonexistent', { key: 'value' })).toEqual({ key: 'value' });
        expect(safeGetObject(testObject, 'name', { key: 'value' })).toEqual({ key: 'value' }); // name是字符串
      });
    });

    describe('safeGetDate', () => {
      it('应该安全获取日期属性', () => {
        const expectedDate = new Date('2023-12-31T23:59:59Z');
        expect(safeGetDate(testObject, 'metadata.updatedAt')).toEqual(expectedDate);
      });

      it('应该解析日期字符串', () => {
        const expectedDate = new Date('2023-01-01T00:00:00Z');
        expect(safeGetDate(testObject, 'metadata.createdAt')).toEqual(expectedDate);
      });

      it('应该返回默认值', () => {
        expect(safeGetDate(testObject, 'nonexistent')).toBeUndefined();
        expect(safeGetDate(testObject, 'nonexistent', new Date('2000-01-01'))).toEqual(new Date('2000-01-01'));
        expect(safeGetDate(testObject, 'name')).toBeUndefined(); // name是字符串
      });
    });
  });

  describe('运行时类型验证', () => {
    describe('validateString', () => {
      it('应该验证有效字符串', () => {
        const result = validateString('hello', { minLength: 3, maxLength: 10 });
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该验证必填字段', () => {
        const result = validateString(null, { required: true });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('值不能为空');
      });

      it('应该验证长度限制', () => {
        const tooShort = validateString('ab', { minLength: 3 });
        expect(tooShort.isValid).toBe(false);
        expect(tooShort.errors).toContain('字符串长度不能少于3个字符');

        const tooLong = validateString('abcdef', { maxLength: 5 });
        expect(tooLong.isValid).toBe(false);
        expect(tooLong.errors).toContain('字符串长度不能超过5个字符');
      });

      it('应该验证正则表达式', () => {
        const result = validateString('abc123', { pattern: /^[a-z]+$/ });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('字符串格式不正确');
      });

      it('应该验证允许的值', () => {
        const result = validateString('invalid', { allowedValues: ['valid1', 'valid2'] });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('值必须是以下之一: valid1, valid2');
      });

      it('应该执行自定义验证', () => {
        const result = validateString('test', {
          customValidator: (value) => value !== 'test' || '值不能是test'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('值不能是test');
      });
    });

    describe('validateNumber', () => {
      it('应该验证有效数字', () => {
        const result = validateNumber(50, { min: 0, max: 100 });
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该验证范围', () => {
        const tooSmall = validateNumber(-1, { min: 0 });
        expect(tooSmall.isValid).toBe(false);
        expect(tooSmall.errors).toContain('数字不能小于0');

        const tooBig = validateNumber(101, { max: 100 });
        expect(tooBig.isValid).toBe(false);
        expect(tooBig.errors).toContain('数字不能大于100');
      });

      it('应该验证允许的值', () => {
        const result = validateNumber(3, { allowedValues: [1, 2, 4, 5] });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('值必须是以下之一: 1, 2, 4, 5');
      });
    });

    describe('validateArray', () => {
      it('应该验证有效数组', () => {
        const result = validateArray([1, 2, 3], { minLength: 1, maxLength: 5 });
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该验证长度限制', () => {
        const tooShort = validateArray([], { minLength: 1 });
        expect(tooShort.isValid).toBe(false);
        expect(tooShort.errors).toContain('数组长度不能少于1');

        const tooLong = validateArray([1, 2, 3], { maxLength: 2 });
        expect(tooLong.isValid).toBe(false);
        expect(tooLong.errors).toContain('数组长度不能超过2');
      });

      it('应该验证数组项', () => {
        const result = validateArray(['a', 'b', 123], {
          itemValidator: (item) => validateString(item, { required: true })
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('数组索引2'))).toBe(true);
      });
    });
  });

  describe('安全执行和错误处理', () => {
    describe('safeExecute', () => {
      it('应该安全执行函数', () => {
        const result = safeExecute(() => 2 + 2);
        expect(result).toBe(4);
      });

      it('应该处理异常', () => {
        const mockError = jest.fn();
        const result = safeExecute(() => {
          throw new Error('Test error');
        }, 'default', mockError);

        expect(result).toBe('default');
        expect(mockError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('safeExecuteAsync', () => {
      it('应该安全执行异步函数', async () => {
        const result = await safeExecuteAsync(async () => {
          return await Promise.resolve(42);
        });
        expect(result).toBe(42);
      });

      it('应该处理异步异常', async () => {
        const mockError = jest.fn();
        const result = await safeExecuteAsync(
          async () => {
            throw new Error('Async error');
          },
          'default',
          mockError
        );

        expect(result).toBe('default');
        expect(mockError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('safeParseJSON', () => {
      it('应该安全解析JSON', () => {
        const result = safeParseJSON('{"key": "value"}');
        expect(result).toEqual({ key: 'value' });
      });

      it('应该处理无效JSON', () => {
        const result = safeParseJSON('invalid json', { default: true });
        expect(result).toEqual({ default: true });
      });
    });

    describe('safeParseNumber', () => {
      it('应该解析数字字符串', () => {
        expect(safeParseNumber('123')).toBe(123);
        expect(safeParseNumber('45.67')).toBe(45.67);
        expect(safeParseNumber('-89')).toBe(-89);
      });

      it('应该返回默认值', () => {
        expect(safeParseNumber('invalid', 0)).toBe(0);
        expect(safeParseNumber(null, 100)).toBe(100);
        expect(safeParseNumber(undefined, -1)).toBe(-1);
      });
    });

    describe('safeParseInt', () => {
      it('应该解析整数', () => {
        expect(safeParseInt('123')).toBe(123);
        expect(safeParseInt('45.67')).toBe(45);
        expect(safeParseInt('-89')).toBe(-89);
      });

      it('应该支持不同进制', () => {
        expect(safeParseInt('ff', 0, 16)).toBe(255);
        expect(safeParseInt('10', 0, 8)).toBe(8);
        expect(safeParseInt('1010', 0, 2)).toBe(10);
      });

      it('应该返回默认值', () => {
        expect(safeParseInt('invalid', 0)).toBe(0);
        expect(safeParseInt(null, 100)).toBe(100);
      });
    });
  });

  describe('高级工具函数', () => {
    describe('deepFreeze', () => {
      it('应该深度冻结对象', () => {
        const obj = { a: 1, b: { c: 2 } };
        const frozen = deepFreeze(obj);

        expect(Object.isFrozen(frozen)).toBe(true);
        expect(Object.isFrozen(frozen.b)).toBe(true);

        expect(() => {
          (frozen as any).a = 2;
        }).toThrow();

        expect(() => {
          (frozen.b as any).c = 3;
        }).toThrow();
      });
    });

    describe('deepClone', () => {
      it('应该深度克隆对象', () => {
        const original = {
          a: 1,
          b: { c: 2, d: [3, 4] },
          e: new Date('2023-01-01'),
          f: null,
          g: undefined
        };

        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);
        expect(cloned.b.d).not.toBe(original.b.d);
        expect(cloned.e).not.toBe(original.e);
      });

      it('应该处理基本类型', () => {
        expect(deepClone(123)).toBe(123);
        expect(deepClone('string')).toBe('string');
        expect(deepClone(true)).toBe(true);
        expect(deepClone(null)).toBe(null);
        expect(deepClone(undefined)).toBeUndefined();
      });
    });

    describe('createReadonlyProxy', () => {
      it('应该创建只读代理', () => {
        const obj = { a: 1, b: { c: 2 } };
        const readonly = createReadonlyProxy(obj);

        expect(readonly.a).toBe(1);
        expect(readonly.b.c).toBe(2);

        expect(() => {
          (readonly as any).a = 2;
        }).toThrow('只读对象不允许修改');

        expect(() => {
          delete (readonly as any).a;
        }).toThrow('只读对象不允许删除属性');
      });

      it('应该深度创建只读代理', () => {
        const obj = { a: { b: { c: 1 } } };
        const readonly = createReadonlyProxy(obj);

        expect(() => {
          (readonly.a.b as any).c = 2;
        }).toThrow('只读对象不允许修改');
      });
    });
  });

  describe('便捷对象', () => {
    it('应该提供所有功能的便捷访问', () => {
      expect(SafeAccess.isNullOrUndefined).toBeDefined();
      expect(SafeAccess.getString).toBeDefined();
      expect(SafeAccess.getNumber).toBeDefined();
      expect(SafeAccess.execute).toBeDefined();
      expect(SafeAccess.validateString).toBeDefined();
      expect(SafeAccess.deepClone).toBeDefined();
    });

    it('应该与独立函数功能一致', () => {
      const testObj = { name: 'test' };

      expect(SafeAccess.getString(testObj, 'name', 'default')).toBe(
        safeGetString(testObj, 'name', 'default')
      );

      expect(SafeAccess.validateString('test', { required: true })).toEqual(
        validateString('test', { required: true })
      );
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理循环引用', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      expect(() => {
        deepClone(obj);
      }).not.toThrow();
    });

    it('应该处理大量嵌套', () => {
      let deep: any = {};
      let current = deep;

      // 创建100层嵌套
      for (let i = 0; i < 100; i++) {
        current.next = {};
        current = current.next;
      }

      current.value = 'deep value';

      const result = safeGetString(deep, 'next'.repeat(100) + '.value', 'default');
      expect(result).toBe('deep value');
    });

    it('应该处理特殊字符路径', () => {
      const obj = {
        'prop-with-dashes': 'value1',
        'prop.with.dots': 'value2',
        'prop with spaces': 'value3',
        'prop@special': 'value4'
      };

      expect(safeGetString(obj, ['prop-with-dashes'])).toBe('value1');
      expect(safeGetString(obj, ['prop.with.dots'])).toBe('value2');
      expect(safeGetString(obj, ['prop with spaces'])).toBe('value3');
      expect(safeGetString(obj, ['prop@special'])).toBe('value4');
    });
  });
});