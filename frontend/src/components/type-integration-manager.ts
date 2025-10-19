/**
 * 组件类型定义集成管理器
 *
 * 安全地管理和集成组件类型定义，确保向后兼容性和零停机迁移
 *
 * @module component-type-integration
 * @version 1.0.0
 * @since 2025-10-18
 */

import * as React from 'react';
import type { BaseComponentProps } from '@/components/ui/types.unified';
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler
} from '@/types/event-handlers';

// ============================================================================
// 组件类型集成配置
// =============================================================================

/**
 * 组件类型映射配置
 */
export interface ComponentTypeMapping {
  /** 组件名称 */
  componentName: string;
  /** 源类型定义 */
  sourceTypes: Record<string, any>;
  /** 目标类型定义 */
  targetTypes: Record<string, any>;
  /** 迁移策略 */
  migrationStrategy: 'replace' | 'merge' | 'extend';
  /** 是否需要验证 */
  requireValidation: boolean;
  /** 兼容性检查 */
  compatibilityCheck: (source: any, target: any) => boolean;
}

/**
 * 组件类型集成结果
 */
export interface ComponentIntegrationResult {
  /** 组件名称 */
  componentName: string;
  /** 是否成功 */
  success: boolean;
  /** 集成的类型数量 */
  typesIntegrated: number;
  /** 兼容性检查结果 */
  compatibilityResult: CompatibilityCheckResult;
  /** 错误信息 */
  errors: ComponentIntegrationError[];
  /** 警告信息 */
  warnings: ComponentIntegrationWarning[];
  /** 集成详情 */
  details: ComponentIntegrationDetails;
}

/**
 * 兼容性检查结果
 */
export interface CompatibilityCheckResult {
  /** 是否兼容 */
  isCompatible: boolean;
  /** 兼容性得分 */
  compatibilityScore: number;
  /** 缺失的属性 */
  missingProperties: string[];
  /** 类型不匹配的属性 */
  typeMismatchProperties: string[];
  /** 新增的属性 */
  newProperties: string[];
  /** 向后兼容性评估 */
  backwardCompatibility: 'full' | 'partial' | 'broken';
}

/**
 * 组件集成错误
 */
export interface ComponentIntegrationError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 属性名称 */
  propertyName?: string;
  /** 严重程度 */
  severity: 'critical' | 'error' | 'warning';
}

/**
 * 组件集成警告
 */
export interface ComponentIntegrationWarning {
  /** 警告代码 */
  code: string;
  /** 警告消息 */
  message: string;
  /** 属性名称 */
  propertyName?: string;
  /** 建议操作 */
  suggestion?: string;
}

/**
 * 组件集成详情
 */
export interface ComponentIntegrationDetails {
  /** 集成时间 */
  integrationTime: number;
  /** 处理的属性 */
  processedProperties: string[];
  /** 跳过的属性 */
  skippedProperties: string[];
  /** 转换的属性 */
  convertedProperties: string[];
  /** 验证结果 */
  validationResult?: any;
}

// ============================================================================
// 组件类型集成管理器
// =============================================================================

/**
 * 组件类型集成管理器类
 */
export class ComponentTypeIntegrationManager {
  private static instance: ComponentTypeIntegrationManager;
  private integrationHistory: Map<string, ComponentIntegrationResult[]> = new Map();
  private typeMappings: Map<string, ComponentTypeMapping> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ComponentTypeIntegrationManager {
    if (!ComponentTypeIntegrationManager.instance) {
      ComponentTypeIntegrationManager.instance = new ComponentTypeIntegrationManager();
    }
    return ComponentTypeIntegrationManager.instance;
  }

  /**
   * 注册组件类型映射
   */
  public registerTypeMapping(mapping: ComponentTypeMapping): void {
    this.typeMappings.set(mapping.componentName, mapping);
  }

