/// <reference types="vite/client" />

/**
 * Vite环境变量类型定义
 *
 * 用途:
 * - 修复import.meta.env类型错误
 * - 提供环境变量自动补全
 */

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_ENABLE_ANALYTICS?: string;
  readonly VITE_ENABLE_SENTRY?: string;
  readonly VITE_SENTRY_ENABLED?: string;
  readonly VITE_ANALYTICS_ENABLED?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_DEBUG?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global lucide-react icon declarations
declare module 'lucide-react/dist/esm/icons/*' {
  import React from 'react';
  const Icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Icon;
}

// 为具体图标添加类型声明
declare module 'lucide-react/dist/esm/icons/eye' {
  import React from 'react';
  const Eye: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Eye;
}
declare module 'lucide-react/dist/esm/icons/eye-off' {
  import React from 'react';
  const EyeOff: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default EyeOff;
}
declare module 'lucide-react/dist/esm/icons/mail' {
  import React from 'react';
  const Mail: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Mail;
}
declare module 'lucide-react/dist/esm/icons/refresh-cw' {
  import React from 'react';
  const RefreshCw: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default RefreshCw;
}
declare module 'lucide-react/dist/esm/icons/message-square' {
  import React from 'react';
  const MessageSquare: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default MessageSquare;
}
declare module 'lucide-react/dist/esm/icons/download' {
  import React from 'react';
  const Download: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Download;
}
declare module 'lucide-react/dist/esm/icons/user' {
  import React from 'react';
  const User: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default User;
}
declare module 'lucide-react/dist/esm/icons/bot' {
  import React from 'react';
  const Bot: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Bot;
}
declare module 'lucide-react/dist/esm/icons/copy' {
  import React from 'react';
  const Copy: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Copy;
}
declare module 'lucide-react/dist/esm/icons/file-text' {
  import React from 'react';
  const FileText: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default FileText;
}
declare module 'lucide-react/dist/esm/icons/message-circle' {
  import React from 'react';
  const MessageCircle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default MessageCircle;
}
declare module 'lucide-react/dist/esm/icons/clock' {
  import React from 'react';
  const Clock: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Clock;
}
declare module 'lucide-react/dist/esm/icons/calendar' {
  import React from 'react';
  const Calendar: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Calendar;
}
declare module 'lucide-react/dist/esm/icons/x' {
  import React from 'react';
  const X: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default X;
}
declare module 'lucide-react/dist/esm/icons/tag' {
  import React from 'react';
  const Tag: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Tag;
}
declare module 'lucide-react/dist/esm/icons/check-circle' {
  import React from 'react';
  const CheckCircle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default CheckCircle;
}
declare module 'lucide-react/dist/esm/icons/trending-down' {
  import React from 'react';
  const TrendingDown: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default TrendingDown;
}
declare module 'lucide-react/dist/esm/icons/trending-up' {
  import React from 'react';
  const TrendingUp: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default TrendingUp;
}
declare module 'lucide-react/dist/esm/icons/users' {
  import React from 'react';
  const Users: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Users;
}
declare module 'lucide-react/dist/esm/icons/zap' {
  import React from 'react';
  const Zap: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Zap;
}
declare module 'lucide-react/dist/esm/icons/activity' {
  import React from 'react';
  const Activity: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Activity;
}
declare module 'lucide-react/dist/esm/icons/alert-circle' {
  import React from 'react';
  const AlertCircle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default AlertCircle;
}
declare module 'lucide-react/dist/esm/icons/alert-triangle' {
  import React from 'react';
  const AlertTriangle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default AlertTriangle;
}
declare module 'lucide-react/dist/esm/icons/archive' {
  import React from 'react';
  const Archive: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Archive;
}
declare module 'lucide-react/dist/esm/icons/bar-chart-3' {
  import React from 'react';
  const BarChart3: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default BarChart3;
}
declare module 'lucide-react/dist/esm/icons/filter' {
  import React from 'react';
  const Filter: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Filter;
}
declare module 'lucide-react/dist/esm/icons/home' {
  import React from 'react';
  const Home: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Home;
}
declare module 'lucide-react/dist/esm/icons/lock' {
  import React from 'react';
  const Lock: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Lock;
}
declare module 'lucide-react/dist/esm/icons/log-out' {
  import React from 'react';
  const LogOut: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default LogOut;
}
declare module 'lucide-react/dist/esm/icons/menu' {
  import React from 'react';
  const Menu: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Menu;
}
declare module 'lucide-react/dist/esm/icons/monitor' {
  import React from 'react';
  const Monitor: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Monitor;
}
declare module 'lucide-react/dist/esm/icons/package' {
  import React from 'react';
  const Package: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Package;
}
declare module 'lucide-react/dist/esm/icons/search' {
  import React from 'react';
  const Search: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Search;
}
declare module 'lucide-react/dist/esm/icons/settings' {
  import React from 'react';
  const Settings: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Settings;
}
declare module 'lucide-react/dist/esm/icons/shield' {
  import React from 'react';
  const Shield: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Shield;
}
declare module 'lucide-react/dist/esm/icons/square' {
  import React from 'react';
  const Square: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Square;
}
declare module 'lucide-react/dist/esm/icons/trash-2' {
  import React from 'react';
  const Trash2: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export default Trash2;
}

// 为 lucide-react 本身添加命名导出
declare module 'lucide-react' {
  import React from 'react';
  export const Activity: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const AlertCircle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const AlertTriangle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Archive: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const BarChart3: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Bot: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Calendar: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Check: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const CheckCircle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Clock: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Copy: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Download: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Eye: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const EyeOff: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const FileText: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Filter: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Home: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Lock: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const LogOut: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Mail: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Menu: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const MessageCircle: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const MessageSquare: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Monitor: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Package: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const RefreshCw: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Search: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Settings: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Shield: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Square: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Tag: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Trash2: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const TrendingDown: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const TrendingUp: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const User: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Users: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const X: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  export const Zap: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
}

// Asset declarations
declare module '*.svg' {
  import type { FC, SVGProps } from 'react';
  const content: FC<SVGProps>;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}

declare module '*.bmp' {
  const content: string;
  export default content;
}

// Extend Window interface
declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl: string;
      wsUrl: string;
      debug: boolean;
    };
  }
}

export {};
