/**
 * k6 压力测试 - 高并发场景（最大1000并发）
 * 
 * 运行方式：
 * k6 run tests/load/k6-stress-test.js
 * 
 * 带环境变量：
 * k6 run -e BASE_URL=http://localhost:3001 tests/load/k6-stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const requestCount = new Counter('request_count');

// 压力测试配置（最大1000并发）
export const options = {
  // 场景：逐步加压到1000并发
  stages: [
    { duration: '1m', target: 100 },   // 预热：100 VU
    { duration: '2m', target: 300 },   // 加压：300 VU
    { duration: '3m', target: 600 },   // 继续加压：600 VU
    { duration: '3m', target: 1000 },  // 峰值：1000 VU
    { duration: '2m', target: 600 },   // 降压：600 VU
    { duration: '2m', target: 300 },   // 继续降压：300 VU
    { duration: '1m', target: 0 },     // 冷却：0 VU
  ],

  // SLA 阈值（高并发场景适当放宽）
  thresholds: {
    'http_req_duration': [
      'p(95)<1000',  // 95% 请求 < 1秒（高并发场景）
      'p(99)<2000',  // 99% 请求 < 2秒
      'avg<500',     // 平均 < 500ms
    ],
    'http_req_failed': ['rate<0.02'],  // 错误率 < 2%（高并发场景）
    'errors': ['rate<0.02'],
  },

  // 并发限制
  maxVUs: 1000,
  
  // 输出
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// 辅助函数：生成随机字符串
function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * 测试场景
 */
export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };

  // 1. 健康检查（轻量级）
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health response time < 200ms': (r) => r.timings.duration < 200,
    }) || errorRate.add(1);

    requestCount.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(0.5); // 缩短等待时间以提高压力

  // 2. 获取智能体列表
  group('Get Agents', () => {
    const res = http.get(`${BASE_URL}/api/agents`, { headers });
    
    const success = check(res, {
      'agents status 200': (r) => r.status === 200,
      'agents has data': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 'SUCCESS' && Array.isArray(body.data);
      },
      'agents response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (!success) errorRate.add(1);
    requestCount.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(0.5);

  // 3. 聊天请求（非流式，高并发场景）
  group('Chat Completions', () => {
    const payload = JSON.stringify({
      agentId: 'fastgpt-assistant',
      messages: [
        { role: 'user', content: `压测消息 ${randomString(5)}` },
      ],
      stream: false,
    });

    const res = http.post(`${BASE_URL}/api/chat/completions`, payload, { 
      headers,
      timeout: '30s', // 30秒超时
    });
    
    const success = check(res, {
      'chat status 200 or 429': (r) => r.status === 200 || r.status === 429, // 允许限流
      'chat response time < 5000ms': (r) => r.timings.duration < 5000,
    });

    if (!success && res.status !== 429) errorRate.add(1); // 限流不算错误
    requestCount.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(1);
}

/**
 * 测试完成后的汇总报告
 */
export function handleSummary(data) {
  const { metrics } = data;
  
  let summary = '\n========== 高并发压力测试报告 (最大1000并发) ==========\n\n';
  
  // HTTP 请求统计
  summary += '📊 HTTP 请求统计:\n';
  summary += `  总请求数: ${metrics.http_reqs.values.count}\n`;
  summary += `  成功率: ${(100 - metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  summary += `  错误率: ${(metrics.errors.values.rate * 100).toFixed(2)}%\n\n`;
  
  // 响应时间
  summary += '⏱️  响应时间:\n';
  summary += `  平均: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  最小: ${metrics.http_req_duration.values.min.toFixed(2)}ms\n`;
  summary += `  最大: ${metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  summary += `  p50: ${metrics.http_req_duration.values['p(50)'].toFixed(2)}ms\n`;
  summary += `  p90: ${metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
  summary += `  p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  // 吞吐量
  const duration = data.state.testRunDurationMs / 1000;
  const rps = metrics.http_reqs.values.count / duration;
  summary += '🚀 吞吐量:\n';
  summary += `  QPS: ${rps.toFixed(2)} req/s\n`;
  summary += `  总耗时: ${(duration / 60).toFixed(2)} 分钟\n\n`;
  
  // SLA 验证（高并发场景）
  summary += '✅ SLA 验证 (高并发场景):\n';
  summary += `  p95 < 1000ms: ${metrics.http_req_duration.values['p(95)'] < 1000 ? '✓ 通过' : '✗ 失败'}\n`;
  summary += `  p99 < 2000ms: ${metrics.http_req_duration.values['p(99)'] < 2000 ? '✓ 通过' : '✗ 失败'}\n`;
  summary += `  错误率 < 2%: ${metrics.errors.values.rate < 0.02 ? '✓ 通过' : '✗ 失败'}\n\n`;
  
  // 并发能力
  summary += '💪 并发能力:\n';
  summary += `  峰值并发: 1000 VU\n`;
  summary += `  平均响应时间: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  系统稳定性: ${metrics.errors.values.rate < 0.02 ? '优秀' : '需要优化'}\n\n`;
  
  summary += '=========================================\n';
  
  return {
    'stdout': summary,
    'summary.json': JSON.stringify(data, null, 2),
  };
}
