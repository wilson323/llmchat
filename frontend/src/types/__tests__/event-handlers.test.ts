/**
 * 事件处理器类型定义测试
 * 验证类型定义的正确性和兼容性
 */

import { describe, it, expect } from 'vitest';
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  CustomEventHandler,
  LegacyChangeHandler,
  ValueHandler,
  FlexibleChangeHandler,
  adaptLegacyChangeHandler,
  adaptValueChangeHandler,
  adaptChangeHandler,
  extractEventValue,
  extractCheckboxValue,
  extractNumberValue,
  isUnifiedChangeHandler,
  isLegacyChangeHandler,
  isValueHandler,
  createChangeHandler,
  createValidatedChangeHandler,
  createDebouncedChangeHandler,
  stringInputHandler,
  numberInputHandler,
  emailInputHandler
} from '../event-handlers';

describe('Event Handler Types', () => {
  describe('ChangeEventHandler', () => {
    it('应该定义正确的类型签名', () => {
      const handler: ChangeEventHandler<string> = (value: string, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });

    it('应该支持泛型类型', () => {
      const stringHandler: ChangeEventHandler<string> = (value) => {
        expect(typeof value).toBe('string');
      };

      const numberHandler: ChangeEventHandler<number> = (value) => {
        expect(typeof value).toBe('number');
      };

      const objectHandler: ChangeEventHandler<{ id: string }> = (value) => {
        expect(typeof value).toBe('object');
        expect(typeof value.id).toBe('string');
      };

      expect(typeof stringHandler).toBe('function');
      expect(typeof numberHandler).toBe('function');
      expect(typeof objectHandler).toBe('function');
    });
  });

  describe('ClickEventHandler', () => {
    it('应该定义正确的类型签名', () => {
      const handler: ClickEventHandler<string> = (data: string, event) => {
        expect(typeof data).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });
  });

  describe('KeyboardEventHandler', () => {
    it('应该定义正确的类型签名', () => {
      const handler: KeyboardEventHandler<string> = (data: string, event) => {
        expect(typeof data).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });
  });

  describe('FocusEventHandler', () => {
    it('应该定义正确的类型签名', () => {
      const handler: FocusEventHandler<string> = (value: string, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });
  });

  describe('FormSubmitHandler', () => {
    it('应该定义正确的类型签名', () => {
      const handler: FormSubmitHandler<{ name: string }> = (data, event) => {
        expect(typeof data).toBe('object');
        expect(typeof data.name).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });
  });

  describe('CustomEventHandler', () => {
    it('应该支持自定义事件类型', () => {
      const handler: CustomEventHandler<{ customData: string }, CustomEvent> = (data, event) => {
        expect(typeof data).toBe('object');
        expect(typeof data.customData).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });
  });
});

describe('Legacy Types', () => {
  describe('LegacyChangeHandler', () => {
    it('应该定义传统事件处理器类型', () => {
      const handler: LegacyChangeHandler = (event) => {
        expect(event).toBeDefined();
        expect(event.target).toBeDefined();
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(1);
    });
  });

  describe('ValueHandler', () => {
    it('应该定义值处理器类型', () => {
      const handler: ValueHandler<string> = (value) => {
        expect(typeof value).toBe('string');
      };

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(1);
    });

    it('应该支持泛型', () => {
      const stringHandler: ValueHandler<string> = (value) => {
        expect(typeof value).toBe('string');
      };

      const numberHandler: ValueHandler<number> = (value) => {
        expect(typeof value).toBe('number');
      };

      expect(typeof stringHandler).toBe('function');
      expect(typeof numberHandler).toBe('function');
    });
  });

  describe('FlexibleChangeHandler', () => {
    it('应该支持多种处理器类型', () => {
      // 传统处理器
      const legacyHandler: FlexibleChangeHandler<string> = (event) => {
        expect(event.target.value).toBeDefined();
      };

      // 值处理器
      const valueHandler: FlexibleChangeHandler<string> = (value) => {
        expect(typeof value).toBe('string');
      };

      // 统一处理器
      const unifiedHandler: FlexibleChangeHandler<string> = (value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      };

      expect(typeof legacyHandler).toBe('function');
      expect(typeof valueHandler).toBe('function');
      expect(typeof unifiedHandler).toBe('function');
    });
  });
});

describe('Adapter Functions', () => {
  describe('adaptLegacyChangeHandler', () => {
    it('应该适配传统处理器', () => {
      const legacyHandler: LegacyChangeHandler = (event) => {
        expect(event.target.value).toBeDefined();
      };

      const adapted = adaptLegacyChangeHandler<string>(legacyHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted.length).toBe(2);
    });
  });

  describe('adaptValueChangeHandler', () => {
    it('应该适配值处理器', () => {
      const valueHandler: ValueHandler<string> = (value) => {
        expect(typeof value).toBe('string');
      };

      const adapted = adaptValueChangeHandler(valueHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted.length).toBe(2);
    });
  });

  describe('adaptChangeHandler', () => {
    it('应该自动检测并适配处理器', () => {
      const unifiedHandler: ChangeEventHandler<string> = (value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      };

      const adapted = adaptChangeHandler(unifiedHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted.length).toBe(2);
    });
  });
});

describe('Utility Functions', () => {
  describe('extractEventValue', () => {
    it('应该提取事件值', () => {
      const mockEvent = {
        target: { value: 'test value' }
      } as any;

      const value = extractEventValue(mockEvent);
      expect(value).toBe('test value');
    });
  });

  describe('extractCheckboxValue', () => {
    it('应该提取复选框值', () => {
      const mockEvent = {
        target: { checked: true }
      } as any;

      const value = extractCheckboxValue(mockEvent);
      expect(value).toBe(true);
    });
  });

  describe('extractNumberValue', () => {
    it('应该提取数字值', () => {
      const mockEvent = {
        target: { value: '123' }
      } as any;

      const value = extractNumberValue(mockEvent);
      expect(value).toBe(123);
    });

    it('应该处理空字符串', () => {
      const mockEvent = {
        target: { value: '' }
      } as any;

      const value = extractNumberValue(mockEvent);
      expect(value).toBe(0);
    });
  });
});

describe('Type Guards', () => {
  describe('isUnifiedChangeHandler', () => {
    it('应该识别统一处理器', () => {
      const unifiedHandler: ChangeEventHandler<string> = (value, event) => {};
      expect(isUnifiedChangeHandler(unifiedHandler)).toBe(true);
    });

    it('应该拒绝非统一处理器', () => {
      const legacyHandler: LegacyChangeHandler = (event) => {};
      expect(isUnifiedChangeHandler(legacyHandler)).toBe(false);
    });
  });

  describe('isLegacyChangeHandler', () => {
    it('应该识别传统处理器', () => {
      const legacyHandler: LegacyChangeHandler = (event) => {};
      expect(isLegacyChangeHandler(legacyHandler)).toBe(true);
    });

    it('应该拒绝非传统处理器', () => {
      const unifiedHandler: ChangeEventHandler<string> = (value, event) => {};
      expect(isLegacyChangeHandler(unifiedHandler)).toBe(false);
    });
  });

  describe('isValueHandler', () => {
    it('应该识别值处理器', () => {
      const valueHandler: ValueHandler<string> = (value) => {};
      expect(isValueHandler(valueHandler)).toBe(true);
    });

    it('应该拒绝非值处理器', () => {
      const unifiedHandler: ChangeEventHandler<string> = (value, event) => {};
      expect(isValueHandler(unifiedHandler)).toBe(false);
    });
  });
});

describe('Factory Functions', () => {
  describe('createChangeHandler', () => {
    it('应该创建统一处理器', () => {
      const handler = createChangeHandler<string>((value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      });

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });
  });

  describe('createValidatedChangeHandler', () => {
    it('应该创建验证处理器', () => {
      const validator = (value: string) => value.length > 0;
      const baseHandler: ChangeEventHandler<string> = (value, event) => {};

      const validatedHandler = createValidatedChangeHandler(validator, baseHandler);

      expect(typeof validatedHandler).toBe('function');
      expect(validatedHandler.length).toBe(2);
    });
  });

  describe('createDebouncedChangeHandler', () => {
    it('应该创建防抖处理器', () => {
      const baseHandler: ChangeEventHandler<string> = (value, event) => {};

      const debouncedHandler = createDebouncedChangeHandler(baseHandler, 100);

      expect(typeof debouncedHandler).toBe('function');
      expect(debouncedHandler.length).toBe(2);
    });
  });
});

describe('Preset Handlers', () => {
  describe('stringInputHandler', () => {
    it('应该创建字符串输入处理器', () => {
      const baseHandler: ChangeEventHandler<string> = (value, event) => {};

      const stringHandler = stringInputHandler(baseHandler);

      expect(typeof stringHandler).toBe('function');
      expect(stringHandler.length).toBe(2);
    });
  });

  describe('numberInputHandler', () => {
    it('应该创建数字输入处理器', () => {
      const baseHandler: ChangeEventHandler<number> = (value, event) => {};

      const numberHandler = numberInputHandler(baseHandler);

      expect(typeof numberHandler).toBe('function');
      expect(numberHandler.length).toBe(2);
    });
  });

  describe('emailInputHandler', () => {
    it('应该创建邮箱输入处理器', () => {
      const baseHandler: ChangeEventHandler<string> = (value, event) => {};

      const emailHandler = emailInputHandler(baseHandler);

      expect(typeof emailHandler).toBe('function');
      expect(emailHandler.length).toBe(2);
    });
  });
});

describe('Type Compatibility', () => {
  it('应该保持向后兼容性', () => {
    // 传统处理器应该可以传递给期望统一处理器的函数
    const legacyHandler: LegacyChangeHandler = (event) => {};
    const valueHandler: ValueHandler<string> = (value) => {};
    const unifiedHandler: ChangeEventHandler<string> = (value, event) => {};

    // 这些都应该可以赋值给 FlexibleChangeHandler
    const flexible1: FlexibleChangeHandler<string> = legacyHandler;
    const flexible2: FlexibleChangeHandler<string> = valueHandler;
    const flexible3: FlexibleChangeHandler<string> = unifiedHandler;

    expect(typeof flexible1).toBe('function');
    expect(typeof flexible2).toBe('function');
    expect(typeof flexible3).toBe('function');
  });

  it('应该支持类型推断', () => {
    // TypeScript 应该能够推断出正确的类型
    const handler1 = (value: string, event: ChangeEvent<HTMLInputElement>) => {
      // value 应该被推断为 string
      expect(typeof value).toBe('string');
    };

    const handler2 = (value: number, event: ChangeEvent<HTMLInputElement>) => {
      // value 应该被推断为 number
      expect(typeof value).toBe('number');
    };

    // 类型检查应该通过
    const typedHandler1: ChangeEventHandler<string> = handler1;
    const typedHandler2: ChangeEventHandler<number> = handler2;

    expect(typeof typedHandler1).toBe('function');
    expect(typeof typedHandler2).toBe('function');
  });
});

describe('Component Props Types', () => {
  it('应该定义正确的组件 Props 类型', () => {
    // 这里验证组件 Props 类型定义的正确性
    interface TestInputProps {
      value?: string;
      onChange?: ChangeEventHandler<string>;
      onFocus?: FocusEventHandler<string>;
      onBlur?: FocusEventHandler<string>;
      onKeyDown?: KeyboardEventHandler<string>;
    }

    const props: TestInputProps = {
      value: 'test',
      onChange: (value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      },
      onFocus: (value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      },
      onBlur: (value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      },
      onKeyDown: (value, event) => {
        expect(typeof value).toBe('string');
        expect(event).toBeDefined();
      }
    };

    expect(props.value).toBe('test');
    expect(typeof props.onChange).toBe('function');
    expect(typeof props.onFocus).toBe('function');
    expect(typeof props.onBlur).toBe('function');
    expect(typeof props.onKeyDown).toBe('function');
  });
});