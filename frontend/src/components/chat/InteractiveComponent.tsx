import React from 'react';
import { InteractiveData } from '@/types';

interface InteractiveComponentProps {
  interactive: InteractiveData;
}

export const InteractiveComponent: React.FC<InteractiveComponentProps> = ({ interactive }) => {
  return (
    <div className="interactive-component p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="text-sm font-medium mb-2">Interactive Element</div>
      <div className="text-xs text-gray-600 dark:text-gray-400">
        Type: {interactive.type}
      </div>
      {/* Add interactive element rendering logic here */}
    </div>
  );
};

export default InteractiveComponent;