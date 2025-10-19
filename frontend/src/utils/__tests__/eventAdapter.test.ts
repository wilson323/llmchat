/**
 * 事件处理适配器测试
 * 验证事件处理器类型安全和适配功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EventAdapter,
  createChangeHandler,
  createKeyboardHandler,
  createClickHandler,
  createFocusHandler,
  createFormHandler,
  useAdaptedHandlers,
  ValueExtractors,
  createStringInputHandler,
  createNumberInputHandler,
  createSelectHandler,
  EventDebugger
} from '../eventAdapter';
import type {
  ChangeEventHandler,
  LegacyChangeHandler,
  ValueHandler,
  FlexibleChangeHandler,
  KeyboardEventHandler,
  ClickEventHandler,
  FocusEventHandler,
  FormSubmitHandler
} from '@/types/event-handlers';

// Mock functions
const mockOnChange = vi.fn();
const mockOnKeyDown = vi.fn();
const mockOnClick = vi.fn();
const mockOnFocus = vi.fn();
const mockOnSubmit = vi.fn();

describe('EventAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('adaptChangeHandler', () => {
    it('应该适配传统 React 事件处理器', () => {
      const legacyHandler: LegacyChangeHandler = (event) => {
        mockOnChange(event.target.value);
      };

      const adapted = EventAdapter.adaptChangeHandler(legacyHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted?.length).toBe(2); // 统一格式应该有2个参数
    });

    it('应该适配值处理器', () => {
      const valueHandler: ValueHandler<string> = (value) => {
        mockOnChange(value);
      };

      const adapted = EventAdapter.adaptChangeHandler(valueHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted?.length).toBe(2);
    });

    it('应该保持统一格式不变', () => {
      const unifiedHandler: ChangeEventHandler<string> = (value, event) => {
        mockOnChange(value);
      };

      const adapted = EventAdapter.adaptChangeHandler(unifiedHandler);

      expect(adapted).toBe(unifiedHandler);
    });

    it('应该处理 undefined 处理器', () => {
      const adapted = EventAdapter.adaptChangeHandler(undefined);
      expect(adapted).toBeUndefined();
    });
  });

  describe('adaptKeyboardHandler', () => {
    it('应该适配键盘事件处理器', () => {
      const keyboardHandler = (event: KeyboardEvent) => {
        mockOnKeyDown(event.key);
      };

      const adapted = EventAdapter.adaptKeyboardHandler(keyboardHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted?.length).toBe(2);
    });

    it('应该保持统一键盘处理器格式', () => {
      const unifiedHandler: KeyboardEventHandler<string> = (data, event) => {
        mockOnKeyDown(data, event.key);
      };

      const adapted = EventAdapter.adaptKeyboardHandler(unifiedHandler);
      expect(adapted).toBe(unifiedHandler);
    });
  });

  describe('adaptClickHandler', () => {
    it('应该适配点击事件处理器', () => {
      const clickHandler = (event: MouseEvent) => {
        mockOnClick(event.type);
      };

      const adapted = EventAdapter.adaptClickHandler(clickHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted?.length).toBe(2);
    });
  });

  describe('adaptFocusHandler', () => {
    it('应该适配焦点事件处理器', () => {
      const focusHandler = (event: FocusEvent) => {
        mockOnFocus(event.type);
      };

      const adapted = EventAdapter.adaptFocusHandler(focusHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted?.length).toBe(2);
    });
  });

  describe('adaptFormHandler', () => {
    it('应该适配表单提交处理器', () => {
      const formHandler = (event: FormEvent) => {
        mockOnSubmit('submitted');
      };

      const adapted = EventAdapter.adaptFormHandler(formHandler);

      expect(typeof adapted).toBe('function');
      expect(adapted?.length).toBe(2);
    });
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createChangeHandler', () => {
    it('应该创建统一的变更处理器', () => {
      const handler = createChangeHandler<string>((value, event) => {
        mockOnChange(value);
      });

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
      expect(handler?.length).toBe(2);
    });
  });

  describe('createKeyboardHandler', () => {
    it('应该创建统一的键盘处理器', () => {
      const handler = createKeyboardHandler((event) => {
        mockOnKeyDown(event.key);
      });

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });
  });

  describe('createClickHandler', () => {
    it('应该创建统一的点击处理器', () => {
      const handler = createClickHandler((event) => {
        mockOnClick(event.type);
      });

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });
  });
});

describe('ValueExtractors', () => {
  describe('fromInput', () => {
    it('应该从输入事件中提取值', () => {
      const mockEvent = {
        target: { value: 'test value' }
      } as ChangeEvent<HTMLInputElement>;

      const result = ValueExtractors.fromInput(mockEvent);
      expect(result).toBe('test value');
    });
  });

  describe('fromSelect', () => {
    it('应该从选择框事件中提取值', () => {
      const mockEvent = {
        target: { value: 'option1' }
      } as ChangeEvent<HTMLSelectElement>;

      const result = ValueExtractors.fromSelect(mockEvent);
      expect(result).toBe('option1');
    });
  });

  describe('fromCheckbox', () => {
    it('应该从复选框事件中提取布尔值', () => {
      const mockEvent = {
        target: { checked: true }
      } as ChangeEvent<HTMLInputElement>;

      const result = ValueExtractors.fromCheckbox(mockEvent);
      expect(result).toBe(true);
    });
  });

  describe('fromNumberInput', () => {
    it('应该从数字输入框中提取数字值', () => {
      const mockEvent = {
        target: { value: '123' }
      } as ChangeEvent<HTMLInputElement>;

      const result = ValueExtractors.fromNumberInput(mockEvent);
      expect(result).toBe(123);
    });

    it('应该处理空字符串', () => {
      const mockEvent = {
        target: { value: '' }
      } as ChangeEvent<HTMLInputElement>;

      const result = ValueExtractors.fromNumberInput(mockEvent);
      expect(result).toBe(0);
    });
  });

  describe('fromDateInput', () => {
    it('应该从日期输入框中提取日期值', () => {
      const dateString = '2023-12-25';
      const mockEvent = {
        target: { value: dateString }
      } as ChangeEvent<HTMLInputElement>;

      const result = ValueExtractors.fromDateInput(mockEvent);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString().startsWith('2023-12-25')).toBe(true);
    });

    it('应该处理空值', () => {
      const mockEvent = {
        target: { value: '' }
      } as ChangeEvent<HTMLInputElement>;

      const result = ValueExtractors.fromDateInput(mockEvent);
      expect(result).toBeNull();
    });
  });
});

describe('Specialized Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStringInputHandler', () => {
    it('应该创建字符串输入处理器', () => {
      const handler = createStringInputHandler((value, event) => {
        mockOnChange(value);
      });

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });

    it('应该自动去除空格', () => {
      const handler = createStringInputHandler((value, event) => {
        mockOnChange(value);
      }, { trim: true });

      const mockEvent = {
        target: { value: '  test  ' }
      } as ChangeEvent<HTMLInputElement>;

      handler('  test  ', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith('test', mockEvent);
    });

    it('应该限制最大长度', () => {
      const handler = createStringInputHandler((value, event) => {
        mockOnChange(value);
      }, { maxLength: 5 });

      const mockEvent = {
        target: { value: '123456789' }
      } as ChangeEvent<HTMLInputElement>;

      handler('123456789', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith('12345', mockEvent);
    });

    it('应该应用转换函数', () => {
      const handler = createStringInputHandler((value, event) => {
        mockOnChange(value);
      }, { transform: (value) => value.toUpperCase() });

      const mockEvent = {
        target: { value: 'test' }
      } as ChangeEvent<HTMLInputElement>;

      handler('test', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith('TEST', mockEvent);
    });
  });

  describe('createNumberInputHandler', () => {
    it('应该创建数字输入处理器', () => {
      const handler = createNumberInputHandler((value, event) => {
        mockOnChange(value);
      });

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });

    it('应该验证数字格式', () => {
      const handler = createNumberInputHandler((value, event) => {
        mockOnChange(value);
      });

      const mockEvent = {
        target: { value: 'invalid' }
      } as ChangeEvent<HTMLInputElement>;

      handler('invalid', mockEvent);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('应该应用最小值限制', () => {
      const handler = createNumberInputHandler((value, event) => {
        mockOnChange(value);
      }, { min: 10 });

      const mockEvent = {
        target: { value: '5' }
      } as ChangeEvent<HTMLInputElement>;

      handler('5', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith(10, mockEvent);
    });

    it('应该应用最大值限制', () => {
      const handler = createNumberInputHandler((value, event) => {
        mockOnChange(value);
      }, { max: 100 });

      const mockEvent = {
        target: { value: '150' }
      } as ChangeEvent<HTMLInputElement>;

      handler('150', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith(100, mockEvent);
    });

    it('应该应用步长', () => {
      const handler = createNumberInputHandler((value, event) => {
        mockOnChange(value);
      }, { step: 5 });

      const mockEvent = {
        target: { value: '7' }
      } as ChangeEvent<HTMLInputElement>;

      handler('7', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith(5, mockEvent);
    });
  });

  describe('createSelectHandler', () => {
    it('应该创建选择处理器', () => {
      const handler = createSelectHandler((value, event) => {
        mockOnChange(value);
      });

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2);
    });

    it('应该应用解析器', () => {
      const handler = createSelectHandler((value, event) => {
        mockOnChange(value);
      }, {
        parser: (value) => JSON.parse(value)
      });

      const mockEvent = {
        target: { value: '{"id": 1}' }
      } as ChangeEvent<HTMLSelectElement>;

      handler('{"id": 1}', mockEvent);
      expect(mockOnChange).toHaveBeenCalledWith({ id: 1 }, mockEvent);
    });

    it('应该应用验证器', () => {
      const handler = createSelectHandler((value, event) => {
        mockOnChange(value);
      }, {
        validator: (value) => value.startsWith('valid')
      });

      const mockEvent = {
        target: { value: 'invalid' }
      } as ChangeEvent<HTMLSelectElement>;

      handler('invalid', mockEvent);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('应该处理解析错误', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = createSelectHandler((value, event) => {
        mockOnChange(value);
      }, {
        parser: (value) => JSON.parse(value)
      });

      const mockEvent = {
        target: { value: 'invalid json' }
      } as ChangeEvent<HTMLSelectElement>;

      handler('invalid json', mockEvent);
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

describe('EventDebugger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EventDebugger.enable();
  });

  afterEach(() => {
    EventDebugger.disable();
  });

  it('应该启用调试模式', () => {
    EventDebugger.enable();
    // 验证调试模式已启用（通过内部状态，这里只是示例）
    expect(EventDebugger['enabled']).toBe(true);
  });

  it('应该禁用调试模式', () => {
    EventDebugger.disable();
    expect(EventDebugger['enabled']).toBe(false);
  });

  it('应该创建调试包装器', () => {
    const originalFn = vi.fn();
    const wrappedFn = EventDebugger.createDebugWrapper('test', originalFn);

    expect(typeof wrappedFn).toBe('function');

    const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    wrappedFn('arg1', 'arg2');

    expect(consoleSpy).toHaveBeenCalledWith('🔧 Event Debug: test');
    expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');

    consoleSpy.mockRestore();
  });
});

describe('Type Safety Tests', () => {
  it('应该保证类型安全的事件处理器', () => {
    // 编译时类型检查
    const stringHandler: ChangeEventHandler<string> = (value: string, event) => {
      expect(typeof value).toBe('string');
    };

    const numberHandler: ChangeEventHandler<number> = (value: number, event) => {
      expect(typeof value).toBe('number');
    };

    const objectHandler: ChangeEventHandler<{ id: number }> = (value, event) => {
      expect(typeof value).toBe('object');
      expect(typeof value.id).toBe('number');
    };

    expect(typeof stringHandler).toBe('function');
    expect(typeof numberHandler).toBe('function');
    expect(typeof objectHandler).toBe('function');
  });

  it('应该保证适配器类型安全', () => {
    const legacyHandler: LegacyChangeHandler = (event) => {
      expect(event).toBeDefined();
    };

    const valueHandler: ValueHandler<string> = (value) => {
      expect(typeof value).toBe('string');
    };

    const adaptedLegacy = EventAdapter.adaptChangeHandler(legacyHandler);
    const adaptedValue = EventAdapter.adaptChangeHandler(valueHandler);

    expect(typeof adaptedLegacy).toBe('function');
    expect(typeof adaptedValue).toBe('function');
  });
});