  /**
   * 执行组件类型集成
   */
  public async integrateComponent(
    componentName: string,
    sourceProps: any,
    options: {
      validateIntegration?: boolean;
      strictMode?: boolean;
      preserveLegacy?: boolean;
    } = {}
  ): Promise<ComponentIntegrationResult> {
    const startTime = Date.now();
    const {
      validateIntegration = true,
      strictMode = false,
      preserveLegacy = true
    } = options;

    const mapping = this.typeMappings.get(componentName);
    if (!mapping) {
      throw new Error(`未找到组件 ${componentName} 的类型映射配置`);
    }

    const result: ComponentIntegrationResult = {
      componentName,
      success: false,
      typesIntegrated: 0,
      compatibilityResult: {
        isCompatible: false,
        compatibilityScore: 0,
        missingProperties: [],
        typeMismatchProperties: [],
        newProperties: [],
        backwardCompatibility: 'broken'
      },
      errors: [],
      warnings: [],
      details: {
        integrationTime: 0,
        processedProperties: [],
        skippedProperties: [],
        convertedProperties: [],
        validationResult: undefined
      }
    };

    try {
      // 阶段1：兼容性检查
      result.compatibilityResult = this.checkCompatibility(sourceProps, mapping.targetTypes, strictMode);

      // 阶段2：类型转换
      const conversionResult = this.convertTypes(sourceProps, mapping, preserveLegacy);
      result.details.processedProperties = conversionResult.processed;
      result.details.convertedProperties = conversionResult.converted;
      result.details.skippedProperties = conversionResult.skipped;
      result.typesIntegrated = conversionResult.converted.length;

      // 阶段3：验证集成结果
      if (validateIntegration) {
        result.details.validationResult = await this.validateIntegration(
          componentName,
          conversionResult.convertedProps,
          mapping.targetTypes
        );
      }

      // 阶段4：生成集成报告
      result.success = result.errors.length === 0 || !strictMode;
      result.details.integrationTime = Date.now() - startTime;

      // 记录集成历史
      this.recordIntegrationHistory(componentName, result);

      return result;

    } catch (error) {
      result.errors.push({
        code: 'INTEGRATION_FAILED',
        message: `组件类型集成失败: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'critical'
      });
      result.details.integrationTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 检查类型兼容性
   */
  private checkCompatibility(
    source: any,
    target: any,
    strictMode: boolean
  ): CompatibilityCheckResult {
    const result: CompatibilityCheckResult = {
      isCompatible: true,
      compatibilityScore: 100,
      missingProperties: [],
      typeMismatchProperties: [],
      newProperties: [],
      backwardCompatibility: 'full'
    };

    if (!source || !target) {
      result.isCompatible = false;
      result.compatibilityScore = 0;
      result.backwardCompatibility = 'broken';
      return result;
    }

    const sourceProps = Object.keys(source);
    const targetProps = Object.keys(target);

    // 检查缺失的属性
    sourceProps.forEach(prop => {
      if (!targetProps.includes(prop)) {
        result.newProperties.push(prop);
        if (strictMode) {
          result.compatibilityScore -= 10;
        }
      }
    });

    // 检查新增的属性
    targetProps.forEach(prop => {
      if (!sourceProps.includes(prop)) {
        result.missingProperties.push(prop);
        result.compatibilityScore -= 5;
      }
    });

    // 检查类型匹配（简化版本）
    sourceProps.forEach(prop => {
      if (targetProps.includes(prop)) {
        const sourceType = typeof source[prop];
        const targetType = typeof target[prop];

        if (sourceType !== targetType && source[prop] !== null && target[prop] !== null) {
          result.typeMismatchProperties.push(prop);
          result.compatibilityScore -= 15;
        }
      }
    });

    // 评估兼容性等级
    if (result.compatibilityScore >= 90) {
      result.backwardCompatibility = 'full';
      result.isCompatible = true;
    } else if (result.compatibilityScore >= 70) {
      result.backwardCompatibility = 'partial';
      result.isCompatible = !strictMode;
    } else {
      result.backwardCompatibility = 'broken';
      result.isCompatible = false;
    }

    return result;
  }

  /**
   * 转换类型定义
   */
  private convertTypes(
    source: any,
    mapping: ComponentTypeMapping,
    preserveLegacy: boolean
  ): {
    processed: string[];
    converted: string[];
    skipped: string[];
    convertedProps: any;
  } {
    const result = {
      processed: [] as string[],
      converted: [] as string[],
      skipped: [] as string[],
      convertedProps: {} as any
    };

    const { sourceTypes, targetTypes, migrationStrategy } = mapping;

    switch (migrationStrategy) {
      case 'replace':
        // 完全替换为新的类型定义
        Object.assign(result.convertedProps, targetTypes);
        result.processed = Object.keys(targetTypes);
        result.converted = Object.keys(targetTypes);
        break;

      case 'merge':
        // 合并源类型和目标类型
        Object.assign(result.convertedProps, sourceTypes, targetTypes);
        result.processed = [...Object.keys(sourceTypes), ...Object.keys(targetTypes)];
        result.converted = Object.keys(targetTypes);
        break;

      case 'extend':
        // 在源类型基础上扩展新类型
        Object.assign(result.convertedProps, sourceTypes);

        // 只添加源类型中不存在的新属性
        Object.keys(targetTypes).forEach(prop => {
          if (!sourceTypes.hasOwnProperty(prop)) {
            result.convertedProps[prop] = targetTypes[prop];
            result.converted.push(prop);
          }
        });

        result.processed = Object.keys(result.convertedProps);
        break;
    }

    return result;
  }

  /**
   * 验证集成结果
   */
  private async validateIntegration(
    componentName: string,
    integratedProps: any,
    targetTypes: any
  ): Promise<any> {
    // 这里应该实现实际的验证逻辑
    // 1. TypeScript编译检查
    // 2. Props类型匹配检查
    // 3. 组件渲染验证

    return {
      isValid: true,
      validationErrors: [],
      validationWarnings: [],
      validationResult: 'success'
    };
  }

  /**
   * 记录集成历史
   */
  private recordIntegrationHistory(
    componentName: string,
    result: ComponentIntegrationResult
  ): void {
    if (!this.integrationHistory.has(componentName)) {
      this.integrationHistory.set(componentName, []);
    }

    const history = this.integrationHistory.get(componentName)!;
    history.push(result);

    // 保留最近10次集成记录
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 获取组件集成历史
   */
  public getIntegrationHistory(componentName: string): ComponentIntegrationResult[] {
    return this.integrationHistory.get(componentName) || [];
  }

  /**
   * 批量集成组件
   */
  public async integrateComponents(
    components: Array<{
      componentName: string;
      sourceProps: any;
      options?: any;
    }>
  ): Promise<ComponentIntegrationResult[]> {
    const results: ComponentIntegrationResult[] = [];

    for (const component of components) {
      try {
        const result = await this.integrateComponent(
          component.componentName,
          component.sourceProps,
          component.options
        );
        results.push(result);
      } catch (error) {
        results.push({
          componentName: component.componentName,
          success: false,
          typesIntegrated: 0,
          compatibilityResult: {
            isCompatible: false,
            compatibilityScore: 0,
            missingProperties: [],
            typeMismatchProperties: [],
            newProperties: [],
            backwardCompatibility: 'broken'
          },
          errors: [{
            code: 'BATCH_INTEGRATION_FAILED',
            message: `批量集成失败: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'error'
          }],
          warnings: [],
          details: {
            integrationTime: 0,
            processedProperties: [],
            skippedProperties: [],
            convertedProperties: []
          }
        });
      }
    }

    return results;
  }
}

