import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => {
  return <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`}>{children}</h3>;
};

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => {
  return <div className={className}>{children}</div>;
};

export default Card;