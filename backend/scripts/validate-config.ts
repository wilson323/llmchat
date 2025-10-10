#!/usr/bin/env node

/**
 * 环境变量配置验证脚本
 * 用于验证 .env 文件中的配置是否正确
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 加载环境变量
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error('❌ 错误: 未找到 .env 文件');
  console.log('请复制 .env.example 为 .env 并填写配置');
  process.exit(1);
}

// 必需的环境变量列表
const REQUIRED_ENV_VARS = [
  'PORT',
  'NODE_ENV',
  'FASTGPT_API_KEY_1',
  'FASTGPT_API_KEY_2',
  'FASTGPT_API_KEY_3',
  'JWT_SECRET'
];

// FastGPT 相关的环境变量
const FASTGPT_ENV_VARS = [
  'FASTGPT_AGENT_ID_1',
  'FASTGPT_APP_ID_1',
  'FASTGPT_AGENT_NAME_1',
  'FASTGPT_DESCRIPTION_1',
  'FASTGPT_ENDPOINT_1',
  'FASTGPT_API_KEY_1',
  'FASTGPT_MODEL_1',
  'FASTGPT_RATE_LIMIT_RPM_1',
  'FASTGPT_RATE_LIMIT_TPM_1'
];

/**
 * 验证环境变量是否存在
 */
function validateEnvVars(): void {
  console.log('🔍 验证环境变量配置...\n');

  const missing: string[] = [];
  const invalid: string[] = [];

  // 检查必需的环境变量
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    process.exit(1);
  }

  // 检查 FastGPT 配置
  console.log('📋 FastGPT 配置检查:');
  for (let i = 1; i <= 3; i++) {
    const agentId = process.env[`FASTGPT_AGENT_ID_${i}`];
    const appId = process.env[`FASTGPT_APP_ID_${i}`];
    const apiKey = process.env[`FASTGPT_API_KEY_${i}`];
    const endpoint = process.env[`FASTGPT_ENDPOINT_${i}`];

    console.log(`\n   智能体 ${i}:`);
    console.log(`   - Agent ID: ${agentId || '❌ 未设置'}`);
    console.log(`   - App ID: ${appId || '❌ 未设置'}`);
    console.log(`   - API Key: ${apiKey ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`   - Endpoint: ${endpoint || '❌ 未设置'}`);

    // 验证 FastGPT App ID 格式
    if (appId && !/^[a-fA-F0-9]{24}$/.test(appId)) {
      invalid.push(`FASTGPT_APP_ID_${i} (格式不正确，需要 24 位十六进制字符串)`);
    }

    // 验证 Endpoint URL 格式
    if (endpoint) {
      try {
        new URL(endpoint);
      } catch {
        invalid.push(`FASTGPT_ENDPOINT_${i} (无效的 URL 格式)`);
      }
    }

    // 验证 API Key 强度
    if (apiKey && apiKey.length < 32) {
      invalid.push(`FASTGPT_API_KEY_${i} (API 密钥长度应至少 32 字符)`);
    }
  }

  // 检查 JWT Secret
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    console.log(`\n🔐 JWT 配置:`);
    console.log(`   - JWT Secret: ${jwtSecret.length >= 32 ? '✅ 强度足够' : '❌ 长度不足 (至少 32 字符)'}`);
    console.log(`   - JWT Expires In: ${process.env.JWT_EXPIRES_IN || '7d (默认)'}`);
  }

  // 检查其他安全配置
  console.log(`\n🛡️ 安全配置:`);
  console.log(`   - Node Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`   - Log Level: ${process.env.LOG_LEVEL || 'info'}`);

  // 显示错误
  if (invalid.length > 0) {
    console.error('\n❌ 配置验证失败:');
    invalid.forEach(error => {
      console.error(`   - ${error}`);
    });
    process.exit(1);
  }

  console.log('\n✅ 环境变量配置验证通过！');
}

/**
 * 检查配置文件是否存在
 */
function checkConfigFiles(): void {
  console.log('📁 检查配置文件...\n');

  const configPath = path.resolve(__dirname, '../../config/agents.json');
  const envExamplePath = path.resolve(__dirname, '../.env.example');

  if (!fs.existsSync(configPath)) {
    console.error('❌ 未找到智能体配置文件: config/agents.json');
    process.exit(1);
  }

  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ 未找到环境变量示例文件: backend/.env.example');
    process.exit(1);
  }

  console.log('✅ 配置文件检查通过:');
  console.log(`   - 智能体配置: ${configPath}`);
  console.log(`   - 环境变量示例: ${envExamplePath}`);
}

/**
 * 检查文件权限
 */
function checkFilePermissions(): void {
  console.log('\n🔐 检查文件权限...\n');

  const envPath = path.resolve(__dirname, '../.env');
  const stats = fs.statSync(envPath);

  // 检查文件权限 (应该是 600，只有所有者可读写)
  const mode = stats.mode.toString(8);
  if (mode !== '100600') {
    console.warn('⚠️  建议设置 .env 文件权限为 600 (仅所有者可读写)');
    console.log(`   当前权限: ${mode}`);
    console.log(`   修复命令: chmod 600 ${envPath}`);
  } else {
    console.log('✅ .env 文件权限正确');
  }
}

/**
 * 主函数
 */
function main(): void {
  console.log('🔐 LLMChat 环境配置验证工具\n');
  console.log('====================================\n');

  try {
    checkConfigFiles();
    checkFilePermissions();
    validateEnvVars();

    console.log('\n🎉 所有检查通过！配置安全且正确。');
    console.log('\n💡 提示:');
    console.log('   - 定期更换 API 密钥');
    console.log('   - 使用强密码和安全的密钥');
    console.log('   - 不要将 .env 文件提交到版本控制');
    console.log('   - 定期检查安全配置');

  } catch (error) {
    console.error('\n❌ 验证过程中发生错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}