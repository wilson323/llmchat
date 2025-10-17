/**
 * 错误处理修复工具
 * 用于修复集成测试中的错误处理问题
 */

import { createTestApp, generateTestToken } from './integrationTestUtils';

/**
 * 测试实际的API响应格式
 */
export async function analyzeApiErrorResponses() {
  const app = createTestApp();
  const authToken = generateTestToken();

  console.log('🔍 分析API错误响应格式...\n');

  // 测试不存在的智能体
  try {
    const response = await (await import('supertest')).default(app)
      .get('/api/agents/non-existent-agent')
      .expect(404);

    console.log('❌ 404响应格式 (不存在的智能体):');
    console.log(JSON.stringify(response.body, null, 2));
    console.log('');
  } catch (error: any) {
    console.error('404测试失败:', error);
  }

  // 测试无效JSON
  try {
    const response = await (await import('supertest')).default(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('invalid-json')
      .expect(400);

    console.log('❌ 400响应格式 (无效JSON):');
    console.log(JSON.stringify(response.body, null, 2));
    console.log('');
  } catch (error: any) {
    console.error('400测试失败:', error);
  }

  // 测试OPTIONS请求
  try {
    const response = await (await import('supertest')).default(app)
      .options('/api/agents')
      .expect(404);

    console.log('❌ 404响应格式 (OPTIONS请求):');
    console.log(JSON.stringify(response.body, null, 2));
    console.log('');
  } catch (error: any) {
    console.error('OPTIONS测试失败:', error);
  }

  // 测试认证失败
  try {
    const response = await (await import('supertest')).default(app)
      .get('/api/chat/sessions')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    console.log('❌ 401响应格式 (无效token):');
    console.log(JSON.stringify(response.body, null, 2));
    console.log('');
  } catch (error: any) {
    console.error('401测试失败:', error);
  }
}

/**
 * 生成正确的错误响应期望
 */
export function getExpectedErrorFormats() {
  return {
    notFound: {
      // 实际API返回的格式
      actual: {
        code: expect.any(String),
        message: expect.any(String),
        category: expect.any(String),
        severity: expect.any(String),
        timestamp: expect.any(String)
      },
      // 测试中期望的格式（需要修正）
      expected: {
        success: false,
        error: expect.any(String)
      }
    },
    validationError: {
      actual: {
        code: expect.any(String),
        message: expect.any(String),
        category: expect.any(String),
        severity: expect.any(String),
        timestamp: expect.any(String)
      },
      expected: {
        success: false
      }
    }
  };
}

/**
 * 运行错误响应分析
 */
if (require.main === module) {
  analyzeApiErrorResponses().catch(console.error);
}
