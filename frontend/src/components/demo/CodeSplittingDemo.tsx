/**
 * 代码分割演示组件
 *
 * 展示代码分割和懒加载功能
 */

import React, { useState, useEffect } from 'react';
import { SimpleCodeSplitting } from '@/utils/simpleCodeSplitting';
import { SimpleLazyComponent } from '@/components/ui/SimpleLazyComponent';
import { testCodeSplitting } from '@/utils/testCodeSplitting';

// 模拟一些懒加载组件
const LazyComponent1 = React.lazy(() =>
  import('./LazyComponent1').then(module => ({ default: module.default || module })),
);
const LazyComponent2 = React.lazy(() =>
  import('./LazyComponent2').then(module => ({ default: module.default || module })),
);

export default function CodeSplittingDemo() {
  const [activeComponent, setActiveComponent] = useState<string>('none');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // 注册组件到代码分割系统
    SimpleCodeSplitting.registerComponent('LazyComponent1', () =>
      import('./LazyComponent1').then(module => ({ default: module.default || module })),
    );

    SimpleCodeSplitting.registerComponent('LazyComponent2', () =>
      import('./LazyComponent2').then(module => ({ default: module.default || module })),
    );

    // 运行测试
    testCodeSplitting();

    // 更新统计信息
    const updateStats = () => {
      setStats(SimpleCodeSplitting.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadComponent = (componentName: string) => {
    setActiveComponent(componentName);
    SimpleCodeSplitting.preloadComponent(componentName);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">代码分割演示</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">功能说明：</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>懒加载组件：点击按钮动态加载组件</li>
            <li>预加载策略：智能预加载可能需要的组件</li>
            <li>性能监控：实时显示组件加载状态</li>
            <li>缓存管理：避免重复加载相同组件</li>
          </ul>
        </div>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">组件统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-gray-600">总组件数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.loaded}</div>
              <div className="text-gray-600">已加载</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.loading}</div>
              <div className="text-gray-600">加载中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.total - stats.loaded - stats.loading}</div>
              <div className="text-gray-600">未加载</div>
            </div>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">组件加载测试</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveComponent('none')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeComponent === 'none'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            清空
          </button>
          <button
            onClick={() => loadComponent('LazyComponent1')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeComponent === 'LazyComponent1'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-200 hover:bg-blue-300'
            }`}
          >
            加载组件 1
          </button>
          <button
            onClick={() => loadComponent('LazyComponent2')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeComponent === 'LazyComponent2'
                ? 'bg-green-600 text-white'
                : 'bg-green-200 hover:bg-green-300'
            }`}
          >
            加载组件 2
          </button>
          <button
            onClick={() => SimpleCodeSplitting.preloadByPriority()}
            className="px-4 py-2 bg-purple-200 hover:bg-purple-300 rounded-md transition-colors"
          >
            预加载高优先级组件
          </button>
          <button
            onClick={() => SimpleCodeSplitting.clearCache()}
            className="px-4 py-2 bg-red-200 hover:bg-red-300 rounded-md transition-colors"
          >
            清除缓存
          </button>
        </div>
      </div>

      {/* 组件显示区域 */}
      <div className="bg-white border rounded-lg p-6 min-h-[300px]">
        <h2 className="text-lg font-semibold mb-4">组件显示区域</h2>

        {activeComponent === 'none' && (
          <div className="text-center text-gray-500 py-12">
            <div className="text-lg mb-2">请选择要加载的组件</div>
            <div className="text-sm">点击上方按钮开始测试代码分割功能</div>
          </div>
        )}

        {activeComponent === 'LazyComponent1' && (
          <SimpleLazyComponent
            component={LazyComponent1}
            config={{
              showProgress: true,
              delay: 200,
            }}
          />
        )}

        {activeComponent === 'LazyComponent2' && (
          <SimpleLazyComponent
            component={LazyComponent2}
            config={{
              showProgress: true,
              delay: 200,
            }}
          />
        )}
      </div>
    </div>
  );
}