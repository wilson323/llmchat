import React from 'react';

export interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export const Label: React.FC<LabelProps> = ({ children, htmlFor, className = '' }) => {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${className}`}
    >
      {children}
    </label>
  );
};

export default Label;