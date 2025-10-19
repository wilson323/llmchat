/**
 * 事件处理器兼容性验证器
 * 验证新的事件处理器系统与现有代码的兼容性
 */

import type {
  ChangeEventHandler,
  LegacyChangeHandler,
  ValueHandler,
  FlexibleChangeHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler
} from '../types/event-handlers';
import { EventAdapter } from './eventAdapter';

export interface ValidationResult {
  compatible: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class EventCompatibilityValidator {
  /**
   * 验证变更事件处理器的兼容性
   */
  static validateChangeHandler<T = string>(handler?: FlexibleChangeHandler<T>): ValidationResult {
    const result: ValidationResult = {
      compatible: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!handler) {
      result.warnings.push('处理器为空');
      return result;
    }

    // 检查函数签名
    if (typeof handler !== 'function') {
      result.compatible = false;
      result.errors.push('处理器必须是函数');
      return result;
    }

    // 检查参数数量
    const paramCount = handler.length;
    if (paramCount > 2) {
      result.compatible = false;
      result.errors.push(`处理器参数数量过多 (${paramCount})，应为1或2个参数`);
    } else if (paramCount === 1) {
      result.warnings.push('传统或值处理器格式，建议使用统一格式');
      result.suggestions.push('考虑使用 EventAdapter.adaptChangeHandler() 进行适配');
    } else if (paramCount === 2) {
      // 正确的统一格式
      result.suggestions.push('已使用统一格式，无需修改');
    }

    return result;
  }

  /**
   * 验证点击事件处理器的兼容性
   */
  static validateClickHandler<T = void>(handler?: ((event: MouseEvent) => void) | ((data: T, event: MouseEvent) => void)): ValidationResult {
    const result: ValidationResult = {
      compatible: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!handler) {
      result.warnings.push('处理器为空');
      return result;
    }

    if (typeof handler !== 'function') {
      result.compatible = false;
      result.errors.push('处理器必须是函数');
      return result;
    }

    const paramCount = handler.length;
    if (paramCount > 2) {
      result.compatible = false;
      result.errors.push(`处理器参数数量过多 (${paramCount})，应为1或2个参数`);
    } else if (paramCount === 1) {
      result.warnings.push('传统点击处理器格式，建议使用统一格式');
      result.suggestions.push('考虑使用 EventAdapter.adaptClickHandler() 进行适配');
    }

    return result;
  }

  /**
   * 验证键盘事件处理器的兼容性
   */
  static validateKeyboardHandler<T = void>(handler?: ((event: KeyboardEvent) => void) | ((data: T, event: KeyboardEvent) => void)): ValidationResult {
    const result: ValidationResult = {
      compatible: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!handler) {
      result.warnings.push('处理器为空');
      return result;
    }

    if (typeof handler !== 'function') {
      result.compatible = false;
      result.errors.push('处理器必须是函数');
      return result;
    }

    const paramCount = handler.length;
    if (paramCount > 2) {
      result.compatible = false;
      result.errors.push(`处理器参数数量过多 (${paramCount})，应为1或2个参数`);
    } else if (paramCount === 1) {
      result.warnings.push('传统键盘处理器格式，建议使用统一格式');
      result.suggestions.push('考虑使用 EventAdapter.adaptKeyboardHandler() 进行适配');
    }

    return result;
  }

  /**
   * 验证组件Props的事件处理器兼容性
   */
  static validateComponentProps(props: Record<string, any>): ValidationResult {
    const result: ValidationResult = {
      compatible: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    const eventProps = Object.keys(props).filter(key =>
      key.startsWith('on') &&
      typeof props[key] === 'function'
    );

    for (const propName of eventProps) {
      const handler = props[propName];
      const validation = this.validateByPropName(propName, handler);

      result.compatible = result.compatible && validation.compatible;
      result.errors.push(...validation.errors.map(e => `${propName}: ${e}`));
      result.warnings.push(...validation.warnings.map(w => `${propName}: ${w}`));
      result.suggestions.push(...validation.suggestions.map(s => `${propName}: ${s}`));
    }

    return result;
  }

  /**
   * 根据属性名验证处理器
   */
  private static validateByPropName(propName: string, handler: Function): ValidationResult {
    if (propName === 'onChange') {
      return this.validateChangeHandler(handler);
    } else if (propName === 'onClick') {
      return this.validateClickHandler(handler);
    } else if (propName === 'onKeyDown' || propName === 'onKeyUp' || propName === 'onKeyPress') {
      return this.validateKeyboardHandler(handler);
    } else if (propName === 'onFocus' || propName === 'onBlur') {
      return this.validateFocusHandler(handler);
    } else if (propName === 'onSubmit') {
      return this.validateFormHandler(handler);
    } else {
      return {
        compatible: true,
        errors: [],
        warnings: [`未知的事件属性: ${propName}`],
        suggestions: ['检查属性名是否正确']
      };
    }
  }

  /**
   * 验证焦点事件处理器
   */
  private static validateFocusHandler<T = string>(handler?: ((event: FocusEvent) => void) | ((value: T, event: FocusEvent) => void)): ValidationResult {
    const result: ValidationResult = {
      compatible: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!handler) {
      result.warnings.push('处理器为空');
      return result;
    }

    if (typeof handler !== 'function') {
      result.compatible = false;
      result.errors.push('处理器必须是函数');
      return result;
    }

    const paramCount = handler.length;
    if (paramCount > 2) {
      result.compatible = false;
      result.errors.push(`处理器参数数量过多 (${paramCount})，应为1或2个参数`);
    } else if (paramCount === 1) {
      result.warnings.push('传统焦点处理器格式，建议使用统一格式');
      result.suggestions.push('考虑使用 EventAdapter.adaptFocusHandler() 进行适配');
    }

    return result;
  }

  /**
   * 验证表单提交处理器
   */
  private static validateFormHandler<T = void>(handler?: ((event: FormEvent) => void) | ((data: T, event: FormEvent) => void)): ValidationResult {
    const result: ValidationResult = {
      compatible: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!handler) {
      result.warnings.push('处理器为空');
      return result;
    }

    if (typeof handler !== 'function') {
      result.compatible = false;
      result.errors.push('处理器必须是函数');
      return result;
    }

    const paramCount = handler.length;
    if (paramCount > 2) {
      result.compatible = false;
      result.errors.push(`处理器参数数量过多 (${paramCount})，应为1或2个参数`);
    } else if (paramCount === 1) {
      result.warnings.push('传统表单处理器格式，建议使用统一格式');
      result.suggestions.push('考虑使用 EventAdapter.adaptFormHandler() 进行适配');
    }

    return result;
  }

  /**
   * 生成兼容性报告
   */
  static generateCompatibilityReport(validations: Array<{ name: string; result: ValidationResult }>): string {
    let report = '# 事件处理器兼容性报告\n\n';

    const total = validations.length;
    const compatible = validations.filter(v => v.result.compatible).length;
    const hasErrors = validations.filter(v => v.result.errors.length > 0).length;
    const hasWarnings = validations.filter(v => v.result.warnings.length > 0).length;

    report += `## 概览\n`;
    report += `- 总计检查: ${total}\n`;
    report += `- 兼容: ${compatible} (${((compatible / total) * 100).toFixed(1)}%)\n`;
    report += `- 有错误: ${hasErrors}\n`;
    report += `- 有警告: ${hasWarnings}\n\n`;

    if (hasErrors > 0) {
      report += `## 错误详情\n`;
      validations.filter(v => v.result.errors.length > 0).forEach(v => {
        report += `### ${v.name}\n`;
        v.result.errors.forEach(error => {
          report += `- ❌ ${error}\n`;
        });
        report += '\n';
      });
    }

    if (hasWarnings > 0) {
      report += `## 警告详情\n`;
      validations.filter(v => v.result.warnings.length > 0).forEach(v => {
        report += `### ${v.name}\n`;
        v.result.warnings.forEach(warning => {
          report += `- ⚠️ ${warning}\n`;
        });
        report += '\n';
      });
    }

    const hasSuggestions = validations.filter(v => v.result.suggestions.length > 0).length;
    if (hasSuggestions > 0) {
      report += `## 建议改进\n`;
      validations.filter(v => v.result.suggestions.length > 0).forEach(v => {
        report += `### ${v.name}\n`;
        v.result.suggestions.forEach(suggestion => {
          report += `- 💡 ${suggestion}\n`;
        });
        report += '\n';
      });
    }

    return report;
  }

  /**
   * 批量验证事件处理器
   */
  static validateBatch(items: Array<{ name: string; handler?: Function; type: 'change' | 'click' | 'keyboard' | 'focus' | 'form' }>): Array<{ name: string; result: ValidationResult }> {
    return items.map(item => {
      let result: ValidationResult;

      switch (item.type) {
        case 'change':
          result = this.validateChangeHandler(item.handler);
          break;
        case 'click':
          result = this.validateClickHandler(item.handler);
          break;
        case 'keyboard':
          result = this.validateKeyboardHandler(item.handler);
          break;
        case 'focus':
          result = this.validateFocusHandler(item.handler);
          break;
        case 'form':
          result = this.validateFormHandler(item.handler);
          break;
        default:
          result = {
            compatible: false,
            errors: [`未知的处理器类型: ${item.type}`],
            warnings: [],
            suggestions: ['使用正确的处理器类型']
          };
      }

      return { name: item.name, result };
    });
  }
}

// ==================== 示例使用 ====================

/**
 * 验证示例组件的事件处理器
 */
export function validateExampleComponents() {
  const components = [
    {
      name: 'MessageInput',
      props: {
        onChange: (value: string, event: ChangeEvent) => {},
        onKeyDown: (event: KeyboardEvent) => {},
        onSubmit: (event: FormEvent) => {}
      }
    },
    {
      name: 'AgentSelector',
      props: {
        onClick: (agent: any, event: MouseEvent) => {},
        onKeyDown: (event: KeyboardEvent) => {}
      }
    },
    {
      name: 'LanguageSwitcher',
      props: {
        onChange: (language: string, event: ChangeEvent) => {}
      }
    }
  ];

  const validations = components.map(component => ({
    name: component.name,
    result: EventCompatibilityValidator.validateComponentProps(component.props)
  }));

  return EventCompatibilityValidator.generateCompatibilityReport(validations);
}

/**
 * 验证现有组件的兼容性
 */
export function validateExistingComponents() {
  // 这里可以添加对现有组件的验证
  // 通过导入组件并检查其Props来进行验证
  return '现有组件验证功能待实现';
}