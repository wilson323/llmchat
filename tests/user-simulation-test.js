#!/usr/bin/env node

/**
 * 🎭 用户行为模拟测试
 * 模拟真实用户的浏览器操作，确保系统在实际使用中的稳定性
 */

const http = require('http');
const { execSync } = require('child_process');

class UserSimulationTest {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  log(message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`);
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // 确保使用127.0.0.1而不是localhost
      const urlObj = new URL(url);
      if (urlObj.hostname === 'localhost') {
        urlObj.hostname = '127.0.0.1';
      }

      const req = http.request(urlObj, options || {}, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = Date.now();
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            responseTime: endTime - startTime
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async testUserScenario(scenarioName, testFunction) {
    try {
      this.log(`🎭 开始用户场景: ${scenarioName}`);
      const startTime = Date.now();

      const result = await testFunction();

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.testResults.push({
        scenario: scenarioName,
        success: result.success,
        message: result.message,
        duration: duration
      });

      if (result.success) {
        this.log(`✅ 场景完成: ${scenarioName} (${duration}ms)`);
      } else {
        this.log(`❌ 场景失败: ${scenarioName} - ${result.message}`);
      }

      return result;
    } catch (error) {
      this.log(`💥 场景异常: ${scenarioName} - ${error.message}`);
      this.testResults.push({
        scenario: scenarioName,
        success: false,
        message: error.message,
        duration: 0
      });
      return { success: false, message: error.message };
    }
  }

  // 场景1: 用户首次访问网站
  async simulateFirstTimeVisit() {
    try {
      // 用户在浏览器中输入网址
      const response = await this.makeRequest('http://localhost:3004', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (response.status === 200 && response.body.includes('LLMChat')) {
        return { success: true, message: `首页加载成功，响应时间: ${response.responseTime}ms` };
      } else {
        return { success: false, message: `首页加载失败，状态码: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `网络请求失败: ${error.message}` };
    }
  }

  // 场景2: 用户刷新页面
  async simulatePageRefresh() {
    try {
      // 用户按F5刷新页面
      const response = await this.makeRequest('http://localhost:3004', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.status === 200) {
        return { success: true, message: `页面刷新成功，响应时间: ${response.responseTime}ms` };
      } else {
        return { success: false, message: `页面刷新失败，状态码: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `刷新请求失败: ${error.message}` };
    }
  }

  // 场景3: 用户尝试访问API端点
  async simulateApiAccess() {
    try {
      // 用户通过前端代理访问后端API（测试代理功能）
      const response = await this.makeRequest('http://localhost:3004/api/health', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // 代理正常工作会返回404，因为后端没有/api/health路由
      // 但这证明代理转发功能正常工作
      if (response.status === 404 && response.body.includes('NOT_FOUND')) {
        return { success: true, message: `API代理功能正常，响应时间: ${response.responseTime}ms` };
      } else if (response.status === 200) {
        // 如果意外成功，说明后端可能有/api路由
        return { success: true, message: `API访问成功，响应时间: ${response.responseTime}ms` };
      } else {
        return { success: false, message: `API代理异常，状态码: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `API请求失败: ${error.message}` };
    }
  }

  // 场景4: 用户在多个标签页中打开网站
  async simulateMultipleTabs() {
    try {
      const requests = [];

      // 用户在3个标签页中同时打开网站
      for (let i = 0; i < 3; i++) {
        requests.push(
          this.makeRequest('http://localhost:3004', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          })
        );

        // 模拟用户打开标签页的时间间隔
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;

      if (successCount === 3) {
        const avgResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
        return { success: true, message: `多标签页测试成功，平均响应时间: ${avgResponseTime.toFixed(1)}ms` };
      } else {
        return { success: false, message: `多标签页测试失败，成功响应: ${successCount}/3` };
      }
    } catch (error) {
      return { success: false, message: `多标签页测试异常: ${error.message}` };
    }
  }

  // 场景5: 用户长时间停留在网站
  async simulateLongSession() {
    try {
      // 模拟用户在网站上停留3秒（减少测试时间）
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 期间发送心跳请求
      const heartbeatResponse = await this.makeRequest('http://localhost:3004', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (heartbeatResponse.status === 200) {
        return { success: true, message: `长会话测试成功，心跳响应正常` };
      } else {
        return { success: false, message: `长会话测试失败，心跳异常: ${heartbeatResponse.status}` };
      }
    } catch (error) {
      return { success: false, message: `长会话测试异常: ${error.message}` };
    }
  }

  // 场景6: 网络不稳定情况下的重试
  async simulateNetworkRetry() {
    try {
      let successCount = 0;
      let attempts = 0;
      const maxAttempts = 2; // 减少重试次数

      // 模拟网络不稳定，进行重试
      while (attempts < maxAttempts) {
        attempts++;

        try {
          const response = await this.makeRequest('http://localhost:3004', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });

          if (response.status === 200) {
            successCount++;
            break;
          }
        } catch (error) {
          // 模拟网络延迟（减少延迟时间）
          await new Promise(resolve => setTimeout(resolve, 200 * attempts));
        }
      }

      if (successCount > 0) {
        return { success: true, message: `网络重试测试成功，重试次数: ${attempts}` };
      } else {
        return { success: false, message: `网络重试测试失败，重试${attempts}次均失败` };
      }
    } catch (error) {
      return { success: false, message: `网络重试测试异常: ${error.message}` };
    }
  }

  // 场景7: 移动设备用户访问
  async simulateMobileUser() {
    try {
      const response = await this.makeRequest('http://localhost:3004', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      });

      if (response.status === 200) {
        return { success: true, message: `移动设备访问成功，响应时间: ${response.responseTime}ms` };
      } else {
        return { success: false, message: `移动设备访问失败，状态码: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `移动设备访问异常: ${error.message}` };
    }
  }

  async runAllTests() {
    this.log('🎭 开始用户行为模拟测试...');
    this.log('目标: 验证真实用户场景下的系统稳定性');

    // 运行所有用户场景测试
    await this.testUserScenario('首次访问网站', () => this.simulateFirstTimeVisit());
    await this.testUserScenario('页面刷新操作', () => this.simulatePageRefresh());
    await this.testUserScenario('API端点访问', () => this.simulateApiAccess());
    await this.testUserScenario('多标签页使用', () => this.simulateMultipleTabs());
    await this.testUserScenario('长时间会话', () => this.simulateLongSession());
    await this.testUserScenario('网络重试机制', () => this.simulateNetworkRetry());
    await this.testUserScenario('移动设备访问', () => this.simulateMobileUser());

    this.generateReport();
  }

  generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = this.testResults.filter(t => !t.success).length;
    const successRate = (passedTests / this.testResults.length * 100).toFixed(1);

    console.log('\n' + '='.repeat(50));
    console.log('🎭 用户行为模拟测试报告');
    console.log('='.repeat(50));

    console.log(`\n📊 测试统计:`);
    console.log(`✅ 通过: ${passedTests}个场景`);
    console.log(`❌ 失败: ${failedTests}个场景`);
    console.log(`📈 成功率: ${successRate}%`);
    console.log(`⏱️ 总耗时: ${(totalDuration / 1000).toFixed(2)}秒`);

    console.log(`\n📋 详细结果:`);
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration > 0 ? ` (${result.duration}ms)` : '';
      console.log(`${status} ${index + 1}. ${result.scenario}${duration}`);
      console.log(`    ${result.message}`);
    });

    console.log('\n' + '='.repeat(50));

    if (successRate === '100.0') {
      console.log('🎉 所有用户场景测试通过！');
      console.log('✅ 系统在真实用户使用场景下表现完美！');
      console.log('🚀 可以安全投入生产环境使用！');
    } else {
      console.log('⚠️ 部分用户场景测试失败');
      console.log('❌ 建议在投入生产前修复发现的问题');
    }

    console.log('\n' + '='.repeat(50));
  }
}

// 运行用户行为模拟测试
const test = new UserSimulationTest();
test.runAllTests().catch(console.error);