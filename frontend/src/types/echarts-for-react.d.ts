declare module 'echarts-for-react' {
  import { FC } from 'react';
  import { EChartsOption } from 'echarts';

  export interface ReactEChartsProps {
    option: EChartsOption;
    style?: React.CSSProperties;
    className?: string;
    theme?: string | object;
    notMerge?: boolean;
    lazyUpdate?: boolean;
    showLoading?: boolean;
    loadingOption?: object;
    onEvents?: object;
    onReady?: (echarts: any) => void;
  }

  const ReactECharts: FC<ReactEChartsProps>;
  export default ReactECharts;
}