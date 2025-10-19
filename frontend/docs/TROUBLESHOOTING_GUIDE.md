# 故障排除指南

## 📋 概述

本指南提供了 LLMChat 前端项目开发过程中常见问题的诊断方法和解决方案。涵盖了环境配置、构建错误、运行时问题、性能问题等各类问题的排查步骤。

## 🔧 环境问题排查

### 问题 1: Node.js 版本不兼容

**症状**:
```
Error: The module was compiled against a different Node.js version
```

**诊断步骤**:
```bash
# 检查当前 Node.js 版本
node --version

# 检查项目要求的 Node.js 版本
cat package.json | grep engines

# 检查 .nvmrc 文件（如果有）
cat .nvmrc
```

**解决方案**:
```bash
# 使用 nvm 切换到正确版本
nvm use

# 如果没有安装所需版本
nvm install 18.17.0
nvm use 18.17.0

# 设置默认版本
nvm alias default 18.17.0
```

### 问题 2: pnpm 安装失败

**症状**:
```
ERR_PNPM_NO_MATCHING_VERSION
Error: Unsupported engine
```

**诊断步骤**:
```bash
# 检查 pnpm 版本
pnpm --version

# 检查项目要求的 pnpm 版本
cat package.json | grep pnpm

# 清除 pnpm 缓存
pnpm store path
```

**解决方案**:
```bash
# 更新 pnpm 到最新版本
npm install -g pnpm@latest

# 或安装指定版本
npm install -g pnpm@8.6.0

# 清理并重新安装
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 问题 3: 端口被占用

**症状**:
```
Error: listen EADDRINUSE :::3000
```

**诊断步骤**:
```bash
# 查找占用端口的进程
# macOS/Linux
lsof -i :3000

# Windows
netstat -ano | findstr :3000

# 查看所有端口占用情况
lsof -i -P -n | grep LISTEN
```

**解决方案**:
```bash
# 方法 1: 杀死占用进程
# macOS/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F

# 方法 2: 修改端口配置
# 编辑 vite.config.ts
export default defineConfig({
  server: {
    port: 3001, // 修改为其他端口
  },
});

# 方法 3: 查找并关闭相关应用
# 检查是否有其他终端或编辑器在运行相同项目
```

## 🏗️ 构建问题排查

### 问题 1: TypeScript 编译错误

**症状**:
```
error TS2322: Type 'string' is not assignable to type 'number'
error TS2532: Type is possibly 'undefined'
```

**诊断步骤**:
```bash
# 检查 TypeScript 配置
cat frontend/tsconfig.json

# 检查类型错误详情
pnpm run type-check

# 查看具体错误行号
# 错误信息会显示文件名和行号
```

**解决方案**:
```typescript
// 常见类型错误修复

// 1. 类型不匹配
// 错误: const count: number = "123";
// 正确: const count: number = parseInt("123", 10);

// 2. 可能为 undefined
// 错误: user.name.toUpperCase();
// 正确: user.name?.toUpperCase() || '';

// 3. 类型断言
// 错误: (response as any).data;
// 正确: if (isUserResponse(response)) { response.data; }

// 4. 接口属性缺失
// 错误: 传递了额外属性
// 正确: 使用 Partial 或扩展接口
```

### 问题 2: ESLint 错误

**症状**:
```
error 'unused' is not defined
error 'react-hooks/exhaustive-deps'
```

**诊断步骤**:
```bash
# 检查 ESLint 配置
cat .eslintrc.cjs

# 查看具体错误
pnpm run lint

# 自动修复简单错误
pnpm run lint:fix
```

**解决方案**:
```typescript
// 常见 ESLint 错误修复

// 1. 未使用变量
// 删除变量或添加下划线前缀
const _unusedVar = value;

// 2. React Hook 依赖
// 错误: useEffect(() => {}, [count]);
// 正确: useEffect(() => {}, [count, updateCount]);

// 3. 导入顺序
// 使用自动修复
pnpm run lint:fix

// 4. 控制台语句
// 使用 logger 替代 console
import logger from '@/utils/logger';
logger.info('message');
```

### 问题 3: CSS/样式问题

**症状**:
```
Module not found: Can't resolve './styles.css'
Tailwind CSS classes not working
```

**诊断步骤**:
```bash
# 检查 CSS 模块配置
cat vite.config.ts | grep css

# 检查 Tailwind 配置
cat tailwind.config.js

# 检查样式文件路径
ls -la src/styles/
```

**解决方案**:
```typescript
// 1. CSS 模块导入
// 正确导入方式
import styles from './Component.module.css';

// 使用样式
<div className={styles.container}>

// 2. Tailwind CSS 问题
// 检查 tailwind.config.js 路径配置
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
};

// 检查 CSS 导入
import './styles/globals.css';

// 3. PostCSS 配置
// 创建 postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

## 🚀 运行时问题排查

### 问题 1: API 请求失败

**症状**:
```
Network Error
404 Not Found
CORS policy error
```

