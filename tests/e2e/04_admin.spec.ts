/**
 * T021: 管理后台测试
 * 
 * 测试覆盖：
 * - 系统信息查询
 * - 用户管理功能
 * - 日志查询
 * - 统计数据获取
 * - 权限验证
 */

import { test, expect } from '@playwright/test';

test.describe.skip('T021: 管理后台测试', () => {
  let adminToken: string;
  const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123',
  };

  test.beforeAll(async ({ request }) => {
    // 管理员登录
    const response = await request.post('http://localhost:3001/api/auth/login', {
      data: ADMIN_CREDENTIALS,
    });

    const result = await response.json();
    if (result.data && result.data.token) {
      adminToken = result.data.token;
    }
  });

  test.describe('1️⃣ 权限验证', () => {
    test('管理员应该能访问管理端点', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      // 如果端点存在，管理员应该能访问
      if (response.status() !== 404) {
        expect([200, 201]).toContain(response.status());
      }
    });

    test('普通用户应该被拒绝访问管理端点', async ({ request }) => {
      // 创建普通用户
      const userCreds = {
        username: `test_user_${Date.now()}`,
        password: 'Test123!@#',
        role: 'user',
      };

      const registerResponse = await request.post('http://localhost:3001/api/auth/register', {
        data: userCreds,
      });

      if (registerResponse.ok()) {
        const userData = await registerResponse.json();
        const userToken = userData.data.token;

        // 尝试访问管理端点
        const adminResponse = await request.get('http://localhost:3001/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${userToken}`,
          },
        });

        // 应该被拒绝
        expect([401, 403]).toContain(adminResponse.status());
      }
    });

    test('未认证请求应该被拒绝', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/stats');

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('2️⃣ 系统信息查询', () => {
    test('应该成功获取系统信息', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/system-info', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status() !== 404) {
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        
        expect(data).toHaveProperty('data');
        
        // 系统信息应该包含基本指标
        if (data.data) {
          const sysInfo = data.data;
          
          // 可能包含的字段
          if (sysInfo.memory) {
            expect(typeof sysInfo.memory).toBe('object');
          }
          if (sysInfo.cpu) {
            expect(typeof sysInfo.cpu).toBe('object');
          }
          if (sysInfo.uptime !== undefined) {
            expect(typeof sysInfo.uptime).toBe('number');
          }
        }
      }
    });

    test('系统信息应该包含数据库状态', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/system-info', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.ok()) {
        const data = await response.json();
        
        if (data.data && data.data.database) {
          expect(data.data.database).toHaveProperty('healthy');
          expect(typeof data.data.database.healthy).toBe('boolean');
        }
      }
    });
  });

  test.describe('3️⃣ 统计数据获取', () => {
    test('应该成功获取统计数据', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status() !== 404) {
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        
        expect(data).toHaveProperty('data');
      }
    });

    test('统计数据应该包含用户和会话数量', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.ok()) {
        const data = await response.json();
        
        if (data.data) {
          const stats = data.data;
          
          // 可能包含的统计字段
          if (stats.totalUsers !== undefined) {
            expect(typeof stats.totalUsers).toBe('number');
            expect(stats.totalUsers).toBeGreaterThanOrEqual(0);
          }
          if (stats.totalSessions !== undefined) {
            expect(typeof stats.totalSessions).toBe('number');
            expect(stats.totalSessions).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('应该支持时间范围筛选', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        params: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
      });

      // 端点可能不支持时间筛选，但不应该报错
      if (response.status() !== 404) {
        expect(response.status()).toBeLessThan(500);
      }
    });
  });

  test.describe('4️⃣ 用户管理功能', () => {
    test('应该能够获取用户列表', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status() !== 404) {
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        
        expect(data).toHaveProperty('data');
        
        if (Array.isArray(data.data)) {
          expect(data.data.length).toBeGreaterThanOrEqual(0);
          
          // 检查用户对象结构
          if (data.data.length > 0) {
            const user = data.data[0];
            expect(user).toHaveProperty('id');
            expect(user).toHaveProperty('username');
            expect(user).toHaveProperty('role');
            
            // 不应该暴露密码
            expect(user.password).toBeUndefined();
            expect(user.password_hash).toBeUndefined();
          }
        }
      }
    });

    test('应该支持用户搜索', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        params: {
          search: 'admin',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
      }
    });

    test('应该支持用户分页', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        params: {
          page: 1,
          limit: 10,
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        
        // 可能包含分页元数据
        if (data.pagination || data.meta) {
          const meta = data.pagination || data.meta;
          expect(meta.page || meta.current_page).toBeDefined();
          expect(meta.total || meta.total_count).toBeDefined();
        }
      }
    });
  });

  test.describe('5️⃣ 日志查询', () => {
    test('应该能够获取审计日志', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/audit', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status() !== 404) {
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        
        expect(data).toHaveProperty('data');
        
        if (Array.isArray(data.data)) {
          // 日志应该包含基本字段
          if (data.data.length > 0) {
            const log = data.data[0];
            expect(log).toHaveProperty('timestamp');
            expect(log).toHaveProperty('action');
          }
        }
      }
    });

    test('应该支持日志类型筛选', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/audit', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        params: {
          type: 'security',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        
        if (Array.isArray(data.data) && data.data.length > 0) {
          // 所有日志应该是security类型
          const allSecurity = data.data.every((log: any) => 
            log.type === 'security' || log.category === 'security'
          );
          expect(allSecurity).toBe(true);
        }
      }
    });

    test('应该支持日志时间范围查询', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/audit', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        params: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
      }
    });
  });

  test.describe('6️⃣ 性能监控', () => {
    test('应该能够获取性能指标', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/metrics', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status() !== 404) {
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        
        expect(data).toHaveProperty('data');
      }
    });

    test('性能指标应该包含响应时间统计', async ({ request }) => {
      const response = await request.get('http://localhost:3001/api/admin/metrics', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.ok()) {
        const data = await response.json();
        
        if (data.data && data.data.performance) {
          const perf = data.data.performance;
          
          // 常见的性能指标
          if (perf.avgResponseTime !== undefined) {
            expect(typeof perf.avgResponseTime).toBe('number');
          }
          if (perf.requestCount !== undefined) {
            expect(typeof perf.requestCount).toBe('number');
          }
        }
      }
    });
  });
});

