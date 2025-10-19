#!/usr/bin/env node

/**
 * LLMChat 代码生成器
 * 自动生成组件、页面、服务等代码模板
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 模板定义
const templates = {
  // React组件模板
  component: {
    name: 'React 组件',
    description: '生成React函数组件模板',
    files: {
      'component.tsx': (name, options) => `import React from 'react';
${options.withProps ? `import { ${name}Props } from './types';` : ''}
${options.withStyles ? `import styles from './${name.toLowerCase()}.module.css';` : ''}
${options.withHook ? `import { use${name} } from './hooks/use${name}';` : ''}

${options.exportType === 'default' ? `const ${name}: React.FC${options.withProps ? `<${name}Props>` : ''} = (${options.withProps ? 'props' : ''}) => {
  ${options.withHook ? `const { /* hook state */ } = use${name}(${options.withProps ? 'props' : ''});` : ''}

  return (
    <div className="${options.withStyles ? styles.container : ''}">
      <h2>${name} Component</h2>
      ${options.withProps ? '<p>Props: {JSON.stringify(props)}</p>' : ''}
      {/* 在这里添加组件内容 */}
    </div>
  );
};

export default ${name};` : `export const ${name}: React.FC${options.withProps ? `<${name}Props>` : ''} = (${options.withProps ? 'props' : ''}) => {
  ${options.withHook ? `const { /* hook state */ } = use${name}(${options.withProps ? 'props' : ''});` : ''}

  return (
    <div className="${options.withStyles ? styles.container : ''}">
      <h2>${name} Component</h2>
      ${options.withProps ? '<p>Props: {JSON.stringify(props)}</p>' : ''}
      {/* 在这里添加组件内容 */}
    </div>
  );
};`},
      ...(options.withTypes && { 'types.ts': (name) => `export interface ${name}Props {
  // 在这里定义组件属性类型
  className?: string;
  children?: React.ReactNode;
  // 添加更多属性...
}

export interface ${name}State {
  // 在这里定义组件状态类型
  // 添加状态属性...
}`}),
      ...(options.withHook && { `hooks/use${name}.ts`: (name) => `import { useState, useEffect } from 'react';
import { ${name}Props } from '../types';

export function use${name}(props: ${name}Props = {}) {
  const [state, setState] = useState({
    // 初始化状态
  });

  useEffect(() => {
    // 副作用逻辑
    return () => {
      // 清理逻辑
    };
  }, []);

  return {
    state,
    setState,
    // 添加更多方法和状态
  };
}`}),
      ...(options.withStyles && { [`${name.toLowerCase()}.module.css`]: () => `.container {
  /* 组件样式 */
}

.title {
  /* 标题样式 */
}`}),
      ...(options.withTest && { `${name}.test.tsx`: (name) => `import { render, screen } from '@testing-library/react';
import { ${name} } from './${name}';

describe('${name}', () => {
  it('renders correctly', () => {
    render(<${name} />);
    expect(screen.getByText('${name} Component')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<${name} className="custom-class" />);
    const container = screen.getByText('${name} Component').parentElement;
    expect(container).toHaveClass('custom-class');
  });
});`})
    }
  },

  // 页面模板
  page: {
    name: 'React 页面',
    description: '生成React页面模板',
    files: {
      'page.tsx': (name, options) => `import React from 'react';
${options.withHook ? `import { use${name}Page } from './hooks/use${name}Page';` : ''}
${options.withLayout ? `import { MainLayout } from '@/components/layout/MainLayout';` : ''}

${options.exportType === 'default' ? `const ${name}Page: React.FC = () => {
  ${options.withHook ? `const { /* hook state */ } = use${name}Page();` : ''}

  return (
    ${options.withLayout ? '<MainLayout>' : ''}
      <div className="page-container">
        <h1>${name} Page</h1>
        <p>这是 ${name} 页面内容</p>
        {/* 在这里添加页面内容 */}
      </div>
    ${options.withLayout ? '</MainLayout>' : ''}
  );
};

export default ${name}Page;` : `export const ${name}Page: React.FC = () => {
  ${options.withHook ? `const { /* hook state */ } = use${name}Page();` : ''}

  return (
    ${options.withLayout ? '<MainLayout>' : ''}
      <div className="page-container">
        <h1>${name} Page</h1>
        <p>这是 ${name} 页面内容</p>
        {/* 在这里添加页面内容 */}
      </div>
    ${options.withLayout ? '</MainLayout>' : ''}
  );
};`},
      ...(options.withHook && { 'hooks/usePageName.ts': (name) => `import { useState, useEffect } from 'react';

export function use${name}Page() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 页面初始化逻辑
    const initPage = async () => {
      setLoading(true);
      try {
        // 初始化数据获取
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, []);

  return {
    loading,
    error,
    // 添加更多方法和状态
  };
}`})
    }
  },

  // Hook模板
  hook: {
    name: 'React Hook',
    description: '生成自定义Hook模板',
    files: {
      'hook.ts': (name, options) => `import { useState, useEffect, useCallback } from 'react';

export function use${name}(${options.withParams ? 'params: any' : ''}) {
  const [state, setState] = useState(${options.initialState || '{}'});

  const ${options.actionName || 'handleAction'} = useCallback((${options.actionParams || 'data'}) => {
    // Hook 逻辑
    setState(prev => ({
      ...prev,
      // 更新状态
    }));
  }, []);

  useEffect(() => {
    // 副作用
    return () => {
      // 清理
    };
  }, [${options.dependencies || ''}]);

  return {
    state,
    setState,
    ${options.actionName || 'handleAction'},
    // 添加更多返回值
  };
}`},
      ...(options.withTest && { 'hook.test.ts': (name) => `import { renderHook, act } from '@testing-library/react';
import { use${name} } from './use${name}';

describe('use${name}', () => {
  it('initializes correctly', () => {
    const { result } = renderHook(() => use${name}());

    expect(result.current.state).toBeDefined();
  });

  it('handles actions correctly', () => {
    const { result } = renderHook(() => use${name}());

    act(() => {
      result.current.handleAction('test data');
    });

    // 断言状态变化
  });
});`})
    }
  },

  // 服务模板
  service: {
    name: 'API 服务',
    description: '生成API服务模板',
    files: {
      'service.ts': (name, options) => `import { api } from '@/lib/api';
import { ${name}Request, ${name}Response } from './types';

export class ${name}Service {
  ${options.withCache ? 'private cache = new Map();' : ''}

  async ${options.methodName || 'get'}${name}(id: string): Promise<${name}Response> {
    ${options.withCache ? `const cacheKey = \`${name}:\${id}\`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }` : ''}

    try {
      const response = await api.get(\`/${options.endpoint || name.toLowerCase()}/\${id}\`);
      const data = response.data;

      ${options.withCache ? 'this.cache.set(cacheKey, data);' : ''}

      return data;
    } catch (error) {
      throw new Error(\`Failed to fetch ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async create${name}(data: ${name}Request): Promise<${name}Response> {
    try {
      const response = await api.post(\`/${options.endpoint || name.toLowerCase()}\`, data);
      return response.data;
    } catch (error) {
      throw new Error(\`Failed to create ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async update${name}(id: string, data: Partial<${name}Request>): Promise<${name}Response> {
    try {
      const response = await api.put(\`/${options.endpoint || name.toLowerCase()}/\${id}\`, data);
      return response.data;
    } catch (error) {
      throw new Error(\`Failed to update ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async delete${name}(id: string): Promise<void> {
    try {
      await api.delete(\`/${options.endpoint || name.toLowerCase()}/\${id}\`);
      ${options.withCache ? `this.cache.delete(\`${name}:\${id}\`);` : ''}
    } catch (error) {
      throw new Error(\`Failed to delete ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }
}

export const ${name.toLowerCase()}Service = new ${name}Service();`},
      'types.ts': (name) => `export interface ${name}Request {
  // 请求数据类型
  name: string;
  description?: string;
  // 添加更多字段...
}

export interface ${name}Response {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // 添加更多字段...
}

export interface ${name}Filter {
  // 过滤条件类型
  search?: string;
  page?: number;
  limit?: number;
}`
    }
  },

  // 工具函数模板
  utility: {
    name: '工具函数',
    description: '生成工具函数模板',
    files: {
      'utility.ts': (name, options) => `${options.withTypes ? `import { ${name}Options, ${name}Result } from './types';` : ''}

export function ${name.toLowerCase()}(${options.withParams ? 'params: any' : ''})${options.withTypes ? ': ${name}Result' : ''} {
  ${options.options?.map(opt => `const { ${opt} } = ${options.withParams ? 'params' : '{}'};`).join('\n  ') || ''}

  try {
    // 主要逻辑
    ${options.returnValue || 'return result;'}
  } catch (error) {
    throw new Error(\`${name} failed: \${error instanceof Error ? error.message : 'Unknown error'}\`);
  }
}

${options.withHelpers ? `// 辅助函数
function ${name.toLowerCase()}Helper(input: any): any {
  // 辅助逻辑
  return processedInput;
}` : ''}

${options.withConstants ? `// 常量定义
export const ${name.toUpperCase()}_CONSTANTS = {
  MAX_LENGTH: 100,
  DEFAULT_VALUE: 'default',
  // 添加更多常量...
};` : ''}`},
      ...(options.withTypes && { 'types.ts': (name) => `export interface ${name}Options {
  // 选项类型
  ${options.options?.map(opt => `${opt}?: string;`).join('\n  ') || 'option?: string;'}
}

export interface ${name}Result {
  // 结果类型
  success: boolean;
  data?: any;
  error?: string;
}

export interface ${name}HelperParams {
  // 辅助函数参数类型
  input: any;
  options?: ${name}Options;
}`})
    }
  }
};

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: '',
    name: '',
    output: '',
    interactive: false,
    ...Object.fromEntries(
      args
        .filter(arg => arg.startsWith('--'))
        .map(arg => arg.slice(2).split('='))
        .map(([key, value]) => [key, value !== undefined ? value : true])
    )
  };

  // 获取非选项参数
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  if (positionalArgs.length >= 2) {
    options.type = positionalArgs[0];
    options.name = positionalArgs[1];
  }

  return options;
}