**诊断步骤**:
```bash
# 检查后端服务状态
curl http://localhost:3001/health

# 检查网络请求
# 打开浏览器开发者工具 -> Network 标签

# 检查环境变量
cat frontend/.env | grep VITE_API_BASE_URL
```

**解决方案**:
```typescript
// 1. 检查 API 配置
// frontend/.env
VITE_API_BASE_URL=http://localhost:3001

// 2. 处理 CORS 问题
// 后端配置 CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

// 3. 添加错误处理
const handleApiError = (error: unknown) => {
  if (error instanceof Error) {
    console.error('API Error:', error.message);
  }
  return { success: false, error: 'Request failed' };
};
```

### 问题 2: 状态管理问题

**症状**:
```
状态更新不及时
组件不重新渲染
状态丢失
```

**诊断步骤**:
```typescript
// 1. 检查状态更新
// 添加日志
console.log('State updated:', newState);

// 2. 检查组件订阅
// 确保组件正确订阅状态变化

// 3. 检查状态持久化
// 检查 localStorage/ sessionStorage
```

**解决方案**:
```typescript
// 1. 正确的状态更新
// 使用不可变更新
const updateUser = (id: string, updates: Partial<User>) => {
  setUsers(prev => prev.map(user =>
    user.id === id ? { ...user, ...updates } : user
  ));
};

// 2. 避免直接修改状态
// 错误: users[0].name = 'New Name';
// 正确: setUsers(prev => prev.map((user, index) =>
//   index === 0 ? { ...user, name: 'New Name' } : user
// ));

// 3. 正确使用 useEffect
useEffect(() => {
  // 副作用逻辑
  return () => {
    // 清理逻辑
  };
}, [dependencies]); // 确保依赖数组正确
```

### 问题 3: 路由问题

**症状**:
```
404 页面找不到
路由参数丢失
导航不工作
```

**诊断步骤**:
```typescript
// 1. 检查路由配置
// 查看路由定义是否正确

// 2. 检查路由参数
// 查看 useParams 返回值

// 3. 检查导航逻辑
// 确保使用正确的导航组件
```

**解决方案**:
```typescript
// 1. 正确的路由配置
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/users/:id" element={<UserPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// 2. 正确获取路由参数
import { useParams } from 'react-router-dom';

function UserPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>User ID not found</div>;
  }

  return <div>User ID: {id}</div>;
}

// 3. 正确的导航
import { Link, useNavigate } from 'react-router-dom';

function Navigation() {
  const navigate = useNavigate();

  return (
    <nav>
      <Link to="/">Home</Link>
      <button onClick={() => navigate('/users/1')}>
        User 1
      </button>
    </nav>
  );
}
```

## ⚡ 性能问题排查

### 问题 1: 应用加载缓慢

**症状**:
```
首屏加载时间长
白屏时间长
交互响应慢
```

**诊断步骤**:
```bash
# 1. 检查构建包大小
pnpm run build
pnpm run preview

# 2. 分析包大小
npx vite-bundle-analyzer dist

# 3. 检查网络请求
# 浏览器开发者工具 -> Network 标签

# 4. 检查性能指标
# 浏览器开发者工具 -> Performance 标签
```

**解决方案**:
```typescript
// 1. 代码分割
// 路由级别分割
const HomePage = lazy(() => import('./pages/HomePage'));
const UserPage = lazy(() => import('./pages/UserPage'));

// 组件级别分割
const HeavyComponent = lazy(() => import('./components/HeavyComponent'));

// 2. 图片优化
// 使用 WebP 格式
// 添加图片懒加载
const LazyImage = ({ src, alt }: { src: string; alt: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef}>
      {isLoaded && <img src={src} alt={alt} />}
    </div>
  );
};

// 3. 缓存策略
// 使用 React Query 或 SWR
const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 分钟
    cacheTime: 10 * 60 * 1000, // 10 分钟
  });
};
```

### 问题 2: 内存泄漏

**症状**:
```
内存使用持续增长
页面变慢
浏览器崩溃
```

**诊断步骤**:
```typescript
// 1. 监控内存使用
// 浏览器开发者工具 -> Memory 标签

// 2. 检查事件监听器
// 确保正确清理事件监听器

// 3. 检查定时器
// 确保正确清理定时器
```

**解决方案**:
```typescript
// 1. 正确清理副作用
useEffect(() => {
  const handleResize = () => {
    // 处理窗口大小变化
  };

  window.addEventListener('resize', handleResize);

  return () => {
    // 清理事件监听器
    window.removeEventListener('resize', handleResize);
  };
}, []);

// 2. 正确清理定时器
useEffect(() => {
  const timer = setInterval(() => {
    // 定时任务
  }, 1000);

  return () => {
    // 清理定时器
    clearInterval(timer);
  };
}, []);

// 3. 正确清理订阅
useEffect(() => {
  const subscription = apiService.subscribe(data => {
    // 处理数据
  });

  return () => {
    // 取消订阅
    subscription.unsubscribe();
  };
}, []);
```

