// / <reference types="vitest" />

declare global {
  const describe: typeof import('vitest').describe;
  const it: typeof import('vitest').it;
  const test: typeof import('vitest').test;
  const expect: typeof import('vitest').expect;
  const vi: typeof import('vitest').vi;
  const beforeEach: typeof import('vitest').beforeEach;
  const afterEach: typeof import('vitest').afterEach;
  const Mock: typeof import('vitest').Mock;

  // Type helpers for tests
  type MockedFunction<T extends (...args: any[]) => any> = import('vitest').MockedFunction<T>
  type Mocked<T> = import('vitest').Mocked<T>
}

export {};