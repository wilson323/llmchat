import { LucideIcon } from 'lucide-react';

// / <reference types="lucide-react" />

// 直接路径导入类型声明
declare module 'lucide-react/dist/esm/icons/*' {

  const icon: LucideIcon;
  export default icon;
}