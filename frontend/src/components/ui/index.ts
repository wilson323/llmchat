/**
 * UI组件统一导入导出文件
 *
 * 提供所有UI组件的统一入口，确保类型安全和导入导出规范
 */

// =============================================================================
// 核心类型定义导出
// =============================================================================
export type {
  // 基础类型
  BaseComponentProps,
  AccessibilityProps,
  EventHandlersProps,

  // 变体类型
  SizeVariant,
  ColorVariant,
  ShapeVariant,

  // 组件类型
  CardComponent,
  SelectComponent,

  // 组件Props
  ButtonProps,
  InputProps,
  ModalProps,
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardContentProps,
  CardFooterProps,
  CardDescriptionProps,

  SelectProps,
  SelectTriggerProps,
  SelectValueProps,
  SelectContentProps,
  SelectItemProps,

  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,

  ToastOptions,
  ToastItem,
  ToastState,
  ToastType,
  ToastPosition,

  // 主题类型
  ThemeMode,
  ThemeContextType,
  ThemeProviderProps,

  // 虚拟滚动类型
  VirtualItem,
  VirtualScrollItem,
  VirtualScrollRef,
  VirtualScrollResult,
  VirtualScrollOptions,
  VirtualScrollProps,

  // 事件增强器类型
  EventEnhancerProps,
  InputEventEnhancerProps,
  FormEventEnhancerProps,

  // 组件工厂类型
  ComponentFactoryOptions,
  ComponentFactoryResult,
  ComponentFactory,

  // 工具类型
  SubComponentProps,
  ComponentWithSubComponents,
  ForwardRefComponent,
} from './ui.types';

// =============================================================================
// UI组件导出
// =============================================================================

// Card组件系列
export { default as Card } from './Card';

// Button组件
export { default as Button } from './Button';

// IconButton组件
export { IconButton } from './IconButton';

// Input组件
export { default as Input } from './Input';

// Modal组件
export { default as Modal } from './Modal';

// Dropdown组件
export { default as Dropdown } from './Dropdown';

// Select组件
export { default as Select } from './Select';

// Tabs组件
export { default as Tabs } from './Tabs';

// Toast组件
export {
  default as Toast,
  ToastProvider,
  Toaster,
  toast,
  toastSuccess,
  toastError,
  toastWarning,
  toastInfo,
  useToast,
  useToastStore,
} from './Toast';

// Dialog组件
export { default as Dialog } from './Dialog';

// Switch组件
export { default as Switch } from './Switch';

// Tooltip组件
export { Tooltip, HelpIcon } from './Tooltip';

// 其他基础组件
export { default as Label } from './Label';
export { default as Badge } from './Badge';
export { default as Avatar } from './Avatar';
export { default as Alert } from './Alert';
export { ConfirmDialog } from './ConfirmDialog';

// =============================================================================
// 重新导出常用组件（带默认前缀）
// =============================================================================

// 为常用组件创建别名，方便使用
export const UI = {
  // 基础组件
  Card,
  Button,
  IconButton,
  Input,
  Modal,
  Select,
  Dropdown,
  Tabs,
  Switch,
  Dialog,
  Tooltip,
  Label,
  Badge,
  Avatar,
  Alert,
  ConfirmDialog,

  // 通知组件
  Toast: ToastProvider,
  Toaster,
  useToast,
  toast,
  toastSuccess,
  toastError,
  toastWarning,
  toastInfo,
};

// =============================================================================
// 工具函数导出
// =============================================================================

// 类型守卫工具
export * from '../utils/type-guards';

// 性能优化工具
export * from '../utils/performanceOptimizer';

// 主题相关工具
// export * from '../utils/typeSafety'; // 文件不存在，暂时注释

// =============================================================================
// 样式系统导出
// =============================================================================

export { cn } from '@/lib/utils';

// =============================================================================
// 开发者工具导出
// =============================================================================

// 开发模式下的调试工具
if (process.env.NODE_ENV === 'development') {
  // 开发工具导出
  export const devTools = {
    // 组件调试工具
    logComponentRender: (componentName: string, props: any) => {
      console.log(`🔄 ${componentName} render:`, props);
    },

    // 类型检查工具
    checkComponentTypes: <T>(props: T, componentName: string) => {
      console.log(`🔍 ${componentName} types:`, props);
      return props;
    },

    // 性能监控工具
    measureRender: (componentName: string, renderFn: () => void) => {
      const start = performance.now();
      renderFn();
      const end = performance.now();
      console.log(`⏱️ ${componentName} render time: ${end - start}ms`);
    },
  };
}

// =============================================================================
// 版本信息
// =============================================================================

export const UI_VERSION = '1.0.0';

// =============================================================================
// 类型断言工具
// =============================================================================

/**
 * 类型断言：确保组件类型正确
 */
export const assertComponentType = <T>(component: T): T => component;

/**
 * 类型断言：确保Props类型正确
 */
export const assertPropsType = <T>(props: T): T => props;

/**
 * 类型断言：确保子组件类型正确
 */
export const assertSubComponentType = <T>(subComponent: T): T => subComponent;

// =============================================================================
// 推荐导入规范
// =============================================================================

/**
 * 推荐的导入方式：
 *
 * 1. 组件导入：
 *    import { Card, Button, Input } from '@/components/ui';
 *
 * 2. 类型导入：
 *    import type { CardProps, ButtonProps } from '@/components/ui';
 *
 * 3. 命名空间导入：
 *    import { UI } from '@/components/ui';
 *    const { Card, Button } = UI;
 *
 * 4. 单独导入：
 *    import Card from '@/components/ui/Card';
 *    import type { CardProps } from '@/components/ui/Card';
 *
 * 注意事项：
 * - 组件使用 default export
 * - 类型使用 named export
 * - 工具函数使用 named export
 * - 避免混合导入方式
 * - 优先使用类型导入来减少包大小
 */