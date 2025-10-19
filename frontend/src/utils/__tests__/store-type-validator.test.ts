/**
 * Store状态验证器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StoreTypeValidator,
  createStoreValidator,
  validatePersistedState,
  createStateSnapshot,
  validateStateSnapshot,
  StateMigrationStrategy,
  createStateMigrationStrategy,
  createValidatedStore,
  useStoreValidation,
  PerformanceConfig
} from '../store-type-validator';
import { RuntimeTypeValidator } from '../runtime-type-validator';

// Mock React hooks
vi.mock('react', () => ({
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useState: vi.fn(),
}));

describe('StoreTypeValidator', () => {
  let validator: StoreTypeValidator<{
    id: string;
    name: string;
    count: number;
  }>;

  beforeEach(() => {
    const stateValidator = RuntimeTypeValidator.create<{
      id: string;
      name: string;
      count: number;
    }>()
      .required()
      .validate(state => ({
        isValid: typeof state === 'object' &&
          typeof state.id === 'string' &&
          typeof state.name === 'string' &&
          typeof state.count === 'number',
        data: state,
        errors: []
      }));

    validator = createStoreValidator(stateValidator, {
      displayName: 'TestStore',
      strict: false,
      enableAutoFix: false
    });
  });

  describe('基本验证功能', () => {
    it('should validate valid store state', () => {
      const validState = {
        id: '123',
        name: 'Test',
        count: 42
      };

      const result = validator.validate(validState);

      expect(result.isValid).toBe(true);
      expect(result.validatedState).toEqual(validState);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should reject invalid store state', () => {
      const invalidState = {
        id: '123',
        name: 'Test'
        // missing count
      };

      const result = validator.validate(invalidState);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validatedState).toBeUndefined();
    });

    it('should handle non-object state', () => {
      const result = validator.validate(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('State must be an object');
    });
  });

  describe('迁移功能', () => {
    it('should apply migrations when needed', () => {
      const validatorWithMigration = createStoreValidator(
        RuntimeTypeValidator.create<any>().required(),
        {
          migrationStrategies: [
            {
              version: '2.0.0',
              migrate: (oldState: any) => ({
                ...oldState,
                version: '2.0.0',
                newField: 'migrated'
              })
            }
          ]
        }
      );

      const oldState = { id: '123', version: '1.0.0' };
      const result = validatorWithMigration.validate(oldState);

      expect(result.isValid).toBe(true);
      expect(result.migrated).toBe(true);
      expect(result.migrationVersion).toBe('2.0.0');
      expect(result.validatedState).toEqual({
        id: '123',
        version: '1.0.0',
        version: '2.0.0',
        newField: 'migrated'
      });
    });

    it('should handle migration errors', () => {
      const validatorWithBadMigration = createStoreValidator(
        RuntimeTypeValidator.create<any>().required(),
        {
          migrationStrategies: [
            {
              version: '2.0.0',
              migrate: () => {
                throw new Error('Migration failed');
              }
            }
          ]
        }
      );

      const oldState = { id: '123', version: '1.0.0' };
      const result = validatorWithBadMigration.validate(oldState);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Migration to version 2.0.0 failed: Migration failed');
    });
  });

  describe('自动修复功能', () => {
    it('should attempt auto-fix when enabled', () => {
      const validatorWithAutoFix = createStoreValidator(
        RuntimeTypeValidator.create<{ name: string; count: number }>().required(),
        {
          enableAutoFix: true
        }
      );

      const invalidState = { name: 'Test' }; // missing count
      const result = validatorWithAutoFix.validate(invalidState);

      expect(result.warnings).toContain('State auto-fixed');
    });
  });

  describe('错误和警告处理', () => {
    it('should call error callback for validation errors', () => {
      const onError = vi.fn();
      const validatorWithErrorCallback = createStoreValidator(
        RuntimeTypeValidator.create<any>().required(),
        { onError }
      );

      validatorWithErrorCallback.validate(null);

      expect(onError).toHaveBeenCalled();
    });

    it('should call warning callback for warnings', () => {
      const onWarning = vi.fn();
      const validatorWithWarningCallback = createStoreValidator(
        RuntimeTypeValidator.create<any>().required(),
        { onWarning }
      );

      // 模拟产生警告的情况
      const stateWithWarning = { id: '123', _deprecatedField: 'value' };
      validatorWithWarningCallback.validate(stateWithWarning);

      expect(onWarning).toHaveBeenCalled();
    });
  });

  describe('中间件创建', () => {
    it('should create validation middleware', () => {
      const middleware = validator.createMiddleware({
        stateValidator: validator['stateValidator'],
        onError: vi.fn()
      });

      expect(typeof middleware).toBe('function');
    });

    it('should validate state changes in middleware', () => {
      const onError = vi.fn();
      const middleware = validator.createMiddleware({
        stateValidator: validator['stateValidator'],
        onError
      });

      const mockSet = vi.fn();
      const mockGet = vi.fn(() => ({ id: '123', name: 'Old', count: 0 }));

      // 模拟中间件调用
      const wrappedSet = middleware(mockSet, mockGet);
      wrappedSet({ id: '123', name: 'New', count: 1 });

      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('迁移历史', () => {
    it('should track migration history', () => {
      const validatorWithMigration = createStoreValidator(
        RuntimeTypeValidator.create<any>().required(),
        {
          migrationStrategies: [
            {
              version: '2.0.0',
              migrate: (state: any) => ({ ...state, version: '2.0.0' })
            },
            {
              version: '3.0.0',
              migrate: (state: any) => ({ ...state, version: '3.0.0' })
            }
          ]
        }
      );

      const oldState = { version: '1.0.0' };
      validatorWithMigration.validate(oldState);

      const history = validatorWithMigration.getMigrationHistory();
      expect(history).toContain('2.0.0');
      expect(history).toContain('3.0.0');
    });

    it('should clear migration history', () => {
      const validatorWithMigration = createStoreValidator(
        RuntimeTypeValidator.create<any>().required(),
        {
          migrationStrategies: [
            {
              version: '2.0.0',
              migrate: (state: any) => ({ ...state, version: '2.0.0' })
            }
          ]
        }
      );

      const oldState = { version: '1.0.0' };
      validatorWithMigration.validate(oldState);

      expect(validatorWithMigration.getMigrationHistory().length).toBeGreaterThan(0);

      validatorWithMigration.clearMigrationHistory();
      expect(validatorWithMigration.getMigrationHistory().length).toBe(0);
    });
  });
});

describe('validatePersistedState', () => {
  it('should validate valid persisted state', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<{ name: string }>().required()
    );

    const persistedState = JSON.stringify({ name: 'Test' });
    const result = validatePersistedState(persistedState, validator);

    expect(result.isValid).toBe(true);
    expect(result.validatedState).toEqual({ name: 'Test' });
  });

  it('should handle JSON parsing errors', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<any>().required()
    );

    const invalidJson = '{ invalid json }';
    const result = validatePersistedState(invalidJson, validator);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Failed to parse persisted state:');
  });

  it('should handle already parsed state', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<{ name: string }>().required()
    );

    const parsedState = { name: 'Test' };
    const result = validatePersistedState(parsedState, validator);

    expect(result.isValid).toBe(true);
    expect(result.validatedState).toEqual(parsedState);
  });
});

describe('createStateSnapshot', () => {
  it('should create valid state snapshot', () => {
    const state = {
      id: '123',
      name: 'Test',
      version: '1.0.0'
    };

    const snapshot = createStateSnapshot(state);

    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.state).toEqual(state);
    expect(snapshot.checksum).toBeDefined();
    expect(snapshot.checksum.length).toBe(16);
  });

  it('should generate consistent checksums', () => {
    const state = { id: '123', name: 'Test' };
    const snapshot1 = createStateSnapshot(state);
    const snapshot2 = createStateSnapshot(state);

    expect(snapshot1.checksum).toBe(snapshot2.checksum);
  });
});

describe('validateStateSnapshot', () => {
  let validator: StoreTypeValidator<{ id: string; name: string }>;

  beforeEach(() => {
    validator = createStoreValidator(
      RuntimeTypeValidator.create<{ id: string; name: string }>().required()
    );
  });

  it('should validate valid state snapshot', () => {
    const state = { id: '123', name: 'Test' };
    const snapshot = createStateSnapshot(state);

    const result = validateStateSnapshot(snapshot, validator);

    expect(result.isValid).toBe(true);
    expect(result.validatedState).toEqual(state);
  });

  it('should reject invalid snapshot structure', () => {
    const invalidSnapshot = {
      // missing required fields
      state: { id: '123', name: 'Test' }
    };

    const result = validateStateSnapshot(invalidSnapshot, validator);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid snapshot structure');
  });

  it('should reject snapshots with invalid checksum', () => {
    const state = { id: '123', name: 'Test' };
    const snapshot = createStateSnapshot(state);

    // Modify the state but keep the old checksum
    const tamperedSnapshot = {
      ...snapshot,
      state: { id: '456', name: 'Modified' }
    };

    const result = validateStateSnapshot(tamperedSnapshot, validator);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Snapshot checksum mismatch');
  });
});

describe('StateMigrationStrategy', () => {
  it('should create migration strategy', () => {
    const strategy = createStateMigrationStrategy<{ version: string; data: any }>()
      .addMigration('1.0.0', (oldState) => ({
        ...oldState,
        version: '1.0.0',
        migrated: true
      }))
      .addMigration('2.0.0', (oldState) => ({
        ...oldState,
        version: '2.0.0',
        upgraded: true
      }));

    const oldState = { data: 'test' };
    const migratedState = strategy.migrate(oldState, '2.0.0');

    expect(migratedState).toEqual({
      data: 'test',
      version: '2.0.0',
      migrated: true,
      upgraded: true
    });
  });

  it('should handle migration errors', () => {
    const strategy = createStateMigrationStrategy()
      .addMigration('1.0.0', () => {
        throw new Error('Migration failed');
      });

    expect(() => {
      strategy.migrate({}, '1.0.0');
    }).toThrow('Migration to version 1.0.0 failed: Migration failed');
  });

  it('should update version number after migration', () => {
    const strategy = createStateMigrationStrategy()
      .addMigration('1.0.0', (oldState) => ({ ...oldState }));

    const oldState = { version: '0.9.0' };
    const migratedState = strategy.migrate(oldState, '1.0.0');

    expect(migratedState.version).toBe('1.0.0');
  });
});

describe('useStoreValidation Hook', () => {
  it('should validate store state on mount', () => {
    const mockStore = {
      getState: () => ({ id: '123', name: 'Test' }),
      subscribe: vi.fn()
    };

    const validator = createStoreValidator(
      RuntimeTypeValidator.create<{ id: string; name: string }>().required()
    );

    const mockReact = require('react');
    mockReact.useEffect = vi.fn((fn) => fn());
    mockReact.useCallback = vi.fn((fn) => fn);

    // 模拟hook调用
    const onError = vi.fn();
    useStoreValidation(mockStore, validator, {
      validateOnMount: true,
      onError
    });

    expect(mockReact.useEffect).toHaveBeenCalled();
  });

  it('should validate on state changes', () => {
    const mockStore = {
      getState: () => ({ id: '123', name: 'Test' }),
      subscribe: vi.fn()
    };

    const validator = createStoreValidator(
      RuntimeTypeValidator.create<any>().required()
    );

    const mockReact = require('react');
    mockReact.useEffect = vi.fn((fn) => fn());
    mockReact.useCallback = vi.fn((fn) => fn);

    useStoreValidation(mockStore, validator, {
      validateOnChange: true
    });

    expect(mockReact.useEffect).toHaveBeenCalled();
  });
});

describe('边界情况和错误处理', () => {
  it('should handle circular references in state', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<any>().required()
    );

    const circularState: any = { id: '123' };
    circularState.self = circularState;

    const result = validator.validate(circularState);
    // 应该能够处理循环引用而不崩溃
    expect(result).toBeDefined();
  });

  it('should handle very large state objects', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<{ items: any[] }>().required()
    );

    const largeState = {
      items: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item${i}` }))
    };

    const startTime = performance.now();
    const result = validator.validate(largeState);
    const endTime = performance.now();

    expect(result.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle null/undefined state gracefully', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<any>().required()
    );

    const nullResult = validator.validate(null);
    expect(nullResult.isValid).toBe(false);

    const undefinedResult = validator.validate(undefined);
    expect(undefinedResult.isValid).toBe(false);
  });
});

describe('性能测试', () => {
  it('should handle repeated validations efficiently', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<{ id: string; name: string }>().required()
    );

    const state = { id: '123', name: 'Test' };

    const startTime = performance.now();
    for (let i = 0; i < 1000; i++) {
      validator.validate(state);
    }
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
  });

  it('should cache validation results when appropriate', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<{ id: string }>().required()
    );

    const state = { id: '123' };

    // First validation
    const startTime1 = performance.now();
    const result1 = validator.validate(state);
    const endTime1 = performance.now();

    // Second validation (should be faster due to caching)
    const startTime2 = performance.now();
    const result2 = validator.validate(state);
    const endTime2 = performance.now();

    expect(result1.isValid).toBe(true);
    expect(result2.isValid).toBe(true);
    expect(endTime2 - startTime2).toBeLessThanOrEqual(endTime1 - startTime1);
  });
});

describe('集成测试', () => {
  it('should work with complex store scenarios', () => {
    interface ComplexStore {
      user: {
        id: string;
        profile: {
          name: string;
          preferences: {
            theme: string;
            language: string;
          };
        };
      };
      settings: {
        notifications: boolean;
        privacy: {
          shareData: boolean;
          analytics: boolean;
        };
      };
      data: Array<{
        id: string;
        content: string;
        metadata: Record<string, any>;
      }>;
    }

    const validator = createStoreValidator(
      RuntimeTypeValidator.create<ComplexStore>().required()
    );

    const complexState: ComplexStore = {
      user: {
        id: '123',
        profile: {
          name: 'John Doe',
          preferences: {
            theme: 'dark',
            language: 'en-US'
          }
        }
      },
      settings: {
        notifications: true,
        privacy: {
          shareData: false,
          analytics: true
        }
      },
      data: [
        {
          id: 'item1',
          content: 'Test content',
          metadata: { created: '2023-10-18', tags: ['test'] }
        }
      ]
    };

    const result = validator.validate(complexState);
    expect(result.isValid).toBe(true);
    expect(result.validatedState).toEqual(complexState);
  });

  it('should handle store versioning and migration', () => {
    const validator = createStoreValidator(
      RuntimeTypeValidator.create<any>().required(),
      {
        migrationStrategies: [
          {
            version: '1.0.0',
            migrate: (oldState: any) => ({
              ...oldState,
              version: '1.0.0',
              features: []
            })
          },
          {
            version: '2.0.0',
            migrate: (oldState: any) => ({
              ...oldState,
              version: '2.0.0',
              features: [...(oldState.features || []), 'newFeature']
            })
          }
        ]
      }
    );

    const v0State = { data: 'test', version: '0.9.0' };
    const result = validator.validate(v0State);

    expect(result.isValid).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.validatedState?.version).toBe('2.0.0');
    expect(result.validatedState?.features).toContain('newFeature');
  });
});