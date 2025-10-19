# 常见问题解答 (FAQ)

## 📋 目录

- [环境配置](#环境配置)
- [开发问题](#开发问题)
- [类型安全](#类型安全)
- [构建和部署](#构建和部署)
- [性能优化](#性能优化)
- [测试问题](#测试问题)
- [团队协作](#团队协作)
- [其他问题](#其他问题)

## 🔧 环境配置

### Q: 如何设置开发环境？

**A**: 请按照 [开发环境设置指南](./DEVELOPMENT_SETUP.md) 进行操作。主要步骤包括：

1. 安装 Node.js 18.x 或更高版本
2. 安装 pnpm 包管理器
3. 克隆项目并安装依赖
4. 配置环境变量
5. 启动开发服务器

### Q: 项目要求的 Node.js 版本是什么？

**A**: 项目要求 Node.js 18.x 或更高版本。建议使用 LTS 版本以获得最佳稳定性。

### Q: 如何检查和切换 Node.js 版本？

**A**: 使用 nvm（Node Version Manager）：

```bash
# 检查当前版本
node --version

# 安装所需版本
nvm install 18.17.0

# 切换版本
nvm use 18.17.0

# 设置默认版本
nvm alias default 18.17.0
```

### Q: 为什么推荐使用 pnpm 而不是 npm 或 yarn？

**A**: pnpm 具有以下优势：
- 更快的安装速度
- 更高效的磁盘空间利用
- 更严格的依赖管理
- 更好的 monorepo 支持

### Q: 如何解决端口被占用的问题？

**A**: 有几种解决方案：

1. **杀死占用进程**：
   ```bash
   # 查找占用端口的进程
   lsof -i :3000

   # 杀死进程
   kill -9 <PID>
   ```

2. **修改端口配置**：
   ```typescript
   // vite.config.ts
   export default defineConfig({
     server: {
       port: 3001, // 修改为其他端口
     },
   });
   ```

3. **使用随机端口**：
   ```typescript
   // vite.config.ts
   export default defineConfig({
     server: {
       port: 0, // 使用随机可用端口
     },
   });
   ```

## 💻 开发问题

### Q: 如何创建新的 React 组件？

**A**: 按照以下步骤创建组件：

1. **创建组件目录**：
   ```bash
   mkdir src/components/NewComponent
   cd src/components/NewComponent
   ```

2. **创建组件文件**：
   ```typescript
   // NewComponent.tsx
   import React from 'react';

   interface NewComponentProps {
     // 定义 Props 类型
   }

   const NewComponent: React.FC<NewComponentProps> = (props) => {
     return (
       <div>
         {/* 组件内容 */}
       </div>
     );
   };

   export default NewComponent;
   ```

3. **创建样式文件**：
   ```css
   /* NewComponent.module.css */
   .container {
     /* 样式定义 */
   }
   ```

4. **创建测试文件**：
   ```typescript
   // NewComponent.test.tsx
   import { render, screen } from '@testing-library/react';
   import NewComponent from './NewComponent';

   describe('NewComponent', () => {
     it('renders correctly', () => {
       render(<NewComponent />);
       // 测试逻辑
     });
   });
   ```

5. **创建导出文件**：
   ```typescript
   // index.ts
   export { default } from './NewComponent';
   export type { NewComponentProps } from './NewComponent';
   ```

### Q: 如何添加新的页面路由？

**A**: 按照以下步骤添加路由：

1. **创建页面组件**：
   ```typescript
   // src/pages/NewPage.tsx
   import React from 'react';

   const NewPage: React.FC = () => {
     return (
       <div>
         <h1>New Page</h1>
       </div>
     );
   };

   export default NewPage;
   ```

2. **更新路由配置**：
   ```typescript
   // src/App.tsx
   import { Routes, Route } from 'react-router-dom';
   import NewPage from './pages/NewPage';

   function App() {
     return (
       <Routes>
         {/* 现有路由 */}
         <Route path="/new-page" element={<NewPage />} />
       </Routes>
     );
   }
   ```

3. **添加导航链接**：
   ```typescript
   import { Link } from 'react-router-dom';

   <Link to="/new-page">Go to New Page</Link>
   ```

### Q: 如何处理 API 请求？

**A**: 使用类型安全的 API 客户端：

```typescript
// 使用 ApiClient
import { apiClient } from '@/services/api';

const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};

// 在组件中使用
const UserList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
};
```

### Q: 如何管理应用状态？

**A**: 推荐使用 Zustand 进行状态管理：

```typescript
// 创建 store
import { create } from 'zustand';

interface UserStore {
  users: User[];
  loading: boolean;
  fetchUsers: () => Promise<void>;
  addUser: (user: User) => void;
}

const useUserStore = create<UserStore>((set, get) => ({
  users: [],
  loading: false,

  fetchUsers: async () => {
    set({ loading: true });
    try {
      const users = await apiClient.get('/users');
      set({ users, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  addUser: (user) => {
    set(state => ({
      users: [...state.users, user]
    }));
  },
}));

// 在组件中使用
const UserList = () => {
  const { users, loading, fetchUsers } = useUserStore();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        users.map(user => (
          <div key={user.id}>{user.name}</div>
        ))
      )}
    </div>
  );
};
```

## 🛡️ 类型安全

### Q: 如何避免使用 `any` 类型？

**A**: 遵循以下策略：

1. **使用具体类型**：
   ```typescript
   // 避免使用 any
   const data: any = await fetchData();

   // 使用具体类型
   const data: User = await fetchData();
   ```

2. **使用类型守卫**：
   ```typescript
   function isUser(value: unknown): value is User {
     return (
       typeof value === 'object' &&
       value !== null &&
       'id' in value &&
       'name' in value
     );
   }

   const data = await fetchData();
   if (isUser(data)) {
     // data 的类型被推断为 User
     console.log(data.name);
   }
   ```

3. **使用 Zod 进行运行时验证**：
   ```typescript
   const UserSchema = z.object({
     id: z.string().uuid(),
     name: z.string(),
     email: z.string().email(),
   });

   const data = await fetchData();
   const user = UserSchema.parse(data); // 类型安全
   ```

### Q: 如何处理可选属性？

**A**: 使用 TypeScript 的可选属性和空值检查：

```typescript
interface User {
  id: string;
  name: string;
  email?: string; // 可选属性
}

// 使用可选链操作符
const userEmail = user.email?.toLowerCase() || '';

// 使用默认值
const userName = user.name ?? 'Unknown';

// 使用类型守卫
function hasEmail(user: User): user is User & { email: string } {
  return user.email !== undefined;
}

if (hasEmail(user)) {
  // user.email 现在是确定的字符串类型
  console.log(user.email.toLowerCase());
}
```

### Q: 如何处理异步操作的类型？

**A**: 使用 Promise 和 async/await 类型：

```typescript
// 定义异步函数类型
type AsyncFunction<T, R> = (arg: T) => Promise<R>;

// 使用泛型 Promise
const fetchData = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  return response.json();
};

// 在组件中使用
const useData = <T>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchData<T>(url);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [url]);

  return { data, loading, error };
};
```

## 🏗️ 构建和部署

### Q: 如何构建生产版本？

**A**: 运行以下命令：

```bash
# 构建前端
pnpm run build

# 构建后端（如果需要）
cd backend && pnpm run build

# 预览生产构建
pnpm run preview
```

### Q: 如何优化构建包大小？

**A**: 使用以下策略：

1. **代码分割**：
   ```typescript
   // 路由级别分割
   const HomePage = lazy(() => import('./pages/HomePage'));
   const UserPage = lazy(() => import('./pages/UserPage'));

   // 组件级别分割
   const HeavyComponent = lazy(() => import('./components/HeavyComponent'));
   ```

2. **Tree Shaking**：
   ```typescript
   // 使用具名导入而不是默认导入
   import { debounce } from 'lodash-es'; // ✅
   // 而不是
   import _ from 'lodash'; // ❌
   ```

3. **分析包大小**：
   ```bash
   # 分析构建包大小
   npx vite-bundle-analyzer dist

   # 或者
   pnpm run build -- --analyze
   ```

### Q: 如何配置环境变量？

**A**: 按照以下步骤配置：

1. **创建环境变量文件**：
   ```bash
   # 开发环境
   cp .env.example .env.development

   # 生产环境
   cp .env.example .env.production
   ```

2. **配置环境变量**：
   ```env
   # .env.development
   VITE_API_BASE_URL=http://localhost:3001
   VITE_APP_NAME=LLMChat (Dev)

   # .env.production
   VITE_API_BASE_URL=https://api.llmchat.com
   VITE_APP_NAME=LLMChat
   ```

3. **在代码中使用**：
   ```typescript
   const apiUrl = import.meta.env.VITE_API_BASE_URL;
   const appName = import.meta.env.VITE_APP_NAME;
   ```

### Q: 如何部署到生产环境？

**A**: 参考以下部署步骤：

1. **构建生产版本**：
   ```bash
   pnpm run build
   ```

2. **配置 Web 服务器**（以 Nginx 为例）：
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       root /path/to/dist;
       try_files $uri $uri/ /index.html;
     }

     location /api {
       proxy_pass http://backend-server;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

3. **配置 HTTPS**（推荐）：
   ```bash
   # 使用 Let's Encrypt 获取免费 SSL 证书
   certbot --nginx -d your-domain.com
   ```

## ⚡ 性能优化

### Q: 如何优化组件渲染性能？

**A**: 使用以下优化技术：

1. **React.memo**：
   ```typescript
   const ExpensiveComponent = React.memo(({ data }) => {
     return <div>{/* 复杂渲染逻辑 */}</div>;
   });
   ```

2. **useMemo**：
   ```typescript
   const Component = ({ items }) => {
     const expensiveValue = useMemo(() => {
       return items.reduce((sum, item) => sum + item.value, 0);
     }, [items]);

     return <div>{expensiveValue}</div>;
   };
   ```

3. **useCallback**：
   ```typescript
   const Component = ({ onUpdate }) => {
     const handleClick = useCallback((item) => {
       onUpdate(item);
     }, [onUpdate]);

     return <button onClick={() => handleClick(item)}>Click</button>;
   };
   ```

### Q: 如何优化长列表渲染？

**A**: 使用虚拟化技术：

```typescript
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

### Q: 如何优化图片加载？

**A**: 使用以下图片优化策略：

1. **懒加载**：
   ```typescript
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
         {isLoaded && <img src={src} alt={alt} loading="lazy" />}
       </div>
     );
   };
   ```

2. **使用现代图片格式**：
   ```typescript
   const Picture = ({ src, alt }: { src: string; alt: string }) => (
     <picture>
       <source srcSet={`${src}.webp`} type="image/webp" />
       <source srcSet={`${src}.avif`} type="image/avif" />
       <img src={`${src}.jpg`} alt={alt} loading="lazy" />
     </picture>
   );
   ```

### Q: 如何监控应用性能？

**A**: 使用性能监控工具：

1. **Web Vitals**：
   ```typescript
   import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

   getCLS(console.log);
   getFID(console.log);
   getFCP(console.log);
   getLCP(console.log);
   getTTFB(console.log);
   ```

2. **React Profiler**：
   ```typescript
   import { Profiler } from 'react';

   const onRenderCallback = (id, phase, actualDuration) => {
     console.log('Component render time:', id, phase, actualDuration);
   };

   <Profiler id="App" onRender={onRenderCallback}>
     <App />
   </Profiler>
   ```

## 🧪 测试问题

### Q: 如何编写组件测试？

**A**: 使用 React Testing Library：

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Q: 如何测试异步操作？

**A**: 使用 async/await 和 waitFor：

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { UserList } from './UserList';

// Mock API
jest.mock('@/services/api', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

describe('UserList', () => {
  it('loads and displays users', async () => {
    const mockUsers = [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ];

    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUsers });

    render(<UserList />);

    // 初始状态显示加载
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // 等待异步操作完成
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });
});
```

### Q: 如何测试自定义 Hook？

**A**: 使用 @testing-library/react-hooks：

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());

    expect(result.current.count).toBe(0);
  });

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(4);
  });
});
```

## 👥 团队协作

### Q: 如何创建 Pull Request？

**A**: 按照以下步骤创建 PR：

1. **创建功能分支**：
   ```bash
   git checkout -b feature/new-feature
   ```

2. **开发和提交**：
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

3. **创建 PR**：
   - 在 GitHub 上点击 "New pull request"
   - 选择目标分支（通常是 `develop`）
   - 填写 PR 模板
   - 请求审查

### Q: 代码审查需要注意什么？

**A**: 重点关注以下方面：

1. **代码质量**：
   - 是否符合编码规范
   - 是否有重复代码
   - 命名是否清晰

2. **类型安全**：
   - TypeScript 类型定义是否准确
   - 是否有不必要的 `any` 类型
   - 错误处理是否完善

3. **性能考虑**：
   - 是否有不必要的渲染
   - 是否有内存泄漏风险
   - 是否需要优化

4. **测试覆盖**：
   - 是否有适当的测试
   - 测试是否覆盖关键逻辑
   - 测试代码质量如何

### Q: 如何解决合并冲突？

**A**: 按照以下步骤解决冲突：

1. **更新主分支**：
   ```bash
   git checkout main
   git pull origin main
   ```

2. **切换到功能分支**：
   ```bash
   git checkout feature/new-feature
   ```

3. **合并主分支**：
   ```bash
   git merge main
   ```

4. **解决冲突**：
   - 打开冲突文件
   - 手动解决冲突
   - 保存文件

5. **提交解决**：
   ```bash
   git add .
   git commit -m "resolve merge conflicts"
   ```

6. **推送更新**：
   ```bash
   git push origin feature/new-feature
   ```

## 🔧 其他问题

### Q: 如何添加新的依赖包？

**A**: 使用以下命令添加依赖：

```bash
# 生产依赖
pnpm add package-name

