/**
 * ECharts 占位组件
 */

interface EChartsPlaceholderProps {
  className?: string;
}

export default function EChartsPlaceholder({ className = '' }: EChartsPlaceholderProps) {
  return (
    <div className={`flex items-center justify-center p-8 border border-dashed border-gray-300 rounded-lg ${className}`}>
      <div className="text-center text-gray-500">
        <div className="text-lg font-medium">ECharts 图表组件</div>
        <div className="text-sm mt-2">图表功能正在开发中...</div>
      </div>
    </div>
  );
}