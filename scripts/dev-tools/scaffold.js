#!/usr/bin/env node

/**
 * LLMChat 项目脚手架工具
 * 快速创建新功能模块、路由、状态管理等
 */

import { execSync } from 'child_process';
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

// 功能模块脚手架
const scaffolds = {
  feature: {
    name: '功能模块',
    description: '创建完整的功能模块（组件、路由、状态、服务等）',
    template: (name, options) => ({
      dirs: [
        `frontend/src/features/${name.toLowerCase()}`,
        `frontend/src/features/${name.toLowerCase()}/components`,
        `frontend/src/features/${name.toLowerCase()}/pages`,
        `frontend/src/features/${name.toLowerCase()}/hooks`,
        `frontend/src/features/${name.toLowerCase()}/services`,
        `frontend/src/features/${name.toLowerCase()}/types`,
        `frontend/src/features/${name.toLowerCase()}/utils`
      ],
      files: {
        // 类型定义
        'types/index.ts': `export interface ${name}State {
  loading: boolean;
  error: string | null;
  data: any[];
}

export interface ${name}Item {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ${name}FormData {
  name: string;
  description?: string;
}`,

        // 状态管理 (Zustand)
        'store/index.ts': `import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ${name}State, ${name}Item } from '../types';

interface ${name}Store extends ${name}State {
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setData: (data: ${name}Item[]) => void;
  addItem: (item: ${name}Item) => void;
  updateItem: (id: string, item: Partial<${name}Item>) => void;
  removeItem: (id: string) => void;
  clearData: () => void;
}

export const use${name}Store = create<${name}Store>()(
  devtools(
    (set, get) => ({
      // Initial state
      loading: false,
      error: null,
      data: [],

      // Actions
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setData: (data) => set({ data }),

      addItem: (item) => set((state) => ({
        data: [...state.data, item]
      })),

      updateItem: (id, item) => set((state) => ({
        data: state.data.map(existing =>
          existing.id === id ? { ...existing, ...item } : existing
        )
      })),

      removeItem: (id) => set((state) => ({
        data: state.data.filter(item => item.id !== id)
      })),

      clearData: () => set({ data: [] })
    }),
    { name: '${name.toLowerCase()}-store' }
  )
);`,

        // API 服务
        'services/api.ts': `import { api } from '@/lib/api';
import { ${name}Item, ${name}FormData } from '../types';

class ${name}ApiService {
  async get${name}List(): Promise<${name}Item[]> {
    try {
      const response = await api.get('/${name.toLowerCase()}');
      return response.data;
    } catch (error) {
      throw new Error(\`Failed to fetch ${name} list: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async get${name}ById(id: string): Promise<${name}Item> {
    try {
      const response = await api.get(\`/${name.toLowerCase()}/\${id}\`);
      return response.data;
    } catch (error) {
      throw new Error(\`Failed to fetch ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async create${name}(data: ${name}FormData): Promise<${name}Item> {
    try {
      const response = await api.post('/${name.toLowerCase()}', data);
      return response.data;
    } catch (error) {
      throw new Error(\`Failed to create ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async update${name}(id: string, data: Partial<${name}FormData>): Promise<${name}Item> {
    try {
      const response = await api.put(\`/${name.toLowerCase()}/\${id}\`, data);
      return response.data;
    } catch (error) {
      throw new Error(\`Failed to update ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }

  async delete${name}(id: string): Promise<void> {
    try {
      await api.delete(\`/${name.toLowerCase()}/\${id}\`);
    } catch (error) {
      throw new Error(\`Failed to delete ${name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }
}

export const ${name.toLowerCase()}ApiService = new ${name}ApiService();`,

        // Hook
        'hooks/use${name}.ts': `import { useCallback } from 'react';
import { use${name}Store } from '../store';
import { ${name.toLowerCase()}ApiService } from '../services/api';
import { ${name}FormData } from '../types';

export function use${name}() {
  const {
    loading,
    error,
    data,
    setLoading,
    setError,
    setData,
    addItem,
    updateItem,
    removeItem
  } = use${name}Store();

  const fetch${name}List = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ${name.toLowerCase()}ApiService.get${name}List();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setData]);

  const create${name} = useCallback(async (formData: ${name}FormData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ${name.toLowerCase()}ApiService.create${name}(formData);
      addItem(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, addItem]);

  const update${name} = useCallback(async (id: string, formData: Partial<${name}FormData>) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ${name.toLowerCase()}ApiService.update${name}(id, formData);
      updateItem(id, result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, updateItem]);

  const delete${name} = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      await ${name.toLowerCase()}ApiService.delete${name}(id);
      removeItem(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, removeItem]);

  return {
    // State
    loading,
    error,
    data,

    // Actions
    fetch${name}List,
    create${name},
    update${name},
    delete${name}
  };
}`,

        // 页面组件
        'pages/${name}Page.tsx': `import React, { useEffect } from 'react';
import { use${name} } from '../hooks/use${name}';
import { ${name}List } from '../components/${name}List';
import { ${name}Form } from '../components/${name}Form';

export const ${name}Page: React.FC = () => {
  const {
    loading,
    error,
    data,
    fetch${name}List,
    create${name},
    update${name},
    delete${name}
  } = use${name}();

  useEffect(() => {
    fetch${name}List();
  }, [fetch${name}List]);

  const handleCreate = async (formData: any) => {
    try {
      await create${name}(formData);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleUpdate = async (id: string, formData: any) => {
    try {
      await update${name}(id, formData);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await delete${name}(id);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  if (loading && data.length === 0) {
    return <div>加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">${name} 管理</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          错误: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <${name}Form onSubmit={handleCreate} />
        </div>
        <div>
          <${name}List
            items={data}
            onEdit={handleUpdate}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};`,

        // 列表组件
        'components/${name}List.tsx': `import React from 'react';
import { ${name}Item } from '../types';

interface ${name}ListProps {
  items: ${name}Item[];
  onEdit: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export const ${name}List: React.FC<${name}ListProps> = ({
  items,
  onEdit,
  onDelete,
  loading = false
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">${name} 列表</h2>

      {loading ? (
        <div className="text-center py-4">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          暂无数据
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 border rounded"
            >
              <div>
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-sm text-gray-500">
                  创建时间: {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => onEdit(item.id, item)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  编辑
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};`,

        // 表单组件
        'components/${name}Form.tsx': `import React, { useState } from 'react';
import { ${name}FormData } from '../types';

interface ${name}FormProps {
  onSubmit: (data: ${name}FormData) => void;
  initialData?: Partial<${name}FormData>;
}

export const ${name}Form: React.FC<${name}FormProps> = ({
  onSubmit,
  initialData
}) => {
  const [formData, setFormData] = useState<${name}FormData>({
    name: initialData?.name || '',
    description: initialData?.description || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">
        {initialData ? '编辑' : '创建'} ${name}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            名称
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            描述
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {initialData ? '更新' : '创建'}
        </button>
      </form>
    </div>
  );
};`,

        // 工具函数
        'utils/index.ts': `import { ${name}Item } from '../types';

export const ${name.toLowerCase()}Utils = {
  // 格式化日期
  formatDate: (date: string): string => {
    return new Date(date).toLocaleDateString();
  },

  // 验证表单数据
  validateFormData: (data: any): string | null => {
    if (!data.name?.trim()) {
      return '名称不能为空';
    }
    return null;
  },

  // 排序
  sortByName: (items: ${name}Item[]): ${name}Item[] => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  },

  // 搜索
  search: (items: ${name}Item[], query: string): ${name}Item[] => {
    if (!query.trim()) return items;

    const lowerQuery = query.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery)
    );
  }
};`,

        // 索引文件
        'index.ts': `// ${name} 模块导出
export * from './types';
export * from './store';
export * from './services/api';
export * from './hooks/use${name}';
export * from './pages/${name}Page';
export * from './components/${name}List';
export * from './components/${name}Form';
export * from './utils';
`
      }
    })
  }
};