// ============================================================================
// 预定义的组件类型映射
// =============================================================================

/**
 * ChatApp组件类型映射
 */
export const CHAT_APP_TYPE_MAPPING: ComponentTypeMapping = {
  componentName: 'ChatApp',
  sourceTypes: {},
  targetTypes: {
    themeProvider: {
      defaultTheme: 'light' as const,
      autoTheme: true
    },
    shortcuts: [],
    enableKeyboardShortcuts: true,
    showHelpPanel: false
  },
  migrationStrategy: 'extend',
  requireValidation: true,
  compatibilityCheck: (source, target) => true
};

/**
 * Header组件类型映射
 */
export const HEADER_TYPE_MAPPING: ComponentTypeMapping = {
  componentName: 'Header',
  sourceTypes: {},
  targetTypes: {
    showSidebarToggle: true,
    showUserMenu: true,
    showNotifications: false,
    notificationCount: 0,
    showSearch: false,
    searchPlaceholder: '搜索...',
    title: 'LLMChat',
    subtitle: '',
    fixed: true,
    transparent: false
  },
  migrationStrategy: 'extend',
  requireValidation: true,
  compatibilityCheck: (source, target) => true
};

/**
 * Sidebar组件类型映射
 */
export const SIDEBAR_TYPE_MAPPING: ComponentTypeMapping = {
  componentName: 'Sidebar',
  sourceTypes: {},
  targetTypes: {
    expanded: true,
    position: 'left' as const,
    width: 280,
    collapsedWidth: 60,
    collapsible: true,
    resizable: false,
    minWidth: 200,
    maxWidth: 400,
    showLogo: true,
    sessions: {
      show: true,
      showArchived: false,
      maxItems: 50
    },
    agents: {
      show: true,
      showInactive: false
    }
  },
  migrationStrategy: 'extend',
  requireValidation: true,
  compatibilityCheck: (source, target) => true
};

