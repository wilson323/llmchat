/**
 * 懒加载演示组件 2
 */

import { useEffect, useState } from 'react';

export default function LazyComponent2() {
  const [loadTime, setLoadTime] = useState('');
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    setLoadTime(new Date().toLocaleTimeString());
    console.log('🚀 LazyComponent2 已加载');
  }, []);

  return (
    <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
      <h3 className="text-xl font-bold text-green-800 mb-4">懒加载组件 2</h3>
      <div className="space-y-2 text-sm">
        <p>✅ 这是另一个懒加载的组件</p>
        <p>🕐 加载时间: {loadTime}</p>
        <p>🔄 交互测试:
          <button
            onClick={() => setClickCount(prev => prev + 1)}
            className="ml-2 px-3 py-1 bg-green-200 hover:bg-green-300 rounded text-green-800"
          >
            点击测试 ({clickCount})
          </button>
        </p>
        <div className="mt-4 p-3 bg-green-100 rounded">
          <p className="text-green-800">
            这个组件演示了懒加载组件的完整功能，包括状态管理和用户交互。
            组件只有在需要时才会被加载，节省了带宽和加载时间。
          </p>
        </div>
      </div>
    </div>
  );
}