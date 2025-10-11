/**
 * ECharts 组件占位模块
 *
 * 临时解决方案，避免模块缺失错误
 */

// 重新导出ECharts相关组件
export { default as EChartsComponents } from './EChartsPlaceholder';

// 创建默认导出
const EChartsComponents = {
  // 占位组件，实际使用时会被替换
  placeholder: true
};

export default EChartsComponents;