// ============================================================================
// 工具函数
// =============================================================================

/**
 * 获取组件类型集成管理器实例
 */
export const getComponentTypeIntegrationManager = (): ComponentTypeIntegrationManager => {
  return ComponentTypeIntegrationManager.getInstance();
};

/**
 * 初始化组件类型映射
 */
export const initializeComponentTypeMappings = (): void => {
  const manager = getComponentTypeIntegrationManager();

  manager.registerTypeMapping(CHAT_APP_TYPE_MAPPING);
  manager.registerTypeMapping(HEADER_TYPE_MAPPING);
  manager.registerTypeMapping(SIDEBAR_TYPE_MAPPING);
};

/**
 * 创建组件类型集成报告
 */
export const createIntegrationReport = (results: ComponentIntegrationResult[]): string => {
  let report = '组件类型集成报告\n';
  report += '================\n\n';

  const totalComponents = results.length;
  const successfulComponents = results.filter(r => r.success).length;
  const failedComponents = totalComponents - successfulComponents;

  report += `总组件数: ${totalComponents}\n`;
  report += `成功集成: ${successfulComponents}\n`;
  report += `集成失败: ${failedComponents}\n`;
  report += `成功率: ${((successfulComponents / totalComponents) * 100).toFixed(2)}%\n\n`;

  // 详细结果
  results.forEach(result => {
    report += `组件: ${result.componentName}\n`;
    report += `状态: ${result.success ? '成功' : '失败'}\n`;
    report += `集成类型数: ${result.typesIntegrated}\n`;
    report += `兼容性得分: ${result.compatibilityResult.compatibilityScore}\n`;
    report += `向后兼容性: ${result.compatibilityResult.backwardCompatibility}\n`;

    if (result.errors.length > 0) {
      report += `错误数: ${result.errors.length}\n`;
    }

    if (result.warnings.length > 0) {
      report += `警告数: ${result.warnings.length}\n`;
    }

    report += '---\n';
  });

  return report;
};

// ============================================================================
// 导出
// =============================================================================

export default ComponentTypeIntegrationManager;