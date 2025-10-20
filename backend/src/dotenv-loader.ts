/**
 * 环境变量加载器
 * 必须在所有其他模块之前加载！
 *
 * 统一从项目根目录加载 .env 文件
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 使用 console 代替 logger，因为此时 logger 模块可能还未初始化
const log = {
  debug: (...args: unknown[]) => console.log('\x1b[36m[DOTENV]\x1b[0m', ...args),
  error: (...args: unknown[]) => console.error('\x1b[31m[DOTENV]\x1b[0m', ...args),
};

// 查找项目根目录 - 向上查找包含pnpm-workspace配置的目录
function findProjectRoot(currentPath: string): string {
  let searchPath = currentPath;

  // 最多向上查找 8 级目录
  for (let i = 0; i < 8; i++) {
    const packageJsonPath = path.join(searchPath, 'package.json');
    const pnpmWorkspacePath = path.join(searchPath, 'pnpm-workspace.yaml');
    const gitPath = path.join(searchPath, '.git');
    const envPath = path.join(searchPath, '.env');

    if (fs.existsSync(pnpmWorkspacePath)) {
      // 找到pnpm-workspace配置，这是明确的项目根目录标识
      log.debug('找到pnpm-workspace配置:', searchPath);
      return searchPath;
    }

    if (fs.existsSync(packageJsonPath)) {
      // 检查是否是根目录的package.json（应该包含workspace配置）
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.workspaces) {
          // 找到包含workspaces配置的根目录package.json
          log.debug('找到项目根目录 (workspace):', searchPath);
          return searchPath;
        }
        // 这是子目录的package.json，继续向上查找
      } catch (e) {
        log.error('解析package.json失败:', searchPath);
      }
    }

    if (fs.existsSync(gitPath) || fs.existsSync(envPath)) {
      // git目录或.env文件也是项目标识
      log.debug('找到项目标识:', searchPath);
      return searchPath;
    }

    const parentPath = path.dirname(searchPath);
    if (parentPath === searchPath) {
      break; // 已到达文件系统根目录
    }
    searchPath = parentPath;
  }

  // 如果找不到项目根目录，使用当前工作目录
  log.error('警告：未找到项目根目录标识，使用当前目录');
  return currentPath;
}

// 确定项目根目录并构建 .env 文件路径
const projectRoot = findProjectRoot(process.cwd());
const envPath = path.join(projectRoot, '.env');

log.debug('检测项目根目录:', projectRoot);
log.debug('尝试加载环境文件:', envPath);

// 加载环境变量
const result = dotenv.config({ path: envPath });

if (result.error) {
  log.error('✗ 无法加载环境变量文件:', envPath);
  log.error('错误信息:', result.error.message);
  log.error('当前工作目录:', process.cwd());

  // 检查文件是否存在
  if (fs.existsSync(envPath)) {
    log.error('✓ 文件存在但解析失败，请检查文件格式');
  } else {
    log.error('✗ 环境变量文件不存在');
    log.error('请在项目根目录创建 .env 文件');
  }

  process.exit(1);
}

log.debug('✓ 环境变量已加载:', envPath);

// 验证关键环境变量
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  log.error('✗ 缺少必需的环境变量:', missingVars.join(', '));
  log.error('已加载文件:', envPath);
  process.exit(1);
}

log.debug('✓ 所有必需环境变量已就绪');
log.debug('✓ DB_HOST =', process.env.DB_HOST);
log.debug('✓ DB_PORT =', process.env.DB_PORT);
log.debug('✓ DB_USER =', process.env.DB_USER);
log.debug('✓ DB_NAME =', process.env.DB_NAME);
log.debug('✓ DB_PASSWORD =', process.env.DB_PASSWORD ? '***' : '(empty)');