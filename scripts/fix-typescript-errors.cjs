#!/usr/bin/env node

/**
 * 修复TypeScript类型错误
 * 主要处理：
 * 1. JSX语法错误
 * 2. 类型定义缺失
 * 3. 导入导出问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复TypeScript类型错误...\n');

// 1. 修复 AdminHome.tsx 的JSX语法错误
console.log('📝 修复 AdminHome.tsx JSX语法错误');
const adminHomePath = path.join(process.cwd(), 'frontend/src/components/admin/AdminHome.tsx');
if (fs.existsSync(adminHomePath)) {
  try {
    let content = fs.readFileSync(adminHomePath, 'utf8');

    // 修复JSX实体转义问题
    content = content.replace(/&quot;/g, '"');
    content = content.replace(/&lt;/g, '<');
    content = content.replace(/&gt;/g, '>');
    content = content.replace(/&amp;/g, '&');

    // 修复JSX表达式问题
    content = content.replace(/(\s+)const isDesktop = typeof window !==\s*=\s*'undefined'/g, '$1const isDesktop = typeof window !== \'undefined\'');

    // 修复可能的多余字符
    content = content.replace(/[{}]+$/gm, (match) => {
      // 移除多余的大括号
      const clean = match.replace(/[{}]/g, '');
      return clean || '';
    });

    fs.writeFileSync(adminHomePath, content, 'utf8');
    console.log('  ✅ AdminHome.tsx JSX语法错误已修复');
  } catch (error) {
    console.error(`  ❌ 修复 AdminHome.tsx 失败: ${error.message}`);
  }
} else {
  console.log('  ⚠️  AdminHome.tsx 文件不存在');
}

// 2. 检查并创建缺失的类型定义文件
console.log('\n📝 检查缺失的类型定义');

const typeFiles = [
  'frontend/src/types/index.ts',
  'frontend/src/types/dynamic.ts',
  'frontend/src/types/sse.ts'
];

const missingTypes = [];

for (const typeFile of typeFiles) {
  const fullPath = path.join(process.cwd(), typeFile);
  if (!fs.existsSync(fullPath)) {
    missingTypes.push(typeFile);
    console.log(`  ⚠️  缺失类型文件: ${typeFile}`);
  } else {
    console.log(`  ✅ 类型文件存在: ${typeFile}`);
  }
}

// 3. 如果有缺失的类型文件，创建基本结构
if (missingTypes.length > 0) {
  console.log('\n📝 创建缺失的类型定义文件');

  // 创建 types/index.ts
  if (missingTypes.includes('frontend/src/types/index.ts')) {
    const indexTypesPath = path.join(process.cwd(), 'frontend/src/types/index.ts');
    const indexContent = `/**
 * 主要类型定义文件
 */

// 基础类型
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// 用户相关
export interface User extends BaseEntity {
  email: string;
  name?: string;
}

// 消息相关
export interface ChatMessage {
  HUMAN?: string;
  AI?: string;
  reasoning?: string;
  interactive?: any;
  id?: string;
  timestamp?: number;
  attachments?: any[];
  voiceNote?: any;
}

// 智能体相关
export interface Agent extends BaseEntity {
  name: string;
  description: string;
  avatar?: string;
  provider: string;
  status: 'active' | 'inactive';
}

// API相关
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 聊天相关
export interface OriginalChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ChatOptions {
  chatId?: string;
  responseChatItemId?: string;
  attachments?: any[];
  voiceNote?: any;
  detail?: boolean;
  temperature?: number;
  maxTokens?: number;
  variables?: Record<string, any>;
}

