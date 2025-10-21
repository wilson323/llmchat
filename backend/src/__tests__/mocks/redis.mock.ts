/**
 * Redis!��a
 */

export const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  flushall: jest.fn(),
  lpush: jest.fn(),
  rpop: jest.fn(),
  brpop: jest.fn(),
  zadd: jest.fn(),
  zrange: jest.fn(),
  zcard: jest.fn(),
  llen: jest.fn(),
  ping: jest.fn(),
};