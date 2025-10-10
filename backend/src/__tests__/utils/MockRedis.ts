/**
 * Mock Redis 实现
 * 用于测试环境中替代真实的 Redis 连接
 */

export interface MockRedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(key: string | string[]): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  flushall(): Promise<string>;
  ping(): Promise<string>;
  quit(): Promise<string>;
}

/**
 * Mock Redis 客户端
 */
export class MockRedis implements MockRedisCommands {
  private data: Map<string, { value: string; expiry?: number }> = new Map();
  private connected = false;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(options?: any) {
    // 模拟连接建立
    setTimeout(() => {
      this.connected = true;
      this.emit('connect');
    }, 0);
  }

  // 基本命令实现
  async get(key: string): Promise<string | null> {
    if (!this.connected) throw new Error('Redis not connected');

    const item = this.data.get(key);
    if (!item) return null;

    // 检查过期
    if (item.expiry && Date.now() > item.expiry) {
      this.data.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number, option?: string): Promise<string | null> {
    if (!this.connected) throw new Error('Redis not connected');

    const expiry = duration ? Date.now() + duration * 1000 : undefined;
    if (expiry !== undefined) {
      this.data.set(key, { value, expiry });
    } else {
      this.data.set(key, { value });
    }

    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    if (!this.connected) throw new Error('Redis not connected');

    const expiry = Date.now() + seconds * 1000;
    this.data.set(key, { value, expiry });

    return 'OK';
  }

  async del(key: string | string[]): Promise<number> {
    if (!this.connected) throw new Error('Redis not connected');

    const keys = Array.isArray(key) ? key : [key];
    let deleted = 0;

    for (const k of keys) {
      if (this.data.delete(k)) deleted++;
    }

    return deleted;
  }

  async exists(key: string): Promise<number> {
    if (!this.connected) throw new Error('Redis not connected');

    const item = this.data.get(key);
    if (!item) return 0;

    // 检查过期
    if (item.expiry && Date.now() > item.expiry) {
      this.data.delete(key);
      return 0;
    }

    return 1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.connected) throw new Error('Redis not connected');

    const item = this.data.get(key);
    if (!item) return 0;

    item.expiry = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.connected) throw new Error('Redis not connected');

    const item = this.data.get(key);
    if (!item) return -2;

    if (!item.expiry) return -1;

    const remaining = Math.floor((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async flushall(): Promise<string> {
    if (!this.connected) throw new Error('Redis not connected');

    this.data.clear();
    return 'OK';
  }

  async ping(): Promise<string> {
    if (!this.connected) throw new Error('Redis not connected');
    return 'PONG';
  }

  async quit(): Promise<string> {
    this.connected = false;
    this.emit('close');
    return 'OK';
  }

  // 连接状态管理
  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connect');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('close');
  }

  // 事件处理
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  // 测试辅助方法
  clear(): void {
    this.data.clear();
  }

  size(): number {
    return this.data.size;
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }

  // 模拟网络延迟
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Mock Redis 工厂函数
 */
export function createMockRedis(options?: any): MockRedis {
  return new MockRedis(options);
}

/**
 * Mock ioredis 模块
 */
export const mockIORedis = {
  Redis: MockRedis,
};

/**
 * 为测试设置 Redis Mock
 */
export function setupRedisMock(): void {
  jest.mock('ioredis', () => mockIORedis);
}

/**
 * 重置 Redis Mock
 */
export function resetRedisMock(): void {
  jest.clearAllMocks();
}