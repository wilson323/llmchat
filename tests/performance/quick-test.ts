/**
 * 快速性能测试
 * 用于快速验证系统基本性能
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function quickTest() {
  console.log('🚀 快速性能测试...\n');
  
  try {
    // 测试健康检查
    console.log('1️⃣ 测试健康检查端点...');
    const start1 = Date.now();
    const health = await axios.get(`${BASE_URL}/health`);
    const duration1 = Date.now() - start1;
    console.log(`   ✅ 响应: ${duration1}ms (状态: ${health.status})\n`);
    
    // 测试Agents列表
    console.log('2️⃣ 测试智能体列表...');
    const start2 = Date.now();
    const agents = await axios.get(`${BASE_URL}/api/agents`);
    const duration2 = Date.now() - start2;
    console.log(`   ✅ 响应: ${duration2}ms (数量: ${agents.data?.length || 0})\n`);
    
    // 快速负载测试（10个并发请求）
    console.log('3️⃣ 快速负载测试（10个并发请求）...');
    const start3 = Date.now();
    const promises = Array(10).fill(0).map(() => axios.get(`${BASE_URL}/health`));
    await Promise.all(promises);
    const duration3 = Date.now() - start3;
    const avgDuration = duration3 / 10;
    console.log(`   ✅ 总时间: ${duration3}ms, 平均: ${avgDuration.toFixed(2)}ms\n`);
    
    // 性能评估
    console.log('📊 性能评估:');
    const p95Target = 50;
    const healthPass = duration1 < p95Target;
    const agentsPass = duration2 < p95Target;
    const loadPass = avgDuration < p95Target;
    
    console.log(`   ${healthPass ? '✅' : '❌'} 健康检查: ${duration1}ms ${healthPass ? '< 50ms ✅' : '>= 50ms ⚠️'}`);
    console.log(`   ${agentsPass ? '✅' : '❌'} 智能体列表: ${duration2}ms ${agentsPass ? '< 50ms ✅' : '>= 50ms ⚠️'}`);
    console.log(`   ${loadPass ? '✅' : '❌'} 并发负载: ${avgDuration.toFixed(2)}ms ${loadPass ? '< 50ms ✅' : '>= 50ms ⚠️'}`);
    
    if (healthPass && agentsPass && loadPass) {
      console.log('\n✅ 所有测试通过！系统性能达标。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试未达标，请检查系统性能。');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   请确保后端服务已启动: pnpm run backend:dev');
    process.exit(1);
  }
}

quickTest();

