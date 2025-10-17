/**
 * 环境变量加载器
 * 必须在所有其他模块之前加载！
 * 
 * 在 package.json 的 dev 命令中使用 -r 参数预加载：
 * ts-node-dev -r ./src/dotenv-loader.ts ...
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from '@/utils/logger';

// 尝试多个可能的 .env 文件路径
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), 'src/.env'),
];

let loaded = false;
let loadedPath = '';

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      loaded = true;
      loadedPath = envPath;
      logger.debug('[DOTENV] ✓ 环境变量已加载:', envPath);
      break;
    }
  }
}

if (!loaded) {
  logger.error('[DOTENV] ✗ 无法加载环境变量！');
  logger.error('[DOTENV] 尝试的路径:');
  envCandidates.forEach(p => logger.error(`  - ${p} (${fs.existsSync(p) ? '存在' : '不存在'})`));
  logger.error('[DOTENV] 当前工作目录:', process.cwd());
  process.exit(1);
}

// 验证关键环境变量
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  logger.error('[DOTENV] ✗ 缺少必需的环境变量:', missingVars.join(', '));
  logger.error('[DOTENV] 已加载文件:', loadedPath);
  process.exit(1);
}

logger.debug('[DOTENV] ✓ 所有必需环境变量已就绪');
logger.debug('[DOTENV] ✓ DB_HOST =', process.env.DB_HOST);
logger.debug('[DOTENV] ✓ DB_PORT =', process.env.DB_PORT);

