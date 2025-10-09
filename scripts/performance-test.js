/**
 * 性能测试脚本 - JavaScript版本
 * 
 * 模拟前端Store的性能对比
 * 不依赖浏览器，可直接运行
 */

// 模拟原版Store（每次都更新）
class OriginalStore {
  constructor() {
    this.messages = [];
    this.updateCount = 0;
  }

  addMessage(message) {
    this.messages.push(message);
  }

  updateLastMessage(chunk) {
    this.updateCount++;
    const lastIndex = this.messages.length - 1;
    if (lastIndex >= 0 && this.messages[lastIndex]?.AI !== undefined) {
      this.messages[lastIndex] = {
        ...this.messages[lastIndex],
        AI: (this.messages[lastIndex].AI || '') + chunk,
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
  constructor() {
    this.messages = [];
    this.messageBuffer = '';
    this.flushCount = 0;
    this.pendingFlush = null;
    this.FLUSH_INTERVAL = 16; // 模拟 requestAnimationFrame (~16ms)
  }

  addMessage(message) {
    this.messages.push(message);
  }

  appendToBuffer(chunk) {
    this.messageBuffer += chunk;
    this.scheduleFlush();
  }

  scheduleFlush() {
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
        AI: (this.messages[lastIndex].AI || '') + this.messageBuffer,
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
    return new Promise((resolve) => {
      setTimeout(() => {
        this.flushBuffer();
        resolve();
      }, this.FLUSH_INTERVAL + 10);
    });
  }
}

// 测试原版Store
async function testOriginalStore(chunkCount, chunkSize) {
  const store = new OriginalStore();
  
  // 添加用户消息
  store.addMessage({ HUMAN: '测试消息', timestamp: Date.now() });
  
  // 添加AI消息占位符
  store.addMessage({ AI: '', timestamp: Date.now() });

  const start = Date.now();
  const chunkUpdateTimes = [];

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
async function testOptimizedStore(chunkCount, chunkSize) {
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
function printResults(oldResult, newResult) {
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

  return {
    durationImprovement: parseFloat(durationImprovement),
    updateReduction: parseFloat(updateReduction),
  };
}

// 生成测试报告
function generateReport(oldResult, newResult, improvements) {
  const report = `# 性能测试报告

生成时间: ${new Date().toLocaleString()}

## 测试参数
- Chunk数量: ${oldResult.chunkCount}
- 每个Chunk大小: 20 字符
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

- **总耗时减少**: ${improvements.durationImprovement.toFixed(1)}%
- **状态更新减少**: ${improvements.updateReduction.toFixed(1)}%
- **数据一致性**: ${oldResult.finalMessageLength === newResult.finalMessageLength ? '✅ 通过' : '❌ 失败'}

## 结论

${improvements.durationImprovement >= 70 
  ? '✅ **性能提升显著（>= 70%），强烈建议全面迁移**\n\n优化版Store在总耗时和状态更新次数上都有显著改善，用户体验将得到明显提升。'
  : improvements.durationImprovement >= 50
    ? '⚠️ **性能有提升（>= 50%），但需进一步优化**\n\n虽然有性能提升，但未达到预期目标。建议分析瓶颈，调整优化策略。'
    : '❌ **性能提升不明显（< 50%），需重新评估策略**\n\n优化效果未达预期，需要重新审视设计方案。'}

${improvements.updateReduction >= 80
  ? '\n✅ **渲染次数大幅减少（>= 80%）**\n\n这将显著减少React组件的重渲染次数，用户在使用流式响应时会感受到明显的流畅度提升。'
  : '\n⚠️ **渲染次数减少有限（< 80%）**\n\n虽然有一定优化，但可能需要结合虚拟滚动等其他优化手段。'}

## 下一步建议

${improvements.durationImprovement >= 70 && improvements.updateReduction >= 80
  ? `### 立即执行全面迁移

1. **阶段1**：核心页面迁移（预计1-2天）
   - ChatContainer
   - MessageList
   - AgentSelector

2. **阶段2**：外围组件迁移（预计2-3天）
   - SessionList
   - SettingsDialog
   - ThemeProvider

3. **阶段3**：清理与验证（预计1天）
   - 删除旧chatStore
   - 更新所有导入
   - 完整测试套件

参考文档：\`STORE_MIGRATION_GUIDE.md\``
  : `### 优化建议

1. 分析性能瓶颈
2. 调整批量更新策略
3. 考虑结合虚拟滚动
4. 重新测试验证`}

---

**测试时间**: ${new Date().toISOString()}  
**测试环境**: Node.js ${process.version}  
**测试脚本**: scripts/performance-test.js
`;

  return report;
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

  const improvements = printResults(oldResult, newResult);

  // 生成测试报告文件
  const report = generateReport(oldResult, newResult, improvements);
  
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../docs/全局项目审计与优化方案/PERFORMANCE_TEST_RESULT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 测试报告已保存至: docs/全局项目审计与优化方案/PERFORMANCE_TEST_RESULT.md\n`);
}

// 运行测试
main().catch(console.error);

