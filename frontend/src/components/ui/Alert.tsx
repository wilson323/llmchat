import * as React from 'react';
import { createSubComponent, attachSubComponents } from './ui.types';
import type { ComponentWithSubComponents } from './ui.types';

export interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'error' | 'success' | 'destructive';
  className?: string;
}

export interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export interface AlertTitleProps {
  children: React.ReactNode;
  className?: string;
}

// 子组件实现
const AlertDescriptionImpl: React.FC<AlertDescriptionProps> = ({ children, className = '' }) => {
  return <div className={`text-sm ${className}`}>{children}</div>;
};
AlertDescriptionImpl.displayName = 'Alert.Description';

const AlertTitleImpl: React.FC<AlertTitleProps> = ({ children, className = '' }) => {
  return <div className={`text-base font-semibold ${className}`}>{children}</div>;
};
AlertTitleImpl.displayName = 'Alert.Title';

// 主组件实现
const AlertImpl: React.FC<AlertProps> = ({ children, variant = 'info', className = '' }) => {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
    destructive: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
  };

  return (
    <div className={`p-4 border rounded-md ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};
AlertImpl.displayName = 'Alert';

// 创建子组件
const AlertDescription = createSubComponent('Alert.Description', AlertDescriptionImpl);
const AlertTitle = createSubComponent('Alert.Title', AlertTitleImpl);

// 附加子组件到主组件
const Alert: ComponentWithSubComponents<AlertProps, {
  Description: typeof AlertDescription;
  Title: typeof AlertTitle;
}> = attachSubComponents(AlertImpl, {
  Description: AlertDescription,
  Title: AlertTitle,
});

export default Alert;
export { AlertDescription, AlertTitle };