/**
 * UI组件类型统一导出文件（向后兼容转发层）
 *
 * 🔄 重构说明:
 * 本文件已重构为转发层，所有类型定义实际位于 ui.types.ts
 * 保留此文件是为了不破坏现有的导入路径（多个组件使用此路径）
 *
 * 使用此文件的组件:
 * - Button.tsx
 * - IconButton.tsx
 * - VirtualScroll.tsx
 * - LazyComponent.tsx
 * - index.ts
 *
 * ⚠️ 新组件请直接从 ui.types.ts 导入
 *
 * @see ui.types.ts - 所有UI类型的实际定义位置
 * @refactor 2025-10-19 - 根源性重构，消除重复定义
 */

// 重新导出ui.types.ts的所有内容
export * from './ui.types';

// 重新导出函数值（解决TS1361错误）
import { createSubComponent as _createSubComponent, attachSubComponents as _attachSubComponents } from './ui.types';

// 重新导出为值，解决TS1361 "Cannot be used as a value" 错误
export const createSubComponent = _createSubComponent;
export const attachSubComponents = _attachSubComponents;