// 交互式输入
async function interactiveInput() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    log('🚀 LLMChat 代码生成器 - 交互模式', 'bright');
    log('================================', 'blue');

    // 显示可用模板
    log('\n可用的代码模板:', 'cyan');
    Object.entries(templates).forEach(([key, template]) => {
      log(`  ${key}: ${template.name} - ${template.description}`, 'blue');
    });

    const type = await question('\n请选择模板类型: ');
    const name = await question('请输入名称 (PascalCase): ');
    const output = await question('请输入输出目录 (可选): ') || '';

    // 模板选项
    const template = templates[type];
    if (!template) {
      logError(`未知模板类型: ${type}`);
      return null;
    }

    const options = { type, name, output, interactive: true };

    // 根据模板类型询问特定选项
    if (type === 'component') {
      options.withProps = await question('包含 Props 接口? (y/N): ') === 'y';
      options.withStyles = await question('包含 CSS 模块? (y/N): ') === 'y';
      options.withHook = await question('包含自定义 Hook? (y/N): ') === 'y';
      options.withTest = await question('包含测试文件? (y/N): ') === 'y';
      options.withTypes = await question('包含类型定义? (y/N): ') === 'y';
      options.exportType = await question('导出类型 (default/named) [default]: ') || 'default';
    } else if (type === 'page') {
      options.withHook = await question('包含页面 Hook? (y/N): ') === 'y';
      options.withLayout = await question('包含布局组件? (y/N): ') === 'y';
    } else if (type === 'service') {
      options.withCache = await question('包含缓存功能? (y/N): ') === 'y';
      options.methodName = await question('主要方法名称 [get]: ') || 'get';
      options.endpoint = await question('API 端点 (可选): ') || '';
    }

    rl.close();
    return options;
  } catch (error) {
    rl.close();
    throw error;
  }
}