// 更新路由配置
function updateRouter(name) {
  const routerPath = join(projectRoot, 'frontend/src/router/index.tsx');

  if (!existsSync(routerPath)) {
    logWarning('路由文件不存在，跳过路由更新');
    return;
  }

  try {
    const routerContent = readFileSync(routerPath, 'utf8');

    // 检查是否已经包含该路由
    if (routerContent.includes(`/${name.toLowerCase()}`)) {
      logWarning('路由已存在，跳过路由更新');
      return;
    }

    // 添加新的路由导入
    const importRegex = /(import.*from.*\n)/;
    const newImport = `import { ${name}Page } from '@/features/${name.toLowerCase()}/pages/${name}Page';\n`;
    const updatedContent = routerContent.replace(importRegex, `$1${newImport}`);

    // 添加路由配置
    const routesRegex = /(const routes = \[)/;
    const newRoute = `  {
    path: '/${name.toLowerCase()}',
    element: <${name}Page />,
  },`;
    const finalContent = updatedContent.replace(routesRegex, `$1\n${newRoute}`);

    writeFileSync(routerPath, finalContent);
    logSuccess('路由配置已更新');
  } catch (error) {
    logWarning(`路由更新失败: ${error.message}`);
  }
}

// 更新侧边栏导航
function updateSidebar(name) {
  const sidebarPath = join(projectRoot, 'frontend/src/components/Sidebar.tsx');

  if (!existsSync(sidebarPath)) {
    logWarning('侧边栏文件不存在，跳过侧边栏更新');
    return;
  }

  try {
    const sidebarContent = readFileSync(sidebarPath, 'utf8');

    // 检查是否已经包含该导航项
    if (sidebarContent.includes(`${name}管理`)) {
      logWarning('侧边栏导航已存在，跳过更新');
      return;
    }

    // 添加新的导航项
    const navItemsRegex = /(const navItems = \[)/;
    const newNavItem = `  {
    title: '${name}管理',
    path: '/${name.toLowerCase()}',
    icon: 'Settings', // 根据功能选择合适的图标
  },`;
    const updatedContent = sidebarContent.replace(navItemsRegex, `$1\n${newNavItem}`);

    writeFileSync(sidebarPath, updatedContent);
    logSuccess('侧边栏导航已更新');
  } catch (error) {
    logWarning(`侧边栏更新失败: ${error.message}`);
  }
}

// 创建脚手架
function createScaffold(type, name, options) {
  const scaffold = scaffolds[type];
  if (!scaffold) {
    throw new Error(`未知脚手架类型: ${type}`);
  }

  const { dirs, files } = scaffold.template(name, options);

  // 创建目录
  dirs.forEach(dir => {
    const fullPath = join(projectRoot, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      logSuccess(`创建目录: ${dir}`);
    }
  });

  // 创建文件
  Object.entries(files).forEach(([relativePath, content]) => {
    const fullPath = join(projectRoot, 'features', name.toLowerCase(), relativePath);
    const fileDir = dirname(fullPath);

    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }

    writeFileSync(fullPath, content);
    logSuccess(`创建文件: ${relativePath}`);
  });

  // 自动更新路由和导航
  if (options.autoUpdate !== false) {
    updateRouter(name);
    updateSidebar(name);
  }
}

// 显示使用说明
function showUsage() {
  log('🏗️  LLMChat 项目脚手架工具', 'bright');
  log('==============================', 'blue');
  log('\n用法:', 'cyan');
  log('  node scaffold.js <type> <name> [options]', 'white');
  log('\n脚手架类型:', 'cyan');

  Object.entries(scaffolds).forEach(([key, scaffold]) => {
    log(`  ${key}: ${scaffold.name}`, 'blue');
    log(`    ${scaffold.description}`, 'white');
  });

  log('\n选项:', 'cyan');
  log('  --no-auto-update   不自动更新路由和导航', 'white');
  log('\n示例:', 'cyan');
  log('  node scaffold.js feature UserManager', 'white');
  log('  node scaffold.js feature ProductCatalog --no-auto-update', 'white');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  const [type, name] = args;
  const options = {
    autoUpdate: !args.includes('--no-auto-update')
  };

  try {
    log(`🔨 正在创建 ${name} ${type} 脚手架...`, 'cyan');

    createScaffold(type, name, options);

    log('\n🎉 脚手架创建完成!', 'green');
    logInfo(`已创建 ${name} 功能模块，包含:`);
    log('  • 类型定义', 'white');
    log('  • 状态管理 (Zustand)', 'white');
    log('  • API 服务', 'white');
    log('  • 自定义 Hook', 'white');
    log('  • 页面组件', 'white');
    log('  • UI 组件', 'white');
    log('  • 工具函数', 'white');

    log('\n💡 后续建议:', 'cyan');
    log(`1. 检查生成的代码并修改为你的需求`, 'white');
    log(`2. 运行类型检查: pnpm run type-check`, 'white');
    log(`3. 启动开发服务器: pnpm run dev`, 'white');
    log(`4. 访问新的功能页面: /${name.toLowerCase()}`, 'white');

  } catch (error) {
    logError(`创建失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as createScaffold, scaffolds };