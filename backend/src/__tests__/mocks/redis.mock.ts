/**
 * Redis Mock - 用于测试的Redis客户端模拟
 * 
 * 提供：
 * - 基础键值操作Mock
 * - 过期时间管理Mock
 * - 列表操作Mock
 * - 哈希操作Mock
 */

/**
 * 内存存储（模拟Redis）
 */
class MemoryStore {
  private store: Map<string, { value: any; expireAt?: number }>;
  
  constructor() {
    this.store = new Map();
  }
  
  set(key: string, value: any, expireSeconds?: number): void {
    if (expireSeconds) {
      const expireAt = Date.now() + expireSeconds * 1000;
      this.store.set(key, { value, expireAt });
    } else {
      this.store.set(key, { value });
    }
  }
  
  get(key: string): any | null {
    const item = this.store.get(key);
    
    if (!item) return null;
    
    // 检查是否过期
    if (item.expireAt && Date.now() > item.expireAt) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  del(key: string): number {
    return this.store.delete(key) ? 1 : 0;
  }
  
  exists(key: string): number {
    return this.store.has(key) ? 1 : 0;
  }
  
  expire(key: string, seconds: number): number {
    const item = this.store.get(key);
    if (!item) return 0;
    
    item.expireAt = Date.now() + seconds * 1000;
    return 1;
  }
  
  ttl(key: string): number {
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    
    const remaining = Math.ceil((item.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
  
  keys(pattern: string): string[] {
    // 简单的模式匹配
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }
  
  clear(): void {
    this.store.clear();
  }
}

/**
 * Redis Mock客户端
 */
export class MockRedisClient {
  private store: MemoryStore;
  private delay: number;
  private shouldFail: boolean;
  
  constructor(config?: { delay?: number; shouldFail?: boolean }) {
    this.store = new MemoryStore();
    this.delay = config?.delay || 1;
    this.shouldFail = config?.shouldFail || false;
  }
  
  /**
   * GET命令
   */
  async get(key: string): Promise<string | null> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    return this.store.get(key);
  }
  
  /**
   * SET命令
   */
  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    if (mode === 'EX' && duration) {
      this.store.set(key, value, duration);
    } else {
      this.store.set(key, value);
    }
    
    return 'OK';
  }
  
  /**
   * DEL命令
   */
  async del(...keys: string[]): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    let count = 0;
    for (const key of keys) {
      count += this.store.del(key);
    }
    return count;
  }
  
  /**
   * EXISTS命令
   */
  async exists(...keys: string[]): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    let count = 0;
    for (const key of keys) {
      count += this.store.exists(key);
    }
    return count;
  }
  
  /**
   * EXPIRE命令
   */
  async expire(key: string, seconds: number): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    return this.store.expire(key, seconds);
  }
  
  /**
   * TTL命令
   */
  async ttl(key: string): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    return this.store.ttl(key);
  }
  
  /**
   * KEYS命令
   */
  async keys(pattern: string): Promise<string[]> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    return this.store.keys(pattern);
  }
  
  /**
   * LPUSH命令
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    const list = this.store.get(key) || [];
    const newList = [...values, ...list];
    this.store.set(key, newList);
    return newList.length;
  }
  
  /**
   * LRANGE命令
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    const list = this.store.get(key) || [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }
  
  /**
   * HSET命令
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    const hash = this.store.get(key) || {};
    const isNew = !hash[field];
    hash[field] = value;
    this.store.set(key, hash);
    return isNew ? 1 : 0;
  }
  
  /**
   * HGET命令
   */
  async hget(key: string, field: string): Promise<string | null> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    const hash = this.store.get(key);
    return hash ? hash[field] || null : null;
  }
  
  /**
   * HGETALL命令
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    return this.store.get(key) || {};
  }
  
  /**
   * INCR命令
   */
  async incr(key: string): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    const current = parseInt(this.store.get(key) || '0', 10);
    const newValue = current + 1;
    this.store.set(key, newValue.toString());
    return newValue;
  }
  
  /**
   * DECR命令
   */
  async decr(key: string): Promise<number> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    const current = parseInt(this.store.get(key) || '0', 10);
    const newValue = current - 1;
    this.store.set(key, newValue.toString());
    return newValue;
  }
  
  /**
   * FLUSHDB命令
   */
  async flushdb(): Promise<'OK'> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    this.store.clear();
    return 'OK';
  }
  
  /**
   * PING命令
   */
  async ping(): Promise<'PONG'> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Redis Error: Connection failed');
    }
    
    return 'PONG';
  }
  
  /**
   * QUIT命令
   */
  async quit(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }
  
  /**
   * 模拟延迟
   */
  private async simulateDelay(ms?: number): Promise<void> {
    const delayTime = ms || this.delay;
    return new Promise(resolve => setTimeout(resolve, delayTime));
  }
  
  /**
   * 设置失败模式
   */
  setFailMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  /**
   * 设置延迟
   */
  setDelay(ms: number): void {
    this.delay = ms;
  }
  
  /**
   * 重置Mock状态
   */
  reset(): void {
    this.store.clear();
    this.shouldFail = false;
    this.delay = 1;
  }
}

/**
 * 创建默认的Redis Mock实例
 */
export function createMockRedisClient(config?: { delay?: number; shouldFail?: boolean }): MockRedisClient {
  return new MockRedisClient(config);
}

/**
 * Jest Mock工厂函数
 */
export const mockRedisClientFactory = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
  keys: jest.fn().mockResolvedValue([]),
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  hset: jest.fn().mockResolvedValue(1),
  hget: jest.fn().mockResolvedValue(null),
  hgetall: jest.fn().mockResolvedValue({}),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),
  flushdb: jest.fn().mockResolvedValue('OK'),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK')
};

/**
 * 重置所有Mock
 */
export function resetAllRedisMocks(): void {
  Object.values(mockRedisClientFactory).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}

