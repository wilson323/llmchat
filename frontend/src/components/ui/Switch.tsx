
import React from 'react';

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      id={id}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked
          ? 'bg-blue-600 dark:bg-blue-500'
          : 'bg-gray-200 dark:bg-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

export default Switch;