// 生成代码
function generateCode(options) {
  const { type, name, output, interactive, ...templateOptions } = options;
  const template = templates[type];

  if (!template) {
    throw new Error(`未知模板类型: ${type}`);
  }

  // 确定输出目录
  const outputDir = output || getDefaultOutputDir(type);
  const fullPath = join(projectRoot, outputDir, name);

  // 创建目录
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }

  // 生成文件
  const generatedFiles = [];
  for (const [filename, templateFunc] of Object.entries(template.files)) {
    const content = templateFunc(name, templateOptions);
    const filePath = join(fullPath, filename);

    // 创建子目录（如果需要）
    const fileDir = dirname(filePath);
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }

    writeFileSync(filePath, content);
    generatedFiles.push(filePath);
    logSuccess(`生成文件: ${filePath}`);
  }

  return generatedFiles;
}

// 获取默认输出目录
function getDefaultOutputDir(type) {
  const dirs = {
    component: 'frontend/src/components',
    page: 'frontend/src/pages',
    hook: 'frontend/src/hooks',
    service: 'frontend/src/services',
    utility: 'frontend/src/utils'
  };
  return dirs[type] || 'frontend/src/generated';
}

// 显示使用说明
function showUsage() {
  log('🚀 LLMChat 代码生成器', 'bright');
  log('==========================', 'blue');
  log('\n用法:', 'cyan');
  log('  node code-generator.js <type> <name> [options]', 'white');
  log('  node code-generator.js --interactive', 'white');
  log('\n模板类型:', 'cyan');

  Object.entries(templates).forEach(([key, template]) => {
    log(`  ${key}: ${template.name}`, 'blue');
    log(`    ${template.description}`, 'white');
  });

  log('\n选项:', 'cyan');
  log('  --output <dir>     输出目录', 'white');
  log('  --interactive      交互模式', 'white');
  log('  --component.*     组件选项', 'white');
  log('  --page.*          页面选项', 'white');
  log('  --service.*       服务选项', 'white');
  log('\n示例:', 'cyan');
  log('  node code-generator.js component UserProfile', 'white');
  log('  node code-generator.js component Button --withProps --withStyles', 'white');
  log('  node code-generator.js service UserService --withCache', 'white');
  log('  node code-generator.js --interactive', 'white');
}

// 主函数
async function main() {
  try {
    let options;

    if (process.argv.includes('--interactive')) {
      options = await interactiveInput();
      if (!options) {
        process.exit(1);
      }
    } else {
      options = parseArgs();

      if (!options.type || !options.name) {
        showUsage();
        process.exit(1);
      }
    }

    log(`\n🔨 正在生成 ${options.name} ${options.type}...`, 'cyan');

    const generatedFiles = generateCode(options);

    log('\n🎉 代码生成完成!', 'green');
    logInfo(`生成了 ${generatedFiles.length} 个文件:`);
    generatedFiles.forEach(file => {
      log(`  • ${file}`, 'blue');
    });

    // 提供后续建议
    log('\n💡 后续建议:', 'cyan');
    log(`1. 检查生成的代码并修改为你的需求`, 'white');
    log(`2. 运行类型检查: pnpm run type-check`, 'white');
    log(`3. 添加测试: pnpm test`, 'white');
    log(`4. 提交代码: git add . && git commit -m "feat: add ${options.name}"`, 'white');

  } catch (error) {
    logError(`生成失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as generateCode, templates };