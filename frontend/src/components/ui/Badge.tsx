import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'destructive' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '', ...props }) => {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    secondary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    destructive: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    outline: 'border border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-300 bg-transparent',
  };

  return (
    <span 
      {...props}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;