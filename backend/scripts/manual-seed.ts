/**
 * 手动执行数据库种子脚本
 * 用于诊断自动种子为何失败
 */

import '../src/dotenv-loader'; // 加载环境变量
import { initDB, getPool } from '../src/utils/db';
import { logger } from '../src/utils/logger';
import { createErrorFromUnknown } from '../src/errors/errorUtils';

async function manualSeed() {
  try {
    console.log('\n========== 开始手动种子 ==========\n');
    
    // 1. 初始化数据库
    console.log('Step 1: 初始化数据库...');
    await initDB();
    console.log('✅ 数据库初始化完成\n');
    
    // 2. 查询智能体数量
    console.log('Step 2: 查询智能体数量...');
    const pool = getPool();
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM agent_configs');
    const count = rows[0]?.count || 0;
    console.log(`✅ 数据库中有 ${count} 个智能体\n`);
    
    // 3. 显示智能体列表
    if (count > 0) {
      console.log('Step 3: 显示智能体列表...');
      const { rows: agents } = await pool.query(
        'SELECT id, name, provider, endpoint FROM agent_configs ORDER BY created_at DESC'
      );
      console.table(agents);
    } else {
      console.log('⚠️  智能体列表为空！');
    }
    
    console.log('\n========== 种子完成 ==========\n');
    process.exit(0);
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'manualSeed',
      operation: 'manualSeed',
    });
    console.error('\n❌ 种子失败:', error.message);
    logger.error('手动种子失败', { error: error.toLogObject() });
    process.exit(1);
  }
}

manualSeed();