/**
 * 性能对比演示组件
 * 
 * 演示新旧Store的性能差异
 * 可以通过切换开关来对比两种实现
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { perfMonitor } from '@/utils/performanceMonitor';

// 新的优化Store
import { useMessageStore } from '@/store/messageStore';
// import { useAgentStore } from '@/store/agentStore'; // 未使用，已注释

// 旧的合并Store
import { useChatStore } from '@/store/chatStore';

export const PerformanceComparisonDemo: React.FC = () => {
  // const [useOptimized, setUseOptimized] = useState(true); // 未使用，已注释
  // const useOptimized = true; // 始终使用优化版本
  const [testResults, setTestResults] = useState<{
    old?: any;
    new?: any;
  }>({});

  // 模拟流式响应测试
  const testStreamingPerformance = async (optimized: boolean) => {
    const chunks = 50; // 模拟50个chunk
    const chunkSize = 20; // 每个chunk 20个字符
    
    perfMonitor.clearAll();

    if (optimized) {
      // 测试新Store（优化版）
      console.log('🚀 测试优化版 Store...');
      
      // 清空消息
      useMessageStore.getState().clearMessages();
      
      // 添加初始消息
      useMessageStore.getState().addMessage({
        HUMAN: '测试消息',
        timestamp: Date.now(),
      });
      useMessageStore.getState().addMessage({
        AI: '',
        timestamp: Date.now(),
      });

      const start = performance.now();
      
      // 模拟流式chunk
      for (let i = 0; i < chunks; i++) {
        const chunk = 'x'.repeat(chunkSize);
        useMessageStore.getState().appendToBuffer(chunk);
        
        // 每10个chunk手动flush一次（模拟requestAnimationFrame）
        if (i % 10 === 0) {
          useMessageStore.getState().flushBuffer();
        }
        
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // 最后flush
      useMessageStore.getState().flushBuffer();
      
      const duration = performance.now() - start;
      
      const stats = {
        duration: `${duration.toFixed(2)}ms`,
        flushCount: perfMonitor.getStats('messageStore.flushBuffer')?.count || 0,
        avgFlushTime: perfMonitor.getStats('messageStore.flushBuffer')?.avg.toFixed(2) || 'N/A',
        chunks,
        finalMessage: useMessageStore.getState().messages[useMessageStore.getState().messages.length - 1]?.AI?.length || 0,
      };

      console.log('✅ 优化版测试完成:', stats);
      setTestResults(prev => ({ ...prev, new: stats }));
      
    } else {
      // 测试旧Store（原版）
      console.log('🐌 测试原版 Store...');
      
      // 清空消息
      useChatStore.getState().clearMessages();
      
      // 添加初始消息
      useChatStore.getState().addMessage({
        HUMAN: '测试消息',
        timestamp: Date.now(),
      });
      useChatStore.getState().addMessage({
        AI: '',
        timestamp: Date.now(),
      });

      const start = performance.now();
      
      // 模拟流式chunk（每个都触发状态更新）
      for (let i = 0; i < chunks; i++) {
        const chunk = 'x'.repeat(chunkSize);
        useChatStore.getState().updateLastMessage(chunk);
        
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const duration = performance.now() - start;
      
      const stats = {
        duration: `${duration.toFixed(2)}ms`,
        updateCount: chunks,
        chunks,
        finalMessage: useChatStore.getState().messages[useChatStore.getState().messages.length - 1]?.AI?.length || 0,
      };

      console.log('✅ 原版测试完成:', stats);
      setTestResults(prev => ({ ...prev, old: stats }));
    }
  };

  // 计算性能提升百分比
  const improvement = testResults.old && testResults.new
    ? ((parseFloat(testResults.old.duration) - parseFloat(testResults.new.duration)) / parseFloat(testResults.old.duration) * 100).toFixed(1)
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">📊 性能对比测试</h2>
        <p className="text-gray-600">
          模拟流式响应（50个chunk），对比新旧Store的性能差异
        </p>
      </div>

      {/* 测试控制 */}
      <div className="mb-6 flex gap-4">
        <Button
          onClick={() => testStreamingPerformance(false)}
          variant="outline"
        >
          🐌 测试原版Store
        </Button>
        
        <Button
          onClick={() => testStreamingPerformance(true)}
          variant="brand"
        >
          🚀 测试优化版Store
        </Button>
      </div>

      {/* 结果展示 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 原版结果 */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            🐌 原版Store
          </h3>
          {testResults.old ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">总耗时:</span>
                <span className="font-mono font-bold text-red-600">{testResults.old.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">状态更新次数:</span>
                <span className="font-mono">{testResults.old.updateCount}次</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Chunk数量:</span>
                <span className="font-mono">{testResults.old.chunks}个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最终消息长度:</span>
                <span className="font-mono">{testResults.old.finalMessage}字符</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">点击按钮开始测试...</p>
          )}
        </div>

        {/* 优化版结果 */}
        <div className="border rounded-lg p-4 bg-green-50">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            🚀 优化版Store
          </h3>
          {testResults.new ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">总耗时:</span>
                <span className="font-mono font-bold text-green-600">{testResults.new.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">状态更新次数:</span>
                <span className="font-mono">{testResults.new.flushCount}次</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">平均Flush耗时:</span>
                <span className="font-mono">{testResults.new.avgFlushTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Chunk数量:</span>
                <span className="font-mono">{testResults.new.chunks}个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最终消息长度:</span>
                <span className="font-mono">{testResults.new.finalMessage}字符</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">点击按钮开始测试...</p>
          )}
        </div>
      </div>

      {/* 性能提升总结 */}
      {improvement && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-blue-800">
            📈 性能提升总结
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-700">响应时间提升:</span>
              <span className="font-bold text-blue-900 text-xl">{improvement}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-700">状态更新减少:</span>
              <span className="font-bold text-blue-900">
                {testResults.old.updateCount}次 → {testResults.new.flushCount}次
                (减少 {(((testResults.old.updateCount - testResults.new.flushCount) / testResults.old.updateCount) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 详细说明 */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">🔍 技术说明</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>原版Store</strong>: 每个chunk都调用 `updateLastMessage()`，
            触发完整的状态更新和组件渲染。50个chunk = 50次渲染。
          </p>
          <p>
            <strong>优化版Store</strong>: 使用 `appendToBuffer()` 将chunk追加到缓冲区，
            通过 `requestAnimationFrame` 批量flush（约16ms一次）。50个chunk ≈ 3-4次渲染。
          </p>
          <p className="mt-2 font-semibold text-green-700">
            ✅ 预期性能提升: 80%渲染次数减少，20-30%响应时间提升
          </p>
        </div>
      </div>

      {/* 性能监控报告 */}
      <div className="mt-6">
        <Button
          onClick={() => {
            console.log(perfMonitor.exportReport());
            alert('性能报告已输出到控制台，请按F12查看');
          }}
          variant="outline"
          size="sm"
        >
          📊 导出性能报告到控制台
        </Button>
      </div>
    </div>
  );
};

export default PerformanceComparisonDemo;


