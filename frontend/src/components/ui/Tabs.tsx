import React, { useState } from 'react';

export interface TabsProps {
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ defaultValue, children, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultValue || '');

  return (
    <div className={`w-full ${className}`}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { activeTab, setActiveTab })
          : child,
      )}
    </div>
  );
};

export const TabsList: React.FC<TabsListProps & { activeTab?: string; setActiveTab?: (tab: string) => void }> = ({
  children,
  activeTab,
  setActiveTab,
  className = '',
}) => {
  return (
    <div className={`flex space-x-1 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { activeTab, setActiveTab })
          : child,
      )}
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps & { activeTab?: string; setActiveTab?: (tab: string) => void }> = ({
  value,
  children,
  activeTab,
  setActiveTab,
  className = '',
}) => {
  const isActive = activeTab === value;

  return (
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      } ${className}`}
      onClick={() => setActiveTab?.(value)}
      >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps & { activeTab?: string }> = ({
  value,
  children,
  activeTab,
  className = '',
}) => {
  if (activeTab !== value) {
    return null;
  }

  return (
    <div className={`py-4 ${className}`}>
      {children}
    </div>
  );
};