# 开发依赖
pnpm add -D package-name

# 特定版本
pnpm add package-name@1.2.3

# 最新版本
pnpm add package-name@latest
```

### Q: 如何更新依赖包？

**A**: 使用以下命令更新依赖：

```bash
# 检查过期包
pnpm outdated

# 更新所有包
pnpm update

# 更新特定包
pnpm update package-name

# 交互式更新
pnpm update -i
```

### Q: 如何调试应用？

**A**: 使用以下调试方法：

1. **浏览器调试**：
   - 使用 Chrome DevTools
   - 设置断点
   - 查看控制台输出

2. **VS Code 调试**：
   - 配置 launch.json
   - 使用调试器
   - 查看变量值

3. **React DevTools**：
   - 安装浏览器扩展
   - 检查组件状态
   - 分析性能

### Q: 如何处理浏览器兼容性？

**A**: 使用以下策略：

1. **配置 Babel**：
   ```javascript
   // vite.config.ts
   export default defineConfig({
     build: {
       target: 'es2015', // 或更低版本以支持更多浏览器
     },
   });
   ```

2. **使用 Polyfill**：
   ```bash
   pnpm add core-js
   ```

3. **测试兼容性**：
   - 使用 BrowserStack
   - 使用 LambdaTest
   - 在不同浏览器中测试

### Q: 如何处理国际化？

**A**: 使用 react-i18next：

```typescript
// 安装依赖
pnpm add react-i18next i18next

