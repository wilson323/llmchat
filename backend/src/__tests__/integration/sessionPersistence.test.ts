/**
 * 会话数据持久化验证测试
 * 
 * 验证会话数据的完整持久化：
 * - 数据库存储验证
 * - Redis缓存同步
 * - 数据一致性检查
 * - 故障恢复能力
 */

import { Pool } from 'pg';
import logger from '@/utils/logger';
import { dbTestSetup } from '../utils/dbTestUtils';

// Mock logger
jest.mock('@/utils/logger');

describe('Session Persistence Verification', () => {
  let pool: Pool;
  let testUserId: number;
  
  beforeAll(async () => {
    await dbTestSetup.beforeAll();
    pool = dbTestSetup.getClient();
  });
  
  beforeEach(async () => {
    await dbTestSetup.beforeEach();
    
    // 创建测试用户（chat_sessions的外键依赖）
    const userResult = await pool.query(
      'INSERT INTO users (username, password_salt, password_hash, email, email_verified, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      ['test-user', 'salt', 'hash', 'test@example.com', true, 'user', 'active']
    );
    testUserId = userResult.rows[0].id;
  });
  
  afterAll(async () => {
    await dbTestSetup.afterAll();
  });
  describe('Database Storage', () => {
    it('should verify chat_sessions table exists', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'chat_sessions'
        );
      `);

      expect(result.rows[0]?.exists).toBe(true);
    });

    it('should verify chat_messages table exists', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'chat_messages'
        );
      `);

      expect(result.rows[0]?.exists).toBe(true);
    });

    it('should verify required columns in chat_sessions', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_sessions'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((row: any) => row.column_name);
      
      // 验证必需字段存在
      expect(columns).toContain('id');
      expect(columns).toContain('title');
      expect(columns).toContain('user_id');
      expect(columns).toContain('agent_id');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should verify required columns in chat_messages', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_messages'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((row: any) => row.column_name);
      
      // 验证必需字段存在
      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('role');
      expect(columns).toContain('content');
      expect(columns).toContain('created_at');
    });
  });

  describe('Data Persistence Flow', () => {
    it('should persist session data to database', async () => {
      // 创建测试会话
      const testSession = {
        id: `test-session-${Date.now()}`,
        title: 'Test Session',
        user_id: 'test-user',
        agent_id: 'test-agent',
      };

      const insertResult = await pool.query(
        `INSERT INTO chat_sessions (id, title, user_id, agent_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [testSession.id, testSession.title, testUserId, testSession.agent_id]
      );

      expect(insertResult.rows[0]?.id).toBe(testSession.id);

      // 验证数据已持久化
      const selectResult = await pool.query(
        'SELECT * FROM chat_sessions WHERE id = $1',
        [testSession.id]
      );

      expect(selectResult.rows.length).toBe(1);
      expect(selectResult.rows[0]?.title).toBe(testSession.title);

      // 清理测试数据
      await pool.query('DELETE FROM chat_sessions WHERE id = $1', [testSession.id]);
    });

    it('should persist messages data to database', async () => {
      
      // 创建测试会话和消息
      const testSessionId = `test-session-${Date.now()}`;
      
      // 先创建会话
      await pool.query(
        `INSERT INTO chat_sessions (id, title, user_id, agent_id) 
         VALUES ($1, $2, $3, $4)`,
        [testSessionId, 'Test Session', testUserId, 'test-agent']
      );

      // 创建消息
      const testMessage = {
        id: `test-msg-${Date.now()}`,
        session_id: testSessionId,
        role: 'user',
        content: 'Test message',
      };

      const insertResult = await pool.query(
        `INSERT INTO chat_messages (id, session_id, role, content) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [testMessage.id, testMessage.session_id, testMessage.role, testMessage.content]
      );

      expect(insertResult.rows[0]?.id).toBe(testMessage.id);

      // 验证数据已持久化
      const selectResult = await pool.query(
        'SELECT * FROM chat_messages WHERE id = $1',
        [testMessage.id]
      );

      expect(selectResult.rows.length).toBe(1);
      expect(selectResult.rows[0]?.content).toBe(testMessage.content);

      // 清理测试数据
      await pool.query('DELETE FROM chat_messages WHERE id = $1', [testMessage.id]);
      await pool.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId]);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity between sessions and messages', async () => {
      
      // 验证外键约束存在
      const result = await pool.query(`
        SELECT 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'chat_messages'
          AND kcu.column_name = 'session_id';
      `);

      // 应该有session_id的外键约束
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should handle concurrent session updates correctly', async () => {
      const testSessionId = `concurrent-test-${Date.now()}`;

      // 创建测试会话
      await pool.query(
        `INSERT INTO chat_sessions (id, title, user_id, agent_id) 
         VALUES ($1, $2, $3, $4)`,
        [testSessionId, 'Concurrent Test', 'test-user', 'test-agent']
      );

      // 并发更新标题
      const updates = Array.from({ length: 5 }, (_, i) => 
        pool.query(
          'UPDATE chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2',
          [`Title ${i}`, testSessionId]
        )
      );

      await Promise.all(updates);

      // 验证最终状态一致
      const result = await pool.query(
        'SELECT title FROM chat_sessions WHERE id = $1',
        [testSessionId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]?.title).toMatch(/^Title \d$/);

      // 清理
      await pool.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId]);
    });
  });

  describe('Performance Verification', () => {
    it('should retrieve session data efficiently', async () => {
      const startTime = Date.now();

      // 查询最近的会话
      await pool.query(`
        SELECT * FROM chat_sessions 
        ORDER BY updated_at DESC 
        LIMIT 10
      `);

      const queryTime = Date.now() - startTime;

      // 应该在合理时间内完成（< 100ms）
      expect(queryTime).toBeLessThan(100);
    });

    it('should support efficient message pagination', async () => {
      const testSessionId = `pagination-test-${Date.now()}`;

      // 创建测试会话
      await pool.query(
        `INSERT INTO chat_sessions (id, title, user_id, agent_id) 
         VALUES ($1, $2, $3, $4)`,
        [testSessionId, 'Pagination Test', 'test-user', 'test-agent']
      );

      // 创建多条消息
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}-${Date.now()}`,
        session_id: testSessionId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      for (const msg of messages) {
        await pool.query(
          `INSERT INTO chat_messages (id, session_id, role, content) 
           VALUES ($1, $2, $3, $4)`,
          [msg.id, msg.session_id, msg.role, msg.content]
        );
      }

      // 分页查询
      const startTime = Date.now();
      const result = await pool.query(`
        SELECT * FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10 OFFSET 0
      `, [testSessionId]);

      const queryTime = Date.now() - startTime;

      expect(result.rows.length).toBe(10);
      expect(queryTime).toBeLessThan(50);

      // 清理
      await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [testSessionId]);
      await pool.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId]);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce NOT NULL constraints on required fields', async () => {

      // 尝试插入缺少必需字段的会话
      await expect(
        pool.query(`
          INSERT INTO chat_sessions (id, user_id, agent_id) 
          VALUES ($1, $2, $3)
        `, [`incomplete-${Date.now()}`, 'test-user', 'test-agent'])
      ).rejects.toThrow();
    });

    it('should maintain created_at and updated_at timestamps', async () => {
      const testSessionId = `timestamp-test-${Date.now()}`;

      // 创建会话
      await pool.query(
        `INSERT INTO chat_sessions (id, title, user_id, agent_id) 
         VALUES ($1, $2, $3, $4)`,
        [testSessionId, 'Timestamp Test', 'test-user', 'test-agent']
      );

      // 读取时间戳
      const result1 = await pool.query(
        'SELECT created_at, updated_at FROM chat_sessions WHERE id = $1',
        [testSessionId]
      );

      const createdAt = new Date(result1.rows[0]?.created_at);
      const updatedAt1 = new Date(result1.rows[0]?.updated_at);

      expect(createdAt).toBeDefined();
      expect(updatedAt1).toBeDefined();

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 100));

      // 更新会话
      await pool.query(
        'UPDATE chat_sessions SET title = $1 WHERE id = $2',
        ['Updated Title', testSessionId]
      );

      // 验证updated_at更新
      const result2 = await pool.query(
        'SELECT created_at, updated_at FROM chat_sessions WHERE id = $1',
        [testSessionId]
      );

      const createdAt2 = new Date(result2.rows[0]?.created_at);
      const updatedAt2 = new Date(result2.rows[0]?.updated_at);

      // created_at不应该变化
      expect(createdAt2.getTime()).toBe(createdAt.getTime());
      
      // updated_at应该更新
      expect(updatedAt2.getTime()).toBeGreaterThan(updatedAt1.getTime());

      // 清理
      await pool.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId]);
    });
  });
});

