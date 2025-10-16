/**
 * 懒加载演示组件 1
 */

import { useEffect, useState } from 'react';

export default function LazyComponent1() {
  const [loadTime, setLoadTime] = useState('');

  useEffect(() => {
    setLoadTime(new Date().toLocaleTimeString());
    console.log('🚀 LazyComponent1 已加载');
  }, []);

  return (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="text-xl font-bold text-blue-800 mb-4">懒加载组件 1</h3>
      <div className="space-y-2 text-sm">
        <p>✅ 这是一个懒加载的组件</p>
        <p>🕐 加载时间: {loadTime}</p>
        <p>📦 组件已成功动态加载</p>
        <div className="mt-4 p-3 bg-blue-100 rounded">
          <p className="text-blue-800">
            这个组件演示了代码分割的基本功能。只有在用户点击相应按钮时，
            浏览器才会下载这个组件的代码，从而减少了初始页面的加载时间。
          </p>
        </div>
      </div>
    </div>
  );
}