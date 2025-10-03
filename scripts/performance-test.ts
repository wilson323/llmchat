/**
 * 性能测试脚本 - Node.js环境
 * 
 * 模拟前端Store的性能对比
 * 不依赖浏览器，可直接运行
 */

interface Message {
  AI?: string;
  HUMAN?: string;
  timestamp?: number;
}

interface TestResult {
  name: string;
  duration: number;
  updateCount: number;
  chunkCount: number;
  finalMessageLength: number;
  avgUpdateTime: number;
}

// 模拟原版Store（每次都更新）
class OriginalStore {
  private messages: Message[] = [];
  private updateCount = 0;

  addMessage(message: Message) {
    this.messages.push(message);
  }

  updateLastMessage(chunk: string) {
    this.updateCount++;
    const lastIndex = this.messages.length - 1;
    if (lastIndex >= 0 && this.messages[lastIndex]?.AI !== undefined) {
      this.messages[lastIndex] = {
        ...this.messages[lastIndex],
        AI: (this.messages[lastIndex]!.AI || '') + chunk,
      };
    }
  }

  getMessages() {
    return this.messages;
  }

  getUpdateCount() {
    return this.updateCount;
  }

  reset() {
    this.messages = [];
    this.updateCount = 0;
  }
}

// 模拟优化版Store（批量更新）
class OptimizedStore {
  private messages: Message[] = [];
  private messageBuffer = '';
  private flushCount = 0;
  private pendingFlush: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 16; // 模拟 requestAnimationFrame (~16ms)

  addMessage(message: Message) {
    this.messages.push(message);
  }

  appendToBuffer(chunk: string) {
    this.messageBuffer += chunk;
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.pendingFlush) {
      return; // 已经有待处理的flush
    }

    this.pendingFlush = setTimeout(() => {
      this.flushBuffer();
      this.pendingFlush = null;
    }, this.FLUSH_INTERVAL);
  }

  flushBuffer() {
    if (this.messageBuffer.length === 0) {
      return;
    }

    this.flushCount++;
    const lastIndex = this.messages.length - 1;
    if (lastIndex >= 0 && this.messages[lastIndex]?.AI !== undefined) {
      this.messages[lastIndex] = {
        ...this.messages[lastIndex],
        AI: (this.messages[lastIndex]!.AI || '') + this.messageBuffer,
      };
    }
    this.messageBuffer = '';
  }

  getMessages() {
    return this.messages;
  }

  getFlushCount() {
    return this.flushCount;
  }

  reset() {
    this.messages = [];
    this.messageBuffer = '';
    this.flushCount = 0;
    if (this.pendingFlush) {
      clearTimeout(this.pendingFlush);
      this.pendingFlush = null;
    }
  }

  // 确保所有缓冲都已flush
  async finalFlush() {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.flushBuffer();
        resolve();
      }, this.FLUSH_INTERVAL + 10);
    });
  }
}

