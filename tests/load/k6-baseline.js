/**
 * k6 基准性能测试
 * 
 * 运行方式：
 * k6 run tests/load/k6-baseline.js
 * 
 * 带环境变量：
 * k6 run -e BASE_URL=http://localhost:3001 tests/load/k6-baseline.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const requestCount = new Counter('request_count');

// 测试配置（轻量级，避免过度占用资源）
export const options = {
  // 场景：逐步加压（最大50并发，适合单机测试）
  stages: [
    { duration: '30s', target: 5 },   // 预热：5 VU
    { duration: '1m', target: 20 },   // 加压：20 VU
    { duration: '2m', target: 50 },   // 峰值：50 VU
    { duration: '1m', target: 20 },   // 降压：20 VU
    { duration: '30s', target: 0 },   // 冷却：0 VU
  ],

  // SLA 阈值
  thresholds: {
    'http_req_duration': [
      'p(95)<500',   // 95% 请求 < 500ms
      'p(99)<1000',  // 99% 请求 < 1000ms
      'avg<300',     // 平均 < 300ms
    ],
    'http_req_failed': ['rate<0.01'],  // 错误率 < 1%
    'errors': ['rate<0.01'],           // 业务错误率 < 1%
    'api_latency': ['p(95)<500'],      // API延时 p95 < 500ms
  },

  // 并发限制
  // maxVUs: 100,
  
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

  // 1. 健康检查
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health has status': (r) => JSON.parse(r.body).status === 'ok',
      'health response time < 100ms': (r) => r.timings.duration < 100,
    }) || errorRate.add(1);

    requestCount.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(1);

  // 2. 获取智能体列表
  group('Get Agents List', () => {
    const res = http.get(`${BASE_URL}/api/agents`, { headers });
    
    const success = check(res, {
      'agents status 200': (r) => r.status === 200,
      'agents has data': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 'SUCCESS' && Array.isArray(body.data);
      },
      'agents response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (!success) errorRate.add(1);
    requestCount.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(1);

  // 3. 聊天请求（非流式）
  group('Chat Completions (Non-Stream)', () => {
    const payload = JSON.stringify({
      agentId: 'fastgpt-assistant',
      messages: [
        { role: 'user', content: `测试消息 ${randomString(5)}` },
      ],
      stream: false,
    });

    const res = http.post(`${BASE_URL}/api/chat/completions`, payload, { headers });
    
    const success = check(res, {
      'chat status 200': (r) => r.status === 200,
      'chat has response': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.code === 'SUCCESS' || body.data !== undefined;
        } catch {
          return false;
        }
      },
      'chat response time < 3000ms': (r) => r.timings.duration < 3000,
    });

    if (!success) errorRate.add(1);
    requestCount.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(2);

  // 4. 详细健康检查
  group('Detailed Health Check', () => {
    const res = http.get(`${BASE_URL}/health/detailed`);
    
    check(res, {
      'detailed health status 200 or 503': (r) => r.status === 200 || r.status === 503,
      'detailed health has components': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.components !== undefined;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);

    requestCount.add(1);
  });

  sleep(1);
}

/**
 * 测试完成后的汇总报告
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data),
  };
}

// 简单的文本摘要
function textSummary(data) {
  const { metrics } = data;
  
  let summary = '\n========== 性能测试报告 ==========\n\n';
  
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
  summary += `  p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  // 吞吐量
  const duration = data.state.testRunDurationMs / 1000;
  const rps = metrics.http_reqs.values.count / duration;
  summary += '🚀 吞吐量:\n';
  summary += `  QPS: ${rps.toFixed(2)} req/s\n\n`;
  
  // SLA 验证
  summary += '✅ SLA 验证:\n';
  summary += `  p95 < 500ms: ${metrics.http_req_duration.values['p(95)'] < 500 ? '✓ 通过' : '✗ 失败'}\n`;
  summary += `  p99 < 1000ms: ${metrics.http_req_duration.values['p(99)'] < 1000 ? '✓ 通过' : '✗ 失败'}\n`;
  summary += `  错误率 < 1%: ${metrics.errors.values.rate < 0.01 ? '✓ 通过' : '✗ 失败'}\n\n`;
  
  summary += '====================================\n';
  
  return summary;
}

// 简单的 HTML 报告
function htmlReport(data) {
  const { metrics } = data;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>k6 性能测试报告</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #4CAF50; color: white; }
    tr:hover { background-color: #f5f5f5; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .metric-label { font-size: 14px; color: #666; }
    .pass { color: #4CAF50; font-weight: bold; }
    .fail { color: #f44336; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 k6 性能测试报告</h1>
    <p>测试时间: ${new Date().toISOString()}</p>
    
    <h2>核心指标</h2>
    <div>
      <div class="metric">
        <div class="metric-value">${metrics.http_reqs.values.count}</div>
        <div class="metric-label">总请求数</div>
      </div>
      <div class="metric">
        <div class="metric-value">${(100 - metrics.http_req_failed.values.rate * 100).toFixed(2)}%</div>
        <div class="metric-label">成功率</div>
      </div>
      <div class="metric">
        <div class="metric-value">${metrics.http_req_duration.values.avg.toFixed(2)}ms</div>
        <div class="metric-label">平均响应时间</div>
      </div>
      <div class="metric">
        <div class="metric-value">${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</div>
        <div class="metric-label">p95 响应时间</div>
      </div>
    </div>
    
    <h2>响应时间分布</h2>
    <table>
      <tr>
        <th>指标</th>
        <th>值</th>
      </tr>
      <tr><td>最小值</td><td>${metrics.http_req_duration.values.min.toFixed(2)}ms</td></tr>
      <tr><td>平均值</td><td>${metrics.http_req_duration.values.avg.toFixed(2)}ms</td></tr>
      <tr><td>中位数 (p50)</td><td>${metrics.http_req_duration.values['p(50)'].toFixed(2)}ms</td></tr>
      <tr><td>p90</td><td>${metrics.http_req_duration.values['p(90)'].toFixed(2)}ms</td></tr>
      <tr><td>p95</td><td>${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td></tr>
      <tr><td>p99</td><td>${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td></tr>
      <tr><td>最大值</td><td>${metrics.http_req_duration.values.max.toFixed(2)}ms</td></tr>
    </table>
    
    <h2>SLA 验证</h2>
    <table>
      <tr>
        <th>指标</th>
        <th>目标值</th>
        <th>实际值</th>
        <th>状态</th>
      </tr>
      <tr>
        <td>p95 响应时间</td>
        <td>&lt; 500ms</td>
        <td>${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td>
        <td class="${metrics.http_req_duration.values['p(95)'] < 500 ? 'pass' : 'fail'}">
          ${metrics.http_req_duration.values['p(95)'] < 500 ? '✓ 通过' : '✗ 失败'}
        </td>
      </tr>
      <tr>
        <td>p99 响应时间</td>
        <td>&lt; 1000ms</td>
        <td>${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td>
        <td class="${metrics.http_req_duration.values['p(99)'] < 1000 ? 'pass' : 'fail'}">
          ${metrics.http_req_duration.values['p(99)'] < 1000 ? '✓ 通过' : '✗ 失败'}
        </td>
      </tr>
      <tr>
        <td>错误率</td>
        <td>&lt; 1%</td>
        <td>${(metrics.errors.values.rate * 100).toFixed(2)}%</td>
        <td class="${metrics.errors.values.rate < 0.01 ? 'pass' : 'fail'}">
          ${metrics.errors.values.rate < 0.01 ? '✓ 通过' : '✗ 失败'}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
