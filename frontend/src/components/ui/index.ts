/**
 * UI组件统一导入导出文件
 *
 * 根治性重构 - 消除冗余导出
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
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardContentProps,
  CardFooterProps,
  CardDescriptionProps,

  ButtonProps,
  IconButtonProps,
  InputProps,
  ModalProps,

  SelectProps,
  SelectTriggerProps,
  SelectValueProps,
  SelectContentProps,
  SelectItemProps,
  SelectComponent,

  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,

  ToastOptions,
  ToastItem,
  ToastState,
  ToastType,

  // Dropdown组件类型
  DropdownProps,

  // ConfirmDialog组件类型
  ConfirmDialogProps,

  // 虚拟滚动组件类型
  VirtualScrollProps,
  VirtualScrollItem,
  VirtualScrollRef,

  // 主题类型
  ThemeMode,

  // 工具类型
  SubComponentProps,
  ForwardRefComponent,
  ComponentWithSubComponents,
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
export type {
  TooltipProps,
  HelpIconProps,
} from './Tooltip';

// 其他基础组件
export { default as Label } from './Label';

export { default as Badge } from './Badge';

export { default as Avatar } from './Avatar';

export { default as Alert } from './Alert';

export { ConfirmDialog } from './ConfirmDialog';

// =============================================================================
// 高级组件导出
// =============================================================================

// VirtualScroll
export { VirtualScroll } from './VirtualScroll';

// LazyComponent
export { LazyComponent, createLazyComponent, createConditionalLazyComponent, preloadComponent, preloadComponents, createLazyWorkspace } from './LazyComponent';

// 其他工具组件
export { A11yAnnouncer } from './A11yAnnouncer';
export { ImageGallery } from './ImageGallery';
export { OptimizedImage } from './OptimizedImage';
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

// =============================================================================
// 工具函数导出
// =============================================================================

// 类型守卫工具
export * from '@/utils/type-guards';

// 样式系统
export { cn } from '@/lib/utils';

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
 * 3. 单独导入：
 *    import Card from '@/components/ui/Card';
 *
 * 注意事项：
 * - 复合组件使用子组件: Card.Header, Card.Title等
 * - 类型使用 type 关键字导入
 * - 避免使用barrel文件可能导致的循环依赖
 */
