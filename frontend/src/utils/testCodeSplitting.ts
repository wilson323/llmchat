/**
 * 代码分割测试工具
 *
 * 用于验证代码分割功能是否正常工作
 */

import { SimpleCodeSplitting } from './simpleCodeSplitting';

// 测试组件
const TestComponent = () => 'Test Component';

// 测试函数
export function testCodeSplitting() {
  console.log('🧪 开始测试代码分割功能');

  try {
    // 注册测试组件
    SimpleCodeSplitting.registerComponent('TestComponent', () =>
      Promise.resolve({ default: TestComponent }),
    );

    // 获取统计信息
    const stats = SimpleCodeSplitting.getStats();
    console.log('📊 组件统计:', stats);

    // 检查已注册组件
    const components = SimpleCodeSplitting.getRegisteredComponents();
    console.log('📦 已注册组件:', components);

    // 预加载测试组件
    SimpleCodeSplitting.preloadComponent('TestComponent')
      .then(() => {
        console.log('✅ TestComponent 预加载成功');

        // 检查加载状态
        const isLoaded = SimpleCodeSplitting.isLoaded('TestComponent');
        console.log('🔍 TestComponent 加载状态:', isLoaded);
      })
      .catch(error => {
        console.error('❌ TestComponent 预加载失败:', error);
      });

    console.log('🎉 代码分割测试完成');
    return true;
  } catch (error) {
    console.error('❌ 代码分割测试失败:', error);
    return false;
  }
}

// 开发模式下自动运行测试
if (process.env.NODE_ENV === 'development') {
  // 延迟执行，确保所有模块都已加载
  setTimeout(() => {
    testCodeSplitting();
  }, 1000);
}