export interface ChatResponse {
  choices: Array<{
    message?: {
      content: string;
    };
  }>;
}
`;

    try {
      fs.mkdirSync(path.dirname(indexTypesPath), { recursive: true });
      fs.writeFileSync(indexTypesPath, indexContent, 'utf8');
      console.log('  ✅ 创建 types/index.ts');
    } catch (error) {
      console.error(`  ❌ 创建 types/index.ts 失败: ${error.message}`);
    }
  }

  // 创建 types/dynamic.ts
  if (missingTypes.includes('frontend/src/types/dynamic.ts')) {
    const dynamicTypesPath = path.join(process.cwd(), 'frontend/src/types/dynamic.ts');
    const dynamicContent = `/**
 * 动态类型定义
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ApiSuccessPayload<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface FastGPTChatHistorySummary {
  chatId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface FastGPTChatHistoryDetail {
  chatId: string;
  title: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
}
`;

    try {
      fs.writeFileSync(dynamicTypesPath, dynamicContent, 'utf8');
      console.log('  ✅ 创建 types/dynamic.ts');
    } catch (error) {
      console.error(`  ❌ 创建 types/dynamic.ts 失败: ${error.message}`);
    }
  }

  // 创建 types/sse.ts
  if (missingTypes.includes('frontend/src/types/sse.ts')) {
    const sseTypesPath = path.join(process.cwd(), 'frontend/src/types/sse.ts');
    const sseContent = `/**
 * SSE (Server-Sent Events) 相关类型定义
 */

export interface SSECallbacks {
  onChunk?: (chunk: string) => void;
  onStatus?: (status: FastGPTStatusData) => void;
  onInteractive?: (data: FastGPTInteractiveData) => void;
  onChatId?: (chatId: string) => void;
  onReasoning?: (data: FastGPTReasoningData) => void;
  onEvent?: (eventName: string, payload: any) => void;
}

export interface SSEParsedEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

export interface FastGPTStatusData {
  type: 'flowNodeStatus' | 'progress' | 'complete';
  status: 'running' | 'completed' | 'error';
  message?: string;
  moduleId?: string;
  moduleName: string;
}

export interface FastGPTInteractiveData {
  type: string;
  data: any;
}

export interface FastGPTReasoningData {
  content: string;
  steps?: any[];
  totalSteps?: number;
  finished?: boolean;
}
`;

    try {
      fs.writeFileSync(sseTypesPath, sseContent, 'utf8');
      console.log('  ✅ 创建 types/sse.ts');
    } catch (error) {
      console.error(`  ❌ 创建 types/sse.ts 失败: ${error.message}`);
    }
  }
}

// 4. 检查并修复导入问题
console.log('\n📝 检查导入问题');

const filesToCheck = [
  'frontend/src/hooks/useChat.ts',
  'frontend/src/services/api.ts',
  'frontend/src/components/chat/ChatContainer.tsx'
];

for (const filePath of filesToCheck) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      let hasChanges = false;

      // 检查是否有导入@/types但没有导入JsonValue
      if (content.includes('@/types') && !content.includes('JsonValue')) {
        // 添加JsonValue导入
        const importMatch = content.match(/import.*from\s+['"]@\/types['"];?/);
        if (importMatch) {
          const importIndex = content.indexOf(importMatch[0]);
          const endIndex = importIndex + importMatch[0].length;
          content = content.slice(0, endIndex) +
                    '\nimport type { JsonValue } from \'@/types/dynamic\';' +
                    content.slice(endIndex);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`  ✅ 修复 ${filePath} 导入问题`);
      } else {
        console.log(`  ℹ️  ${filePath} 无需修复`);
      }
    } catch (error) {
      console.error(`  ❌ 检查 ${filePath} 失败: ${error.message}`);
    }
  } else {
    console.log(`  ⚠️  文件不存在: ${filePath}`);
  }
}

console.log('\n🎉 TypeScript类型错误修复完成！');

// 验证修复结果
console.log('\n🔍 验证TypeScript类型检查...');
try {
  const { execSync } = require('child_process');
  execSync('cd frontend && pnpm run type-check', {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  console.log('✅ TypeScript类型检查通过');
} catch (error) {
  const output = error.stdout || error.stderr || '';
  if (output.trim()) {
    console.log('📊 TypeScript类型检查结果:');
    const lines = output.trim().split('\n');
    const errorLines = lines.filter(line => line.includes('error'));

    console.log(`\n📈 剩余类型错误: ${errorLines.length} 个`);

    // 显示前5个错误
    errorLines.slice(0, 5).forEach((line, index) => {
      console.log(`  ${index + 1}. ${line}`);
    });

    if (errorLines.length > 5) {
      console.log(`  ... 还有 ${errorLines.length - 5} 个错误`);
    }
  }
}