// 配置 i18n
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          welcome: 'Welcome',
        },
      },
      zh: {
        translation: {
          welcome: '欢迎',
        },
      },
    },
    lng: 'en',
    fallbackLng: 'en',
  });

// 在组件中使用
import { useTranslation } from 'react-i18next';

const Welcome = () => {
  const { t } = useTranslation();
  return <h1>{t('welcome')}</h1>;
};
```

---

## 📞 获取帮助

如果以上 FAQ 没有解决您的问题，可以通过以下方式获取帮助：

1. **查看详细文档**：
   - [开发环境设置指南](./DEVELOPMENT_SETUP.md)
   - [故障排除指南](./TROUBLESHOOTING_GUIDE.md)
   - [TypeScript 开发标准](./TYPESCRIPT_DEVELOPMENT_STANDARDS.md)

2. **联系团队**：
   - 在项目仓库中创建 Issue
   - 在团队沟通群中提问
   - 联系技术负责人

3. **社区资源**：
   - [React 官方文档](https://react.dev/)
   - [TypeScript 手册](https://www.typescriptlang.org/docs/)
   - [Stack Overflow](https://stackoverflow.com/)

---

本 FAQ 会随着项目发展持续更新。如有建议或新的问题，请联系团队。

最后更新: 2025-10-18