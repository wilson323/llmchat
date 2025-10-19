/**
 * Jest 测试设置文件
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

// 设置测试环境
process.env.NODE_ENV = 'test';

// 模拟 console 方法以减少测试输出噪音
global.console = {
  ...console,
  // 保留 error 和 warn 供调试
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// 设置全局测试超时
jest.setTimeout(30000);

// 模拟性能 API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
  writable: true,
});

// 模拟 Date.now 以获得可预测的时间戳
const mockDateNow = jest.fn(() => 1672531200000); // 2023-01-01 00:00:00 UTC
Date.now = mockDateNow;

// 模拟 fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  })
) as jest.Mock;

// 模拟 AbortController
global.AbortController = jest.fn().mockImplementation(() => ({
  signal: {},
  abort: jest.fn(),
}));

// 模拟 AbortSignal
global.AbortSignal = {
  timeout: jest.fn(() => ({})),
  abort: jest.fn(() => ({})),
};

// 模拟 Request 和 Response
global.Request = jest.fn().mockImplementation((input, init) => ({
  input,
  init,
  headers: new Headers(init?.headers),
})) as any;

global.Response = jest.fn().mockImplementation((body, init) => ({
  body,
  status: init?.status || 200,
  statusText: init?.statusText || 'OK',
  headers: new Headers(init?.headers),
  ok: (init?.status || 200) < 400,
  json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
  text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
})) as any;

// 模拟 Headers
global.Headers = jest.fn().mockImplementation((init) => {
  const headers = new Map();
  if (init) {
    Object.entries(init).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  return {
    get: (key: string) => headers.get(key),
    set: (key: string, value: string) => headers.set(key, value),
    has: (key: string) => headers.has(key),
    delete: (key: string) => headers.delete(key),
    entries: () => headers.entries(),
    keys: () => headers.keys(),
    values: () => headers.values(),
    forEach: (callback: (value: string, key: string) => void) => {
      headers.forEach(callback);
    },
  };
}) as any;

// 模拟 URL 和 URLSearchParams
global.URL = class URL {
  constructor(public href: string, base?: string) {
    // 简单的 URL 解析实现
    this.searchParams = new URLSearchParams(href.split('?')[1] || '');
  }

  public protocol = 'https:';
  public hostname = 'example.com';
  public port = '';
  public pathname = '/';
  public search = '';
  public hash = '';
  public origin = 'https://example.com';
  public searchParams: URLSearchParams;

  toString() {
    return this.href;
  }
} as any;

global.URLSearchParams = class URLSearchParams {
  private params: Map<string, string> = new Map();

  constructor(init?: string | Record<string, string> | [string, string][] | URLSearchParams) {
    super();
    if (typeof init === 'string') {
      new Map(init.split('&').map(pair => pair.split('=')));
    } else if (init) {
      // 处理其他初始化类型
    }
  }

  get(name: string): string | null {
    return this.params.get(name) || null;
  }

  set(name: string, value: string): void {
    this.params.set(name, value);
  }

  has(name: string): boolean {
    return this.params.has(name);
  }

  delete(name: string): void {
    this.params.delete(name);
  }

  toString(): string {
    return Array.from(this.params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
} as any;

// 模拟 localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0,
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// 模拟 sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0,
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// 模拟 crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
  },
  writable: true,
});

// 模拟 ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// 模拟 IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// 模拟 requestAnimationFrame 和 cancelAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// 模拟 matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟 getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => '',
    zIndex: '0',
  }),
});

// 模拟 window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
});

// 测试工具函数
export const createMockAgent = (overrides = {}) => ({
  id: 'agent-test-123',
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  model: 'gpt-3.5-turbo',
  status: 'active',
  capabilities: ['text-generation'],
  provider: 'openai',
  isActive: true,
  ...overrides,
});

export const createMockMessage = (overrides = {}) => ({
  id: 'msg-test-123',
  role: 'user',
  content: 'Test message',
  timestamp: Date.now(),
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 'user-test-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  status: 'active',
  authProvider: 'local',
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockApiResponse = (data: any, overrides = {}) => ({
  code: 'SUCCESS',
  message: 'Operation successful',
  data,
  timestamp: new Date().toISOString(),
  ...overrides,
});

export const createMockError = (message: string, code = 'ERROR') => ({
  code,
  message,
  success: false,
  error: message,
  timestamp: new Date().toISOString(),
});

// 异步测试工具
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// 模拟延迟
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
  // 重置 localStorage 模拟
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  // 重置 sessionStorage 模拟
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();

  // 重置 fetch 模拟
  (global.fetch as jest.Mock).mockClear();

  // 重置 Date.now 模拟
  mockDateNow.mockClear();
});