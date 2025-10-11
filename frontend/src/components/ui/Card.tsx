import React from 'react';
import type { CardProps, CardHeaderProps, CardTitleProps, CardContentProps, CardComponent } from './Card.types';

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = '',
}) => {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className = '',
}) => {
  return <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`}>{children}</h3>;
};

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = '',
}) => {
  return <div className={className}>{children}</div>;
};

const CardComponent: React.FC<CardProps> = ({ children, className = '', title }) => {
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

// Attach subcomponents to main component
const Card = CardComponent as CardComponent;
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;

export default Card;
export { CardProps, CardHeaderProps, CardTitleProps, CardContentProps };