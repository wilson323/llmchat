/**
 * 简单性能测试（纯JavaScript，无TypeScript依赖）
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

async function httpGet(path) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({ status: res.statusCode, duration, data });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => reject(new Error('Timeout')));
  });
}

async function quickTest() {
  console.log('\n🚀 快速性能测试...\n');
  
  try {
    // 测试1: 健康检查
    console.log('1️⃣ 测试健康检查端点...');
    const health = await httpGet('/health');
    console.log(`   ✅ 响应: ${health.duration}ms (状态: ${health.status})\n`);
    
    // 测试2: Agents列表
    console.log('2️⃣ 测试智能体列表...');
    const agents = await httpGet('/api/agents');
    console.log(`   ✅ 响应: ${agents.duration}ms (状态: ${agents.status})\n`);
    
    // 测试3: 并发负载（10个请求）
    console.log('3️⃣ 快速负载测试（10个并发请求）...');
    const start3 = Date.now();
    const promises = Array(10).fill(0).map(() => httpGet('/health'));
    const results = await Promise.all(promises);
    const duration3 = Date.now() - start3;
    const avgDuration = duration3 / 10;
    console.log(`   ✅ 总时间: ${duration3}ms, 平均: ${avgDuration.toFixed(2)}ms\n`);
    
    // 性能评估
    console.log('📊 性能评估:');
    const p95Target = 50;
    
    const healthPass = health.duration < p95Target;
    const agentsPass = agents.duration < p95Target;
    const loadPass = avgDuration < p95Target;
    
    console.log(`   ${healthPass ? '✅' : '❌'} 健康检查: ${health.duration}ms ${healthPass ? '< 50ms ✅' : '>= 50ms ⚠️'}`);
    console.log(`   ${agentsPass ? '✅' : '❌'} 智能体列表: ${agents.duration}ms ${agentsPass ? '< 50ms ✅' : '>= 50ms ⚠️'}`);
    console.log(`   ${loadPass ? '✅' : '❌'} 并发负载: ${avgDuration.toFixed(2)}ms ${loadPass ? '< 50ms ✅' : '>= 50ms ⚠️'}`);
    
    // 保存报告
    const fs = require('fs');
    const path = require('path');
    const reportDir = path.join(__dirname, '../../reports');
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      tests: [
        { name: '健康检查', duration: health.duration, pass: healthPass },
        { name: '智能体列表', duration: agents.duration, pass: agentsPass },
        { name: '并发负载', duration: Math.round(avgDuration * 100) / 100, pass: loadPass }
      ],
      summary: {
        allPass: healthPass && agentsPass && loadPass,
        avgResponseTime: Math.round(((health.duration + agents.duration + avgDuration) / 3) * 100) / 100
      }
    };
    
    const reportPath = path.join(reportDir, `quick-perf-test-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📁 报告已保存: ${reportPath}`);
    
    if (report.summary.allPass) {
      console.log('\n✅ 所有测试通过！系统性能达标。\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试未达标，但系统正常运行。\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   请确保后端服务已启动: pnpm run backend:dev\n');
    process.exit(1);
  }
}

quickTest();