// 测试原版Store
async function testOriginalStore(chunkCount: number, chunkSize: number): Promise<TestResult> {
  const store = new OriginalStore();
  
  // 添加用户消息
  store.addMessage({ HUMAN: '测试消息', timestamp: Date.now() });
  
  // 添加AI消息占位符
  store.addMessage({ AI: '', timestamp: Date.now() });

  const start = Date.now();
  const chunkUpdateTimes: number[] = [];

  // 模拟流式chunk
  for (let i = 0; i < chunkCount; i++) {
    const chunk = 'x'.repeat(chunkSize);
    const updateStart = Date.now();
    
    store.updateLastMessage(chunk);
    
    const updateDuration = Date.now() - updateStart;
    chunkUpdateTimes.push(updateDuration);
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const duration = Date.now() - start;
  const messages = store.getMessages();
  const finalMessage = messages[messages.length - 1];

  return {
    name: '原版Store',
    duration,
    updateCount: store.getUpdateCount(),
    chunkCount,
    finalMessageLength: finalMessage?.AI?.length || 0,
    avgUpdateTime: chunkUpdateTimes.reduce((a, b) => a + b, 0) / chunkUpdateTimes.length,
  };
}

// 测试优化版Store
async function testOptimizedStore(chunkCount: number, chunkSize: number): Promise<TestResult> {
  const store = new OptimizedStore();
  
  // 添加用户消息
  store.addMessage({ HUMAN: '测试消息', timestamp: Date.now() });
  
  // 添加AI消息占位符
  store.addMessage({ AI: '', timestamp: Date.now() });

  const start = Date.now();

  // 模拟流式chunk
  for (let i = 0; i < chunkCount; i++) {
    const chunk = 'x'.repeat(chunkSize);
    store.appendToBuffer(chunk);
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // 等待最后的flush完成
  await store.finalFlush();

  const duration = Date.now() - start;
  const messages = store.getMessages();
  const finalMessage = messages[messages.length - 1];

  return {
    name: '优化版Store',
    duration,
    updateCount: store.getFlushCount(),
    chunkCount,
    finalMessageLength: finalMessage?.AI?.length || 0,
    avgUpdateTime: 0, // 优化版是批量更新，不计算单次时间
  };
}

// 打印结果
function printResults(oldResult: TestResult, newResult: TestResult) {
  console.log('\n========================================');
  console.log('📊 性能测试结果');
  console.log('========================================\n');

  console.log('测试参数:');
  console.log(`  - Chunk数量: ${oldResult.chunkCount}`);
  console.log(`  - 最终消息长度: ${oldResult.finalMessageLength} 字符\n`);

  console.log('🐌 原版Store:');
  console.log(`  - 总耗时: ${oldResult.duration}ms`);
  console.log(`  - 状态更新次数: ${oldResult.updateCount}次`);
  console.log(`  - 平均单次更新: ${oldResult.avgUpdateTime.toFixed(2)}ms`);
  console.log(`  - 最终消息长度: ${oldResult.finalMessageLength} 字符\n`);

  console.log('🚀 优化版Store:');
  console.log(`  - 总耗时: ${newResult.duration}ms`);
  console.log(`  - 状态更新次数: ${newResult.updateCount}次（批量flush）`);
  console.log(`  - 最终消息长度: ${newResult.finalMessageLength} 字符\n`);

  const durationImprovement = ((oldResult.duration - newResult.duration) / oldResult.duration * 100).toFixed(1);
  const updateReduction = ((oldResult.updateCount - newResult.updateCount) / oldResult.updateCount * 100).toFixed(1);

  console.log('📈 性能提升:');
  console.log(`  - 总耗时减少: ${durationImprovement}% (${oldResult.duration}ms → ${newResult.duration}ms)`);
  console.log(`  - 状态更新减少: ${updateReduction}% (${oldResult.updateCount}次 → ${newResult.updateCount}次)`);
  
  if (oldResult.finalMessageLength === newResult.finalMessageLength) {
    console.log(`  - ✅ 数据一致性: 通过（长度相同）`);
  } else {
    console.log(`  - ❌ 数据一致性: 失败（长度不同: ${oldResult.finalMessageLength} vs ${newResult.finalMessageLength}）`);
  }

  console.log('\n========================================');
  
  // 评估结果
  console.log('\n🎯 评估结果:');
  if (parseFloat(durationImprovement) >= 70) {
    console.log('  ✅ 性能提升显著（>= 70%），建议全面迁移');
  } else if (parseFloat(durationImprovement) >= 50) {
    console.log('  ⚠️ 性能有提升（>= 50%），但需进一步优化');
  } else {
    console.log('  ❌ 性能提升不明显（< 50%），需重新评估策略');
  }

  if (parseFloat(updateReduction) >= 80) {
    console.log('  ✅ 渲染次数大幅减少（>= 80%），用户体验显著改善');
  } else {
    console.log('  ⚠️ 渲染次数减少有限（< 80%），优化效果一般');
  }

  console.log('\n========================================\n');
}

// 主函数
async function main() {
  console.log('🚀 启动性能测试...\n');
  
  const CHUNK_COUNT = 50;
  const CHUNK_SIZE = 20;

  console.log('测试配置:');
  console.log(`  - Chunk数量: ${CHUNK_COUNT}`);
  console.log(`  - 每个Chunk大小: ${CHUNK_SIZE} 字符`);
  console.log(`  - 网络延迟模拟: 10ms/chunk`);
  console.log('');

  console.log('正在测试原版Store...');
  const oldResult = await testOriginalStore(CHUNK_COUNT, CHUNK_SIZE);
  console.log('✅ 原版Store测试完成\n');

  console.log('正在测试优化版Store...');
  const newResult = await testOptimizedStore(CHUNK_COUNT, CHUNK_SIZE);
  console.log('✅ 优化版Store测试完成\n');

  printResults(oldResult, newResult);

  // 生成测试报告文件
  const report = `# 性能测试报告

生成时间: ${new Date().toLocaleString()}

## 测试参数
- Chunk数量: ${CHUNK_COUNT}
- 每个Chunk大小: ${CHUNK_SIZE} 字符
- 网络延迟模拟: 10ms/chunk

## 测试结果

### 原版Store
- 总耗时: ${oldResult.duration}ms
- 状态更新次数: ${oldResult.updateCount}次
- 平均单次更新: ${oldResult.avgUpdateTime.toFixed(2)}ms
- 最终消息长度: ${oldResult.finalMessageLength} 字符

### 优化版Store
- 总耗时: ${newResult.duration}ms
- 状态更新次数: ${newResult.updateCount}次（批量flush）
- 最终消息长度: ${newResult.finalMessageLength} 字符

## 性能提升

- **总耗时减少**: ${((oldResult.duration - newResult.duration) / oldResult.duration * 100).toFixed(1)}%
- **状态更新减少**: ${((oldResult.updateCount - newResult.updateCount) / oldResult.updateCount * 100).toFixed(1)}%
- **数据一致性**: ${oldResult.finalMessageLength === newResult.finalMessageLength ? '✅ 通过' : '❌ 失败'}

## 结论

${parseFloat(((oldResult.duration - newResult.duration) / oldResult.duration * 100).toFixed(1)) >= 70 
  ? '✅ 性能提升显著（>= 70%），建议全面迁移'
  : parseFloat(((oldResult.duration - newResult.duration) / oldResult.duration * 100).toFixed(1)) >= 50
    ? '⚠️ 性能有提升（>= 50%），但需进一步优化'
    : '❌ 性能提升不明显（< 50%），需重新评估策略'}
`;

  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../docs/全局项目审计与优化方案/PERFORMANCE_TEST_RESULT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 测试报告已保存至: ${reportPath}\n`);
}

// 运行测试
main().catch(console.error);

