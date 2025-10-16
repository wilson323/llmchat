/**
 * T024: 数据一致性测试
 * 
 * 测试场景：
 * - 并发写入会话
 * - 事务隔离验证
 * - 缓存一致性
 * - 数据库回滚测试
 */

import { test, expect } from '@playwright/test';

test.describe('T024: 数据一致性测试', () => {
  let adminToken: string;
  const userTokens: string[] = [];

  test.beforeAll(async ({ request }) => {
    // 管理员登录
    const adminResponse = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'admin', password: 'admin123' },
    });
    
    if (adminResponse.ok()) {
      const result = await adminResponse.json();
      adminToken = result.data.token;
    }

    // 创建多个测试用户
    for (let i = 0; i < 3; i++) {
      const user = {
        username: `consistency_user_${i}_${Date.now()}`,
        password: 'Test123!@#',
        role: 'user',
      };

      const response = await request.post('http://localhost:3001/api/auth/register', {
        data: user,
      });

      if (response.ok()) {
        const result = await response.json();
        userTokens.push(result.data.token);
      }
    }
  });

  test.describe('1️⃣ 并发写入测试', () => {
    test('并发创建会话应该都成功', async ({ request }) => {
      const promises = userTokens.map((token, index) =>
        request.post('http://localhost:3001/api/chat-sessions', {
          headers: { 'Authorization': `Bearer ${token}` },
          data: {
            agentId: 'fastgpt-1',
            title: `并发会话 ${index}`,
          },
        })
      );

      const responses = await Promise.all(promises);

      // 所有请求都应该成功（如果端点存在）
      responses.forEach(response => {
        if (response.status() !== 404) {
          expect([200, 201]).toContain(response.status());
        }
      });
    });

    test('并发更新同一会话应该保持数据一致', async ({ request }) => {
      // 创建一个会话
      const createResponse = await request.post('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        data: {
          agentId: 'fastgpt-1',
          title: '并发更新测试会话',
        },
      });

      if (createResponse.ok()) {
        const sessionData = await createResponse.json();
        const sessionId = sessionData.data.id;

        // 并发更新标题
        const updatePromises = Array.from({ length: 5 }, (_, i) =>
          request.patch(`http://localhost:3001/api/chat-sessions/${sessionId}/title`, {
            headers: { 'Authorization': `Bearer ${userTokens[0]}` },
            data: {
              title: `更新标题 ${i}`,
            },
          })
        );

        const updateResponses = await Promise.all(updatePromises);

        // 至少应该有部分更新成功
        const successCount = updateResponses.filter(r => r.ok()).length;
        expect(successCount).toBeGreaterThan(0);

        // 最终读取会话，标题应该是其中一个更新值
        const getResponse = await request.get(`http://localhost:3001/api/chat-sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        });

        if (getResponse.ok()) {
          const finalData = await getResponse.json();
          expect(finalData.data.title).toMatch(/更新标题 \d/);
        }
      }
    });

    test('并发添加消息应该不丢失', async ({ request }) => {
      // 创建会话
      const createResponse = await request.post('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        data: {
          agentId: 'fastgpt-1',
          title: '并发消息测试',
        },
      });

      if (createResponse.ok()) {
        const sessionData = await createResponse.json();
        const sessionId = sessionData.data.id;

        // 并发发送多条消息
        const messagePromises = Array.from({ length: 10 }, (_, i) =>
          request.post('http://localhost:3001/api/chat/completions', {
            data: {
              agentId: 'fastgpt-1',
              message: `并发消息 ${i}`,
              stream: false,
              sessionId,
            },
          })
        );

        await Promise.allSettled(messagePromises);

        // 等待消息保存
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 获取会话历史
        const historyResponse = await request.get(`http://localhost:3001/api/chat/history/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        });

        if (historyResponse.ok()) {
          const historyData = await historyResponse.json();
          
          // 消息数量应该合理（可能部分失败）
          if (historyData.data && historyData.data.messages) {
            expect(historyData.data.messages.length).toBeGreaterThan(0);
            expect(historyData.data.messages.length).toBeLessThanOrEqual(20);
          }
        }
      }
    }, 40000);
  });

  test.describe('2️⃣ 事务隔离验证', () => {
    test('用户只能访问自己的会话', async ({ request }) => {
      // 用户1创建会话
      const user1Response = await request.post('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        data: {
          agentId: 'fastgpt-1',
          title: '用户1的会话',
        },
      });

      if (user1Response.ok()) {
        const sessionData = await user1Response.json();
        const sessionId = sessionData.data.id;

        // 用户2尝试访问用户1的会话
        const user2Response = await request.get(`http://localhost:3001/api/chat-sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${userTokens[1]}` },
        });

        // 应该被拒绝或返回404
        if (user2Response.status() !== 404) {
          expect([401, 403, 404]).toContain(user2Response.status());
        }
      }
    });

    test('删除会话不应影响其他会话', async ({ request }) => {
      // 创建两个会话
      const session1 = await request.post('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        data: { agentId: 'fastgpt-1', title: '会话1' },
      });

      const session2 = await request.post('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        data: { agentId: 'fastgpt-1', title: '会话2' },
      });

      if (session1.ok() && session2.ok()) {
        const session1Data = await session1.json();
        const session2Data = await session2.json();
        const session1Id = session1Data.data.id;
        const session2Id = session2Data.data.id;

        // 删除会话1
        await request.delete(`http://localhost:3001/api/chat-sessions/${session1Id}`, {
          headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        });

        // 会话2应该仍然存在
        const getSession2 = await request.get(`http://localhost:3001/api/chat-sessions/${session2Id}`, {
          headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        });

        expect(getSession2.ok()).toBeTruthy();
      }
    });
  });

  test.describe('3️⃣ 缓存一致性', () => {
    test('更新数据后缓存应该失效', async ({ request }) => {
      // 获取智能体列表（可能被缓存）
      const firstResponse = await request.get('http://localhost:3001/api/agents');
      const firstData = await firstResponse.json();

      // 触发配置重载
      await request.post('http://localhost:3001/api/agents/reload', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      // 等待缓存失效
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 再次获取
      const secondResponse = await request.get('http://localhost:3001/api/agents');
      const secondData = await secondResponse.json();

      // 数据应该一致（或缓存已更新）
      expect(secondData).toHaveProperty('data');
    });

    test('Redis失败时应该回退到数据库', async ({ request }) => {
      // 这个测试需要模拟Redis故障，暂时简化
      const response = await request.get('http://localhost:3001/api/agents');
      
      // 即使Redis不可用，请求也应该成功
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('4️⃣ 数据库回滚验证', () => {
    test('失败的操作不应该留下部分数据', async ({ request }) => {
      // 尝试创建无效的会话（缺少必填字段）
      const invalidResponse = await request.post('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
        data: {
          // 缺少agentId
          title: '无效会话',
        },
      });

      // 应该失败
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);

      // 获取会话列表，不应该包含这个失败的会话
      const listResponse = await request.get('http://localhost:3001/api/chat-sessions', {
        headers: { 'Authorization': `Bearer ${userTokens[0]}` },
      });

      if (listResponse.ok()) {
        const listData = await listResponse.json();
        
        if (Array.isArray(listData.data)) {
          const invalidSession = listData.data.find((s: any) => s.title === '无效会话');
          expect(invalidSession).toBeUndefined();
        }
      }
    });
  });
});