### 问题 3: 渲染性能问题

**症状**:
```
列表滚动卡顿
动画不流畅
交互响应延迟
```

**诊断步骤**:
```typescript
// 1. 检查组件渲染次数
// 使用 React DevTools Profiler

// 2. 检查长列表渲染
// 使用 React DevTools 查看组件树

// 3. 检查重渲染原因
// 添加 console.log 到组件渲染
```

**解决方案**:
```typescript
// 1. 使用 React.memo 优化组件
const UserCard = React.memo<UserCardProps>(({ user, onUpdate }) => {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onUpdate(user)}>
        Update
      </button>
    </div>
  );
});

// 2. 使用 useMemo 优化计算
const ExpensiveComponent = ({ data }: { data: number[] }) => {
  const expensiveValue = useMemo(() => {
    return data.reduce((sum, item) => sum + item, 0);
  }, [data]);

  return <div>Total: {expensiveValue}</div>;
};

// 3. 使用 useCallback 优化函数
const ParentComponent = () => {
  const [count, setCount] = useState(0);

  const handleUpdate = useCallback((user: User) => {
    // 处理更新
  }, []);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
      <UserCard user={user} onUpdate={handleUpdate} />
    </div>
  );
};

// 4. 虚拟化长列表
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ items }: { items: any[] }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {items[index].name}
    </div>
  );

  return (
    <List
      height={400}
      itemCount={items.length}
      itemSize={50}
    >
      {Row}
    </List>
  );
};
```

## 🧪 测试问题排查

### 问题 1: 测试失败

**症状**:
```
Test suite failed to run
Jest encountered an unexpected token
Cannot find module
```

**诊断步骤**:
```bash
# 检查测试配置
cat frontend/vite.config.ts | grep test

# 运行特定测试
pnpm test UserProfile.test.tsx

# 查看详细错误信息
pnpm test --verbose
```

**解决方案**:
```typescript
// 1. 正确的测试设置
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

// 2. 正确的测试导入
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserCard } from './UserCard';

// 3. 正确的 Mock 设置
vi.mock('@/services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
```

### 问题 2: 组件测试问题

**症状**:
```
Component not rendered
 fireEvent not working
 Query not found element
```

**诊断步骤**:
```typescript
// 1. 检查组件渲染
import { render, screen } from '@testing-library/react';
import UserCard from './UserCard';

test('renders user card', () => {
  render(<UserCard user={mockUser} />);
  const userName = screen.queryByText('John Doe');
  console.log('Found element:', userName); // 调试输出
});
```

**解决方案**:
```typescript
// 1. 正确的组件测试
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserCard } from './UserCard';

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
};

describe('UserCard', () => {
  it('renders user information correctly', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('handles update button click', async () => {
    const mockOnUpdate = vi.fn();
    const user = userEvent.setup();

    render(<UserCard user={mockUser} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(mockOnUpdate).toHaveBeenCalledWith(mockUser);
  });
});
```

## 📋 问题检查清单

### 环境问题

- [ ] Node.js 版本是否符合要求
- [ ] pnpm 版本是否正确
- [ ] 端口是否被占用
- [ ] 环境变量是否正确配置
- [ ] 数据库连接是否正常

### 构建问题

- [ ] TypeScript 配置是否正确
- [ ] ESLint 规则是否通过
- [ ] 依赖是否正确安装
- [ ] 路径别名是否正确
- [ ] 样式文件是否正确导入

### 运行时问题

- [ ] API 请求是否正常
- [ ] 状态管理是否正确
- [ ] 路由配置是否正确
- [ ] 错误处理是否完善
- [ ] 用户交互是否正常

### 性能问题

- [ ] 是否有内存泄漏
- [ ] 组件是否过度渲染
- [ ] 长列表是否优化
- [ ] 图片是否优化
- [ ] 包大小是否合理

## 🚨 紧急问题处理

### 生产环境问题

1. **立即回滚**: 如果问题影响用户体验，立即回滚到上一个稳定版本
2. **收集日志**: 收集错误日志和用户反馈
3. **修复问题**: 在开发环境重现并修复问题
4. **测试验证**: 全面测试修复方案
5. **重新部署**: 部署修复版本

### 性能问题

1. **监控指标**: 检查性能监控数据
2. **确定瓶颈**: 找出性能瓶颈位置
3. **优化方案**: 制定优化计划
4. **逐步实施**: 逐步实施优化措施
5. **效果评估**: 评估优化效果

## 📞 获取帮助

### 内部资源

- **项目文档**: 查看相关技术文档
- **团队成员**: 联系相关开发人员
- **历史问题**: 查看已有问题和解决方案

### 外部资源

- **官方文档**: React, TypeScript, Vite 等
- **社区论坛**: Stack Overflow, GitHub Issues
- **技术博客**: 相关技术博客和教程

---

如果问题仍未解决，请联系开发团队或在项目仓库中创建 Issue。

最后更新: 2025-10-18